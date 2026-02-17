import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Save, X, Trash, ArrowLeft, ArrowRight, UploadIcon, Tag, Heart, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { uploadFiles, move, removeAt } from "@/lib/admin-utils";
import type { Product } from "./types";
import type { Category } from "@/components/admin/categories/types";
import type { Campaign } from "@/components/admin/campaigns/types";

type PriceSlabRow = { minQty: number | ""; maxQty: number | "" | null; price: string };

function normalizeSlabsForSubmit(slabs: PriceSlabRow[]) {
  const cleaned = slabs
    .map((s) => {
      const minQty = s.minQty === "" ? NaN : Number(s.minQty);
      const maxQty =
        s.maxQty === "" || s.maxQty === null || s.maxQty === undefined ? null : Number(s.maxQty);
      const price = (s.price ?? "").toString().trim();

      return { minQty, maxQty, price };
    })
    .filter((s) => Number.isFinite(s.minQty) && s.minQty > 0 && s.price !== "");

  for (const s of cleaned) {
    const p = Number(s.price);
    if (!Number.isFinite(p) || p < 0) {
      throw new Error("Slab price must be a number >= 0");
    }
    if (s.maxQty !== null) {
      if (!Number.isFinite(s.maxQty) || s.maxQty < s.minQty) {
        throw new Error("Max Qty must be empty (open-ended) or >= Min Qty");
      }
    }
  }

  // Only one open-ended slab
  if (cleaned.filter((s) => s.maxQty === null).length > 1) {
    throw new Error("Only one open-ended slab (blank Max Qty) is allowed");
  }

  // Sort by min then max
  cleaned.sort((a, b) => a.minQty - b.minQty || (a.maxQty ?? Infinity) - (b.maxQty ?? Infinity));

  // Overlap check (null max => Infinity)
  const toMax = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v);
  for (let i = 0; i < cleaned.length; i++) {
    const a = cleaned[i];
    const aMax = toMax(a.maxQty);

    for (let j = i + 1; j < cleaned.length; j++) {
      const b = cleaned[j];
      const bMax = toMax(b.maxQty);

      const overlap = a.minQty <= bMax && b.minQty <= aMax;
      if (overlap) {
        throw new Error("Slab ranges overlap. Please make ranges non-overlapping.");
      }
    }
  }

  return cleaned;
}

interface ProductEditModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  products: Product[];
  categories: Category[];
}

export function ProductEditModal({ open, onClose, product, products, categories }: ProductEditModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [formData, setFormData] = useState<Partial<Product>>({});
  const [images, setImages] = useState<string[]>([]);
  const [colorsInput, setColorsInput] = useState<string>("");
  const [packagesInput, setPackagesInput] = useState<string>("");
  const [specificationsInput, setSpecificationsInput] = useState<string>("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [sizeUnit, setSizeUnit] = useState<string>("");
  const [sizeValuesInput, setSizeValuesInput] = useState<string>("");

  // ✅ Slab pricing rows
  const [priceSlabs, setPriceSlabs] = useState<PriceSlabRow[]>([{ minQty: "", maxQty: "", price: "" }]);

  const { data: productCampaigns = [] } = useQuery<Campaign[]>({
    queryKey: product ? [`/api/admin/products/${product.id}/campaigns`] : ["no-query"],
    enabled: !!product,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        price: product.price,
        sku: product.sku,
        stock: product.stock,
        isActive: product.isActive,
        csrSupport: product.csrSupport || false,
        bulkBuy: Boolean((product as any).bulkBuy), // ✅ NEW
        backupProductId: product.backupProductId,
        categoryIds: product.categoryIds || [],

        // ✅ NEW
        gst: product.gst || "0",
        stockStatus: (product.stockStatus as any) || "non_committed",
        brandStore: Boolean(product.brandStore),
        brand: product.brand || "",
      });

      const sizes = (product as any).sizes as { unit: string; values: string[] } | null;
      setSizeUnit(sizes?.unit || "");
      setSizeValuesInput(sizes?.values?.join(", ") || "");

      setImages(product.images || []);
      setColorsInput((product.colors || []).join(", "));
      setPackagesInput((product.packagesInclude || []).join("\n"));

      setSpecificationsInput(
        typeof product.specifications === "string"
          ? product.specifications
          : JSON.stringify(product.specifications || "", null, 2)
      );

      setSelectedCategoryIds(product.categoryIds || []);

      // ✅ slab pricing init
      const existingSlabs = (product as any)?.priceSlabs;
      if (Array.isArray(existingSlabs) && existingSlabs.length > 0) {
        const mapped: PriceSlabRow[] = existingSlabs.map((s: any) => ({
          minQty: Number(s?.minQty ?? ""),
          maxQty: s?.maxQty === null || s?.maxQty === undefined ? "" : Number(s?.maxQty),
          price: String(s?.price ?? ""),
        }));
        setPriceSlabs(mapped.length ? mapped : [{ minQty: "", maxQty: "", price: "" }]);
      } else {
        setPriceSlabs([{ minQty: "", maxQty: "", price: "" }]);
      }
    }
  }, [product]);

  const updateProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/admin/products/${product!.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/products-admin"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/product-campaigns"] });
      toast({ title: "Product updated successfully" });
      onClose();
    },
    onError: (e: any) => {
      toast({
        title: "Update failed",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const addSlabRow = () => {
    setPriceSlabs((prev) => [...prev, { minQty: "", maxQty: "", price: "" }]);
  };

  const removeSlabRow = (idx: number) => {
    setPriceSlabs((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ minQty: "", maxQty: "", price: "" }];
    });
  };

  const updateSlab = (idx: number, patch: Partial<PriceSlabRow>) => {
    setPriceSlabs((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!formData.sku?.trim()) {
      toast({ title: "SKU is required", variant: "destructive" });
      return;
    }

    let normalizedSlabs: Array<{ minQty: number; maxQty: number | null; price: string }> = [];
    try {
      normalizedSlabs = normalizeSlabsForSubmit(priceSlabs);
    } catch (err: any) {
      toast({
        title: "Invalid slab pricing",
        description: err.message || "Please fix slab values",
        variant: "destructive",
      });
      return;
    }

    const productData = {
      name: formData.name.trim(),
      price: formData.price || "0.00",
      sku: formData.sku.trim(),
      stock: formData.stock || 0,
      categoryIds: selectedCategoryIds,
      backupProductId: formData.backupProductId || null,
      isActive: formData.isActive !== false,
      csrSupport: formData.csrSupport || false,

      // ✅ NEW
      bulkBuy: Boolean((formData as any).bulkBuy),
      brandStore: Boolean((formData as any).brandStore),
      gst: formData.gst || "0",
      stockStatus: (formData.stockStatus as any) || "non_committed",
      brand: (formData.brand ?? "").trim(),
      sizes: sizeUnit ? {
        unit: sizeUnit.trim(),
        values: sizeValuesInput.split(",").map(v => v.trim()).filter(Boolean)
      } : null,

      images: images,
      colors: colorsInput.split(",").map((s) => s.trim()).filter(Boolean),
      packagesInclude: packagesInput.split("\n").filter(Boolean),
      specifications: specificationsInput.trim(),

      priceSlabs: normalizedSlabs,
    };

    updateProductMutation.mutate(productData);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product: {product.name}</DialogTitle>
        </DialogHeader>

        {/* Campaigns Info */}
        {productCampaigns.length > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4" />
              <span className="font-medium">Campaigns</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {productCampaigns.map((campaign) => (
                <Badge key={campaign.id} variant="secondary">
                  {campaign.name}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: To manage campaigns, go to the Campaigns section.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Price */}
            <div>
              <Label htmlFor="edit-price">Base Price *</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price || ""}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Base price is used when no slab matches the quantity.
              </p>
            </div>

            {/* GST */}
            <div>
              <Label htmlFor="edit-gst">GST (%)</Label>
              <Input
                id="edit-gst"
                value={formData.gst || ""}
                onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
              />
            </div>

            {/* ✅ NEW: Bulk Buy */}
            <div className="md:col-span-2">
              <Label>Bulk Buy</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  id="edit-bulkBuy"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean((formData as any).bulkBuy)}
                  onChange={(e) => setFormData({ ...formData, bulkBuy: e.target.checked } as any)}
                />
                <Label htmlFor="edit-bulkBuy" className="text-sm">
                  Show this product in Bulk Buy section
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                If enabled, this product will appear in the Bulk Buy portal (restricted users only).
              </p>
            </div>

            {/* ✅ NEW: Brand Store */}
            <div className="md:col-span-2">
              <Label>Brand Store</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  id="edit-brandStore"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean((formData as any).brandStore)}
                  onChange={(e) => setFormData({ ...formData, brandStore: e.target.checked } as any)}
                />
                <Label htmlFor="edit-brandStore" className="text-sm">
                  Show this product in Brand Store
                </Label>
              </div>
            </div>

            {/* Brand */}
            <div>
              <Label htmlFor="edit-brand">Brand Name</Label>
              <Input
                id="edit-brand"
                value={formData.brand || ""}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Enter brand name"
              />
            </div>

            {/* Sizes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-size-unit">Size Unit</Label>
                <Input
                  id="edit-size-unit"
                  value={sizeUnit}
                  onChange={(e) => setSizeUnit(e.target.value)}
                  placeholder="e.g. UK, EU, US"
                />
              </div>
              <div>
                <Label htmlFor="edit-size-values">Sizes (comma-separated)</Label>
                <Input
                  id="edit-size-values"
                  value={sizeValuesInput}
                  onChange={(e) => setSizeValuesInput(e.target.value)}
                  placeholder="e.g. 7, 8, 9, 10"
                />
              </div>
            </div>

            {/* Slab Pricing */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Slab Pricing (optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSlabRow}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {priceSlabs.map((row, idx) => (
                  <div
                    key={`slab-${idx}`}
                    className="grid grid-cols-12 gap-2 items-end rounded-md border border-input bg-background p-3"
                  >
                    <div className="col-span-4">
                      <Label className="text-xs">Min Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.minQty}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateSlab(idx, { minQty: v === "" ? "" : Number(v) });
                        }}
                        placeholder="e.g., 1"
                      />
                    </div>

                    <div className="col-span-4">
                      <Label className="text-xs">Max Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.maxQty === null ? "" : (row.maxQty as any)}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateSlab(idx, { maxQty: v === "" ? "" : Number(v) });
                        }}
                        placeholder='blank = "∞"'
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Leave empty for open-ended</p>
                    </div>

                    <div className="col-span-3">
                      <Label className="text-xs">Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={row.price}
                        onChange={(e) => updateSlab(idx, { price: e.target.value })}
                        placeholder="e.g., 799.00"
                      />
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeSlabRow(idx)}
                        title="Remove row"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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
              {selectedCategoryIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Selected categories: {selectedCategoryIds.length}
                </p>
              )}
            </div>

            {/* SKU */}
            <div>
              <Label htmlFor="edit-sku">SKU *</Label>
              <Input
                id="edit-sku"
                value={formData.sku || ""}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                required
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
                      setImages((prev) => [...prev, ...urls]);
                      toast({ title: "Images uploaded", description: `${urls.length} file(s) ready.` });
                    } catch (err: any) {
                      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                    }
                  }}
                />
                <UploadIcon className="h-5 w-5 opacity-60" />
              </div>

              {images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {images.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative">
                      <div className="w-20 h-20 rounded border overflow-hidden bg-muted flex items-center justify-center">
                        <img src={url} alt="preview" className="object-cover w-full h-full" />
                      </div>
                      <div className="flex justify-center gap-1 mt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={idx === 0}
                          onClick={() => setImages((prev) => move(prev, idx, idx - 1))}
                          title="Move left"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={idx === images.length - 1}
                          onClick={() => setImages((prev) => move(prev, idx, idx + 1))}
                          title="Move right"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => setImages((prev) => removeAt(prev, idx))}
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
              <Label htmlFor="edit-colors">Colors (comma-separated)</Label>
              <Input
                id="edit-colors"
                value={colorsInput}
                onChange={(e) => setColorsInput(e.target.value)}
                placeholder="Red, Blue, Green"
              />
            </div>

            {/* Stock */}
            <div>
              <Label htmlFor="edit-stock">Total Stock</Label>
              <Input
                id="edit-stock"
                type="number"
                min="0"
                value={String(formData.stock ?? 0)}
                onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) || 0 })}
              />
            </div>

            {/* Stock Status */}
            <div>
              <Label>Stock Status</Label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 text-sm border p-2 rounded cursor-pointer">
                  <input
                    type="radio"
                    name="editStockStatus"
                    value="committed"
                    checked={formData.stockStatus === "committed"}
                    onChange={() => setFormData({ ...formData, stockStatus: "committed" })}
                    className="h-4 w-4"
                  />
                  Committed
                </label>
                <label className="flex items-center gap-2 text-sm border p-2 rounded cursor-pointer">
                  <input
                    type="radio"
                    name="editStockStatus"
                    value="non_committed"
                    checked={formData.stockStatus !== "committed"}
                    onChange={() => setFormData({ ...formData, stockStatus: "non_committed" })}
                    className="h-4 w-4"
                  />
                  Non-Committed
                </label>
              </div>
            </div>

            {/* Packages Include */}
            <div className="md:col-span-2">
              <Label htmlFor="edit-packages">Packages Include (one per line)</Label>
              <Textarea
                id="edit-packages"
                value={packagesInput}
                onChange={(e) => setPackagesInput(e.target.value)}
                placeholder="Item 1&#10;Item 2&#10;Item 3"
                rows={3}
              />
            </div>

            {/* Specifications */}
            <div className="md:col-span-2">
              <Label htmlFor="edit-specifications">Specifications (plain text with line breaks)</Label>
              <Textarea
                id="edit-specifications"
                value={specificationsInput}
                onChange={(e) => setSpecificationsInput(e.target.value)}
                placeholder="Enter detailed specifications here...&#10;You can use multiple lines&#10;And any format you want"
                rows={4}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Enter specifications as plain text. Each line will be preserved.
              </p>
            </div>

            {/* Backup Product */}
            <div>
              <Label htmlFor="edit-backup">Backup Product (optional)</Label>
              <select
                id="edit-backup"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.backupProductId ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    backupProductId: e.target.value ? e.target.value : null,
                  })
                }
              >
                <option value="">— None —</option>
                {products
                  .filter((p) => p.id !== product.id)
                  .map((p) => (
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
                  id="edit-isActive"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(formData.isActive)}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <Label htmlFor="edit-isActive" className="text-sm">
                  Product is active
                </Label>
              </div>
            </div>

            {/* CSR Support */}
            <div>
              <Label>CSR Support</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  id="edit-csrSupport"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(formData.csrSupport)}
                  onChange={(e) => setFormData({ ...formData, csrSupport: e.target.checked })}
                />
                <Label htmlFor="edit-csrSupport" className="text-sm flex items-center gap-1">
                  <Heart className="h-3 w-3 text-red-500" />
                  Available for CSR Support
                </Label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={updateProductMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateProductMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
