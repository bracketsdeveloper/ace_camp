// src/pages/dashboard.tsx
import { useState, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProductCard } from "@/components/product/product-card";
import { ProductDetailModal } from "@/components/product/product-detail-modal";
import { ConfirmationModal } from "@/components/admin/orders/confirmation-modal";
import { OrderConfirmationModal } from "@/components/admin/orders/order-confirmation-modal";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle, X, ShoppingCart, Tag, ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { SiApple, SiSamsung, SiSony, SiNike, SiAdidas, SiPuma } from "react-icons/si";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

// Import images
import element5Img from '@assets/element_5.png';
import backpackImg from '@assets/generated_images/professional_laptop_backpack_product.png';
import specialOccasionsImg from '@assets/unboxing_happiness.jpg'; // Declared at top

type Branding = {
  id: string;
  logoUrl: string | null;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  bannerUrl: string | null;
  bannerText: string | null;
  updatedAt: string;
  inrPerPoint: string;
  maxSelectionsPerUser: number;
};

type Product = {
  id: string;
  name: string;
  price: string;
  images: string[];
  colors: string[];
  stock: number;
  packagesInclude?: string[];
  specifications?: string;
  sku?: string;
  isActive?: boolean;
  backupProductId?: string | null;
  isBackup?: boolean;
  originalProductId?: string | null;
  categoryIds?: string[];
  categories?: Category[];
  category?: {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
  } | null;
  brandStore?: boolean;
  brand?: string;
};

type Category = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
};

// Add CampaignProduct type
type CampaignProduct = {
  campaignProduct: {
    id: string;
    campaignId: string;
    productId: string;
    createdAt: string;
  };
  product: Product;
};

// Brands Showcase Component
function BrandsShowcase() {
  const brands = [
    { icon: SiApple, name: "Apple" },
    { icon: SiSamsung, name: "Samsung" },
    { icon: SiSony, name: "Sony" },
    { icon: SiNike, name: "Nike" },
    { icon: SiAdidas, name: "Adidas" },
    { icon: SiPuma, name: "Puma" },
  ];

  return (
    <div className="py-12 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold text-center mb-8" data-testid="text-brands-title">
          Brands we deal in
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center">
          {brands.map((brand) => (
            <div
              key={brand.name}
              className="flex items-center justify-center grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
              data-testid={`brand-${brand.name.toLowerCase()}`}
            >
              <brand.icon className="w-12 h-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Filter Sidebar Component
function FilterSidebar({
  selectedCategories,
  onCategoryChange,
  categories,
  selectedBrands,
  onBrandChange,
  brands,
  priceRange,
  onPriceChange,
  clearFilters
}: {
  selectedCategories: string[];
  onCategoryChange: (categoryId: string, checked: boolean) => void;
  categories: Category[];
  selectedBrands: string[];
  onBrandChange: (brand: string, checked: boolean) => void;
  brands: string[];
  priceRange: { min: number; max: number };
  onPriceChange: (min: number, max: number) => void;
  clearFilters: () => void;
}) {
  return (
    <div className="w-full lg:w-64 bg-white rounded-xl shadow-sm border p-6 sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg text-gray-900">Filters</h3>
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-blue-600">
          Clear All
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={["categories", "brands", "price"]} className="w-full">
        {/* Categories Filter */}
        <AccordionItem value="categories">
          <AccordionTrigger className="text-base font-medium py-3">Categories</AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-[200px] pr-3">
              <div className="space-y-3 pt-1">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cat-${category.id}`}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={(checked) => onCategoryChange(category.id, checked as boolean)}
                    />
                    <label
                      htmlFor={`cat-${category.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {category.name}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>

        {/* Brands Filter */}
        <AccordionItem value="brands">
          <AccordionTrigger className="text-base font-medium py-3">Brands</AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-[200px] pr-3">
              <div className="space-y-3 pt-1">
                {brands.length > 0 ? (
                  brands.map((brand) => (
                    <div key={brand} className="flex items-center space-x-2">
                      <Checkbox
                        id={`brand-${brand}`}
                        checked={selectedBrands.includes(brand)}
                        onCheckedChange={(checked) => onBrandChange(brand, checked as boolean)}
                      />
                      <label
                        htmlFor={`brand-${brand}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {brand}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No brands available</p>
                )}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>

        {/* Price Range Filter */}
        <AccordionItem value="price">
          <AccordionTrigger className="text-base font-medium py-3">Price Range (Points)</AccordionTrigger>
          <AccordionContent>
            <div className="pt-2 px-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="min-price" className="text-xs">Min</Label>
                  <Input
                    id="min-price"
                    type="number"
                    value={priceRange.min}
                    onChange={(e) => onPriceChange(Number(e.target.value), priceRange.max)}
                    className="h-8"
                    min={0}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="max-price" className="text-xs">Max</Label>
                  <Input
                    id="max-price"
                    type="number"
                    value={priceRange.max}
                    onChange={(e) => onPriceChange(priceRange.min, Number(e.target.value))}
                    className="h-8"
                    min={0}
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// Product of the Month Component
function ProductOfTheMonth() {
  return (
    <div className="w-full lg:w-80 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-24">
      <div className="text-center mb-4">
        <h3 className="font-bold text-xl text-gray-900 mb-2">Product of the Month</h3>
        <div className="w-16 h-1 bg-blue-600 mx-auto rounded-full"></div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <img
          src={backpackImg}
          alt="Product of the Month"
          className="w-full h-48 object-contain mb-4 rounded-lg"
        />
        <h4 className="font-semibold text-gray-900 text-center mb-2">
          Professional Laptop Backpack
        </h4>
        <p className="text-gray-600 text-sm text-center mb-3">
          Premium quality with ergonomic design
        </p>
        <div className="flex justify-center items-center space-x-2">
          <span className="text-2xl font-bold text-blue-600">1200</span>
          <span className="text-gray-500 line-through text-sm">1500</span>
          <span className="bg-green-100 text-green-600 text-xs font-medium px-2 py-1 rounded-full">
            -20%
          </span>
        </div>
      </div>

      <Button
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
      >
        View Details
      </Button>
    </div>
  );
}

// Hero Component
function Hero({ backgroundImage, companyName, employeeName }: {
  backgroundImage?: string;
  companyName: string;
  employeeName: string;
}) {
  const heroStyle = useMemo<React.CSSProperties>(() => {
    if (backgroundImage) {
      return {
        backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.3) 100%), url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }
    return {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    };
  }, [backgroundImage]);

  return (
    <div
      className="relative h-96 rounded-2xl mx-4 mt-4 mb-8 overflow-hidden shadow-xl"
      style={heroStyle}
    >
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="relative z-10 h-full flex items-center justify-center text-center text-white">
        <div className="max-w-4xl px-6">
          <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">
            Welcome to {companyName}
          </h1>
          <p className="text-2xl font-semibold mb-6 drop-shadow-md">
            CORPORATE BRAND STORE
          </p>
          <p className="text-xl opacity-90 drop-shadow-md">
            Dear {employeeName}, choose from our exclusive collection of premium gifts
          </p>
        </div>
      </div>
    </div>
  );
}

// Updated Special Occasions Hero Section
function SpecialOccasionsHero({
  companyName,
  employeeName,
  onSelectAllCategories
}: {
  companyName: string;
  employeeName: string;
  onSelectAllCategories: () => void;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-xl mb-8 min-h-[400px] md:min-h-[500px]">
      {/* Background Image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${specialOccasionsImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Optional overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/20"></div>
      </div>

      <div className="relative z-10 h-full flex flex-col md:flex-row items-center p-8 md:p-12">
        {/* Left side - Text content removed */}
        <div className="flex-1 text-center md:text-left mb-8 md:mb-0 md:pr-12">
          {/* Empty space where text was */}
        </div>

        {/* Right side - Element 5 image removed */}
        <div className="flex-1 flex items-center justify-center">
          {/* Empty space where image was */}
        </div>

        {/* Buttons container - positioned absolutely at the bottom center */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-lg px-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={onSelectAllCategories}
              size="lg"
              className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8 py-3 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              Browse All Products
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent hover:bg-white/20 text-white border-white/30 hover:border-white font-semibold px-8 py-3 rounded-xl text-lg backdrop-blur-sm"
            >
              Explore Categories
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SimplePrompt({
  open,
  onClose,
  children,
  primaryActionLabel = "OK",
  onPrimaryAction,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 1000 }}
    >
      <div
        className="absolute inset-0 bg-black/50"
        style={{ zIndex: 1000 }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border p-6"
        style={{ zIndex: 1001 }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Close"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground z-10"
          onClick={onClose}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="space-y-4">
          <div className="text-base text-foreground">{children}</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted z-10"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 z-10"
              onClick={onPrimaryAction ?? onClose}
            >
              {primaryActionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default function Dashboard() {
  const { employee, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [selectedColor, setSelectedColor] = useState("");
  const [orderData, setOrderData] = useState<any>(null);
  const [showCopayPrompt, setShowCopayPrompt] = useState(false);
  const [copayAmount, setCopayAmount] = useState(0);
  const [showLogoutInPrompt, setShowLogoutInPrompt] = useState(false);
  const [showPleaseSelectPrompt, setShowPleaseSelectPrompt] = useState(false);
  const [showRecordedPrompt, setShowRecordedPrompt] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 });
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Derive unique brands from products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.brand).filter(Boolean) as string[])).sort();
  }, [products]);

  const { data: branding } = useQuery<Branding>({
    queryKey: ["/api/admin/branding"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch all campaign products
  const { data: campaignProducts = [] } = useQuery<CampaignProduct[]>({
    queryKey: ["/api/admin/campaign-products"],
    queryFn: async () => {
      const response = await fetch("/api/admin/all-campaign-products");
      if (!response.ok) throw new Error("Failed to fetch campaign products");
      return response.json();
    },
  });

  const companyName = branding?.companyName || "TechCorp";
  const inrPerPoint = parseFloat(branding?.inrPerPoint || "1");
  const maxSelections = branding?.maxSelectionsPerUser ?? 1;

  const { data: myOrders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders/my-orders"],
    retry: false,
  });

  const reachedLimit = maxSelections !== -1 && myOrders.length >= maxSelections;

  const campaignProductIds = useMemo(() => {
    return campaignProducts.map(cp => cp.product.id);
  }, [campaignProducts]);

  // ✅ MODIFIED: Filter products
  const displayProducts = useMemo(() => {
    const list = products as Product[];
    const originalsToHide = new Set(
      list.filter((p) => p.isBackup && p.originalProductId).map((p) => p.originalProductId as string)
    );

    const filteredList = list
      .filter((p) => {
        // Only show products with brandStore: true
        if (!p.brandStore) return false;

        if (!p.stock || p.stock <= 0) return false;
        if (!p.isBackup && originalsToHide.has(p.id)) return false;

        // Categories Filter (Multiple)
        if (selectedCategories.length > 0) {
          const ids = p.categoryIds ?? [];
          const hasCategory =
            ids.some(id => selectedCategories.includes(id)) ||
            (p.categories?.some((cat) => selectedCategories.includes(cat.id))) ||
            (p.category?.id && selectedCategories.includes(p.category.id));

          if (!hasCategory) return false;
        }

        // Brands Filter
        if (selectedBrands.length > 0) {
          if (!p.brand || !selectedBrands.includes(p.brand)) return false;
        }

        // Price Filter (Points)
        const points = Math.ceil(parseFloat(p.price) / inrPerPoint);
        if (points < priceRange.min || points > priceRange.max) return false;

        return true;
      })
      .map((p) => ({
        ...p,
        pointsRequired: Math.ceil(parseFloat(p.price) / inrPerPoint),
      }));

    return filteredList;
  }, [products, campaignProductIds, inrPerPoint, selectedCategories, selectedBrands, priceRange]);

  const handleCategoryChange = useCallback((categoryId: string, checked: boolean) => {
    setHasUserInteracted(true);
    setSelectedCategories(prev => checked ? [...prev, categoryId] : prev.filter(id => id !== categoryId));
  }, []);

  const handleBrandChange = useCallback((brand: string, checked: boolean) => {
    setHasUserInteracted(true);
    setSelectedBrands(prev => checked ? [...prev, brand] : prev.filter(b => b !== brand));
  }, []);

  const handlePriceChange = useCallback((min: number, max: number) => {
    setHasUserInteracted(true);
    setPriceRange({ min, max });
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setPriceRange({ min: 0, max: 100000 });
    setHasUserInteracted(false);
  }, []);

  const handleSelectAllCategories = useCallback(() => {
    setSelectedCategories([]); // "All" means empty filter in our logic
    setHasUserInteracted(true);
  }, []);

  // Determine if we should show the special occasions hero
  const shouldShowSpecialOccasionsHero = !hasUserInteracted && selectedCategories.length === 0;

  const addToCartMutation = useMutation({
    mutationFn: async (data: { productId: string; selectedColor: string | null; selectedSize: string | null; quantity: number }) => {
      if (!employee?.id) {
        throw new Error("No employee ID found. Please log in again.");
      }
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: data.productId,
          selectedColor: data.selectedColor,
          selectedSize: data.selectedSize,
          quantity: data.quantity,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add to cart");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({ title: "Added to cart successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error adding to cart", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const loadScript = () => {
      if (!document.getElementById("razorpay-script")) {
        const script = document.createElement("script");
        script.id = "razorpay-script";
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
      }
    };
    loadScript();
  }, []);

  const handleColorChange = useCallback((color: string) => {
    setSelectedColor((prev) => (prev === color ? prev : color));
  }, []);

  const handleViewProduct = useCallback(
    (product: Product) => {
      setSelectedProduct(product);
      handleColorChange(product?.colors?.[0] || "");
      setQuantity(1);
      setShowProductDetail(true);
    },
    [handleColorChange]
  );

  const handleAddToCart = useCallback(
    (product: Product, color: string | null, qty: number, size?: string | null) => {
      if (!token) {
        toast({ title: "Error", description: "Not authenticated. Please log in.", variant: "destructive" });
        return;
      }
      if (!employee?.id) {
        toast({ title: "Error", description: "Employee ID not found. Please log in again.", variant: "destructive" });
        return;
      }
      if (qty < 1 || qty > product.stock) {
        toast({
          title: "Error",
          description: `Please select a quantity between 1 and ${product.stock}`,
          variant: "destructive",
        });
        return;
      }
      if (product.colors?.length > 0 && !color) {
        toast({
          title: "Error",
          description: "Please select a color",
          variant: "destructive",
        });
        return;
      }
      // sizes check is done in modal, but we can double check here
      const productSizes = (product as any).sizes as { unit: string; values: string[] } | null;
      if (productSizes?.values?.length && !size) {
        toast({
          title: "Error",
          description: "Please select a size",
          variant: "destructive",
        });
        return;
      }

      addToCartMutation.mutate({
        productId: product.id,
        selectedColor: color || null,
        selectedSize: size || null,
        quantity: qty,
      });
    },
    [addToCartMutation, token, employee]
  );

  const handleConfirmSelection = useCallback(
    (orderResult: any) => {
      const willReachLimit = maxSelections !== -1 && myOrders.length + 1 >= maxSelections;
      setOrderData(orderResult);
      setShowConfirmation(false);
      setShowOrderConfirmation(true);
      setShowLogoutInPrompt(willReachLimit);
      setShowRecordedPrompt(true);
    },
    [maxSelections, myOrders.length]
  );

  const handleDeclineSelection = useCallback(() => {
    setShowConfirmation(false);
    setShowProductDetail(false);
    setShowPleaseSelectPrompt(true);
  }, []);

  // No longer needed
  // const handleCategoryChange = useCallback((categoryId: string) => {
  //   setSelectedCategory(categoryId);
  //   setHasUserSelectedCategory(true);
  // }, []);

  // const handleSelectAllCategories = useCallback(() => {
  //   setSelectedCategory("all");
  //   setHasUserSelectedCategory(true);
  // }, []);

  const maxDisplay = maxSelections === -1 ? "∞" : maxSelections;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {reachedLimit ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="text-green-600 text-3xl" />
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Selections Complete</h2>
            <p className="text-muted-foreground mb-6">
              You have reached the selection limit ({myOrders.length}/{maxDisplay}).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myOrders.map((o: any, idx: number) => (
                <div key={idx} className="bg-card rounded-xl shadow-sm border p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={o.product?.images?.[0]}
                        alt={o.product?.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <h4 className="font-semibold">{o.product?.name}</h4>
                      {(o.order?.selectedColor || o.order?.selectedSize) && (
                        <p className="text-sm text-muted-foreground">
                          {o.order?.selectedColor}
                          {o.order?.selectedColor && o.order?.selectedSize && " | "}
                          {o.order?.selectedSize && `Size: ${o.order?.selectedSize}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
                    <p>
                      Order ID: <span className="font-mono font-bold">{o.order?.orderId}</span>
                    </p>
                    <p>
                      Status: <span className="text-green-600 font-medium">Confirmed</span>
                    </p>
                    {o.order?.metadata?.usedPoints && (
                      <p>Used points: <span>{o.order.metadata.usedPoints}</span></p>
                    )}
                    {o.order?.metadata?.copayInr && (
                      <p>
                        Co-pay: <span className="font-bold">{o.order.metadata.copayInr} INR</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Filter Sidebar */}
              <FilterSidebar
                selectedCategories={selectedCategories}
                onCategoryChange={handleCategoryChange}
                categories={categories}
                selectedBrands={selectedBrands}
                onBrandChange={handleBrandChange}
                brands={uniqueBrands}
                priceRange={priceRange}
                onPriceChange={handlePriceChange}
                clearFilters={clearFilters}
              />

              {/* Products Grid */}
              <main className="flex-1">
                {/* Show Special Occasions Hero when no filters active */}
                {shouldShowSpecialOccasionsHero ? (
                  <SpecialOccasionsHero
                    companyName={companyName}
                    employeeName={employee?.firstName || "Employee"}
                    onSelectAllCategories={handleSelectAllCategories}
                  />
                ) : null}

                {/* Products Grid */}
                {(hasUserInteracted || displayProducts.length > 0) && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 mb-8">
                      {displayProducts.length > 0 ? (
                        displayProducts.map((product) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onView={handleViewProduct}
                            onAddToCart={handleAddToCart}
                          />
                        ))
                      ) : (
                        <div className="col-span-full text-center py-12">
                          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                            {campaignProducts.length > 0
                              ? "All brand store products are in campaigns"
                              : "No brand store products found"}
                          </h3>
                          <p className="text-muted-foreground">
                            No brand store products found matching your filters.
                          </p>
                        </div>
                      )}
                    </div>

                    {displayProducts.length > 0 && (
                      <div className="flex justify-center">
                        <Button
                          size="lg"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl"
                          data-testid="button-view-more"
                        >
                          VIEW MORE
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </main>
            </div>
          </div>

          {/* Brands Showcase Section */}
          <BrandsShowcase />
        </>
      )}

      <Footer />

      {showProductDetail && selectedProduct && (
        <ProductDetailModal
          isOpen
          onClose={() => setShowProductDetail(false)}
          product={selectedProduct}
          selectedColor={selectedColor}
          onColorChange={handleColorChange}
          quantity={quantity}
          onQuantityChange={setQuantity}
          onAddToCart={handleAddToCart}
        />
      )}

      {showConfirmation && selectedProduct && (
        <ConfirmationModal
          isOpen
          onClose={handleDeclineSelection}
          product={selectedProduct}
          selectedColor={selectedColor}
          onConfirm={handleConfirmSelection}
        />
      )}

      {showOrderConfirmation && orderData && (
        <OrderConfirmationModal
          isOpen
          onClose={() => setShowOrderConfirmation(false)}
          orderData={orderData}
        />
      )}

      <SimplePrompt
        open={showPleaseSelectPrompt}
        onClose={() => setShowPleaseSelectPrompt(false)}
        primaryActionLabel="OK"
      >
        <span className="font-medium">Please select your preference!!</span>
      </SimplePrompt>

      <SimplePrompt
        open={showRecordedPrompt}
        onClose={() => setShowRecordedPrompt(false)}
        primaryActionLabel="Got it"
      >
        {orderData ? (
          <>
            Your gift selection of the <span className="font-semibold">{orderData?.product?.name}</span>{" "}
            has been recorded, <span className="font-semibold">{employee?.firstName ?? "User"}</span>.
            Your reference number is{" "}
            <span className="font-mono font-semibold">{orderData?.order?.orderId}</span>.{" "}
            {showLogoutInPrompt ? "Please proceed to logout. " : ""}Thank you!
          </>
        ) : (
          <>Your selection has been recorded. Thank you!</>
        )}
      </SimplePrompt>

      <SimplePrompt
        open={showCopayPrompt}
        onClose={() => setShowCopayPrompt(false)}
        primaryActionLabel="Pay Now"
        onPrimaryAction={() => { }}
      >
        <span className="font-medium">
          Pay using co-pay with {employee?.points ?? 0} points + {copayAmount} INR where 1 INR ={" "}
          {1 / inrPerPoint} Points in conversion.
        </span>
      </SimplePrompt>
    </div>
  );
}
