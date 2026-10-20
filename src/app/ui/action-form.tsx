"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type State = { error?: string; message?: string } | undefined;

// Small form bound to a (prevState, formData) server action, showing its error/message inline.
// Children are plain nodes (server components cannot pass render functions); use <PendingButton> inside.
export function ActionForm({
  action,
  hidden,
  children,
  className,
  confirm,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  hidden?: Record<string, string>;
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      {state?.error && (
        <p role="alert" className="mt-2 basis-full text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.message && <p className="mt-2 basis-full text-sm text-muted">{state.message}</p>}
    </form>
  );
}

export function PendingButton({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className ?? ""} disabled:opacity-60`}>
      {children}
    </button>
  );
}
