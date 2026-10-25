# E-commerce MVP RESTful API

API thương mại điện tử xây dựng bằng Node.js, Express 5, TypeScript, Prisma ORM 7 và PostgreSQL. Project tổ chức theo **Monolithic Modular**: toàn bộ nghiệp vụ chạy trong một ứng dụng API, nhưng mã nguồn được chia module để dễ bảo trì.

## 0. Chuẩn bị

Cài đặt Docker Desktop (có Docker Compose v2), Postman và Node.js nếu muốn chạy development ngoài Docker.

Tạo file môi trường (PowerShell):

```powershell
Copy-Item .env.example .env
```

Đổi `JWT_SECRET` và mật khẩu PostgreSQL trước khi triển khai thật.

## 1. Cấu trúc project Monolithic

```text
lab2/
├── prisma/
│   ├── migrations/             # Lịch sử thay đổi cấu trúc database
│   ├── schema.prisma           # Model, quan hệ, khóa và kiểu dữ liệu
│   └── seed.ts                 # Role, membership, admin, sản phẩm mẫu
├── src/
│   ├── common/                 # AppError và asyncHandler dùng chung
│   ├── config/                 # Đọc, kiểm tra biến môi trường bằng Zod
│   ├── generated/prisma/       # Prisma Client được sinh tự động
│   ├── lib/                    # Khởi tạo kết nối Prisma
│   ├── middleware/             # JWT, phân quyền, validation, xử lý lỗi
│   ├── modules/
│   │   ├── auth/               # Đăng ký, đăng nhập, tài khoản
│   │   ├── health/             # Liveness và readiness
│   │   ├── orders/             # Đặt hàng, xem đơn và chi tiết
│   │   ├── products/           # CRUD sản phẩm
│   │   └── shipments/          # Tạo/cập nhật giao hàng
│   ├── app.ts                  # Cấu hình Express và gắn route
│   └── server.ts               # HTTP server và graceful shutdown
├── .env.example                # Mẫu biến môi trường được commit
├── .gitignore                  # File Git không theo dõi
├── compose.yaml                # API, migration, seed và PostgreSQL
├── Dockerfile                  # Build image API
├── package.json                # Dependencies và npm scripts
└── tsconfig.json               # Cấu hình TypeScript
```

Đây là Monolithic vì authentication, product, order và shipment được build/deploy chung trong **một API container**, dùng chung Prisma Client và một PostgreSQL. Việc chia `src/modules` là chia module trong code, không phải microservice.

```text
Postman/Client
      ↓
Express → middleware xác thực/validation → route nghiệp vụ
      ↓                                      ↓
error handler ←──────── Prisma ORM ─────→ PostgreSQL
```

Ưu điểm trong bài lab: cài đặt/deploy đơn giản, transaction đặt hàng chạy trong một tiến trình và dễ debug.

## 2. `.gitignore`, `.env` và GitHub

| Mục trong `.gitignore` | Lý do không đưa lên GitHub |
|---|---|
| `node_modules/` | Rất lớn, phục hồi bằng `npm ci` |
| `dist/` | Mã JavaScript tạo bởi build |
| `.env` | Chứa mật khẩu database và JWT secret |
| `src/generated/` | Sinh lại bằng `prisma generate` |
| `coverage/`, `npm-debug.log*` | Báo cáo test và log cục bộ |
| `.DS_Store` | Metadata của macOS |

`.env` là cấu hình riêng của từng máy và **không được commit/push lên GitHub**. `.env.example` chỉ chứa tên biến và giá trị mẫu an toàn nên cần commit để người khác biết phải cấu hình gì.

Kiểm tra trước khi push:

```powershell
git status
git check-ignore -v .env
git ls-files .env
```

`git check-ignore` phải chỉ ra rule `.env`; `git ls-files .env` không được in gì. Nếu `.env` từng được theo dõi:

```powershell
git rm --cached .env
git commit -m "stop tracking environment secrets"
```

Nếu secret từng bị push, phải đổi ngay mật khẩu/JWT secret; xóa file ở commit mới không xóa nó khỏi lịch sử.

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Kết nối khi chạy API ngoài Docker |
| `JWT_SECRET` | Khóa ký JWT, tối thiểu 32 ký tự |
| `JWT_EXPIRES_IN` | Thời hạn access token |
| `CORS_ORIGIN` | Origin được phép gọi API |
| `POSTGRES_USER` | User PostgreSQL trong container |
| `POSTGRES_PASSWORD` | Mật khẩu PostgreSQL |
| `POSTGRES_DB` | Tên database |

## 3. Prisma ORM và mô hình dữ liệu

`prisma/schema.prisma` là nguồn mô tả database:

- `generator client`: sinh Prisma Client type-safe vào `src/generated/prisma`.
- `datasource db`: chọn PostgreSQL; URL lấy từ `prisma.config.ts`/`DATABASE_URL`.
- `@id`, `@default(autoincrement())`: khóa chính tự tăng.
- `@map`, `@@map`: ánh xạ field/model TypeScript sang cột/bảng PostgreSQL.
- `@relation`: khóa ngoại và quan hệ; `@@index`: index hỗ trợ join/lọc.
- `Decimal(10,2)`: lưu tiền chính xác.

```text
Role 1 ── n User n ── 1 Membership
              │
              1
              │
              n
            Order 1 ── n OrderDetail n ── 1 Product
              │
              1
              │
              n
           Shipment
```

`OrderDetail` dùng khóa chính kép `(orderId, productId)` và lưu `unitPrice` để giữ giá tại thời điểm đặt. `Order.createdAt @default(now())` để PostgreSQL tự lấy thời gian hiện hành. Khi tạo order, Prisma transaction kiểm tra tồn kho, trừ `Product.quantity`, tạo `Order` và `OrderDetail` nguyên tử.

```powershell
npm run prisma:generate   # Sinh Prisma Client
npm run prisma:migrate    # Tạo migration khi phát triển
npm run prisma:deploy     # Áp dụng migration đã có
npm run prisma:seed       # Nạp dữ liệu nền, có thể chạy lại
npm run prisma:studio     # Giao diện xem dữ liệu
```

Seed tạo role `ADMIN`, `NORMAL`, membership `BASIC` có `score = 10`, admin và sản phẩm mẫu. Tài khoản đăng ký qua API tự nhận role `NORMAL` và membership `BASIC`.

## 4. CLI: compose hệ thống và health check

### Bước 1 — Build và chạy hệ thống

```powershell
docker compose up --build -d
```

Thứ tự: `db` healthy → `migrate` hoàn tất → `seed` hoàn tất → `api` chạy.

### Bước 2 — Liệt kê container

```powershell
docker ps
```

Kết quả đúng: `db`, `api` là `Up ... (healthy)`; `migrate`, `seed` là `Exited (0)` vì chỉ chạy một lần.

### Bước 3 — Health check

```powershell
Invoke-RestMethod http://localhost:3000/health/live
Invoke-RestMethod http://localhost:3000/health/ready
docker inspect --format='{{json .State.Health}}' lab2-api-1
```

`live` xác nhận API sống; `ready` chỉ thành công khi kết nối được PostgreSQL. Nếu tên container khác, lấy từ `docker compose ps -a`.

```powershell
docker compose logs --tail=100 db migrate seed api
```

## 5. CLI: kiểm tra bảng và tạo sản phẩm X, Y

### Bước 1 — Vào PostgreSQL container

```powershell
docker compose exec db psql -U ecommerce -d ecommerce_db
```

Nếu đã đổi `POSTGRES_USER`/`POSTGRES_DB` trong `.env`, thay giá trị tương ứng.

### Bước 2 — Kiểm tra đủ bảng

```sql
\dt
\d roles
\d memberships
\d users
\d products
\d orders
\d order_details
\d shipments
```

Phải có 7 bảng nghiệp vụ trên và `_prisma_migrations`.

### Bước 3 — Tạo hai sản phẩm bằng CLI

```sql
INSERT INTO products (pname, price, quantity)
VALUES
  ('Sản phẩm X', 100000.00, 20),
  ('Sản phẩm Y', 200000.00, 30)
RETURNING pid, pname, price, quantity;
```

Ghi lại `pid` của X/Y để nhập trực tiếp vào body request Postman ở mục 7.

```sql
SELECT pid, pname, price, quantity
FROM products
WHERE pname IN ('Sản phẩm X', 'Sản phẩm Y')
ORDER BY pid;
\q
```

## 6. POSTMAN: đăng ký → NORMAL/10 điểm → đăng nhập

Phần này **không sử dụng Postman Environment**. Nhập URL trực tiếp và sao chép token/ID thủ công từ response sang request tiếp theo.

### Bước 1 — Đăng ký

```http
POST http://localhost:3000/api/v1/auth/register
Content-Type: application/json
```

```json
{
  "username": "customer01",
  "fullName": "Nguyen Van A",
  "password": "Customer@123"
}
```

Mong đợi HTTP `201`. Role/membership không nhận từ body; server tự gán `NORMAL` và `BASIC`.

### Bước 2 — Đăng nhập và hiển thị token

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json
```

```json
{ "username": "customer01", "password": "Customer@123" }
```

Response hiển thị `data.accessToken` và `role: "NORMAL"`. Sao chép nguyên giá trị `accessToken` (không lấy dấu ngoặc kép) để dùng làm **USER_TOKEN** ở các bước sau, ví dụ:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "username": "customer01", "role": "NORMAL" }
  }
}
```

### Bước 3 — Kiểm tra role và score

```http
GET http://localhost:3000/api/v1/auth/me
Authorization: Bearer <USER_TOKEN>
```

Trong Postman, chọn Authorization → Type `Bearer Token`, rồi dán USER_TOKEN vừa sao chép vào ô Token. Không gõ thêm chữ `Bearer` trong ô này.

Kết quả chứa:

```json
{
  "role": { "roleName": "NORMAL" },
  "membership": { "membershipName": "BASIC", "score": 10 }
}
```

## 7. POSTMAN: đặt hàng và shipment

### Bước 1 — Đặt hàng không token

```http
POST http://localhost:3000/api/v1/orders
Content-Type: application/json
```

```json
{
  "items": [
    { "productId": 3, "quantity": 2 },
    { "productId": 4, "quantity": 5 }
  ]
}
```

Trong ví dụ này, X có `pid = 3` và Y có `pid = 4`; phải thay hai số đó nếu kết quả ở mục 5 khác. Không cấu hình Authorization. Mong đợi HTTP `401`:

```json
{ "success": false, "message": "Thiếu access token" }
```

### Bước 2 — Đặt hàng bằng token

Gửi lại request trên, chọn Authorization → `Bearer Token`, rồi dán USER_TOKEN đã sao chép. Không truyền thời gian; database tự gán `createdAt = now()`.

Mong đợi HTTP `201`, hai `details`, và `shipments: []`. Ghi lại `data.orderId` trong response làm **ORDER_ID**.

### Bước 3 — Xem order và detail

```http
GET http://localhost:3000/api/v1/orders/<ORDER_ID>
Authorization: Bearer <USER_TOKEN>
```

Thay `<ORDER_ID>` bằng ID vừa ghi lại và dùng USER_TOKEN trong Authorization. Kiểm tra `createdAt`, hai detail có quantity `2`, `5`, `unitPrice` và tên sản phẩm.

### Bước 4 — Đăng nhập admin

Tạo shipment là quyền quản trị, nên cần admin token:

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json
```

```json
{ "username": "admin", "password": "Admin@123" }
```

Sao chép `data.accessToken` trong response và gọi giá trị này là **ADMIN_TOKEN**. Token này khác USER_TOKEN.

### Bước 5 — Chuyển đơn sang shipment

```http
POST http://localhost:3000/api/v1/shipments
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

```json
{ "orderId": 1, "status": "PENDING" }
```

Số `1` chỉ là ví dụ; thay bằng ORDER_ID thật. Mong đợi HTTP `201`; ghi lại `data.shipmentId` trong response làm **SHIPMENT_ID**.

Cập nhật trạng thái:

```http
PATCH http://localhost:3000/api/v1/shipments/<SHIPMENT_ID>/status
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

```json
{ "status": "PROCESSING" }
```

Trạng thái hợp lệ: `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`.

### Bước 6 — Hiển thị shipment

Gọi lại `GET http://localhost:3000/api/v1/orders/<ORDER_ID>` với USER_TOKEN. Mảng `data.shipments` chứa shipment và trạng thái mới nhất.

## 8. CLI: đối chiếu dữ liệu sau đặt hàng

```powershell
docker compose exec db psql -U ecommerce -d ecommerce_db
```

Thay `<ORDER_ID>` bằng `orderId` từ Postman:

```sql
-- Order thuộc đúng user, thời gian do database tạo
SELECT o.oid, o.uid, u.username, o.createdat
FROM orders o JOIN users u ON u.uid = o.uid
WHERE o.oid = <ORDER_ID>;

-- Đúng X × 2 và Y × 5, có giá tại lúc mua
SELECT od.oid, p.pid, p.pname, od.qty, od.unit_price
FROM order_details od JOIN products p ON p.pid = od.pid
WHERE od.oid = <ORDER_ID>
ORDER BY p.pid;

-- Tồn kho đã giảm
SELECT pid, pname, quantity
FROM products
WHERE pname IN ('Sản phẩm X', 'Sản phẩm Y')
ORDER BY pid;

-- Shipment liên kết đúng order
SELECT shipid, oid, status
FROM shipments
WHERE oid = <ORDER_ID>;
```

Sau đúng một lần đặt hàng: X còn `18`, Y còn `25`; detail có `2` và `5`; shipment có cùng `oid` và status cuối cùng.

Truy vấn tổng hợp để chụp minh chứng:

```sql
SELECT o.oid, u.username, o.createdat,
       p.pname, od.qty, od.unit_price, p.quantity AS stock_left,
       s.shipid, s.status
FROM orders o
JOIN users u ON u.uid = o.uid
JOIN order_details od ON od.oid = o.oid
JOIN products p ON p.pid = od.pid
LEFT JOIN shipments s ON s.oid = o.oid
WHERE o.oid = <ORDER_ID>
ORDER BY p.pid;
```

## 9. API endpoints

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| `GET` | `/health/live`, `/health/ready` | Public | Health check |
| `POST` | `/api/v1/auth/register` | Public | Đăng ký user NORMAL |
| `POST` | `/api/v1/auth/login` | Public | Nhận JWT |
| `GET` | `/api/v1/auth/me` | JWT | Xem role, membership, score |
| `GET` | `/api/v1/products`, `/products/:id` | Public | Xem sản phẩm |
| `POST/PATCH/DELETE` | `/api/v1/products...` | ADMIN | Quản trị sản phẩm |
| `POST` | `/api/v1/orders` | JWT | Tạo order, trừ tồn kho |
| `GET` | `/api/v1/orders`, `/orders/:id` | JWT | Xem order/detail/shipment |
| `POST` | `/api/v1/shipments` | ADMIN | Tạo shipment |
| `PATCH` | `/api/v1/shipments/:id/status` | ADMIN | Cập nhật shipment |

## 10. Dừng hoặc chạy lại demo

```powershell
docker compose down             # Dừng nhưng giữ database
docker compose down --volumes   # Xóa cả dữ liệu, chỉ dùng khi muốn reset
docker compose up --build -d    # Build và chạy lại
```

Tài khoản local/demo: `admin` / `Admin@123` (role `ADMIN`). Không dùng thông tin này trong production.
