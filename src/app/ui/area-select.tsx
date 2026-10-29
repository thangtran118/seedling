"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { INPUT } from "./kit";

// One-line area picker: a native select, so it fits any number of areas and opens the phone's own picker. Picking
// navigates to that option's link (the server works out each link, keeping the page's other filters).
export function AreaSelect({
  options,
  value,
  label = "Khu vực",
}: {
  options: { value: string; label: string; href: string }[];
  value: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-3 md:max-w-xl">
      <span className="shrink-0 text-sm font-semibold text-ink">{label}</span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const href = options.find((o) => o.value === e.target.value)?.href;
          if (href) startTransition(() => router.push(href, { scroll: false }));
        }}
        className={`${INPUT} h-11 min-w-0 flex-1 cursor-pointer disabled:opacity-60`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
