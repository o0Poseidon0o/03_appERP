backend/
├── prisma/
│   ├── schema.prisma       # Nơi định nghĩa Bảng (Postgres) và Quan hệ
│   └── migrations/         # Lịch sử thay đổi DB
├── src/
│   ├── config/             # Cấu hình (Biến môi trường, cors, logger)
│   ├── controllers/        # Xử lý Request/Response (Không chứa logic phức tạp)
│   │   ├── authController.ts
│   │   ├── postController.ts
│   │   ├── menuController.ts
│   │   └── ...
│   ├── middlewares/        # Các hàm chặn giữa (Auth, Upload, ErrorHandler)
│   │   ├── authMiddleware.ts
│   │   ├── uploadMiddleware.ts
│   │   └── validateMiddleware.ts
│   ├── routes/             # Định nghĩa API Endpoint (VD: /api/v1/posts)
│   │   ├── index.ts        # Gom tất cả route lại
│   │   ├── authRoutes.ts
│   │   └── postRoutes.ts
│   ├── services/           # TRÁI TIM CỦA APP (Logic nghiệp vụ nằm ở đây)
│   │   ├── authService.ts
│   │   ├── postService.ts  # VD: Logic lọc bài viết theo phòng ban
│   │   └── emailService.ts # (Mở rộng sau này: Gửi mail thông báo)
│   ├── utils/              # Các hàm tiện ích dùng chung
│   │   ├── AppError.ts     # Class xử lý lỗi
│   │   └── fileHelper.ts
│   ├── types/              # Định nghĩa Type mở rộng cho Express (VD: req.user)
│   └── app.ts              # Khởi tạo Express App
├── uploads/                # Nơi lưu file PDF/Image (Nếu lưu local)
├── .env                    # Chứa DATABASE_URL, JWT_SECRET
├── package.json
└── tsconfig.json

fontend/
├── public/                 # File tĩnh (Logo, favicon)
├── src/
│   ├── assets/             # Hình ảnh, icon, global css
│   ├── components/         # CÁC UI DÙNG CHUNG (Không chứa logic nghiệp vụ)
│   │   ├── common/         # Button, Input, Modal, Spinner
│   │   ├── layout/         # AdminLayout, UserLayout, Sidebar, Header
│   │   ├── editor/         # Component soạn thảo văn bản (Rich Text)
│   │   └── pdf/            # Component hiển thị PDF
│   ├── features/           # CÁC CHỨC NĂNG CỤ THỂ (Logic + UI riêng)
│   │   ├── auth/           # Login form, Register form
│   │   ├── posts/          # PostList, PostDetail, CreatePostForm
│   │   ├── admin/          # DashboardStats, ManageUsers
│   │   └── menu/           # MenuTree, MenuEditor
│   ├── hooks/              # Custom Hooks (useAuth, useDebounce)
│   ├── contexts/           # Global State (AuthContext, ThemeContext)
│   ├── lib/                # Cấu hình thư viện bên thứ 3 (Axios, React Query)
│   │   ├── axios.ts
│   │   └── utils.ts
│   ├── pages/              # Các trang hiển thị (Gắn kết Feature vào Layout)
│   │   ├── LoginPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── PostDetailPage.tsx
│   │   └── admin/          # Các trang admin con
│   ├── routes/             # Cấu hình React Router (Protected Routes)
│   │   └── AppRoutes.tsx
│   ├── types/              # TypeScript Interfaces (Đồng bộ với Backend)
│   ├── App.tsx
│   └── main.tsx
├── .env                    # API_URL
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts


Khi xóa thư mục migrations
hãy chạy 
npx prisma migrate dev --name init_full_db
npx prisma migrate reset
