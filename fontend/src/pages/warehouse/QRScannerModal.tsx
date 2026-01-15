import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, App as AntdApp, Spin, Input, Typography, Tabs } from 'antd';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { CameraOutlined, UsbOutlined, QrcodeOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const { message } = AntdApp.useApp();
  
  // Kiểm tra xem trình duyệt có hỗ trợ Camera không (HTTPS hoặc Localhost)
  const isSecureContext = window.isSecureContext; 

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<any>(null);
  
  const [activeTab, setActiveTab] = useState<'CAMERA' | 'USB'>(isSecureContext ? 'CAMERA' : 'USB');
  const [isInitializing, setIsInitializing] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // --- LOGIC 1: CAMERA SCANNER (Html5Qrcode) ---
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

    const startCamera = async () => {
      if (activeTab !== 'CAMERA' || !isOpen) return;

      // Nếu đang ở HTTP (không phải localhost), force sang tab USB
      if (!isSecureContext) {
         setActiveTab('USB');
         return;
      }

      setIsInitializing(true);
      await new Promise(r => setTimeout(r, 300)); // Chờ DOM

      try {
        await cleanupScanner();
        if (!isMounted) return;

        const scanner = new Html5Qrcode("reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });
        
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => {
            if (isMounted) {
              handleSuccess(decodedText);
            }
          },
          () => {} 
        );
      } catch (err: any) {
        console.error("Camera Error:", err);
        message.error("Không thể mở Camera. Chuyển sang chế độ nhập mã.");
        setActiveTab('USB'); // Tự động chuyển sang USB nếu lỗi cam
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    };

    if (isOpen) {
        startCamera();
    } else {
        cleanupScanner();
        setManualCode('');
    }

    return () => {
      isMounted = false;
      cleanupScanner();
    };
  }, [isOpen, activeTab]);

  // --- LOGIC 2: USB SCANNER / MANUAL INPUT ---
  
  // Khi mở tab USB, tự động focus vào ô input để máy quét "bắn" vào luôn
  useEffect(() => {
      if (isOpen && activeTab === 'USB') {
          setTimeout(() => {
              inputRef.current?.focus();
          }, 100);
      }
  }, [isOpen, activeTab]);

  const handleSuccess = (code: string) => {
      cleanupScanner();
      onScanSuccess(code);
      onClose();
  };

  const handleManualSubmit = () => {
      if (manualCode.trim()) {
          handleSuccess(manualCode.trim());
      }
  };

  // Xử lý khi máy quét USB "bắn" xong và tự nhấn Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          handleManualSubmit();
      }
  };

  return (
    <Modal
      title={
          <div className="flex items-center gap-2">
              <QrcodeOutlined /> QUÉT MÃ TÌM KIẾM
          </div>
      }
      open={isOpen}
      onCancel={() => { cleanupScanner(); onClose(); }}
      footer={null}
      destroyOnClose
      width={450}
      centered
      maskClosable={false}
    >
      <Tabs 
        activeKey={activeTab} 
        onChange={(key) => setActiveTab(key as any)}
        centered
        items={[
            {
                key: 'CAMERA',
                label: <span><CameraOutlined /> Camera</span>,
                disabled: !isSecureContext, // Disable nếu là HTTP
                children: (
                    <div className="relative bg-black overflow-hidden h-[300px] flex items-center justify-center flex-col rounded-lg">
                        {isInitializing && <Spin tip="Đang bật Camera..." className="absolute z-10 text-white" />}
                        <div id="reader" className="w-full h-full" />
                    </div>
                )
            },
            {
                key: 'USB',
                label: <span><UsbOutlined /> Máy quét / Nhập tay</span>,
                children: (
                    <div className="h-[300px] flex flex-col justify-center items-center p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <UsbOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                        <Text strong style={{ fontSize: '16px', marginBottom: '8px' }}>
                            Sẵn sàng quét
                        </Text>
                        <Text type="secondary" style={{ textAlign: 'center', marginBottom: '24px' }}>
                            Sử dụng máy quét cầm tay hoặc nhập mã thủ công vào ô bên dưới.
                        </Text>
                        
                        <Input 
                            ref={inputRef}
                            size="large"
                            placeholder="Đặt con trỏ vào đây và quét..."
                            prefix={<QrcodeOutlined />}
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            style={{ textAlign: 'center' }}
                        />
                        
                        <Button type="primary" onClick={handleManualSubmit} style={{ marginTop: '16px' }} block size="large">
                            XÁC NHẬN
                        </Button>
                    </div>
                )
            }
        ]}
      />
      
      {!isSecureContext && (
          <div className="mt-2 text-center text-xs text-orange-500">
              * Camera bị vô hiệu hóa do kết nối không bảo mật (HTTP).
          </div>
      )}

      <div className="mt-4 flex justify-center">
            <Button onClick={() => { cleanupScanner(); onClose(); }}>Đóng</Button>
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