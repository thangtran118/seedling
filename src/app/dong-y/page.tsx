import type { Metadata } from "next";
import { Suspense } from "react";
import { consentAction } from "@/app/actions/auth";
import { LogoutButton } from "@/app/ui/logout-button";
import { requireUser } from "@/lib/access/current-user";
import { AuthCard } from "@/app/ui/form";

export const metadata: Metadata = { title: "Đồng ý xử lý dữ liệu · Seedling" };

// DRAFT notice. The final wording must be approved in the legal gate before real accounts are created
// (design doc, Dependencies).
export default function ConsentPage() {
  return (
    <AuthCard title="Thông báo xử lý dữ liệu" subtitle="Bản nháp, chờ duyệt pháp lý.">
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink">
        <p>
          Seedling lưu tên, số điện thoại của bạn và việc bạn thuộc khu vực này, để sắp xếp và ghi lại các ca trudo.
        </p>
        <p>
          Thông tin liên lạc của chiên chỉ hiển thị cho người đồng hành của họ. Mọi lần xem đều được ghi lại. Bạn không
          được chép thông tin này ra ngoài ứng dụng.
        </p>
        <p>Bạn có thể yêu cầu khu vực trưởng xóa tài khoản và dữ liệu của mình bất kỳ lúc nào.</p>
      </div>
      <Suspense fallback={null}>
        <ConsentActions />
      </Suspense>
    </AuthCard>
  );
}

async function ConsentActions() {
  await requireUser("consent");
  return (
    <div className="flex flex-col gap-3">
      <form action={consentAction}>
        <button type="submit" className="h-12 w-full rounded-lg bg-accent text-base font-semibold text-on-accent">
          Tôi đồng ý
        </button>
      </form>
      <LogoutButton className="h-12 w-full rounded-lg border border-line text-base text-muted">
        Không đồng ý và đăng xuất
      </LogoutButton>
    </div>
  );
}
