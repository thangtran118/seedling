"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { INPUT } from "./kit";

// Filters as you type (the URL's ?q follows after a short pause); still a plain GET form without JavaScript.
export function SearchBox({ placeholder, param = "q" }: { placeholder: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (value.trim()) next.set(param, value.trim());
      else next.delete(param);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(id);
    // params is read only when the typed value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <form role="search" className="relative md:max-w-xl" onSubmit={(e) => e.preventDefault()}>
      {[...params.entries()]
        .filter(([k]) => k !== param)
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <svg
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
      >
        <path
          d="M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12Zm4.5-1.5L17 17"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="search"
        name={param}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className={`${INPUT} h-11 w-full pl-10`}
      />
    </form>
  );
}
