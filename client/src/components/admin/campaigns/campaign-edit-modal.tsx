// src/components/admin/campaigns/campaign-edit-modal.tsx
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Save, X, Upload } from "lucide-react";
import { uploadFiles } from "@/lib/admin-utils";
import type { Campaign } from "./types";

interface CampaignEditModalProps {
  campaign: Campaign;
  onClose: () => void;
}

export function CampaignEditModal({ campaign, onClose }: CampaignEditModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    imageUrl: "",
    isActive: true,
    startDate: "",
    endDate: "",
    maxProductsPerUser: "",
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  useEffect(() => {
    // Convert ISO string to datetime-local format
    const formatDateForInput = (dateString?: string) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toISOString().slice(0, 16);
    };

    setFormData({
      name: campaign.name,
      description: campaign.description || "",
      imageUrl: campaign.imageUrl || "",
      isActive: campaign.isActive,
      startDate: formatDateForInput(campaign.startDate),
      endDate: formatDateForInput(campaign.endDate),
      maxProductsPerUser: campaign.maxProductsPerUser ? String(campaign.maxProductsPerUser) : "",
    });

    if (campaign.imageUrl) {
      setImagePreview(campaign.imageUrl);
    }
  }, [campaign]);

  const updateCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/admin/campaigns/${campaign.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign updated successfully" });
      onClose();
    },
    onError: (e: any) => {
      toast({
        title: "Update failed",
        description: e.message,
        variant: "destructive"
      });
    },
  });

  const handleImageUpload = async (file: File) => {
    try {
      setImageUploading(true);
      const [url] = await uploadFiles([file]);
      setFormData(prev => ({ ...prev, imageUrl: url }));
      toast({ title: "Image uploaded successfully" });
    } catch (err: any) {
      toast({
        title: "Image upload failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setImageUploading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB",
          variant: "destructive"
        });
        return;
      }

      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Only JPEG, PNG, WebP, and GIF images are allowed",
          variant: "destructive"
        });
        return;
      }

      setImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    setFormData(prev => ({ ...prev, imageUrl: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    let finalImageUrl = formData.imageUrl;

    // If there's a new file, upload it first
    if (imageFile) {
      try {
        setImageUploading(true);
        const [url] = await uploadFiles([imageFile]);
        finalImageUrl = url;
      } catch (err: any) {
        toast({
          title: "Image upload failed",
          description: err.message,
          variant: "destructive"
        });
        setImageUploading(false);
        return;
      } finally {
        setImageUploading(false);
      }
    }

    const campaignData = {
      ...formData,
      imageUrl: finalImageUrl,
      startDate: formData.startDate ? formData.startDate + ":00.000Z" : null,
      endDate: formData.endDate ? formData.endDate + ":00.000Z" : null,
      maxProductsPerUser: formData.maxProductsPerUser ? parseInt(formData.maxProductsPerUser) : null,
    };

    updateCampaignMutation.mutate(campaignData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Form wrapper to handle submission */}
        <form onSubmit={handleSubmit} className="h-full flex flex-col">
          {/* Fixed Header */}
          <div className="px-6 py-4 border-b bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Edit Campaign</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Campaign Name */}
                <div className="md:col-span-2">
                  <Label htmlFor="edit-name" className="text-sm font-medium">Campaign Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <Label htmlFor="edit-description" className="text-sm font-medium">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="mt-1"
                  />
                </div>

                {/* Image Upload */}
                <div className="md:col-span-2">
                  <Label htmlFor="campaign-image" className="text-sm font-medium">Campaign Image</Label>

                  <div className="flex flex-col gap-4 mt-2">
                    {/* Upload Area */}
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${imageUploading
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                      }`}>
                      <div className="flex flex-col items-center">
                        <Upload className="h-10 w-10 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 mb-2">
                          {imageUploading ? "Uploading image..." : "Drag & drop or click to upload"}
                        </p>
                        <p className="text-xs text-gray-500 mb-3">
                          PNG, JPG, WebP or GIF (max 10MB)
                        </p>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('edit-file-upload')?.click()}
                            disabled={imageUploading}
                          >
                            Choose File
                          </Button>
                          {formData.imageUrl && !imageFile && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const url = prompt("Enter image URL:", formData.imageUrl);
                                if (url !== null) {
                                  setFormData(prev => ({ ...prev, imageUrl: url }));
                                }
                              }}
                            >
                              Edit URL
                            </Button>
                          )}
                        </div>

                        <input
                          id="edit-file-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                          disabled={imageUploading}
                        />
                      </div>
                    </div>

                    {/* Image Preview */}
                    {(imagePreview || formData.imageUrl) && (
                      <div className="relative">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          <div className="w-full sm:w-32 h-32 border rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                            <img
                              src={imagePreview || formData.imageUrl}
                              alt="Campaign preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://placehold.co/400x400/cccccc/666666?text=Invalid+Image";
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm">
                              <p className="font-medium text-gray-700">Image Preview</p>
                              <p className="text-gray-600 mt-1 text-xs break-words">
                                {imageFile
                                  ? `Selected: ${imageFile.name} (${(imageFile.size / 1024 / 1024).toFixed(2)}MB)`
                                  : formData.imageUrl
                                    ? "Current image (upload new to replace)"
                                    : "No image selected"
                                }
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={removeImage}
                            className="text-gray-500 hover:text-red-600 hover:bg-red-50 self-start sm:self-auto"
                            title="Remove image"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Manual URL Input (fallback) */}
                    <div className="pt-3 border-t">
                      <Label htmlFor="edit-image-url" className="text-sm font-medium">
                        Or enter image URL manually:
                      </Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          id="edit-image-url"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                          placeholder="https://example.com/image.jpg"
                          disabled={!!imageFile}
                          className="flex-1"
                        />
                        <Upload className="h-4 w-4 opacity-60 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Start Date */}
                <div>
                  <Label htmlFor="edit-start-date" className="text-sm font-medium">Start Date</Label>
                  <Input
                    id="edit-start-date"
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="mt-1"
                  />
                </div>

                {/* End Date */}
                <div>
                  <Label htmlFor="edit-end-date" className="text-sm font-medium">End Date</Label>
                  <Input
                    id="edit-end-date"
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="mt-1"
                  />
                </div>

                {/* Max Products per User */}
                <div>
                  <Label htmlFor="edit-max-products" className="text-sm font-medium">Max Products per User (Optional)</Label>
                  <Input
                    id="edit-max-products"
                    type="number"
                    min="1"
                    placeholder="Leave empty for unlimited"
                    value={formData.maxProductsPerUser}
                    onChange={(e) => setFormData({ ...formData, maxProductsPerUser: e.target.value })}
                    className="mt-1"
                  />
                </div>

                {/* Active Status */}
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <input
                      id="edit-is-active"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <Label htmlFor="edit-is-active" className="text-sm font-medium">Campaign is active</Label>
                  </div>
                </div>

                {/* Add some padding at the bottom to ensure all fields are visible */}
                <div className="md:col-span-2 h-4"></div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t bg-white">
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateCampaignMutation.isPending || imageUploading}
              >
                <Save className="h-4 w-4 mr-2" />
                {updateCampaignMutation.isPending || imageUploading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}