# 1. Sử dụng Node 24 bản Alpine (Siêu nhẹ)
FROM node:24-alpine

# 2. Cài đặt thêm các thư viện cần thiết cho Prisma trên Alpine
# (OpenSSL và libc6-compat là bắt buộc để Prisma Engine chạy được trên Alpine)
RUN apk add --no-cache openssl libc6-compat

RUN apk add --no-cache \
    openssl \
    libc6-compat \
    python3 \
    py3-pip \
    nmap

# 2. Cài thư viện python-nmap
# Lưu ý: Thêm cờ --break-system-packages để tránh lỗi trên các bản Linux mới (như Ubuntu 24/Debian 12)
RUN pip3 install python-nmap --break-system-packages
# -------------------------------------
# 3. Tạo thư mục làm việc
WORKDIR /app

# 4. Copy package.json và cài thư viện
COPY package*.json ./
RUN npm install

# 5. Copy toàn bộ code
COPY . .

# 6. Sinh Prisma Client (BẮT BUỘC)
RUN npx prisma generate

# 7. Mở port
EXPOSE 3000

# 8. Lệnh chạy server
CMD ["npm", "run", "dev"]