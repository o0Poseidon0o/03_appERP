import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Typography } from 'antd';

const { Title, Text } = Typography;

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`min-h-screen flex w-full ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* CỘT TRÁI: Branding & Artwork */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-indigo-900 justify-center items-center">
        {/* Background Gradients động */}
        <div className="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-purple-600/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[800px] h-[800px] bg-blue-600/30 rounded-full blur-[120px] animate-pulse" />
        
        {/* Nội dung giới thiệu */}
        <div className="relative z-10 p-12 text-white max-w-lg">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/20">
            <span className="text-3xl font-bold">T</span>
          </div>
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Quản trị doanh nghiệp <br/> <span className="text-indigo-300">toàn diện & hiệu quả</span>
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed mb-8">
            Hệ thống ERP giúp tối ưu hóa quy trình, quản lý nhân sự và nâng cao hiệu suất làm việc cho doanh nghiệp của bạn.
          </p>
          
          {/* Card trích dẫn nhỏ cho đẹp */}
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
            <p className="italic text-gray-200">"Sự đơn giản là đỉnh cao của sự tinh tế."</p>
            <div className="mt-4 flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-indigo-400"></div>
               <span className="text-sm font-semibold">Towa Team</span>
            </div>
          </div>
        </div>

        {/* Lớp phủ họa tiết noise (nếu thích) */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      </div>

      {/* CỘT PHẢI: Form Content */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-20 relative">
        <div className="w-full max-w-md">
           <div className="mb-10">
             <Title level={2} style={{ margin: 0, marginBottom: 8, color: isDarkMode ? '#fff' : '#111827' }}>
                {title}
             </Title>
             <Text type="secondary" className="text-base">
                {subtitle}
             </Text>
           </div>
           
           {children}

           <div className="mt-8 text-center text-gray-400 text-sm">
             © 2025 Towa ERP System. All rights reserved.
           </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;