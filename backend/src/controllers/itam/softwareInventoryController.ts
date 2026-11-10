import { Request, Response } from "express";
import prisma from "../../config/prisma";
import { normalizeAndDedupeSoftwareList } from "../../utils/softwareNormalizer";

const DEFAULT_BLACKLIST_PATTERNS = [
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

const ensureDefaultPolicies = async () => {
  try {
    // 1. Tự động dọn các bản ghi Add-in rác cũ trong bảng InstalledSoftware (VD: Microsoft Teams Meeting Add-in for Microsoft Office)
    await prisma.installedSoftware.deleteMany({
      where: {
        OR: [
          { name: { contains: "Meeting Add-in", mode: "insensitive" } },
          { name: { contains: "Add-in for Microsoft", mode: "insensitive" } },
        ],
      },
    });

    // 2. Đảm bảo có sẵn danh mục phần mềm chính (với totalSeats = 0, chỉ tính số lượng khi người dùng nhập Key thực tế)
    const defaultPolicies = [
      {
        name: "Hệ điều hành Windows (Windows 7 / 10 / 11 / Server)",
        matchKeyword: "^Windows ",
        category: "LICENSED",
        totalSeats: 0,
        publisher: "Microsoft Corporation",
        note: "Quản lý Key bản quyền Hệ điều hành Windows (OEM / Retail / MAK / KMS) trên máy người dùng",
      },
      {
        name: "Kaspersky Endpoint Security",
        matchKeyword: "^Kaspersky",
        category: "LICENSED",
        totalSeats: 0,
        publisher: "Kaspersky",
        note: "Bản quyền phần mềm diệt virus Kaspersky cho máy trạm & Server",
      },
      {
        name: "Microsoft Office / Microsoft 365",
        matchKeyword: "^(Microsoft Office|Microsoft 365)",
        category: "LICENSED",
        totalSeats: 0,
        publisher: "Microsoft Corporation",
        note: "Bản quyền bộ ứng dụng văn phòng Microsoft Office / M365",
      },
      {
        name: "Autodesk AutoCAD",
        matchKeyword: "^(Autodesk )?AutoCAD",
        category: "LICENSED",
        totalSeats: 0,
        publisher: "Autodesk",
        note: "Bản quyền thiết kế kỹ thuật AutoCAD",
      },
      {
        name: "Phần mềm Torrent (uTorrent / BitTorrent / qBittorrent)",
        matchKeyword: "uTorrent|BitTorrent|qBittorrent",
        category: "BLACKLIST",
        totalSeats: 0,
        publisher: "Various",
        note: "Cấm sử dụng phần mềm P2P Torrent gây nghẽn băng thông và rủi ro mã độc",
      },
      {
        name: "Công cụ Crack / Active lậu (KMSPico / KMSAuto / Cheat Engine)",
        matchKeyword: "KMSPico|KMSAuto|Cheat Engine",
        category: "BLACKLIST",
        totalSeats: 0,
        publisher: "Unknown",
        note: "Công cụ bẻ khóa tiềm ẩn Trojan/Ransomware nguy hiểm",
      },
    ];

    for (const dp of defaultPolicies) {
      await prisma.softwarePolicy.upsert({
        where: { name: dp.name },
        update: {},
        create: dp,
      });
    }

    // 3. Nếu các policy mặc định cũ chưa có Key nào nhưng đang bị gán số 50/10 mẫu từ phiên bản trước -> đưa về 0
    const existingLicensed = await prisma.softwarePolicy.findMany({
      where: { category: "LICENSED" },
      include: { keys: true },
    });
    for (const pol of existingLicensed) {
      if (
        pol.keys.length === 0 &&
        pol.totalSeats > 0 &&
        (pol.note?.includes("Bản quyền bộ ứng dụng văn phòng") ||
          pol.note?.includes("Bản quyền phần mềm diệt virus Kaspersky") ||
          pol.note?.includes("Bản quyền thiết kế kỹ thuật AutoCAD"))
      ) {
        await prisma.softwarePolicy.update({
          where: { id: pol.id },
          data: {
            totalSeats: 0,
            matchKeyword: pol.name.includes("Office")
              ? "^(Microsoft Office|Microsoft 365)"
              : pol.matchKeyword,
          },
        });
      }
    }
  } catch (err) {
    // Bỏ qua nếu bảng chưa được migrate trên DB
  }
};

const matchPolicyKeyword = (softwareName: string, matchKeyword: string): boolean => {
  if (!softwareName || !matchKeyword) return false;
  // Không bao giờ khớp các gói Add-in / Plugin phụ vào bản quyền phần mềm chính
  if (/\b(Add-in|Plugin|Helper|Connector|MUI|Proofing)\b/i.test(softwareName)) {
    return false;
  }
  try {
    return new RegExp(matchKeyword, "i").test(softwareName);
  } catch {
    return softwareName.toLowerCase().includes(matchKeyword.toLowerCase());
  }
};

// 1. API TỔNG HỢP: Lấy danh sách tất cả phần mềm & Số lượng máy cài + Đối chiếu Bản quyền / Blacklist
// GET /api/itam/software/inventory
export const getSoftwareInventory = async (req: Request, res: Response) => {
  try {
    await ensureDefaultPolicies();

    const inventory = await prisma.installedSoftware.groupBy({
      by: ["name", "publisher"],
      _count: {
        assetId: true,
      },
      orderBy: {
        _count: {
          assetId: "desc",
        },
      },
    });

    let policies: any[] = [];
    try {
      policies = await prisma.softwarePolicy.findMany({
        include: {
          keys: {
            include: {
              assignments: true,
            },
          },
        },
      });
    } catch {
      policies = [];
    }

    const formattedData = inventory.map((item) => {
      const matchedPolicy = policies.find(
        (pol) =>
          pol.name.toLowerCase() === item.name.toLowerCase() ||
          matchPolicyKeyword(item.name, pol.matchKeyword)
      );

      const isDefaultBlacklisted = DEFAULT_BLACKLIST_PATTERNS.some((rx) =>
        rx.test(item.name)
      );

      let policyInfo: any = null;
      if (matchedPolicy) {
        const activeKeys = (matchedPolicy.keys || []).filter(
          (k: any) => k.status !== "REVOKED"
        );
        const keyTotalSeats = activeKeys.reduce(
          (sum: number, k: any) => sum + (Number(k.maxSeats) || 0),
          0
        );
        const assignedKeyCount = activeKeys.reduce(
          (sum: number, k: any) => sum + ((k.assignments || []).length || 0),
          0
        );
        const effectiveSeats =
          keyTotalSeats > 0 ? keyTotalSeats : matchedPolicy.totalSeats;

        policyInfo = {
          id: matchedPolicy.id,
          name: matchedPolicy.name,
          matchKeyword: matchedPolicy.matchKeyword,
          category: matchedPolicy.category, // LICENSED | BLACKLIST | FREE
          totalSeats: effectiveSeats,
          keyCount: activeKeys.length,
          assignedKeyCount,
          note: matchedPolicy.note,
        };
      } else if (isDefaultBlacklisted) {
        policyInfo = {
          id: null,
          name: item.name,
          matchKeyword: item.name,
          category: "BLACKLIST",
          totalSeats: 0,
          keyCount: 0,
          assignedKeyCount: 0,
          note: "Phần mềm nằm trong danh sách cấm mặc định",
        };
      }

      return {
        name: item.name,
        publisher: item.publisher || "Unknown",
        installCount: item._count.assetId,
        policy: policyInfo,
      };
    });

    return res.status(200).json({
      status: "success",
      totalUniqueSoftware: inventory.length,
      data: formattedData,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 2. API CHI TIẾT: Xem phần mềm X đang cài trên những máy nào?
// GET /api/itam/software/detail?name=AutoCAD
export const getSoftwareInstallations = async (req: Request, res: Response) => {
  try {
    const { name } = req.query;

    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp tên phần mềm (query param: name)" });
    }

    const installations = await prisma.installedSoftware.findMany({
      where: {
        name: {
          equals: name,
        },
      },
      select: {
        version: true,
        publisher: true,
        installDate: true,
        asset: {
          select: {
            id: true,
            name: true,
            domainUser: true,
            modelName: true,
            manufacturer: true,
            ipAddress: true,
            serialNumber: true,
            department: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
            users: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: {
        asset: { name: "asc" },
      },
    });

    return res.status(200).json({
      status: "success",
      softwareName: name,
      total: installations.length,
      data: installations,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 3. API XUẤT BÁO CÁO EXCEL TOÀN BỘ PHẦN MỀM
// GET /api/itam/software/export-all
export const exportAllSoftwareInstallations = async (req: Request, res: Response) => {
  try {
    const allInstallations = await prisma.installedSoftware.findMany({
      select: {
        name: true,
        version: true,
        publisher: true,
        asset: {
          select: {
            name: true,
            serialNumber: true,
            manufacturer: true,
            modelName: true,
            ipAddress: true,
            domainUser: true,
            type: { select: { name: true, code: true } },
            factory: { select: { name: true } },
            department: { select: { name: true } },
            users: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ name: "asc" }, { asset: { name: "asc" } }],
    });

    return res.status(200).json({
      status: "success",
      total: allInstallations.length,
      data: allInstallations,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 4. API LÀM GỌN & CHUẨN HÓA DỮ LIỆU PHẦN MỀM HIỆN CÓ TRONG DB
// POST /api/itam/software/cleanup
export const cleanupSoftwareInventory = async (req: Request, res: Response) => {
  try {
    const assetsWithSw = await prisma.asset.findMany({
      where: { softwares: { some: {} } },
      select: {
        id: true,
        softwares: {
          select: { name: true, version: true, publisher: true },
        },
      },
    });

    let beforeCount = 0;
    let afterCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const asset of assetsWithSw) {
        beforeCount += asset.softwares.length;
        const cleaned = normalizeAndDedupeSoftwareList(asset.softwares);
        afterCount += cleaned.length;

        await tx.installedSoftware.deleteMany({
          where: { assetId: asset.id },
        });

        if (cleaned.length > 0) {
          await tx.installedSoftware.createMany({
            data: cleaned.map((s) => ({
              assetId: asset.id,
              name: s.name,
              version: s.version,
              publisher: s.publisher,
            })),
          });
        }
      }
    });

    return res.status(200).json({
      status: "success",
      message: `Đã chuẩn hóa dữ liệu trên ${assetsWithSw.length} máy tính (Giảm từ ${beforeCount} xuống ${afterCount} dòng phần mềm).`,
      data: {
        assetsProcessed: assetsWithSw.length,
        beforeCount,
        afterCount,
        removedCount: beforeCount - afterCount,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// =========================================================================
// 5. QUẢN LÝ CHÍNH SÁCH PHẦN MỀM (SOFTWARE POLICY: LICENSED / BLACKLIST / FREE)
// =========================================================================

// GET /api/itam/software/policies
export const getSoftwarePolicies = async (req: Request, res: Response) => {
  try {
    await ensureDefaultPolicies();

    const [policies, installedGroups] = await Promise.all([
      prisma.softwarePolicy.findMany({
        include: {
          keys: {
            include: {
              assignments: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.installedSoftware.groupBy({
        by: ["name"],
        _count: { assetId: true },
      }),
    ]);

    const enriched = policies.map((pol) => {
      const installedCount = installedGroups
        .filter(
          (g) =>
            g.name.toLowerCase() === pol.name.toLowerCase() ||
            matchPolicyKeyword(g.name, pol.matchKeyword)
        )
        .reduce((sum, g) => sum + g._count.assetId, 0);

      const activeKeys = pol.keys.filter((k) => k.status !== "REVOKED");
      const keyTotalSeats = activeKeys.reduce((s, k) => s + (k.maxSeats || 0), 0);
      const assignedSeats = activeKeys.reduce(
        (s, k) => s + (k.assignments?.length || 0),
        0
      );

      return {
        ...pol,
        installedCount,
        keyCount: pol.keys.length,
        keyTotalSeats,
        assignedSeats,
        effectiveSeats:
          keyTotalSeats > 0 ? Math.max(pol.totalSeats, keyTotalSeats) : pol.totalSeats,
      };
    });

    return res.status(200).json({ status: "success", data: enriched });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// POST /api/itam/software/policies
export const upsertSoftwarePolicy = async (req: Request, res: Response) => {
  try {
    const { name, matchKeyword, category, totalSeats, publisher, note } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Tên chính sách phần mềm là bắt buộc" });
    }

    const cleanName = name.trim();
    const cleanKeyword = (matchKeyword || cleanName).trim();

    const policy = await prisma.softwarePolicy.upsert({
      where: { name: cleanName },
      update: {
        matchKeyword: cleanKeyword,
        category: category || "LICENSED",
        totalSeats: Number(totalSeats) || 0,
        publisher: publisher || null,
        note: note || null,
      },
      create: {
        name: cleanName,
        matchKeyword: cleanKeyword,
        category: category || "LICENSED",
        totalSeats: Number(totalSeats) || 0,
        publisher: publisher || null,
        note: note || null,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Đã lưu chính sách phần mềm thành công!",
      data: policy,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// PATCH /api/itam/software/policies/:id
export const updateSoftwarePolicy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, matchKeyword, category, totalSeats, publisher, note } = req.body;

    const updated = await prisma.softwarePolicy.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(matchKeyword !== undefined ? { matchKeyword: matchKeyword.trim() } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(totalSeats !== undefined ? { totalSeats: Number(totalSeats) || 0 } : {}),
        ...(publisher !== undefined ? { publisher } : {}),
        ...(note !== undefined ? { note } : {}),
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Đã cập nhật chính sách phần mềm!",
      data: updated,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// DELETE /api/itam/software/policies/:id
export const deleteSoftwarePolicy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.softwarePolicy.delete({ where: { id } });
    return res.status(200).json({
      status: "success",
      message: "Đã xóa chính sách phần mềm!",
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// =========================================================================
// 6. QUẢN LÝ KEY BẢN QUYỀN (KASPERSKY, OFFICE, AUTOCAD, WINDOWS...)
// =========================================================================

// GET /api/itam/software/keys
export const getLicenseKeys = async (req: Request, res: Response) => {
  try {
    await ensureDefaultPolicies();

    const keys = await prisma.softwareLicenseKey.findMany({
      include: {
        policy: true,
        assignments: {
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                serialNumber: true,
                ipAddress: true,
                domainUser: true,
                modelName: true,
                department: { select: { id: true, name: true } },
                factory: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const enrichedKeys = keys.map((k) => {
      const assignedCount = k.assignments.length;
      const remainingSeats = Math.max(0, (k.maxSeats || 1) - assignedCount);
      let daysUntilExpiry: number | null = null;
      let computedStatus = k.status;

      if (k.expiredAt) {
        const diffMs = new Date(k.expiredAt).getTime() - now.getTime();
        daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 0 && computedStatus !== "REVOKED") {
          computedStatus = "EXPIRED";
        } else if (daysUntilExpiry <= 30 && computedStatus === "ACTIVE") {
          computedStatus = "EXPIRING_SOON";
        }
      }

      return {
        ...k,
        assignedCount,
        remainingSeats,
        daysUntilExpiry,
        computedStatus,
      };
    });

    return res.status(200).json({
      status: "success",
      total: enrichedKeys.length,
      data: enrichedKeys,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// POST /api/itam/software/keys
export const createLicenseKey = async (req: Request, res: Response) => {
  try {
    const {
      policyId,
      softwareName,
      matchKeyword,
      publisher,
      licenseKey,
      keyType,
      maxSeats,
      expiredAt,
      supplier,
      invoiceCode,
      status,
      note,
      assetIds,
    } = req.body;

    if (!licenseKey || !licenseKey.trim()) {
      return res.status(400).json({ message: "Vui lòng nhập mã Key bản quyền!" });
    }

    let targetPolicyId = policyId;

    if (!targetPolicyId) {
      if (!softwareName || !softwareName.trim()) {
        return res
          .status(400)
          .json({ message: "Vui lòng chọn phần mềm hoặc nhập tên phần mềm!" });
      }
      const cleanSwName = softwareName.trim();
      const policy = await prisma.softwarePolicy.upsert({
        where: { name: cleanSwName },
        update: {},
        create: {
          name: cleanSwName,
          matchKeyword: (matchKeyword || cleanSwName).trim(),
          category: "LICENSED",
          totalSeats: Number(maxSeats) || 1,
          publisher: publisher || null,
        },
      });
      targetPolicyId = policy.id;
    }

    const seats = Math.max(1, Number(maxSeats) || 1);
    const validAssetIds: string[] = Array.isArray(assetIds)
      ? assetIds.slice(0, seats)
      : [];

    const createdKey = await prisma.$transaction(async (tx) => {
      const newKey = await tx.softwareLicenseKey.create({
        data: {
          policyId: targetPolicyId,
          licenseKey: licenseKey.trim(),
          keyType: keyType || "SUBSCRIPTION",
          maxSeats: seats,
          expiredAt: expiredAt ? new Date(expiredAt) : null,
          supplier: supplier || null,
          invoiceCode: invoiceCode || null,
          status: status || "ACTIVE",
          note: note || null,
        },
      });

      if (validAssetIds.length > 0) {
        await tx.softwareKeyAssignment.createMany({
          data: validAssetIds.map((assetId) => ({
            keyId: newKey.id,
            assetId,
          })),
          skipDuplicates: true,
        });
      }

      // Đồng bộ tổng số lượng license (totalSeats) của Policy nếu tổng seats các Key lớn hơn
      const allKeys = await tx.softwareLicenseKey.findMany({
        where: { policyId: targetPolicyId, status: { not: "REVOKED" } },
      });
      const sumKeySeats = allKeys.reduce((s, k) => s + (k.maxSeats || 0), 0);
      const currentPolicy = await tx.softwarePolicy.findUnique({
        where: { id: targetPolicyId },
      });
      if (currentPolicy && sumKeySeats > currentPolicy.totalSeats) {
        await tx.softwarePolicy.update({
          where: { id: targetPolicyId },
          data: { totalSeats: sumKeySeats },
        });
      }

      return tx.softwareLicenseKey.findUnique({
        where: { id: newKey.id },
        include: {
          policy: true,
          assignments: {
            include: {
              asset: {
                select: { id: true, name: true, ipAddress: true, domainUser: true },
              },
            },
          },
        },
      });
    });

    return res.status(201).json({
      status: "success",
      message: "Đã thêm Key bản quyền thành công!",
      data: createdKey,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// PATCH /api/itam/software/keys/:id
export const updateLicenseKey = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      policyId,
      licenseKey,
      keyType,
      maxSeats,
      expiredAt,
      supplier,
      invoiceCode,
      status,
      note,
      assetIds,
    } = req.body;

    const updatedKey = await prisma.$transaction(async (tx) => {
      const key = await tx.softwareLicenseKey.update({
        where: { id },
        data: {
          ...(policyId !== undefined ? { policyId } : {}),
          ...(licenseKey !== undefined ? { licenseKey: licenseKey.trim() } : {}),
          ...(keyType !== undefined ? { keyType } : {}),
          ...(maxSeats !== undefined ? { maxSeats: Math.max(1, Number(maxSeats) || 1) } : {}),
          ...(expiredAt !== undefined
            ? { expiredAt: expiredAt ? new Date(expiredAt) : null }
            : {}),
          ...(supplier !== undefined ? { supplier } : {}),
          ...(invoiceCode !== undefined ? { invoiceCode } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(note !== undefined ? { note } : {}),
        },
      });

      if (Array.isArray(assetIds)) {
        if (assetIds.length > key.maxSeats) {
          throw new Error(
            `Số lượng máy cấp phát (${assetIds.length}) vượt quá giới hạn của Key (${key.maxSeats} máy)!`
          );
        }
        await tx.softwareKeyAssignment.deleteMany({ where: { keyId: id } });
        if (assetIds.length > 0) {
          await tx.softwareKeyAssignment.createMany({
            data: assetIds.map((assetId: string) => ({
              keyId: id,
              assetId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.softwareLicenseKey.findUnique({
        where: { id },
        include: {
          policy: true,
          assignments: {
            include: {
              asset: {
                select: { id: true, name: true, ipAddress: true, domainUser: true },
              },
            },
          },
        },
      });
    });

    return res.status(200).json({
      status: "success",
      message: "Đã cập nhật Key bản quyền!",
      data: updatedKey,
    });
  } catch (error: any) {
    return res.status(400).json({ status: "error", message: error.message });
  }
};

// DELETE /api/itam/software/keys/:id
export const deleteLicenseKey = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.softwareLicenseKey.delete({ where: { id } });
    return res.status(200).json({
      status: "success",
      message: "Đã xóa Key bản quyền!",
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// POST /api/itam/software/keys/:id/assign
export const assignLicenseKeyToAssets = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assetIds, note } = req.body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ message: "Vui lòng chọn ít nhất 1 thiết bị để gán Key!" });
    }

    const key = await prisma.softwareLicenseKey.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!key) {
      return res.status(404).json({ message: "Không tìm thấy Key bản quyền!" });
    }

    const existingIds = new Set(key.assignments.map((a) => a.assetId));
    const newIds = assetIds.filter((aid: string) => !existingIds.has(aid));

    if (existingIds.size + newIds.length > key.maxSeats) {
      return res.status(400).json({
        message: `Key này chỉ cho phép tối đa ${key.maxSeats} máy (Hiện đã gán ${existingIds.size} máy, không thể gán thêm ${newIds.length} máy).`,
      });
    }

    if (newIds.length > 0) {
      await prisma.softwareKeyAssignment.createMany({
        data: newIds.map((assetId: string) => ({
          keyId: id,
          assetId,
          note: note || null,
        })),
        skipDuplicates: true,
      });
    }

    return res.status(200).json({
      status: "success",
      message: `Đã gán Key bản quyền cho ${newIds.length} máy tính!`,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// DELETE /api/itam/software/keys/:id/assign/:assetId
export const unassignLicenseKeyFromAsset = async (req: Request, res: Response) => {
  try {
    const { id, assetId } = req.params;
    await prisma.softwareKeyAssignment.deleteMany({
      where: { keyId: id, assetId },
    });
    return res.status(200).json({
      status: "success",
      message: "Đã thu hồi Key khỏi thiết bị!",
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};
