// src/components/product/product-card.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, ShoppingCart, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ProductCardProps {
  product: any;
  onView: (product: any) => void;
  onAddToCart: (product: any, color: string, quantity: number) => void;
}

export function ProductCard({ product, onView, onAddToCart }: ProductCardProps) {
  const { data: branding } = useQuery<any>({
    queryKey: ["/api/admin/branding"],
  });

  const inrPerPoint = parseFloat(branding?.inrPerPoint || "1");
  const pointsRequired = Math.ceil(parseFloat(product.price) / inrPerPoint);
  const isOutOfStock = product.stock === 0;

  // Use the first image as the main product image
  const mainImage = product.images?.[0] || '/placeholder-product.jpg';

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent the view modal from opening if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onView(product);
  };

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOutOfStock) {
      const defaultColor = product.colors?.[0] || "";
      onAddToCart(product, defaultColor, 1);
    }
  };

  return (
    <div onClick={handleCardClick}>
      <Card
        className="hover-elevate active-elevate-2 cursor-pointer overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300"
        data-testid={`card-product-${product.id}`}
      >
        <CardContent className="p-0">
          {/* Product Image */}
          <div className="aspect-square bg-gray-50 overflow-hidden relative">
            <img
              src={mainImage}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              data-testid={`img-product-${product.id}`}
            />

            {/* Out of Stock Overlay */}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-white px-3 py-1 rounded-full text-sm font-medium">
                  Out of Stock
                </div>
              </div>
            )}

            {/* Backup Product Indicator */}
            {product.isBackup && (
              <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                Backup
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(product);
                }}
                data-testid={`button-view-${product.id}`}
              >
                <Eye className="h-4 w-4" />
              </Button>

              {!isOutOfStock && (
                <Button
                  size="sm"
                  className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleAddToCartClick}
                  data-testid={`button-add-to-cart-${product.id}`}
                >
                  <ShoppingCart className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="p-4">
            <h3
              className="font-medium text-base line-clamp-2 mb-2 text-gray-900"
              data-testid={`text-product-name-${product.id}`}
            >
              {product.name}
            </h3>
            {product.brand && (
              <p className="text-sm font-semibold text-blue-600 mb-2">
                {product.brand}
              </p>
            )}

            {/* Color Options (if available) */}
            {product.colors && product.colors.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-600 mb-1">Available Colors</p>
                <div className="flex space-x-1">
                  {product.colors.slice(0, 4).map((color: string) => (
                    <div
                      key={color}
                      className={`w-4 h-4 rounded-full border border-gray-300 ${color.match(/^#[0-9A-Fa-f]{6}$/)
                        ? ''
                        : getColorClass(color)
                        }`}
                      style={color.match(/^#[0-9A-Fa-f]{6}$/) ? { backgroundColor: color } : {}}
                      title={color}
                    />
                  ))}
                  {product.colors.length > 4 && (
                    <div className="w-4 h-4 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center">
                      <span className="text-xs text-gray-500">+{product.colors.length - 4}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Price in Points */}
            <div className="flex items-center justify-between">
              <p
                className="text-lg font-semibold text-blue-600"
                data-testid={`text-points-required-${product.id}`}
              >
                {pointsRequired} points
              </p>

              {/* Original Price (if available) */}
              {product.originalPrice && (
                <p className="text-sm text-gray-500 line-through">
                  INR {parseFloat(product.originalPrice).toLocaleString()}
                </p>
              )}
            </div>

            {/* Stock Status */}
            <div className="mt-2">
              {isOutOfStock ? (
                <div className="flex items-center text-red-600 text-sm">
                  <X className="h-4 w-4 mr-1" />
                  <span>Out of Stock</span>
                </div>
              ) : product.stock < 10 ? (
                <p className="text-orange-600 text-sm">
                  Only {product.stock} left in stock
                </p>
              ) : (
                <p className="text-green-600 text-sm">In Stock</p>
              )}
            </div>

            {/* Mobile Action Buttons (visible on mobile) */}
            <div className="flex space-x-2 mt-3 lg:hidden">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(product);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>

              {!isOutOfStock && (
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={handleAddToCartClick}
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Add to Cart
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to map color names to Tailwind classes
function getColorClass(color: string): string {
  const colorMap: Record<string, string> = {
    black: "bg-black",
    white: "bg-white",
    blue: "bg-blue-600",
    red: "bg-red-600",
    green: "bg-green-600",
    yellow: "bg-yellow-400",
    purple: "bg-purple-600",
    pink: "bg-pink-500",
    gray: "bg-gray-500",
    charcoal: "bg-gray-800",
    navy: "bg-blue-900",
    'space-gray': "bg-gray-600",
    silver: "bg-gray-300",
    gold: "bg-yellow-300",
    'rose-gold': "bg-gradient-to-br from-rose-300 to-amber-200",
  };

  return colorMap[color.toLowerCase()] || "bg-gray-400";
}