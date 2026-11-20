/** Numbered section label in the catalog style: "02 / Daily milk". */
export function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="flex items-baseline gap-3 text-sm uppercase tracking-[0.12em] text-ink-2">
      <span className="num text-ink">{n}</span>
      <span aria-hidden className="h-px w-6 translate-y-[-3px] bg-ink-3" />
      <span>{children}</span>
    </p>
  );
}
