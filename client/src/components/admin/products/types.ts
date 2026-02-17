import type { Category } from "@/components/admin/categories/types";
import type { Campaign } from "@/components/admin/campaigns/types";

export type PriceSlab = {
  minQty: number;   // minimum quantity for this price to apply
  maxQty: number | null; // null => open-ended (∞)
  price: string;    // price (same format as Product.price)
};

export type Product = {
  id: string;
  name: string;
  price: string;
  images: string[];
  colors: string[];
  stock: number;
  packagesInclude: string[];
  specifications: Record<string, string> | string;
  sku: string;
  isActive: boolean;
  backupProductId: string | null;
  csrSupport: boolean;
  createdAt: string;
  categoryIds: string[];
  categories?: Category[];
  category?: Category | null;
  isBackup?: boolean;
  originalProductId?: string | null;
  campaigns?: Campaign[];

  // ✅ NEW
  priceSlabs?: PriceSlab[];
  bulkBuy?: boolean;

  // ✅ NEW: Extra fields
  gst?: string;
  stockStatus?: "committed" | "non_committed";
  brandStore?: boolean;
  brand?: string;
  sizes?: { unit: string; values: string[] } | null;
};
