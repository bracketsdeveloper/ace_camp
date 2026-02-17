// src/pages/cart.tsx
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Minus, MapPin, Building, ShoppingCart, Trash2 } from "lucide-react";
import { SimplePrompt } from "./dashboard";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function getQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

type DeliveryMethod = "office" | "delivery";
type AddressDetails = {
  flatNumber: string;
  buildingName: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
};
type CheckoutData = {
  deliveryMethod: DeliveryMethod;
  deliveryAddress?: string;
};

export default function Cart() {
  const { employee, token, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCopayPrompt, setShowCopayPrompt] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutData>({
    deliveryMethod: "office",
  });
  const [addressDetails, setAddressDetails] = useState<AddressDetails>({
    flatNumber: "",
    buildingName: "",
    street: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
  });

  // ✅ NEW: office pickup dropdown state
  const OFFICE_ADDRESSES = [
    { id: "office_1", label: "Office Address 1", value: "Office Address 1" },
    { id: "office_2", label: "Office Address 2", value: "Office Address 2" },
    { id: "office_3", label: "Office Address 3", value: "Office Address 3" },
  ];
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(OFFICE_ADDRESSES[0]?.id);

  const [, setLocation] = useLocation();

  const { data: cartItems = [] } = useQuery<any[]>({
    queryKey: ["/api/cart"],
    enabled: !!token,
  });

  const { data: branding } = useQuery<any>({
    queryKey: ["/api/admin/branding"],
  });

  const inrPerPoint = parseFloat(branding?.inrPerPoint || "1");
  const maxSelections = branding?.maxSelectionsPerUser ?? 1;

  const { data: myOrders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders/my-orders"],
    retry: false,
    enabled: !!token,
  });

  // ✅ slab pricing helpers (TOTAL slab price for the qty range)
  const getLinePriceInr = (product: any, qty: number): number => {
    const q = Math.max(1, Number(qty) || 1);
    const baseUnit = Number(product?.price);
    const baseUnitSafe = Number.isFinite(baseUnit) ? baseUnit : 0;

    const slabs = Array.isArray(product?.priceSlabs) ? product.priceSlabs : [];
    if (!slabs.length) return baseUnitSafe * q;

    const matches = (slab: any) => {
      const from =
        slab?.from ??
        slab?.min ??
        slab?.minQty ??
        slab?.start ??
        slab?.minQuantity ??
        1;

      const to =
        slab?.to ??
        slab?.max ??
        slab?.maxQty ??
        slab?.end ??
        slab?.maxQuantity ??
        Number.POSITIVE_INFINITY;

      const min = Number(from);
      const max = Number(to);

      const minOk = Number.isFinite(min) ? q >= min : true;
      const maxOk = Number.isFinite(max) ? q <= max : true;
      return minOk && maxOk;
    };

    const slab = slabs.find(matches);
    if (!slab) return baseUnitSafe * q;

    const slabPrice =
      slab?.totalPrice ??
      slab?.total ??
      slab?.price ??
      slab?.amount ??
      slab?.inr ??
      slab?.value ??
      slab?.slabPrice;

    const n = Number(slabPrice);
    if (Number.isFinite(n)) return n;

    return baseUnitSafe * q;
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};
    cartItems.forEach((item: any) => {
      const key = item.campaignId ? item.campaignId : "standard";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [cartItems]);

  const { totalPointsRequired, totalProductValue, totalGstAmount, totalAmountInr } = useMemo(() => {
    let points = 0;
    let prodValue = 0;
    let gstAmt = 0;
    let totalAmt = 0;

    cartItems.forEach((item: any) => {
      const linePriceInr = getLinePriceInr(item.product, item.quantity);
      // linePriceInr from getLinePriceInr is usually the base price from the slab/unit price.
      // We need to check if the price stored/calculated includes GST or if GST is added on top.
      // Based on product-detail-modal, GST is added on top of `linePriceInr`.
      // Let's assume `getLinePriceInr` returns the taxable value (base price).

      const gstPercent = parseFloat(item.product.gst || "0");
      const itemGst = linePriceInr * (gstPercent / 100);
      const itemTotal = linePriceInr + itemGst;

      const linePoints = Math.ceil(itemTotal / inrPerPoint);

      points += linePoints;
      prodValue += linePriceInr;
      gstAmt += itemGst;
      totalAmt += itemTotal;
    });

    return {
      totalPointsRequired: points,
      totalProductValue: prodValue,
      totalGstAmount: gstAmt,
      totalAmountInr: totalAmt
    };
  }, [cartItems, inrPerPoint]);

  const userPoints = employee?.points ?? 0;
  const needsCopay = totalPointsRequired > userPoints;
  const copayInr = needsCopay
    ? Math.ceil((totalPointsRequired - userPoints) * inrPerPoint)
    : 0;

  const formatAddress = (details: AddressDetails): string => {
    const parts = [
      details.flatNumber,
      details.buildingName,
      details.street,
      details.landmark,
      details.city,
      details.state,
      details.pincode,
    ].filter((part) => part.trim() !== "");
    return parts.join(", ");
  };

  const isAddressComplete = (): boolean => {
    return !!(
      addressDetails.flatNumber.trim() &&
      addressDetails.street.trim() &&
      addressDetails.city.trim() &&
      addressDetails.state.trim() &&
      addressDetails.pincode.trim() &&
      /^\d{6}$/.test(addressDetails.pincode.trim())
    );
  };

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const response = await fetch(`/api/cart/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity }),
      });
      if (!response.ok) throw new Error("Failed to update quantity");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCartItemAttributesMutation = useMutation({
    mutationFn: async ({ id, selectedColor, selectedSize }: { id: string; selectedColor?: string; selectedSize?: string }) => {
      const response = await fetch(`/api/cart/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ selectedColor, selectedSize }),
      });
      if (!response.ok) throw new Error("Failed to update cart item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cart/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to remove item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (deliveryData?: CheckoutData) => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryMethod: deliveryData?.deliveryMethod || "office",
          deliveryAddress: deliveryData?.deliveryAddress || null,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).message || "Checkout failed");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Checkout successful" });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my-orders"] });
      setLocation("/my-orders");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCheckout = () => {
    setShowDeliveryDialog(true);
  };

  const handleDeliveryConfirm = () => {
    // ✅ Office: must select an office address
    if (checkoutData.deliveryMethod === "office") {
      const picked = OFFICE_ADDRESSES.find((o) => o.id === selectedOfficeId);
      if (!picked) {
        toast({
          title: "Error",
          description: "Please select an office address for pickup.",
          variant: "destructive",
        });
        return;
      }
    }

    // Delivery: validate required fields
    if (checkoutData.deliveryMethod === "delivery" && !isAddressComplete()) {
      toast({
        title: "Error",
        description: "Please fill in all required address fields",
        variant: "destructive",
      });
      return;
    }

    setShowDeliveryDialog(false);

    // ✅ Use selected office address OR formatted home address
    const deliveryAddress =
      checkoutData.deliveryMethod === "delivery"
        ? formatAddress(addressDetails)
        : OFFICE_ADDRESSES.find((o) => o.id === selectedOfficeId)?.value;

    if (needsCopay) {
      setCheckoutData((prev) => ({
        ...prev,
        deliveryAddress,
      }));
      setShowCopayPrompt(true);
    } else {
      checkoutMutation.mutate({
        deliveryMethod: checkoutData.deliveryMethod,
        deliveryAddress,
      });
    }
  };

  const handleCopayPayment = async () => {
    try {
      const response = await fetch("/api/orders/create-copay-order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryMethod: checkoutData.deliveryMethod,
          deliveryAddress:
            checkoutData.deliveryMethod === "delivery" ? checkoutData.deliveryAddress : checkoutData.deliveryAddress || null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({
          title: "Error",
          description: data?.message || "Failed to start payment",
          variant: "destructive",
        });
        return;
      }

      const redirectUrlFromPhonePe = data?.paymentUrl;
      const merchantTxnId = data?.merchantTransactionId;

      if (!redirectUrlFromPhonePe) {
        toast({
          title: "Error",
          description: "Payment page URL not received from PhonePe",
          variant: "destructive",
        });
        return;
      }

      if (merchantTxnId) {
        sessionStorage.setItem("PP_MERCHANT_ORDER_ID", merchantTxnId);
        sessionStorage.setItem("PP_DELIVERY_METHOD", checkoutData.deliveryMethod);
        if (checkoutData.deliveryAddress) {
          sessionStorage.setItem("PP_DELIVERY_ADDRESS", checkoutData.deliveryAddress);
        } else {
          sessionStorage.removeItem("PP_DELIVERY_ADDRESS");
        }
      }

      window.location.href = redirectUrlFromPhonePe;
    } catch (e) {
      toast({ title: "Error", description: "Failed to initiate payment", variant: "destructive" });
    }
  };

  useEffect(() => {
    const incomingTxnId = getQueryParam("merchantTransactionId");
    const incomingDeliveryMethod = getQueryParam("deliveryMethod") as DeliveryMethod;
    const incomingDeliveryAddress = getQueryParam("deliveryAddress");

    const storedTxnId = sessionStorage.getItem("PP_MERCHANT_ORDER_ID");
    const txnId = incomingTxnId || storedTxnId;

    async function verifyAndFinish(id: string) {
      try {
        const deliveryMethod =
          incomingDeliveryMethod ||
          ((sessionStorage.getItem("PP_DELIVERY_METHOD") as DeliveryMethod) || "office");

        const deliveryAddress =
          incomingDeliveryAddress || sessionStorage.getItem("PP_DELIVERY_ADDRESS") || undefined;

        const verifyResponse = await fetch("/api/orders/verify-copay", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            merchantTransactionId: id,
            deliveryMethod,
            deliveryAddress,
          }),
        });

        const verifyJson = await verifyResponse.json().catch(() => ({}));
        if (!verifyResponse.ok) {
          toast({
            title: "Payment not completed",
            description: verifyJson?.message || "Please try again if amount was not deducted.",
            variant: "destructive",
          });
          return;
        }

        if (typeof window !== "undefined" && incomingTxnId) {
          const url = new URL(window.location.href);
          url.searchParams.delete("merchantTransactionId");
          url.searchParams.delete("deliveryMethod");
          url.searchParams.delete("deliveryAddress");
          window.history.replaceState({}, "", url.toString());
        }

        sessionStorage.removeItem("PP_MERCHANT_ORDER_ID");
        sessionStorage.removeItem("PP_DELIVERY_METHOD");
        sessionStorage.removeItem("PP_DELIVERY_ADDRESS");

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/cart"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/orders/my-orders"] }),
        ]);

        setShowCopayPrompt(false);
        setLocation("/my-orders");
      } catch {
        toast({
          title: "Verification failed",
          description: "We couldn't verify the payment. If amount was deducted, contact support.",
          variant: "destructive",
        });
      }
    }

    if (isAuthenticated && txnId) {
      verifyAndFinish(txnId);
    }
  }, [isAuthenticated, queryClient, token, setLocation, toast]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Your Cart</h1>

        {cartItems.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground">Add some products to get started</p>
          </div>
        ) : (
          <>
            <div className="space-y-8 mb-8">
              {Object.entries(groupedItems).map(([key, items]) => {
                const isCampaign = key !== "standard";
                const campaignName = isCampaign ? items[0].campaign?.name : "Standard Catalog";

                return (
                  <div key={key} className="border rounded-lg p-6 bg-card/50">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      {isCampaign ? "🎉" : "🛒"} {campaignName}
                      {isCampaign && <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">Campaign</span>}
                    </h2>
                    <div className="space-y-4">
                      {items.map((item: any) => {
                        const linePriceInr = getLinePriceInr(item.product, item.quantity);
                        const linePoints = Math.ceil(linePriceInr / inrPerPoint);
                        const perUnitPrice = linePriceInr / Math.max(1, item.quantity);
                        const pointsEach = Math.ceil(perUnitPrice / inrPerPoint);

                        return (
                          <div
                            key={item.id}
                            className="flex items-center space-x-4 bg-card p-4 rounded-lg shadow-sm"
                          >
                            <img
                              src={item.product.images[0]}
                              alt={item.product.name}
                              className="w-20 h-20 object-cover rounded"
                            />
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{item.product.name}</h3>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                                {/* Color Selection */}
                                {item.product.colors?.length > 0 ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-muted-foreground">Color:</span>
                                    {item.selectedColor ? (
                                      <span className="font-medium text-foreground text-sm">{item.selectedColor}</span>
                                    ) : (
                                      <Select
                                        onValueChange={(val) =>
                                          updateCartItemAttributesMutation.mutate({
                                            id: item.id,
                                            selectedColor: val,
                                            selectedSize: item.selectedSize // preserve existing
                                          })
                                        }
                                      >
                                        <SelectTrigger className="w-[100px] h-8 text-xs border-red-300">
                                          <SelectValue placeholder="Select Color" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {item.product.colors.map((c: string) => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                ) : null}

                                {/* Size Selection */}
                                {item.product.sizes?.values?.length > 0 ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-muted-foreground">Size:</span>
                                    {(item.selectedSize || item.selected_size) ? (
                                      <span className="font-bold text-blue-600 text-sm">{item.selectedSize || item.selected_size}</span>
                                    ) : (
                                      <Select
                                        onValueChange={(val) =>
                                          updateCartItemAttributesMutation.mutate({
                                            id: item.id,
                                            selectedSize: val,
                                            selectedColor: item.selectedColor // preserve existing
                                          })
                                        }
                                      >
                                        <SelectTrigger className="w-[80px] h-8 text-xs border-red-300">
                                          <SelectValue placeholder="Select Size" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {item.product.sizes.values.map((s: string) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-4 mt-2">
                                <p className="text-sm font-medium">{pointsEach} points each</p>
                                <p className="text-sm font-bold text-primary">Total: {linePoints} points</p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  updateQuantityMutation.mutate({
                                    id: item.id,
                                    quantity: item.quantity - 1,
                                  })
                                }
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>

                              <Input
                                type="number"
                                className="w-16 text-center"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateQuantityMutation.mutate({
                                    id: item.id,
                                    quantity: parseInt(e.target.value) || 1,
                                  })
                                }
                                min={1}
                                max={item.product.stock}
                              />

                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  updateQuantityMutation.mutate({
                                    id: item.id,
                                    quantity: item.quantity + 1,
                                  })
                                }
                                disabled={item.quantity >= item.product.stock}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItemMutation.mutate(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-card p-6 rounded-lg shadow-sm space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Product Value:</span>
                <span>₹{totalProductValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">GST Amount:</span>
                <span>₹{totalGstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold border-t pt-2">
                <span>Total Amount:</span>
                <span>₹{totalAmountInr.toFixed(2)}</span>
              </div>

              <div className="flex justify-between pt-2">
                <span className="font-semibold">Total Points Required:</span>
                <span className="text-blue-600 font-bold">{totalPointsRequired}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span className="font-semibold">Your Points:</span>
                <span>{employee?.points ?? 0}</span>
              </div>
              {needsCopay && (
                <div className="flex justify-between mb-4 text-primary">
                  <span className="font-semibold">Co-pay Needed:</span>
                  <span>{copayInr} INR</span>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleCheckout}
                disabled={
                  cartItems.length === 0 ||
                  checkoutMutation.isPending ||
                  (maxSelections !== -1 && myOrders.length + cartItems.length > maxSelections)
                }
              >
                {checkoutMutation.isPending ? "Processing..." : "Proceed to Checkout"}
              </Button>
            </div>
          </>
        )}
      </main>
      <Footer />

      <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Delivery Method</DialogTitle>
            <DialogDescription>Choose how you would like to receive your order</DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={checkoutData.deliveryMethod}
            onValueChange={(value: DeliveryMethod) => {
              setCheckoutData({ ...checkoutData, deliveryMethod: value });

              if (value === "office") {
                // ✅ reset delivery address fields
                setAddressDetails({
                  flatNumber: "",
                  buildingName: "",
                  street: "",
                  landmark: "",
                  city: "",
                  state: "",
                  pincode: "",
                });

                // ✅ ensure some office is selected
                setSelectedOfficeId((prev) => prev || OFFICE_ADDRESSES[0]?.id);
              }
            }}
            className="space-y-4"
          >
            <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer">
              <RadioGroupItem value="office" id="office" />
              <div className="flex-1">
                <Label htmlFor="office" className="flex items-center gap-2 cursor-pointer">
                  <Building className="h-5 w-5" />
                  <span className="font-medium">Collect from Office</span>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Pick up your order from the company office during working hours
                </p>

                {/* ✅ NEW: Office address dropdowns */}
                {checkoutData.deliveryMethod === "office" && (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="officeAddress">Select Office Address</Label>
                    <select
                      id="officeAddress"
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={selectedOfficeId}
                      onChange={(e) => setSelectedOfficeId(e.target.value)}
                    >
                      {OFFICE_ADDRESSES.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>

                    {/* optional preview */}
                    <p className="text-xs text-muted-foreground">
                      Selected:{" "}
                      <span className="font-medium">
                        {OFFICE_ADDRESSES.find((o) => o.id === selectedOfficeId)?.value}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="delivery" id="delivery" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="delivery" className="flex items-center gap-2 cursor-pointer">
                    <MapPin className="h-5 w-5" />
                    <span className="font-medium">Home Delivery</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Get your order delivered to your preferred address
                  </p>

                  {checkoutData.deliveryMethod === "delivery" && (
                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="flatNumber">
                            Flat/House No. <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="flatNumber"
                            placeholder="e.g., 101"
                            value={addressDetails.flatNumber}
                            onChange={(e) =>
                              setAddressDetails({ ...addressDetails, flatNumber: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="buildingName">Building/Apartment Name</Label>
                          <Input
                            id="buildingName"
                            placeholder="e.g., Green Valley"
                            value={addressDetails.buildingName}
                            onChange={(e) =>
                              setAddressDetails({ ...addressDetails, buildingName: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="street">
                          Street/Area <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="street"
                          placeholder="e.g., MG Road, Sector 14"
                          value={addressDetails.street}
                          onChange={(e) =>
                            setAddressDetails({ ...addressDetails, street: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="landmark">Landmark</Label>
                        <Input
                          id="landmark"
                          placeholder="e.g., Near Metro Station"
                          value={addressDetails.landmark}
                          onChange={(e) =>
                            setAddressDetails({ ...addressDetails, landmark: e.target.value })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">
                            City <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="city"
                            placeholder="e.g., Mumbai"
                            value={addressDetails.city}
                            onChange={(e) =>
                              setAddressDetails({ ...addressDetails, city: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">
                            State <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="state"
                            placeholder="e.g., Maharashtra"
                            value={addressDetails.state}
                            onChange={(e) =>
                              setAddressDetails({ ...addressDetails, state: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pincode">
                          PIN Code <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="pincode"
                          placeholder="e.g., 400001"
                          value={addressDetails.pincode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setAddressDetails({ ...addressDetails, pincode: value });
                          }}
                          maxLength={6}
                        />
                        {addressDetails.pincode && !/^\d{6}$/.test(addressDetails.pincode) && (
                          <p className="text-xs text-red-500">PIN code must be 6 digits</p>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        <span className="text-red-500">*</span> Required fields
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </RadioGroup>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowDeliveryDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeliveryConfirm}
              disabled={checkoutData.deliveryMethod === "delivery" && !isAddressComplete()}
            >
              Confirm Delivery Method
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SimplePrompt
        open={showCopayPrompt}
        onClose={() => setShowCopayPrompt(false)}
        primaryActionLabel="Confirm and Pay Now"
        onPrimaryAction={handleCopayPayment}
      >
        <div className="space-y-3">
          <span className="font-medium">
            Confirm and Pay using co-pay with {userPoints} points + {copayInr} INR.
          </span>
          <div className="text-sm text-muted-foreground border-t pt-3">
            <p className="font-medium">Delivery Method:</p>
            <p className="mt-1">
              {checkoutData.deliveryMethod === "office" ? (
                <span className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Collect from Office
                  {checkoutData.deliveryAddress && (
                    <span className="text-xs ml-2 p-1 bg-muted rounded">
                      ({checkoutData.deliveryAddress})
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <span>
                    Home Delivery
                    {checkoutData.deliveryAddress && (
                      <>
                        <br />
                        <span className="text-xs mt-1 block p-2 bg-muted rounded">
                          {checkoutData.deliveryAddress}
                        </span>
                      </>
                    )}
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>
      </SimplePrompt>
    </div>
  );
}
