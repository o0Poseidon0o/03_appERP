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
        console.warn("Cleanup warning:", error);
      }
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      // Chỉ chạy trên HTTPS hoặc Localhost
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        message.error("Camera yêu cầu HTTPS!");
        return;
      }

      if (isOpen) {
        setIsInitializing(true);
        // Chờ DOM render div id="reader"
        await new Promise(r => setTimeout(r, 300));

        try {
          await cleanupScanner(); // Reset trước khi chạy mới
          
          if (!isMounted) return;

          const scanner = new Html5Qrcode("reader", {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false
          });
          
          scannerRef.current = scanner;

          await scanner.start(
            { facingMode: "environment" }, // Ưu tiên cam sau
            { 
              fps: 10, 
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            (decodedText) => {
              if (isMounted) {
                // Tắt camera ngay khi tìm thấy mã
                cleanupScanner().then(() => {
                    onScanSuccess(decodedText);
                    onClose(); // Đóng modal
                });
              }
            },
            () => {} // Bỏ qua lỗi quét từng frame
          );
        } catch (err: any) {
          console.error("Camera Error:", err);
          if (isMounted) {
             message.error("Không thể mở Camera. Vui lòng cấp quyền!");
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
      title="QUÉT MÃ TÌM KIẾM"
      open={isOpen}
      onCancel={() => { cleanupScanner(); onClose(); }}
      footer={null}
      destroyOnClose
      width={400}
      centered
      maskClosable={false}
      styles={{ body: { padding: 0 } }} // Antd v5
    >
      <div className="relative bg-black overflow-hidden h-[350px] flex items-center justify-center flex-col">
        {isInitializing && <Spin tip="Đang bật Camera..." className="absolute z-10 text-white" />}
        
        <div id="reader" className="w-full h-full" />
        
        {/* Nút hủy nằm đè lên camera */}
        <div className="absolute bottom-5 w-full flex justify-center z-20">
             <Button 
                danger 
                type="primary"
                shape="round"
                size="large"
                onClick={() => { cleanupScanner(); onClose(); }}
            >
                ĐÓNG CAMERA
            </Button>
        </div>
      </div>
    </Modal>
  );
};

export default QRScannerModal;

// Mới chạy trên HTTPS không bị lỗi cấp quyền Camera
// import React, { useEffect, useRef, useState } from 'react';
// import { Modal, Button, App as AntdApp, Spin } from 'antd';
// import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// interface QRScannerModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onScanSuccess: (decodedText: string) => void;
// }

// const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
//   const { message } = AntdApp.useApp();
//   const scannerRef = useRef<Html5Qrcode | null>(null);
//   const [isInitializing, setIsInitializing] = useState(true);

//   // Hàm dọn dẹp scanner an toàn
//   const cleanupScanner = async () => {
//     if (scannerRef.current) {
//       try {
//         if (scannerRef.current.isScanning) {
//           await scannerRef.current.stop();
//         }
//         scannerRef.current.clear();
//       } catch (error) {
//         console.warn("Lỗi khi dọn dẹp scanner:", error);
//       }
//       scannerRef.current = null;
//     }
//   };

//   useEffect(() => {
//     let isMounted = true;

//     const startScanner = async () => {
//       // 1. Kiểm tra HTTPS (Bắt buộc để chạy Camera trên mobile)
//       if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
//         message.error("Camera chỉ hoạt động trên HTTPS hoặc Localhost!");
//         return;
//       }

//       if (isOpen) {
//         setIsInitializing(true);
//         // Đợi DOM render xong thẻ id="reader"
//         await new Promise(r => setTimeout(r, 300)); 

//         try {
//           await cleanupScanner(); // Dọn dẹp instance cũ nếu có

//           if (!isMounted) return;

//           // [SỬA LỖI TẠI ĐÂY]: formatsToSupport phải nằm trong constructor
//           const scanner = new Html5Qrcode("reader", {
//             formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
//             verbose: false
//           });
          
//           scannerRef.current = scanner;

//           // Cấu hình cho hàm start (không chứa formatsToSupport)
//           const config = { 
//             fps: 10, 
//             qrbox: { width: 250, height: 250 }
//           };

//           await scanner.start(
//             { facingMode: "environment" }, // Camera sau
//             config,
//             (decodedText) => {
//               if (isMounted) {
//                 // Tạm dừng quét ngay khi tìm thấy để tránh duplicate
//                 cleanupScanner().then(() => {
//                     onScanSuccess(decodedText);
//                     // Không gọi onClose() ở đây để cha quản lý, hoặc gọi nếu muốn đóng ngay
//                 });
//               }
//             },
//             () => {} // Bỏ qua lỗi quét từng frame
//           );
//         } catch (err: any) {
//           console.error("Lỗi khởi động:", err);
//           if (isMounted) {
//              let errorMsg = "Không thể mở Camera.";
//              if (err?.name === 'NotAllowedError') errorMsg = "Bạn đã chặn quyền Camera.";
//              if (err?.name === 'NotFoundError') errorMsg = "Không tìm thấy Camera.";
             
//              message.error(errorMsg);
//              onClose(); 
//           }
//         } finally {
//           if (isMounted) setIsInitializing(false);
//         }
//       } else {
//         cleanupScanner();
//       }
//     };

//     startScanner();

//     return () => {
//       isMounted = false;
//       cleanupScanner();
//     };
//   }, [isOpen]);

//   return (
//     <Modal
//       title="QUÉT MÃ QR"
//       open={isOpen}
//       onCancel={() => { cleanupScanner(); onClose(); }}
//       footer={null}
//       destroyOnClose
//       width={400}
//       centered
//       maskClosable={false}
//     >
//       <div className="relative bg-black rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center">
//         {isInitializing && <Spin tip="Đang khởi động Camera..." size="large" className="absolute z-10" />}
        
//         <div id="reader" className="w-full h-full" />
        
//         <Button 
//             type="primary" danger 
//             className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-40 z-20"
//             onClick={() => { cleanupScanner(); onClose(); }}
//         >
//             HỦY QUÉT
//         </Button>
//       </div>
//       <p className="mt-3 text-center text-gray-500 text-xs">
//         Di chuyển camera đến mã QR cần quét
//       </p>
//     </Modal>
//   );
// };

// export default QRScannerModal;