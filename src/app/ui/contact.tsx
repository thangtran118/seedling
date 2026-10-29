// Private contact fields of a listener, shown only to people allowed to see them (the caller passes them in).
import type { ListenerPrivateFields } from "@/lib/access/listeners";

const FIELDS = [
  ["phone", "SĐT"],
  ["zalo", "Zalo"],
  ["facebook", "Facebook"],
  ["telegram", "Telegram"],
  ["hometown", "Quê quán"],
] as const;

const linkCls = "break-all text-accent underline underline-offset-2";

// Plain text with http(s) links made clickable (people paste profile links into the contact fields).
export function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={linkCls}>
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

// A Zalo entry is usually a phone number: open the chat directly.
function ZaloValue({ value }: { value: string }) {
  const digits = value.replace(/[\s.-]/g, "");
  if (/^\+?\d{9,12}$/.test(digits)) {
    return (
      <a
        href={`https://zalo.me/${digits.replace(/^\+84/, "0")}`}
        target="_blank"
        rel="noopener noreferrer"
        className={linkCls}
      >
        {value}
      </a>
    );
  }
  return <Linkified text={value} />;
}

// Filled fields only; one line each, label left, value right. Phone and Zalo open the call / chat.
export function ContactList({ p }: { p: ListenerPrivateFields }) {
  const filled = FIELDS.filter(([k]) => p[k]);
  if (filled.length === 0) return <p className="text-sm text-muted">Chưa có thông tin liên hệ.</p>;
  return (
    <dl className="flex flex-col gap-2 text-sm">
      {filled.map(([k, label]) => (
        <div key={k} className="flex min-h-6 items-baseline justify-between gap-3">
          <dt className="shrink-0 text-muted">{label}</dt>
          <dd className="min-w-0 text-right font-medium text-ink">
            {k === "phone" ? (
              <a href={`tel:${p.phone}`} className={linkCls}>
                {p.phone}
              </a>
            ) : k === "zalo" ? (
              <ZaloValue value={p.zalo!} />
            ) : (
              <Linkified text={p[k]!} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
