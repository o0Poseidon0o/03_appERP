import React, { useEffect, useState, useMemo } from 'react';
import { 
  Card, List, Input, Tag, Image, Tabs, Empty, Space, Typography,
  Tooltip } from 'antd';
import { 
  UserOutlined, SearchOutlined, GlobalOutlined, 
  FilePdfOutlined, CalendarOutlined } from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';
import { useSearchParams } from 'react-router-dom';

const { Search } = Input;
const { Title, Paragraph } = Typography;

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-[#f0f2f5] min-h-screen">
      {/* HEADER TRANG TIN TỨC */}
      <div className="mb-10 text-center">
          <Title level={1} style={{ fontSize: '2.5rem', color: '#001529', fontWeight: 800 }}>PORTAL TIN TỨC</Title>
          <Paragraph style={{ fontSize: '1.1rem', color: '#595959' }}>
            Không gian cập nhật thông tin và hoạt động nội bộ dành cho nhân viên
          </Paragraph>
          <div className="max-w-2xl mx-auto mt-6">
              <Search 
                  placeholder="Tìm kiếm bài viết, thông báo..." 
                  allowClear 
                  enterButton={<SearchOutlined />}
                  size="large"
                  className="shadow-lg rounded-lg"
                  onChange={(e) => setSearchText(e.target.value)}
              />
          </div>
      </div>

      {/* THANH ĐIỀU HƯỚNG TABS HIỆN ĐẠI */}
      <div className="bg-white p-2 rounded-xl shadow-sm mb-8 border sticky top-4 z-20">
          <Tabs 
              activeKey={activeMenuId} 
              onChange={setActiveMenuId} 
              centered
              items={[
                { key: 'all', label: <span className="px-4 font-bold uppercase tracking-wider">Tất cả tin tức</span> },
                ...menus.map(m => ({ key: String(m.id), label: <span className="px-4 font-bold uppercase tracking-wider">{m.title}</span> }))
              ]}
              tabBarStyle={{ marginBottom: 0 }}
          />
      </div>

      {/* DANH SÁCH BÀI VIẾT DẠNG GRID */}
      <div className="min-h-[500px]">
          {loading ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
                <p className="animate-pulse text-indigo-500 font-semibold">Đang tải bản tin...</p>
              </div>
          ) : filteredPosts.length === 0 ? (
              <Empty description="Không có tin tức nào phù hợp với tìm kiếm của bạn" className="py-20 bg-white rounded-2xl shadow-sm" />
          ) : (
              <List
                  grid={{ gutter: 24, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
                  dataSource={filteredPosts}
                  renderItem={(item) => {
                    const images = item.attachments?.filter(f => f.type?.includes('image') || f.path.match(/\.(jpeg|jpg|png|gif|webp)$/i)) || [];
                    const coverImg = images[0];
                    const galleryImages = images.slice(1);
                    const docs = item.attachments?.filter(f => !f.type?.includes('image') && f.type !== 'link') || [];
                    const links = item.attachments?.filter(f => f.type === 'link') || [];

                    return (
                        <List.Item>
                          <Card 
                              hoverable
                              className="h-full flex flex-col shadow-md rounded-2xl overflow-hidden border-none hover:shadow-2xl transition-all duration-500"
                              cover={
                                <div className="h-60 overflow-hidden bg-gray-200 relative group">
                                  <Image
                                    alt={item.title}
                                    src={coverImg ? getFullUrl(coverImg.path) : 'https://placehold.co/800x600?text=No+Thumbnail'}
                                    className="object-cover w-full h-full transform group-hover:scale-110 transition-transform duration-700"
                                    preview={!!coverImg}
                                    fallback="https://placehold.co/800x600?text=Image+Error"
                                  />
                                  <div className="absolute top-4 left-4">
                                    <Tag color="blue" className="m-0 border-none font-bold shadow-md rounded-md px-3 py-1 uppercase text-[10px]">
                                      {item.menu?.title}
                                    </Tag>
                                  </div>
                                </div>
                              }
                          >
                              <div className="flex flex-col h-full">
                                  <Space className="text-[11px] text-gray-400 mb-3 font-semibold uppercase tracking-tighter">
                                    <span><UserOutlined /> {item.author?.fullName}</span>
                                    <span><CalendarOutlined /> {new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                                  </Space>

                                  <Title level={4} className="mb-3 leading-snug hover:text-indigo-600 transition-colors line-clamp-2" style={{ height: '52px', fontSize: '1.2rem' }}>
                                    {item.title}
                                  </Title>

                                  {/* HIỂN THỊ NỘI DUNG CÓ ĐỊNH DẠNG HTML */}
                                  <Paragraph 
                                    ellipsis={{ rows: 3, expandable: true, symbol: 'Xem thêm' }}
                                    className="text-gray-500 mb-4 text-[14px] leading-relaxed news-content-display"
                                  >
                                    <div dangerouslySetInnerHTML={{ __html: item.content }} />
                                  </Paragraph>

                                  {/* GALLERY ẢNH NHỎ */}
                                  {galleryImages.length > 0 && (
                                    <div className="flex gap-2 mb-4">
                                        <Image.PreviewGroup>
                                            {galleryImages.map((img, idx) => (
                                                <Image 
                                                    key={idx}
                                                    src={getFullUrl(img.path)} 
                                                    width={50} 
                                                    height={45} 
                                                    className="rounded-lg object-cover border-2 border-white shadow-sm"
                                                />
                                            ))}
                                        </Image.PreviewGroup>
                                    </div>
                                  )}

                                  {/* KHU VỰC TÀI LIỆU VÀ LINK */}
                                  {(docs.length > 0 || links.length > 0) && (
                                    <div className="mt-auto pt-4 border-t border-gray-100">
                                        <div className="flex flex-wrap gap-2">
                                            {docs.map((doc, idx) => (
                                                <Tooltip title={doc.name} key={idx}>
                                                  <a href={getFullUrl(doc.path)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1 rounded-full text-[12px] border border-red-100 hover:bg-red-600 hover:text-white transition-all no-underline">
                                                      <FilePdfOutlined /> <span>Tài liệu</span>
                                                  </a>
                                                </Tooltip>
                                            ))}
                                            {links.map((link, idx) => (
                                                <a key={idx} href={getFullUrl(link.path)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[12px] border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all no-underline">
                                                    <GlobalOutlined /> <span>Liên kết</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                  )}
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