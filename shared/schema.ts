import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  json,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* =========================================================
   CATEGORIES
   =======================================================*/
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================
   DOMAIN WHITELIST
   =======================================================*/
export const domainWhitelist = pgTable("domain_whitelist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull().unique(),
  isActive: boolean("is_active").default(true),
  autoCreateUser: boolean("auto_create_user").default(true),
  defaultPoints: integer("default_points").default(0),
  canLoginWithoutEmployeeId: boolean("can_login_without_employee_id").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// EMPLOYEES
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id").unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phoneNumber: text("phone_number"),
  points: integer("points").notNull().default(0),
  loginAttempts: integer("login_attempts").default(0),
  isLocked: boolean("is_locked").default(false),

  bulkBuyAllowed: boolean("bulk_buy_allowed").default(false),

  // ✅ NEW: role
  role: text("role").notNull().default("user"), // user | admin | procurement

  createdAt: timestamp("created_at").defaultNow(),
});


export const employeeRoleSchema = z.enum(["user", "admin", "procurement"]);
export type EmployeeRole = z.infer<typeof employeeRoleSchema>;



/* =========================================================
   PRODUCTS
   =======================================================*/
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  images: json("images").$type<string[]>().default([]),
  colors: json("colors").$type<string[]>().default([]),
  stock: integer("stock").default(0),
  packagesInclude: json("packages_include").$type<string[]>().default([]),
  specifications: text("specifications").default(""),
  sku: text("sku").notNull().unique(),
  isActive: boolean("is_active").default(true),
  backupProductId: varchar("backup_product_id"),
  categoryIds: text("category_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  csrSupport: boolean("csr_support").default(false),

  // ✅ price slabs
  priceSlabs: json("price_slabs")
    .$type<Array<{ minQty: number; maxQty: number | null; price: string }>>()
    .default([]),

  // ✅ NEW: bulk buy flag
  bulkBuy: boolean("bulk_buy").default(false),

  // ✅ NEW: Extra fields
  gst: text("gst").default("0"),
  stockStatus: text("stock_status").default("non_committed"), // committed | non_committed
  brandStore: boolean("brand_store").default(false),
  brand: text("brand").default(""),
  sizes: json("sizes").$type<{ unit: string; values: string[] } | null>().default(null),

  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================
   ORDERS
   =======================================================*/
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: text("order_id").notNull().unique(),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  selectedColor: text("selected_color"),
  selectedSize: text("selected_size"),
  quantity: integer("quantity").notNull().default(1),
  status: text("status").default("confirmed"),
  orderDate: timestamp("order_date").defaultNow(),
  metadata: json("metadata").$type<{
    usedPoints?: number;
    unitPrice?: number;
    copayInr?: number | null;
    paymentId?: string | null;
    phonepeOrderId?: string | null;
    deliveryMethod?: "office" | "delivery" | null;
    deliveryAddress?: string | null;
  } | null>().default(null),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
});

/* =========================================================
   CART ITEMS
   =======================================================*/
export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  selectedColor: text("selected_color"),
  selectedSize: text("selected_size"),
  quantity: integer("quantity").notNull().default(1),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================
   SESSIONS
   =======================================================*/
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================
   BRANDING
   =======================================================*/
export const branding = pgTable("branding", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logoUrl: text("logo_url"),
  companyName: text("company_name").default("TechCorp"),
  primaryColor: text("primary_color").default("#1e40af"),
  accentColor: text("accent_color").default("#f97316"),
  bannerUrl: text("banner_url"),
  bannerText: text("banner_text"),
  updatedAt: timestamp("updated_at").defaultNow(),
  inrPerPoint: decimal("inr_per_point", { precision: 10, scale: 2 }).default("1.00"),
  maxSelectionsPerUser: integer("max_selections_per_user").default(1),
});

/* =========================================================
   OTP ISSUES (Email flow)
   =======================================================*/
export const otps = pgTable("otps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  metadata: json("metadata").$type<{ localCode?: string | null } | null>().default(null),
  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================
   CAMPAIGNS
   =======================================================*/
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  maxProductsPerUser: integer("max_products_per_user"), // NULL means infinite
});

/* =========================================================
   CAMPAIGN WHITELIST
   =======================================================*/
export const campaignWhitelist = pgTable("campaign_whitelist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================
   CAMPAIGN PRODUCTS (Many-to-Many)
   =======================================================*/
export const campaignProducts = pgTable("campaign_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  productId: varchar("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================
   BLOGS
   =======================================================*/
export const blogs = pgTable("blogs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  author: text("author").default("Admin"),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* =========================================================
   BULK BUY ACCESS (Allowlist)
   =======================================================*/
export const bulkBuyAccess = pgTable("bulk_buy_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").default(true),
  department: text("department"),
  designation: text("designation"),
  isProcurement: boolean("is_procurement").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* =========================================================
   BULK BUY CART ITEMS
   =======================================================*/
export const bulkBuyCartItems = pgTable("bulk_buy_cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  selectedColor: text("selected_color"),
  selectedSize: text("selected_size"),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================
   BULK BUY REQUESTS
   =======================================================*/
export const bulkBuyRequests = pgTable("bulk_buy_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: text("request_id").notNull().unique(),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  status: text("status").notNull().default("pending_approval"), // pending_approval|approved|rejected
  deliveryMethod: text("delivery_method").default("office"),
  deliveryAddress: text("delivery_address"),

  items: json("items")
    .$type<
      Array<{
        productId: string;
        name: string;
        sku?: string;
        selectedColor?: string | null;
        selectedSize?: string | null;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }>
    >()
    .notNull()
    .default([]),

  totalAmount: decimal("total_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),

  requesterNote: text("requester_note"),
  procurementNote: text("procurement_note"),

  approvedByEmployeeId: varchar("approved_by_employee_id"),
  approvedAt: timestamp("approved_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* =========================================================
   ZOD INSERT SCHEMAS
   =======================================================*/
export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  description: true,
  imageUrl: true,
  isActive: true,
  sortOrder: true,
});

export const insertDomainWhitelistSchema = z.object({
  domain: z.string().min(1, "Domain is required").refine(
    (val) => val.includes(".") && !val.includes("@"),
    { message: "Please enter a valid domain (e.g., company.com)" }
  ),
  isActive: z.boolean().default(true),
  autoCreateUser: z.boolean().default(true),
  defaultPoints: z.number().int().min(0).default(0),
  canLoginWithoutEmployeeId: z.boolean().default(true),
});

export const insertEmployeeSchema = createInsertSchema(employees).pick({
  firstName: true,
  lastName: true,
  email: true,
  points: true,

  // ✅ NEW
  bulkBuyAllowed: true,
});


// ✅ slab schema includes maxQty
const priceSlabSchema = z.object({
  minQty: z.number().int().min(1, "Min Qty must be >= 1"),
  maxQty: z.number().int().min(1).nullable().default(null),
  price: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Valid slab price is required"),
}).refine(
  (s) => s.maxQty === null || s.maxQty >= s.minQty,
  { message: "Max Qty must be empty (open-ended) or >= Min Qty" }
);

export const insertProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Valid price is required"),
  images: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  stock: z.number().int().min(0).default(0),
  packagesInclude: z.array(z.string()).default([]),
  specifications: z.string().default(""),
  sku: z.string().min(1, "SKU is required"),
  isActive: z.boolean().default(true),
  backupProductId: z.string().nullable().default(null),
  categoryIds: z.array(z.string()).default([]),
  csrSupport: z.boolean().default(false),

  // ✅ slabs
  priceSlabs: z.array(priceSlabSchema).default([]),

  // ✅ NEW
  bulkBuy: z.boolean().default(false),

  // ✅ NEW: Extra fields
  gst: z.string().default("0"),
  stockStatus: z.enum(["committed", "non_committed"]).default("non_committed"),
  brandStore: z.boolean().default(false),
  brand: z.string().default(""),
  sizes: z.object({
    unit: z.string(),
    values: z.array(z.string()),
  }).nullable().default(null),
});

export const insertOrderSchema = createInsertSchema(orders)
  .pick({
    employeeId: true,
    productId: true,
    selectedColor: true,
    selectedSize: true,
    quantity: true,
    metadata: true,
  })
  .extend({
    metadata: z
      .object({
        usedPoints: z.number().optional(),
        unitPrice: z.number().optional(),
        copayInr: z.number().optional().nullable(),
        paymentId: z.string().optional().nullable(),
        phonepeOrderId: z.string().optional().nullable(),
        deliveryMethod: z.enum(["office", "delivery"]).optional().default("office"),
        deliveryAddress: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
    campaignId: z.string().optional(),
  });

export const insertCartItemSchema = createInsertSchema(cartItems).pick({
  employeeId: true,
  productId: true,
  selectedColor: true,
  selectedSize: true,
  quantity: true,
  campaignId: true,
});

export const insertCampaignSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable().default(null),
  imageUrl: z.string().optional().nullable().default(null),
  isActive: z.boolean().default(true),
  startDate: z
    .string()
    .optional()
    .nullable()
    .default(null)
    .transform((val) => (val ? new Date(val) : null)),
  endDate: z
    .string()
    .optional()
    .nullable()
    .default(null)
    .transform((val) => (val ? new Date(val) : null)),
  maxProductsPerUser: z.coerce.number().int().min(1).optional().nullable().default(null),
});

export const insertCampaignWhitelistSchema = z.object({
  campaignId: z.string().optional(), // Often taken from URL param
  email: z.string().email("Valid email is required"),
  startDate: z
    .string()
    .optional()
    .nullable()
    .default(null)
    .transform((val) => (val ? new Date(val) : null)),
  endDate: z
    .string()
    .optional()
    .nullable()
    .default(null)
    .transform((val) => (val ? new Date(val) : null)),
});

export const insertCampaignProductSchema = createInsertSchema(campaignProducts)
  .pick({
    productId: true,
  })
  .extend({
    campaignId: z.string().optional(),
  });

export const insertBlogSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional().nullable().default(null),
  content: z.string().min(1, "Content is required"),
  imageUrl: z.string().optional().nullable().default(null),
  author: z.string().optional().default("Admin"),
  isPublished: z.boolean().default(false),
});

export const insertBulkBuyAccessSchema = z.object({
  email: z.string().email("Valid email is required"),
  isActive: z.boolean().default(true),
  department: z.string().optional().nullable().default(null),
  designation: z.string().optional().nullable().default(null),
  isProcurement: z.boolean().default(false),
});

/* =========================================================
   EMAIL OTP FLOW SCHEMAS
   =========================================================*/
export const emailLoginSchema = z.object({
  email: z.string().email("Valid email is required"),
});
export const otpVerifySchema = z.object({
  email: z.string().email("Valid email is required"),
  code: z.string().min(4, "OTP is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const sendOtpSchema = emailLoginSchema;
export const verifyOtpSchema = otpVerifySchema;

/* =========================================================
   TYPES
   =======================================================*/
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertDomainWhitelist = z.infer<typeof insertDomainWhitelistSchema>;
export type DomainWhitelist = typeof domainWhitelist.$inferSelect;

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItem = typeof cartItems.$inferSelect;

export type Session = typeof sessions.$inferSelect;
export type Branding = typeof branding.$inferSelect;
export type OTP = typeof otps.$inferSelect;

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

export type InsertCampaignProduct = z.infer<typeof insertCampaignProductSchema>;
export type CampaignProduct = typeof campaignProducts.$inferSelect;

export type InsertBlog = z.infer<typeof insertBlogSchema>;
export type Blog = typeof blogs.$inferSelect;

export type InsertBulkBuyAccess = z.infer<typeof insertBulkBuyAccessSchema>;
export type BulkBuyAccess = typeof bulkBuyAccess.$inferSelect;

export type BulkBuyCartItem = typeof bulkBuyCartItems.$inferSelect;
export type BulkBuyRequest = typeof bulkBuyRequests.$inferSelect;

export type InsertCampaignWhitelist = z.infer<typeof insertCampaignWhitelistSchema>;
export type CampaignWhitelist = typeof campaignWhitelist.$inferSelect;

