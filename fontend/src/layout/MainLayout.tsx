import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useHasPermission } from '../hooks/useHasPermission'; // 1. Import Hook phân quyền
import axiosClient from '../api/axiosClient';
import useMediaQuery from '../hooks/useMediaQuery';

const { Header, Sider, Content } = Layout;

// --- MENU COMPONENT ---
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
          <div className={`text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent transition-all duration-300 ${collapsed && !isMobile ? 'scale-0' : 'scale-100'}`}>
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
  const { hasPermission } = useHasPermission(); // 2. Sử dụng Hook phân quyền
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = antTheme.useToken();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [dynamicMenus, setDynamicMenus] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch Menu động từ Database (Dành cho trang tin tức)
  useEffect(() => {
    const fetchMenus = async () => {
        try {
            const res = await axiosClient.get('/menus');
            setDynamicMenus(res.data.data || []);
        } catch (e) { console.error("Lỗi tải menu", e); }
    };
    fetchMenus();
  }, []);

  // Fetch Thông báo
  const fetchNoti = useCallback(async () => {
      try {
          const res = await axiosClient.get('/notifications');
          setNotifications(res.data.data.notifications);
          setUnreadCount(res.data.data.unreadCount);
      } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
      fetchNoti();
      const interval = setInterval(fetchNoti, 30000);
      return () => clearInterval(interval);
  }, [fetchNoti]);

  const handleReadNoti = async (open: boolean) => {
      if (open && unreadCount > 0) {
          try {
            await axiosClient.patch('/notifications/read-all');
            setUnreadCount(0);
            fetchNoti();
          } catch(e) { /* empty */ }
      }
  };

  // --- 3. LOGIC PHÂN QUYỀN MENU (DÙNG HAS_PERMISSION) ---
  const menuItems = useMemo<MenuProps['items']>(() => {
    const items: MenuProps['items'] = [];

    // Dashboard: Chỉ hiện cho người có quyền xem Dashboard (Admin/Manager)
    if (user?.roleId !== 'ROLE-USER') {
      items.push({ key: '/', icon: <DashboardOutlined />, label: 'Dashboard' });
    }

    // Tin tức & Thông báo: Ai cũng xem được
    items.push({ 
        key: '/posts', icon: <ReadOutlined />, label: 'Tin tức & Thông báo',
        children: [
            { key: '/posts', label: 'Tất cả tin tức' }, 
            ...dynamicMenus.map(m => ({ key: `/posts?menuId=${m.id}`, label: m.title, icon: <FileTextOutlined /> }))
        ]
    });

    // Quản lý Nhân sự: Yêu cầu quyền USER_VIEW
    if (hasPermission('USER_VIEW')) {
      items.push({ key: '/admin/users', icon: <TeamOutlined />, label: 'Nhân sự' });
    }

    // Nhóm Hệ thống: Chỉ hiện nếu có ít nhất 1 quyền trong các quyền hệ thống
    const canSeeSystem = hasPermission('DEPT_VIEW') || hasPermission('ROLE_VIEW') || hasPermission('MENU_VIEW');
    
    if (canSeeSystem) {
      items.push({ type: 'divider' });
      items.push({ 
          key: 'grp-system', label: 'HỆ THỐNG', type: 'group',
          children: [
              ...(hasPermission('DEPT_VIEW') ? [{ key: '/admin/departments', icon: <ApartmentOutlined />, label: 'Phòng ban' }] : []),
              ...(hasPermission('ROLE_VIEW') ? [{ key: '/admin/roles', icon: <SafetyCertificateOutlined />, label: 'Phân quyền' }] : []),
              ...(hasPermission('MENU_VIEW') ? [{ key: '/admin/menus', icon: <UnorderedListOutlined />, label: 'Quản lý Menu' }] : []),
          ]
      });
    }

    return items;
  }, [user, dynamicMenus, hasPermission]);

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