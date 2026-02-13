import { and, desc, eq, sql as dsql, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  employees,
  products,
  orders,
  cartItems,
  sessions,
  branding as brandingTable,
  otps,
  categories,
  campaigns,
  campaignProducts,
  domainWhitelist,
  blogs,

  // ✅ NEW bulk buy tables
  bulkBuyAccess,
  bulkBuyCartItems,
  bulkBuyRequests,

  type Employee,
  type InsertEmployee,
  type Product,
  type InsertProduct,
  type Order,
  type InsertOrder,
  type CartItem,
  type InsertCartItem,
  type Session,
  type Branding,
  type OTP,
  type Category,
  type InsertCategory,
  type Campaign,
  type InsertCampaign,
  type CampaignProduct,
  type InsertCampaignProduct,
  type DomainWhitelist,
  type InsertDomainWhitelist,
  type Blog,
  type InsertBlog,
  type BulkBuyAccess,
  type InsertBulkBuyAccess,
  type BulkBuyRequest,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Categories
  getCategory(id: string): Promise<Category | undefined>;
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, updates: Partial<Category>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  // Domain Whitelist
  getDomainWhitelist(id: string): Promise<DomainWhitelist | undefined>;
  getAllDomainWhitelists(): Promise<DomainWhitelist[]>;
  getDomainWhitelistByDomain(domain: string): Promise<DomainWhitelist | undefined>;
  getActiveDomainWhitelist(): Promise<DomainWhitelist[]>;
  createDomainWhitelist(domain: InsertDomainWhitelist): Promise<DomainWhitelist>;
  updateDomainWhitelist(id: string, updates: Partial<DomainWhitelist>): Promise<DomainWhitelist | undefined>;
  deleteDomainWhitelist(id: string): Promise<boolean>;
  checkDomainWhitelisted(email: string): Promise<{ isWhitelisted: boolean; domain: DomainWhitelist | null }>;

  // Campaigns
  getCampaign(id: string): Promise<Campaign | undefined>;
  getAllCampaigns(): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;

  // Campaign Products
  getCampaignProducts(campaignId: string): Promise<{ product: Product; campaignProduct: CampaignProduct }[]>;
  addProductToCampaign(campaignId: string, productId: string): Promise<CampaignProduct>;
  removeProductFromCampaign(campaignProductId: string): Promise<boolean>;
  getProductCampaigns(productId: string): Promise<Campaign[]>;

  // Employees
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeByEmployeeId(employeeId: string): Promise<Employee | undefined>;
  getEmployeeByEmail(email: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | undefined>;
  getAllEmployees(): Promise<Employee[]>;

  // Products
  getProduct(id: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Orders
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByEmployeeId(employeeId: string): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;

  // Cart
  getCartItem(id: string): Promise<CartItem | undefined>;
  getCartItems(employeeId: string): Promise<CartItem[]>;
  createCartItem(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, updates: Partial<CartItem>): Promise<CartItem | undefined>;
  removeCartItem(id: string): Promise<boolean>;
  clearCart(employeeId: string): Promise<void>;

  // Sessions
  getSession(token: string): Promise<Session | undefined>;
  createSession(employeeId: string): Promise<Session>;
  deleteSession(token: string): Promise<boolean>;

  // Branding
  getBranding(): Promise<Branding | undefined>;
  updateBranding(updates: Partial<Branding>): Promise<Branding>;

  // OTP
  createOTP(rec: { email: string; code: string; expiresAt: Date; metadata?: any }): Promise<OTP>;
  getLastOTPForEmail(email: string): Promise<OTP | undefined>;
  markOTPAsUsed(id: string): Promise<void>;

  // Blogs
  getBlog(id: string): Promise<Blog | undefined>;
  getBlogBySlug(slug: string): Promise<Blog | undefined>;
  getAllBlogs(): Promise<Blog[]>;
  getPublishedBlogs(): Promise<Blog[]>;
  createBlog(blog: InsertBlog): Promise<Blog>;
  updateBlog(id: string, updates: Partial<Blog>): Promise<Blog | undefined>;
  deleteBlog(id: string): Promise<boolean>;
  incrementBlogViews(id: string): Promise<void>;

  // ✅ BULK BUY ACCESS
  getBulkBuyAccessByEmail(email: string): Promise<BulkBuyAccess | undefined>;
  upsertBulkBuyAccess(rec: InsertBulkBuyAccess): Promise<BulkBuyAccess>;
  getProcurementRecipients(): Promise<string[]>;

  // ✅ BULK BUY PRODUCTS
  getBulkBuyProducts(): Promise<Product[]>;

  // ✅ BULK BUY CART
  getBulkBuyCartItems(employeeId: string): Promise<{ id: string; employeeId: string; productId: string; selectedColor: string | null; quantity: number; createdAt: Date | null }[]>;
  addBulkBuyCartItem(employeeId: string, productId: string, selectedColor: string | null, quantity: number): Promise<any>;
  updateBulkBuyCartItem(id: string, updates: { quantity?: number }): Promise<any | undefined>;
  removeBulkBuyCartItem(id: string): Promise<boolean>;
  clearBulkBuyCart(employeeId: string): Promise<void>;

  // ✅ BULK BUY REQUESTS
  createBulkBuyRequest(input: {
    employeeId: string;
    deliveryMethod: "office" | "delivery";
    deliveryAddress?: string | null;
    requesterNote?: string | null;
    items: Array<{
      productId: string;
      name: string;
      sku?: string;
      selectedColor?: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    totalAmount: number;
  }): Promise<BulkBuyRequest>;

  getBulkBuyRequestsByEmployeeId(employeeId: string): Promise<BulkBuyRequest[]>;
  getAllBulkBuyRequests(): Promise<BulkBuyRequest[]>;
  updateBulkBuyRequest(id: string, updates: Partial<BulkBuyRequest>): Promise<BulkBuyRequest | undefined>;
}

class DrizzleStorage implements IStorage {
  // Categories
  async getCategory(id: string) {
    const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return rows[0];
  }

  async getAllCategories() {
    return db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(desc(categories.sortOrder), desc(categories.createdAt));
  }

  async createCategory(categoryData: InsertCategory) {
    const rows = await db.insert(categories).values(categoryData).returning();
    return rows[0];
  }

  async updateCategory(id: string, updates: Partial<Category>) {
    const rows = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
    return rows[0];
  }

  async deleteCategory(id: string) {
    const res = await db.delete(categories).where(eq(categories.id, id));
    return res.rowCount ? res.rowCount > 0 : true;
  }

  // Domain Whitelist
  async getDomainWhitelist(id: string) {
    const rows = await db.select().from(domainWhitelist).where(eq(domainWhitelist.id, id)).limit(1);
    return rows[0];
  }

  async getAllDomainWhitelists() {
    return db.select().from(domainWhitelist).orderBy(desc(domainWhitelist.createdAt));
  }

  async getDomainWhitelistByDomain(domain: string) {
    const rows = await db.select().from(domainWhitelist).where(eq(domainWhitelist.domain, domain)).limit(1);
    return rows[0];
  }

  async getActiveDomainWhitelist() {
    return db
      .select()
      .from(domainWhitelist)
      .where(eq(domainWhitelist.isActive, true))
      .orderBy(desc(domainWhitelist.createdAt));
  }

  async createDomainWhitelist(domainData: InsertDomainWhitelist) {
    const rows = await db.insert(domainWhitelist).values(domainData).returning();
    return rows[0];
  }

  async updateDomainWhitelist(id: string, updates: Partial<DomainWhitelist>) {
    const rows = await db
      .update(domainWhitelist)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(domainWhitelist.id, id))
      .returning();
    return rows[0];
  }

  async deleteDomainWhitelist(id: string) {
    const res = await db.delete(domainWhitelist).where(eq(domainWhitelist.id, id));
    return res.rowCount ? res.rowCount > 0 : true;
  }

  async checkDomainWhitelisted(email: string): Promise<{ isWhitelisted: boolean; domain: DomainWhitelist | null }> {
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (!emailDomain) return { isWhitelisted: false, domain: null };

    const domains = await this.getActiveDomainWhitelist();
    const matchedDomain = domains.find((d) => emailDomain === d.domain.toLowerCase());

    return {
      isWhitelisted: !!matchedDomain,
      domain: matchedDomain || null,
    };
  }

  // Campaigns
  async getCampaign(id: string) {
    const rows = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    return rows[0];
  }

  async getAllCampaigns() {
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async createCampaign(campaignData: InsertCampaign) {
    const rows = await db.insert(campaigns).values(campaignData).returning();
    return rows[0];
  }

  async updateCampaign(id: string, updates: Partial<Campaign>) {
    const rows = await db
      .update(campaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return rows[0];
  }

  async deleteCampaign(id: string) {
    const res = await db.delete(campaigns).where(eq(campaigns.id, id));
    return res.rowCount ? res.rowCount > 0 : true;
  }

  // Blogs
  async getBlog(id: string) {
    const rows = await db.select().from(blogs).where(eq(blogs.id, id)).limit(1);
    return rows[0];
  }

  async getBlogBySlug(slug: string) {
    const rows = await db.select().from(blogs).where(eq(blogs.slug, slug)).limit(1);
    return rows[0];
  }

  async getAllBlogs() {
    return db.select().from(blogs).orderBy(desc(blogs.createdAt));
  }

  async getPublishedBlogs() {
    return db
      .select()
      .from(blogs)
      .where(eq(blogs.isPublished, true))
      .orderBy(desc(blogs.publishedAt));
  }

  async createBlog(blogData: InsertBlog) {
    const rows = await db.insert(blogs).values(blogData).returning();
    return rows[0];
  }

  async updateBlog(id: string, updates: Partial<Blog>) {
    const rows = await db
      .update(blogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(blogs.id, id))
      .returning();
    return rows[0];
  }

  async deleteBlog(id: string) {
    const res = await db.delete(blogs).where(eq(blogs.id, id));
    return res.rowCount ? res.rowCount > 0 : true;
  }

  async incrementBlogViews(id: string) {
    await db.update(blogs).set({ views: dsql`${blogs.views} + 1` }).where(eq(blogs.id, id));
  }

  // Campaign Products
  async getCampaignProducts(campaignId: string) {
    const rows = await db
      .select({
        campaignProduct: campaignProducts,
        product: products,
      })
      .from(campaignProducts)
      .where(eq(campaignProducts.campaignId, campaignId))
      .innerJoin(products, eq(campaignProducts.productId, products.id));

    return rows.map((row) => ({
      product: row.product,
      campaignProduct: row.campaignProduct,
    }));
  }

  async addProductToCampaign(campaignId: string, productId: string) {
    const existing = await db
      .select()
      .from(campaignProducts)
      .where(and(eq(campaignProducts.campaignId, campaignId), eq(campaignProducts.productId, productId)))
      .limit(1);

    if (existing[0]) return existing[0];

    const rows = await db.insert(campaignProducts).values({ campaignId, productId }).returning();
    return rows[0];
  }

  async removeProductFromCampaign(campaignProductId: string) {
    const res = await db.delete(campaignProducts).where(eq(campaignProducts.id, campaignProductId));
    return res.rowCount ? res.rowCount > 0 : true;
  }

  async getProductCampaigns(productId: string) {
    const rows = await db
      .select({ campaign: campaigns })
      .from(campaignProducts)
      .where(eq(campaignProducts.productId, productId))
      .innerJoin(campaigns, eq(campaignProducts.campaignId, campaigns.id));

    return rows.map((row) => row.campaign);
  }

  // Products
  async getProduct(id: string) {
    const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return rows[0];
  }

  async getAllProducts() {
    return db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(products.createdAt));
  }

  async getProductsByCategory(categoryId: string) {
    return db
      .select()
      .from(products)
      .where(and(eq(products.isActive, true), dsql`${categoryId} = ANY(${products.categoryIds})`))
      .orderBy(desc(products.createdAt));
  }

  async createProduct(productData: InsertProduct) {
    const rows = await db.insert(products).values(productData).returning();
    return rows[0];
  }

  async updateProduct(id: string, updates: Partial<Product>) {
    const rows = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return rows[0];
  }

  async deleteProduct(id: string) {
    const res = await db.delete(products).where(eq(products.id, id));
    return res.rowCount ? res.rowCount > 0 : true;
  }

  // Employees
  async getEmployee(id: string) {
    const rows = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    return rows[0];
  }

  async getEmployeeByEmployeeId(employeeId: string) {
    const rows = await db.select().from(employees).where(eq(employees.employeeId, employeeId)).limit(1);
    return rows[0];
  }

  async getEmployeeByEmail(email: string) {
    const rows = await db.select().from(employees).where(eq(employees.email, email)).limit(1);
    return rows[0];
  }

  async createEmployee(employeeData: InsertEmployee) {
    const rows = await db.insert(employees).values(employeeData).returning();
    return rows[0];
  }

  async updateEmployee(id: string, updates: Partial<Employee>) {
    const rows = await db.update(employees).set(updates).where(eq(employees.id, id)).returning();
    return rows[0];
  }

  async getAllEmployees() {
    return db.select().from(employees).orderBy(desc(employees.createdAt));
  }

  // Orders
  async getOrder(id: string) {
    const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return rows[0];
  }

  async getOrdersByEmployeeId(employeeId: string) {
    return db.select().from(orders).where(eq(orders.employeeId, employeeId)).orderBy(desc(orders.orderDate));
  }

  async getAllOrders() {
    return db.select().from(orders).orderBy(desc(orders.orderDate));
  }

  async createOrder(orderData: InsertOrder) {
    const year = new Date().getFullYear();
    const [{ c }] = await db
      .select({ c: dsql<number>`count(*)` })
      .from(orders)
      .where(dsql`extract(year from ${orders.orderDate}) = ${year}`);
    const next = Number(c) + 1;
    const orderId = `ORD-${year}-${String(next).padStart(3, "0")}`;

    const rows = await db
      .insert(orders)
      .values({
        ...orderData,
        orderId,
        status: "confirmed",
        orderDate: new Date(),
        metadata: orderData.metadata ?? null,
      })
      .returning();
    return rows[0];
  }

  // Cart
  async getCartItem(id: string) {
    const rows = await db.select().from(cartItems).where(eq(cartItems.id, id)).limit(1);
    return rows[0];
  }

  async getCartItems(employeeId: string) {
    return db.select().from(cartItems).where(eq(cartItems.employeeId, employeeId));
  }

  async createCartItem(item: InsertCartItem) {
    const rows = await db.insert(cartItems).values(item).returning();
    return rows[0];
  }

  async updateCartItem(id: string, updates: Partial<CartItem>) {
    const rows = await db.update(cartItems).set(updates).where(eq(cartItems.id, id)).returning();
    return rows[0];
  }

  async removeCartItem(id: string) {
    const res = await db.delete(cartItems).where(eq(cartItems.id, id));
    return res.rowCount ? res.rowCount > 0 : true;
  }

  async clearCart(employeeId: string) {
    await db.delete(cartItems).where(eq(cartItems.employeeId, employeeId));
  }

  // Sessions
  async getSession(token: string) {
    const rows = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
    return rows[0];
  }

  async createSession(employeeId: string) {
    const rows = await db
      .insert(sessions)
      .values({
        employeeId,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      })
      .returning();
    return rows[0];
  }

  async deleteSession(token: string) {
    const res = await db.delete(sessions).where(eq(sessions.token, token));
    return res.rowCount ? res.rowCount > 0 : true;
  }

  // Branding
  async getBranding() {
    const rows = await db.select().from(brandingTable).limit(1);
    return rows[0];
  }

  async updateBranding(updates: Partial<Branding>) {
    const current = await this.getBranding();
    if (!current) {
      const rows = await db.insert(brandingTable).values({ ...updates, updatedAt: new Date() }).returning();
      return rows[0];
    }
    const rows = await db
      .update(brandingTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(brandingTable.id, current.id))
      .returning();
    return rows[0];
  }

  // OTP
  async createOTP(rec: { email: string; code: string; expiresAt: Date; metadata?: any }) {
    const rows = await db
      .insert(otps)
      .values({ email: rec.email, code: rec.code, expiresAt: rec.expiresAt, metadata: rec.metadata ?? null })
      .returning();
    return rows[0];
  }

  async getLastOTPForEmail(email: string) {
    const rows = await db
      .select()
      .from(otps)
      .where(and(eq(otps.email, email), isNull(otps.usedAt)))
      .orderBy(desc(otps.createdAt))
      .limit(1);
    return rows[0];
  }

  async markOTPAsUsed(id: string) {
    await db.update(otps).set({ usedAt: new Date() }).where(eq(otps.id, id));
  }

  /* =========================================================
     ✅ BULK BUY: Access Allowlist
     =======================================================*/
  async getBulkBuyAccessByEmail(email: string) {
    const rows = await db.select().from(bulkBuyAccess).where(eq(bulkBuyAccess.email, email)).limit(1);
    return rows[0];
  }

  async upsertBulkBuyAccess(rec: InsertBulkBuyAccess) {
    const email = String(rec.email || "").trim().toLowerCase();
    const existing = await this.getBulkBuyAccessByEmail(email);

    if (existing) {
      const rows = await db
        .update(bulkBuyAccess)
        .set({
          ...rec,
          email,
          updatedAt: new Date(),
        })
        .where(eq(bulkBuyAccess.id, existing.id))
        .returning();
      return rows[0];
    }

    const rows = await db
      .insert(bulkBuyAccess)
      .values({
        ...rec,
        email,
        updatedAt: new Date(),
      })
      .returning();
    return rows[0];
  }

  async getProcurementRecipients(): Promise<string[]> {
    const rows = await db
      .select()
      .from(bulkBuyAccess)
      .where(and(eq(bulkBuyAccess.isActive, true), eq(bulkBuyAccess.isProcurement, true)));
    return rows.map((r) => r.email);
  }

  /* =========================================================
     ✅ BULK BUY: Products
     =======================================================*/
  async getBulkBuyProducts() {
    return db
      .select()
      .from(products)
      .where(and(eq(products.isActive, true), eq(products.bulkBuy, true)))
      .orderBy(desc(products.createdAt));
  }

  /* =========================================================
     ✅ BULK BUY: Cart
     =======================================================*/
  async getBulkBuyCartItems(employeeId: string) {
    return db.select().from(bulkBuyCartItems).where(eq(bulkBuyCartItems.employeeId, employeeId));
  }

  async addBulkBuyCartItem(employeeId: string, productId: string, selectedColor: string | null, quantity: number) {
    const rows = await db
      .insert(bulkBuyCartItems)
      .values({
        employeeId,
        productId,
        selectedColor: selectedColor ?? null,
        quantity,
      })
      .returning();
    return rows[0];
  }

  async updateBulkBuyCartItem(id: string, updates: { quantity?: number }) {
    const rows = await db.update(bulkBuyCartItems).set(updates).where(eq(bulkBuyCartItems.id, id)).returning();
    return rows[0];
  }

  async removeBulkBuyCartItem(id: string) {
    const res = await db.delete(bulkBuyCartItems).where(eq(bulkBuyCartItems.id, id));
    return res.rowCount ? res.rowCount > 0 : true;
  }

  async clearBulkBuyCart(employeeId: string) {
    await db.delete(bulkBuyCartItems).where(eq(bulkBuyCartItems.employeeId, employeeId));
  }

  /* =========================================================
     ✅ BULK BUY: Requests
     =======================================================*/
  async createBulkBuyRequest(input: {
    employeeId: string;
    deliveryMethod: "office" | "delivery";
    deliveryAddress?: string | null;
    requesterNote?: string | null;
    items: Array<{
      productId: string;
      name: string;
      sku?: string;
      selectedColor?: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    totalAmount: number;
  }) {
    const year = new Date().getFullYear();
    const [{ c }] = await db.select({ c: dsql<number>`count(*)` }).from(bulkBuyRequests);
    const next = Number(c) + 1;
    const requestId = `BBR-${year}-${String(next).padStart(4, "0")}`;

    const rows = await db
      .insert(bulkBuyRequests)
      .values({
        requestId,
        employeeId: input.employeeId,
        status: "pending_approval",
        deliveryMethod: input.deliveryMethod,
        deliveryAddress: input.deliveryAddress ?? null,
        requesterNote: input.requesterNote ?? null,
        items: input.items,
        totalAmount: String(input.totalAmount.toFixed(2)),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return rows[0];
  }

  async getBulkBuyRequestsByEmployeeId(employeeId: string) {
    return db
      .select()
      .from(bulkBuyRequests)
      .where(eq(bulkBuyRequests.employeeId, employeeId))
      .orderBy(desc(bulkBuyRequests.createdAt));
  }

  async getAllBulkBuyRequests() {
    return db.select().from(bulkBuyRequests).orderBy(desc(bulkBuyRequests.createdAt));
  }

  async updateBulkBuyRequest(id: string, updates: Partial<BulkBuyRequest>) {
    const rows = await db
      .update(bulkBuyRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bulkBuyRequests.id, id))
      .returning();
    return rows[0];
  }
}

export const storage: IStorage = new DrizzleStorage();
