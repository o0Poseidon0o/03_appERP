import React, { useState, useEffect, useCallback } from 'react'; // 1. Thêm useCallback
import { Layout, Menu, Button, Dropdown, Avatar, Badge, List, Popover, theme as antTheme, Switch, Drawer, type MenuProps } from 'antd';
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
import { useTheme } from '../contexts/ThemeContext';
import axiosClient from '../api/axiosClient';
import useMediaQuery from '../hooks/useMediaQuery';

const { Header, Sider, Content } = Layout;

// --- MENU COMPONENT (Giữ nguyên phần tách code này) ---
interface SideMenuProps {
    collapsed: boolean;
    isMobile: boolean;
    locationPath: string;
    menuItems: MenuProps['items'];
    onMenuClick: MenuProps['onClick'];
}

const SideMenu: React.FC<SideMenuProps> = ({ collapsed, isMobile, locationPath, menuItems, onMenuClick }) => (
    <>
      <div className="h-16 flex items-center justify-center border-b border-gray-700/50 bg-[#001529]">
          <div className={`text-xl font-bold bg-linear-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent transition-all duration-300 ${collapsed && !isMobile ? 'scale-0' : 'scale-100'}`}>
              TOWA ERP
          </div>
          {collapsed && !isMobile && <div className="text-white font-bold text-xl absolute">T</div>}
      </div>
      <Menu 
          theme="dark" 
          mode="inline" 
          selectedKeys={[locationPath]} 
          items={menuItems} 
          onClick={onMenuClick}
          className="bg-transparent mt-2 border-r-0" 
      />
    </>
);

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = antTheme.useToken();
  
  const isMobile = useMediaQuery('(max-width: 768px)');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dynamicMenus, setDynamicMenus] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // 1. Fetch Menu
  useEffect(() => {
    const fetchMenus = async () => {
        try {
            const res = await axiosClient.get('/menus');
            setDynamicMenus(res.data.data || []);
        } catch (e) { console.error("Lỗi tải menu", e); }
    };
    fetchMenus();
  }, []);

  // --- 2. FETCH THÔNG BÁO (SỬA Ở ĐÂY) ---
  // Sử dụng useCallback để hàm này không bị tạo lại mỗi lần render
  const fetchNoti = useCallback(async () => {
      try {
          const res = await axiosClient.get('/notifications');
          setNotifications(res.data.data.notifications);
          setUnreadCount(res.data.data.unreadCount);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) { 
          // console.error(e); 
      }
  }, []); // Dependency rỗng vì axiosClient là tĩnh

  useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchNoti(); // Gọi lần đầu
      const interval = setInterval(fetchNoti, 30000); // Gọi định kỳ
      return () => clearInterval(interval); // Dọn dẹp
  }, [fetchNoti]); // Thêm fetchNoti vào dependency

  const handleReadNoti = async (open: boolean) => {
      if (open && unreadCount > 0) {
          try {
            await axiosClient.patch('/notifications/read-all');
            setUnreadCount(0);
            fetchNoti(); // Gọi lại hàm đã được cache
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch(e) { /* empty */ }
      }
  };

  // 3. Cấu hình Menu Sidebar
  const userRoleId = user?.role?.id || 'ROLE-USER';
  
  const menuItems: MenuProps['items'] = [
    ...(['ROLE-ADMIN', 'ROLE-MANAGER'].includes(userRoleId) ? [
        { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    ] : []),
    { 
        key: '/posts', icon: <ReadOutlined />, label: 'Tin tức & Thông báo',
        children: [
            { key: '/posts', label: 'Tất cả tin tức' }, 
            ...dynamicMenus.map(m => ({ key: `/posts?menuId=${m.id}`, label: m.title, icon: <FileTextOutlined /> }))
        ]
    },
    { key: '/admin/users', icon: <TeamOutlined />, label: 'Nhân sự' },
    ...(userRoleId === 'ROLE-ADMIN' ? [
       { type: 'divider' as const },
       { 
           key: 'grp-system', label: 'HỆ THỐNG', type: 'group' as const,
           children: [
               { key: '/admin/departments', icon: <ApartmentOutlined />, label: 'Phòng ban' },
               { key: '/admin/roles', icon: <SafetyCertificateOutlined />, label: 'Phân quyền' },
               { key: '/admin/menus', icon: <UnorderedListOutlined />, label: 'Quản lý Menu' },
           ]
       }
    ] : [])
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
      navigate(e.key);
      if (isMobile) setMobileMenuOpen(false);
  };

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

  const userDropdown: MenuProps = {
    items: [
        { key: 'info', label: <span className="font-semibold">{user?.fullName}</span>, disabled: true },
        { type: 'divider' },
        { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ', onClick: () => navigate('/profile') },
        { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: logout },
    ]
  };

  return (
    <Layout className="h-screen overflow-hidden">
      {!isMobile && (
          <Sider 
            trigger={null} collapsible collapsed={collapsed} width={250}
            style={{ background: isDarkMode ? '#111827' : '#001529' }}
            className="shadow-xl z-20"
          >
            <SideMenu collapsed={collapsed} isMobile={false} locationPath={location.pathname} menuItems={menuItems} onMenuClick={handleMenuClick} />
          </Sider>
      )}

      <Drawer
        placement="left" onClose={() => setMobileMenuOpen(false)} open={mobileMenuOpen}
        styles={{ body: { padding: 0, background: '#001529' } }} width={260} closable={false}
      >
         <SideMenu collapsed={false} isMobile={true} locationPath={location.pathname} menuItems={menuItems} onMenuClick={handleMenuClick} />
      </Drawer>
      
      <Layout>
        <Header 
            style={{ 
                background: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                borderBottom: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                padding: '0 16px' 
            }} 
            className="flex justify-between items-center sticky top-0 z-10"
        >
            <div className="flex items-center">
                <Button 
                    type="text" 
                    icon={collapsed || isMobile ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} 
                    onClick={() => isMobile ? setMobileMenuOpen(true) : setCollapsed(!collapsed)} 
                    style={{ color: token.colorText, fontSize: '18px' }} 
                />
                {!isMobile && <h2 className="ml-4 text-lg font-semibold text-gray-500">Hệ thống quản trị</h2>}
            </div>
            
            <div className="flex items-center gap-4 md:gap-6">
                <Switch checkedChildren={<MoonOutlined />} unCheckedChildren={<SunOutlined />} checked={isDarkMode} onChange={toggleTheme} className="bg-gray-400" />
                <Popover content={notiContent} title="Thông báo" trigger="click" onOpenChange={handleReadNoti} placement="bottomRight">
                    <Badge count={unreadCount} size="small" className="cursor-pointer flex items-center">
                        <BellOutlined style={{ fontSize: 20, color: token.colorText }} />
                    </Badge>
                </Popover>
                <Dropdown menu={userDropdown} trigger={['click']}>
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-200/20 p-1.5 rounded-lg transition-all">
                        <Avatar style={{ backgroundColor: token.colorPrimary }} icon={<UserOutlined />} src={`https://ui-avatars.com/api/?name=${user?.fullName}&background=random`} />
                        <span className="font-medium hidden md:block" style={{ color: token.colorText }}>{user?.fullName}</span>
                    </div>
                </Dropdown>
            </div>
        </Header>
        
        <Content 
            style={{ 
                margin: isMobile ? '12px' : '24px', 
                padding: isMobile ? 12 : 24, 
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