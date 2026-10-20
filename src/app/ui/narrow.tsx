import type { ReactNode } from "react";

// Form and detail screens stay phone-width on large screens; long inputs read badly at dashboard width.
export function Narrow({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-xl flex-col gap-5">{children}</div>;
}
