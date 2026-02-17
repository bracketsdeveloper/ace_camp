// src/components/product/product-detail-modal.tsx
import { memo, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCarousel } from "./product-carousel";
import { X, ShoppingCart, CheckCircle, Plus, Minus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  selectedColor: string;
  onColorChange: (color: string) => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  onAddToCart: (product: any, color: string | null, quantity: number, size?: string | null) => void;
}

function _ProductDetailModal({
  isOpen,
  onClose,
  product,
  selectedColor,
  onColorChange,
  quantity,
  onQuantityChange,
  onAddToCart,
}: ProductDetailModalProps) {
  const { toast } = useToast();
  const [localSelectedSize, setLocalSelectedSize] = useState<string | null>(null);

  if (!product) return null;

  const { data: branding } = useQuery<any>({
    queryKey: ["/api/admin/branding"],
  });

  const inrPerPoint = parseFloat(branding?.inrPerPoint || "1");

  // =========================================================
  // ✅ Slab helpers (UPDATED)
  // slab format: { minQty: number; maxQty: number | null; price: string }
  // price = UNIT price for quantities in [minQty, maxQty]
  // =========================================================
  const getUnitPriceForQty = (prod: any, qty: number): number => {
    const base = Number(prod?.price);
    const safeBase = Number.isFinite(base) ? base : 0;

    const slabs = Array.isArray(prod?.priceSlabs) ? prod.priceSlabs : [];
    if (!slabs.length) return safeBase;

    const q = Math.max(1, Number(qty) || 1);

    const matchedSlab = slabs.find((s: any) => {
      const min = Number(s?.minQty);
      const max =
        s?.maxQty === null || s?.maxQty === undefined ? Number.POSITIVE_INFINITY : Number(s?.maxQty);

      if (!Number.isFinite(min) || min <= 0) return false;
      if (!Number.isFinite(max)) return false;

      return q >= min && q <= max;
    });

    if (!matchedSlab) return safeBase;

    const n = Number(matchedSlab?.price);
    return Number.isFinite(n) && n >= 0 ? n : safeBase;
  };

  const clampQty = (q: number) => {
    const stock = Number(product?.stock ?? 0);
    const safeStock = Number.isFinite(stock) ? stock : 0;
    const next = Number.isFinite(q) ? q : 1;
    return Math.max(1, Math.min(next, Math.max(1, safeStock)));
  };

  // ✅ current unit price depends on selected quantity slab
  const unitPriceInr = useMemo(() => {
    return getUnitPriceForQty(product, quantity);
  }, [product, quantity]);

  // ✅ show per-unit points (matches cart + backend)
  const pointsRequired = useMemo(() => {
    return Math.ceil(unitPriceInr / inrPerPoint);
  }, [unitPriceInr, inrPerPoint]);

  const linePriceInr = useMemo(() => {
    const q = Math.max(1, Number(quantity) || 1);
    return unitPriceInr * q;
  }, [unitPriceInr, quantity]);

  const linePoints = useMemo(() => {
    return Math.ceil(linePriceInr / inrPerPoint);
  }, [linePriceInr, inrPerPoint]);

  const gstPercent = parseFloat(product.gst || "0");
  const gstAmount = linePriceInr * (gstPercent / 100);
  const totalAmount = linePriceInr + gstAmount;

  // Helper function to normalize specifications data
  const normalizeSpecifications = useMemo(() => {
    if (!product.specifications) return null;

    if (typeof product.specifications === "string") {
      return product.specifications.trim();
    }

    if (Array.isArray(product.specifications)) {
      return product.specifications.join("").trim();
    }

    if (typeof product.specifications === "object" && product.specifications !== null) {
      return Object.entries(product.specifications)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")
        .trim();
    }

    return null;
  }, [product.specifications]);

  const hasSpecifications = normalizeSpecifications && normalizeSpecifications.length > 0;

  useEffect(() => {
    if (!isOpen || !product) {
      setLocalSelectedSize(null);
      return;
    }

    // Reset size selection when product changes
    setLocalSelectedSize(null);

    const first = product.colors?.[0] || "";
    if (first && selectedColor !== first) {
      onColorChange(first);
    }
  }, [isOpen, product?.id, product?.colors, onColorChange]);

  const getColorStyle = (color: string) => {
    if (color.match(/^#[0-9A-Fa-f]{6}$/)) {
      return "";
    }
    const colorMap: Record<string, string> = {
      black: "bg-black",
      white: "bg-white border-2 border-gray-300",
      blue: "bg-blue-600",
      red: "bg-red-600",
      green: "bg-green-600",
      yellow: "bg-yellow-400",
      purple: "bg-purple-600",
      pink: "bg-pink-500",
      orange: "bg-orange-500",
      brown: "bg-amber-900",
      gray: "bg-gray-500",
      charcoal: "bg-gray-800",
      navy: "bg-blue-900",
      "space-gray": "bg-gray-600",
      silver: "bg-gray-300",
      gold: "bg-yellow-300",
      "rose-gold": "bg-gradient-to-br from-rose-300 to-amber-200",
    };
    return colorMap[color.toLowerCase()] || "bg-gray-400";
  };

  const getColorInlineStyle = (color: string) => {
    if (color.match(/^#[0-9A-Fa-f]{6}$/)) {
      return { backgroundColor: color };
    }
    return {};
  };

  const handleAddToCart = () => {
    if (product.colors?.length > 0 && !selectedColor) {
      toast({
        title: "Error",
        description: "Please select a color before adding to cart.",
        variant: "destructive",
      });
      return;
    }

    if (product.sizes?.values?.length > 0 && !localSelectedSize) {
      toast({
        title: "Error",
        description: "Please select a size before adding to cart.",
        variant: "destructive",
      });
      return;
    }

    const q = clampQty(quantity);
    console.log("Modal handleAddToCart passing to onAddToCart:", { color: selectedColor, qty: q, size: localSelectedSize });
    onAddToCart(product, selectedColor || null, q, localSelectedSize);
  };

  const hasColors = Array.isArray(product.colors) && product.colors.length > 0;

  // price slab table helpers (UPDATED to new slab fields)
  const priceSlabs = Array.isArray(product.priceSlabs) ? product.priceSlabs : [];
  const hasPriceSlabs = priceSlabs.length > 0;

  const pointsForUnitAmount = (amountInr: any) => {
    const n = Number(amountInr);
    if (!Number.isFinite(n)) return null;
    return Math.ceil(n / inrPerPoint);
  };

  const stock = Number(product.stock ?? 0);
  const safeStock = Number.isFinite(stock) ? stock : 0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-6xl max-h-[90vh] overflow-y-auto p-0"
        data-testid="modal-product-detail"
        style={{ zIndex: 1002 }}
      >
        <div className="grid md:grid-cols-2 gap-0 min-h-[600px]">
          {/* Image Section */}
          <div className="flex flex-col p-6 bg-white">
            <div className="flex-1 flex items-center justify-center min-h-[400px] bg-gray-50 rounded-lg mb-4">
              <ProductCarousel images={product.images || []} alt={product.name} />
            </div>
            <div className="flex space-x-2 overflow-x-auto pt-4">
              {(product.images || []).map((image: string, index: number) => (
                <div
                  key={index}
                  className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors"
                >
                  <img
                    src={image}
                    alt={`${product.name} thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    data-testid={`thumbnail-${index}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Details Section */}
          <div className="p-8 bg-muted/30 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold" data-testid="text-product-detail-name">
                {product.name}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                data-testid="button-close-product-detail"
                aria-label="Close"
                className="hover:bg-gray-100 rounded-full"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {product.brand && (
              <div className="mb-4">
                <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {product.brand}
                </span>
              </div>
            )}

            {/* Price Breakdown */}
            <div className="mb-6 space-y-2 bg-white p-4 rounded-xl border shadow-sm">
              <div className="flex justify-between items-center pb-2 border-bottom">
                <span className="text-muted-foreground">Product Value</span>
                <span className="font-semibold">₹{linePriceInr.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>GST ({gstPercent}%)</span>
                <span>₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t mt-2">
                <span className="text-xl font-bold">Total Amount</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">₹{totalAmount.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">{linePoints} points</div>
                </div>
              </div>
            </div>

            {/* Price Slabs Table (UPDATED) */}
            {hasPriceSlabs && (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Price Slabs:</h4>
                <div className="bg-white rounded-lg shadow-sm overflow-hidden border">
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 border-b">
                        <tr>
                          <th className="text-left font-semibold px-4 py-3">Qty Range</th>
                          <th className="text-left font-semibold px-4 py-3">Points / Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceSlabs.map((slab: any, idx: number) => {
                          const minQty = slab?.minQty ?? "";
                          const maxQty = slab?.maxQty;

                          const price = slab?.price ?? "";

                          const pts = pointsForUnitAmount(price);

                          return (
                            <tr key={idx} className="border-b last:border-b-0">
                              <td className="px-4 py-3 text-muted-foreground">
                                {String(minQty)} - {maxQty == null ? "∞" : String(maxQty)}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {pts == null ? "-" : `${pts}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Slab price shown is <span className="font-medium">per unit</span>.
                </p>
              </div>
            )}

            {/* Specifications */}
            {hasSpecifications && (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Specifications:</h4>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                    {normalizeSpecifications}
                  </div>
                </div>
              </div>
            )}

            {/* Packages Include */}
            {Array.isArray(product.packagesInclude) && product.packagesInclude.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Packages Include:</h4>
                <div className="space-y-2 text-sm bg-white rounded-lg p-4 shadow-sm">
                  {product.packagesInclude.map((item: string, index: number) => (
                    <div key={index} className="flex items-start">
                      <CheckCircle className="text-green-600 mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {product.sizes?.values?.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Choose Size ({product.sizes.unit}):</h4>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.values.map((size: string) => {
                    const selected = localSelectedSize === size;
                    return (
                      <Button
                        key={size}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        className={`min-w-[50px] ${selected ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                        onClick={() => setLocalSelectedSize(size)}
                      >
                        {size}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Color Selection */}
            {hasColors ? (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Choose Color:</h4>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((color: string) => {
                    const selected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        className={`w-12 h-12 rounded-full border-2 transition-all duration-200 ${selected
                          ? "ring-2 ring-blue-500 ring-offset-2"
                          : "border-gray-300 hover:border-blue-400"
                          } ${getColorStyle(color)}`}
                        style={getColorInlineStyle(color)}
                        onClick={() => {
                          if (!selected) onColorChange(color);
                        }}
                        aria-pressed={selected}
                        aria-label={`Select color ${color}`}
                        data-testid={`detail-color-option-${color}`}
                        title={color}
                      />
                    );
                  })}
                </div>
                {selectedColor && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: <span className="font-medium">{selectedColor}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Color:</h4>
                <p className="text-sm text-muted-foreground">No color options available</p>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-8">
              <h4 className="font-semibold text-lg mb-3">Quantity:</h4>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onQuantityChange(clampQty(quantity - 1))}
                  disabled={quantity <= 1}
                  className="rounded-full w-10 h-10"
                >
                  <Minus className="h-4 w-4" />
                </Button>

                <Input
                  type="number"
                  className="w-20 text-center text-lg font-semibold"
                  value={Math.max(1, Number(quantity) || 1)}
                  onChange={(e) => onQuantityChange(clampQty(parseInt(e.target.value, 10) || 1))}
                  min={1}
                  max={Math.max(1, safeStock)}
                />

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onQuantityChange(clampQty(quantity + 1))}
                  disabled={safeStock > 0 ? quantity >= safeStock : false}
                  className="rounded-full w-10 h-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>

                <span className="text-sm text-muted-foreground ml-2">{safeStock} available</span>
              </div>
            </div>

            {/* Add to Cart */}
            <div className="mt-auto">
              <Button
                className="w-full py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={handleAddToCart}
                data-testid="button-add-to-cart-from-detail"
                disabled={hasColors && !selectedColor}
                size="lg"
              >
                <ShoppingCart className="mr-3 h-6 w-6" />
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const ProductDetailModal = memo(_ProductDetailModal);
