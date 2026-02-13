import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Trash, Tag } from "lucide-react";
import { ProductEditModal } from "./product-edit-modal";
import { useState } from "react";
import type { Product } from "./types";
import type { Category } from "@/components/admin/categories/types";
import type { Campaign } from "@/components/admin/campaigns/types";

export function ProductsTable() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products-admin"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: productCampaignsData = {} } = useQuery<Record<string, Campaign[]>>({
    queryKey: ["/api/admin/product-campaigns"],
  });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/products/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/products-admin"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/product-campaigns"] });
      toast({ title: "Product deleted" });
    },
    onError: (e: any) =>
      toast({
        title: "Delete failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingProduct(null);
  };

  const labelForProduct = (prodId: string | null | undefined) => {
    if (!prodId) return "—";
    const p = products.find((pp) => pp.id === prodId);
    return p ? `${p.name} (${p.sku})` : "—";
  };

  const resolveProductCategories = (product: Product) => {
    if (product.categories?.length) return product.categories;
    const ids = product.categoryIds ?? [];
    if (!ids.length) return [];
    return categories.filter((category) => ids.includes(category.id));
  };

  const getProductCampaigns = (productId: string) => {
    return productCampaignsData[productId] || [];
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>

                  {/* ✅ NEW */}
                  <TableHead>Bulk Buy</TableHead>

                  <TableHead>Categories</TableHead>
                  <TableHead>Campaigns</TableHead>
                  <TableHead>Backup</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[260px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const productCampaigns = getProductCampaigns(p.id);
                  const isBulk = Boolean((p as any).bulkBuy);

                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="font-mono">{p.sku}</TableCell>
                      <TableCell>₹{p.price}</TableCell>
                      <TableCell>{p.stock}</TableCell>

                      {/* ✅ NEW */}
                      <TableCell>
                        <Badge variant={isBulk ? "default" : "secondary"}>
                          {isBulk ? "Yes" : "No"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {(() => {
                          const assigned = resolveProductCategories(p);
                          if (!assigned.length) return "—";
                          return (
                            <div className="flex flex-wrap gap-1">
                              {assigned.map((category) => (
                                <Badge key={`${p.id}-${category.id}`} variant="outline">
                                  {category.name}
                                </Badge>
                              ))}
                            </div>
                          );
                        })()}
                      </TableCell>

                      <TableCell>
                        {productCampaigns.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {productCampaigns.map((campaign) => (
                              <Badge
                                key={`${p.id}-${campaign.id}`}
                                variant="secondary"
                                className="flex items-center gap-1"
                              >
                                <Tag className="h-3 w-3" />
                                {campaign.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell>{labelForProduct(p.backupProductId)}</TableCell>

                      <TableCell>
                        <Badge variant={p.isActive ? "default" : "destructive"}>
                          {p.isActive ? "Yes" : "No"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditModal(p)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteProductMutation.mutate(p.id)}
                          >
                            <Trash className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ProductEditModal
        open={editModalOpen}
        onClose={closeEditModal}
        product={editingProduct}
        products={products}
        categories={categories}
      />
    </>
  );
}
