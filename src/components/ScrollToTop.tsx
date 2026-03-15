import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  // Lấy thông tin đường dẫn hiện tại (ví dụ: /profile, /settings)
  const { pathname } = useLocation();

  useEffect(() => {
    // Mỗi khi pathname thay đổi, cuộn trình duyệt lên tọa độ (0, 0)
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant", // Dùng "smooth" nếu bạn muốn nó trượt từ từ, nhưng "instant" thường tốt hơn cho việc chuyển trang
    });
  }, [pathname]);

  return null; // Component này không hiển thị gì lên giao diện cả
};

export default ScrollToTop;
