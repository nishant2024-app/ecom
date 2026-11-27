'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Pack } from './types';

export interface CartItem {
  variantId: string;
  quantity: number;
  /** Display copy so the drawer renders instantly; prices are always re-quoted by the server. */
  slug: string;
  name: string;
  packSize: string;
  pack: Pack;
  pricePaise: number;
}

interface Flight {
  id: number;
  pack: Pack;
  name: string;
  from: DOMRect;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (item: CartItem, from?: DOMRect | null) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  pincode: string;
  setPincode: (p: string) => void;
  /** Coupon code the customer applied; the server decides whether it works. */
  coupon: string;
  setCoupon: (code: string) => void;
  flights: Flight[];
  landed: (id: number) => void;
  bump: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const KEY = 'mulshi.cart.v1';
const PIN_KEY = 'mulshi.pincode';
const COUPON_KEY = 'mulshi.coupon';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [pincode, setPincodeState] = useState('');
  const [coupon, setCouponState] = useState('');
  const [open, setOpen] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [bump, setBump] = useState(0);
  const loaded = useRef(false);
  const flightId = useRef(0);

  useEffect(() => {
    setItems(read<CartItem[]>(KEY, []));
    setPincodeState(read<string>(PIN_KEY, ''));
    setCouponState(read<string>(COUPON_KEY, ''));
    loaded.current = true;
    const sync = (e: StorageEvent) => {
      if (e.key === KEY) setItems(read<CartItem[]>(KEY, []));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable: cart lives for this tab only */
    }
  }, [items]);

  const add = useCallback((item: CartItem, from?: DOMRect | null) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) return prev.map((i) => (i.variantId === item.variantId ? { ...i, quantity: Math.min(50, i.quantity + item.quantity) } : i));
      return [...prev, item];
    });
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (from && !reduce) {
      flightId.current += 1;
      setFlights((f) => [...f, { id: flightId.current, pack: item.pack, name: item.name, from }]);
    } else {
      setBump((b) => b + 1);
    }
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      open,
      setOpen,
      add,
      setQuantity: (variantId, quantity) => setItems((prev) => (quantity <= 0 ? prev.filter((i) => i.variantId !== variantId) : prev.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)))),
      remove: (variantId) => setItems((prev) => prev.filter((i) => i.variantId !== variantId)),
      clear: () => setItems([]),
      pincode,
      setPincode: (p) => {
        setPincodeState(p);
        try {
          localStorage.setItem(PIN_KEY, JSON.stringify(p));
        } catch {
          /* ignore */
        }
      },
      coupon,
      setCoupon: (code) => {
        const c = code.trim().toUpperCase();
        setCouponState(c);
        try {
          localStorage.setItem(COUPON_KEY, JSON.stringify(c));
        } catch {
          /* ignore */
        }
      },
      flights,
      landed: (id) => {
        setFlights((f) => f.filter((x) => x.id !== id));
        setBump((b) => b + 1);
      },
      bump,
    }),
    [items, open, add, pincode, coupon, flights, bump],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart outside CartProvider');
  return ctx;
}
