// src/pages/home.tsx
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header"; // This should now work
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type Branding = {
  id: string;
  logoUrl: string | null;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  bannerUrl: string | null;
  bannerText: string | null;
  updatedAt: string;
};

export default function Home() {
  const [, setLocation] = useLocation();
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const { employee, token } = useAuth();

  const { data: branding } = useQuery<Branding>({
    queryKey: ["/api/admin/branding"],
  });

  // Virtusa-like defaults (fallbacks)
  const companyName = branding?.companyName || "Virtusa";
  const primary = branding?.primaryColor || "#053354"; // deep navy
  const accent = branding?.accentColor || "#02F576"; // neon green

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", primary);
    root.style.setProperty("--brand-accent", accent);
  }, [primary, accent]);

  // ✅ BulkBuy eligibility check (same as Header)
  const { data: bulkBuyMe } = useQuery({
    queryKey: ["/api/bulkbuy/me"],
    enabled: !!token, // only when logged in
    queryFn: async () => {
      const r = await fetch("/api/bulkbuy/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      // If endpoint fails, just hide the tab
      if (!r.ok) return { eligible: false };
      return r.json();
    },
    retry: false,
  });

  const canSeeBulkBuy = !!employee && (
    employee.bulkBuyAllowed === true || bulkBuyMe?.eligible === true
  );

  // Base options always shown
  const baseOptions = [
    {
      id: "brand-store",
      title: "Brand Store",
      description: "Explore our exclusive brand collection",
      angle: 90, // Bottom (90 degrees)
      path: "/dashboard",
    },
    {
      id: "special-occasions",
      title: "Special Occasions",
      description: "Gifts for memorable moments",
      angle: 162, // 162 degrees
      path: "/special-occasions",
    },
    {
      id: "blog",
      title: "Blog",
      description: "Insights & updates",
      angle: 306, // 306 degrees
      path: "/blog",
    },
    {
      id: "csr-blog",
      title: "CSR Support",
      description: "Corporate social responsibility",
      angle: 18, // 18 degrees
      path: "/csr",
    },
  ];

  // Bulk Buy option (only shown if eligible)
  const bulkBuyOption = {
    id: "bulk-buy",
    title: "Bulk Buy",
    description: "Corporate orders & bulk purchases",
    angle: 234, // 234 degrees
    path: "/bulk-buy",
  };

  // Combine options based on eligibility
  const options = useMemo(() => {
    if (canSeeBulkBuy) {
      return [
        ...baseOptions.slice(0, 2), // brand-store, special-occasions
        bulkBuyOption,
        ...baseOptions.slice(2), // blog, csr-blog
      ];
    }
    return baseOptions;
  }, [canSeeBulkBuy]);

  // Calculate position based on angle with proper spacing
  const getStarPosition = (angle: number) => {
    // Distance from center to circle center (in pixels)
    const centerCircleRadius = 96; // w-48 = 192px diameter = 96px radius
    const navCircleRadius = 96; // md:w-48 = 192px diameter = 96px radius
    const gapBetweenCircles = 40; // Desired gap between circles
    
    // Total distance = center radius + gap + nav circle radius
    const radius = centerCircleRadius + gapBetweenCircles + navCircleRadius; // 96 + 40 + 96 = 232px
    
    const radian = (angle * Math.PI) / 180;
    const x = Math.cos(radian) * radius;
    const y = Math.sin(radian) * radius;
    
    return {
      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
    };
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Virtusa-like background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 35%, rgba(2,245,118,0.12) 0%, transparent 55%)," +
            "radial-gradient(circle at 80% 75%, rgba(255,255,255,0.10) 0%, transparent 60%)," +
            "linear-gradient(135deg, rgba(5,51,84,1) 0%, rgba(5,41,70,1) 45%, rgba(3,28,50,1) 100%)",
        }}
      />

      {/* Subtle grid/tech texture */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          backgroundPosition: "center",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />

        {/* Company Name in Top Left */}
        <div className="fixed top-24 left-8 z-50">
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight drop-shadow-lg"
            style={{ color: "#FFFFFF" }}
          >
            {companyName}
          </h1>
          <div
            className="h-1.5 w-24 mt-3 rounded-full"
            style={{ backgroundColor: accent, boxShadow: `0 0 25px ${accent}` }}
          />
        </div>

        <main className="flex-1 flex items-start justify-center p-8 pt-16">
          <div className="w-full max-w-6xl">
            {/* Navigation Cluster */}
            <div className="relative flex items-center justify-center min-h-[750px] -mt-16">
              {/* Background Decorative Elements */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-[750px] h-[750px] rounded-full blur-3xl"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 30%, rgba(2,245,118,0.22) 0%, transparent 55%)," +
                      "radial-gradient(circle at 70% 70%, rgba(255,255,255,0.10) 0%, transparent 60%)",
                    opacity: 0.9,
                  }}
                />
              </div>

              {/* Decorative orbit ring showing equal distance */}
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[464px] h-[464px] rounded-full border border-dashed opacity-30 pointer-events-none"
                style={{ borderColor: accent }}
              />
              
              {/* Inner orbit ring */}
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border border-dashed opacity-20 pointer-events-none"
                style={{ borderColor: accent }}
              />

              {/* Central Circle with Company Name */}
              <div
                className="relative z-10 rounded-full w-48 h-48 flex items-center justify-center transition-all duration-300 hover:scale-105"
                style={{
                  border: `3px solid ${accent}`,
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(12px)",
                  boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${accent}60`,
                }}
              >
                <div className="text-center px-3">
                  <span
                    className="text-3xl font-bold block leading-tight"
                    style={{ color: "#FFFFFF" }}
                  >
                    {companyName.split(" ")[0]}
                  </span>
                  {companyName.includes(" ") && (
                    <span
                      className="text-base block mt-1"
                      style={{ color: "rgba(255,255,255,0.9)" }}
                    >
                      {companyName.split(" ").slice(1).join(" ")}
                    </span>
                  )}
                  <div
                    className="mx-auto mt-2 h-1 w-10 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                </div>
              </div>

              {/* Option Circles - Conditional Bulk Buy */}
              {options.map((option) => {
                const isActive = hoveredOption === option.id;
                const isDimmed = hoveredOption && hoveredOption !== option.id;
                const isBulkBuy = option.id === "bulk-buy";

                return (
                  <div
                    key={option.id}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      ...getStarPosition(option.angle),
                      opacity: isDimmed ? 0.4 : 1,
                      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={() => setHoveredOption(option.id)}
                    onMouseLeave={() => setHoveredOption(null)}
                  >
                    <Button
                      className="w-44 h-44 md:w-48 md:h-48 rounded-full transition-all duration-300 flex flex-col items-center justify-center p-6"
                      onClick={() => setLocation(option.path)}
                      style={{
                        border: isActive
                          ? `3px solid ${accent}`
                          : isBulkBuy
                            ? "2px solid rgba(2,245,118,0.3)" // Slightly different border for Bulk Buy
                            : "2px solid rgba(255,255,255,0.1)",
                        background: isActive
                          ? `linear-gradient(135deg, rgba(2,245,118,0.15), rgba(255,255,255,0.08))`
                          : isBulkBuy
                            ? "rgba(2,245,118,0.08)" // Slightly different background for Bulk Buy
                            : "rgba(255,255,255,0.06)",
                        color: "#FFFFFF",
                        backdropFilter: "blur(12px)",
                        boxShadow: isActive
                          ? `0 20px 50px rgba(0,0,0,0.5), 0 0 40px ${accent}50`
                          : isBulkBuy
                            ? `0 20px 40px rgba(0,0,0,0.3), 0 0 20px rgba(2,245,118,0.2)`
                            : "0 20px 40px rgba(0,0,0,0.3)",
                        transform: isActive ? "scale(1.1)" : "scale(1)",
                      }}
                    >
                      <div className="text-center w-full">
                        <h3 className="text-[15px] md:text-base font-semibold leading-tight mb-2 line-clamp-2 px-2 break-words">
                          {option.title}
                        </h3>

                        <p
                          className="text-[11px] md:text-xs leading-snug line-clamp-2 mb-3 px-3 break-words"
                          style={{ color: "rgba(255,255,255,0.72)" }}
                        >
                          {option.description}
                        </p>

                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center mx-auto transition-all duration-300"
                          style={{
                            backgroundColor: isActive
                              ? accent
                              : isBulkBuy
                                ? "rgba(2,245,118,0.2)"
                                : "rgba(255,255,255,0.12)",
                            boxShadow: isActive ? `0 0 20px ${accent}` : "none",
                          }}
                        >
                          <ArrowRight
                            className="h-4 w-4 transition-all duration-300"
                            style={{
                              color: isActive ? primary : accent,
                              transform: isActive ? "translateX(3px)" : "none",
                            }}
                          />
                        </div>
                      </div>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}