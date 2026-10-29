// Small tag on a card of another area.
export function AreaTag({ name }: { name: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-muted">
      {name}
    </span>
  );
}
