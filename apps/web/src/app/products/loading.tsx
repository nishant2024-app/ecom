/** Shown instantly while a page's data loads: a grey grid shaped like the product list. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-8 md:px-6" role="status" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded-3 bg-paper-2" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-4 border border-rule">
            <div className="aspect-square animate-pulse bg-paper-2" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-1/3 animate-pulse rounded-3 bg-paper-2" />
              <div className="h-4 w-3/4 animate-pulse rounded-3 bg-paper-2" />
              <div className="h-12 animate-pulse rounded-pill bg-paper-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
