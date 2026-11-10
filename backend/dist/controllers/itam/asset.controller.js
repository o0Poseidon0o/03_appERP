"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyAssets = exports.deleteAsset = exports.updateAsset = exports.createAsset = exports.getAssetById = exports.getAllAssets = exports.syncAssetAgent = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const socket_1 = require("../../socket");
const softwareNormalizer_1 = require("../../utils/softwareNormalizer");
const generateChangeLog = (oldVal, newVal, label) => {
    if (!oldVal || !newVal)
        return null;
    const v1 = String(oldVal).trim();
    const v2 = String(newVal).trim();
    if (v1 !== v2) {
        return `Thay đổi ${label}: [${v1}] -> [${v2}]`;
    }
    return null;
};
const getDetailedDifference = (oldItems, newItems, keySelector, descGenerator) => {
    const oldKeys = oldItems.map(keySelector);
    const newKeys = newItems.map(keySelector);
    const removed = oldItems.filter(item => !newKeys.includes(keySelector(item))).map(descGenerator);
    const added = newItems.filter(item => !oldKeys.includes(keySelector(item))).map(descGenerator);
    const changes = [];
    if (removed.length > 0) {
        changes.push(`Bị tháo/Mất: ${removed.join(', ')}`);
    }
    if (added.length > 0) {
        changes.push(`Được gắn thêm: ${added.join(', ')}`);
    }
    return changes;
};
const syncAssetAgent = async (req, res, next) => {
    try {
        const SECRET_KEY = process.env.AGENT_SECRET_KEY ||
            process.env.AGENT_API_KEY ||
            "@Towa2026!#Secure_Agent_998811_AbCdEf";
        const apiKey = req.headers["x-agent-secret-key"] ||
            req.headers["x-api-key"];
        if (apiKey !== SECRET_KEY) {
            return res.status(403).json({ status: "fail", message: "Sai mã bảo mật Agent (X-Agent-Secret-Key)!" });
        }
        const data = req.body;
        if (!data.hostname) {
            return res.status(400).json({ status: "error", message: "Hostname is required" });
        }
        const uniqueHostname = data.hostname.toUpperCase().trim();
        const detectedCode = data.deviceType ? data.deviceType.toUpperCase() : "PC";
        let assetType = await prisma_1.default.assetType.findUnique({
            where: { code: detectedCode }
        });
        if (!assetType) {
            assetType = await prisma_1.default.assetType.upsert({
                where: { code: "PC" },
                update: {},
                create: { code: "PC", name: "Máy tính (Auto Import)" }
            });
        }
        const newDiskSummary = Array.isArray(data.disks)
            ? data.disks.map((d) => `${d.SizeGB}GB ${d.MediaType ? `(${d.MediaType})` : ""}`).join(" + ")
            : "N/A";
        const newRamString = `${data.ramGB} GB`;
        const newCpuString = data.cpuName;
        const existingAsset = await prisma_1.default.asset.findUnique({
            where: { name: uniqueHostname }
        });
        const changeDetails = [];
        if (existingAsset) {
            const oldSpecs = existingAsset.customSpecs || {};
            const ramLog = generateChangeLog(oldSpecs.ram, newRamString, "Tổng dung lượng RAM");
            if (ramLog)
                changeDetails.push(ramLog);
            const oldRamDetails = Array.isArray(oldSpecs.ramDetails) ? oldSpecs.ramDetails : [];
            const newRamDetails = Array.isArray(data.ramDetails) ? data.ramDetails : [];
            if (oldRamDetails.length > 0 || newRamDetails.length > 0) {
                const ramChanges = getDetailedDifference(oldRamDetails, newRamDetails, (item) => `${item.Slot || ''}-${item.Manufacturer || ''}-${item.Capacity || ''}-${item.Speed || ''}`, (item) => `[${item.Slot || 'Slot ẩn'}: ${item.Manufacturer || 'Unknown'} ${item.Capacity || ''} ${item.Speed ? `(${item.Speed})` : ''}]`);
                if (ramChanges.length > 0) {
                    changeDetails.push(`Thay đổi chi tiết RAM: ${ramChanges.join(' | ')}`);
                }
            }
            const cpuLog = generateChangeLog(oldSpecs.cpu, newCpuString, "CPU");
            if (cpuLog)
                changeDetails.push(cpuLog);
            const oldComponents = await prisma_1.default.assetComponent.findMany({
                where: { assetId: existingAsset.id, type: { in: ['MONITOR', 'HARD_DISK'] } }
            });
            const oldMonitors = oldComponents.filter(c => c.type === 'MONITOR');
            const oldDisks = oldComponents.filter(c => c.type === 'HARD_DISK');
            const diskLog = generateChangeLog(oldSpecs.disk, newDiskSummary, "Tổng dung lượng Ổ cứng");
            if (diskLog)
                changeDetails.push(diskLog);
            const newDisks = Array.isArray(data.disks) ? data.disks : [];
            if (oldDisks.length > 0 || newDisks.length > 0) {
                const diskChanges = getDetailedDifference(oldDisks, newDisks, (item) => (item.serialNumber || item.SerialNumber || "N/A") + "-" + (item.name || item.Model || ""), (item) => `[${item.name || item.Model} - SN: ${item.serialNumber || item.SerialNumber || 'N/A'}]`);
                if (diskChanges.length > 0) {
                    changeDetails.push(`Thay đổi Ổ cứng vật lý: ${diskChanges.join(' | ')}`);
                }
            }
            const newMonitors = Array.isArray(data.monitors) ? data.monitors : [];
            if (oldMonitors.length > 0 || newMonitors.length > 0) {
                const monitorChanges = getDetailedDifference(oldMonitors, newMonitors, (item) => {
                    const sn = item.serialNumber || item.SerialNumber || "N/A";
                    return sn !== "0" && sn !== "N/A" ? sn : (item.name || item.Model || "Unknown");
                }, (item) => {
                    const sn = item.serialNumber || item.SerialNumber || 'N/A';
                    const name = item.name || item.Model || 'Unknown';
                    const size = item.specs?.size || item.ScreenSize || '';
                    return `[${name} ${size ? `(${size})` : ''} - SN: ${sn}]`;
                });
                if (monitorChanges.length > 0) {
                    changeDetails.push(`Thay đổi Màn hình: ${monitorChanges.join(' | ')}`);
                }
            }
        }
        const blacklistedFound = [];
        const result = await prisma_1.default.$transaction(async (tx) => {
            const assetData = {
                serialNumber: data.serialNumber === "Default string" ? null : data.serialNumber,
                manufacturer: data.manufacturer,
                modelName: data.model,
                osName: data.osName,
                osVersion: data.osVersion,
                ipAddress: data.ipAddress,
                macAddress: data.macAddress,
                lastSeen: new Date(),
                domainUser: data.username,
                customSpecs: {
                    cpu: newCpuString,
                    ram: newRamString,
                    disk: newDiskSummary,
                    ramDetails: data.ramDetails || [],
                    gpus: data.gpus || [],
                    lastAgentSync: data.timestamp,
                },
            };
            const asset = await tx.asset.upsert({
                where: { name: uniqueHostname },
                update: assetData,
                create: {
                    name: uniqueHostname,
                    status: "NEW",
                    typeId: assetType.id,
                    ...assetData
                },
            });
            if (changeDetails.length > 0) {
                await tx.maintenanceLog.create({
                    data: {
                        assetId: asset.id,
                        type: 'UPGRADE',
                        description: `Hệ thống ghi nhận thay đổi phần cứng: ${changeDetails.join('. ')}`,
                        providerType: 'INTERNAL',
                        providerName: 'System Agent (Auto)',
                        cost: 0,
                        startDate: new Date(),
                        endDate: new Date(),
                        status: 'DONE'
                    }
                });
                const adminUsers = await tx.user.findMany({
                    where: { roleId: 'ROLE-ADMIN', isActive: true },
                    select: { id: true }
                });
                if (adminUsers.length > 0) {
                    const notificationData = adminUsers.map(admin => ({
                        userId: admin.id,
                        title: `⚠️ Cảnh báo phần cứng: ${uniqueHostname}`,
                        message: `Phát hiện thay đổi: ${changeDetails.join('. ')}`,
                        link: `/itam`,
                        isRead: false
                    }));
                    await tx.notification.createMany({
                        data: notificationData
                    });
                }
            }
            if (Array.isArray(data.disks)) {
                await tx.assetComponent.deleteMany({
                    where: { assetId: asset.id, type: "HARD_DISK" },
                });
                if (data.disks.length > 0) {
                    const diskComponents = data.disks.map((d) => ({
                        assetId: asset.id,
                        type: "HARD_DISK",
                        name: d.Model || "Unknown Disk",
                        serialNumber: d.SerialNumber !== "N/A" ? d.SerialNumber : null,
                        status: "ACTIVE",
                        specs: {
                            sizeGB: d.SizeGB,
                            interface: d.Interface,
                            type: d.MediaType,
                            index: d.Index,
                        },
                    }));
                    await tx.assetComponent.createMany({ data: diskComponents });
                }
            }
            if (Array.isArray(data.monitors)) {
                await tx.assetComponent.deleteMany({
                    where: { assetId: asset.id, type: "MONITOR" },
                });
                if (data.monitors.length > 0) {
                    const monitorComponents = data.monitors.map((m, index) => ({
                        assetId: asset.id,
                        type: "MONITOR",
                        name: m.Model || "Unknown Monitor",
                        serialNumber: m.SerialNumber !== "0" && m.SerialNumber !== "N/A" ? m.SerialNumber : null,
                        status: "ACTIVE",
                        specs: {
                            manufacturer: m.Manufacturer,
                            manufacturedDate: m.ManufacturedDate,
                            size: m.ScreenSize || "N/A",
                            index: index + 1
                        },
                    }));
                    await tx.assetComponent.createMany({ data: monitorComponents });
                }
            }
            if (Array.isArray(data.peripherals)) {
                await tx.assetComponent.deleteMany({
                    where: {
                        assetId: asset.id,
                        type: { in: ["KEYBOARD", "MOUSE", "PERIPHERAL"] }
                    },
                });
                if (data.peripherals.length > 0) {
                    const periphComponents = data.peripherals.map((p) => ({
                        assetId: asset.id,
                        type: p.Type.toUpperCase(),
                        name: p.Name,
                        serialNumber: null,
                        status: "ACTIVE",
                        specs: {
                            brand: p.Brand,
                            connection: p.Connection,
                            deviceId: p.Id
                        }
                    }));
                    await tx.assetComponent.createMany({ data: periphComponents });
                }
            }
            if (Array.isArray(data.software) && data.software.length > 0) {
                await tx.installedSoftware.deleteMany({
                    where: { assetId: asset.id },
                });
                const cleanedSoftware = (0, softwareNormalizer_1.normalizeAndDedupeSoftwareList)(data.software);
                const swList = cleanedSoftware.slice(0, 500).map((s) => ({
                    assetId: asset.id,
                    name: s.name || "Unknown App",
                    version: s.version || "",
                    publisher: s.publisher || "",
                }));
                if (swList.length > 0) {
                    await tx.installedSoftware.createMany({ data: swList });
                }
                const blacklistPolicies = await tx.softwarePolicy.findMany({
                    where: { category: "BLACKLIST" },
                });
                const defaultBlacklistPatterns = [
                    /uTorrent/i,
                    /BitTorrent/i,
                    /qBittorrent/i,
                    /KMSPico/i,
                    /KMSAuto/i,
                    /Cheat\s*Engine/i,
                    /Psiphon/i,
                    /SoftEther\s*VPN/i,
                    /Radmin\s*VPN/i,
                    /Hamachi/i,
                ];
                for (const sw of cleanedSoftware) {
                    const matchedPolicy = blacklistPolicies.find((pol) => {
                        try {
                            return new RegExp(pol.matchKeyword, "i").test(sw.name);
                        }
                        catch {
                            return sw.name.toLowerCase().includes(pol.matchKeyword.toLowerCase());
                        }
                    });
                    const matchedDefault = defaultBlacklistPatterns.some((rx) => rx.test(sw.name));
                    if (matchedPolicy || matchedDefault) {
                        blacklistedFound.push(sw.name);
                    }
                }
                if (blacklistedFound.length > 0) {
                    const adminUsers = await tx.user.findMany({
                        where: { roleId: "ROLE-ADMIN", isActive: true },
                        select: { id: true },
                    });
                    if (adminUsers.length > 0) {
                        await tx.notification.createMany({
                            data: adminUsers.map((admin) => ({
                                userId: admin.id,
                                title: `🚨 Cảnh báo phần mềm cấm: ${uniqueHostname}`,
                                message: `Phát hiện phần mềm nằm trong danh sách cấm trên máy ${uniqueHostname} (${data.username || "N/A"}): ${blacklistedFound.join(", ")}`,
                                link: `/itam/software`,
                                isRead: false,
                            })),
                        });
                    }
                }
            }
            return asset;
        });
        try {
            const io = (0, socket_1.getIO)();
            if (io) {
                io.emit("asset_updated", {
                    message: `Máy ${uniqueHostname} vừa cập nhật!`,
                    hostname: uniqueHostname
                });
                if (changeDetails.length > 0) {
                    console.log(`[CẢNH BÁO SOCKET] Phát hiện thay đổi trên ${uniqueHostname}`);
                    io.emit("hardware_alert", {
                        message: `Cảnh báo: ${uniqueHostname} vừa thay đổi phần cứng!`,
                        details: changeDetails
                    });
                }
                if (blacklistedFound.length > 0) {
                    console.log(`[CẢNH BÁO BLACKLIST] Phát hiện phần mềm cấm trên ${uniqueHostname}: ${blacklistedFound.join(", ")}`);
                    io.emit("software_blacklist_alert", {
                        hostname: uniqueHostname,
                        domainUser: data.username,
                        softwares: blacklistedFound,
                        message: `🚨 Máy ${uniqueHostname} cài đặt phần mềm cấm: ${blacklistedFound.join(", ")}`,
                    });
                    io.emit("hardware_alert", {
                        message: `🚨 Cảnh báo bảo mật: Máy ${uniqueHostname} cài phần mềm cấm!`,
                        details: blacklistedFound.map((s) => `Phần mềm cấm: ${s}`),
                    });
                }
            }
        }
        catch (e) {
            console.error("Lỗi gửi Socket:", e);
        }
        res.status(200).json({
            status: "success",
            message: changeDetails.length > 0
                ? `Đã cập nhật và ghi nhận ${changeDetails.length} thay đổi`
                : `Đồng bộ thành công`,
            data: result,
        });
    }
    catch (error) {
        console.error("Agent Sync Error:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};
exports.syncAssetAgent = syncAssetAgent;
const getAllAssets = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, typeId, factoryId, departmentId, status, parentId, excludeComputers } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const whereClause = {};
        if (search) {
            const searchString = String(search);
            whereClause.OR = [
                { name: { contains: searchString, mode: "insensitive" } },
                { serialNumber: { contains: searchString, mode: "insensitive" } },
                { modelName: { contains: searchString, mode: "insensitive" } },
                { domainUser: { contains: searchString, mode: "insensitive" } },
                { ipAddress: { contains: searchString } },
                {
                    users: {
                        some: {
                            fullName: { contains: searchString, mode: "insensitive" }
                        }
                    }
                }
            ];
        }
        if (typeId)
            whereClause.typeId = String(typeId);
        if (factoryId)
            whereClause.factoryId = String(factoryId);
        if (departmentId)
            whereClause.departmentId = String(departmentId);
        if (status)
            whereClause.status = String(status);
        if (parentId === "null") {
            whereClause.parentId = null;
        }
        else if (parentId) {
            whereClause.parentId = String(parentId);
        }
        if (excludeComputers === 'true') {
            whereClause.type = {
                code: {
                    notIn: ['PC', 'LAPTOP', 'SERVER']
                }
            };
        }
        const [assets, total] = await Promise.all([
            prisma_1.default.asset.findMany({
                where: whereClause,
                skip,
                take: Number(limit),
                orderBy: { updatedAt: "desc" },
                include: {
                    type: true,
                    factory: true,
                    department: true,
                    users: { select: { id: true, fullName: true, email: true } },
                    parent: { select: { id: true, name: true } },
                    _count: { select: { children: true, softwares: true } },
                    components: {
                        where: { type: { in: ['MONITOR', 'KEYBOARD', 'MOUSE'] } },
                        select: { id: true, name: true, serialNumber: true, type: true, specs: true }
                    }
                },
            }),
            prisma_1.default.asset.count({ where: whereClause }),
        ]);
        res.status(200).json({
            status: "success",
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            data: assets,
        });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};
exports.getAllAssets = getAllAssets;
const getAssetById = async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await prisma_1.default.asset.findUnique({
            where: { id },
            include: {
                type: true,
                factory: true,
                department: true,
                users: true,
                parent: true,
                children: { include: { type: true } },
                components: true,
                softwares: { orderBy: { name: "asc" } },
                maintenances: { orderBy: { startDate: "desc" } },
            },
        });
        if (!asset)
            return res.status(404).json({ status: "error", message: "Không tìm thấy tài sản!" });
        res.status(200).json({ status: "success", data: asset });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};
exports.getAssetById = getAssetById;
const createAsset = async (req, res) => {
    try {
        const data = req.body;
        const exists = await prisma_1.default.asset.findUnique({ where: { name: data.name } });
        if (exists)
            return res.status(400).json({ status: "error", message: "Tên tài sản đã tồn tại!" });
        const newAsset = await prisma_1.default.asset.create({
            data: {
                name: data.name,
                serialNumber: data.serialNumber,
                typeId: data.typeId,
                status: data.status || "NEW",
                factoryId: data.factoryId || null,
                departmentId: data.departmentId || null,
                domainUser: data.domainUser,
                parentId: data.parentId || null,
                manufacturer: data.manufacturer,
                modelName: data.modelName,
                customSpecs: data.customSpecs || {},
                users: data.userIds?.length > 0
                    ? { connect: data.userIds.map((id) => ({ id })) }
                    : undefined,
            },
        });
        res.status(201).json({ status: "success", data: newAsset });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};
exports.createAsset = createAsset;
const updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        if (data.name) {
            const exists = await prisma_1.default.asset.findFirst({
                where: { name: data.name, id: { not: id } },
            });
            if (exists)
                return res.status(400).json({ status: "error", message: "Tên tài sản đã bị trùng!" });
        }
        const updatedAsset = await prisma_1.default.asset.update({
            where: { id },
            data: {
                name: data.name,
                serialNumber: data.serialNumber,
                typeId: data.typeId,
                status: data.status,
                factoryId: data.factoryId,
                departmentId: data.departmentId,
                domainUser: data.domainUser,
                parentId: data.parentId,
                manufacturer: data.manufacturer,
                modelName: data.modelName,
                customSpecs: data.customSpecs,
                users: data.userIds
                    ? { set: data.userIds.map((id) => ({ id })) }
                    : undefined,
            },
        });
        res.status(200).json({ status: "success", data: updatedAsset });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};
exports.updateAsset = updateAsset;
const deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const childrenCount = await prisma_1.default.asset.count({ where: { parentId: id } });
        if (childrenCount > 0) {
            return res.status(400).json({
                status: "error",
                message: `Đang có ${childrenCount} thiết bị con gắn vào tài sản này. Hãy gỡ chúng ra trước!`
            });
        }
        await prisma_1.default.asset.delete({ where: { id } });
        res.status(200).json({ status: "success", message: "Đã xóa tài sản." });
    }
    catch (error) {
        if (error.code === 'P2003') {
            return res.status(400).json({ status: "error", message: "Tài sản này đang có dữ liệu liên quan. Không thể xóa!" });
        }
        res.status(500).json({ status: "error", message: error.message });
    }
};
exports.deleteAsset = deleteAsset;
const getMyAssets = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ status: "error", message: "Vui lòng đăng nhập" });
        }
        const assets = await prisma_1.default.asset.findMany({
            where: {
                users: { some: { id: userId } }
            },
            include: {
                type: true,
                department: true,
                factory: true,
                components: {
                    where: { type: { in: ['MONITOR', 'KEYBOARD', 'MOUSE'] } },
                    select: { id: true, name: true, serialNumber: true, type: true, specs: true }
                }
            },
            orderBy: { updatedAt: "desc" }
        });
        res.status(200).json({ status: "success", data: assets });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};
exports.getMyAssets = getMyAssets;
