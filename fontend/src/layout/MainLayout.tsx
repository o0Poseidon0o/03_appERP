import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, Badge, List, Popover, theme as antTheme, Switch } from 'antd';
import { 
  MenuFoldOutlined, MenuUnfoldOutlined, 
  UserOutlined, DashboardOutlined, 
  ReadOutlined, BellOutlined,
  LogoutOutlined, FileTextOutlined,
  TeamOutlined, ApartmentOutlined, SafetyCertificateOutlined,
  MoonOutlined, SunOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext'; // Import Theme Context
import axiosClient from '../api/axiosClient';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme(); // Lấy theme
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = antTheme.useToken();
  
  // State dữ liệu
  const [dynamicMenus, setDynamicMenus] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // 1. Fetch Menu từ Database
  useEffect(() => {
    const fetchMenus = async () => {
        try {
            const res = await axiosClient.get('/menus');
            setDynamicMenus(res.data.data || []);
        } catch (e) { console.error("Lỗi tải menu", e); }
    };
    fetchMenus();
  }, []);

  // 2. Fetch Thông báo (Polling 30s)
  const fetchNoti = async () => {
      try {
          const res = await axiosClient.get('/notifications');
          setNotifications(res.data.data.notifications);
          setUnreadCount(res.data.data.unreadCount);
      } catch (e) { }
  };

  useEffect(() => {
      fetchNoti();
      const interval = setInterval(fetchNoti, 30000); 
      return () => clearInterval(interval);
  }, []);

  const handleReadNoti = async (open: boolean) => {
      if (open && unreadCount > 0) {
          await axiosClient.patch('/notifications/read-all');
          setUnreadCount(0);
          fetchNoti();
      }
  };

  // 3. Cấu hình Menu Sidebar (Quan trọng)
  const userRoleId = user?.role?.id || 'ROLE-USER';
  
  const menuItems = [
    // --- DASHBOARD (Admin/Manager) ---
    ...(['ROLE-ADMIN', 'ROLE-MANAGER'].includes(userRoleId) ? [
        { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    ] : []),

    // --- TIN TỨC (Ai cũng thấy) ---
    { 
        key: '/posts', 
        icon: <ReadOutlined />, 
        label: 'Tin tức & Thông báo',
        children: [
            { key: '/posts', label: 'Tất cả tin tức' }, 
            // Menu động từ DB load vào đây
            ...dynamicMenus.map(m => ({
                key: `/posts?menuId=${m.id}`, 
                label: m.title,
                icon: <FileTextOutlined />
            }))
        ]
    },

    // --- NHÂN SỰ (Admin/Manager/User đều thấy - Quyền nút bấm xử lý bên trong trang) ---
    { key: '/admin/users', icon: <TeamOutlined />, label: 'Nhân sự' },

    // --- HỆ THỐNG (Chỉ Admin) ---
    ...(userRoleId === 'ROLE-ADMIN' ? [
       { type: 'divider' },
       { 
           key: 'grp-system', 
           label: 'HỆ THỐNG', 
           type: 'group',
           children: [
               { key: '/admin/departments', icon: <ApartmentOutlined />, label: 'Phòng ban' },
               { key: '/admin/roles', icon: <SafetyCertificateOutlined />, label: 'Phân quyền' },
               { key: '/admin/menus', icon: <UnorderedListOutlined />, label: 'Quản lý Menu' },
           ]
       }
    ] : [])
  ];

  // Nội dung Popover Thông báo
  const notiContent = (
      <div className="w-80 max-h-96 overflow-y-auto">
          <List dataSource={notifications} renderItem={item => (
              <List.Item className={`p-2 hover:bg-gray-50 cursor-pointer ${!item.isRead ? 'bg-blue-50' : ''}`} onClick={() => navigate('/posts')}>
                  <List.Item.Meta 
                      title={<span className="text-sm font-semibold">{item.title}</span>}
                      description={
                        <div>
                            <div className="text-xs text-gray-600">{item.message}</div>
                            <div className="text-[10px] text-gray-400 mt-1">{new Date(item.createdAt).toLocaleString()}</div>
                        </div>
                      }
                  />
              </List.Item>
          )} />
          {notifications.length === 0 && <div className="p-4 text-center text-gray-400">Không có thông báo mới</div>}
      </div>
  );

  // Menu Dropdown User
  const userDropdown = {
    items: [
        { 
          key: 'info', 
          label: (
            <div className="flex flex-col min-w-[120px]">
               <span className="font-semibold">{user?.fullName}</span>
               <span className="text-xs text-gray-400">{user?.role?.name}</span>
            </div>
          ), disabled: true 
        },
        { type: 'divider' },
        { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ cá nhân', onClick: () => navigate('/profile') },
        { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: logout },
    ]
  };

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider 
        trigger={null} collapsible collapsed={collapsed} width={250}
        style={{ background: isDarkMode ? '#111827' : '#001529' }}
        className="shadow-xl z-20"
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-700/50">
           <div className={`text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent transition-all duration-300 ${collapsed ? 'scale-0' : 'scale-100'}`}>
            TOWA ERP
           </div>
           {collapsed && <div className="text-white font-bold text-xl">T</div>}
        </div>
        <Menu 
            theme="dark" 
            mode="inline" 
            selectedKeys={[location.pathname]} 
            items={menuItems} 
            onClick={(e) => navigate(e.key)}
            className="bg-transparent mt-2" 
        />
      </Sider>
      
      <Layout>
        <Header 
            style={{ 
                background: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                borderBottom: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                padding: '0 24px'
            }} 
            className="flex justify-between items-center sticky top-0 z-10"
        >
           <div className="flex items-center">
               <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ color: token.colorText }} />
               <h2 className="ml-4 text-lg font-semibold text-gray-500 hidden md:block">Hệ thống quản trị</h2>
           </div>
           
           <div className="flex items-center gap-6">
               <Switch checkedChildren={<MoonOutlined />} unCheckedChildren={<SunOutlined />} checked={isDarkMode} onChange={toggleTheme} className="bg-gray-400" />

               {/* Nút Thông báo */}
               <Popover content={notiContent} title="Thông báo" trigger="click" onOpenChange={handleReadNoti} placement="bottomRight">
                   <Badge count={unreadCount} size="small" className="cursor-pointer flex items-center">
                       <BellOutlined style={{ fontSize: 20, color: token.colorText }} />
                   </Badge>
               </Popover>

               {/* User Info */}
               <Dropdown menu={userDropdown} trigger={['click']}>
                   <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-200/20 p-2 rounded-lg transition-all">
                       <Avatar style={{ backgroundColor: token.colorPrimary }} icon={<UserOutlined />} src={`https://ui-avatars.com/api/?name=${user?.fullName}&background=random`} />
                       <span className="font-medium hidden md:block" style={{ color: token.colorText }}>{user?.fullName}</span>
                   </div>
               </Dropdown>
           </div>
        </Header>
        
        <Content 
            style={{ 
                margin: '24px', padding: 24, 
                background: token.colorBgContainer, 
                borderRadius: token.borderRadiusLG,
                overflowY: 'auto'
            }}
        >
           <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;