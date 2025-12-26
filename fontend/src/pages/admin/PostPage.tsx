import React, { useEffect, useState, useMemo } from 'react';
import { 
  Card, List, Input, Tag, Image, Tabs, Empty, Space} from 'antd';
import { 
  UserOutlined, SearchOutlined, GlobalOutlined, 
  PaperClipOutlined, FilePdfOutlined
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';
import { useSearchParams } from 'react-router-dom';

const { Search } = Input;

// Cấu hình URL cho ảnh - Đảm bảo lấy đúng từ môi trường
const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// --- 1. ĐỊNH NGHĨA KIỂU DỮ LIỆU (INTERFACE) ---
interface Attachment {
    name: string;
    path: string;
    type: string;
}

interface Author {
    fullName: string;
}

interface MenuType {
    id: number | string;
    title: string;
}

interface Post {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    menu?: MenuType;
    author?: Author;
    attachments?: Attachment[];
}

const PostPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const menuIdParam = searchParams.get('menuId');

  const [posts, setPosts] = useState<Post[]>([]);
  const [menus, setMenus] = useState<MenuType[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [searchText, setSearchText] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string>(menuIdParam || 'all');

  // --- CALL API ---
  const fetchMenus = async () => {
      try {
          const res = await axiosClient.get('/menus');
          setMenus(res.data.data);
      } catch (e) { console.error(e); }
  }

  const fetchPosts = async () => {
    setLoading(true);
    try {
        let url = '/posts?limit=50';
        if (activeMenuId !== 'all') {
            url += `&menuId=${activeMenuId}`;
        }
        const res = await axiosClient.get(url);
        setPosts(res.data.data);
    } catch (error) {
        console.error("Lỗi tải bài viết", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  useEffect(() => {
    fetchPosts();
    if (activeMenuId === 'all') setSearchParams({});
    else setSearchParams({ menuId: activeMenuId });
  }, [activeMenuId]);

  // --- XỬ LÝ SEARCH CLIENT-SIDE ---
  const filteredPosts = useMemo(() => {
      if (!searchText) return posts;
      const lowerText = searchText.toLowerCase();
      return posts.filter(post => 
          post.title.toLowerCase().includes(lowerText) ||
          post.content.toLowerCase().includes(lowerText)
      );
  }, [posts, searchText]);

  // --- HELPER: XỬ LÝ URL ĐẦY ĐỦ ---
  const getFullUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('http')) return path;
      
      // Đảm bảo có dấu / giữa SERVER_URL và path
      const cleanServerUrl = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      
      return `${cleanServerUrl}${cleanPath}`;
  };

  const renderAttachment = (file: Attachment) => {
      const fullPath = getFullUrl(file.path);

      // 1. Loại Link
      if (file.type === 'link') {
          return (
              <a href={fullPath} target="_blank" rel="noreferrer" key={file.path} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-2 rounded-md hover:bg-indigo-100 transition-colors border border-indigo-100 no-underline">
                  <GlobalOutlined /> 
                  <span className="font-medium text-sm truncate max-w-[150px]">{file.name}</span>
              </a>
          )
      }

      // 2. Loại Ảnh
      const isImage = file.type?.includes('image') || file.path.match(/\.(jpeg|jpg|png|gif|webp)$/i);
      if (isImage) {
          return (
              <div key={file.path} className="border border-gray-200 p-1 rounded bg-white shadow-sm inline-block">
                  <Image 
                    width={100} 
                    height={80} 
                    className="object-cover rounded" 
                    src={fullPath} 
                    fallback="https://placehold.co/100x80?text=Loi+Anh" 
                    preview={{
                        mask: <div className="text-xs">Xem ảnh</div>
                    }}
                  />
              </div>
          );
      }

      // 3. Loại File (PDF, Document...)
      return (
          <a href={fullPath} target="_blank" rel="noreferrer" key={file.path} className="flex items-center gap-2 bg-gray-50 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition-colors border border-gray-200 no-underline">
              <FilePdfOutlined className="text-red-500" />
              <span className="font-medium text-sm truncate max-w-[150px]">{file.name}</span>
          </a>
      );
  };

  const menuItems = [
      { key: 'all', label: 'Tất cả tin tức' },
      ...menus.map(m => ({ key: String(m.id), label: m.title }))
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
              <h1 className="text-2xl font-bold text-gray-800 m-0">Bảng tin nội bộ</h1>
              <p className="text-gray-500 m-0 text-sm">Thông tin và thông báo mới nhất từ hệ thống</p>
          </div>
          
          <div className="w-full md:w-auto">
              <Search 
                  placeholder="Tìm kiếm nội dung..." 
                  allowClear 
                  enterButton={<SearchOutlined />}
                  size="middle"
                  className="w-full md:w-72 shadow-sm"
                  onChange={(e) => setSearchText(e.target.value)}
              />
          </div>
      </div>

      {/* TABS MENU */}
      <div className="bg-white p-1 rounded-lg shadow-sm mb-6 sticky top-2 z-10 border">
          <Tabs 
              activeKey={activeMenuId} 
              onChange={setActiveMenuId} 
              items={menuItems}
              tabBarStyle={{ marginBottom: 0, padding: '0 10px' }}
          />
      </div>

      {/* DANH SÁCH BÀI VIẾT */}
      <div className="min-h-[400px]">
          {loading ? (
              <div className="text-center py-20 bg-white rounded-lg border border-dashed">
                <p className="text-gray-400">Đang tải dữ liệu bài viết...</p>
              </div>
          ) : filteredPosts.length === 0 ? (
              <Empty description="Không có tin tức nào trong mục này" className="py-20 bg-white rounded-lg border" />
          ) : (
              <List
                  dataSource={filteredPosts}
                  renderItem={(item) => (
                    <List.Item className="border-none p-0 mb-6">
                      <Card 
                          className="w-full shadow-sm hover:shadow-md transition-all border-l-4 border-l-indigo-500 rounded-r-lg"
                          bodyStyle={{ padding: '24px' }}
                      >
                          <div className="flex justify-between items-start mb-4">
                              <h3 className="text-xl font-bold text-gray-800 m-0 hover:text-indigo-600 transition-colors">
                                {item.title}
                              </h3>
                              <Tag color="processing" className="m-0 rounded-full px-3">{item.menu?.title}</Tag>
                          </div>

                          <div className="text-gray-600 mb-6 whitespace-pre-wrap leading-relaxed text-base">
                              {item.content}
                          </div>

                          {/* ĐÍNH KÈM */}
                          {item.attachments && item.attachments.length > 0 && (
                              <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-200">
                                  <div className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                      <PaperClipOutlined /> DANH SÁCH ĐÍNH KÈM:
                                  </div>
                                  <div className="flex flex-wrap gap-3">
                                      {item.attachments.map((file, idx) => (
                                          <div key={idx}>{renderAttachment(file)}</div>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {/* FOOTER */}
                          <div className="flex items-center justify-between text-xs text-gray-400 border-t pt-4">
                              <Space size="middle">
                                  <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full text-gray-600 font-medium">
                                      <UserOutlined className="text-indigo-500" /> {item.author?.fullName || 'Ẩn danh'}
                                  </span>
                                  <span className="italic">
                                    Đăng lúc: {new Date(item.createdAt).toLocaleString('vi-VN')}
                                  </span>
                              </Space>
                          </div>
                      </Card>
                    </List.Item>
                  )}
              />
          )}
      </div>
    </div>
  );
};

export default PostPage;