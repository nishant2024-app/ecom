'use client';

/** Last resort: the layout itself crashed. Plain markup only, with no shared components. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center', padding: 24 }}>
        <main>
          <h1 style={{ fontSize: 32, margin: 0 }}>We&rsquo;ll be right back</h1>
          <p style={{ color: '#4a574f', marginTop: 12 }}>The shop hit a problem. Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, height: 48, padding: '0 24px', borderRadius: 999, border: 0, background: '#146f36', color: '#fff', fontWeight: 600, fontSize: 16 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
