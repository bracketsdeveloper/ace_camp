// src/components/admin/orders/orders-table.tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { useState } from "react";
import { OrdersExportModal } from "./orders-export-modal";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "./types";

export function OrdersTable() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [exportOpen, setExportOpen] = useState(false);

  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch("/api/admin/orders", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Try to parse json error nicely
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.message || `Failed to fetch orders (${res.status})`;
        throw new Error(msg);
      }

      return json as Order[];
    },
    retry: 1,
  });

  const onRefresh = async () => {
    try {
      await refetch();
      toast({ title: "Refreshed orders" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>All Orders</CardTitle>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
              disabled={!orders.length}
              title={!orders.length ? "No orders to export" : "Export"}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export (Excel/CSV)
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading orders…</div>
          ) : isError ? (
            <div className="py-8">
              <p className="text-sm text-red-600">
                {(error as any)?.message || "Failed to load orders"}
              </p>
              <Button className="mt-3" variant="outline" onClick={onRefresh}>
                Try again
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground">No orders yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Points Used</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {orders.map((order) => {
                    const employeeName =
                      `${order.employee?.firstName || ""} ${order.employee?.lastName || ""}`.trim();

                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono">{order.orderId}</TableCell>

                        <TableCell>
                          <div>
                            <p className="font-medium">{employeeName || "-"}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.employee?.email || order.employee?.phoneNumber || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>{order.product?.name || "-"}</TableCell>
                        <TableCell>{order.selectedColor || "-"}</TableCell>
                        <TableCell>{order.quantity}</TableCell>

                        <TableCell className="font-semibold">
                          ₹{order.metadata?.unitPrice ?? order.product?.price ?? 0}
                        </TableCell>

                        <TableCell>{order.metadata?.usedPoints ?? 0}</TableCell>

                        <TableCell>
                          {order.metadata?.copayInr ? `₹${order.metadata.copayInr}` : "₹0"}
                        </TableCell>

                        <TableCell>
                          {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "-"}
                        </TableCell>

                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">{order.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <OrdersExportModal open={exportOpen} onClose={() => setExportOpen(false)} orders={orders} />
    </>
  );
}
