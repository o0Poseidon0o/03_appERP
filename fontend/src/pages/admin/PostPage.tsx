import React, { useEffect, useState, useMemo } from 'react';
import { 
  Card, List, Input, Tag, Image, Tabs, Empty
} from 'antd';
import { 
  UserOutlined, SearchOutlined, GlobalOutlined, 
  PaperClipOutlined, FilePdfOutlined
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';
import { useSearchParams } from 'react-router-dom';

const { Search } = Input;

// Cấu hình URL cho ảnh
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

// Interface chính cho Bài viết
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
  // URL Params để chia sẻ link bài viết
  const [searchParams, setSearchParams] = useSearchParams();
  const menuIdParam = searchParams.get('menuId');

  // --- 2. SỬA STATE: Dùng Interface thay vì 'unknown' ---
  const [posts, setPosts] = useState<Post[]>([]);
  const [menus, setMenus] = useState<MenuType[]>([]);
  const [loading, setLoading] = useState(false);
  
  // State tìm kiếm & Lọc
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
        let url = '/posts?limit=50'; // Lấy 50 bài mới nhất
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
    // Cập nhật URL
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

  // --- HELPER: HIỂN THỊ FILE ĐÍNH KÈM ---
  const getFullUrl = (path: string) => {
      if (!path) return '';
      return path.startsWith('http') ? path : `${SERVER_URL}${path}`;
  };

  const renderAttachment = (file: Attachment) => {
      const fullPath = getFullUrl(file.path);

      // Link
      if (file.type === 'link') {
          return (
              <a href={fullPath} target="_blank" rel="noreferrer" key={file.path} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-2 rounded-md hover:bg-indigo-100 transition-colors border border-indigo-100 no-underline">
                  <GlobalOutlined /> 
                  <span className="font-medium text-sm truncate max-w-[200px]">{file.name}</span>
              </a>
          )
      }

      // Ảnh
      const isImage = file.type?.includes('image') || file.path.match(/\.(jpeg|jpg|png|gif)$/i);
      if (isImage) {
          return (
              <div key={file.path} className="border border-gray-200 p-1 rounded bg-white shadow-sm">
                  <Image 
                    width={100} 
                    height={80} 
                    className="object-cover rounded" 
                    src={fullPath} 
                    fallback="https://via.placeholder.com/100x80?text=Error" 
                  />
              </div>
          );
      }

      // File
      return (
          <a href={fullPath} target="_blank" rel="noreferrer" key={file.path} className="flex items-center gap-2 bg-gray-50 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition-colors border border-gray-200 no-underline">
              <FilePdfOutlined className="text-red-500" />
              <span className="font-medium text-sm">{file.name}</span>
          </a>
      );
  };

  // Cấu hình Tabs menu
  const menuItems = [
      { key: 'all', label: 'Tất cả tin tức' },
      ...menus.map(m => ({ key: String(m.id), label: m.title }))
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* HEADER: TÌM KIẾM */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
              <h1 className="text-2xl font-bold text-gray-800 m-0">Bảng tin nội bộ</h1>
              <p className="text-gray-500 m-0 text-sm">Cập nhật thông tin mới nhất từ công ty</p>
          </div>
          
          <div className="w-full md:w-auto">
              <Search 
                  placeholder="Tìm kiếm tin tức..." 
                  allowClear 
                  enterButton={<SearchOutlined />}
                  size="middle"
                  className="w-full md:w-72"
                  onChange={(e) => setSearchText(e.target.value)}
              />
          </div>
      </div>

      {/* TABS MENU */}
      <div className="bg-white p-2 rounded-lg shadow-sm mb-6 sticky top-0 z-10">
          <Tabs 
              activeKey={activeMenuId} 
              onChange={setActiveMenuId} 
              items={menuItems}
              tabBarStyle={{ marginBottom: 0 }}
          />
      </div>

      {/* DANH SÁCH BÀI VIẾT */}
      <div className="min-h-[300px]">
          {loading ? (
              <div className="text-center py-10">Đang tải dữ liệu...</div>
          ) : filteredPosts.length === 0 ? (
              <Empty description="Không tìm thấy bài viết nào" className="py-10" />
          ) : (
              <List
                  grid={{ gutter: 24, xs: 1, sm: 1, md: 1, lg: 1, xl: 1, xxl: 1 }}
                  dataSource={filteredPosts}
                  // --- 3. TYPE SẼ ĐƯỢC TỰ ĐỘNG HIỂU LÀ 'Post' ---
                  renderItem={(item) => (
                    <List.Item>
                      <Card 
                          className="shadow-sm hover:shadow-md transition-all border-l-4 border-l-indigo-500 rounded-r-lg"
                          bodyStyle={{ padding: '20px' }}
                      >
                          <div className="flex justify-between items-start mb-3">
                              <h3 className="text-lg font-bold text-gray-800 m-0 hover:text-indigo-600 cursor-pointer">{item.title}</h3>
                              <Tag color="blue" className="ml-2">{item.menu?.title}</Tag>
                          </div>

                          {/* Nội dung bài viết */}
                          <div className="text-gray-600 mb-4 whitespace-pre-wrap leading-relaxed">
                              {item.content}
                          </div>

                          {/* Khu vực File đính kèm */}
                          {item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0 && (
                              <div className="mb-4 bg-gray-50/50 p-3 rounded-lg border border-dashed border-gray-200">
                                  <div className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                                      <PaperClipOutlined /> Đính kèm:
                                  </div>
                                  <div className="flex flex-wrap gap-3">
                                      {item.attachments.map((file: Attachment, idx: number) => (
                                          <div key={idx}>{renderAttachment(file)}</div>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {/* Footer: Tác giả & Thời gian */}
                          <div className="flex items-center justify-between text-xs text-gray-400 border-t pt-3">
                              <div className="flex items-center gap-4">
                                  <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                      <UserOutlined /> {item.author?.fullName}
                                  </span>
                                  <span>{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                              </div>
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