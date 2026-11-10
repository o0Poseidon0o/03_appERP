"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importScannedDevices = exports.auditDeviceSecurity = exports.scanNetwork = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const prisma_1 = __importDefault(require("../../config/prisma"));
const socket_1 = require("../../socket");
const scanNetwork = async (req, res) => {
    try {
        const { subnets } = req.body;
        if (!subnets || !Array.isArray(subnets) || subnets.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "Vui lòng nhập dải mạng (Subnet). Ví dụ: 192.168.1.0/24"
            });
        }
        const scriptPath = path_1.default.join(process.cwd(), "scripts", "network_classify.py");
        const pythonCommand = os_1.default.platform() === "win32" ? "python" : "python3";
        console.log(`[NetworkScan] Bắt đầu tiến trình ngầm: ${subnets.join(" ")}`);
        res.status(200).json({
            status: "success",
            message: "Hệ thống đang quét mạng ngầm. Kết quả sẽ được gửi qua Socket khi hoàn tất.",
            processing: true
        });
        const pythonProcess = (0, child_process_1.spawn)(pythonCommand, [scriptPath, ...subnets]);
        let dataString = "";
        let errorString = "";
        pythonProcess.stdout.on("data", (data) => {
            dataString += data.toString();
        });
        pythonProcess.stderr.on("data", (data) => {
            console.log(`[Python Log]: ${data}`);
            errorString += data.toString();
        });
        pythonProcess.on("close", (code) => {
            const io = (0, socket_1.getIO)();
            if (code !== 0) {
                console.error(`[Scan Error]: ${errorString}`);
                io.emit("scan_error", { message: "Lỗi khi quét mạng (Python Error)", detail: errorString });
                return;
            }
            try {
                const results = JSON.parse(dataString);
                console.log(`✅ Quét xong! Tìm thấy ${results.length} thiết bị.`);
                io.emit("scan_complete", results);
            }
            catch (e) {
                console.error("JSON Parse Error:", dataString);
                io.emit("scan_error", { message: "Dữ liệu trả về không đúng định dạng", raw: dataString });
            }
        });
    }
    catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ status: "error", message: error.message });
        }
        else {
            console.error("Server Error:", error);
        }
    }
};
exports.scanNetwork = scanNetwork;
const auditDeviceSecurity = async (req, res) => {
    try {
        const { ip } = req.body;
        if (!ip)
            return res.status(400).json({ message: "Thiếu địa chỉ IP" });
        const scriptPath = path_1.default.join(process.cwd(), "scripts", "security_audit.py");
        const pythonCommand = os_1.default.platform() === "win32" ? "python" : "python3";
        console.log(`[SecurityAudit] Checking IP: ${ip}`);
        res.status(200).json({
            status: "success",
            message: "Đang kiểm tra bảo mật ngầm...",
            processing: true
        });
        const pythonProcess = (0, child_process_1.spawn)(pythonCommand, [scriptPath, ip]);
        let dataString = "";
        pythonProcess.stdout.on("data", (data) => { dataString += data.toString(); });
        pythonProcess.on("close", (code) => {
            const io = (0, socket_1.getIO)();
            try {
                const result = JSON.parse(dataString);
                io.emit("audit_complete", result);
            }
            catch (e) {
                console.error("Audit Error Parse");
                io.emit("audit_error", { ip, message: "Lỗi phân tích kết quả" });
            }
        });
    }
    catch (error) {
        if (!res.headersSent)
            res.status(500).json({ message: error.message });
    }
};
exports.auditDeviceSecurity = auditDeviceSecurity;
const importScannedDevices = async (req, res) => {
    try {
        const { devices } = req.body;
        if (!Array.isArray(devices) || devices.length === 0) {
            return res.status(400).json({ status: "error", message: "Danh sách thiết bị trống" });
        }
        let importedCount = 0;
        for (const dev of devices) {
            const code = dev.type === "NETWORK_DEVICE" ? "NETWORK" : (dev.type || "OTHER");
            const assetType = await prisma_1.default.assetType.upsert({
                where: { code },
                update: {},
                create: { code, name: code },
            });
            const name = (dev.hostname && dev.hostname !== "Unknown" ? dev.hostname : `${code}-${dev.ip}`).toUpperCase();
            await prisma_1.default.asset.upsert({
                where: { name },
                update: {
                    ipAddress: dev.ip,
                    macAddress: dev.mac || undefined,
                    manufacturer: dev.vendor || undefined,
                    lastSeen: new Date(),
                },
                create: {
                    name,
                    typeId: assetType.id,
                    ipAddress: dev.ip,
                    macAddress: dev.mac || null,
                    manufacturer: dev.vendor || null,
                    status: "IN_USE",
                    lastSeen: new Date(),
                },
            });
            importedCount++;
        }
        return res.status(200).json({
            status: "success",
            message: `Đã lưu ${importedCount} thiết bị vào hệ thống`,
        });
    }
    catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
};
exports.importScannedDevices = importScannedDevices;
