import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Layout, Menu, Button, Dropdown, Avatar, Badge, List, Popover, 
  theme as antTheme, Switch, Drawer, type MenuProps, Tooltip 
} from 'antd';
import { 
  MenuFoldOutlined, MenuUnfoldOutlined, 
  UserOutlined, DashboardOutlined, 
  ReadOutlined, BellOutlined,
  LogoutOutlined, FileTextOutlined,
  TeamOutlined, ApartmentOutlined, SafetyCertificateOutlined,
  MoonOutlined, SunOutlined,
  UnorderedListOutlined,
  TagsOutlined,
  EnvironmentOutlined, SwapOutlined, 
  BoxPlotOutlined, DatabaseOutlined,
  BarChartOutlined,
  AppstoreOutlined, 
  CloseOutlined,
  NodeIndexOutlined,
  DesktopOutlined // [UPDATE] Icon cho Quản lý thiết bị
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useHasPermission } from '../hooks/useHasPermission';
import axiosClient from '../api/axiosClient';
import useMediaQuery from '../hooks/useMediaQuery';

const { Header, Sider, Content } = Layout;

// --- MENU COMPONENT ---
interface SideMenuProps {
    collapsed: boolean;
    isMobile: boolean;
    locationPath: string;
    openKeys: string[]; 
    onOpenChange: (keys: string[]) => void;
    menuItems: MenuProps['items'];
    onMenuClick: MenuProps['onClick'];
}

const SideMenu: React.FC<SideMenuProps> = ({ collapsed, isMobile, locationPath, openKeys, onOpenChange, menuItems, onMenuClick }) => (
    <>
      <div className="h-16 flex items-center justify-center border-b border-gray-700/50 bg-[#001529] shadow-md relative overflow-hidden">
          <div className={`text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent transition-all duration-300 ${collapsed && !isMobile ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
              TOWA ERP
          </div>
          {collapsed && !isMobile && <div className="text-white font-bold text-xl absolute transition-all duration-500">T</div>}
      </div>
      <Menu 
          theme="dark" 
          mode="inline" 
          selectedKeys={[locationPath]} 
          openKeys={openKeys} 
          onOpenChange={onOpenChange}
          items={menuItems} 
          onClick={onMenuClick}
          className="bg-transparent mt-2 border-r-0 font-medium" 
      />
    </>
);

// --- APP LAUNCHER OVERLAY COMPONENT ---
interface AppLauncherProps {
    isOpen: boolean;
    onClose: () => void;
    menuItems: any[]; // Đây sẽ là danh sách đầy đủ các App
    onNavigate: (path: string) => void;
    isDarkMode: boolean;
}

const AppLauncher: React.FC<AppLauncherProps> = ({ isOpen, onClose, menuItems, onNavigate, isDarkMode }) => {
    if (!isOpen) return null;

    // Filter bỏ các item là divider hoặc group title để lấy danh sách App thực sự
    const flatApps: any[] = [];
    
    menuItems.forEach(item => {
        if (!item) return;
        // Nếu là Item đơn (VD: Dashboard)
        if (!item.children && item.key && item.key !== 'divider') {
            flatApps.push(item);
        }
        // Nếu là Group (VD: Kho vận, Hệ thống) -> Lấy đại diện hoặc lấy hết con
        else if (item.children) {
             flatApps.push({
                 ...item,
                 link: item.children[0]?.key || item.key, // Link mặc định vào trang đầu của nhóm
                 isGroup: true
             });
        }
    });

    const appModules = flatApps.map(item => {
        return {
            key: item.key,
            label: item.label,
            icon: item.icon,
            link: item.link || item.key,
            // [UPDATE] Thêm màu sắc cho Module Assets
            colorClass: item.key.includes('warehouse') ? 'bg-orange-500' : 
                        item.key.includes('system') ? 'bg-gray-600' : 
                        item.key.includes('posts') ? 'bg-purple-500' : 
                        item.key.includes('user') ? 'bg-blue-500' : 
                        item.key.includes('assets') ? 'bg-teal-600' : // Màu cho Assets
                        'bg-indigo-600'
        };
    });

    return (
        <div className={`fixed inset-0 z-50 transition-all duration-300 flex flex-col ${isDarkMode ? 'bg-gray-900/95' : 'bg-slate-100/95'} backdrop-blur-md`}>
            {/* Header Overlay */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200/10">
                <span className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Ứng dụng</span>
                <Button 
                    type="text" 
                    icon={<CloseOutlined style={{ fontSize: 24 }} />} 
                    onClick={onClose} 
                    className={isDarkMode ? 'text-white hover:bg-white/10' : 'text-slate-800 hover:bg-slate-200'}
                />
            </div>

            {/* Grid Icon */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8 max-w-7xl mx-auto">
                    {appModules.map((app: any) => (
                        <div 
                            key={app.key}
                            onClick={() => { onNavigate(app.link); onClose(); }}
                            className={`
                                group cursor-pointer flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-200
                                ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-white hover:shadow-xl'}
                            `}
                        >
                            <div className={`
                                w-16 h-16 md:w-20 md:h-20 rounded-2xl shadow-lg flex items-center justify-center text-white mb-4 text-3xl md:text-4xl transition-transform duration-200 group-hover:scale-110
                                ${app.colorClass}
                            `}>
                                {app.icon}
                            </div>
                            <span className={`text-center font-semibold text-sm md:text-base ${isDarkMode ? 'text-gray-200' : 'text-slate-700'}`}>
                                {app.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- MAIN LAYOUT ---
const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appLauncherOpen, setAppLauncherOpen] = useState(false); 
  
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { hasPermission } = useHasPermission(); 
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = antTheme.useToken();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [dynamicMenus, setDynamicMenus] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // --- LOGIC 1: BẮT TÍN HIỆU TỪ TRANG LOGIN ĐỂ MỞ APP LAUNCHER ---
  useEffect(() => {
    if (location.state && location.state.openAppLauncher) {
        setAppLauncherOpen(true);
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  // --- LOGIC 2: GIỮ TRẠNG THÁI MENU KHI LOAD TRANG ---
  useEffect(() => {
    const pathname = location.pathname;
    const keys: string[] = []; 
    if (pathname.startsWith('/posts')) keys.push('grp-posts'); 
    if (pathname.startsWith('/warehouse')) keys.push('grp-warehouse'); 
    if (pathname.startsWith('/admin') && pathname !== '/admin/users') keys.push('grp-system'); 
    
    setOpenKeys(prev => {
        const uniqueKeys = new Set([...prev, ...keys]);
        return Array.from(uniqueKeys);
    });
  }, [location.pathname]);

  const onOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  // --- LOGIC 3: FETCH DATA ---
  useEffect(() => {
    const fetchMenus = async () => {
        try {
            const res = await axiosClient.get('/menus');
            setDynamicMenus(res.data.data || []);
        } catch (e) { console.error("Lỗi tải menu", e); }
    };
    fetchMenus();
  }, []);

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

  // --- LOGIC 4: CẤU HÌNH MENU ITEMS (SIDEBAR) ---
  const menuItems = useMemo<MenuProps['items']>(() => {
    const items: MenuProps['items'] = [];

    // Dashboard
    if (user?.roleId !== 'ROLE-USER') {
      items.push({ key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' });
    }

    // Tin tức
    items.push({ 
        key: 'grp-posts', icon: <ReadOutlined />, label: 'Bảng tin',
        children: [
            { key: '/posts', label: 'Tất cả tin tức' }, 
            ...dynamicMenus.map(m => ({ key: `/posts?menuId=${m.id}`, label: m.title, icon: <FileTextOutlined /> }))
        ]
    });
    
    // Nhân sự
    if (hasPermission('USER_VIEW')) {
      items.push({ key: '/admin/users', icon: <TeamOutlined />, label: 'Nhân sự' });
    }

    // Kho
    const canSeeWarehouse = hasPermission('WMS_VIEW') || hasPermission('WMS_APPROVE');
    if (canSeeWarehouse) {
      const warehouseChildren: MenuProps['items'] = [];
      if (hasPermission('WMS_VIEW')) {
          warehouseChildren.push(
            { key: '/warehouse/stock', icon: <DatabaseOutlined />, label: 'Tồn kho thực tế' },
            { key: '/warehouse/transactions', icon: <SwapOutlined />, label: 'Phiếu Nhập/Xuất' },
            { key: '/warehouse/locations', icon: <EnvironmentOutlined />, label: 'Sơ đồ kho' },
            { key: '/warehouse/items', icon: <BoxPlotOutlined />, label: 'Vật tư' },
            { key: '/warehouse/categories', icon: <TagsOutlined />, label: 'Nhóm vật tư' },
            { key: '/warehouse/suppliers', icon: <TeamOutlined />, label: 'Nhà cung cấp' },
            { key: '/warehouse/report/monthly', icon: <BarChartOutlined />, label: 'Báo cáo' }
          );
      }
      if (hasPermission('WMS_APPROVE')) {
          warehouseChildren.push({ key: '/warehouse/approvals', icon: <SafetyCertificateOutlined />, label: 'Phê duyệt' });
      }

      if (warehouseChildren.length > 0) {
        items.push({
            key: 'grp-warehouse', label: 'Kho vận', icon: <DatabaseOutlined />, 
            children: warehouseChildren
        });
      }
    }

    // [UPDATE] Module Quản lý thiết bị (ITAM)
    // Hiển thị nếu User là Admin hoặc có quyền xem tài sản
    const canSeeAssets = hasPermission('ASSET_VIEW') || user?.roleId === 'ROLE-ADMIN';
    if (canSeeAssets) {
        items.push({
            key: 'grp-itam', 
            icon: <DesktopOutlined />, 
            label: 'Quản lý thiết bị (IT)',
            children: [
                // [MỚI] Thêm Dashboard vào đầu danh sách
                { key: '/itam/dashboard', label: 'Dashboard (Tổng quan)' }, 
                
                { key: '/itam', label: 'Máy tính (PC/Laptop)' }, 
                { key: '/itam/peripherals', label: 'Thiết bị ngoại vi' }, 
            ]
        });
    }

    // Hệ thống
    const canSeeSystem = hasPermission('DEPT_VIEW') || hasPermission('ROLE_VIEW') || hasPermission('MENU_VIEW') || hasPermission('WORKFLOW_VIEW') || user?.roleId === 'ROLE-ADMIN';
    if (canSeeSystem) {
      items.push({ 
          key: 'grp-system', label: 'Hệ thống', icon: <ApartmentOutlined />,
          children: [
              ...(hasPermission('DEPT_VIEW') ? [{ key: '/admin/departments', label: 'Phòng ban' }] : []),
              ...(hasPermission('ROLE_VIEW') ? [{ key: '/admin/roles', icon: <SafetyCertificateOutlined />, label: 'Phân quyền' }] : []),
              ...(user?.roleId === 'ROLE-ADMIN' ? [{ key: '/admin/menus', icon: <UnorderedListOutlined />, label: 'Cấu hình Menu' }] : []),
              ...((user?.roleId === 'ROLE-ADMIN' || hasPermission('WORKFLOW_VIEW')) ? [{ key: '/admin/workflows', icon: <NodeIndexOutlined />, label: 'Cấu hình Quy trình' }] : []),
          ]
      });
    }

    return items;
  }, [user, dynamicMenus, hasPermission]);

  const handleMenuClick: MenuProps['onClick'] = (e) => {
      navigate(e.key);
      if (isMobile) setMobileMenuOpen(false);
  };

  // --- RENDER HELPERS ---
  const notiContent = (
      <div className="w-80 max-h-96 overflow-y-auto">
          <List dataSource={notifications} renderItem={item => (
              <List.Item className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${!item.isRead ? 'bg-blue-50/60' : ''}`} onClick={() => navigate('/posts')}>
                  <List.Item.Meta 
                      avatar={<Avatar style={{ backgroundColor: '#1890ff' }} icon={<BellOutlined />} size="small" />}
                      title={<span className="text-sm font-semibold text-slate-700">{item.title}</span>}
                      description={
                        <div>
                            <div className="text-xs text-slate-500 line-clamp-2">{item.message}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{new Date(item.createdAt).toLocaleString()}</div>
                        </div>
                      }
                  />
              </List.Item>
          )} />
          {notifications.length === 0 && <div className="p-8 text-center text-gray-400 flex flex-col items-center"><BellOutlined className="text-2xl mb-2 opacity-30"/>Không có thông báo mới</div>}
      </div>
  );

  const userDropdown: MenuProps = {
    items: [
        { key: 'info', label: <div className="px-2 py-1"><div className="font-bold text-base">{user?.fullName}</div><div className="text-xs text-gray-500">@{(user as any)?.username}</div></div>, disabled: true },
        { type: 'divider' },
        { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ cá nhân', onClick: () => navigate('/profile') },
        { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: logout },
    ]
  };

  return (
    <Layout className="h-screen overflow-hidden">
      <AppLauncher 
        isOpen={appLauncherOpen} 
        onClose={() => setAppLauncherOpen(false)} 
        menuItems={menuItems || []} 
        onNavigate={(path) => navigate(path)}
        isDarkMode={isDarkMode}
      />

      {!isMobile && (
          <Sider 
            trigger={null} collapsible collapsed={collapsed} width={240}
            style={{ background: isDarkMode ? '#111827' : '#001529' }}
            className="shadow-xl z-20 border-r border-gray-800"
          >
            <SideMenu 
                collapsed={collapsed} 
                isMobile={false} 
                locationPath={location.pathname} 
                openKeys={openKeys}
                onOpenChange={onOpenChange}
                menuItems={menuItems} 
                onMenuClick={handleMenuClick} 
            />
          </Sider>
      )}

      <Drawer
        placement="left" onClose={() => setMobileMenuOpen(false)} open={mobileMenuOpen}
        styles={{ body: { padding: 0, background: '#001529' } }} width={260} closable={false}
      >
         <SideMenu 
            collapsed={false} 
            isMobile={true} 
            locationPath={location.pathname} 
            openKeys={openKeys}
            onOpenChange={onOpenChange}
            menuItems={menuItems} 
            onMenuClick={handleMenuClick} 
        />
      </Drawer>
      
      <Layout>
        <Header 
            style={{ 
                background: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                borderBottom: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                padding: '0 20px',
                height: 64
            }} 
            className="flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm"
        >
            <div className="flex items-center gap-3">
                <Tooltip title="Ứng dụng">
                    <Button 
                        type="text"
                        icon={<AppstoreOutlined style={{ fontSize: 22 }} />}
                        onClick={() => setAppLauncherOpen(true)}
                        className={`
                            flex items-center justify-center w-10 h-10 rounded-full transition-all
                            ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-600'}
                        `}
                    />
                </Tooltip>

                <Button 
                    type="text" 
                    icon={collapsed || isMobile ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} 
                    onClick={() => isMobile ? setMobileMenuOpen(true) : setCollapsed(!collapsed)} 
                    style={{ fontSize: '18px' }}
                    className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}
                />

                {!isMobile && (
                    <div className="ml-2 flex flex-col justify-center h-full">
                        <span className={`text-sm font-semibold leading-tight ${isDarkMode ? 'text-gray-200' : 'text-slate-700'}`}>
                            HỆ THỐNG QUẢN TRỊ
                        </span>
                        <span className="text-[10px] text-gray-400">Towa Vietnam ERP v1.0</span>
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-3 md:gap-5">
                <Switch 
                    checkedChildren={<MoonOutlined />} 
                    unCheckedChildren={<SunOutlined />} 
                    checked={isDarkMode} 
                    onChange={toggleTheme} 
                    className="bg-gray-300" 
                />
                
                <Popover content={notiContent} title="Thông báo" trigger="click" onOpenChange={handleReadNoti} placement="bottomRight" overlayClassName="noti-popover">
                    <Badge count={unreadCount} size="small" className="cursor-pointer flex items-center">
                        <div className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                             <BellOutlined style={{ fontSize: 20 }} />
                        </div>
                    </Badge>
                </Popover>

                <Dropdown menu={userDropdown} trigger={['click']} placement="bottomRight">
                    <div className={`flex items-center gap-3 cursor-pointer p-1.5 pl-3 pr-2 rounded-full border transition-all ${isDarkMode ? 'border-gray-700 hover:bg-gray-800 bg-gray-800/50' : 'border-gray-200 hover:bg-white bg-white hover:shadow-sm'}`}>
                        <div className="hidden md:flex flex-col items-end mr-1">
                             <span className={`text-xs font-bold leading-none ${isDarkMode ? 'text-gray-200' : 'text-slate-700'}`}>{user?.fullName?.split(' ').pop()}</span>
                             <span className="text-[10px] text-gray-400 leading-none mt-0.5">Admin</span>
                        </div>
                        <Avatar 
                            style={{ backgroundColor: token.colorPrimary, verticalAlign: 'middle' }} 
                            icon={<UserOutlined />} 
                            src={`https://ui-avatars.com/api/?name=${user?.fullName}&background=random&color=fff`} 
                        />
                    </div>
                </Dropdown>
            </div>
        </Header>
        
        <Content 
            style={{ 
                margin: isMobile ? '12px' : '24px', 
                padding: 0,
                background: 'transparent',
                overflowY: 'auto',
                height: 'calc(100vh - 64px - 48px)'
            }}
        >
            <div className={`h-full w-full rounded-xl overflow-hidden shadow-sm ${isDarkMode ? 'bg-[#1f2937]' : 'bg-white'} p-4 md:p-6 overflow-y-auto`}>
                <Outlet />
            </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;