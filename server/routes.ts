import type { Express } from "express";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import {
  insertProductSchema,
  insertEmployeeSchema,
  insertCartItemSchema,
  insertCategorySchema,
  insertDomainWhitelistSchema,
  type Product,
  type Category,
  insertCampaignSchema,
  insertCampaignProductSchema,
  type Campaign,
  insertBlogSchema,
  type Blog,
  insertCampaignWhitelistSchema,
} from "@shared/schema";
import { employeeRoleSchema } from "@shared/schema"; // <-- add this export in shared/schema.ts as shown earlier
import { storage } from "./storage";
import { sendOTP, verifyOTP, lookupByEmail } from "./auth-otp";
import crypto from "crypto";
import "dotenv/config";
import { emailService } from "./email-service"; // ✅ ADD THIS

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    const stamp = Date.now();
    cb(null, `${base}_${stamp}${ext}`);
  },
});

const upload = multer({
  storage: storageEngine,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
});

function toPublicUrl(absPath: string) {
  const rel = path.relative(UPLOAD_DIR, absPath).replaceAll("\\", "/");
  return `/uploads/${rel}`;
}

type PriceSlabRange = { minQty: number; maxQty: number | null; price: string };

function normalizePriceSlabs(input: any): PriceSlabRange[] {
  if (!Array.isArray(input)) return [];

  const cleaned: PriceSlabRange[] = input
    .map((s) => {
      const minQty = Number(s?.minQty);

      const rawMax = s?.maxQty;
      const maxQty =
        rawMax === "" || rawMax === undefined || rawMax === null ? null : Number(rawMax);

      const price = String(s?.price ?? "").trim();

      return { minQty, maxQty, price };
    })
    .filter((s) => Number.isFinite(s.minQty) && s.minQty > 0 && s.price !== "");

  // price + range validation
  for (const s of cleaned) {
    const p = Number(s.price);
    if (!Number.isFinite(p) || p < 0) throw new Error("Slab price must be a number >= 0");

    if (s.maxQty !== null) {
      if (!Number.isFinite(s.maxQty) || s.maxQty < s.minQty) {
        throw new Error("Max Qty must be empty (open-ended) or >= Min Qty");
      }
    }
  }

  // only one open-ended slab
  if (cleaned.filter((s) => s.maxQty === null).length > 1) {
    throw new Error("Only one open-ended slab (blank Max Qty) is allowed");
  }

  // sort by minQty then maxQty
  cleaned.sort(
    (a, b) => a.minQty - b.minQty || (a.maxQty ?? Infinity) - (b.maxQty ?? Infinity)
  );

  // overlap check (null max => Infinity)
  const toMax = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v);

  for (let i = 0; i < cleaned.length; i++) {
    const a = cleaned[i];
    const aMax = toMax(a.maxQty);

    for (let j = i + 1; j < cleaned.length; j++) {
      const b = cleaned[j];
      const bMax = toMax(b.maxQty);

      const overlap = a.minQty <= bMax && b.minQty <= aMax;
      if (overlap) {
        throw new Error("Slab ranges overlap. Please make ranges non-overlapping.");
      }
    }
  }

  return cleaned;
}

function getUnitPriceForQty(product: any, qty: number): number {
  const base = Number(product?.price ?? 0);
  const slabs = Array.isArray(product?.priceSlabs) ? product.priceSlabs : [];

  if (!slabs.length) return base;

  const match = slabs.find((s: any) => {
    const min = Number(s?.minQty);
    const max =
      s?.maxQty === null || s?.maxQty === undefined
        ? Number.POSITIVE_INFINITY
        : Number(s?.maxQty);
    return Number.isFinite(min) && qty >= min && qty <= max;
  });

  if (!match) return base;

  const slabPrice = Number(match.price);
  if (!Number.isFinite(slabPrice) || slabPrice < 0) return base;
  return slabPrice;
}



function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

type CategoryMap = Map<string, Category>;

function buildCategoryMap(list: Category[]): CategoryMap {
  return new Map(list.map((category) => [category.id, category]));
}

function attachCategoriesToProduct<T extends Product>(
  product: T,
  categoryMap: CategoryMap
) {
  const categories =
    product.categoryIds
      ?.map((id) => categoryMap.get(id))
      .filter((cat): cat is Category => Boolean(cat)) ?? [];

  return {
    ...product,
    categories,
    category: categories[0] ?? null,
  };
}

async function requireBulkBuyAccess(req: any, res: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ message: "No token" });
    return { ok: false as const };
  }

  const session = await storage.getSession(token);
  if (!session) {
    res.status(401).json({ message: "Invalid session" });
    return { ok: false as const };
  }

  const employee = await storage.getEmployee(session.employeeId);
  if (!employee) {
    res.status(404).json({ message: "Employee not found" });
    return { ok: false as const };
  }

  // ✅ Allow if employee flag is enabled
  const employeeEligible = employee.bulkBuyAllowed === true;

  // ✅ Or allow if access allowlist says enabled
  const access = await storage.getBulkBuyAccessByEmail(employee.email);
  const accessEligible = !!access?.isActive;

  if (!employeeEligible && !accessEligible) {
    res.status(403).json({ message: "Bulk Buy access not enabled" });
    return { ok: false as const };
  }

  return { ok: true as const, employee, session, access };
}


function buildItemsTableHtml(items: any[]) {
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px;border:1px solid #eee;">${it.name}</td>
        <td style="padding:8px;border:1px solid #eee;">${it.sku || ""}</td>
        <td style="padding:8px;border:1px solid #eee;">${it.selectedColor || "-"}</td>
        <td style="padding:8px;border:1px solid #eee;text-align:right;">${it.quantity}</td>
        <td style="padding:8px;border:1px solid #eee;text-align:right;">₹${Number(it.unitPrice).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #eee;text-align:right;">₹${Number(it.lineTotal).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
      <thead>
        <tr>
          <th style="padding:8px;border:1px solid #eee;text-align:left;">Product</th>
          <th style="padding:8px;border:1px solid #eee;text-align:left;">SKU</th>
          <th style="padding:8px;border:1px solid #eee;text-align:left;">Color</th>
          <th style="padding:8px;border:1px solid #eee;text-align:right;">Qty</th>
          <th style="padding:8px;border:1px solid #eee;text-align:right;">Unit</th>
          <th style="padding:8px;border:1px solid #eee;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export async function registerRoutes(app: Express): Promise<void> {
  app.use("/uploads", (await import("express")).default.static(UPLOAD_DIR));

  // File upload
  app.post("/api/upload", upload.array("files", 10), (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const urls = files.map((f) => toPublicUrl(f.path));
    res.json({ urls });
  });

  // Auth routes
  app.post("/api/auth/send-otp", sendOTP);
  app.post("/api/auth/verify-otp", verifyOTP);
  app.get("/api/auth/lookup-by-email", lookupByEmail);

  // Domain check endpoint
  app.get("/api/auth/check-domain/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const domainRecord = await storage.getDomainWhitelistByDomain(domain.toLowerCase());
      res.json({
        isWhitelisted: !!domainRecord && domainRecord.isActive,
        domain: domainRecord
      });
    } catch (error: any) {
      console.error("Domain check error:", error);
      res.status(500).json({ message: "Error checking domain", details: error.message });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) await storage.deleteSession(token);
    res.json({ message: "Logged out successfully" });
  });

  // Session check
  app.get("/api/auth/session", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token provided" });
    const session = await storage.getSession(token);
    if (!session) return res.status(401).json({ message: "Invalid or expired session" });
    const employee = await storage.getEmployee(session.employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json({
      employee: {
        id: employee.id,
        employeeId: employee.employeeId ?? null,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        points: employee.points ?? 0,
      },
      expiresAt: session.expiresAt,
    });
  });

  // Domain Whitelist Admin Routes
  app.get("/api/admin/domain-whitelist", async (_req, res) => {
    try {
      const domains = await storage.getAllDomainWhitelists();
      res.json(domains);
    } catch (error: any) {
      console.error("Domain whitelist fetch error:", error);
      res.status(500).json({ message: "Error fetching domain whitelist", details: error.message });
    }
  });

  app.get("/api/admin/domain-whitelist/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const domain = await storage.getDomainWhitelist(id);
      if (!domain) return res.status(404).json({ message: "Domain not found" });
      res.json(domain);
    } catch (error: any) {
      console.error("Domain fetch error:", error);
      res.status(500).json({ message: "Error fetching domain", details: error.message });
    }
  });

  app.post("/api/admin/domain-whitelist", async (req, res) => {
    try {
      const domainData = insertDomainWhitelistSchema.parse(req.body);
      // Ensure domain doesn't start with @ and is lowercase
      domainData.domain = domainData.domain.toLowerCase().replace(/^@/, '');

      // Check if domain already exists
      const existing = await storage.getDomainWhitelistByDomain(domainData.domain);
      if (existing) {
        return res.status(409).json({ message: "Domain already exists" });
      }

      const domain = await storage.createDomainWhitelist(domainData);
      res.json(domain);
    } catch (error: any) {
      console.error("Domain creation error:", error);
      res.status(400).json({ message: "Invalid domain data", details: error.message });
    }
  });

  app.put("/api/admin/domain-whitelist/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertDomainWhitelistSchema.partial().parse(req.body);

      if (updates.domain) {
        updates.domain = updates.domain.toLowerCase().replace(/^@/, '');
      }

      const domain = await storage.updateDomainWhitelist(id, updates);
      if (!domain) return res.status(404).json({ message: "Domain not found" });
      res.json(domain);
    } catch (error: any) {
      console.error("Domain update error:", error);
      res.status(500).json({ message: "Error updating domain", details: error.message });
    }
  });

  app.delete("/api/admin/domain-whitelist/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const ok = await storage.deleteDomainWhitelist(id);
      if (!ok) return res.status(404).json({ message: "Domain not found" });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Domain delete error:", error);
      res.status(500).json({ message: "Error deleting domain", details: error.message });
    }
  });

  // Categories API
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch {
      res.status(500).json({ message: "Error fetching categories" });
    }
  });

  app.get("/api/categories/:id/products", async (req, res) => {
    try {
      const { id } = req.params;
      const products = await storage.getProductsByCategory(id);
      const categories = await storage.getAllCategories();
      const categoryMap = buildCategoryMap(categories);
      const enriched = products.map((product) => attachCategoriesToProduct(product, categoryMap));
      res.json(enriched);
    } catch {
      res.status(500).json({ message: "Error fetching category products" });
    }
  });

  app.post("/api/admin/categories", async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.json(category);
    } catch {
      res.status(400).json({ message: "Invalid category data" });
    }
  });

  app.put("/api/admin/categories/:id", async (req, res) => {
    try {
      const updates = req.body;
      const category = await storage.updateCategory(req.params.id, updates);
      if (!category) return res.status(404).json({ message: "Category not found" });
      res.json(category);
    } catch {
      res.status(500).json({ message: "Error updating category" });
    }
  });

  app.delete("/api/admin/categories/:id", async (req, res) => {
    try {
      const ok = await storage.deleteCategory(req.params.id);
      if (!ok) return res.status(404).json({ message: "Category not found" });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Error deleting category" });
    }
  });

  // Products API
  app.get("/api/products", async (_req, res) => {
    try {
      const all = await storage.getAllProducts();
      const categories = await storage.getAllCategories();
      const categoryMap = buildCategoryMap(categories);
      const enriched = all.map((product) => attachCategoriesToProduct(product, categoryMap));

      // Get all campaign product IDs
      const campaigns = await storage.getAllCampaigns();
      const campaignProductIds = new Set<string>();

      for (const campaign of campaigns) {
        if (campaign.isActive) {
          const campaignProducts = await storage.getCampaignProducts(campaign.id);
          campaignProducts.forEach(cp => {
            campaignProductIds.add(cp.product.id);
          });
        }
      }

      const byId = new Map(enriched.map((p) => [p.id, p]));
      const backupCandidateIds = new Set(
        enriched
          .map((p) => p.backupProductId)
          .filter((v): v is string => Boolean(v))
      );
      const originals = enriched.filter((p) => !backupCandidateIds.has(p.id));
      const visible: any[] = [];

      for (const orig of originals) {
        const origStock = Number(orig.stock || 0);

        // Skip products that are in active campaigns, UNLESS they are marked as brandStore
        if (campaignProductIds.has(orig.id) && !orig.brandStore) {
          continue;
        }

        if (origStock > 0) {
          visible.push(orig);
        } else if (origStock <= 0 && orig.backupProductId) {
          const backup = byId.get(orig.backupProductId);
          // Also check if backup product is in a campaign (unless brandStore)
          if (backup && Number(backup.stock || 0) > 0 && backup.isActive !== false && (!campaignProductIds.has(backup.id) || backup.brandStore)) {
            visible.push({
              ...backup,
              isBackup: true,
              originalProductId: orig.id,
            });
          }
        }
      }
      res.json(visible);
    } catch {
      res.status(500).json({ message: "Error fetching products" });
    }
  });

  app.get("/api/products-admin", async (_req, res) => {
    try {
      const products = await storage.getAllProducts();
      const categories = await storage.getAllCategories();
      const categoryMap = buildCategoryMap(categories);
      const productsWithBackups: any[] = [];

      for (const product of products) {
        const enrichedProduct = attachCategoriesToProduct(product, categoryMap);
        productsWithBackups.push(enrichedProduct);

        if (product.stock === 0 && product.backupProductId) {
          const backupProduct = await storage.getProduct(product.backupProductId);
          if (backupProduct && (backupProduct.stock || 0) > 0) {
            const enrichedBackup = attachCategoriesToProduct(backupProduct, categoryMap);
            productsWithBackups.push({
              ...enrichedBackup,
              isBackup: true,
              originalProductId: product.id,
            });
          }
        }
      }
      res.json(productsWithBackups);
    } catch {
      res.status(500).json({ message: "Error fetching products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });

      const categories = await storage.getAllCategories();
      const categoryMap = buildCategoryMap(categories);
      const enrichedProduct = attachCategoriesToProduct(product, categoryMap);

      res.json(enrichedProduct);
    } catch {
      res.status(500).json({ message: "Error fetching product" });
    }
  });

  // CSR Products
  app.get("/api/csr-products", async (_req, res) => {
    try {
      const allProducts = await storage.getAllProducts();
      const csrProducts = allProducts.filter(product =>
        product.csrSupport === true && product.isActive === true
      );

      const categories = await storage.getAllCategories();
      const categoryMap = buildCategoryMap(categories);

      const enrichedProducts = csrProducts.map((product) =>
        attachCategoriesToProduct(product, categoryMap)
      );

      res.json(enrichedProducts);
    } catch (error: any) {
      console.error("CSR products fetch error:", error);
      res.status(500).json({ message: "Error fetching CSR products", details: error.message });
    }
  });

  // Cart API
  app.get("/api/cart", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ message: "No token provided" });
      const session = await storage.getSession(token);
      if (!session) return res.status(401).json({ message: "Invalid session" });
      const items = await storage.getCartItems(session.employeeId);
      const categories = await storage.getAllCategories();
      const categoryMap = buildCategoryMap(categories);

      const detailedItems = await Promise.all(
        items.map(async (item) => {
          const product = await storage.getProduct(item.productId);
          let campaign = null;
          if (item.campaignId) {
            campaign = await storage.getCampaign(item.campaignId);
          }
          return {
            ...item,
            selectedSize: item.selectedSize,
            product: product ? attachCategoriesToProduct(product, categoryMap) : null,
            campaign
          };
        })
      );
      res.json(detailedItems);
    } catch {
      res.status(500).json({ message: "Error fetching cart" });
    }
  });

  app.post("/api/cart", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ message: "No token provided" });

      const session = await storage.getSession(token);
      if (!session) return res.status(401).json({ message: "Invalid session" });

      const employee = await storage.getEmployee(session.employeeId);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      const data = insertCartItemSchema.parse({
        ...req.body,
        employeeId: employee.id,
      });

      const product = await storage.getProduct(data.productId);
      if (!product) return res.status(404).json({ message: "Product not found" });

      const requestedQty = data.quantity ?? 1;

      if ((product.stock || 0) < requestedQty) {
        return res.status(400).json({ message: "Insufficient stock" });
      }

      // Check Campaign Limits
      if (data.campaignId) {
        const campaign = await storage.getCampaign(data.campaignId);
        if (campaign && campaign.isActive && campaign.maxProductsPerUser !== null) {
          const employeeOrders = await storage.getOrdersByEmployeeId(employee.id);
          const currentCart = await storage.getCartItems(employee.id);

          const limit = campaign.maxProductsPerUser;
          let usage = 0;

          // Filter orders/cart by this campaignId if we switch to explicit tracking
          // Since we just added campaignId column, old orders won't have it.
          // We should use the hybrid approach: Check explicit campaignId OR product association for backward compat if needed?
          // User requested "campaign orders must be placed seperately".
          // Let's rely on the explicit campaignId for new logic.

          employeeOrders.forEach(o => {
            if (o.campaignId === campaign.id) usage += (o.quantity || 1);
          });
          currentCart.forEach(c => {
            if (c.campaignId === campaign.id) usage += (c.quantity || 1);
          });

          if (usage + requestedQty > limit) {
            return res.status(400).json({
              message: `Campaign limit reached. You can only select ${limit} products for "${campaign.name}".`
            });
          }
        }
      } else {
        // Fallback or implicit check? 
        // If no campaignId provided, we assume regular purchase.
        // But what if the product is ONLY available in a campaign?
        // The product might be "active" generally.
        // We'll skip campaign limit checks if no campaignId is explicitly passed, 
        // assuming the frontend handles the context.
      }

      const currentItems = await storage.getCartItems(employee.id);
      const existing = currentItems.find(
        (it) =>
          it.productId === data.productId &&
          (it.selectedColor ?? null) === (data.selectedColor ?? null) &&
          (it.selectedSize ?? null) === (data.selectedSize ?? null)
      );

      if (existing) {
        const newQuantity = (existing.quantity || 1) + requestedQty;
        if ((product.stock || 0) < newQuantity) {
          return res.status(400).json({ message: "Insufficient stock" });
        }
        const updated = await storage.updateCartItem(existing.id, { quantity: newQuantity });
        return res.json(updated);
      }

      const item = await storage.createCartItem({
        employeeId: employee.id,
        productId: data.productId,
        selectedColor: data.selectedColor || null,
        selectedSize: data.selectedSize || null,
        quantity: requestedQty,
        campaignId: data.campaignId,
      });
      res.json(item);
    } catch (error: any) {
      console.error("Cart POST error:", error);
      res.status(400).json({ message: "Invalid cart item data", details: error.message });
    }
  });

  app.put("/api/cart/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: "Invalid quantity" });
      }
      const item = await storage.getCartItem(id);
      if (!item) return res.status(404).json({ message: "Cart item not found" });
      const product = await storage.getProduct(item.productId);
      if (!product) return res.status(404).json({ message: "Product not found" });
      if ((product.stock || 0) < quantity) {
        return res.status(400).json({ message: "Insufficient stock" });
      }

      // Check Campaign Limits for Update
      const productCampaigns = await storage.getProductCampaigns(product.id);
      const activeCampaignsWithLimit = productCampaigns.filter(c => c.isActive && c.maxProductsPerUser !== null);

      if (activeCampaignsWithLimit.length > 0) {
        const employee = await storage.getEmployee(item.employeeId);
        if (employee) {
          const employeeOrders = await storage.getOrdersByEmployeeId(employee.id);
          const currentCart = await storage.getCartItems(employee.id);

          for (const campaign of activeCampaignsWithLimit) {
            const limit = campaign.maxProductsPerUser!;
            const campaignProducts = await storage.getCampaignProducts(campaign.id);
            const campaignProductIds = new Set(campaignProducts.map(cp => cp.product.id));

            let usage = 0;
            employeeOrders.forEach(o => {
              if (campaignProductIds.has(o.productId)) usage += (o.quantity || 1);
            });

            // Count cart EXCLUDING the current item being updated
            currentCart.forEach(c => {
              if (c.id !== item.id && campaignProductIds.has(c.productId)) {
                usage += (c.quantity || 1);
              }
            });

            if (usage + quantity > limit) {
              return res.status(400).json({
                message: `Campaign limit reached. You can only select ${limit} products for "${campaign.name}".`
              });
            }
          }
        }
      }

      const updated = await storage.updateCartItem(id, { quantity });
      res.json(updated);
    } catch (error: any) {
      console.error("Cart PUT error:", error);
      res.status(500).json({ message: "Error updating cart item", details: error.message });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const ok = await storage.removeCartItem(req.params.id);
      if (!ok) return res.status(404).json({ message: "Cart item not found" });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Cart DELETE error:", error);
      res.status(500).json({ message: "Error removing cart item", details: error.message });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ message: "No token provided" });

      const session = await storage.getSession(token);
      if (!session) return res.status(401).json({ message: "Invalid session" });

      const employee = await storage.getEmployee(session.employeeId);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      const branding = await storage.getBranding();
      const maxSelections = branding?.maxSelectionsPerUser ?? 1;

      const { deliveryMethod = "office", deliveryAddress = null } = req.body;

      const cartItems = await storage.getCartItems(session.employeeId);
      if (cartItems.length === 0) return res.status(400).json({ message: "Cart is empty" });

      const employeeOrders = await storage.getOrdersByEmployeeId(session.employeeId);
      if (maxSelections !== -1 && employeeOrders.length + cartItems.length > maxSelections) {
        return res.status(400).json({ message: "Selection limit reached" });
      }

      const inrPerPoint = parseFloat(branding?.inrPerPoint ?? "1");
      let totalPointsRequired = 0;

      // ✅ slab-aware points calc
      for (const item of cartItems) {
        const p = await storage.getProduct(item.productId);
        if (!p || (p.stock || 0) < item.quantity) {
          return res.status(400).json({ message: `Product ${p?.name || item.productId} unavailable` });
        }

        const unitPrice = getUnitPriceForQty(p, item.quantity);
        totalPointsRequired += Math.ceil(unitPrice / inrPerPoint) * item.quantity;
      }

      const userPoints = employee.points ?? 0;
      if (userPoints < totalPointsRequired) {
        return res.status(400).json({ message: "Insufficient points" });
      }

      const orders: any[] = [];
      for (const item of cartItems) {
        const p = await storage.getProduct(item.productId);
        if (!p) continue;

        await storage.updateProduct(item.productId, { stock: (p.stock || 0) - item.quantity });

        const unitPrice = getUnitPriceForQty(p, item.quantity);
        const usedPoints = Math.ceil(unitPrice / inrPerPoint) * item.quantity;

        const order = await storage.createOrder({
          employeeId: session.employeeId,
          productId: item.productId,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          quantity: item.quantity,
          campaignId: item.campaignId || undefined,
          metadata: {
            usedPoints,
            unitPrice,
            deliveryMethod,
            deliveryAddress,
          },
        });

        orders.push({ order, product: p });
      }

      await storage.updateEmployee(employee.id, { points: userPoints - totalPointsRequired });
      await storage.clearCart(session.employeeId);

      const updatedEmployee = await storage.getEmployee(session.employeeId);
      res.json({ orders, employee: updatedEmployee });
    } catch (error: any) {
      console.error("Orders POST error:", error);
      res.status(500).json({ message: "Error creating orders", details: error.message });
    }
  });


  // ===============================
  // PhonePe Payment Routes (UPDATED)
  // Uses .env:
  // PHONEPE_MERCHANT_ID
  // PHONEPE_SALT_KEY
  // PHONEPE_SALT_INDEX
  // PHONEPE_REDIRECT_URL_BASE  (frontend base URL)
  // Optional (if you want): PHONEPE_API_URL
  // ===============================
  app.post("/api/orders/create-copay-order", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ message: "No token" });

      const session = await storage.getSession(token);
      if (!session) return res.status(401).json({ message: "Invalid session" });

      const employee = await storage.getEmployee(session.employeeId);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      const { deliveryMethod = "office", deliveryAddress = null } = req.body;

      const cartItems = await storage.getCartItems(session.employeeId);
      if (cartItems.length === 0) return res.status(400).json({ message: "Cart is empty" });

      const branding = await storage.getBranding();
      const maxSelections = branding?.maxSelectionsPerUser ?? 1;

      const employeeOrders = await storage.getOrdersByEmployeeId(session.employeeId);
      if (maxSelections !== -1 && employeeOrders.length + cartItems.length > maxSelections) {
        return res.status(400).json({ message: "Selection limit reached" });
      }

      const inrPerPoint = parseFloat(branding?.inrPerPoint ?? "1");
      let totalPointsRequired = 0;

      // ✅ slab-aware points calc
      for (const item of cartItems) {
        const product = await storage.getProduct(item.productId);
        if (!product || (product.stock || 0) < item.quantity) {
          return res
            .status(400)
            .json({ message: `Product ${product?.name || item.productId} unavailable` });
        }

        const unitPrice = getUnitPriceForQty(product, item.quantity);
        totalPointsRequired += Math.ceil(unitPrice / inrPerPoint) * item.quantity;
      }

      const userPoints = employee.points ?? 0;
      if (userPoints >= totalPointsRequired) {
        return res.status(400).json({ message: "Sufficient points, use normal checkout" });
      }

      const deficitPoints = totalPointsRequired - userPoints;
      const copayInr = Math.ceil(deficitPoints * inrPerPoint);

      const merchantId = process.env.PHONEPE_MERCHANT_ID;
      const saltKey = process.env.PHONEPE_SALT_KEY;
      const saltIndex = process.env.PHONEPE_SALT_INDEX || "1";
      const redirectBase = process.env.PHONEPE_REDIRECT_URL_BASE;
      const apiUrl = process.env.PHONEPE_API_URL || "https://api-preprod.phonepe.com/apis/pg-sandbox";

      if (!merchantId || !saltKey || !redirectBase) {
        return res.status(500).json({
          message:
            "PhonePe not configured. Missing PHONEPE_MERCHANT_ID / PHONEPE_SALT_KEY / PHONEPE_REDIRECT_URL_BASE",
        });
      }

      const merchantTransactionId = `TXN_${Date.now()}`;
      const redirectUrl = `${redirectBase.replace(/\/$/, "")}/cart`;

      const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
      const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
      const backendBase = `${proto}://${host}`;

      let callbackUrl =
        `${backendBase}/api/orders/phonepe-callback` +
        `?merchantTransactionId=${encodeURIComponent(merchantTransactionId)}` +
        `&deliveryMethod=${encodeURIComponent(deliveryMethod)}`;

      if (deliveryAddress) {
        callbackUrl += `&deliveryAddress=${encodeURIComponent(deliveryAddress)}`;
      }

      const payload = {
        merchantId,
        merchantTransactionId,
        merchantUserId: employee.id,
        amount: copayInr * 100,
        redirectUrl,
        redirectMode: "REDIRECT",
        callbackUrl,
        mobileNumber: employee.phoneNumber?.replace(/^\+91/, ""),
        paymentInstrument: { type: "PAY_PAGE" },
      };

      const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
      const endpoint = "/pg/v1/pay";

      const stringToHash = base64Payload + endpoint + saltKey;
      const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex");
      const xVerify = sha256 + "###" + saltIndex;

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
        },
        body: JSON.stringify({ request: base64Payload }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        return res.status(500).json({
          message: "Failed to initiate PhonePe payment",
          details: result,
        });
      }

      const paymentUrl =
        result?.data?.instrumentResponse?.redirectInfo?.url ||
        result?.data?.instrumentResponse?.redirectInfo?.redirectUrl;

      if (!paymentUrl) {
        return res.status(500).json({ message: "PhonePe redirect URL missing", details: result });
      }

      res.json({
        paymentUrl,
        merchantTransactionId,
      });
    } catch (error: any) {
      console.error("create-copay-order error:", error);
      res.status(500).json({ message: "Failed to create copay order", details: error.message });
    }
  });


  app.post("/api/orders/phonepe-callback", async (req, res) => {
    try {
      const { code } = req.body;
      const { merchantTransactionId, deliveryMethod, deliveryAddress } = req.query;

      const redirectBase = process.env.PHONEPE_REDIRECT_URL_BASE || "http://localhost:5173";
      const frontendCart = `${redirectBase.replace(/\/$/, "")}/cart`;

      // PhonePe can hit callback for success/failure depending on integration
      if (code !== "PAYMENT_SUCCESS") {
        return res.redirect(`${frontendCart}?payment=failure`);
      }

      if (merchantTransactionId && deliveryMethod) {
        const qs =
          `merchantTransactionId=${encodeURIComponent(merchantTransactionId as string)}` +
          `&deliveryMethod=${encodeURIComponent(deliveryMethod as string)}` +
          (deliveryAddress ? `&deliveryAddress=${encodeURIComponent(deliveryAddress as string)}` : "");

        return res.redirect(`${frontendCart}?${qs}`);
      }

      return res.redirect(`${frontendCart}?payment=success`);
    } catch (error: any) {
      console.error("PhonePe callback error:", error);
      const redirectBase = process.env.PHONEPE_REDIRECT_URL_BASE || "http://localhost:5173";
      return res.redirect(`${redirectBase.replace(/\/$/, "")}/cart?payment=failure`);
    }
  });

  app.post("/api/orders/verify-copay", async (req, res) => {
    try {
      const {
        merchantTransactionId,
        merchantOrderId,
        deliveryMethod = "office",
        deliveryAddress = null,
      } = req.body;

      const txnId = merchantTransactionId || merchantOrderId;
      if (!txnId) return res.status(400).json({ message: "Missing merchantTransactionId" });

      const merchantId = process.env.PHONEPE_MERCHANT_ID;
      const saltKey = process.env.PHONEPE_SALT_KEY;
      const saltIndex = process.env.PHONEPE_SALT_INDEX || "1";
      const apiUrl = process.env.PHONEPE_API_URL || "https://api-preprod.phonepe.com/apis/pg-sandbox";

      if (!merchantId || !saltKey) {
        return res.status(500).json({ message: "PhonePe not configured" });
      }

      const endpoint = `/pg/v1/status/${merchantId}/${txnId}`;
      const stringToHash = endpoint + saltKey;
      const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex");
      const xVerify = sha256 + "###" + saltIndex;

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
          "X-MERCHANT-ID": merchantId,
        },
      });

      const result = await response.json();

      if (!response.ok || !result?.success || result?.code !== "PAYMENT_SUCCESS") {
        return res.status(400).json({ message: "Payment not completed", details: result });
      }

      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ message: "No token" });

      const session = await storage.getSession(token);
      if (!session) return res.status(401).json({ message: "Invalid session" });

      const employee = await storage.getEmployee(session.employeeId);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      const branding = await storage.getBranding();
      const maxSelections = branding?.maxSelectionsPerUser ?? 1;

      const employeeOrders = await storage.getOrdersByEmployeeId(session.employeeId);
      const cartItems = await storage.getCartItems(session.employeeId);

      if (cartItems.length === 0) return res.status(400).json({ message: "Cart is empty" });
      if (maxSelections !== -1 && employeeOrders.length + cartItems.length > maxSelections) {
        return res.status(400).json({ message: "Selection limit reached" });
      }

      const inrPerPoint = parseFloat(branding?.inrPerPoint ?? "1");
      let totalPointsRequired = 0;

      // ✅ slab-aware points calc
      for (const item of cartItems) {
        const product = await storage.getProduct(item.productId);
        if (!product || (product.stock || 0) < item.quantity) {
          return res
            .status(400)
            .json({ message: `Product ${product?.name || item.productId} unavailable` });
        }

        const unitPrice = getUnitPriceForQty(product, item.quantity);
        totalPointsRequired += Math.ceil(unitPrice / inrPerPoint) * item.quantity;
      }

      const userPoints = employee.points ?? 0;
      if (userPoints >= totalPointsRequired) {
        return res.status(400).json({ message: "Sufficient points" });
      }

      const deficitPoints = totalPointsRequired - userPoints;
      const copayInr = Math.ceil(deficitPoints * inrPerPoint);

      const paidAmount = (result?.data?.amount ?? 0) / 100;
      if (paidAmount !== copayInr) {
        return res.status(400).json({ message: "Amount mismatch", expected: copayInr, paid: paidAmount });
      }

      const orders: any[] = [];
      for (const item of cartItems) {
        const product = await storage.getProduct(item.productId);
        if (!product) continue;

        await storage.updateProduct(item.productId, { stock: (product.stock || 0) - item.quantity });

        const unitPrice = getUnitPriceForQty(product, item.quantity);
        const usedPoints = Math.ceil(unitPrice / inrPerPoint) * item.quantity;

        const order = await storage.createOrder({
          employeeId: employee.id,
          productId: item.productId,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          quantity: item.quantity,
          campaignId: item.campaignId || undefined,
          metadata: {
            usedPoints,
            unitPrice,
            copayInr,
            paymentId: result?.data?.transactionId,
            phonepeOrderId: txnId,
            deliveryMethod,
            deliveryAddress,
          },
        });

        orders.push({ order, product });
      }

      await storage.updateEmployee(employee.id, { points: 0 });
      await storage.clearCart(employee.id);

      const updatedEmployee = await storage.getEmployee(employee.id);
      res.json({ orders, employee: updatedEmployee });
    } catch (error: any) {
      console.error("verify-copay error:", error);
      res.status(400).json({ message: "Invalid payment", details: error.message });
    }
  });




  app.get("/api/orders/my-orders", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ message: "No token provided" });
      const session = await storage.getSession(token);
      if (!session) return res.status(401).json({ message: "Invalid session" });
      const orders = await storage.getOrdersByEmployeeId(session.employeeId);
      const categories = await storage.getAllCategories();
      const categoryMap = buildCategoryMap(categories);

      const detailedOrders = await Promise.all(
        orders.map(async (order) => {
          const product = await storage.getProduct(order.productId);
          const employee = await storage.getEmployee(order.employeeId);

          return {
            order,
            product: product ? attachCategoriesToProduct(product, categoryMap) : null,
            employee
          };
        })
      );
      res.json(detailedOrders);
    } catch {
      res.status(500).json({ message: "Error fetching orders" });
    }
  });

  // Admin Stats
  app.get("/api/admin/stats", async (_req, res) => {
    try {
      const emps = await storage.getAllEmployees();
      const prods = await storage.getAllProducts();
      const ords = await storage.getAllOrders();
      const categories = await storage.getAllCategories();
      const domains = await storage.getAllDomainWhitelists();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ordersToday = ords.filter((o) => o.orderDate && o.orderDate >= today);
      const lockedAccounts = emps.filter((e) => e.isLocked);
      const activeDomains = domains.filter((d) => d.isActive);

      res.json({
        totalEmployees: emps.length,
        totalProducts: prods.length,
        totalCategories: categories.length,
        totalDomains: domains.length,
        activeDomains: activeDomains.length,
        ordersToday: ordersToday.length,
        lockedAccounts: lockedAccounts.length,
      });
    } catch (error: any) {
      console.error("Stats error:", error);
      res.status(500).json({ message: "Error fetching stats" });
    }
  });

  // Employees Admin
  app.get("/api/admin/employees", async (_req, res) => {
    try {
      const emps = await storage.getAllEmployees();
      res.json(emps);
    } catch {
      res.status(500).json({ message: "Error fetching employees" });
    }
  });

  app.post("/api/admin/employees", async (req, res) => {
    try {
      const body = insertEmployeeSchema.parse(req.body);
      const email = body.email.trim().toLowerCase();
      if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email" });

      // Check if domain is whitelisted
      const domainCheck = await storage.checkDomainWhitelisted(email);
      if (!domainCheck.isWhitelisted && domainCheck.domain?.canLoginWithoutEmployeeId === false) {
        return res.status(403).json({
          message: "Email domain not authorized or requires whitelisting"
        });
      }

      const exists = await storage.getEmployeeByEmail(email);
      if (exists) return res.status(409).json({ message: "Employee already exists (email)" });
      const employee = await storage.createEmployee({ ...body, email });
      res.json(employee);
    } catch {
      res.status(400).json({ message: "Invalid employee data" });
    }
  });

  // ✅ UPDATED: POST /api/admin/employees/bulk
  app.post("/api/admin/employees/bulk", async (req, res) => {
    try {
      const rows = Array.isArray(req.body) ? req.body : [];
      let inserted = 0;
      let skipped = 0;

      const toBoolLoose = (v: any): boolean | undefined => {
        if (v === undefined || v === null || v === "") return undefined;
        if (typeof v === "boolean") return v;
        if (typeof v === "number") return v === 1;

        const s = String(v).trim().toLowerCase();
        if (["1", "true", "yes", "y"].includes(s)) return true;
        if (["0", "false", "no", "n"].includes(s)) return false;
        return undefined;
      };

      for (const r of rows) {
        try {
          const rawEmail = r.email ? String(r.email).trim().toLowerCase() : "";
          if (!rawEmail || !isValidEmail(rawEmail)) {
            skipped++;
            continue;
          }

          // Check domain whitelist
          const domainCheck = await storage.checkDomainWhitelisted(rawEmail);
          if (!domainCheck.isWhitelisted && domainCheck.domain?.canLoginWithoutEmployeeId === false) {
            skipped++;
            continue;
          }

          const exists = await storage.getEmployeeByEmail(rawEmail);

          // ✅ optional column in sheet: bulkBuyAllowed (true/false/1/0/yes/no)
          const bulkBuyAllowed = toBoolLoose((r as any).bulkBuyAllowed);

          if (exists) {
            const pts = Number((r as any).points);
            const patch: any = {};

            if (Number.isFinite(pts)) patch.points = pts;
            if (bulkBuyAllowed !== undefined) patch.bulkBuyAllowed = bulkBuyAllowed;

            // only write if something actually changed
            if (Object.keys(patch).length) {
              await storage.updateEmployee(exists.id, patch);
            }

            skipped++;
            continue;
          }

          const firstName = String((r as any).firstName || "").trim();
          const lastName = String((r as any).lastName || "").trim();
          const points = Number.isFinite(Number((r as any).points)) ? Number((r as any).points) : 0;

          if (!firstName || !lastName) {
            skipped++;
            continue;
          }

          await storage.createEmployee({
            firstName,
            lastName,
            email: rawEmail,
            points,
            // ✅ default false if not provided
            bulkBuyAllowed: bulkBuyAllowed ?? false,
          } as any);

          inserted++;
        } catch {
          skipped++;
        }
      }

      res.json({ inserted, skipped });
    } catch {
      res.status(400).json({ message: "Invalid bulk payload" });
    }
  });


  app.put("/api/admin/employees/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Only allow specific editable fields
      const updates: any = {};
      const body = req.body || {};

      if (body.firstName !== undefined) updates.firstName = String(body.firstName).trim();
      if (body.lastName !== undefined) updates.lastName = String(body.lastName).trim();

      // email update + validation + domain whitelist checks
      if (body.email !== undefined) {
        const email = String(body.email || "").trim().toLowerCase();
        if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email" });

        const domainCheck = await storage.checkDomainWhitelisted(email);
        if (!domainCheck.isWhitelisted && domainCheck.domain?.canLoginWithoutEmployeeId === false) {
          return res.status(403).json({ message: "Email domain not authorized" });
        }

        updates.email = email;
      }

      // points update
      if (body.points !== undefined) {
        const pts = Number(body.points);
        if (!Number.isFinite(pts) || pts < 0) {
          return res.status(400).json({ message: "Invalid points" });
        }
        updates.points = Math.floor(pts);
      }

      // bulkBuyAllowed update
      if (body.bulkBuyAllowed !== undefined) {
        updates.bulkBuyAllowed = Boolean(body.bulkBuyAllowed);
      }

      // ✅ role update
      if (body.role !== undefined) {
        const role = String(body.role || "").trim().toLowerCase();
        const allowed = ["user", "admin", "procurement"];
        if (!allowed.includes(role)) {
          return res.status(400).json({ message: "Invalid role. Allowed: user, admin, procurement" });
        }
        updates.role = role;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const updated = await storage.updateEmployee(id, updates);
      if (!updated) return res.status(404).json({ message: "Employee not found" });

      res.json(updated);
    } catch (error: any) {
      console.error("Employee update error:", error);
      res.status(500).json({ message: "Error updating employee", details: error.message });
    }
  });


  app.post("/api/admin/employees/:id/unlock", async (req, res) => {
    try {
      const { id } = req.params;
      const emp = await storage.getEmployee(id);
      if (!emp) return res.status(404).json({ message: "Employee not found" });
      const updated = await storage.updateEmployee(id, { loginAttempts: 0, isLocked: false });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Error unlocking employee" });
    }
  });

  // Orders Admin
  app.get("/api/admin/orders", async (_req, res) => {
    try {
      const ords = await storage.getAllOrders();
      const categories = await storage.getAllCategories();
      const categoryMap = buildCategoryMap(categories);

      const withDetails = await Promise.all(
        ords.map(async (o) => {
          const product = await storage.getProduct(o.productId);
          const employee = await storage.getEmployee(o.employeeId);

          return {
            ...o,
            product: product ? attachCategoriesToProduct(product, categoryMap) : null,
            employee
          };
        })
      );
      res.json(withDetails);
    } catch {
      res.status(500).json({ message: "Error fetching orders" });
    }
  });

  app.post("/api/admin/products", async (req, res) => {
    try {
      const raw = { ...req.body };

      // ✅ normalize slabs before schema validation
      try {
        raw.priceSlabs = normalizePriceSlabs(raw.priceSlabs);
      } catch (e: any) {
        return res.status(400).json({ message: e.message || "Invalid price slabs" });
      }

      const productData = insertProductSchema.parse(raw);

      const product = await storage.createProduct(productData);
      res.json(product);
    } catch (error: any) {
      console.error("Create product error:", error);
      res.status(400).json({ message: "Invalid product data", details: error.message });
    }
  });

  app.put("/api/admin/products/:id", async (req, res) => {
    try {
      const updates = { ...req.body };

      // ✅ normalize slabs on update too
      if ("priceSlabs" in updates) {
        try {
          updates.priceSlabs = normalizePriceSlabs(updates.priceSlabs);
        } catch (e: any) {
          return res.status(400).json({ message: e.message || "Invalid price slabs" });
        }
      }

      // ✅ recommended: validate partial payload (prevents bad writes)
      // const validated = insertProductSchema.partial().parse(updates);

      const product = await storage.updateProduct(req.params.id, updates);
      if (!product) return res.status(404).json({ message: "Product not found" });

      res.json(product);
    } catch (error: any) {
      console.error("Update product error:", error);
      res.status(500).json({ message: "Error updating product", details: error.message });
    }
  });




  app.delete("/api/admin/products/:id", async (req, res) => {
    try {
      const ok = await storage.deleteProduct(req.params.id);
      if (!ok) return res.status(404).json({ message: "Product not found" });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Error deleting product" });
    }
  });

  // Branding
  app.get("/api/admin/branding", async (_req, res) => {
    try {
      const b = await storage.getBranding();
      res.json(b);
    } catch {
      res.status(500).json({ message: "Error fetching branding" });
    }
  });

  app.put("/api/admin/branding", async (req, res) => {
    try {
      const b = await storage.updateBranding(req.body);
      res.json(b);
    } catch {
      res.status(500).json({ message: "Error updating branding" });
    }
  });

  // Campaigns
  app.get("/api/campaigns", async (req, res) => {
    try {
      const allCampaigns = await storage.getAllCampaigns();
      const activeCampaigns = allCampaigns.filter(c => c.isActive);

      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.json([]); // No token, no access (or public?)

      const session = await storage.getSession(token);
      if (!session) return res.json([]);

      const employee = await storage.getEmployee(session.employeeId);
      if (!employee) return res.json([]);

      const allowedCampaigns = [];
      const employeeOrders = await storage.getOrdersByEmployeeId(employee.id);
      const cartItems = await storage.getCartItems(employee.id);

      for (const campaign of activeCampaigns) {
        // 1. Whitelist Access Check
        const access = await storage.checkCampaignAccess(campaign.id, employee.email);
        if (!access.allowed) continue;

        // 2. Limit Check (Orders + Cart)
        if (campaign.maxProductsPerUser !== null) {
          let usage = 0;
          employeeOrders.forEach(o => {
            if (o.campaignId === campaign.id) usage += (o.quantity || 1);
          });
          cartItems.forEach(c => {
            if (c.campaignId === campaign.id) usage += (c.quantity || 1);
          });

          if (usage >= campaign.maxProductsPerUser) {
            // Limit reached (or exceeded), hide campaign
            continue;
          }
        }

        allowedCampaigns.push(campaign);
      }

      res.json(allowedCampaigns);
    } catch (error: any) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Error fetching campaigns" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      res.json(campaign);
    } catch {
      res.status(500).json({ message: "Error fetching campaign" });
    }
  });

  app.get("/api/campaigns/:id/products", async (req, res) => {
    try {
      const { id } = req.params;
      const campaignProducts = await storage.getCampaignProducts(id);

      const categories = await storage.getAllCategories();
      const categoryMap = buildCategoryMap(categories);

      const enrichedProducts = campaignProducts.map(cp => ({
        ...cp.product,
        categories: cp.product.categoryIds
          ?.map((catId: string) => categoryMap.get(catId))
          .filter((cat): cat is Category => Boolean(cat)) ?? [],
      }));

      res.json(enrichedProducts);
    } catch {
      res.status(500).json({ message: "Error fetching campaign products" });
    }
  });

  app.post("/api/admin/campaigns", async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(campaignData);
      res.json(campaign);
    } catch (error: any) {
      console.error("Campaign creation error:", error);
      res.status(400).json({ message: "Invalid campaign data", details: error.message });
    }
  });

  app.put("/api/admin/campaigns/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertCampaignSchema.partial().parse(req.body);

      const campaign = await storage.updateCampaign(id, updates);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      res.json(campaign);
    } catch (error: any) {
      console.error("Campaign update error:", error);
      res.status(500).json({ message: "Error updating campaign", details: error.message });
    }
  });

  app.delete("/api/admin/campaigns/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const ok = await storage.deleteCampaign(id);
      if (!ok) return res.status(404).json({ message: "Campaign not found" });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Campaign delete error:", error);
      res.status(500).json({ message: "Error deleting campaign", details: error.message });
    }
  });

  app.post("/api/admin/campaigns/:campaignId/products", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "Product not found" });

      const campaignProduct = await storage.addProductToCampaign(campaignId, productId);
      res.json(campaignProduct);
    } catch (error: any) {
      console.error("Add product to campaign error:", error);
      res.status(400).json({ message: "Error adding product to campaign", details: error.message });
    }
  });

  app.delete("/api/admin/campaigns/:campaignId/products/:productId", async (req, res) => {
    try {
      const { campaignId, productId } = req.params;

      const campaignProducts = await storage.getCampaignProducts(campaignId);
      const campaignProduct = campaignProducts.find(cp => cp.product.id === productId);

      if (!campaignProduct) {
        return res.status(404).json({ message: "Product not found in campaign" });
      }

      const ok = await storage.removeProductFromCampaign(campaignProduct.campaignProduct.id);
      if (!ok) return res.status(500).json({ message: "Error removing product from campaign" });

      res.json({ ok: true });
    } catch (error: any) {
      console.error("Remove product from campaign error:", error);
      res.status(500).json({ message: "Error removing product from campaign", details: error.message });
    }
  });

  app.get("/api/admin/products/:productId/campaigns", async (req, res) => {
    try {
      const { productId } = req.params;
      const campaigns = await storage.getProductCampaigns(productId);
      res.json(campaigns);
    } catch (error: any) {
      console.error("Get product campaigns error:", error);
      res.status(500).json({ message: "Error fetching product campaigns", details: error.message });
    }
  });

  app.get("/api/admin/product-campaigns", async (_req, res) => {
    try {
      const allProducts = await storage.getAllProducts();
      const result: Record<string, Campaign[]> = {};

      for (const product of allProducts) {
        const campaigns = await storage.getProductCampaigns(product.id);
        result[product.id] = campaigns;
      }

      res.json(result);
    } catch (error: any) {
      console.error("Get product campaigns error:", error);
      res.status(500).json({ message: "Error fetching product campaigns", details: error.message });
    }
  });

  // Blogs API
  app.get("/api/blogs", async (_req, res) => {
    try {
      const blogs = await storage.getPublishedBlogs();
      res.json(blogs);
    } catch (error: any) {
      console.error("Blogs fetch error:", error);
      res.status(500).json({ message: "Error fetching blogs", details: error.message });
    }
  });

  app.get("/api/blogs/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const blog = await storage.getBlogBySlug(slug);
      if (!blog) return res.status(404).json({ message: "Blog not found" });

      if (blog.isPublished) {
        await storage.incrementBlogViews(blog.id);
      }

      res.json(blog);
    } catch (error: any) {
      console.error("Blog fetch error:", error);
      res.status(500).json({ message: "Error fetching blog", details: error.message });
    }
  });

  // Admin Blog Routes
  app.get("/api/admin/blogs", async (_req, res) => {
    try {
      const blogs = await storage.getAllBlogs();
      res.json(blogs);
    } catch (error: any) {
      console.error("Admin blogs fetch error:", error);
      res.status(500).json({ message: "Error fetching blogs", details: error.message });
    }
  });

  app.get("/api/admin/blogs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const blog = await storage.getBlog(id);
      if (!blog) return res.status(404).json({ message: "Blog not found" });
      res.json(blog);
    } catch (error: any) {
      console.error("Admin blog fetch error:", error);
      res.status(500).json({ message: "Error fetching blog", details: error.message });
    }
  });

  app.post("/api/admin/blogs", async (req, res) => {
    try {
      const blogData = insertBlogSchema.parse(req.body);

      const dataForDb = {
        ...blogData,
        publishedAt: blogData.isPublished ? new Date() : null,
      };

      const blog = await storage.createBlog(dataForDb);
      res.json(blog);
    } catch (error: any) {
      console.error("Blog creation error:", error);
      res.status(400).json({ message: "Invalid blog data", details: error.message });
    }
  });

  app.put("/api/admin/blogs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertBlogSchema.partial().parse(req.body);

      const updatesForDb: any = { ...updates };
      if (updates.isPublished !== undefined) {
        updatesForDb.publishedAt = updates.isPublished ? new Date() : null;
      }

      const blog = await storage.updateBlog(id, updatesForDb);
      if (!blog) return res.status(404).json({ message: "Blog not found" });
      res.json(blog);
    } catch (error: any) {
      console.error("Blog update error:", error);
      res.status(500).json({ message: "Error updating blog", details: error.message });
    }
  });

  app.delete("/api/admin/blogs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const ok = await storage.deleteBlog(id);
      if (!ok) return res.status(404).json({ message: "Blog not found" });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Blog delete error:", error);
      res.status(500).json({ message: "Error deleting blog", details: error.message });
    }
  });

  // Add this endpoint to get all campaign products
  app.get("/api/admin/all-campaign-products", async (_req, res) => {
    try {
      // Get all campaigns
      const campaigns = await storage.getAllCampaigns();

      // Get products for all campaigns
      const allCampaignProducts: any[] = [];

      for (const campaign of campaigns) {
        const campaignProducts = await storage.getCampaignProducts(campaign.id);

        campaignProducts.forEach(cp => {
          // Add campaign product relationship info
          allCampaignProducts.push({
            campaignProduct: {
              id: cp.campaignProduct?.id || '',
              campaignId: campaign.id,
              productId: cp.product.id,
              createdAt: cp.campaignProduct?.createdAt || new Date().toISOString()
            },
            product: cp.product
          });
        });
      }

      // Remove duplicates (same product might be in multiple campaigns)
      const uniqueProducts = new Map();
      allCampaignProducts.forEach(cp => {
        if (!uniqueProducts.has(cp.product.id)) {
          uniqueProducts.set(cp.product.id, cp);
        }
      });

      res.json(Array.from(uniqueProducts.values()));
    } catch (error: any) {
      console.error("Error fetching all campaign products:", error);
      res.status(500).json({ message: "Error fetching campaign products", details: error.message });
    }
  });

  app.get("/api/bulkbuy/me", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ message: "No token" });

      const session = await storage.getSession(token);
      if (!session) return res.status(401).json({ message: "Invalid session" });

      const employee = await storage.getEmployee(session.employeeId);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      const access = await storage.getBulkBuyAccessByEmail(employee.email);

      const eligible = employee.bulkBuyAllowed === true || !!access?.isActive;

      res.json({
        eligible,
        access: access ?? null,
        employeeFlag: employee.bulkBuyAllowed === true,
      });
    } catch (e: any) {
      res.status(500).json({ message: "Failed", details: e.message });
    }
  });


  /**
   * ===========================
   * USER: Bulk Buy products
   * ===========================
   */
  app.get("/api/bulkbuy/products", async (req, res) => {
    const guard = await requireBulkBuyAccess(req, res);
    if (!guard.ok) return;

    const prods = await storage.getBulkBuyProducts();
    res.json(prods);
  });

  /**
   * ===========================
   * USER: Bulk Buy cart
   * ===========================
   */
  app.get("/api/bulkbuy/cart", async (req, res) => {
    const guard = await requireBulkBuyAccess(req, res);
    if (!guard.ok) return;

    const items = await storage.getBulkBuyCartItems(guard.employee.id);
    res.json(items);
  });

  app.post("/api/bulkbuy/cart", async (req, res) => {
    const guard = await requireBulkBuyAccess(req, res);
    if (!guard.ok) return;

    const { productId, quantity = 1, selectedColor = null, selectedSize = null } = req.body || {};
    if (!productId) return res.status(400).json({ message: "ProductId required" });
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const p = await storage.getProduct(productId);
    if (!p || p.isActive === false || p.bulkBuy !== true) {
      return res.status(404).json({ message: "Bulk buy product not found" });
    }

    if ((p.colors?.length || 0) > 0 && !selectedColor) {
      return res.status(400).json({ message: "Please select a color" });
    }

    if ((p as any).sizes?.values?.length > 0 && !selectedSize) {
      return res.status(400).json({ message: "Please select a size" });
    }

    if ((p.stock || 0) < quantity) return res.status(400).json({ message: "Insufficient stock" });

    // merge by product+color+size
    const current = await storage.getBulkBuyCartItems(guard.employee.id);
    const existing = current.find(
      (it: any) =>
        it.productId === productId &&
        (it.selectedColor ?? null) === (selectedColor ?? null) &&
        (it.selectedSize ?? null) === (selectedSize ?? null)
    );

    if (existing) {
      const newQty = (existing.quantity || 1) + quantity;
      if ((p.stock || 0) < newQty) return res.status(400).json({ message: "Insufficient stock" });

      const updated = await storage.updateBulkBuyCartItem(existing.id, { quantity: newQty });
      return res.json(updated);
    }

    const created = await storage.addBulkBuyCartItem(guard.employee.id, productId, selectedColor, selectedSize, quantity);
    res.json(created);
  });

  app.delete("/api/bulkbuy/cart/:id", async (req, res) => {
    const guard = await requireBulkBuyAccess(req, res);
    if (!guard.ok) return;

    const ok = await storage.removeBulkBuyCartItem(req.params.id);
    res.json({ ok });
  });

  /**
   * ===========================
   * USER: Checkout -> request to procurement
   * ===========================
   */
  app.post("/api/bulkbuy/checkout", async (req, res) => {
    const guard = await requireBulkBuyAccess(req, res);
    if (!guard.ok) return;

    const { deliveryMethod = "office", deliveryAddress = null, requesterNote = null } = req.body || {};

    const cart = await storage.getBulkBuyCartItems(guard.employee.id);
    if (!cart.length) return res.status(400).json({ message: "Bulk buy cart is empty" });

    let total = 0;
    const itemsSnap: any[] = [];

    for (const it of cart) {
      const p = await storage.getProduct(it.productId);
      if (!p || p.bulkBuy !== true) continue;

      if ((p.stock || 0) < it.quantity) {
        return res.status(400).json({ message: `Product unavailable: ${p.name}` });
      }

      const unitPrice = getUnitPriceForQty(p, it.quantity);
      const lineTotal = Number((unitPrice * it.quantity).toFixed(2));
      total += lineTotal;

      itemsSnap.push({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        selectedColor: it.selectedColor ?? null,
        quantity: it.quantity,
        unitPrice,
        lineTotal,
      });
    }

    if (!itemsSnap.length) return res.status(400).json({ message: "No valid items to submit" });

    const requestRec = await storage.createBulkBuyRequest({
      employeeId: guard.employee.id,
      deliveryMethod,
      deliveryAddress,
      requesterNote,
      items: itemsSnap,
      totalAmount: total,
    });

    await storage.clearBulkBuyCart(guard.employee.id);

    // Email recipients
    const procurementEmails = await storage.getProcurementRecipients();
    const supportEmail = "support@acegiftingsolutions.com";

    const subject = `Bulk Buy Request Submitted: ${requestRec.requestId}`;
    const table = buildItemsTableHtml(itemsSnap);

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;">
        <h2>Bulk Buy Request Submitted</h2>
        <p><b>Request ID:</b> ${requestRec.requestId}</p>
        <p><b>Requester:</b> ${guard.employee.firstName} ${guard.employee.lastName} (${guard.employee.email})</p>
        <p><b>Status:</b> ${requestRec.status}</p>
        <p><b>Delivery:</b> ${deliveryMethod}${deliveryMethod === "delivery" && deliveryAddress ? ` - ${deliveryAddress}` : ""}</p>
        ${requesterNote ? `<p><b>Note:</b> ${requesterNote}</p>` : ""}
        <h3>Items</h3>
        ${table}
        <p style="margin-top:12px;"><b>Total:</b> ₹${Number(total).toFixed(2)}</p>
        <p style="margin-top:16px;">Message to user: <b>Your request has been submitted to procurement team for approval..</b></p>
      </div>
    `;

    // A) requester
    await emailService.sendMail({
      to: guard.employee.email,
      subject,
      html,
      text: `Bulk Buy Request ${requestRec.requestId} submitted. Total ₹${Number(total).toFixed(2)}.`,
      fromName: "Bulk Buy",
    });

    // B) procurement team + C) support
    await emailService.sendMail({
      to: procurementEmails.length ? procurementEmails : supportEmail,
      cc: supportEmail,
      subject,
      html,
      text: `Bulk Buy Request ${requestRec.requestId} submitted by ${guard.employee.email}.`,
      fromName: "Bulk Buy",
    });

    res.json({
      request: requestRec,
      message: "Your request has been submitted to procurement team for approval..",
    });
  });

  /**
   * ===========================
   * USER: My bulk buy requests
   * ===========================
   */
  app.get("/api/bulkbuy/requests/my", async (req, res) => {
    const guard = await requireBulkBuyAccess(req, res);
    if (!guard.ok) return;

    const rows = await storage.getBulkBuyRequestsByEmployeeId(guard.employee.id);
    res.json(rows);
  });


  /**
 * ===========================
 * USER: Direct Request (no cart)
 * POST /api/bulkbuy/request
 * Body: { productId, quantity, selectedColor, deliveryMethod, deliveryAddress, requesterNote }
 * ===========================
 */
  app.post("/api/bulkbuy/request", async (req, res) => {
    const guard = await requireBulkBuyAccess(req, res);
    if (!guard.ok) return;

    try {
      const {
        productId,
        quantity = 1,
        selectedColor = null,
        selectedSize = null,
        deliveryMethod = "office",
        deliveryAddress = null,
        requesterNote = null,
      } = req.body || {};

      if (!productId) return res.status(400).json({ message: "ProductId required" });
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      if (!["office", "delivery"].includes(deliveryMethod)) {
        return res.status(400).json({ message: "Invalid delivery method" });
      }

      if (deliveryMethod === "delivery" && !String(deliveryAddress || "").trim()) {
        return res.status(400).json({ message: "Delivery address required" });
      }

      const p = await storage.getProduct(productId);
      if (!p || p.isActive === false || p.bulkBuy !== true) {
        return res.status(404).json({ message: "Bulk buy product not found" });
      }

      if (p.colors?.length > 0 && !selectedColor) {
        return res.status(400).json({ message: "Please select a color" });
      }

      const sizes = (p as any).sizes;
      if (sizes?.values?.length > 0 && !selectedSize) {
        return res.status(400).json({ message: "Please select a size" });
      }

      if ((p.stock || 0) < quantity) {
        return res.status(400).json({ message: "Insufficient stock" });
      }

      const unitPrice = getUnitPriceForQty(p, quantity);
      const lineTotal = Number((unitPrice * quantity).toFixed(2));

      const itemsSnap = [
        {
          productId: p.id,
          name: p.name,
          sku: p.sku || "",
          selectedColor,
          selectedSize,
          quantity,
          unitPrice,
          lineTotal,
        },
      ];

      const requestRec = await storage.createBulkBuyRequest({
        employeeId: guard.employee.id,
        deliveryMethod,
        deliveryAddress: deliveryMethod === "delivery" ? deliveryAddress : null,
        requesterNote,
        items: itemsSnap,
        totalAmount: lineTotal,
      });

      // OPTIONAL: notify via email (same as checkout)
      const procurementEmails = await storage.getProcurementRecipients();
      const supportEmail = "support@acegiftingsolutions.com";

      const subject = `Bulk Buy Request Submitted: ${requestRec.requestId}`;
      const table = buildItemsTableHtml(itemsSnap);

      const html = `
      <div style="font-family:Arial,sans-serif;color:#111;">
        <h2>Bulk Buy Request Submitted</h2>
        <p><b>Request ID:</b> ${requestRec.requestId}</p>
        <p><b>Requester:</b> ${guard.employee.firstName} ${guard.employee.lastName} (${guard.employee.email})</p>
        <p><b>Status:</b> ${requestRec.status}</p>
        <p><b>Delivery:</b> ${deliveryMethod}${deliveryMethod === "delivery" && deliveryAddress ? ` - ${deliveryAddress}` : ""
        }</p>
        ${requesterNote ? `<p><b>Note:</b> ${requesterNote}</p>` : ""}
        <h3>Items</h3>
        ${table}
        <p style="margin-top:12px;"><b>Total:</b> ₹${Number(lineTotal).toFixed(2)}</p>
        <p style="margin-top:16px;">Message to user: <b>Your request has been submitted to procurement team for approval..</b></p>
      </div>
    `;

      await emailService.sendMail({
        to: guard.employee.email,
        subject,
        html,
        text: `Bulk Buy Request ${requestRec.requestId} submitted. Total ₹${Number(lineTotal).toFixed(2)}.`,
        fromName: "Bulk Buy",
      });

      await emailService.sendMail({
        to: procurementEmails.length ? procurementEmails : supportEmail,
        cc: supportEmail,
        subject,
        html,
        text: `Bulk Buy Request ${requestRec.requestId} submitted by ${guard.employee.email}.`,
        fromName: "Bulk Buy",
      });

      return res.json({
        request: requestRec,
        message: "Your request has been submitted to procurement team for approval..",
      });
    } catch (e: any) {
      console.error("bulkbuy/request error:", e);
      return res.status(500).json({ message: "Failed to submit request", details: e.message });
    }
  });

  /**
   * ===========================
   * ADMIN: Bulk buy access allowlist upload
   * Expected headers: email,isActive,department,designation,isProcurement
   * ===========================
   */
  app.post("/api/admin/bulkbuy/access/bulk", async (req, res) => {
    try {
      const rows = Array.isArray(req.body) ? req.body : [];
      let upserted = 0;
      let skipped = 0;

      for (const r of rows) {
        const email = String(r.email || "").trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          skipped++;
          continue;
        }

        await storage.upsertBulkBuyAccess({
          email,
          isActive: r.isActive !== undefined ? !!r.isActive : true,
          department: r.department ? String(r.department) : null,
          designation: r.designation ? String(r.designation) : null,
          isProcurement: r.isProcurement !== undefined ? !!r.isProcurement : false,
        } as any);

        upserted++;
      }

      res.json({ upserted, skipped });
    } catch (e: any) {
      res.status(400).json({ message: "Invalid payload", details: e.message });
    }
  });

  /**
   * ===========================
   * ADMIN: View all bulk buy requests
   * ===========================
   */
  app.get("/api/admin/bulkbuy/requests", async (_req, res) => {
    const rows = await storage.getAllBulkBuyRequests();
    res.json(rows);
  });

  /**
   * ===========================
   * ADMIN: Approve/Reject request
   * Body: { status: "approved"|"rejected", procurementNote?: string, approvedByEmployeeId?: string }
   * Triggers email to requester + procurement + support
   * ===========================
   */
  app.put("/api/admin/bulkbuy/requests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, procurementNote = null, approvedByEmployeeId = null } = req.body || {};

      if (!["approved", "rejected", "pending_approval"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updated = await storage.updateBulkBuyRequest(id, {
        status: status as any,
        procurementNote,
        approvedByEmployeeId: approvedByEmployeeId || null,
        approvedAt: status === "approved" ? new Date() : null,
      } as any);

      if (!updated) return res.status(404).json({ message: "Request not found" });

      const requester = await storage.getEmployee(updated.employeeId);
      const procurementEmails = await storage.getProcurementRecipients();
      const supportEmail = "support@acegiftingsolutions.com";

      const subject = `Bulk Buy Request ${String(status).toUpperCase()}: ${updated.requestId}`;

      const html = `
        <div style="font-family:Arial,sans-serif;color:#111;">
          <h2>Bulk Buy Request Update</h2>
          <p><b>Request ID:</b> ${updated.requestId}</p>
          <p><b>Status:</b> ${updated.status}</p>
          <p><b>Total:</b> ₹${updated.totalAmount}</p>
          ${procurementNote ? `<p><b>Procurement Note:</b> ${procurementNote}</p>` : ""}
        </div>
      `;

      // notify requester
      if (requester?.email) {
        await emailService.sendMail({
          to: requester.email,
          subject,
          html,
          text: `Your Bulk Buy Request ${updated.requestId} is now ${updated.status}.`,
          fromName: "Bulk Buy",
        });
      }

      // notify procurement + support
      await emailService.sendMail({
        to: procurementEmails.length ? procurementEmails : supportEmail,
        cc: supportEmail,
        subject,
        html,
        text: `Bulk Buy Request ${updated.requestId} updated to ${updated.status}.`,
        fromName: "Bulk Buy",
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to update request", details: e.message });
    }
  });
}