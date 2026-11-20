export interface Money {
  amount: number;
  currency: 'INR';
}

export interface Variant {
  id: string;
  sku: string;
  packSize: string;
  price: Money;
  mrp: Money;
  subscriptionPrice: Money | null;
  bottleDeposit: Money;
  subscribable: boolean;
  available: boolean;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  category: { slug: string; name: string };
  image: { url: string; alt: string; width: number; height: number } | null;
  isVeg: boolean;
  attributes: { animal?: string; fatPercent?: number; snfPercent?: number; pasteurised?: boolean; a2?: boolean; sourceFarm?: string };
  fromPrice: Money;
  variants: Variant[];
}

export interface ProductDetail extends ProductSummary {
  description: string;
  shelfLifeDays: number;
  storage: string;
  packaging: string;
  hsnCode: string;
  fssaiNumber: string | null;
  nutrition: { label: string; per100: string }[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
}
