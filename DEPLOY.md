# Deploy Seedling lên Vercel + Neon

Chi phí: **0 USD/tháng** (Vercel Hobby + Neon Free).

```
Trình duyệt ──HTTPS──▶ Vercel (Next.js, region sin1 Singapore) ──▶ Neon Postgres 17 (AWS Singapore)
```

- Domain `seedling.tranchienthang.com`: Vercel tự cấp và gia hạn chứng chỉ HTTPS.
- Migration tự chạy mỗi lần deploy **production** (`pnpm vercel-build` trong `vercel.json`), trước bước build.
- Không có backup. Neon Free vẫn cho khôi phục về thời điểm trong vài giờ gần nhất, xem mục 7.
- Prod **không có dữ liệu mẫu**. `pnpm db:seed` từ chối chạy vào DB không phải local.

> **Lưu ý pháp lý.** README ghi: chỉ dùng dữ liệu giả cho tới khi qua cổng pháp lý. Dữ liệu tôn giáo gắn với người thật
> là dữ liệu cá nhân nhạy cảm (NĐ 13/2023, Luật BVDLCN 2025), và design doc dự định đặt server tại Việt Nam. Trước khi
> nhập dữ liệu thật lên Vercel/Neon (Singapore), hãy chắc chắn phần này đã được xử lý.

**Giới hạn của gói free** (đủ cho một khu vực):

- Neon Free: 0.5 GB dữ liệu. DB tự ngủ sau 5 phút không có truy vấn, nên lần mở app đầu tiên sau đó chậm thêm khoảng 0.5–1 giây.
- Vercel Hobby: chỉ cho dùng phi thương mại.

## 1. Tạo database trên Neon

1. Đăng ký tại https://neon.com, chọn gói **Free**.
2. **Create project**:
   - Postgres version: **17**.
   - Region: **AWS Asia Pacific (Singapore)**. Phải cùng Singapore với Vercel, nếu không mỗi truy vấn chậm thêm vài trăm ms.
   - Database name: `seedling`.
3. Vào **Connect**, lấy hai chuỗi kết nối:
   - Bật **Connection pooling**: URL có `-pooler` trong host. Đây là `DATABASE_URL`, app dùng chuỗi này.
   - Tắt **Connection pooling**: URL kết nối thẳng. Đây là `DATABASE_URL_UNPOOLED`, migration và lệnh admin dùng chuỗi này.

   Cả hai đều có `?sslmode=require`; giữ nguyên. Lưu chúng vào trình quản lý mật khẩu.

## 2. Tạo project trên Vercel

1. Đẩy code lên GitHub (nhánh `develop` hiện tại hoặc nhánh bạn muốn chạy production).
2. Vào https://vercel.com, gói **Hobby** → **Add New → Project**, chọn repo `seedling`. Vercel tự nhận Next.js và pnpm.
3. **Settings → Git → Production Branch**: đặt đúng nhánh deploy (ví dụ `develop`).
4. **Settings → Environment Variables**: thêm hai biến, **chỉ tick Production**:

   | Tên | Giá trị |
   |---|---|
   | `DATABASE_URL` | URL pooled của Neon |
   | `DATABASE_URL_UNPOOLED` | URL kết nối thẳng của Neon |

5. **Settings → Build and Deployment → Ignored Build Step**: chọn **Only build production**. Preview không có DB nên
   build sẽ lỗi, và cũng không được để preview dùng chung DB thật.
6. Deploy (bấm **Deploy** hoặc push lên nhánh production). Log build phải có dòng `drizzle-kit migrate` chạy xong
   trước `next build`.

`vercel.json` đã đặt region function là `sin1` (Singapore) và Node 24 (trong `package.json`), không cần chỉnh trong
dashboard. Kiểm tra lại ở **Settings → Functions → Function Region** nếu muốn.

## 3. Trỏ domain

1. Vercel → project → **Settings → Domains → Add**: `seedling.tranchienthang.com`.
2. Vercel hiện bản ghi cần tạo, thường là `CNAME` `seedling` → `<giá trị Vercel đưa>`. Tạo đúng bản ghi đó ở nơi quản lý
   `tranchienthang.com`. Nếu dùng Cloudflare thì để **DNS only** (mây xám).
3. Đợi vài phút tới khi Vercel báo **Valid Configuration**. Mở **https://seedling.tranchienthang.com**: trang đăng nhập
   phải hiện ra, có ổ khóa HTTPS.

## 4. Nhập dữ liệu

DB trên prod trống hoàn toàn. Các lệnh admin chạy **từ máy bạn**, trỏ thẳng tới Neon bằng URL kết nối thẳng. Biến môi
trường đặt trên dòng lệnh được ưu tiên hơn file `.env`, nên `.env` local vẫn giữ trỏ về Docker.

Nên lưu URL vào biến shell trong phiên làm việc, đừng ghi vào file:

```bash
export NEON_URL='postgresql://...neon.tech/seedling?sslmode=require'   # URL kết nối thẳng (không -pooler)
```

### Cách A (khuyên dùng): tạo khu vực trưởng bằng lệnh, phần còn lại làm trong app

```bash
DATABASE_URL="$NEON_URL" pnpm admin bootstrap --area "Khu vực A" --name "Nguyễn Văn A" --phone 0912345678
```

Lệnh in ra **mật khẩu tạm** (hết hạn sau 72 giờ). Khu vực trưởng đăng nhập, đặt mật khẩu mới, rồi thêm
thánh đồ ở trang **Thành viên** và thêm chiên ở trang **Chiên**. Cách này tự đảm bảo mọi ràng buộc của dữ liệu.

### Cách B: thêm trực tiếp vào database

Dùng **SQL Editor** trong Neon Console, hoặc kết nối DBeaver, TablePlus, `psql`... bằng URL kết nối thẳng:

```bash
psql "$NEON_URL"
```

Thứ tự thêm và các cột cần chú ý (mọi cột `id` đều tự sinh UUID, `created_at` mặc định là `now()`):

1. **`areas`**: khu vực.
2. **`users`**: thánh đồ / khu vực trưởng.
   - `phone`: dạng `0xxxxxxxxx`, 10 chữ số, không khoảng trắng.
   - `password_hash`: phải là hash **argon2**, không phải mật khẩu thô. Tạo hash ngay trong thư mục dự án:
     ```bash
     node -e "require('@node-rs/argon2').hash(process.argv[1]).then(console.log)" 'matkhautam123'
     ```
   - `role`: `member` hoặc `area_leader`.
   - Nên đặt `must_change_password = true` và `temp_password_expires_at = now() + interval '72 hours'` để người dùng đổi
     mật khẩu ở lần đăng nhập đầu.
3. **`listeners`**: chiên.
   - `manual_status`: `moi_quen`, `goi_mo`, `baptem` hoặc `tu_choi`.
   - `lessons_reached`: mảnh đã đến, từ `0` đến `7`.
   - `created_by`: id của một user.
   - Cột thời gian dùng cho thống kê:
     - `created_at`: ngày bắt đầu biết chiên này. Quyết định "chiên mới tháng này" và lịch sử theo tháng.
     - `first_lesson_at`: **bắt buộc điền** nếu `lessons_reached > 0`. Là ngày nghe mảnh 1.
     - `baptized_at`: **bắt buộc điền** nếu `manual_status = 'baptem'`.
4. **`listener_links`**: người đồng hành (`listener_id`, `user_id`, `added_by`). **Mỗi chiên cần ít nhất một dòng ở
   đây**, nếu không thì không thánh đồ nào thấy hay sửa được chiên đó.
5. **`private.listener_private`** (không bắt buộc): SĐT, quê quán, Facebook, Zalo, Telegram, ghi chú của chiên.

Ví dụ:

```sql
BEGIN;
INSERT INTO areas (name) VALUES ('Khu vực A') RETURNING id;   -- ghi lại id
INSERT INTO users (phone, password_hash, name, area_id, role, must_change_password, temp_password_expires_at)
VALUES ('0912345678', '<HASH>', 'Nguyễn Văn A', '<AREA_ID>', 'area_leader', true, now() + interval '72 hours')
RETURNING id;                                                  -- ghi lại id
INSERT INTO listeners (area_id, name, birth_year, manual_status, lessons_reached, first_lesson_at, created_by, created_at)
VALUES ('<AREA_ID>', 'Trần Thị B', 1998, 'goi_mo', 3, '2026-09-15', '<USER_ID>', '2026-08-01')
RETURNING id;                                                  -- ghi lại id
INSERT INTO listener_links (listener_id, user_id, added_by) VALUES ('<LISTENER_ID>', '<USER_ID>', '<USER_ID>');
INSERT INTO private.listener_private (listener_id, phone, hometown) VALUES ('<LISTENER_ID>', '0987654321', 'Huế');
COMMIT;
```

Ca trudo (`sessions`, `session_members`, `session_listeners`) nên tạo trong app. Ca chỉ có trạng thái `planned` hoặc
`cancelled`; ca `planned` đã qua giờ bắt đầu hơn 2 tiếng sẽ tự tính là hoàn thành.

## 5. Cập nhật phiên bản mới

Push lên nhánh production. Vercel tự build và deploy; migration mới trong `drizzle/` chạy trước bước build. Nếu migration
lỗi thì build dừng và bản đang chạy giữ nguyên.

Muốn quay về bản cũ: Vercel → **Deployments** → chọn bản trước → **Promote to Production**. Lưu ý việc này không hoàn tác
migration đã chạy trên DB.

## 6. Lệnh hay dùng (chạy trên máy bạn)

```bash
DATABASE_URL="$NEON_URL" pnpm admin reset-leader --phone 09xxxxxxxx   # cấp lại mật khẩu, mở khóa
DATABASE_URL="$NEON_URL" pnpm admin access-log --days 7              # ai đã xem dữ liệu riêng tư
DATABASE_URL="$NEON_URL" pnpm db:migrate                             # chạy migration bằng tay
psql "$NEON_URL"                                                     # mở psql
```

Log app: Vercel → project → **Logs**.

## 7. Khôi phục khi lỡ tay

Không có backup định kỳ. Neon Free giữ lịch sử thay đổi trong một khoảng ngắn (vài giờ, xem **Settings → Instant
restore** trong Neon Console). Nếu vừa xóa nhầm dữ liệu, vào **Backup & Restore** của branch `main` và khôi phục về thời
điểm trước khi xóa. Quá khoảng đó thì không lấy lại được.

## 8. Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Build lỗi `DATABASE_URL is not set` | Chưa thêm biến môi trường cho Production, hoặc đang build preview (bật **Only build production**, mục 2). |
| Build lỗi ở bước `drizzle-kit migrate` | Thiếu hoặc sai `DATABASE_URL_UNPOOLED`. Migration cần URL kết nối thẳng, không phải URL `-pooler`. |
| App báo `prepared statement ... does not exist` | `src/db/index.ts` phải giữ `prepare: false` khi dùng URL pooled. |
| Trang chậm vài giây ở lần mở đầu | Neon đang thức dậy sau khi ngủ, hoặc function đặt sai region. Kiểm tra Function Region là `sin1` và Neon ở Singapore. |
| Đăng nhập xong vẫn bị đưa về trang login | Đang vào bằng `http://` hoặc domain `*.vercel.app` cũ. Cookie chỉ gửi qua HTTPS, nên luôn dùng `https://seedling.tranchienthang.com`. |
| `pnpm db:seed` báo `refusing to wipe a non-local database` | Đúng như mong muốn: seed xóa sạch DB, chỉ được chạy vào Postgres local. |
