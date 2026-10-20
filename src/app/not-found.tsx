import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-bold text-ink">Không tìm thấy</h1>
      <p className="text-sm text-muted">Trang này không tồn tại hoặc bạn không có quyền xem.</p>
      <Link href="/" className="text-accent underline">
        Về trang chủ
      </Link>
    </main>
  );
}
