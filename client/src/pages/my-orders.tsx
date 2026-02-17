// src/pages/my-orders.tsx
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function MyOrders() {
  const { token } = useAuth();
  const { toast } = useToast();

  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<any[]>({
    queryKey: ["/api/orders/my-orders"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch("/api/orders/my-orders", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.message || `Failed to fetch orders (${res.status})`);
      }
      return json as any[];
    },
    retry: 1,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Orders</h1>

          <Button
            variant="outline"
            onClick={async () => {
              try {
                await refetch();
                toast({ title: "Refreshed orders" });
              } catch (e: any) {
                toast({ title: "Error", description: e.message, variant: "destructive" });
              }
            }}
          >
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground mt-8">Loading your orders…</p>
        ) : isError ? (
          <div className="text-center mt-8">
            <p className="text-red-600 text-sm">
              {(error as any)?.message || "Failed to load orders"}
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              If you just paid via PhonePe, try refresh. If this persists, check token/session.
            </p>
          </div>
        ) : orders.length === 0 ? (
          <p className="text-center text-muted-foreground mt-8">No orders yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((o: any, idx: number) => {
              const order = o?.order;
              const product = o?.product;

              return (
                <div key={order?.id ?? idx} className="bg-card rounded-xl shadow-sm border p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                      {product?.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product?.name || "Product"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <h4 className="font-semibold">{product?.name || "-"}</h4>
                      {(order?.selectedColor || order?.selectedSize) && (
                        <p className="text-muted-foreground">
                          {order?.selectedColor}
                          {order?.selectedColor && order?.selectedSize && " | "}
                          {order?.selectedSize && `Size: ${order?.selectedSize}`}
                        </p>
                      )}
                      <p className="text-muted-foreground">Quantity: {order?.quantity ?? "-"}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
                    <p>
                      Order ID:{" "}
                      <span className="font-mono font-bold">{order?.orderId || "-"}</span>
                    </p>
                    <p>
                      Status:{" "}
                      <span className="text-green-600 font-medium">
                        {order?.status || "confirmed"}
                      </span>
                    </p>
                    <p>
                      Date:{" "}
                      {order?.orderDate ? new Date(order.orderDate).toLocaleDateString() : "-"}
                    </p>

                    {order?.metadata?.usedPoints !== undefined && (
                      <p>
                        Used points: <span>{order.metadata.usedPoints ?? 0}</span>
                      </p>
                    )}

                    {order?.metadata?.copayInr ? (
                      <p>
                        Co-pay:{" "}
                        <span className="font-bold">{order.metadata.copayInr} INR</span>
                      </p>
                    ) : (
                      <p>Co-pay: 0 INR</p>
                    )}

                    {(order?.metadata?.deliveryMethod || order?.metadata?.deliveryAddress) && (
                      <div className="mt-2">
                        <p className="font-medium">Delivery:</p>
                        <p>
                          {order?.metadata?.deliveryMethod || "-"}
                          {order?.metadata?.deliveryAddress
                            ? ` — ${order.metadata.deliveryAddress}`
                            : ""}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
