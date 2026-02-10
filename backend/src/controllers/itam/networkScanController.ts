import { Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import os from "os";

export const scanNetwork = async (req: Request, res: Response) => {
  try {
    // 1. Nhận dữ liệu từ Frontend gửi lên (VD: ["192.168.1.0/24"])
    const { subnets } = req.body;

    if (!subnets || !Array.isArray(subnets) || subnets.length === 0) {
      return res.status(400).json({ 
        status: "error", 
        message: "Vui lòng nhập dải mạng (Subnet). Ví dụ: 192.168.1.0/24" 
      });
    }

    // 2. Xác định đường dẫn file Python
    // process.cwd() trỏ về thư mục gốc backend (nơi chứa package.json)
    const scriptPath = path.join(process.cwd(), "scripts", "network_classify.py");

    // 3. Chọn lệnh chạy tùy theo hệ điều hành (Linux dùng python3, Windows dùng python)
    const pythonCommand = os.platform() === "win32" ? "python" : "python3";

    console.log(`[NetworkScan] Đang chạy lệnh: ${pythonCommand} ${scriptPath} ${subnets.join(" ")}`);

    // 4. Tạo tiến trình con (Child Process)
    const pythonProcess = spawn(pythonCommand, [scriptPath, ...subnets]);

    let dataString = "";
    let errorString = "";

    // Thu thập dữ liệu từ Python in ra (stdout)
    pythonProcess.stdout.on("data", (data) => {
      dataString += data.toString();
    });

    // Thu thập lỗi hoặc log từ Python (stderr)
    pythonProcess.stderr.on("data", (data) => {
      // Nmap hay in thông báo tiến độ vào stderr, nên ta chỉ log ra console server để debug
      console.log(`[Python Log]: ${data}`);
      errorString += data.toString();
    });

    // Khi Python chạy xong
    pythonProcess.on("close", (code) => {
      // Code 0 = Thành công, Khác 0 = Lỗi
      if (code !== 0) {
        console.error(`[Python Error Code ${code}]: ${errorString}`);
        return res.status(500).json({ 
          status: "error", 
          message: "Lỗi khi thực thi quét mạng. Vui lòng kiểm tra Server log.",
          debug: errorString 
        });
      }

      try {
        // Parse chuỗi JSON nhận được
        const results = JSON.parse(dataString);

        return res.status(200).json({
          status: "success",
          message: `Đã tìm thấy ${results.length} thiết bị.`,
          data: results
        });
      } catch (e) {
        console.error("JSON Parse Error:", dataString);
        return res.status(500).json({ 
          status: "error", 
          message: "Dữ liệu trả về từ Python không đúng định dạng JSON.",
          raw: dataString // Trả về raw để debug nếu cần
        });
      }
    });

  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
};