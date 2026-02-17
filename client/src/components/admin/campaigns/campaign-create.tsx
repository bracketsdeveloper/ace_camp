import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Upload, X } from "lucide-react";
import { uploadFiles } from "@/lib/admin-utils";

export function CampaignCreate() {
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

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/campaigns", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign created successfully" });
      setFormData({
        name: "",
        description: "",
        imageUrl: "",
        isActive: true,
        startDate: "",
        endDate: "",
        maxProductsPerUser: "",
      });
      setImageFile(null);
      setImagePreview("");
    },
    onError: (e: any) => {
      toast({
        title: "Create failed",
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

    // If there's a file, upload it first
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

    // Format dates for API
    const campaignData = {
      ...formData,
      imageUrl: finalImageUrl,
      startDate: formData.startDate ? formData.startDate + ":00.000Z" : null,
      endDate: formData.endDate ? formData.endDate + ":00.000Z" : null,
      maxProductsPerUser: formData.maxProductsPerUser ? parseInt(formData.maxProductsPerUser) : null,
    };

    createCampaignMutation.mutate(campaignData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Campaign</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Campaign Name */}
            <div className="md:col-span-2">
              <Label htmlFor="campaign-name">Campaign Name *</Label>
              <Input
                id="campaign-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter campaign name"
                required
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <Label htmlFor="campaign-description">Description</Label>
              <Textarea
                id="campaign-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the campaign"
                rows={3}
              />
            </div>

            {/* Image Upload */}
            <div className="md:col-span-2">
              <Label htmlFor="campaign-image">Campaign Image</Label>

              <div className="flex flex-col gap-4">
                {/* Upload Area */}
                <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${imageUploading
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                  }`}>
                  <div className="flex flex-col items-center">
                    <Upload className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600 mb-2">
                      {imageUploading ? "Uploading image..." : "Drag & drop or click to upload"}
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                      PNG, JPG, WebP or GIF (max 10MB)
                    </p>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={imageUploading}
                      >
                        Choose File
                      </Button>
                      {formData.imageUrl && !imageFile && (
                        <Button
                          type="button"
                          variant="outline"
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
                      id="file-upload"
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
                    <div className="flex items-start gap-4">
                      <div className="w-40 h-40 border rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
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
                          <p className="text-gray-600 mt-1">
                            {imageFile
                              ? `Selected: ${imageFile.name} (${(imageFile.size / 1024 / 1024).toFixed(2)}MB)`
                              : formData.imageUrl
                                ? "Using URL: " + (formData.imageUrl.length > 50 ? formData.imageUrl.substring(0, 50) + "..." : formData.imageUrl)
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
                        className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                        title="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Manual URL Input (fallback) */}
                <div className="pt-4 border-t">
                  <Label htmlFor="manual-image-url" className="text-sm">
                    Or enter image URL manually:
                  </Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="manual-image-url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      disabled={!!imageFile}
                    />
                    <Upload className="h-5 w-5 opacity-60" />
                  </div>
                </div>
              </div>
            </div>

            {/* Start Date */}
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            {/* End Date */}
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>

            {/* Max Products per User */}
            <div>
              <Label htmlFor="max-products">Max Products per User (Optional)</Label>
              <Input
                id="max-products"
                type="number"
                min="1"
                placeholder="Leave empty for unlimited"
                value={formData.maxProductsPerUser}
                onChange={(e) => setFormData({ ...formData, maxProductsPerUser: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Limit how many products a user can select/order from this campaign.
              </p>
            </div>

            {/* Active Status */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2">
                <input
                  id="is-active"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <Label htmlFor="is-active">Campaign is active</Label>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={createCampaignMutation.isPending || imageUploading}
            >
              <Plus className="h-4 w-4 mr-2" />
              {createCampaignMutation.isPending || imageUploading ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
