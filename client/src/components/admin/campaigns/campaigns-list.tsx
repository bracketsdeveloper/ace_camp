import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Edit, Trash, Package, Calendar, Image as ImageIcon, Users } from "lucide-react";
import { CampaignEditModal } from "./campaign-edit-modal";
import { CampaignProductsModal } from "./campaign-products-modal";
import { CampaignWhitelistModal } from "./campaign-whitelist-modal";
import type { Campaign } from "./types";

export function CampaignsList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"]
  });

  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [managingProductsCampaign, setManagingProductsCampaign] = useState<Campaign | null>(null);
  const [managingWhitelistCampaign, setManagingWhitelistCampaign] = useState<Campaign | null>(null);

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/campaigns/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign deleted" });
    },
    onError: (e: any) => toast({
      title: "Delete failed",
      description: e.message,
      variant: "destructive"
    }),
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString();
  };

  const isActiveCampaign = (campaign: Campaign) => {
    if (!campaign.isActive) return false;

    const now = new Date();
    const startDate = campaign.startDate ? new Date(campaign.startDate) : null;
    const endDate = campaign.endDate ? new Date(campaign.endDate) : null;

    if (startDate && now < startDate) return false;
    if (endDate && now > endDate) return false;

    return true;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead className="w-[300px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      {campaign.imageUrl ? (
                        <img
                          src={campaign.imageUrl}
                          alt={campaign.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={isActiveCampaign(campaign) ? "default" : "secondary"}
                      >
                        {isActiveCampaign(campaign) ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(campaign.startDate)}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(campaign.endDate)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {campaign.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setManagingProductsCampaign(campaign)}
                      >
                        <Package className="h-4 w-4 mr-1" />
                        Manage Products
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setManagingWhitelistCampaign(campaign)}
                          title="Manage Whitelist"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingCampaign(campaign)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                          disabled={deleteCampaignMutation.isPending}
                        >
                          <Trash className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editingCampaign && (
        <CampaignEditModal
          campaign={editingCampaign}
          onClose={() => setEditingCampaign(null)}
        />
      )}

      {managingProductsCampaign && (
        <CampaignProductsModal
          campaign={managingProductsCampaign}
          onClose={() => setManagingProductsCampaign(null)}
        />
      )}

      {managingWhitelistCampaign && (
        <CampaignWhitelistModal
          campaign={managingWhitelistCampaign}
          onClose={() => setManagingWhitelistCampaign(null)}
        />
      )}
    </>
  );
}