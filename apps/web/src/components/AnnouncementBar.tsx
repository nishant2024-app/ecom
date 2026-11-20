export function AnnouncementBar({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="bg-forest px-4 py-2 text-center text-[13px] font-medium text-on-forest">
      <p className="mx-auto max-w-[1320px]">{text}</p>
    </div>
  );
}
