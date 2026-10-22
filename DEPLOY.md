# Deploy Seedling lên AWS

Hướng dẫn đưa Seedling lên một máy **EC2** duy nhất, chạy bằng Docker:

```
Internet ──443/80──▶ Caddy (TLS tự động) ──▶ app (Next.js, :3000) ──▶ Postgres 17 (volume Docker)
```

- Domain: `seedling.tranchienthang.com`. Caddy tự xin và gia hạn chứng chỉ Let's Encrypt.
- Postgres chỉ nghe trên `127.0.0.1:5433` của server; muốn vào DB thì đi qua SSH tunnel.
- Migration tự chạy mỗi khi container app khởi động, nên DB trống sẽ có đủ bảng ngay lần chạy đầu.
- Prod **không có dữ liệu mẫu**: không chạy `pnpm db:seed` trên prod (lệnh này xóa sạch DB).

> **Lưu ý pháp lý.** README ghi: chỉ dùng dữ liệu giả cho tới khi qua cổng pháp lý. Dữ liệu tôn giáo gắn với người thật
> là dữ liệu cá nhân nhạy cảm (NĐ 13/2023, Luật BVDLCN 2025), và design doc dự định đặt server tại Việt Nam. Trước khi
> nhập dữ liệu thật lên AWS (ngoài Việt Nam), hãy chắc chắn phần này đã được xử lý.

## Các file liên quan

| File | Chạy ở đâu | Việc |
|---|---|---|
| `deploy/server-setup.sh` | server, một lần | Cài Docker, tạo swap 2 GB, đặt múi giờ, tạo `/opt/seedling` |
| `deploy/deploy.sh` | máy của bạn | Chép code lên server, build và khởi động lại app |
| `deploy/db-tunnel.sh` | máy của bạn | Mở SSH tunnel tới Postgres trên prod (`localhost:15432`) |
| `deploy/backup.sh` | server (cron) | Dump DB mỗi đêm vào `/opt/seedling/backups`, giữ 14 ngày, tùy chọn chép lên S3 |
| `deploy/Caddyfile` | (Docker) | Reverse proxy + HTTPS |
| `.env.production.example` | (mẫu) | Mẫu cho file `/opt/seedling/.env` trên server |

Máy của bạn cần có `ssh`, `rsync` và `git`.

## 1. Tạo máy EC2

Trong AWS Console → **EC2 → Launch instance**:

- **Region**: Asia Pacific (Singapore) `ap-southeast-1`, gần Việt Nam nhất.
- **AMI**: Ubuntu Server 24.04 LTS, kiến trúc **64-bit (Arm)**.
- **Instance type**: `t4g.small` (2 vCPU, 2 GB RAM), đủ cho một khu vực. Nếu build quá chậm thì dùng `t4g.medium`.
- **Key pair**: tạo mới hoặc chọn sẵn có, tải file `.pem` về (ví dụ `~/.ssh/seedling.pem`, `chmod 400`).
- **Storage**: 20 GB `gp3`.
- **Security group** (inbound):
  - SSH `22`: chỉ **My IP**.
  - HTTP `80`: `0.0.0.0/0` và `::/0` (Caddy cần cổng này để xin chứng chỉ và chuyển sang HTTPS).
  - HTTPS `443` (TCP và UDP): `0.0.0.0/0` và `::/0`.
  - **Không** mở cổng 5432/5433/3000.

Sau khi tạo: **EC2 → Elastic IPs → Allocate** rồi **Associate** với máy vừa tạo, để IP không đổi khi khởi động lại.

Cho tiện, thêm vào `~/.ssh/config` trên máy của bạn:

```
Host seedling
  HostName <ELASTIC_IP>
  User ubuntu
  IdentityFile ~/.ssh/seedling.pem
```

Từ đây, mọi lệnh dùng `seedling` thay cho `ubuntu@<ELASTIC_IP>`.

## 2. Trỏ domain

Tạo bản ghi DNS ở nơi đang quản lý `tranchienthang.com`:

| Loại | Tên | Giá trị | TTL |
|---|---|---|---|
| `A` | `seedling` | `<ELASTIC_IP>` | 300 |

- Nếu domain dùng **Route 53**: Hosted zones → `tranchienthang.com` → Create record.
- Nếu dùng **Cloudflare**: để chế độ **DNS only** (mây xám), để Caddy tự lo HTTPS.

Kiểm tra (đợi vài phút): `dig +short seedling.tranchienthang.com` phải ra đúng Elastic IP. **Phải trỏ DNS xong
trước khi deploy**, nếu không Caddy không xin được chứng chỉ.

## 3. Chuẩn bị server (một lần)

```bash
ssh seedling 'sudo bash -s' < deploy/server-setup.sh
```

Sau đó tạo file `.env` trên server:

```bash
ssh seedling
cat > /opt/seedling/.env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SITE_DOMAIN=seedling.tranchienthang.com
S3_BUCKET=
EOF
chmod 600 /opt/seedling/.env
cat /opt/seedling/.env   # lưu POSTGRES_PASSWORD vào trình quản lý mật khẩu của bạn
exit
```

- `POSTGRES_PASSWORD` chỉ dùng chữ và số (lệnh `openssl rand -hex` ở trên đã đảm bảo), vì nó được ghép vào URL kết nối.
- **Không đổi** `POSTGRES_PASSWORD` sau lần chạy đầu: Postgres chỉ đặt mật khẩu khi tạo volume lần đầu.

## 4. Deploy

Từ thư mục dự án trên máy của bạn:

```bash
deploy/deploy.sh seedling
```

Script chép code (bỏ qua `.git`, `node_modules`, `.next`, `.env`), rồi chạy `docker compose --profile prod up -d --build` trên
server. Lần đầu mất vài phút vì phải build image. Khi xong, mở **https://seedling.tranchienthang.com**: trang đăng nhập
phải hiện ra, có ổ khóa HTTPS.

Nếu chưa vào được, xem log:

```bash
ssh seedling 'cd /opt/seedling && docker compose --profile prod logs --tail 100 app caddy'
```

## 5. Nhập dữ liệu

DB trên prod trống hoàn toàn. Có hai cách, có thể kết hợp.

### Cách A (khuyên dùng): tạo khu vực trưởng bằng lệnh, phần còn lại làm trong app

```bash
ssh seedling 'cd /opt/seedling && docker compose --profile prod exec app pnpm admin bootstrap --area "Khu vực A" --name "Nguyễn Văn A" --phone 0912345678'
```

Lệnh in ra **mật khẩu tạm** (hết hạn sau 72 giờ). Khu vực trưởng đăng nhập, đổi mật khẩu và đồng ý điều khoản, rồi thêm
thánh đồ ở trang **Thành viên** và thêm chiên ở trang **Chiên**. Cách này tự đảm bảo mọi ràng buộc của dữ liệu.

### Cách B: thêm trực tiếp vào database

Mở tunnel (giữ cửa sổ này chạy):

```bash
deploy/db-tunnel.sh seedling
```

Rồi kết nối bằng DBeaver, TablePlus, `psql`... tới `localhost:15432`, user `seedling`, database `seedling`, mật khẩu là
`POSTGRES_PASSWORD`. Ví dụ với psql:

```bash
psql "postgres://seedling:<POSTGRES_PASSWORD>@localhost:15432/seedling"
```

Thứ tự thêm và các cột cần chú ý (mọi cột `id` đều tự sinh UUID, `created_at` mặc định là `now()`):

1. **`areas`**: khu vực.
2. **`users`**: thánh đồ / khu vực trưởng.
   - `phone`: dạng `0xxxxxxxxx`, 10 chữ số, không khoảng trắng.
   - `password_hash`: phải là hash **argon2**, không phải mật khẩu thô. Tạo hash bằng:
     ```bash
     ssh seedling "cd /opt/seedling && docker compose --profile prod exec -T app node -e \"require('@node-rs/argon2').hash(process.argv[1]).then(console.log)\" 'matkhautam123'"
     ```
   - `role`: `member` hoặc `area_leader`.
   - Nên đặt `must_change_password = true` và `temp_password_expires_at = now() + interval '72 hours'` để người dùng đổi
     mật khẩu ở lần đăng nhập đầu. Để `consented_at` trống: app sẽ hỏi đồng ý điều khoản khi đăng nhập.
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

## 6. Cập nhật phiên bản mới

```bash
git pull   # hoặc commit thay đổi của bạn
deploy/deploy.sh seedling
```

Migration mới (thư mục `drizzle/`) tự chạy khi app khởi động lại. Nên backup trước những lần cập nhật có migration (xem
mục 7).

## 7. Backup

Bật backup tự động lúc 2:30 sáng mỗi ngày (giờ Việt Nam):

```bash
ssh seedling
crontab -e
# thêm dòng:
30 2 * * * /opt/seedling/deploy/backup.sh >> /opt/seedling/backups/backup.log 2>&1
```

Chạy tay: `ssh seedling /opt/seedling/deploy/backup.sh`.

File dump chứa dữ liệu riêng tư của chiên (quyền `600`, thư mục `700`). Đừng để nó ở nơi công khai.

**Chép lên S3 (nên làm):** nếu ổ đĩa EC2 hỏng thì backup nằm trên chính máy đó cũng mất.

1. Tạo bucket riêng tư, ví dụ `seedling-backups-<tên-bạn>`. Block all public access phải bật, và nên bật lifecycle xóa
   file sau 30 ngày.
2. Tạo IAM role cho EC2, chỉ có quyền `s3:PutObject` trên bucket đó. Gắn role vào máy: EC2 → Actions → Security → Modify
   IAM role.
3. Trên server: `sudo snap install aws-cli --classic`, rồi điền `S3_BUCKET=<tên bucket>` vào `/opt/seedling/.env`.

**Khôi phục từ một file dump** (ghi đè dữ liệu hiện tại):

```bash
ssh seedling
cd /opt/seedling
docker compose --profile prod stop app
docker compose exec -T db pg_restore -U seedling -d seedling --clean --if-exists < backups/seedling-YYYY-MM-DD-HHMM.dump
docker compose --profile prod start app
```

## 8. Lệnh hay dùng (chạy trên server, trong `/opt/seedling`)

```bash
docker compose --profile prod ps                       # trạng thái các container
docker compose --profile prod logs -f app              # log app
docker compose --profile prod restart app              # khởi động lại app
docker compose exec db psql -U seedling seedling       # mở psql ngay trên server
docker compose --profile prod exec app pnpm admin reset-leader --phone 09xxxxxxxx   # cấp lại mật khẩu, mở khóa
docker compose --profile prod exec app pnpm admin access-log --days 7              # ai đã xem dữ liệu riêng tư
```

## 9. Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Trình duyệt báo lỗi chứng chỉ, log Caddy có `challenge failed` | DNS chưa trỏ đúng Elastic IP, hoặc security group chưa mở cổng 80/443. Sửa xong thì `docker compose --profile prod restart caddy`. |
| Đăng nhập xong vẫn bị đưa về trang login | Đang vào bằng `http://` hoặc bằng IP. Cookie chỉ gửi qua HTTPS, nên luôn dùng `https://seedling.tranchienthang.com`. |
| Build bị dừng giữa chừng (`Killed`, exit 137) | Thiếu RAM. Kiểm tra swap bằng `swapon --show`, hoặc nâng lên `t4g.medium`. |
| App báo `password authentication failed` | Đã đổi `POSTGRES_PASSWORD` sau khi DB được tạo. Đặt lại giá trị cũ, hoặc đổi mật khẩu trong Postgres: `ALTER USER seedling PASSWORD '...'`. |
| `deploy.sh` báo thiếu `.env` | Làm lại bước tạo `/opt/seedling/.env` ở mục 3. |

## Chi phí ước tính (Singapore)

`t4g.small` khoảng 15 USD/tháng, 20 GB gp3 khoảng 2 USD/tháng. Elastic IP gắn vào máy đang chạy tính phí IPv4 khoảng
3.6 USD/tháng. S3 cho backup không đáng kể.
