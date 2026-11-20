/** FSSAI vegetarian mark: green square with a green dot. */
export function VegMark({ label = 'Vegetarian' }: { label?: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex h-4 w-4 shrink-0 items-center justify-center border-[1.5px] border-veg">
      <span className="h-2 w-2 rounded-pill bg-veg" />
    </span>
  );
}
