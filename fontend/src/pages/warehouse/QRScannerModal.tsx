import React, { useEffect, useRef } from 'react';
import { Modal, Button, App as AntdApp } from 'antd';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const { message } = AntdApp.useApp();
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(async () => {
        try {
          // Khởi tạo instance
          const scanner = new Html5Qrcode("reader");
          html5QrCodeRef.current = scanner;

          // Cấu hình quét
          const config = { 
            fps: 15, 
            qrbox: { width: 300, height: 300 } 
          };

          // Bắt đầu quét với camera sau (environment) hoặc camera mặc định
          await scanner.start(
            { facingMode: "environment" }, 
            config,
            (decodedText) => {
              onScanSuccess(decodedText);
              handleClose();
            },
            () => { /* Quét liên tục */ }
          );
        } catch (err: any) {
          console.error("Lỗi khởi động Camera:", err);
          message.error("Không thể truy cập Camera. Hãy kiểm tra quyền trình duyệt!");
        }
      }, 500); // Tăng thời gian chờ để Modal ổn định

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch (err) {
      console.error("Lỗi khi dừng camera:", err);
    } finally {
      onClose();
    }
  };

  return (
    <Modal
      title="QUÉT MÃ QR VẬT TƯ"
      open={isOpen}
      onCancel={handleClose}
      footer={[
        <Button key="close" type="primary" danger onClick={handleClose} block size="large">
          ĐÓNG CAMERA
        </Button>
      ]}
      destroyOnClose
      width={500}
      centered
    >
      <div className="relative overflow-hidden rounded-xl border-4 border-indigo-500 bg-black">
        <div id="reader" className="w-full"></div>
        {/* Lớp overlay trang trí để người dùng biết chỗ để mã */}
        <div className="absolute inset-0 pointer-events-none border-[60px] border-black/30"></div>
      </div>
      <p className="mt-4 text-center text-slate-500">
        Vui lòng cấp quyền Camera và đưa mã vào vùng sáng chính giữa.
      </p>
    </Modal>
  );
};

export default QRScannerModal;