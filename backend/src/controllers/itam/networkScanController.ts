import { Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import os from "os";
// [QUAN TRỌNG] Import hàm lấy Socket IO (Hãy kiểm tra đường dẫn file socket của bạn)
import { getIO } from "../../socket"; 

export const scanNetwork = async (req: Request, res: Response) => {
  try {
    // 1. Nhận dữ liệu
    const { subnets } = req.body;

    if (!subnets || !Array.isArray(subnets) || subnets.length === 0) {
      return res.status(400).json({ 
        status: "error", 
        message: "Vui lòng nhập dải mạng (Subnet). Ví dụ: 192.168.1.0/24" 
      });
    }

    // 2. Setup đường dẫn Python
    const scriptPath = path.join(process.cwd(), "scripts", "network_classify.py");
    const pythonCommand = os.platform() === "win32" ? "python" : "python3";

    console.log(`[NetworkScan] Bắt đầu tiến trình ngầm: ${subnets.join(" ")}`);

    // --- [THAY ĐỔI LỚN 1] ---
    // TRẢ VỀ RESPONSE NGAY LẬP TỨC (Không đợi Python chạy xong)
    // Để tránh lỗi 504 Gateway Timeout của Nginx
    res.status(200).json({
        status: "success",
        message: "Hệ thống đang quét mạng ngầm. Kết quả sẽ được gửi qua Socket khi hoàn tất.",
        processing: true
    });

    // 3. Chạy Python trong nền (Background)
    const pythonProcess = spawn(pythonCommand, [scriptPath, ...subnets]);

    let dataString = "";
    let errorString = "";

    pythonProcess.stdout.on("data", (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.log(`[Python Log]: ${data}`);
      errorString += data.toString();
    });

    // 4. Khi Python chạy xong -> BẮN SOCKET
    pythonProcess.on("close", (code) => {
      const io = getIO(); // Lấy socket server

      if (code !== 0) {
        console.error(`[Scan Error]: ${errorString}`);
        // Bắn sự kiện lỗi về Frontend
        io.emit("scan_error", { message: "Lỗi khi quét mạng (Python Error)", detail: errorString });
        return;
      }

      try {
        const results = JSON.parse(dataString);
        console.log(`✅ Quét xong! Tìm thấy ${results.length} thiết bị.`);
        
        // --- [THAY ĐỔI LỚN 2] ---
        // Thay vì res.json (đã gửi rồi), ta dùng socket emit
        io.emit("scan_complete", results); 

      } catch (e) {
        console.error("JSON Parse Error:", dataString);
        io.emit("scan_error", { message: "Dữ liệu trả về không đúng định dạng", raw: dataString });
      }
    });

  } catch (error: any) {
    // Nếu lỗi xảy ra TRƯỚC khi gửi response thì mới dùng res
    if (!res.headersSent) {
        res.status(500).json({ status: "error", message: error.message });
    } else {
        console.error("Server Error:", error);
    }
  }
};

// API Audit Bảo Mật (Cũng chuyển sang chạy ngầm cho an toàn)
export const auditDeviceSecurity = async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ message: "Thiếu địa chỉ IP" });

    const scriptPath = path.join(process.cwd(), "scripts", "security_audit.py");
    const pythonCommand = os.platform() === "win32" ? "python" : "python3";

    console.log(`[SecurityAudit] Checking IP: ${ip}`);

    // Trả lời ngay lập tức
    res.status(200).json({ 
        status: "success", 
        message: "Đang kiểm tra bảo mật ngầm...",
        processing: true 
    });

    // Chạy ngầm
    const pythonProcess = spawn(pythonCommand, [scriptPath, ip]);
    let dataString = "";
    
    pythonProcess.stdout.on("data", (data) => { dataString += data.toString(); });
    
    pythonProcess.on("close", (code) => {
        const io = getIO();
        try {
            const result = JSON.parse(dataString);
            // Bắn sự kiện riêng cho Audit
            io.emit("audit_complete", result);
        } catch (e) {
            console.error("Audit Error Parse");
            io.emit("audit_error", { ip, message: "Lỗi phân tích kết quả" });
        }
    });

  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ message: error.message });
  }
};