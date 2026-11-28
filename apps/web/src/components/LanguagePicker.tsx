'use client';

import { useEffect, useId, useState } from 'react';

/**
 * Lets visitors read the shop in their own language with Google's website translator.
 * The translation happens in the visitor's browser: nothing is stored in our database, and Google's script
 * is only loaded after someone picks a language (or already did on an earlier visit).
 *
 * Google has announced it no longer supports this widget (October 2026). It still works today, so this is
 * built to fail softly: if the script cannot load or does not respond, we say so and point to the browser's
 * own "Translate this page" option instead of leaving a dead control on the page.
 */
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
] as const;
const INCLUDED = LANGUAGES.filter((l) => l.code !== 'en')
  .map((l) => l.code)
  .join(',');

/** Google's script puts `google.translate` on the page. Typed here, not globally, because Google sign-in also owns `window.google`. */
type TranslateGlobals = Window & { google?: { translate?: { TranslateElement: new (options: object, elementId: string) => unknown } }; googleTranslateElementInit?: () => void };
const g = () => window as TranslateGlobals;

const TARGET_ID = 'google_translate_element';
const CHANGED = 'shop-language-changed';

/** The language Google is already translating to, read from its cookie ("/en/hi"). */
function currentLanguage(): string {
  const m = /(?:^|;\s*)googtrans=\/[^/]*\/([a-zA-Z-]+)/.exec(document.cookie);
  return m && LANGUAGES.some((l) => l.code === m[1]) ? m[1]! : 'en';
}

function forgetLanguage() {
  const host = location.hostname;
  for (const domain of ['', `; domain=${host}`, `; domain=.${host}`]) document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domain}`;
}

/**
 * Google's script rewrites text nodes while React still holds references to them. These two guards make React
 * skip a stale node instead of throwing (a known incompatibility). Applied once, only when translation is used.
 */
let patched = false;
function protectReact() {
  if (patched) return;
  patched = true;
  const remove = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return remove.call(this, child) as T;
  };
  const insert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return node;
    return insert.call(this, node, ref) as T;
  };
}

let loading: Promise<void> | null = null;
function loadTranslator(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    protectReact();
    const giveUp = setTimeout(() => reject(new Error('timeout')), 12000);
    g().googleTranslateElementInit = () => {
      clearTimeout(giveUp);
      try {
        new (g().google!.translate!.TranslateElement)({ pageLanguage: 'en', includedLanguages: INCLUDED, autoDisplay: false }, TARGET_ID);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    const s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    s.onerror = () => {
      clearTimeout(giveUp);
      reject(new Error('blocked'));
    };
    document.head.appendChild(s);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** Google creates its dropdown first and fills in the languages a moment later, so wait until this language is in it. */
function waitForLanguage(code: string): Promise<HTMLSelectElement> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const look = () => {
      const el = document.querySelector<HTMLSelectElement>('select.goog-te-combo');
      if (el && [...el.options].some((o) => o.value === code)) return resolve(el);
      if (Date.now() - started > 8000) return reject(new Error('no response'));
      setTimeout(look, 150);
    };
    look();
  });
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  );
}

/**
 * Render once on every page (the header does). It holds the invisible place Google's script needs, and brings
 * back the language a visitor chose earlier. Visitors who never chose one load nothing from Google.
 */
export function TranslateHost() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (currentLanguage() !== 'en') void loadTranslator().catch(() => setFailed(true));
  }, []);
  return (
    <>
      <div id={TARGET_ID} className="sr-only" aria-hidden="true" translate="no" />
      {failed && (
        <p
          role="alert"
          className="notranslate fixed bottom-24 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-3 bg-ink px-4 py-3 text-[13px] leading-snug text-paper shadow-float md:bottom-6"
          translate="no"
        >
          Translation is not available right now. You can use your browser instead: in Chrome, right-click the page and choose “Translate to…”.
          <button type="button" onClick={() => setFailed(false)} className="ml-2 underline">
            Close
          </button>
        </p>
      )}
    </>
  );
}

export function LanguagePicker({ className = '' }: { className?: string }) {
  const id = useId();
  const [lang, setLang] = useState('en');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    // The other picker (header or footer) tells us what was chosen; Google's cookie can lag behind by a moment.
    const sync = (e?: Event) => setLang((e as CustomEvent<string> | undefined)?.detail ?? currentLanguage());
    sync();
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, []);

  async function choose(code: string) {
    if (code === 'en') {
      forgetLanguage();
      location.reload(); // the clean way back to the original text
      return;
    }
    setStatus('loading');
    try {
      await loadTranslator();
      const select = await waitForLanguage(code);
      select.value = code;
      select.dispatchEvent(new Event('change'));
      setLang(code);
      setStatus('idle');
      window.dispatchEvent(new CustomEvent(CHANGED, { detail: code }));
    } catch {
      setStatus('error');
      setLang(currentLanguage());
    }
  }

  return (
    <div className={`relative notranslate ${className}`} translate="no">
      <label htmlFor={id} className="sr-only">
        Language
      </label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-2">
        <GlobeIcon />
      </span>
      <select
        id={id}
        value={lang}
        onChange={(e) => void choose(e.target.value)}
        disabled={status === 'loading'}
        className="h-10 cursor-pointer appearance-none rounded-pill border border-rule bg-paper pl-9 pr-8 text-[14px] text-ink hover:bg-paper-2 disabled:opacity-60"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2" aria-hidden="true">
        ▾
      </span>
      {status === 'loading' && (
        <p role="status" className="absolute right-0 top-12 z-50 w-56 rounded-3 bg-ink px-3 py-2 text-[13px] text-paper shadow-float">
          Translating…
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="absolute right-0 top-12 z-50 w-72 rounded-3 bg-ink px-3 py-2 text-[13px] leading-snug text-paper shadow-float">
          Translation is not available right now. You can use your browser instead: in Chrome, right-click the page and choose “Translate to…”.
          <button type="button" onClick={() => setStatus('idle')} className="ml-2 underline">
            Close
          </button>
        </p>
      )}
    </div>
  );
}
