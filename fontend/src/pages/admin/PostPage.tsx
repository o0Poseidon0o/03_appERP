import React, { useEffect, useState, useMemo } from 'react';
import { 
  Card, List, Input, Tag, Image, Tabs, Empty, Space, Typography} from 'antd';
import { 
  UserOutlined, GlobalOutlined, 
  FilePdfOutlined, CalendarOutlined
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';
import { useSearchParams } from 'react-router-dom';

const { Search } = Input;
const { Title, Paragraph, Text } = Typography;

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

  // --- GIỮ NGUYÊN LOGIC CALL API ---
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

  const filteredPosts = useMemo(() => {
      if (!searchText) return posts;
      const lowerText = searchText.toLowerCase();
      return posts.filter(post => 
          post.title.toLowerCase().includes(lowerText) ||
          post.content.toLowerCase().includes(lowerText)
      );
  }, [posts, searchText]);

  const getFullUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('http')) return path;
      const cleanServerUrl = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${cleanServerUrl}${cleanPath}`;
  };

  // --- GIAO DIỆN MỚI ---
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-[#f4f7f9] min-h-screen">
      {/* HEADER SECTION */}
      <div className="mb-10 text-center">
          <Title level={2} style={{ color: '#1a3353', marginBottom: 8 }}>BẢNG TIN DOANH NGHIỆP</Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>Cập nhật những thông báo và hoạt động mới nhất từ nội bộ</Text>
          
          <div className="max-w-xl mx-auto mt-8">
              <Search 
                  placeholder="Tìm kiếm nội dung tin tức..." 
                  allowClear 
                  enterButton="Tìm kiếm"
                  size="large"
                  className="shadow-lg rounded-lg"
                  onChange={(e) => setSearchText(e.target.value)}
              />
          </div>
      </div>

      {/* TABS MENU HIỆN ĐẠI */}
      <div className="bg-white p-2 rounded-xl shadow-sm mb-8 border sticky top-2 z-10">
          <Tabs 
              activeKey={activeMenuId} 
              onChange={setActiveMenuId} 
              centered
              items={[
                { key: 'all', label: <span className="px-4 font-bold">TẤT CẢ TIN</span> },
                ...menus.map(m => ({ key: String(m.id), label: <span className="px-4 font-bold">{m.title.toUpperCase()}</span> }))
              ]}
              tabBarStyle={{ marginBottom: 0 }}
          />
      </div>

      {/* DANH SÁCH BẢI VIẾT DẠNG GRID TIN TỨC */}
      <div className="min-h-100">
          {loading ? (
              <div className="text-center py-20 bg-white rounded-xl shadow-inner">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
                <p className="text-gray-500 font-medium">Đang tải bản tin mới nhất...</p>
              </div>
          ) : filteredPosts.length === 0 ? (
              <Empty description="Hiện chưa có tin tức nào phù hợp" className="py-20 bg-white rounded-xl" />
          ) : (
              <List
                  grid={{ gutter: 24, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
                  dataSource={filteredPosts}
                  renderItem={(item) => {
                    // Logic tách ảnh bìa (cover)
                    const images = item.attachments?.filter(f => f.type?.includes('image') || f.path.match(/\.(jpeg|jpg|png|gif|webp)$/i)) || [];
                    const coverImg = images[0];
                    const otherDocs = item.attachments?.filter(f => !f.type?.includes('image') && f.type !== 'link') || [];
                    const links = item.attachments?.filter(f => f.type === 'link') || [];

                    return (
                        <List.Item>
                          <Card 
                              hoverable
                              className="h-full flex flex-col shadow-md rounded-xl overflow-hidden border-none hover:shadow-2xl transition-all duration-300"
                              cover={
                                <div className="h-56 overflow-hidden bg-gray-200">
                                  <Image
                                    alt={item.title}
                                    src={coverImg ? getFullUrl(coverImg.path) : 'https://placehold.co/600x400?text=Internal+News'}
                                    className="object-cover w-full h-full transform hover:scale-110 transition-transform duration-500"
                                    preview={!!coverImg}
                                    fallback="https://placehold.co/600x400?text=No+Image"
                                  />
                                </div>
                              }
                          >
                              <div className="flex flex-col h-full">
                                  <div className="mb-2">
                                    <Tag color="indigo" className="font-bold border-none rounded-md px-2 py-0.5 uppercase text-[10px]">
                                      {item.menu?.title}
                                    </Tag>
                                  </div>

                                  <Title level={4} className="mb-3 line-clamp-2" style={{ height: '56px', fontSize: '1.1rem', lineHeight: '1.4' }}>
                                    {item.title}
                                  </Title>

                                  <Paragraph 
                                    ellipsis={{ rows: 3, expandable: true, symbol: 'Xem thêm' }}
                                    className="text-gray-500 mb-4 text-sm leading-relaxed"
                                  >
                                    {item.content}
                                  </Paragraph>

                                  {/* GALLERY ẢNH NHỎ (Nếu có > 1 ảnh) */}
                                  {images.length > 1 && (
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                        <Image.PreviewGroup>
                                            {images.slice(1).map((img, idx) => (
                                                <Image 
                                                    key={idx}
                                                    src={getFullUrl(img.path)} 
                                                    width={50} 
                                                    height={40} 
                                                    className="rounded object-cover border"
                                                />
                                            ))}
                                        </Image.PreviewGroup>
                                    </div>
                                  )}

                                  {/* TÀI LIỆU ĐÍNH KÈM */}
                                  {(otherDocs.length > 0 || links.length > 0) && (
                                    <div className="mt-auto bg-gray-50 p-3 rounded-lg border border-dashed mb-4">
                                        <div className="flex flex-wrap gap-2">
                                            {otherDocs.map((doc, idx) => (
                                                <a key={idx} href={getFullUrl(doc.path)} target="_blank" className="flex items-center gap-1 text-[11px] bg-white border px-2 py-1 rounded hover:bg-red-50 text-red-600">
                                                    <FilePdfOutlined /> {doc.name.slice(0, 15)}...
                                                </a>
                                            ))}
                                            {links.map((link, idx) => (
                                                <a key={idx} href={getFullUrl(link.path)} target="_blank" className="flex items-center gap-1 text-[11px] bg-white border px-2 py-1 rounded hover:bg-blue-50 text-blue-600">
                                                    <GlobalOutlined /> Link
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                  )}

                                  <div className="mt-auto flex items-center justify-between text-[11px] text-gray-400 pt-4 border-t">
                                      <Space>
                                          <UserOutlined className="text-indigo-400" />
                                          <span className="font-semibold text-gray-500">{item.author?.fullName}</span>
                                      </Space>
                                      <Space>
                                          <CalendarOutlined />
                                          {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                                      </Space>
                                  </div>
                              </div>
                          </Card>
                        </List.Item>
                    );
                  }}
              />
          )}
      </div>
    </div>
  );
};

export default PostPage;