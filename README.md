# Seedling

Quản lý ca trudo và chiên. Thiết kế đã duyệt: `~/.gstack/projects/seedling/thangtc-unknown-design-20261018-125949.md`.

> **Chỉ dùng dữ liệu giả** cho tới khi qua cổng pháp lý (design doc, phần Dependencies): dữ liệu tôn giáo gắn với
> người thật là dữ liệu cá nhân nhạy cảm (NĐ 13/2023, Luật BVDLCN 2025). Văn bản ở `/dong-y` là bản nháp.

## Chạy local

```bash
cp .env.example .env
pnpm install
pnpm db:up        # Postgres 17 trong Docker (compose project "seedling-trudo", cổng 127.0.0.1:5433)
pnpm db:migrate
pnpm db:seed      # xóa sạch và nạp dữ liệu giả
pnpm dev
```

Tài khoản giả: khu vực trưởng `0900000001`, thánh đồ `0900000002`..`0900000005`, mật khẩu `seedling-dev`.

## Kiểm tra

```bash
pnpm lint         # gồm quy tắc: chỉ src/lib/access/ được import DB
pnpm typecheck
pnpm format
```

## Vận hành

```bash
pnpm admin bootstrap --area "Khu vực A" --name "Tên" --phone 09xxxxxxxx   # khu vực + khu vực trưởng đầu tiên
pnpm admin reset-leader --phone 09xxxxxxxx                                  # mở khóa / cấp lại mật khẩu
pnpm admin access-log --days 7                                              # ai đã xem dữ liệu riêng tư
```

Production (Vercel + Neon, 0 USD/tháng): xem **[DEPLOY.md](DEPLOY.md)**.

## Cấu trúc

- `src/db/` — schema Drizzle; bảng nhạy cảm nằm trong schema Postgres `private`.
- `src/lib/access/` — lớp truy cập dữ liệu duy nhất: phiên/đăng nhập, chiên, ca, thành viên, thống kê.
  Mọi hàm nhận người xem và tự kiểm quyền; dữ liệu riêng tư chỉ trả về kèm một dòng `pii_access_log`.
- `src/lib/domain.ts` — luật thuần (trạng thái hiển thị, mảnh kế tiếp, múi giờ), dùng được ở client.
- `src/app/` — Next.js 16 App Router, `cacheComponents` bật. Không cache dữ liệu theo phiên; mọi trang có dữ liệu đọc
  phiên sau `<Suspense>`. Đăng xuất tải lại toàn trang để xóa các trang Next giữ ẩn trong DOM.
- `public/sw.js` — service worker chỉ cache tài nguyên tĩnh, không bao giờ cache HTML/RSC.

## Trạng thái ca

Ca chỉ lưu "đã hẹn" hoặc "đã hủy"; trạng thái hiển thị tính theo giờ bắt đầu: **Chưa bắt đầu** → **Đang diễn ra**
(2 tiếng đầu) → **Hoàn thành** (tự động, không cần ghi kết quả). Ca bị hủy hiện **Đã hủy** và vẫn nằm trong lịch sử
của chiên. Mảnh của chiên sửa trực tiếp trên trang chiên.

## Luật quyền (tóm tắt)

|                                              | Thánh đồ được liên kết                                         | Thánh đồ không liên kết                    | Khu vực trưởng        |
| -------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ | --------------------- |
| Xem chiên: tên, tuổi, trạng thái, mảnh       | có                                                             | có                                         | có                    |
| Xem SĐT, MXH, quê, ghi chú                   | có (ghi log)                                                   | không                                      | có (ghi log)          |
| Xem lịch sử hẹn ca (ngày, trạng thái, ai đi) | có (ghi log)                                                   | chỉ khi đã/đang đi ca cùng chiên (ghi log) | có (ghi log)          |
| Sửa mảnh của chiên                           | có                                                             | không                                      | chỉ khi được liên kết |
| Đặt lịch trudo (hẹn ca)                      | phải đồng hành với tất cả chiên trong ca                       | không                                      | chỉ khi được liên kết |
| Sửa ca (khi chưa hoàn thành); sửa chiên      | có                                                             | không                                      | chỉ khi được liên kết |
| Hủy ca (khi chưa hoàn thành)                 | chỉ người tạo ca                                               | chỉ người tạo ca                           | chỉ người tạo ca      |
| Xóa ca                                       | không ai (chỉ hủy, dữ liệu giữ lại)                            |                                            |                       |
| Tham gia ca                                  | chỉ ca chưa bắt đầu hoặc đang diễn ra, không giới hạn số người |                                            |                       |
