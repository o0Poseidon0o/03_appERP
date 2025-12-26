# --- Giai đoạn 1: Build React bằng Node 24 ---
FROM node:24-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Set biến môi trường khi build (để trống để Nginx tự xử lý proxy)
ENV VITE_API_URL=/

# Build ra file tĩnh (dist)
RUN npm run build

# --- Giai đoạn 2: Chạy bằng Nginx (Không cần sửa gì ở đây) ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]