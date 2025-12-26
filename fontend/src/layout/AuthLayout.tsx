import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Typography } from 'antd';
import { ReconciliationOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const FACTORY_IMAGE_URL = 'https://towa.com.vn/uploads/images/2021/06/610x336-1623463048-single_html1-towavietnam.jpg';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const { isDarkMode } = useTheme();

  // --- PHẦN CHỈNH SỬA MÀU SẮC CHO ĐỠ CHÓI ---
  
  // 1. Nền cột phải: Đổi từ gray-50 (quá sáng) sang slate-100 (xám dịu hơn)
  // Nếu vẫn thấy sáng, bạn có thể đổi 'bg-slate-100' thành 'bg-slate-200'
  const rightColumnBg = isDarkMode ? 'bg-[#0f172a]' : 'bg-slate-100'; 

  // 2. Nền của Form: Giữ trắng nhưng Shadow đậm hơn để tách biệt với nền
  const formCardBg = isDarkMode ? 'bg-slate-800/50' : 'bg-white';
  
  // 3. Đổ bóng: Tăng độ đậm của bóng để Form nổi lên, không bị hòa vào nền
  const formCardShadow = isDarkMode ? '' : 'shadow-xl shadow-slate-300/60 border border-slate-200';
  
  const titleColor = isDarkMode ? '#f8fafc' : '#334155'; // Màu chữ tiêu đề đậm hơn chút (Slate-700) cho dễ đọc
  const textColor = isDarkMode ? 'text-gray-400' : 'text-slate-500';

  return (
    <div className={`min-h-screen flex w-full transition-colors duration-300 ${rightColumnBg}`}>
      
      {/* --- CỘT TRÁI (Giữ nguyên như cũ) --- */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-slate-950 justify-center items-center">
        <img 
            src={FACTORY_IMAGE_URL} 
            alt="Towa Factory" 
            className="absolute inset-0 w-full h-full object-cover scale-105 opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-blue-950/85" />
        <div className="absolute inset-0 opacity-[0.15] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none mix-blend-overlay"></div>

        <div className="relative z-10 p-16 text-white max-w-2xl flex flex-col h-full justify-center">
          <div className="mb-8">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded flex items-center justify-center border border-white/20">
               <span className="text-2xl font-bold text-white">T</span>
            </div>
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold mb-6 leading-tight tracking-tight">
            Tiên phong trong lĩnh vực <br/> 
            <span className="text-blue-200">sản xuất chính xác</span>
          </h1>
          <p className="text-lg text-slate-200/90 leading-relaxed mb-12 max-w-lg">
            Cam kết mang đến những sản phẩm công nghiệp với tiêu chuẩn chất lượng cao nhất, được vận hành trên dây chuyền hiện đại.
          </p>
          <div className="mt-auto bg-slate-800/40 backdrop-blur-md p-6 rounded-xl border border-white/10 cursor-default">
            <div className="flex gap-4 items-start">
                <ReconciliationOutlined className="text-3xl text-blue-300 opacity-80" />
                <div>
                    <p className="italic text-gray-100 text-base font-light">
                        "Chất lượng không chỉ là mục tiêu, đó là sự đảm bảo trong từng chi tiết."
                    </p>
                    <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white">Towa Vietnam</span>
                            <span className="text-xs text-blue-200">Manufacturing Division</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- CỘT PHẢI (Đã chỉnh sửa Container) --- */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        
        {/* Container cho form */}
        <div className={`w-full max-w-[420px] p-8 rounded-2xl transition-all duration-300 ${formCardBg} ${formCardShadow}`}>
           <div className="mb-8 text-center">
             <Title level={2} style={{ 
                 margin: 0, 
                 marginBottom: 8, 
                 color: titleColor,
                 fontWeight: 700 
             }}>
                {title}
             </Title>
             <Text className={`text-base ${textColor}`}>
                {subtitle}
             </Text>
           </div>
           
           <div className="auth-form-wrapper">
               {children}
           </div>

           <div className={`mt-8 text-center text-xs ${textColor} opacity-70`}>
             © 2025 Towa Vietnam. Internal Portal.
             <br />Copyright Lê Minh Nhân 2025
           </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;