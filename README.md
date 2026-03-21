# 🎬 CINEVERSE – NỀN TẢNG XEM PHIM MIỄN PHÍ

<div align="center">
  <img width="1200" height="475" alt="Cineverse Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  
  <h3>✨ Trải nghiệm điện ảnh đỉnh cao ngay tại nhà ✨</h3>
  
  [![Netlify Status](https://api.netlify.com/api/v1/badges/your-badge-id/deploy-status)](https://cineverse.netlify.app)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
  
  <p>
    <a href="https://cineverse.netlify.app">🌐 Live Demo</a> •
    <a href="#-tính-năng-nổi-bật">✨ Tính năng</a> •
    <a href="#-cài-đặt">🚀 Cài đặt</a> •
    <a href="#-công-nghệ-sử-dụng">⚙️ Công nghệ</a> •
    <a href="#-cấu-trúc-dự-án">📁 Cấu trúc</a>
  </p>
</div>

---

## 📖 Giới thiệu

**Cineverse** là nền tảng xem phim trực tuyến miễn phí với giao diện hiện đại, lấy cảm hứng từ Netflix, Disney+ và Amazon Prime Video. Dự án mang đến trải nghiệm điện ảnh đỉnh cao với khả năng tìm kiếm thông minh, đề xuất phim chính xác và tối ưu trải nghiệm trên mọi thiết bị.

### 🎯 Mục tiêu
- Mang đến trải nghiệm xem phim miễn phí, chất lượng cao
- Giao diện thân thiện, dễ sử dụng trên mọi thiết bị
- Cập nhật phim mới, thịnh hành liên tục
- Không quảng cáo làm gián đoạn trải nghiệm

---

## ✨ Tính năng nổi bật

### 🎨 Giao diện & Trải nghiệm
- **Cinematic Design** – Giao diện lấy cảm hứng từ Netflix, tối giản nhưng mạnh mẽ
- **Responsive 100%** – Hoạt động hoàn hảo trên Desktop, Tablet, Mobile
- **Dark Mode** – Giao diện tối sang trọng, bảo vệ mắt khi xem đêm
- **Cinema Mode** – Chế độ rạp phim, tối đa hóa trải nghiệm xem

### 🔍 Tìm kiếm & Khám phá
- **Tìm kiếm thông minh** – Gợi ý real-time với từ khóa, highlight kết quả
- **Bộ lọc nâng cao** – Lọc theo thể loại, quốc gia, năm, điểm IMDb, ngôn ngữ
- **Đề xuất cá nhân** – Gợi ý phim dựa trên lịch sử xem và sở thích
- **Phim thịnh hành** – Cập nhật tự động từ TMDb/IMDb mỗi giờ

### 🎬 Xem phim
- **Trình phát mượt mà** – Hỗ trợ HD, Full HD, 4K
- **Tự động chuyển tập** – Chuyển tập tiếp theo ngay khi kết thúc
- **Lưu lịch sử** – Ghi nhận chính xác số phút đã xem
- **Danh sách tập** – Hiển thị tập đã xem, tập hiện tại, tập chưa xem
- **Chọn Audio** – Vietsub, Thuyết minh, Lồng tiếng

### ⭐ Quản lý cá nhân
- **Yêu thích** – Lưu danh sách phim yêu thích
- **Lịch sử xem** – Xem lại những phim đã xem, tiếp tục từ chỗ dừng
- **Hồ sơ cá nhân** – Tùy chỉnh avatar, tên hiển thị, email, mật khẩu

### 📱 Mobile & Tablet
- **Tối ưu cảm ứng** – Nút bấm lớn, dễ thao tác
- **Navigation thu gọn** – Menu mobile thông minh
- **Không zoom khi tìm kiếm** – Trải nghiệm nhập liệu mượt mà

---

## 🚀 Cài đặt

### Yêu cầu hệ thống
- Node.js 18.x trở lên
- NPM hoặc Yarn
- API Key từ TMDb (The Movie Database)

### Các bước cài đặt

1. **Clone repository**
   ```bash
   git clone https://github.com/yourusername/cineverse.git
   cd cineverse
   ```

2. **Cài đặt dependencies**
   ```bash
   npm install
   # hoặc
   yarn install
   ```

3. **Cấu hình biến môi trường**
   
   Tạo file `.env.local` trong thư mục gốc:
   ```env
   VITE_TMDB_API_KEY=your_tmdb_api_key_here
   VITE_API_BASE_URL=https://phimapi.com
   ```

   > 💡 Đăng ký API key miễn phí tại [TMDb](https://www.themoviedb.org/documentation/api)

4. **Chạy ứng dụng ở môi trường development**
   ```bash
   npm run dev
   # hoặc
   yarn dev
   ```

5. **Build cho production**
   ```bash
   npm run build
   # hoặc
   yarn build
   ```

---

## ⚙️ Công nghệ sử dụng

| Công nghệ | Mô tả |
|-----------|-------|
| **React 18** | Thư viện xây dựng giao diện người dùng |
| **TypeScript** | JavaScript với kiểu dữ liệu tĩnh |
| **Vite** | Build tool và development server |
| **TailwindCSS** | Framework CSS tiện ích |
| **Swiper** | Carousel và slider mượt mà |
| **Framer Motion** | Animation chuyên nghiệp |
| **React Router v6** | Điều hướng trang |
| **Axios** | HTTP client |
| **TMDb API** | Dữ liệu phim, poster, backdrop |
| **KKPhim API** | Nguồn phim miễn phí |

---

## 📁 Cấu trúc dự án

```
cineverse/
├── public/                 # Tài nguyên tĩnh
│   ├── favicon.png
│   ├── logo.png
│   └── default-avatar.png
├── src/
│   ├── components/         # React components
│   │   ├── MovieCard.tsx
│   │   ├── MovieSlider.tsx
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── pages/              # Các trang chính
│   │   ├── Home.tsx
│   │   ├── MovieDetail.tsx
│   │   ├── Watch.tsx
│   │   ├── Search.tsx
│   │   ├── Favorites.tsx
│   │   └── History.tsx
│   ├── services/           # API services
│   │   ├── api.ts
│   │   ├── trendingService.ts
│   │   └── actorService.ts
│   ├── hooks/              # Custom hooks
│   │   ├── useMovies.ts
│   │   └── useSearch.ts
│   ├── utils/              # Utility functions
│   │   ├── adSkipper.ts
│   │   └── ratingFormatter.ts
│   ├── styles/             # CSS styles
│   │   └── global.css
│   └── types/              # TypeScript types
│       └── movie.ts
├── .env.local              # Biến môi trường
├── package.json
├── tailwind.config.js
└── README.md
```

---

## 🎯 Tính năng sắp phát triển

- [ ] Đăng nhập bằng Google/Facebook
- [ ] Bình luận và đánh giá phim
- [ ] Chế độ xem cùng bạn bè
- [ ] Tạo playlist phim
- [ ] Thông báo khi có phim mới
- [ ] Hỗ trợ Chromecast

---

## 🤝 Đóng góp

Chúng tôi rất hoan nghênh mọi đóng góp từ cộng đồng!

1. Fork dự án
2. Tạo nhánh tính năng (`git checkout -b feature/AmazingFeature`)
3. Commit thay đổi (`git commit -m 'Add some AmazingFeature'`)
4. Push lên nhánh (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

---

## 📄 License

Dự án được phân phối dưới giấy phép MIT. Xem file `LICENSE` để biết thêm chi tiết.

---

## 🙏 Lời cảm ơn

- [TMDb](https://www.themoviedb.org/) – Cung cấp dữ liệu phim chất lượng
- [KKPhim](https://kkphim.com) – Nguồn phim miễn phí
- [Netflix](https://netflix.com) – Cảm hứng thiết kế

---

<div align="center">
  <sub>Built with ❤️ by Cineverse Team</sub>
  
  <br />
  <br />
  
  [![Star on GitHub](https://img.shields.io/github/stars/yourusername/cineverse?style=social)](https://github.com/yourusername/cineverse/stargazers)
  [![Follow on GitHub](https://img.shields.io/github/followers/yourusername?style=social)](https://github.com/yourusername)
</div>

---

## 🔗 Liên kết

- 🌐 **Live Demo:** [https://cineverse.netlify.app](https://cineverse.netlify.app)
- 📧 **Email:** contact@cineverse.com
- 🐛 **Báo lỗi:** [GitHub Issues](https://github.com/yourusername/cineverse/issues)
