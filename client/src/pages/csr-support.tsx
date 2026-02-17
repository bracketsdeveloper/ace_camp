import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Users, Heart, Globe, Shield } from "lucide-react";
import type { Product } from "@/types/product";
import csrImage from '@assets/csr.jpg';

function CSRProductCard({ product }: { product: Product }) {
  // Parse specifications if they come as a string
  const parsedSpecifications = (() => {
    if (!product.specifications) return {};
    
    if (typeof product.specifications === 'string') {
      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(product.specifications);
        return typeof parsed === 'object' ? parsed : {};
      } catch {
        // If not valid JSON, try to parse as key-value pairs
        const specs: Record<string, string> = {};
        const lines = product.specifications.split('\n');
        
        lines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            const colonIndex = trimmedLine.indexOf(':');
            if (colonIndex > 0) {
              const key = trimmedLine.substring(0, colonIndex).trim();
              const value = trimmedLine.substring(colonIndex + 1).trim();
              if (key) {
                specs[key] = value;
              }
            } else {
              // If no colon, treat the whole line as a specification
              specs[trimmedLine] = '';
            }
          }
        });
        return specs;
      }
    }
    
    // Already an object
    return product.specifications;
  })();

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow border-green-100">
      <div className="relative">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-64 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://placehold.co/600x400?text=CSR+Product";
            }}
          />
        ) : (
          <div className="w-full h-64 bg-gradient-to-r from-green-50 to-blue-50 flex items-center justify-center">
            <Package className="w-16 h-16 text-green-300" />
          </div>
        )}
        <div className="absolute top-4 right-4">
          <Badge className="bg-green-100 text-green-800 border-green-200">
            CSR Support
          </Badge>
        </div>
      </div>
      
      <CardHeader>
        <CardTitle className="text-xl">{product.name}</CardTitle>
        <p className="text-sm text-gray-500">{product.sku}</p>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Specifications */}
          {Object.keys(parsedSpecifications).length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Specifications</h4>
              <div className="space-y-2">
                {Object.entries(parsedSpecifications).slice(0, 3).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-gray-600 font-medium">{key}</span>
                    {value && <span className="text-gray-900 ml-2">{value}</span>}
                  </div>
                ))}
                {Object.keys(parsedSpecifications).length > 3 && (
                  <div className="text-sm text-gray-500 text-center pt-1">
                    +{Object.keys(parsedSpecifications).length - 3} more specifications
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Packages Include */}
          {product.packagesInclude && product.packagesInclude.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Packages Include</h4>
              <ul className="space-y-1">
                {product.packagesInclude.slice(0, 3).map((item, index) => (
                  <li key={index} className="flex items-start text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="text-gray-600">{item}</span>
                  </li>
                ))}
                {product.packagesInclude.length > 3 && (
                  <li className="text-sm text-gray-500 text-center pt-1">
                    +{product.packagesInclude.length - 3} more items
                  </li>
                )}
              </ul>
            </div>
          )}
          
          {/* Categories - Already showing unique categories per product */}
          {product.categories && product.categories.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {product.categories.map((category) => (
                  <Badge key={category.id} variant="outline" className="bg-blue-50">
                    {category.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Colors */}
          {product.colors && product.colors.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Available Colors</h4>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color, index) => (
                  <div
                    key={index}
                    className="px-3 py-1 text-xs bg-gray-100 rounded-full"
                  >
                    {color}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* CSR Initiative Info */}
          <div className="pt-4 border-t border-green-100">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                Part of our CSR Initiative
              </span>
            </div>
            <p className="text-xs text-gray-600">
              This product supports our Corporate Social Responsibility programs focused on 
              environmental sustainability and community development.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CSRSupportPage() {
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/csr-products"],
  });

  // Filter products with csrSupport flag set to true
  const csrProducts = products.filter(product => product.csrSupport === true);

  // Calculate unique categories count
  const uniqueCategoriesCount = new Set(
    csrProducts.flatMap(p => p.categories?.map(c => c.id) || [])
  ).size;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <Header />
      
      {/* Hero Section with CSR Image */}
      <div 
        className="relative min-h-[400px] md:min-h-[500px] rounded-2xl mx-4 mt-4 mb-8 overflow-hidden shadow-xl"
        style={{
          backgroundImage: `url(${csrImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/30 via-transparent to-teal-900/30"></div>
        
        <div className="relative z-10 h-full flex items-center justify-center text-center text-white px-4">
          <div className="max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">
              Corporate Social Responsibility
            </h1>
            <p className="text-xl md:text-2xl drop-shadow-md max-w-2xl mx-auto">
              Making a positive impact on communities and the environment through sustainable practices
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="bg-white border-green-100 shadow-md">
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{csrProducts.length}</div>
              <p className="text-gray-600">CSR Products</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-blue-100 shadow-md">
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {uniqueCategoriesCount}
              </div>
              <p className="text-gray-600">Unique Categories</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-purple-100 shadow-md">
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">90%</div>
              <p className="text-gray-600">Sustainable Sourcing</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-amber-100 shadow-md">
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">90%</div>
              <p className="text-gray-600">Ethically Produced</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Our CSR Product Collection
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            These products are specially designated for our Corporate Social Responsibility initiatives. 
            They represent our commitment to sustainability, community support, and ethical practices.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Eco-Friendly Materials
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Community Support
            </Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              Sustainable Sourcing
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              Ethical Manufacturing
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading CSR products...</div>
          </div>
        ) : csrProducts.length === 0 ? (
          <Card className="max-w-2xl mx-auto shadow-md">
            <CardContent className="py-12 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                No CSR Products Available
              </h3>
              <p className="text-gray-600 mb-6">
                Currently there are no products designated for CSR support.
                Check back soon or contact us for more information.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {csrProducts.map((product) => (
              <CSRProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
      
      <Footer />
    </div>
  );
}