import { useState, useEffect } from "react";

const useMediaQuery = (query: string): boolean => {
  // State lưu trạng thái (true nếu khớp query, false nếu không)
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    // Cập nhật state ngay lập tức khi component mount
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    // Hàm lắng nghe khi kích thước màn hình thay đổi
    const listener = () => setMatches(media.matches);
    
    // Đăng ký sự kiện
    media.addEventListener("change", listener);
    
    // Dọn dẹp sự kiện khi component unmount
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
};

export default useMediaQuery;