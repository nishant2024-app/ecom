export interface Money {
  amount: number;
  currency: 'INR';
}

export interface Pack {
  kind: string;
  color: string;
  accent: string;
}

export interface Variant {
  id: string;
  sku: string;
  packSize: string;
  price: Money;
  mrp: Money;
  weightGrams: number;
  shelfLifeDays: number;
  inStock: boolean;
  lowStock: boolean;
  maxPerOrder: number;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: { slug: string; name: string };
  pack: Pack;
  image: { url: string; alt: string; width: number; height: number } | null;
  isVeg: boolean;
  featured: boolean;
  attributes: { animal?: string; fatPercent?: number; a2?: boolean; process?: string; sourceFarm?: string; ingredients?: string };
  fromPrice: Money;
  variants: Variant[];
}

export interface ProductDetail extends ProductSummary {
  description: string;
  storage: string;
  hsnCode: string;
  fssaiNumber: string | null;
  nutrition: { label: string; per100: string }[];
  related: ProductSummary[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  productCount: number;
  packs: Pack[];
}

export interface ShippingInfo {
  zone: string;
  fee: Money;
  free: boolean;
  remainingForFree: Money;
  etaMinDays: number;
  etaMaxDays: number;
  earliest: string;
  latest: string;
}

export interface Quote {
  lines: { variantId: string; slug: string; name: string; packSize: string; pack: Pack; quantity: number; unitPrice: Money; mrp: Money; total: Money; maxQuantity: number; problem: string | null }[];
  subtotal: Money;
  taxIncluded: Money;
  weightGrams: number;
  shipping: ShippingInfo | null;
  shippingError: string | null;
  total: Money;
  ok: boolean;
}

export interface Address {
  id: string;
  label: string | null;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface PaymentStart {
  id: string;
  provider: 'cashfree' | 'mock';
  environment: 'sandbox' | 'production' | 'mock';
  paymentSessionId: string | null;
  mockCheckoutPath: string | null;
}

export interface Order {
  id: string;
  number: string;
  status: 'pending_payment' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  placedAt: string;
  expiresAt: string | null;
  items: { id: string; variantId: string; slug: string; name: string; packSize: string; pack: Pack; quantity: number; unitPrice: Money; total: Money }[];
  subtotal: Money;
  shipping: Money;
  taxIncluded: Money;
  total: Money;
  shippingAddress: { name: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string };
  delivery: { zone: string; etaMinDays: number; etaMaxDays: number; courier: string | null; trackingNumber: string | null; trackingUrl: string | null };
  timeline: { placedAt: string; paidAt: string | null; packedAt: string | null; shippedAt: string | null; deliveredAt: string | null; cancelledAt: string | null };
  cancelReason: string | null;
  canCancel?: boolean;
  payment: (Partial<PaymentStart> & { id: string; status: string; method: string | null }) | null;
  refunds: { id: string; amount: Money; status: string; reason: string }[];
}
