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
      // 1. Kiểm tra HTTPS
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        message.error("Camera chỉ hoạt động trên HTTPS!");
        return;
      }

      if (isOpen) {
        setIsInitializing(true);
        // Đợi DOM render xong
        await new Promise(r => setTimeout(r, 300)); 

        try {
          // Dọn dẹp instance cũ nếu còn sót
          await cleanupScanner();

          if (!isMounted) return;

          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;

          await scanner.start(
            { facingMode: "environment" }, // Ưu tiên camera sau
            {
              fps: 10, // Giảm FPS xuống 10 để nhẹ máy hơn
              qrbox: { width: 250, height: 250 },
              formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ] // Chỉ quét QR cho nhanh
            },
            (decodedText) => {
              if (isMounted) {
                // Tạm dừng quét ngay khi tìm thấy để tránh duplicate
                cleanupScanner().then(() => {
                    onScanSuccess(decodedText);
                    onClose();
                });
              }
            },
            () => {} // Bỏ qua lỗi quét từng frame để đỡ spam console
          );
        } catch (err: any) {
          console.error("Lỗi khởi động:", err);
          if (isMounted) {
             // Thông báo lỗi thân thiện hơn
             let errorMsg = "Không thể mở Camera.";
             if (err?.name === 'NotAllowedError') errorMsg = "Bạn đã chặn quyền Camera. Vui lòng bật lại trong cài đặt trình duyệt.";
             if (err?.name === 'NotFoundError') errorMsg = "Không tìm thấy Camera trên thiết bị.";
             
             message.error(errorMsg);
             onClose(); // Đóng modal nếu lỗi
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
      footer={null} // Ẩn footer mặc định cho gọn
      destroyOnClose
      width={400}
      centered
      maskClosable={false} // Không cho đóng khi click ra ngoài để tránh lỗi
    >
      <div className="relative bg-black rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center">
        {isInitializing && <Spin tip="Đang khởi động Camera..." size="large" className="absolute z-10" />}
        
        {/* Vùng chứa Video */}
        <div id="reader" className="w-full h-full" />
        
        {/* Nút đóng đè lên hình */}
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