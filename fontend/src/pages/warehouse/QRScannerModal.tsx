// import React, { useEffect, useRef } from 'react';
// import { Modal, Button, App as AntdApp } from 'antd';
// import { Html5Qrcode } from 'html5-qrcode';

// interface QRScannerModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onScanSuccess: (decodedText: string) => void;
// }

// const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
//   const { message } = AntdApp.useApp();
//   const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

//   useEffect(() => {
//     if (isOpen) {
//       const timer = setTimeout(async () => {
//         try {
//           // Khởi tạo instance
//           const scanner = new Html5Qrcode("reader");
//           html5QrCodeRef.current = scanner;

//           // Cấu hình quét
//           const config = { 
//             fps: 15, 
//             qrbox: { width: 300, height: 300 } 
//           };

//           // Bắt đầu quét với camera sau (environment) hoặc camera mặc định
//           await scanner.start(
//             { facingMode: "environment" }, 
//             config,
//             (decodedText) => {
//               onScanSuccess(decodedText);
//               handleClose();
//             },
//             () => { /* Quét liên tục */ }
//           );
//         } catch (err: any) {
//           console.error("Lỗi khởi động Camera:", err);
//           message.error("Không thể truy cập Camera. Hãy kiểm tra quyền trình duyệt!");
//         }
//       }, 500); // Tăng thời gian chờ để Modal ổn định

//       return () => clearTimeout(timer);
//     }
//   }, [isOpen]);

//   const handleClose = async () => {
//     try {
//       if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
//         await html5QrCodeRef.current.stop();
//       }
//     } catch (err) {
//       console.error("Lỗi khi dừng camera:", err);
//     } finally {
//       onClose();
//     }
//   };

//   return (
//     <Modal
//       title="QUÉT MÃ QR VẬT TƯ"
//       open={isOpen}
//       onCancel={handleClose}
//       footer={[
//         <Button key="close" type="primary" danger onClick={handleClose} block size="large">
//           ĐÓNG CAMERA
//         </Button>
//       ]}
//       destroyOnClose
//       width={500}
//       centered
//     >
//       <div className="relative overflow-hidden rounded-xl border-4 border-indigo-500 bg-black">
//         <div id="reader" className="w-full"></div>
//         {/* Lớp overlay trang trí để người dùng biết chỗ để mã */}
//         <div className="absolute inset-0 pointer-events-none border-[60px] border-black/30"></div>
//       </div>
//       <p className="mt-4 text-center text-slate-500">
//         Vui lòng cấp quyền Camera và đưa mã vào vùng sáng chính giữa.
//       </p>
//     </Modal>
//   );
// };

// export default QRScannerModal;

// Mới chạy trên HTTPS không bị lỗi cấp quyền Camera
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, App as AntdApp, Spin } from 'antd';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const { message } = AntdApp.useApp();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Hàm dọn dẹp scanner an toàn
  const cleanupScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (error) {
        console.warn("Lỗi khi dọn dẹp scanner:", error);
      }
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      // 1. Kiểm tra HTTPS (Bắt buộc để chạy Camera trên mobile)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        message.error("Camera chỉ hoạt động trên HTTPS hoặc Localhost!");
        return;
      }

      if (isOpen) {
        setIsInitializing(true);
        // Đợi DOM render xong thẻ id="reader"
        await new Promise(r => setTimeout(r, 300)); 

        try {
          await cleanupScanner(); // Dọn dẹp instance cũ nếu có

          if (!isMounted) return;

          // [SỬA LỖI TẠI ĐÂY]: formatsToSupport phải nằm trong constructor
          const scanner = new Html5Qrcode("reader", {
            formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
            verbose: false
          });
          
          scannerRef.current = scanner;

          // Cấu hình cho hàm start (không chứa formatsToSupport)
          const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 }
          };

          await scanner.start(
            { facingMode: "environment" }, // Camera sau
            config,
            (decodedText) => {
              if (isMounted) {
                // Tạm dừng quét ngay khi tìm thấy để tránh duplicate
                cleanupScanner().then(() => {
                    onScanSuccess(decodedText);
                    // Không gọi onClose() ở đây để cha quản lý, hoặc gọi nếu muốn đóng ngay
                });
              }
            },
            () => {} // Bỏ qua lỗi quét từng frame
          );
        } catch (err: any) {
          console.error("Lỗi khởi động:", err);
          if (isMounted) {
             let errorMsg = "Không thể mở Camera.";
             if (err?.name === 'NotAllowedError') errorMsg = "Bạn đã chặn quyền Camera.";
             if (err?.name === 'NotFoundError') errorMsg = "Không tìm thấy Camera.";
             
             message.error(errorMsg);
             onClose(); 
          }
        } finally {
          if (isMounted) setIsInitializing(false);
        }
      } else {
        cleanupScanner();
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      cleanupScanner();
    };
  }, [isOpen]);

  return (
    <Modal
      title="QUÉT MÃ QR"
      open={isOpen}
      onCancel={() => { cleanupScanner(); onClose(); }}
      footer={null}
      destroyOnClose
      width={400}
      centered
      maskClosable={false}
    >
      <div className="relative bg-black rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center">
        {isInitializing && <Spin tip="Đang khởi động Camera..." size="large" className="absolute z-10" />}
        
        <div id="reader" className="w-full h-full" />
        
        <Button 
            type="primary" danger 
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-40 z-20"
            onClick={() => { cleanupScanner(); onClose(); }}
        >
            HỦY QUÉT
        </Button>
      </div>
      <p className="mt-3 text-center text-gray-500 text-xs">
        Di chuyển camera đến mã QR cần quét
      </p>
    </Modal>
  );
};

export default QRScannerModal;