const FACTS = ['Bilona A2 ghee', 'Spray-dried within hours', 'UHT milk keeps 6 months', 'FSSAI licensed', 'Batch code on every pack', 'Free shipping over ₹499 in Pune', 'Ships across India', 'Pay by UPI or card'];

/** Endless strip of facts. Pauses on hover; static for reduced motion. */
export function Marquee() {
  const row = [...FACTS, ...FACTS];
  return (
    <div className="mx-3 mt-6 overflow-hidden rounded-pill bg-meadow py-3 md:mx-6" aria-label={FACTS.join(', ')}>
      <div className="marquee flex w-max gap-10 whitespace-nowrap hover:[animation-play-state:paused]" aria-hidden>
        {row.map((f, i) => (
          <span key={i} className="flex items-center gap-10 text-lg">
            {f}
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <circle cx="5" cy="5" r="4" fill="var(--forest)" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
