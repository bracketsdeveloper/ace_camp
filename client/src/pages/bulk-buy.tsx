import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type Product = {
  id: string;
  name: string;
  price: string;
  images: string[];
  colors: string[];
  stock: number;
  bulkBuy?: boolean;
  priceSlabs?: Array<{ minQty: number; maxQty: number | null; price: string }>;
};

type BulkBuyRequest = {
  id: string;
  requestId: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  items: Array<any>;
  procurementNote?: string | null;
};

function unitPriceForQty(p: Product, qty: number) {
  const base = Number(p.price || 0);
  const slabs = Array.isArray(p.priceSlabs) ? p.priceSlabs : [];
  if (!slabs.length) return base;

  const m = slabs.find((s) => {
    const min = Number(s.minQty);
    const max = s.maxQty === null ? Number.POSITIVE_INFINITY : Number(s.maxQty);
    return qty >= min && qty <= max;
  });
  if (!m) return base;

  const sp = Number(m.price);
  return Number.isFinite(sp) ? sp : base;
}

export default function BulkBuyPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [deliveryMethod, setDeliveryMethod] = useState<"office" | "delivery">("office");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [requesterNote, setRequesterNote] = useState<string>("");

  // per-request controls (simple default values)
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});
  const [colorByProduct, setColorByProduct] = useState<Record<string, string | null>>({});

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const { data: me } = useQuery({
    queryKey: ["/api/bulkbuy/me"],
    enabled: !!token,
    queryFn: async () => {
      const r = await fetch("/api/bulkbuy/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
  });

  const eligible = !!me?.eligible;

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/bulkbuy/products"],
    enabled: !!token && eligible,
    queryFn: async () => {
      const r = await fetch("/api/bulkbuy/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Failed to load bulk buy products");
      return j;
    },
  });

  const { data: myRequests = [], isLoading: requestsLoading } = useQuery<BulkBuyRequest[]>({
    queryKey: ["/api/bulkbuy/requests/my"],
    enabled: !!token && eligible,
    queryFn: async () => {
      const r = await fetch("/api/bulkbuy/requests/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Failed to load bulk buy requests");
      return j;
    },
  });

  // ✅ New: Request a single product (no cart)
  const requestProduct = useMutation({
    mutationFn: async (payload: {
      productId: string;
      quantity: number;
      selectedColor: string | null;
      deliveryMethod: "office" | "delivery";
      deliveryAddress: string | null;
      requesterNote: string | null;
    }) => {
      const r = await fetch("/api/bulkbuy/request", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Failed to submit request");
      return j;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/bulkbuy/requests/my"] });
      toast({
        title: "Request submitted",
        description:
          data?.message || "Your request has been submitted to procurement team for approval.",
      });
      // keep delivery settings (often reused), clear note
      setRequesterNote("");
    },
    onError: (e: any) =>
      toast({ title: "Request failed", description: e.message, variant: "destructive" }),
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto p-8">Please log in.</div>
        <Footer />
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto p-8">
          <h1 className="text-2xl font-bold mb-2">Bulk Buy</h1>
          <p className="text-muted-foreground">
            Your account is not enabled for Bulk Buy. Please contact your admin/procurement team.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  const estimatedTotalForProduct = (p: Product) => {
    const qty = Math.max(1, Number(qtyByProduct[p.id] || 1));
    const unit = unitPriceForQty(p, qty);
    return { qty, unit, total: unit * qty };
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Bulk Buy</h1>
          <div className="text-sm text-muted-foreground">Submit requests for procurement approval</div>
        </div>

        {/* Delivery + Note (applies to each request) */}
        <div className="bg-card border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Request Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Delivery Method</label>
              <select
                className="w-full border rounded-md p-2"
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value as any)}
              >
                <option value="office">Office</option>
                <option value="delivery">Delivery</option>
              </select>

              {deliveryMethod === "delivery" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Delivery Address</label>
                  <textarea
                    className="w-full border rounded-md p-2"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter delivery address"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Note to procurement (optional)</label>
              <textarea
                className="w-full border rounded-md p-2"
                value={requesterNote}
                onChange={(e) => setRequesterNote(e.target.value)}
                placeholder="Any context for procurement..."
              />
            </div>
          </div>

          <div className="text-xs text-muted-foreground mt-3">
            These settings will be sent along with each product request.
          </div>
        </div>

        {/* Products */}
        <div className="bg-card border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Bulk Buy Products</h2>

          {productsLoading ? (
            <div className="text-muted-foreground">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="text-muted-foreground">
              No bulk buy products available right now. Please contact admin.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((p) => {
                const chosenQty = Math.max(1, Number(qtyByProduct[p.id] || 1));
                const chosenColor =
                  (p.colors?.length ? colorByProduct[p.id] ?? p.colors?.[0] ?? null : null) ?? null;

                const calc = estimatedTotalForProduct(p);
                const outOfStock = (p.stock || 0) <= 0;
                const qtyTooHigh = chosenQty > (p.stock || 0);

                return (
                  <div key={p.id} className="bg-card border rounded-xl p-4">
                    <div className="h-40 bg-muted rounded-lg overflow-hidden mb-3">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} className="w-full h-full object-cover" />
                      ) : null}
                    </div>

                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-muted-foreground">Base price: ₹{p.price}</div>
                    <div className="text-xs text-muted-foreground mt-1">Stock: {p.stock ?? 0}</div>

                    {/* Qty + Color */}
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Qty</div>
                        <input
                          type="number"
                          min={1}
                          className="w-full border rounded-md p-2"
                          value={chosenQty}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setQtyByProduct((prev) => ({
                              ...prev,
                              [p.id]: Number.isFinite(v) && v > 0 ? v : 1,
                            }));
                          }}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">Color</div>
                        <select
                          className="w-full border rounded-md p-2"
                          value={chosenColor ?? ""}
                          onChange={(e) =>
                            setColorByProduct((prev) => ({
                              ...prev,
                              [p.id]: e.target.value ? e.target.value : null,
                            }))
                          }
                          disabled={!p.colors?.length}
                        >
                          {!p.colors?.length ? <option value="">N/A</option> : null}
                          {p.colors?.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* price calc */}
                    <div className="mt-3 text-sm text-muted-foreground">
                      Unit: ₹{calc.unit.toFixed(2)} • Total: ₹{calc.total.toFixed(2)}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button
                        onClick={() =>
                          requestProduct.mutate({
                            productId: p.id,
                            quantity: chosenQty,
                            selectedColor: chosenColor,
                            deliveryMethod,
                            deliveryAddress: deliveryMethod === "delivery" ? deliveryAddress : null,
                            requesterNote: requesterNote || null,
                          })
                        }
                        disabled={
                          requestProduct.isPending ||
                          outOfStock ||
                          qtyTooHigh ||
                          (deliveryMethod === "delivery" && !deliveryAddress.trim())
                        }
                      >
                        Request
                      </Button>

                      {(outOfStock || qtyTooHigh) && (
                        <div className="text-xs text-destructive self-center">
                          {outOfStock ? "Out of stock" : "Qty exceeds stock"}
                        </div>
                      )}
                    </div>

                    {Array.isArray(p.priceSlabs) && p.priceSlabs.length > 0 && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        <div className="font-medium">Price slabs:</div>
                        <ul className="list-disc pl-5">
                          {p.priceSlabs.map((s, idx) => (
                            <li key={idx}>
                              {s.minQty} - {s.maxQty ?? "∞"} @ ₹{s.price}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My Requests */}
        <div className="bg-card border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">My Bulk Buy Requests</h2>

          {requestsLoading ? (
            <div className="text-muted-foreground">Loading requests...</div>
          ) : !myRequests.length ? (
            <div className="text-muted-foreground">No requests yet.</div>
          ) : (
            <div className="space-y-3">
              {myRequests.map((r) => (
                <div key={r.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-mono font-semibold">{r.requestId}</div>
                    <div className="text-sm">{r.status}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total: ₹{r.totalAmount} • {new Date(r.createdAt).toLocaleString()}
                  </div>
                  {r.procurementNote ? (
                    <div className="text-sm mt-2">
                      <span className="font-medium">Procurement note:</span> {r.procurementNote}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
