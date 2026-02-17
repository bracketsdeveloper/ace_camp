// src/pages/occasional-campaigns.tsx
import { useState, useCallback, useMemo, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle, Calendar, Users, Gift, Package, ShoppingCart, X, Image as ImageIcon, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import heroBgImage from '@assets/element_1.png';
// Add this import with other image imports at the top of the file
import specialOccasionsImg from '@assets/special_occassions.jpg';

type Campaign = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  maxProductsPerUser?: number | null;
  createdAt: string;
  updatedAt: string;
};

type Product = {
  id: string;
  name: string;
  price: string;
  images: string[];
  colors: string[];
  stock: number;
  sku: string;
  categoryIds: string[];
  categories?: Array<{ id: string; name: string }>;
  isActive: boolean;
  specifications?: string;
  packagesInclude?: string[];
  sizes?: { unit: string; values: string[] } | null;
  category?: {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
  } | null;
};

type Branding = {
  id: string;
  logoUrl: string | null;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  bannerUrl: string | null;
  bannerText: string | null;
  updatedAt: string;
  inrPerPoint?: string;
};

// Product Detail Modal Component
function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  isAddingToCart,
}: {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: { product: Product, color?: string, size?: string }) => void;
  isAddingToCart: boolean;
}) {
  const { data: branding } = useQuery<Branding>({
    queryKey: ["/api/admin/branding"],
  });

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && product) {
      setSelectedColor(product.colors?.[0] || "");
      setSelectedSize("");
    }
  }, [isOpen, product]);

  const inrPerPoint = parseFloat(branding?.inrPerPoint || "1");
  const pointsRequired = Math.ceil(parseFloat(product?.price || "0") / inrPerPoint);

  // Handle image navigation
  const handlePrevImage = () => {
    if (!product?.images) return;
    setSelectedImageIndex((prev) =>
      prev === 0 ? product.images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    if (!product?.images) return;
    setSelectedImageIndex((prev) =>
      prev === product.images.length - 1 ? 0 : prev + 1
    );
  };

  // Get color display style
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
    if (!product) return;

    if (product.colors && product.colors.length > 0 && !selectedColor) {
      toast({
        title: "Please select a color",
        variant: "destructive",
      });
      return;
    }

    if (product.sizes?.values?.length > 0 && !selectedSize) {
      toast({
        title: "Please select a size",
        variant: "destructive",
      });
      return;
    }

    onAddToCart({ product, color: selectedColor, size: selectedSize });
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        <div className="grid md:grid-cols-2 gap-0 min-h-[600px]">
          {/* Image Section */}
          <div className="flex flex-col p-6 bg-white">
            <div className="flex-1 relative flex items-center justify-center min-h-[400px] bg-gray-50 rounded-lg mb-4">
              {product.images && product.images.length > 0 ? (
                <>
                  <img
                    src={product.images[selectedImageIndex]}
                    alt={product.name}
                    className="w-full h-full object-contain p-4"
                    onError={(e) => {
                      e.currentTarget.src = "https://placehold.co/600x400/f8fafc/64748b?text=No+Image";
                      e.currentTarget.className = "w-full h-full object-contain bg-gray-100 p-4";
                    }}
                  />
                  {product.images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                        {product.images.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedImageIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${selectedImageIndex === idx
                              ? 'bg-blue-600 scale-125'
                              : 'bg-gray-300 hover:bg-gray-400'
                              }`}
                            aria-label={`View image ${idx + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-4">
                  <ImageIcon className="w-24 h-24 text-gray-300 mb-4" />
                  <p className="text-gray-400">No image available</p>
                </div>
              )}
            </div>

            {/* Image Thumbnails */}
            {product.images && product.images.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto pt-4">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border-2 transition-colors ${selectedImageIndex === index
                      ? 'border-blue-500'
                      : 'border-transparent hover:border-gray-300'
                      }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "https://placehold.co/600x400/f8fafc/64748b?text=Thumb";
                        e.currentTarget.className = "w-full h-full object-cover";
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="p-8 bg-muted/30 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">{product.name}</h2>
                <p className="text-gray-500 mt-1">{product.sku}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close"
                className="hover:bg-gray-100 rounded-full"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Price Display */}
            <div className="mb-6">
              <div className="text-3xl font-bold text-blue-600">
                ₹{parseFloat(product.price).toFixed(2)}
              </div>
              {branding?.inrPerPoint && (
                <div className="text-sm text-gray-500 mt-1">
                  Equivalent to {pointsRequired} points
                </div>
              )}
            </div>

            {/* Stock Status */}
            <div className="mb-6">
              <Badge
                variant={product.stock > 0 ? "default" : "destructive"}
                className="text-sm py-1 px-3"
              >
                {product.stock > 0
                  ? `${product.stock} items in stock`
                  : 'Out of stock'}
              </Badge>
            </div>

            {/* Specifications */}
            {product.specifications && (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Specifications:</h4>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                    {product.specifications}
                  </div>
                </div>
              </div>
            )}

            {/* Packages Include */}
            {product.packagesInclude && product.packagesInclude.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Packages Include:</h4>
                <div className="space-y-2 text-sm bg-white rounded-lg p-4 shadow-sm">
                  {product.packagesInclude.map((item, index) => (
                    <div key={index} className="flex items-start">
                      <CheckCircle className="text-green-600 mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            {product.categories && product.categories.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Categories:</h4>
                <div className="flex flex-wrap gap-2">
                  {product.categories.map((category) => (
                    <Badge
                      key={category.id}
                      variant="outline"
                      className="text-sm"
                    >
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Size selection */}
            {product.sizes?.values?.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Choose Size ({product.sizes.unit}):</h4>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.values.map((size) => (
                    <Button
                      key={size}
                      variant={selectedSize === size ? "default" : "outline"}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selection */}
            {product.colors && product.colors.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Choose Color:</h4>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-12 h-12 rounded-full border-2 transition-all duration-200 ${selectedColor === color
                        ? "ring-2 ring-blue-500 ring-offset-2"
                        : "border-gray-300 hover:border-blue-400"
                        } ${getColorStyle(color)}`}
                      style={getColorInlineStyle(color)}
                      onClick={() => setSelectedColor(color)}
                      aria-pressed={selectedColor === color}
                      aria-label={`Select color ${color}`}
                      title={color}
                    />
                  ))}
                </div>
                {selectedColor && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: <span className="font-medium">{selectedColor}</span>
                  </p>
                )}
              </div>
            )}

            {/* Add to Cart Button */}
            <div className="mt-auto">
              <Button
                className="w-full py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={handleAddToCart}
                disabled={product.stock === 0 || isAddingToCart}
                size="lg"
              >
                <ShoppingCart className="mr-3 h-6 w-6" />
                {isAddingToCart ? 'Adding to Cart...' : 'Add to Cart'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Campaign Card Component
function CampaignCard({
  campaign,
  onSelect,
  isSelected
}: {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
  isSelected: boolean;
}) {
  const isActiveCampaign = useMemo(() => {
    if (!campaign.isActive) return false;
    const now = new Date();
    const startDate = campaign.startDate ? new Date(campaign.startDate) : null;
    const endDate = campaign.endDate ? new Date(campaign.endDate) : null;

    if (startDate && now < startDate) return false;
    if (endDate && now > endDate) return false;
    return true;
  }, [campaign]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-lg ${isSelected
        ? 'border-blue-600 ring-4 ring-blue-100'
        : 'border-gray-200 hover:border-blue-300'
        } ${!isActiveCampaign ? 'opacity-70' : ''}`}
      onClick={() => isActiveCampaign && onSelect(campaign)}
    >
      <div className="relative">
        {campaign.imageUrl ? (
          <img
            src={campaign.imageUrl}
            alt={campaign.name}
            className="w-full h-48 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://placehold.co/600x400/f0f9ff/2563eb?text=Campaign";
            }}
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center">
            <Gift className="w-16 h-16 text-blue-300" />
          </div>
        )}
        <div className="absolute top-4 right-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${isActiveCampaign
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
            }`}>
            {isActiveCampaign ? 'Active' : 'Inactive'}
          </div>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{campaign.name}</h3>
        <div className="text-gray-600 mb-4 line-clamp-2 whitespace-pre-wrap">
          {campaign.description || "No description provided"}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>Start: {formatDate(campaign.startDate)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>End: {formatDate(campaign.endDate)}</span>
          </div>
        </div>

        <Button
          className={`w-full mt-4 ${isSelected
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : isActiveCampaign
              ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          size="lg"
          disabled={!isActiveCampaign}
        >
          {isSelected ? 'Viewing Products' : 'View Products'}
        </Button>
      </div>
    </div>
  );
}

// Product Card Component
function ProductCard({
  product,
  onSelect,
  isSelected,
  onAddToCart,
  isAddingToCart,
  onViewDetails
}: {
  product: Product;
  onSelect: (product: Product) => void;
  isSelected: boolean;
  onAddToCart: (item: { product: Product, color?: string, size?: string }) => void;
  isAddingToCart: boolean;
  onViewDetails: (product: Product) => void;
}) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = "https://placehold.co/600x400/f8fafc/64748b?text=No+Image";
    e.currentTarget.className = "w-full h-48 object-contain bg-gray-100";
  };

  const mainImage = product.images && product.images.length > 0
    ? product.images[selectedImageIndex]
    : null;

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden transition-all duration-300 hover:border-gray-300">
      {/* Product Images */}
      <div className="relative">
        {mainImage ? (
          <div className="w-full h-48 bg-gray-50 cursor-pointer" onClick={() => onViewDetails(product)}>
            <img
              src={mainImage}
              alt={product.name}
              className="w-full h-full object-contain p-4"
              onError={handleImageError}
            />
            {/* Image indicator dots */}
            {product.images && product.images.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                {product.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImageIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${selectedImageIndex === idx
                      ? 'bg-blue-600 scale-125'
                      : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    aria-label={`View image ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full h-48 bg-gradient-to-r from-gray-100 to-gray-200 flex flex-col items-center justify-center p-4 cursor-pointer"
            onClick={() => onViewDetails(product)}
          >
            <ImageIcon className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-400 text-sm text-center">No image available</p>
          </div>
        )}
        <div className="absolute top-4 right-4">
          <Badge variant={product.stock > 0 ? "default" : "destructive"}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </Badge>
        </div>
        {/* View Details Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(product);
          }}
          className="absolute top-4 left-4 bg-white/90 hover:bg-white text-gray-700 hover:text-blue-600 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 transition-colors"
          title="View details"
        >
          <Eye className="w-4 h-4" />
          Details
        </button>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h4
              className="font-bold text-gray-900 mb-1 line-clamp-1 cursor-pointer hover:text-blue-600"
              onClick={() => onViewDetails(product)}
            >
              {product.name}
            </h4>
            <p className="text-sm text-gray-500 mb-2">{product.sku}</p>
          </div>
          <div className="text-lg font-bold text-blue-600 whitespace-nowrap ml-2">
            ₹{parseFloat(product.price).toFixed(2)}
          </div>
        </div>

        {/* Product Description */}
        {product.specifications && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1 line-clamp-2 whitespace-pre-wrap">
              {product.specifications}
            </p>
          </div>
        )}

        {product.categories && product.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {product.categories.slice(0, 2).map((category) => (
              <Badge key={category.id} variant="outline" className="text-xs">
                {category.name}
              </Badge>
            ))}
            {product.categories.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{product.categories.length - 2} more
              </Badge>
            )}
          </div>
        )}

        {product.colors && product.colors.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-600 mb-1">Colors:</p>
            <div className="flex flex-wrap gap-1">
              {product.colors.slice(0, 3).map((color, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs bg-gray-100 rounded"
                  title={color}
                >
                  {color.length > 10 ? `${color.substring(0, 8)}...` : color}
                </span>
              ))}
              {product.colors.length > 3 && (
                <span className="px-2 py-1 text-xs bg-gray-100 rounded">
                  +{product.colors.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button
            variant={isSelected ? "default" : "outline"}
            className="flex-1"
            onClick={() => onSelect(product)}
            disabled={product.stock === 0}
          >
            {isSelected ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Selected
              </>
            ) : (
              'Select'
            )}
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={() => onAddToCart({ product })}
            disabled={product.stock === 0 || isAddingToCart}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {isAddingToCart ? 'Adding...' : 'Add to Cart'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Campaign Hero Component - Updated to use special_occassions.jpg as background
function CampaignHero({
  companyName
}: {
  companyName: string;
}) {
  return (
    <div
      className="relative min-h-[400px] md:min-h-[500px] rounded-2xl mx-4 mt-4 mb-8 overflow-hidden shadow-xl"
      style={{
        backgroundImage: `url(${specialOccasionsImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/20"></div>
      <div className="relative z-10 h-full flex items-center justify-center text-center text-white px-4">

      </div>
    </div>
  );
}

// Products Modal Component
function ProductsModal({
  campaign,
  isOpen,
  onClose,
  selectedProduct,
  onSelectProduct,
  onAddToCart,
  isAddingToCart,
  onViewProductDetails,
}: {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
  selectedProduct: Product | null;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (item: { product: Product, color?: string, size?: string }) => void;
  isAddingToCart: boolean;
  onViewProductDetails: (product: Product) => void;
}) {
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: [`/api/campaigns/${campaign.id}/products`],
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{campaign.name}</h2>
            <div className="text-gray-600 whitespace-pre-wrap">
              {campaign.description || "No description provided"}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading products...</div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Package className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">No products available in this campaign</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Available Products ({products.length})
                </h3>
                <p className="text-gray-600">
                  Select one product from this campaign to order
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                    isSelected={selectedProduct?.id === product.id}
                    onAddToCart={onAddToCart}
                    isAddingToCart={isAddingToCart}
                    onViewDetails={onViewProductDetails}
                  />
                ))}
              </div>

              {selectedProduct && (
                <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-800">Product Selected</span>
                      </div>
                      <p className="text-green-700">
                        You've selected <span className="font-bold">{selectedProduct.name}</span>
                        for ₹{parseFloat(selectedProduct.price).toFixed(2)}
                      </p>
                      {selectedProduct.specifications && (
                        <p className="text-green-600 text-sm mt-1 line-clamp-1">
                          {selectedProduct.specifications}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => onViewProductDetails(selectedProduct)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                        onClick={() => onAddToCart({ product: selectedProduct })}
                        disabled={isAddingToCart}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {isAddingToCart ? 'Processing...' : 'Add to Cart'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OccasionalCampaigns() {
  const { employee, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productForDetails, setProductForDetails] = useState<Product | null>(null);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [showProductDetailModal, setShowProductDetailModal] = useState(false);

  const { data: branding } = useQuery<Branding>({
    queryKey: ["/api/admin/branding"],
  });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  // Sort campaigns by date (newest first)
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [campaigns]);

  // Filter active campaigns
  const activeCampaigns = useMemo(() => {
    return sortedCampaigns.filter(campaign => {
      if (!campaign.isActive) return false;
      const now = new Date();
      const startDate = campaign.startDate ? new Date(campaign.startDate) : null;
      const endDate = campaign.endDate ? new Date(campaign.endDate) : null;

      if (startDate && now < startDate) return false;
      if (endDate && now > endDate) return false;
      return true;
    });
  }, [sortedCampaigns]);

  const addToCartMutation = useMutation({
    mutationFn: async (data: { product: Product; color?: string; size?: string; campaignId?: string }) => {
      if (!employee) throw new Error("You must be logged in to add items to cart");
      if (!token) throw new Error("Authentication token not found");

      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: data.product.id,
          selectedColor: data.color || null,
          selectedSize: data.size || null,
          quantity: 1,
          campaignId: data.campaignId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add to cart");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Product added to cart. You can now proceed to checkout.",
      });
      setSelectedProduct(null);
      setSelectedCampaign(null);
      setShowProductsModal(false);
      setShowProductDetailModal(false);
      // Invalidate cart query to refresh cart data
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      // Invalidate campaigns to hide fully utilized ones
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add product to cart",
        variant: "destructive",
      });
    },
  });

  const handleCampaignSelect = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setSelectedProduct(null);
    setShowProductsModal(true);
  }, []);

  const handleProductSelect = useCallback((product: Product) => {
    setSelectedProduct(product);
  }, []);

  const handleAddToCart = useCallback((item: { product: Product, color?: string, size?: string }) => {
    const { product, color, size } = item;
    if (!employee) {
      toast({
        title: "Login Required",
        description: "Please log in to add products to cart",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      toast({
        title: "Authentication Error",
        description: "Please refresh the page and try again",
        variant: "destructive",
      });
      return;
    }

    if (product.stock === 0) {
      toast({
        title: "Out of Stock",
        description: "This product is currently out of stock",
        variant: "destructive",
      });
      return;
    }

    // Pass campaignId if selected
    addToCartMutation.mutate({
      product,
      color,
      size,
      campaignId: selectedCampaign?.id
    });
  }, [selectedCampaign, addToCartMutation, employee, token, toast]);

  const handleViewProductDetails = useCallback((product: Product) => {
    setProductForDetails(product);
    setShowProductDetailModal(true);
  }, []);

  const companyName = branding?.companyName || "Your Company";

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <CampaignHero
        companyName={companyName}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">


        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading campaigns...</div>
          </div>
        ) : activeCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-gray-200">
            <Gift className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No active campaigns available at the moment</p>
            <p className="text-gray-400 mt-2">Check back soon for new campaigns!</p>
          </div>
        ) : (
          <>
            {/* Campaigns Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
              {activeCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onSelect={handleCampaignSelect}
                  isSelected={selectedCampaign?.id === campaign.id}
                />
              ))}
            </div>

            {/* Selected Campaign Info */}
            {selectedCampaign && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    Selected Campaign: {selectedCampaign.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-gray-600 mb-4 whitespace-pre-wrap">
                    {selectedCampaign.description || "No description provided"}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>From: {new Date(selectedCampaign.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>To: {new Date(selectedCampaign.endDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}


      </div>

      {/* Products Modal */}
      {selectedCampaign && (
        <ProductsModal
          campaign={selectedCampaign}
          isOpen={showProductsModal}
          onClose={() => {
            setShowProductsModal(false);
            setSelectedProduct(null);
          }}
          selectedProduct={selectedProduct}
          onSelectProduct={handleProductSelect}
          onAddToCart={handleAddToCart}
          isAddingToCart={addToCartMutation.isPending}
          onViewProductDetails={handleViewProductDetails}
        />
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={productForDetails}
        isOpen={showProductDetailModal}
        onClose={() => {
          setShowProductDetailModal(false);
          setProductForDetails(null);
        }}
        onAddToCart={handleAddToCart}
        isAddingToCart={addToCartMutation.isPending}
      />

      <Footer />
    </div>
  );
}