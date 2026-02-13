import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, UploadIcon, ArrowLeft, ArrowRight, Trash, Heart } from "lucide-react";
import { uploadFiles, move, removeAt } from "@/lib/admin-utils";
import type { Product, PriceSlab } from "./types";
import type { Category } from "@/components/admin/categories/types";

const defaultNewProduct: Partial<Product> = {
  name: "",
  price: "0.00",
  images: [],
  colors: [],
  stock: 0,
  packagesInclude: [],
  specifications: "",
  sku: "",
  isActive: true,
  csrSupport: false,
  backupProductId: null,
  categoryIds: [],
  priceSlabs: [],
  bulkBuy: false, // ✅ NEW
};

function normalizeSlabs(slabs: PriceSlab[]): PriceSlab[] {
  const cleaned = slabs
    .map((s) => {
      const minQty = Number((s as any).minQty || 0);
      const rawMax = (s as any).maxQty;
      const maxQty =
        rawMax === "" || rawMax === undefined || rawMax === null ? null : Number(rawMax);
      const price = String((s as any).price ?? "").trim();
      return { minQty, maxQty, price };
    })
    .filter((s) => Number.isFinite(s.minQty) && s.minQty > 0 && s.price !== "");

  cleaned.sort(
    (a, b) => a.minQty - b.minQty || (a.maxQty ?? Infinity) - (b.maxQty ?? Infinity)
  );

  return cleaned;
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number) {
  return aMin <= bMax && bMin <= aMax;
}

export function ProductCreate() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [newProduct, setNewProduct] = useState<Partial<Product>>(defaultNewProduct);
  const [newProductImages, setNewProductImages] = useState<string[]>([]);
  const [colorsInput, setColorsInput] = useState<string>("");
  const [packagesInput, setPackagesInput] = useState<string>("");
  const [specificationsInput, setSpecificationsInput] = useState<string>("");

  const [priceSlabs, setPriceSlabs] = useState<PriceSlab[]>([]);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products-admin"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const createProductMutation = useMutation({
    mutationFn: async (body: Partial<Product>) => {
      const res = await apiRequest("POST", `/api/admin/products`, body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/products-admin"] });
      toast({ title: "Product created successfully" });

      setNewProduct(defaultNewProduct);
      setNewProductImages([]);
      setColorsInput("");
      setPackagesInput("");
      setSpecificationsInput("");
      setPriceSlabs([]);
    },
    onError: (e: any) =>
      toast({
        title: "Create failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const toggleCategorySelection = (categoryId: string) => {
    setNewProduct((prev) => {
      const current = prev.categoryIds ?? [];
      const exists = current.includes(categoryId);
      return {
        ...prev,
        categoryIds: exists ? current.filter((id) => id !== categoryId) : [...current, categoryId],
      };
    });
  };

  const selectedCategoryIds = newProduct.categoryIds ?? [];

  const slabValidation = useMemo(() => {
    const normalized = normalizeSlabs(priceSlabs);

    const badPrice = normalized.find((s) => {
      const p = Number(s.price);
      return !Number.isFinite(p) || p < 0;
    });

    const badRange = normalized.find((s) => {
      if (s.maxQty === null) return false;
      return !Number.isFinite(s.maxQty) || s.maxQty < s.minQty;
    });

    const openEndedCount = normalized.filter((s) => s.maxQty === null).length;
    const multipleOpenEnded = openEndedCount > 1;

    let hasOverlap = false;
    for (let i = 0; i < normalized.length; i++) {
      const a = normalized[i];
      const aMax = a.maxQty ?? Number.POSITIVE_INFINITY;

      for (let j = i + 1; j < normalized.length; j++) {
        const b = normalized[j];
        const bMax = b.maxQty ?? Number.POSITIVE_INFINITY;

        if (rangesOverlap(a.minQty, aMax, b.minQty, bMax)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) break;
    }

    return {
      normalized,
      badPrice: Boolean(badPrice),
      badRange: Boolean(badRange),
      multipleOpenEnded,
      hasOverlap,
    };
  }, [priceSlabs]);

  const addSlabRow = () => {
    setPriceSlabs((prev) => {
      const last = prev[prev.length - 1];
      const lastMax = last?.maxQty ?? last?.minQty ?? 0;
      const nextMin = Number(lastMax) + 1 || 1;

      return [
        ...prev,
        {
          minQty: nextMin,
          maxQty: null,
          price: newProduct.price ?? "0.00",
        },
      ];
    });
  };

  const removeSlabRow = (idx: number) => {
    setPriceSlabs((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSlabRow = (idx: number, patch: Partial<PriceSlab>) => {
    setPriceSlabs((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const handleCreate = () => {
    if (!newProduct.name?.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!newProduct.sku?.trim()) {
      toast({ title: "SKU is required", variant: "destructive" });
      return;
    }

    if (slabValidation.badRange) {
      toast({
        title: "Invalid slab range",
        description: "Max Qty must be empty (open-ended) or ≥ Min Qty.",
        variant: "destructive",
      });
      return;
    }
    if (slabValidation.multipleOpenEnded) {
      toast({
        title: "Invalid slab range",
        description: "Only one open-ended slab (blank Max Qty) is allowed.",
        variant: "destructive",
      });
      return;
    }
    if (slabValidation.hasOverlap) {
      toast({
        title: "Invalid slab range",
        description: "Slab ranges overlap. Please make them non-overlapping.",
        variant: "destructive",
      });
      return;
    }
    if (slabValidation.badPrice) {
      toast({
        title: "Invalid slab pricing",
        description: "One or more slab prices are invalid. Prices must be a number ≥ 0.",
        variant: "destructive",
      });
      return;
    }

    const productData: Partial<Product> = {
      name: newProduct.name.trim(),
      price: newProduct.price || "0.00",
      sku: newProduct.sku.trim(),
      stock: newProduct.stock || 0,
      categoryIds: newProduct.categoryIds ?? [],
      backupProductId: newProduct.backupProductId || null,
      isActive: newProduct.isActive !== false,
      csrSupport: newProduct.csrSupport || false,
      bulkBuy: Boolean(newProduct.bulkBuy), // ✅ NEW
      images: newProductImages,
      colors: colorsInput.split(",").map((s) => s.trim()).filter(Boolean),
      packagesInclude: packagesInput.split("\n").map((s) => s.trim()).filter(Boolean),
      specifications: specificationsInput.trim(),
      priceSlabs: slabValidation.normalized,
    };

    createProductMutation.mutate(productData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Product</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <Label htmlFor="product-name">Name *</Label>
            <Input
              id="product-name"
              value={newProduct.name || ""}
              onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
              placeholder="Enter product name"
            />
          </div>

          {/* Price */}
          <div>
            <Label htmlFor="product-price">Base Price *</Label>
            <Input
              id="product-price"
              type="number"
              step="0.01"
              min="0"
              value={newProduct.price || ""}
              onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used when slab pricing is not applicable (or as the default tier).
            </p>
          </div>

          {/* ✅ NEW: Bulk Buy flag */}
          <div className="md:col-span-2">
            <Label>Bulk Buy</Label>
            <div className="flex items-center gap-2 mt-2">
              <input
                id="bulkBuy"
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(newProduct.bulkBuy)}
                onChange={(e) => setNewProduct((p) => ({ ...p, bulkBuy: e.target.checked }))}
              />
              <Label htmlFor="bulkBuy" className="text-sm">
                Show this product in Bulk Buy section
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              If enabled, this product will be visible in the Bulk Buy portal (restricted users only).
            </p>
          </div>

          {/* Categories */}
          <div className="md:col-span-2">
            <Label>Categories</Label>
            {categories.length ? (
              <div className="mt-2 grid sm:grid-cols-2 gap-2">
                {categories.map((category) => {
                  const selected = selectedCategoryIds.includes(category.id);
                  return (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selected}
                        onChange={() => toggleCategorySelection(category.id)}
                      />
                      <span>{category.name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">No categories available.</p>
            )}
            {!!selectedCategoryIds.length && (
              <p className="text-xs text-muted-foreground mt-2">
                Selected categories: {selectedCategoryIds.length}
              </p>
            )}
          </div>

          {/* SKU */}
          <div>
            <Label htmlFor="product-sku">SKU *</Label>
            <Input
              id="product-sku"
              value={newProduct.sku || ""}
              onChange={(e) => setNewProduct((p) => ({ ...p, sku: e.target.value }))}
              placeholder="Enter SKU"
            />
          </div>

          {/* Images */}
          <div className="md:col-span-2">
            <Label>Images</Label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (!files.length) return;
                  try {
                    const urls = await uploadFiles(files);
                    setNewProductImages((prev) => [...prev, ...urls]);
                    toast({ title: "Images uploaded", description: `${urls.length} file(s) ready.` });
                  } catch (err: any) {
                    toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                  }
                }}
              />
              <UploadIcon className="h-5 w-5 opacity-60" />
            </div>

            {!!newProductImages.length && (
              <div className="mt-3 flex flex-wrap gap-3">
                {newProductImages.map((u, idx) => (
                  <div key={`${u}-${idx}`} className="relative">
                    <div className="w-20 h-20 rounded border overflow-hidden bg-muted flex items-center justify-center">
                      <img src={u} alt="preview" className="object-cover w-full h-full" />
                    </div>

                    <div className="flex justify-center gap-1 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={idx === 0}
                        onClick={() => setNewProductImages((prev) => move(prev, idx, idx - 1))}
                        title="Move left"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={idx === newProductImages.length - 1}
                        onClick={() => setNewProductImages((prev) => move(prev, idx, idx + 1))}
                        title="Move right"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => setNewProductImages((prev) => removeAt(prev, idx))}
                        title="Remove"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="text-center text-[10px] text-muted-foreground mt-1">#{idx}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Colors */}
          <div>
            <Label htmlFor="product-colors">Colors (comma-separated)</Label>
            <Input
              id="product-colors"
              value={colorsInput}
              onChange={(e) => setColorsInput(e.target.value)}
              placeholder="Red, Blue, Green"
            />
          </div>

          {/* Stock */}
          <div>
            <Label htmlFor="product-stock">Stock</Label>
            <Input
              id="product-stock"
              type="number"
              min="0"
              value={String(newProduct.stock ?? 0)}
              onChange={(e) => setNewProduct((p) => ({ ...p, stock: Number(e.target.value) || 0 }))}
              placeholder="0"
            />
          </div>

          {/* Slab Pricing */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Slab Pricing (optional)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Define price tiers by quantity range. Leave Max Qty empty for open-ended (e.g., 51+).
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addSlabRow}>
                <Plus className="h-4 w-4 mr-2" />
                Add Slab
              </Button>
            </div>

            {priceSlabs.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">No slabs added. Base price will be used.</p>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
                  <div className="col-span-3">Min Qty *</div>
                  <div className="col-span-3">Max Qty</div>
                  <div className="col-span-4">Price *</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>

                {priceSlabs.map((slab, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min={1}
                        value={String((slab as any).minQty ?? "")}
                        onChange={(e) => updateSlabRow(idx, { minQty: Number(e.target.value) || 0 } as any)}
                        placeholder="e.g., 1"
                      />
                    </div>

                    <div className="col-span-3">
                      <Input
                        type="number"
                        min={1}
                        value={(slab as any).maxQty === null ? "" : String((slab as any).maxQty ?? "")}
                        onChange={(e) =>
                          updateSlabRow(
                            idx,
                            { maxQty: e.target.value === "" ? null : Number(e.target.value) || 0 } as any
                          )
                        }
                        placeholder='blank = "∞"'
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Leave empty for open-ended</p>
                    </div>

                    <div className="col-span-4">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={String((slab as any).price ?? "")}
                        onChange={(e) => updateSlabRow(idx, { price: e.target.value } as any)}
                        placeholder="e.g., 199.00"
                      />
                    </div>

                    <div className="col-span-2 flex justify-end">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeSlabRow(idx)}
                        title="Remove slab"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {(slabValidation.badRange ||
                  slabValidation.multipleOpenEnded ||
                  slabValidation.hasOverlap ||
                  slabValidation.badPrice) && (
                  <div className="text-sm text-red-500">
                    {slabValidation.badRange && <div>• Max Qty must be empty or ≥ Min Qty.</div>}
                    {slabValidation.multipleOpenEnded && <div>• Only one open-ended slab is allowed.</div>}
                    {slabValidation.hasOverlap && <div>• Slab ranges overlap. Fix the ranges.</div>}
                    {slabValidation.badPrice && <div>• Invalid price in one or more slabs (must be number ≥ 0).</div>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Packages Include */}
          <div className="md:col-span-2">
            <Label htmlFor="product-packages">Packages Include (one per line)</Label>
            <Textarea
              id="product-packages"
              value={packagesInput}
              onChange={(e) => setPackagesInput(e.target.value)}
              placeholder="Item 1&#10;Item 2&#10;Item 3"
              rows={3}
            />
          </div>

          {/* Specifications */}
          <div className="md:col-span-2">
            <Label htmlFor="product-specifications">Specifications</Label>
            <Textarea
              id="product-specifications"
              value={specificationsInput}
              onChange={(e) => setSpecificationsInput(e.target.value)}
              placeholder="Enter detailed specifications..."
              rows={4}
            />
          </div>

          {/* Backup Product */}
          <div>
            <Label htmlFor="product-backup">Backup Product (optional)</Label>
            <select
              id="product-backup"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newProduct.backupProductId ?? ""}
              onChange={(e) =>
                setNewProduct((p) => ({
                  ...p,
                  backupProductId: e.target.value ? e.target.value : null,
                }))
              }
            >
              <option value="">— None —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          {/* Active Status */}
          <div>
            <Label>Active Status</Label>
            <div className="flex items-center gap-2 mt-2">
              <input
                id="isActive"
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(newProduct.isActive)}
                onChange={(e) => setNewProduct((p) => ({ ...p, isActive: e.target.checked }))}
              />
              <Label htmlFor="isActive" className="text-sm">
                Product is active
              </Label>
            </div>
          </div>

          {/* CSR Support */}
          <div>
            <Label>CSR Support</Label>
            <div className="flex items-center gap-2 mt-2">
              <input
                id="csrSupport"
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(newProduct.csrSupport)}
                onChange={(e) => setNewProduct((p) => ({ ...p, csrSupport: e.target.checked }))}
              />
              <Label htmlFor="csrSupport" className="text-sm flex items-center gap-1">
                <Heart className="h-3 w-3 text-red-500" />
                Available for CSR Support
              </Label>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleCreate} disabled={createProductMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            {createProductMutation.isPending ? "Creating..." : "Create Product"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
