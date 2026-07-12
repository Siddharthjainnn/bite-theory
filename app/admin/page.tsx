'use client';

/**
 * Bites Theory — Admin Console v5
 * Location:  app/admin/page.tsx
 *
 * LIVE & WIRED (dedicated pages): Dashboard, Products, Categories, Orders, Order Items
 * NOW ALSO LIVE: every remaining module via a generic CRUD engine that talks to
 *   your real backend (uses PATCH for updates, matching your existing controllers).
 *
 * Every module = real list + create + edit + delete against /<route> on your API.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

import StoreSettingsPanel from '../components/StoreSettingsPanel';
import InvoiceLayoutPanel from '../components/InvoiceLayoutPanel';
import ThaliAdminPanel from '../components/ThaliAdminPanel';
import {
  fetchStoreSettings, InvoiceConfig as InvoiceConfigT,
  fetchCouponAssignments, assignCoupon, deleteCouponAssignment,
} from '../lib/bite';
import {
  customerInvoice, chefTicket, printHtml, openHtmlPreview, InvoiceOrder,
} from '../lib/invoice';
/* ============ types ============ */
type Status = 'active' | 'inactive';

interface Category {
  id: number; name: string; slug: string;
  description: string; image: string; status: Status; sortOrder: number;
}
interface Product {
  id: number; categoryId: number; name: string; slug: string;
  description: string; image: string; videoUrl: string;
  price: number; offerPrice: number; calories: number; protein: number;
  carbs: number; fat: number; rating: number; status: Status;
  isTodaysSpecial?: boolean; isVeg?: boolean; specialTag?: string;
  isSpinWheel?: boolean;
}
interface Order {
  id: number; orderNumber: string; userId: number; addressId: number;
  subtotal: number; discount: number; deliveryCharge: number; tax: number;
  walletUsed: number; total: number; status: string; deliverySlot: string;
  deliveryPartnerId: number; placedAt: string; updatedAt: string;
}
interface OrderHistoryEntry { id: number; orderId: number; status: string; note: string; createdAt: string; }
interface OrderItem { id: number; orderId: number; productId: number; productName: string; unitPrice: number; quantity: number; lineTotal: number; }

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://bite-theory-backend.onrender.com/api';
// The admin key is NO LONGER bundled into the browser JS. It is handed out
// by POST /admin-users/login after a correct email + password, kept in
// sessionStorage, and attached to every write. Logout / tab close clears it.
const ADMIN_SESSION_KEY = 'bt_admin_session';
function getAdminKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? (JSON.parse(raw).adminKey || '') : '';
  } catch { return ''; }
}
// Getter-based so every spread/read picks up the live key after login.
const WRITE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  get 'x-admin-key'() { return getAdminKey(); },
} as any;
const ADMIN_KEY_HEADER = () => ({ 'x-admin-key': getAdminKey() });
const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

type RiderOption = {
  id: number; name: string | null; mobile: string | null;
  vehicleNo: string | null; isAvailable: boolean | null; activeOrders: number;
};

const ORDER_FLOW = [
  { key: 'order_received', label: 'Order Received' },
  { key: 'order_confirmed', label: 'Order Confirmed' },
  { key: 'preparing_food', label: 'Preparing Food' },
  { key: 'food_ready', label: 'Food Ready' },
  { key: 'assigned_to_delivery', label: 'Assigned to Delivery Partner' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'arriving_soon', label: 'Arriving Soon' },
  { key: 'delivered', label: 'Delivered' },
];

/* ============ API layer ============ */
const api = {
  async listProducts(): Promise<Product[]> {
    const r = await fetch(`${API_BASE}/products`, { headers: ADMIN_KEY_HEADER() });
    if (!r.ok) throw new Error('Failed to load products');
    const rows = await r.json();
    return rows.map((p: any) => ({
      id: Number(p.id), categoryId: Number(p.categoryId), name: p.name, slug: p.slug,
      description: p.description || '', image: p.image || '', videoUrl: p.videoUrl || '',
      price: Number(p.price), offerPrice: Number(p.offerPrice) || 0,
      calories: Number(p.calories) || 0, protein: Number(p.protein) || 0,
      carbs: Number(p.carbs) || 0, fat: Number(p.fat) || 0,
      rating: Number(p.rating) || 0, status: p.status as Status,
      // FIX: carry the special/veg flags through so the edit form shows current state
      isTodaysSpecial: Boolean(p.isTodaysSpecial ?? p.is_todays_special),
      isVeg: p.isVeg === undefined && p.is_veg === undefined ? true : Boolean(p.isVeg ?? p.is_veg),
      specialTag: p.specialTag ?? p.special_tag ?? '',
      isSpinWheel: Boolean(p.isSpinWheel ?? p.is_spin_wheel),
    }));
  },
  async createProduct(d: Partial<Product>) {
    const r = await fetch(`${API_BASE}/products`, {
      method: 'POST', headers: WRITE_HEADERS,
      body: JSON.stringify({
        name: d.name, categoryId: d.categoryId, description: d.description, image: d.image,
        videoUrl: d.videoUrl, price: d.price, offerPrice: d.offerPrice, calories: d.calories,
        protein: d.protein, carbs: d.carbs, fat: d.fat, status: d.status,
        // FIX: these were being dropped, so Today's Special never saved
        isTodaysSpecial: !!d.isTodaysSpecial, isVeg: d.isVeg !== false,
        specialTag: d.specialTag || undefined,
        isSpinWheel: !!d.isSpinWheel,
      }),
    });
    if (!r.ok) throw new Error('Create failed');
    return r.json();
  },
  async updateProduct(id: number, d: Partial<Product>) {
    const r = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PATCH', headers: WRITE_HEADERS,
      body: JSON.stringify({
        name: d.name, categoryId: d.categoryId, description: d.description, image: d.image,
        videoUrl: d.videoUrl, price: d.price, offerPrice: d.offerPrice, calories: d.calories,
        protein: d.protein, carbs: d.carbs, fat: d.fat, status: d.status,
        // FIX: these were being dropped, so toggling Today's Special did nothing
        isTodaysSpecial: !!d.isTodaysSpecial, isVeg: d.isVeg !== false,
        specialTag: d.specialTag || undefined,
        isSpinWheel: !!d.isSpinWheel,
      }),
    });
    if (!r.ok) throw new Error('Update failed');
    return r.json();
  },
  async deleteProduct(id: number) {
    const r = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE', headers: ADMIN_KEY_HEADER() });
    if (!r.ok) throw new Error('Delete failed');
  },
  async listCategories(): Promise<Category[]> {
    const r = await fetch(`${API_BASE}/categories`, { headers: ADMIN_KEY_HEADER() });
    if (!r.ok) throw new Error('Failed to load categories');
    const rows = await r.json();
    return rows.map((c: any) => ({
      id: Number(c.id), name: c.name, slug: c.slug,
      description: c.description || '', image: c.image || '',
      status: (c.isActive ? 'active' : 'inactive') as Status,
      sortOrder: Number(c.sortOrder) || 0,
    }));
  },
  async createCategory(d: Partial<Category>) {
    const r = await fetch(`${API_BASE}/categories`, {
      method: 'POST', headers: WRITE_HEADERS,
      body: JSON.stringify({ name: d.name, description: d.description, image: d.image, sortOrder: d.sortOrder, isActive: d.status === 'active' }),
    });
    if (!r.ok) throw new Error('Create failed');
    return r.json();
  },
  async updateCategory(id: number, d: Partial<Category>) {
    const r = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PATCH', headers: WRITE_HEADERS,
      body: JSON.stringify({ name: d.name, description: d.description, image: d.image, sortOrder: d.sortOrder, isActive: d.status === 'active' }),
    });
    if (!r.ok) throw new Error('Update failed');
    return r.json();
  },
  async deleteCategory(id: number) {
    const r = await fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE', headers: ADMIN_KEY_HEADER() });
    if (!r.ok) throw new Error('Delete failed');
  },

  async listOrders(): Promise<Order[]> {
    const r = await fetch(`${API_BASE}/orders`, { headers: ADMIN_KEY_HEADER() });
    if (!r.ok) throw new Error('Failed to load orders');
    const rows = await r.json();
    return rows.map((o: any) => ({
      id: Number(o.id), orderNumber: o.orderNumber, userId: Number(o.userId), addressId: Number(o.addressId),
      subtotal: Number(o.subtotal) || 0, discount: Number(o.discount) || 0, deliveryCharge: Number(o.deliveryCharge) || 0,
      tax: Number(o.tax) || 0, walletUsed: Number(o.walletUsed) || 0, total: Number(o.total) || 0,
      status: o.status, deliverySlot: o.deliverySlot || '', deliveryPartnerId: o.deliveryPartnerId,
      placedAt: o.placedAt, updatedAt: o.updatedAt,
    }));
  },
  async getOrderHistory(orderId: number): Promise<OrderHistoryEntry[]> {
    const r = await fetch(`${API_BASE}/orders/${orderId}/history`, { headers: ADMIN_KEY_HEADER() });
    if (!r.ok) throw new Error('Failed to load history');
    return r.json();
  },
  async advanceOrderStatus(orderId: number, status: string, note?: string) {
    const r = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH', headers: WRITE_HEADERS,
      body: JSON.stringify({ status, note }),
    });
    if (!r.ok) {
      let msg = 'Status update failed';
      try { const j = await r.json(); if (j?.message) msg = j.message; } catch {}
      throw new Error(msg);
    }
    return r.json();
  },
  /* Riders the admin can dispatch to (active, availability + current load). */
  async listRidersForAssignment(): Promise<RiderOption[]> {
    const r = await fetch(`${API_BASE}/delivery-partners/for-assignment`, {
      headers: WRITE_HEADERS,
    });
    if (!r.ok) throw new Error('Could not load riders');
    return r.json();
  },
  /* Assign a SPECIFIC rider to an order (admin dispatch). */
  async assignRider(orderId: number, partnerId: number) {
    const r = await fetch(`${API_BASE}/orders/${orderId}/assign-rider`, {
      method: 'PATCH', headers: WRITE_HEADERS,
      body: JSON.stringify({ partnerId }),
    });
    if (!r.ok) {
      let msg = 'Could not assign rider';
      try { const j = await r.json(); if (j?.message) msg = j.message; } catch {}
      throw new Error(msg);
    }
    return r.json();
  },

  /** Full order incl. items + prepVideoUrl (findOneFull). Admin key attached. */
  async getOrderFull(orderId: number): Promise<any> {
    const r = await fetch(`${API_BASE}/orders/${orderId}`, { headers: ADMIN_KEY_HEADER() });
    if (!r.ok) throw new Error('Failed to load order');
    return r.json();
  },

  /** Attach / clear the "food being made" clip on an order. */
  async setPrepVideo(orderId: number, prepVideoUrl: string | null) {
    const r = await fetch(`${API_BASE}/orders/${orderId}/prep-video`, {
      method: 'PATCH', headers: WRITE_HEADERS,
      body: JSON.stringify({ prepVideoUrl }),
    });
    if (!r.ok) {
      let msg = 'Could not save prep video';
      try { const j = await r.json(); if (j?.message) msg = j.message; } catch {}
      throw new Error(msg);
    }
    return r.json();
  },

  async listOrderItems(orderId?: number): Promise<OrderItem[]> {
    const url = orderId ? `${API_BASE}/order-items?orderId=${orderId}` : `${API_BASE}/order-items`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Failed to load order items');
    const rows = await r.json();
    return rows.map((i: any) => ({
      id: Number(i.id), orderId: Number(i.orderId), productId: Number(i.productId),
      productName: i.productName, unitPrice: Number(i.unitPrice), quantity: Number(i.quantity), lineTotal: Number(i.lineTotal),
    }));
  },
  async createOrderItem(d: Partial<OrderItem>) {
    const r = await fetch(`${API_BASE}/order-items`, {
      method: 'POST', headers: WRITE_HEADERS,
      body: JSON.stringify({ orderId: d.orderId, productId: d.productId, productName: d.productName, unitPrice: d.unitPrice, quantity: d.quantity, lineTotal: d.lineTotal }),
    });
    if (!r.ok) throw new Error('Create failed');
    return r.json();
  },
  async updateOrderItem(id: number, d: Partial<OrderItem>) {
    const r = await fetch(`${API_BASE}/order-items/${id}`, {
      method: 'PATCH', headers: WRITE_HEADERS,
      body: JSON.stringify({ orderId: d.orderId, productId: d.productId, productName: d.productName, unitPrice: d.unitPrice, quantity: d.quantity, lineTotal: d.lineTotal }),
    });
    if (!r.ok) throw new Error('Update failed');
    return r.json();
  },
  async deleteOrderItem(id: number) {
    const r = await fetch(`${API_BASE}/order-items/${id}`, { method: 'DELETE', headers: ADMIN_KEY_HEADER() });
    if (!r.ok) throw new Error('Delete failed');
  },

  /* ----- GENERIC CRUD (used by every remaining module) ----- */
  async genericList(route: string): Promise<any[]> {
    const r = await fetch(`${API_BASE}/${route}`, { headers: ADMIN_KEY_HEADER() });
    if (!r.ok) throw new Error('Failed to load');
    return r.json();
  },
  async genericCreate(route: string, body: any) {
    const r = await fetch(`${API_BASE}/${route}`, {
      method: 'POST', headers: WRITE_HEADERS, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('Create failed');
    return r.json();
  },
  async genericUpdate(route: string, id: number, body: any) {
    const r = await fetch(`${API_BASE}/${route}/${id}`, {
      method: 'PATCH', headers: WRITE_HEADERS, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('Update failed');
    return r.json();
  },
  async genericDelete(route: string, id: number) {
    const r = await fetch(`${API_BASE}/${route}/${id}`, { method: 'DELETE', headers: ADMIN_KEY_HEADER() });
    if (!r.ok) throw new Error('Delete failed');
  },
};

/* ============ LOOKUP REGISTRY ============
   Central system for foreign-key dropdowns. Each source table is fetched
   ONCE, cached in memory, and reused by every form that references it.
   This is what turns "Customer ID: ___" into a dropdown of real names.

   labelOf:  how each row is shown in the dropdown (human-readable)
   route:    the API endpoint to load options from
*/
interface LookupOption { id: number; label: string; }

const LOOKUP_DEFS: Record<LookupSource, { route: string; labelOf: (r: any) => string }> = {
  users: {
    route: 'users',
    labelOf: (r) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(' ').trim();
      const who = name || `User #${r.id}`;
      return r.email ? `${who} — ${r.email}` : who;
    },
  },
  products: {
    route: 'products',
    labelOf: (r) => r.name || `Product #${r.id}`,
  },
  orders: {
    route: 'orders',
    labelOf: (r) => {
      const num = r.orderNumber || `#${r.id}`;
      return r.total != null ? `${num} — ₹${Number(r.total).toLocaleString('en-IN')}` : num;
    },
  },
  roles: {
    route: 'roles',
    labelOf: (r) => r.name || `Role #${r.id}`,
  },
  admin_users: {
    route: 'admin-users',
    labelOf: (r) => {
      const who = r.name || `Admin #${r.id}`;
      return r.email ? `${who} — ${r.email}` : who;
    },
  },
};

// simple in-memory cache so we don't refetch the same table for every field
const lookupCache: Partial<Record<LookupSource, LookupOption[]>> = {};

async function loadLookup(source: LookupSource, force = false): Promise<LookupOption[]> {
  if (!force && lookupCache[source]) return lookupCache[source]!;
  const def = LOOKUP_DEFS[source];
  try {
    const rows = await api.genericList(def.route);
    const opts = rows.map((r: any) => ({ id: Number(r.id), label: def.labelOf(r) }));
    lookupCache[source] = opts;
    return opts;
  } catch {
    lookupCache[source] = [];
    return [];
  }
}

// resolve a single id -> its label (for showing names in the LIST table, not just the form)
function labelFromCache(source: LookupSource, id: any): string | null {
  if (id === null || id === undefined || id === '') return null;
  const opts = lookupCache[source];
  if (!opts) return null;
  const hit = opts.find(o => o.id === Number(id));
  return hit ? hit.label : null;
}


/* ============ tokens ============ */
const C = {
  green: '#4CAF50', darkGreen: '#0D3B2E', orange: '#F59E0B',
  bg: '#F4F6F3', card: '#fff', ink: '#0D3B2E', muted: '#6b7d74',
  line: '#e4ebe6', greenSoft: '#e8f5e9', orangeSoft: '#fef3e2', red: '#d64545',
};

/* ============ field types for generic CRUD ============ */
type FieldType = 'text' | 'textarea' | 'number' | 'bool' | 'select' | 'datetime' | 'readonly' | 'lookup' | 'image' | 'video';

// A lookup source = a table we pull options from, plus how to label each row.
type LookupSource = 'users' | 'products' | 'orders' | 'roles' | 'admin_users';

interface FieldDef {
  key: string;             // camelCase property the backend expects (e.g. 'userId')
  label: string;
  type: FieldType;
  options?: string[];      // for select
  lookup?: LookupSource;   // for type 'lookup' — which table to pull from
  uploadFolder?: string;   // for type 'image'/'video' — server subfolder to save into
  inTable?: boolean;       // show in list table
  money?: boolean;         // format as ₹ in table
  badge?: boolean;         // show as pill in table
}
interface ModuleConfig {
  key: string;
  route: string;           // API path, e.g. 'users'
  singular: string;        // 'User'
  title: string;
  sub: string;
  fields: FieldDef[];
  titleKey?: string;       // which field is the "name" of a row (for delete confirm)
}

/* a few reusable enum option sets (match your DB enums; safe because backend stores as text) */
const ENUMS = {
  userStatus: ['active', 'blocked'],
  loyaltyLevel: ['bronze', 'silver', 'gold', 'platinum'],
  discountType: ['percentage', 'flat'],
  channel: ['push', 'email', 'sms', 'whatsapp'],
  paymentMethod: ['razorpay', 'upi', 'credit_card', 'debit_card', 'wallet'],
  paymentStatus: ['pending', 'success', 'failed', 'refunded'],
  ticketStatus: ['open', 'in_progress', 'resolved', 'closed'],
  walletType: ['credit', 'debit'],
  loyaltyType: ['earned', 'redeemed'],
  stockStatus: ['in_stock', 'low_stock', 'out_of_stock'],
  bannerPosition: ['hero', 'offer', 'footer'],
};

/* ============ MODULE CONFIGS (every remaining table) ============ */
const MODULES: Record<string, ModuleConfig> = {
  users: {
    key: 'users', route: 'users', singular: 'Customer', title: 'Customers',
    sub: 'Customer accounts — profile, wallet, loyalty tier.', titleKey: 'firstName',
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', inTable: true },
      { key: 'lastName', label: 'Last name', type: 'text', inTable: true },
      { key: 'email', label: 'Email', type: 'text', inTable: true },
      { key: 'mobile', label: 'Mobile', type: 'text', inTable: true },
      { key: 'status', label: 'Status', type: 'select', options: ENUMS.userStatus, inTable: true, badge: true },
      { key: 'walletBalance', label: 'Wallet balance (₹)', type: 'number', inTable: true, money: true },
      { key: 'loyaltyPoints', label: 'Loyalty points', type: 'number' },
      { key: 'loyaltyLevel', label: 'Loyalty level', type: 'select', options: ENUMS.loyaltyLevel, inTable: true, badge: true },
      { key: 'referralCode', label: 'Referral code', type: 'text' },
    ],
  },
  addresses: {
    key: 'addresses', route: 'addresses', singular: 'Address', title: 'Addresses',
    sub: 'Saved delivery addresses per customer.', titleKey: 'label',
    fields: [
      { key: 'userId', label: 'Customer', type: 'lookup', lookup: 'users', inTable: true },
      { key: 'label', label: 'Label', type: 'text', inTable: true },
      { key: 'fullAddress', label: 'Full address', type: 'textarea', inTable: true },
      { key: 'landmark', label: 'Landmark', type: 'text' },
      { key: 'pincode', label: 'Pincode', type: 'text', inTable: true },
      { key: 'city', label: 'City', type: 'text', inTable: true },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'isDefault', label: 'Default address', type: 'bool', inTable: true, badge: true },
    ],
  },
  favorites: {
    key: 'favorites', route: 'favorites', singular: 'Favorite', title: 'Favorites',
    sub: 'Products each customer has favorited.', titleKey: 'productId',
    fields: [
      { key: 'userId', label: 'Customer', type: 'lookup', lookup: 'users', inTable: true },
      { key: 'productId', label: 'Product', type: 'lookup', lookup: 'products', inTable: true },
    ],
  },
  reviews: {
    key: 'reviews', route: 'reviews', singular: 'Review', title: 'Reviews & Ratings',
    sub: 'Star ratings and written reviews per product.', titleKey: 'comment',
    fields: [
      { key: 'userId', label: 'Customer', type: 'lookup', lookup: 'users', inTable: true },
      { key: 'productId', label: 'Product', type: 'lookup', lookup: 'products', inTable: true },
      { key: 'orderId', label: 'Order', type: 'lookup', lookup: 'orders' },
      { key: 'rating', label: 'Rating (1-5)', type: 'number', inTable: true },
      { key: 'comment', label: 'Comment', type: 'textarea', inTable: true },
      { key: 'image1', label: 'Food photo 1', type: 'image', uploadFolder: 'reviews' },
      { key: 'image2', label: 'Food photo 2', type: 'image', uploadFolder: 'reviews' },
      { key: 'image3', label: 'Food photo 3', type: 'image', uploadFolder: 'reviews' },
    ],
  },
  inventory: {
    key: 'inventory', route: 'inventory', singular: 'Stock item', title: 'Inventory',
    sub: 'Live stock quantity and low-stock threshold per product.', titleKey: 'productId',
    fields: [
      { key: 'productId', label: 'Product', type: 'lookup', lookup: 'products', inTable: true },
      { key: 'quantity', label: 'Quantity', type: 'number', inTable: true },
      { key: 'lowThreshold', label: 'Low-stock threshold', type: 'number', inTable: true },
      { key: 'stockStatus', label: 'Stock status', type: 'select', options: ENUMS.stockStatus, inTable: true, badge: true },
    ],
  },
  coupons: {
    key: 'coupons', route: 'coupons', singular: 'Coupon', title: 'Coupons',
    sub: 'Promo codes, discount rules, usage limits.', titleKey: 'code',
    fields: [
      { key: 'code', label: 'Code', type: 'text', inTable: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'discountType', label: 'Discount type', type: 'select', options: ENUMS.discountType, inTable: true, badge: true },
      { key: 'discountValue', label: 'Discount value', type: 'number', inTable: true },
      { key: 'minOrder', label: 'Min order (₹)', type: 'number', money: true },
      { key: 'maxDiscount', label: 'Max discount (₹)', type: 'number', money: true },
      { key: 'usageLimit', label: 'Usage limit', type: 'number', inTable: true },
      { key: 'usedCount', label: 'Used count', type: 'number', inTable: true },
      { key: 'isActive', label: 'Active', type: 'bool', inTable: true, badge: true },
    ],
  },
  campaigns: {
    key: 'campaigns', route: 'campaigns', singular: 'Campaign', title: 'Campaigns',
    sub: 'Email / SMS / WhatsApp marketing campaigns.', titleKey: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inTable: true },
      { key: 'channel', label: 'Channel', type: 'select', options: ENUMS.channel, inTable: true, badge: true },
      { key: 'message', label: 'Message', type: 'textarea' },
      { key: 'scheduledAt', label: 'Scheduled at', type: 'datetime', inTable: true },
      { key: 'isSent', label: 'Sent', type: 'bool', inTable: true, badge: true },
    ],
  },
  banners: {
    key: 'banners', route: 'banners', singular: 'Banner', title: 'Banners',
    sub: 'Homepage offer banners and hero slides.', titleKey: 'title',
    fields: [
      { key: 'title', label: 'Title', type: 'text', inTable: true },
      { key: 'imageUrl', label: 'Banner image', type: 'image', uploadFolder: 'banners' },
      { key: 'linkUrl', label: 'Link URL', type: 'text' },
      { key: 'position', label: 'Position', type: 'select', options: ENUMS.bannerPosition, inTable: true, badge: true },
      { key: 'sortOrder', label: 'Sort order', type: 'number', inTable: true },
      { key: 'isActive', label: 'Active', type: 'bool', inTable: true, badge: true },
    ],
  },
  referrals: {
    key: 'referrals', route: 'referrals', singular: 'Referral', title: 'Referrals',
    sub: 'Referral codes, invites, conversions, rewards.', titleKey: 'referralCode',
    fields: [
      { key: 'referrerId', label: 'Referrer', type: 'lookup', lookup: 'users', inTable: true },
      { key: 'referredUserId', label: 'Referred customer', type: 'lookup', lookup: 'users', inTable: true },
      { key: 'referralCode', label: 'Referral code', type: 'text', inTable: true },
      { key: 'rewardAmount', label: 'Reward (₹)', type: 'number', inTable: true, money: true },
      { key: 'isConverted', label: 'Converted', type: 'bool', inTable: true, badge: true },
      { key: 'rewarded', label: 'Rewarded', type: 'bool', inTable: true, badge: true },
    ],
  },
  loyalty_points: {
    key: 'loyalty_points', route: 'loyalty-points', singular: 'Loyalty entry', title: 'Loyalty Points',
    sub: 'Points earned and redeemed per customer.', titleKey: 'reason',
    fields: [
      { key: 'userId', label: 'Customer', type: 'lookup', lookup: 'users', inTable: true },
      { key: 'points', label: 'Points', type: 'number', inTable: true },
      { key: 'type', label: 'Type', type: 'select', options: ENUMS.loyaltyType, inTable: true, badge: true },
      { key: 'reason', label: 'Reason', type: 'text', inTable: true },
      { key: 'orderId', label: 'Order', type: 'lookup', lookup: 'orders' },
    ],
  },
  payments: {
    key: 'payments', route: 'payments', singular: 'Payment', title: 'Payments',
    sub: 'Razorpay / UPI / card transactions per order.', titleKey: 'transactionId',
    fields: [
      { key: 'orderId', label: 'Order', type: 'lookup', lookup: 'orders', inTable: true },
      { key: 'method', label: 'Method', type: 'select', options: ENUMS.paymentMethod, inTable: true, badge: true },
      { key: 'amount', label: 'Amount (₹)', type: 'number', inTable: true, money: true },
      { key: 'status', label: 'Status', type: 'select', options: ENUMS.paymentStatus, inTable: true, badge: true },
      { key: 'transactionId', label: 'Transaction ID', type: 'text', inTable: true },
    ],
  },
  wallet_transactions: {
    key: 'wallet_transactions', route: 'wallet-transactions', singular: 'Wallet entry', title: 'Wallet Transactions',
    sub: 'Wallet credits, debits, refunds.', titleKey: 'reason',
    fields: [
      { key: 'userId', label: 'Customer', type: 'lookup', lookup: 'users', inTable: true },
      { key: 'type', label: 'Type', type: 'select', options: ENUMS.walletType, inTable: true, badge: true },
      { key: 'amount', label: 'Amount (₹)', type: 'number', inTable: true, money: true },
      { key: 'reason', label: 'Reason', type: 'text', inTable: true },
      { key: 'orderId', label: 'Order', type: 'lookup', lookup: 'orders' },
    ],
  },
  delivery_partners: {
    key: 'delivery_partners', route: 'delivery-partners', singular: 'Delivery partner', title: 'Delivery Partners',
    sub: 'Rider accounts, active status, availability.', titleKey: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inTable: true },
      { key: 'mobile', label: 'Mobile', type: 'text', inTable: true },
      { key: 'vehicleNo', label: 'Vehicle number', type: 'text', inTable: true },
      { key: 'isActive', label: 'Active', type: 'bool', inTable: true, badge: true },
      { key: 'isAvailable', label: 'Available now', type: 'bool', inTable: true, badge: true },
      { key: 'photo', label: 'Rider photo', type: 'image', uploadFolder: 'delivery_partners' },
      { key: 'idProof', label: 'ID proof', type: 'image', uploadFolder: 'delivery_partners' },
    ],
  },
  support_tickets: {
    key: 'support_tickets', route: 'support-tickets', singular: 'Ticket', title: 'Support Tickets',
    sub: 'Customer support requests and resolution status.', titleKey: 'subject',
    fields: [
      { key: 'userId', label: 'Customer', type: 'lookup', lookup: 'users', inTable: true },
      { key: 'orderId', label: 'Order', type: 'lookup', lookup: 'orders' },
      { key: 'subject', label: 'Subject', type: 'text', inTable: true },
      { key: 'message', label: 'Message', type: 'textarea', inTable: true },
      { key: 'status', label: 'Status', type: 'select', options: ENUMS.ticketStatus, inTable: true, badge: true },
      { key: 'attachment', label: 'Attachment', type: 'image', uploadFolder: 'support_tickets' },
    ],
  },
  notifications: {
    key: 'notifications', route: 'notifications', singular: 'Notification', title: 'Notifications',
    sub: 'Push / Email / SMS / WhatsApp notification log.', titleKey: 'title',
    fields: [
      { key: 'userId', label: 'Customer', type: 'lookup', lookup: 'users', inTable: true },
      { key: 'orderId', label: 'Order', type: 'lookup', lookup: 'orders' },
      { key: 'channel', label: 'Channel', type: 'select', options: ENUMS.channel, inTable: true, badge: true },
      { key: 'title', label: 'Title', type: 'text', inTable: true },
      { key: 'body', label: 'Body', type: 'textarea', inTable: true },
      { key: 'isSent', label: 'Sent', type: 'bool', inTable: true, badge: true },
    ],
  },
  admin_users: {
    key: 'admin_users', route: 'admin-users', singular: 'Admin user', title: 'Admin Users',
    sub: 'Super Admin, Kitchen Manager, Delivery Manager, etc.', titleKey: 'name',
    fields: [
      { key: 'roleId', label: 'Role', type: 'lookup', lookup: 'roles', inTable: true },
      { key: 'name', label: 'Name', type: 'text', inTable: true },
      { key: 'email', label: 'Email', type: 'text', inTable: true },
      { key: 'isActive', label: 'Active', type: 'bool', inTable: true, badge: true },
      { key: 'avatar', label: 'Avatar', type: 'image', uploadFolder: 'admin_users' },
    ],
  },
  roles: {
    key: 'roles', route: 'roles', singular: 'Role', title: 'Roles',
    sub: 'Role definitions for access control.', titleKey: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inTable: true },
      { key: 'description', label: 'Description', type: 'textarea', inTable: true },
    ],
  },
  permissions: {
    key: 'permissions', route: 'permissions', singular: 'Permission', title: 'Permissions',
    sub: 'What each role is allowed to access.', titleKey: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inTable: true },
      { key: 'description', label: 'Description', type: 'textarea', inTable: true },
    ],
  },
  audit_logs: {
    key: 'audit_logs', route: 'audit-logs', singular: 'Audit entry', title: 'Audit Logs',
    sub: 'Every admin action, who did it, and when.', titleKey: 'action',
    fields: [
      { key: 'adminUserId', label: 'Admin user', type: 'lookup', lookup: 'admin_users', inTable: true },
      { key: 'action', label: 'Action', type: 'text', inTable: true },
      { key: 'entity', label: 'Entity', type: 'text', inTable: true },
      { key: 'entityId', label: 'Entity ID', type: 'number', inTable: true },
    ],
  },
};

/* ============ nav ============ */
interface NavItem { key: string; label: string; icon: string; table?: string; desc?: string; }
interface NavGroup { title: string; items: NavItem[]; }

const NAV: NavGroup[] = [
  { title: 'Overview', items: [{ key: 'dashboard', label: 'Dashboard', icon: '▦' }] },
  { title: 'Orders', items: [
    { key: 'orders', label: 'Orders', icon: '🧾' },
    { key: 'order_items', label: 'Order Items', icon: '🍽️' },
  ]},
  { title: 'Catalog', items: [
    { key: 'products', label: 'Products', icon: '🍱' },
    { key: 'categories', label: 'Categories', icon: '🗂️' },
    { key: 'inventory', label: 'Inventory', icon: '📦' },
    { key: 'thali', label: 'Thali Builder', icon: '🍛' },
  ]},
  { title: 'Customers', items: [
    { key: 'users', label: 'Customers', icon: '👥' },
    { key: 'reviews', label: 'Reviews & Ratings', icon: '⭐' },
    { key: 'addresses', label: 'Addresses', icon: '📍' },
    { key: 'favorites', label: 'Favorites', icon: '❤️' },
  ]},
  { title: 'Marketing', items: [
    { key: 'coupons', label: 'Coupons', icon: '🎟️' },
    { key: 'coupon_assign', label: 'Assign Coupon', icon: '🎁' },
    { key: 'campaigns', label: 'Campaigns', icon: '📣' },
    { key: 'banners', label: 'Banners', icon: '🖼️' },
    { key: 'referrals', label: 'Referrals', icon: '🔗' },
    { key: 'loyalty_points', label: 'Loyalty Points', icon: '🏆' },
  ]},
  { title: 'Finance', items: [
    { key: 'payments', label: 'Payments', icon: '💳' },
    { key: 'wallet_transactions', label: 'Wallet Transactions', icon: '👛' },
  ]},
  { title: 'Delivery', items: [{ key: 'delivery_partners', label: 'Delivery Partners', icon: '🛵' }] },
  { title: 'Support', items: [
    { key: 'support_tickets', label: 'Support Tickets', icon: '🎧' },
    { key: 'notifications', label: 'Notifications', icon: '🔔' },
  ]},
  { title: 'Access Control', items: [
    { key: 'admin_users', label: 'Admin Users', icon: '🛡️' },
    { key: 'roles', label: 'Roles', icon: '🔑' },
    { key: 'permissions', label: 'Permissions', icon: '🗝️' },
  ]},
  { title: 'System', items: [
    { key: 'settings', label: 'Store Settings', icon: '⚙️' },
    { key: 'invoice_layout', label: 'Invoice Layout', icon: '🧾' },
    { key: 'audit_logs', label: 'Audit Logs', icon: '📋' },
  ]},
];

const ALL_KEYS = NAV.flatMap(g => g.items.map(i => i.key));
type PageKey = typeof ALL_KEYS[number];

/* ============ small UI ============ */
function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div style={{ position: 'fixed', bottom: 20, right: 20, left: 20, maxWidth: 360, marginLeft: 'auto', background: C.darkGreen, color: '#fff', padding: '13px 18px', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.25)', zIndex: 300, fontWeight: 500, fontSize: 13 }}>✓ &nbsp;{msg}</div>;
}
function Pill({ kind, children }: { kind: 'active' | 'inactive' | 'low' | 'out'; children: React.ReactNode }) {
  const map: Record<string, [string, string]> = { active: [C.greenSoft, '#2e7d32'], inactive: ['#f0f0f0', '#888'], low: [C.orangeSoft, '#b76e00'], out: ['#fdecec', C.red] };
  const [bg, col] = map[kind];
  return <span style={{ background: bg, color: col, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>;
}
function badgeFor(val: any) {
  const s = String(val).toLowerCase();
  if (val === true || ['active', 'success', 'in_stock', 'resolved', 'gold', 'platinum', 'earned', 'credit'].includes(s)) return 'active';
  if (val === false || ['inactive', 'pending', 'open'].includes(s)) return 'inactive';
  if (['low_stock', 'in_progress', 'silver', 'redeemed'].includes(s)) return 'low';
  if (['blocked', 'failed', 'out_of_stock', 'cancelled', 'debit'].includes(s)) return 'out';
  return 'inactive';
}
function orderStatusPill(status: string) {
  const map: Record<string, [string, string, string]> = {
    order_received: [C.orangeSoft, '#b76e00', 'Order Received'],
    order_confirmed: [C.orangeSoft, '#b76e00', 'Confirmed'],
    preparing_food: [C.orangeSoft, '#b76e00', 'Preparing'],
    food_ready: [C.orangeSoft, '#b76e00', 'Food Ready'],
    assigned_to_delivery: [C.orangeSoft, '#b76e00', 'Assigned'],
    out_for_delivery: [C.orangeSoft, '#b76e00', 'Out for Delivery'],
    arriving_soon: [C.orangeSoft, '#b76e00', 'Arriving Soon'],
    delivered: [C.greenSoft, '#2e7d32', 'Delivered'],
    cancelled: ['#fdecec', C.red, 'Cancelled'],
  };
  const [bg, col, label] = map[status] || ['#f0f0f0', '#888', status];
  return <span style={{ background: bg, color: col, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>;
}

/* ============ charts ============ */
function HBarList({ items }: { items: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(it => (
        <div key={it.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted, fontWeight: 600 }}>{it.label}</span><b>{it.value}</b></div>
          <div style={{ height: 8, background: C.bg, borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(it.value / max) * 100}%`, background: it.color || C.green, borderRadius: 6, transition: 'width .5s' }} /></div>
        </div>
      ))}
    </div>
  );
}
function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return <span style={{ color: C.orange, fontSize: 12, letterSpacing: 1 }}>{'★'.repeat(full)}{'☆'.repeat(5 - full)} <span style={{ color: C.muted }}>{value.toFixed(1)}</span></span>;
}

const STATUS_COLORS: Record<string, string> = {
  order_received: '#F59E0B', order_confirmed: '#fbbf24', preparing_food: '#fb923c', food_ready: '#f97316',
  assigned_to_delivery: '#34d399', out_for_delivery: '#10b981', arriving_soon: '#059669',
  delivered: '#4CAF50', cancelled: '#d64545',
};

function DonutChart({ data, size = 168 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg} strokeWidth={20} />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = `${frac * circ} ${circ}`;
          const offset = -acc * circ;
          acc += frac;
          return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={20}
            strokeDasharray={dash} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />;
        })}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="800" fill={C.ink}>{total}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill={C.muted}>orders</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 140 }}>
        {data.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ color: C.muted, flex: 1 }}>{d.label}</span>
            <b>{d.value}</b>
            <span style={{ color: C.muted, fontSize: 11, width: 34, textAlign: 'right' }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data, color = C.green, height = 140 }: { data: { label: string; value: number }[]; color?: string; height?: number }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height, padding: '0 2px' }}>
      {data.map(d => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>{d.value > 0 ? d.value : ''}</span>
          <div style={{ width: '100%', maxWidth: 28, height: `${Math.max((d.value / max) * (height - 30), 3)}px`, background: color, borderRadius: '6px 6px 2px 2px', transition: 'height .4s' }} />
          <span style={{ fontSize: 10, color: C.muted }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ============ main ============ */
function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  /* #9: on refresh the admin used to bounce back to Dashboard because the
     current page lived only in React state. Persist it in the URL hash
     (e.g. #orders) so a refresh — or a shared link — reopens the same page. */
  const [page, _setPage] = useState<PageKey>('dashboard');
  useEffect(() => {
    const fromHash = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') as PageKey;
    const valid = NAV.flatMap(g => g.items).some(i => i.key === fromHash);
    if (valid && fromHash !== page) _setPage(fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setPage = useCallback((p: PageKey) => {
    _setPage(p);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${p}`);
  }, []);
  const [toast, setToast] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 2400); }, []);
  const currentItem = NAV.flatMap(g => g.items).find(i => i.key === page);

  const DEDICATED = ['dashboard', 'products', 'categories', 'orders', 'order_items', 'settings', 'coupon_assign', 'invoice_layout', 'thali'];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif', fontSize: 14 }}>
      <style>{`
        .bt-shell { display:flex; min-height:100vh; }
        .bt-sidebar { width:264px; background:${C.darkGreen}; color:#cfe3d8; padding:18px 12px 30px; position:fixed; top:0; left:0; height:100vh; overflow-y:auto; z-index:100; transition:transform .25s ease; }
        .bt-main { flex:1; min-width:0; margin-left:264px; }
        .bt-backdrop { display:none; }
        .bt-hamburger { display:none; }
        .bt-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
        .bt-grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
        .bt-grid-2 { display:grid; grid-template-columns:1.4fr 1fr; gap:14px; }
        .bt-content { padding:22px; max-width:1320px; }
        @media (max-width: 900px) {
          .bt-sidebar { transform:translateX(-100%); width:78vw; max-width:300px; }
          .bt-sidebar.open { transform:translateX(0); box-shadow:0 0 40px rgba(0,0,0,.3); }
          .bt-main { margin-left:0; }
          .bt-hamburger { display:grid; }
          .bt-backdrop.open { display:block; position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:99; }
          .bt-grid-4 { grid-template-columns:repeat(2,1fr); }
          .bt-grid-3 { grid-template-columns:1fr; }
          .bt-grid-2 { grid-template-columns:1fr; }
          .bt-content { padding:14px; }
        }
        @media (max-width: 480px) { .bt-grid-4 { grid-template-columns:1fr 1fr; } }
      `}</style>

      <div className="bt-shell">
        <div className={`bt-backdrop ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
        <aside className={`bt-sidebar ${drawerOpen ? 'open' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${C.green},${C.orange})`, display: 'grid', placeItems: 'center', fontWeight: 800, color: '#fff', fontSize: 17 }}>B</div>
            <div><b style={{ color: '#fff', fontSize: 15 }}>Bites Theory</b><span style={{ display: 'block', fontSize: 10, color: '#8fb3a3', letterSpacing: 1 }}>ADMIN CONSOLE</span></div>
            <button onClick={() => setDrawerOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#cfe3d8', fontSize: 20, cursor: 'pointer', display: drawerOpen ? 'block' : 'none' }}>×</button>
          </div>
          {NAV.map(group => (
            <div key={group.title} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#6f9484', margin: '14px 10px 5px', fontWeight: 700 }}>{group.title}</div>
              {group.items.map(item => (
                <div key={item.key} onClick={() => { setPage(item.key); setDrawerOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 9, cursor: 'pointer', marginBottom: 1, fontWeight: 500, fontSize: 13.5, background: page === item.key ? C.green : 'transparent', color: page === item.key ? '#fff' : '#cfe3d8' }}>
                  <span style={{ width: 17, textAlign: 'center', fontSize: 14 }}>{item.icon}</span>{item.label}
                </div>
              ))}
            </div>
          ))}
          <button
            onClick={onLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', borderRadius: 9, cursor: 'pointer', marginTop: 18, fontWeight: 600, fontSize: 13.5, background: 'rgba(214,69,69,.15)', color: '#ffb4b4', border: '1px solid rgba(214,69,69,.35)' }}>
            <span style={{ width: 17, textAlign: 'center' }}>🚪</span>Logout
          </button>
        </aside>

        <div className="bt-main">
          <header style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: '0 18px', height: 58, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
            <button className="bt-hamburger" onClick={() => setDrawerOpen(true)} style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff', placeItems: 'center', fontSize: 17, cursor: 'pointer' }}>☰</button>
            <b style={{ fontSize: 14 }}>{currentItem?.label || 'Dashboard'}</b>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 33, height: 33, borderRadius: '50%', background: `linear-gradient(135deg,${C.green},${C.darkGreen})`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>A</div>
            </div>
          </header>
          <div className="bt-content">
            {page === 'dashboard' && <Dashboard showToast={showToast} />}
            {page === 'products' && <Products showToast={showToast} />}
            {page === 'categories' && <Categories showToast={showToast} />}
            {page === 'orders' && <Orders showToast={showToast} />}
            {page === 'order_items' && <OrderItemsPage showToast={showToast} />}
            {page === 'settings' && <StoreSettingsPanel adminHeaders={ADMIN_KEY_HEADER} />}
            {page === 'coupon_assign' && <CouponAssignments showToast={showToast} />}
            {page === 'invoice_layout' && <InvoiceLayoutPanel adminHeaders={ADMIN_KEY_HEADER} />}
            {page === 'thali' && <ThaliAdminPanel adminHeaders={ADMIN_KEY_HEADER} showToast={showToast} />}
            {!DEDICATED.includes(page) && MODULES[page] && <GenericModule config={MODULES[page]} showToast={showToast} />}
          </div>
        </div>
      </div>
      <Toast msg={toast} />
    </div>
  );
}

/* ============ shared styles ============ */
const cardStyle: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(13,59,46,.06)' };
const btnPrimary: React.CSSProperties = { background: C.green, border: `1px solid ${C.green}`, color: '#fff', fontWeight: 600, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, color: C.ink, fontWeight: 600, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer' };
const th: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: `1px solid ${C.line}` };
const td: React.CSSProperties = { padding: '12px 14px', borderBottom: `1px solid ${C.line}` };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 13, background: C.bg, color: C.ink, fontFamily: 'inherit' };

function PageHead({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}><div><h1 style={{ fontSize: 20, margin: 0 }}>{title}</h1><p style={{ color: C.muted, marginTop: 3, fontSize: 13 }}>{sub}</p></div>{action}</div>;
}

/* ============ GENERIC MODULE (real CRUD for every remaining table) ============ */
function fmtCell(f: FieldDef, val: any) {
  if (val === null || val === undefined || val === '') return <span style={{ color: C.muted }}>—</span>;
  // foreign-key column: show the human name from cache, fall back to #id
  if (f.type === 'lookup' && f.lookup) {
    const label = labelFromCache(f.lookup, val);
    return label ? <span>{label}</span> : <span style={{ color: C.muted }}>#{String(val)}</span>;
  }
  if (f.badge) {
    if (f.type === 'bool') return <Pill kind={badgeFor(val) as any}>{val ? 'Yes' : 'No'}</Pill>;
    return <Pill kind={badgeFor(val) as any}>{String(val).replace(/_/g, ' ')}</Pill>;
  }
  if (f.money) return <b>{money(Number(val))}</b>;
  if (f.type === 'datetime') return <small>{new Date(val).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>;
  if (f.type === 'textarea') { const s = String(val); return s.length > 40 ? s.slice(0, 40) + '…' : s; }
  return String(val);
}

function GenericModule({ config, showToast }: { config: ModuleConfig; showToast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [lookupsReady, setLookupsReady] = useState(0); // bump to re-render once names are cached

  const tableFields = config.fields.filter(f => f.inTable);
  const isReadOnly = config.key === 'audit_logs'; // logs are append-only; no create/edit

  // every distinct lookup source this module references
  const lookupSources = Array.from(new Set(
    config.fields.filter(f => f.type === 'lookup' && f.lookup).map(f => f.lookup as LookupSource)
  ));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // load this table's rows AND all referenced lookup tables in parallel,
      // so the list can show "Siddharth jain" instead of "#1"
      const [data] = await Promise.all([
        api.genericList(config.route),
        ...lookupSources.map(src => loadLookup(src)),
      ]);
      setRows(data);
      setLookupsReady(n => n + 1);
    }
    catch (e: any) { showToast(e.message || 'Load failed'); }
    setLoading(false);
  }, [config.route, showToast]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const filtered = !search ? rows : rows.filter(r =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));

  async function save(data: any) {
    // build body only from configured fields
    const body: any = {};
    for (const f of config.fields) {
      if (f.type === 'readonly') continue;
      let v = data[f.key];
      if (f.type === 'number' || f.type === 'lookup') v = v === '' || v === undefined || v === null ? null : Number(v);
      if (f.type === 'bool') v = !!v;
      body[f.key] = v;
    }
    try {
      if (data.id) await api.genericUpdate(config.route, data.id, body);
      else await api.genericCreate(config.route, body);
      setEditing(null);
      showToast(data.id ? `${config.singular} updated` : `${config.singular} created`);
      load();
    } catch (e: any) { showToast(e.message || 'Save failed'); }
  }
  async function del(row: any) {
    try { await api.genericDelete(config.route, row.id); setConfirmDel(null); showToast(`${config.singular} deleted`); load(); }
    catch (e: any) { showToast(e.message || 'Delete failed'); }
  }

  const rowTitle = (r: any) => config.titleKey ? (r[config.titleKey] ?? `#${r.id}`) : `#${r.id}`;

  return (
    <>
      <PageHead title={config.title} sub={config.sub}
        action={!isReadOnly ? <button style={btnPrimary} onClick={() => setEditing({})}>＋ Add {config.singular}</button> : undefined} />

      <div style={{ marginBottom: 14, maxWidth: 320 }}>
        <input style={inputStyle} placeholder={`Search ${config.title.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              {tableFields.map(f => <th key={f.key} style={th}>{f.label}</th>)}
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td style={td} colSpan={tableFields.length + 2}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td style={{ ...td, textAlign: 'center', padding: 50, color: C.muted }} colSpan={tableFields.length + 2}>
                  {rows.length === 0 ? `No ${config.title.toLowerCase()} yet.` : 'No matches for your search.'}
                </td></tr>
              : filtered.map(r => (
                <tr key={r.id}>
                  <td style={td}><b>#{r.id}</b></td>
                  {tableFields.map(f => <td key={f.key} style={td}>{fmtCell(f, r[f.key])}</td>)}
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!isReadOnly && <button onClick={() => setEditing(r)} style={{ ...btnGhost, padding: '6px 10px' }}>✏️</button>}
                      <button onClick={() => setConfirmDel(r)} style={{ ...btnGhost, padding: '6px 10px', color: C.red }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editing && <GenericModal config={config} row={editing} onClose={() => setEditing(null)} onSave={save} />}
      {confirmDel && (
        <Modal title={`Delete ${config.singular.toLowerCase()}`} onClose={() => setConfirmDel(null)}>
          <p>Delete <b>{rowTitle(confirmDel)}</b>? This can't be undone.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button style={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button style={{ ...btnPrimary, background: C.red, borderColor: C.red }} onClick={() => del(confirmDel)}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ============ IMAGE / VIDEO UPLOAD WIDGET ============
   Click-to-pick OR drag-drop. Uploads to /upload/:folder on the backend,
   shows a live preview, returns the saved URL. Works in BOTH add & edit
   (in edit, the existing url shows as a preview automatically).            */
function ImageUpload({ folder, value, onChange, accept = 'image' }:
  { folder: string; value?: string; onChange: (url: string) => void; accept?: 'image' | 'video' }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptAttr = accept === 'video' ? 'video/*' : 'image/*';
  const isVideo = (url?: string) => !!url && /\.(mp4|webm|mov)(\?|$)/i.test(url);

  async function uploadFile(file: File) {
    setError(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${API_BASE}/upload/${folder}`, { method: 'POST', body: fd, headers: ADMIN_KEY_HEADER() });
      if (!r.ok) { const m = await r.json().catch(() => ({})); throw new Error(m.message || 'Upload failed'); }
      const data = await r.json();
      onChange(data.url);
    } catch (e: any) { setError(e.message || 'Upload failed'); }
    setUploading(false);
  }
  function onPick(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) uploadFile(f); }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) uploadFile(f); }

  const box: React.CSSProperties = {
    border: `1.5px dashed ${dragOver ? C.green : C.line}`, background: dragOver ? C.greenSoft : C.bg,
    borderRadius: 12, padding: 14, textAlign: 'center', cursor: 'pointer', transition: 'all .15s',
  };

  return (
    <div>
      {value && !manual ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: `1px solid ${C.line}`, borderRadius: 12, background: '#fff' }}>
          <div style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden', background: C.bg, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
            {isVideo(value)
              ? <video src={value} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
              : <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.muted, wordBreak: 'break-all' }}>{String(value).split('/').pop()}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button type="button" onClick={() => inputRef.current?.click()} style={{ fontSize: 12, color: C.green, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Replace</button>
              <button type="button" onClick={() => onChange('')} style={{ fontSize: 12, color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Remove</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={box} onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
          {uploading ? <div style={{ color: C.muted, fontSize: 13 }}>Uploading…</div> : (
            <>
              <div style={{ fontSize: 22, marginBottom: 2 }}>{accept === 'video' ? '🎬' : '🖼️'}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>Click to upload or drag & drop</div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{accept === 'video' ? 'MP4, WebM up to 50MB' : 'JPG, PNG, WebP up to 50MB'}</div>
            </>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept={acceptAttr} onChange={onPick} style={{ display: 'none' }} />
      <div style={{ marginTop: 5 }}>
        <button type="button" onClick={() => setManual(m => !m)} style={{ fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {manual ? '↑ hide link field' : 'or paste a link instead'}
        </button>
        {manual && (
          <input style={{ ...inputStyle, marginTop: 5 }} placeholder="https://… paste image or video URL"
            value={value || ''} onChange={e => onChange(e.target.value)} />
        )}
      </div>
      {error && <div style={{ fontSize: 12, color: C.red, marginTop: 5 }}>{error}</div>}
    </div>
  );
}

function GenericModal({ config, row, onClose, onSave }:
  { config: ModuleConfig; row: any; onClose: () => void; onSave: (d: any) => void }) {
  const init: any = { ...row };
  for (const f of config.fields) if (init[f.key] === undefined) init[f.key] = f.type === 'bool' ? false : '';
  const [f, setF] = useState<any>(init);
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const editFields = config.fields.filter(x => x.type !== 'readonly');
  const required = editFields[0]; // first field is treated as the key field

  return (
    <Modal title={row.id ? `Edit ${config.singular}` : `Add ${config.singular}`} onClose={onClose}>
      {editFields.map(field => (
        <Field key={field.key} label={field.label}>
          {field.type === 'textarea' ? (
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={f[field.key] ?? ''} onChange={e => set(field.key, e.target.value)} />
          ) : field.type === 'image' ? (
            <ImageUpload folder={field.uploadFolder || config.route} value={f[field.key]} onChange={url => set(field.key, url)} accept="image" />
          ) : field.type === 'video' ? (
            <ImageUpload folder={field.uploadFolder || config.route} value={f[field.key]} onChange={url => set(field.key, url)} accept="video" />
          ) : field.type === 'bool' ? (
            <select style={inputStyle} value={f[field.key] ? 'yes' : 'no'} onChange={e => set(field.key, e.target.value === 'yes')}>
              <option value="no">No</option><option value="yes">Yes</option>
            </select>
          ) : field.type === 'lookup' && field.lookup ? (
            <LookupSelect source={field.lookup} value={f[field.key]} onChange={v => set(field.key, v)} />
          ) : field.type === 'select' ? (
            <select style={inputStyle} value={f[field.key] ?? ''} onChange={e => set(field.key, e.target.value)}>
              <option value="">— choose —</option>
              {field.options?.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
            </select>
          ) : field.type === 'datetime' ? (
            <input style={inputStyle} type="datetime-local" value={f[field.key] ? String(f[field.key]).slice(0, 16) : ''} onChange={e => set(field.key, e.target.value)} />
          ) : field.type === 'number' ? (
            <input style={inputStyle} type="number" value={f[field.key] ?? ''} onChange={e => set(field.key, e.target.value)} />
          ) : (
            <input style={inputStyle} value={f[field.key] ?? ''} onChange={e => set(field.key, e.target.value)} />
          )}
        </Field>
      ))}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={() => {
          if (required && (f[required.key] === '' || f[required.key] === undefined || f[required.key] === null))
            return alert(`${required.label} is required`);
          onSave(f);
        }}>{row.id ? 'Save changes' : `Create ${config.singular.toLowerCase()}`}</button>
      </div>
    </Modal>
  );
}

/* ============ LOOKUP SELECT (searchable FK dropdown) ============
   Loads its source table (cached), shows human-readable labels, lets you
   type to filter when the list is long, and reports the chosen ID up.    */
function LookupSelect({ source, value, onChange }:
  { source: LookupSource; value: any; onChange: (id: number | '') => void }) {
  const [options, setOptions] = useState<LookupOption[]>(lookupCache[source] || []);
  const [loading, setLoading] = useState(!lookupCache[source]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!lookupCache[source]) {
      loadLookup(source).then(opts => { if (alive) { setOptions(opts); setLoading(false); } });
    } else {
      setOptions(lookupCache[source]);
    }
    return () => { alive = false; };
  }, [source]);

  const selected = options.find(o => o.id === Number(value));
  const filtered = !query ? options : options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  // small lists (<= 50) render as a plain native select; big lists get a search box
  if (!loading && options.length > 0 && options.length <= 50) {
    return (
      <select style={inputStyle} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}>
        <option value="">— choose —</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        placeholder={loading ? 'Loading…' : 'Search and select…'}
        value={open ? query : (selected ? selected.label : '')}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && !loading && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(13,59,46,.15)', maxHeight: 220, overflowY: 'auto', zIndex: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', color: C.muted, fontSize: 13 }}>No matches.</div>
          ) : filtered.slice(0, 100).map(o => (
            <div key={o.id}
              onMouseDown={() => { onChange(o.id); setOpen(false); }}
              style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', borderBottom: `1px solid ${C.bg}`, background: o.id === Number(value) ? C.greenSoft : '#fff' }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
      {!loading && options.length === 0 && (
        <div style={{ fontSize: 11, color: C.orange, marginTop: 4 }}>No records found in source table yet.</div>
      )}
    </div>
  );
}

/* ============ DASHBOARD ============ */
function Dashboard({ showToast }: { showToast: (m: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'all'>('all');

  useEffect(() => {
    Promise.all([api.listProducts(), api.listOrders().catch(() => [])])
      .then(([p, o]) => { setProducts(p); setOrders(o); })
      .catch(() => showToast('Could not load live data'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const now = new Date();
  const cutoff = (() => {
    if (range === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
    if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    if (range === 'month') { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
    return null;
  })();
  const filtered = cutoff ? orders.filter(o => o.placedAt && new Date(o.placedAt) >= cutoff) : orders;

  const topRated = [...products].sort((a, b) => b.rating - a.rating).slice(0, 5);
  const activeOrders = filtered.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  const revenueLive = filtered.reduce((s, o) => s + o.total, 0);
  const avgOrderValue = filtered.length ? revenueLive / filtered.length : 0;

  const statusDonut = ORDER_FLOW.map(s => ({ label: s.label, value: filtered.filter(o => o.status === s.key).length, color: STATUS_COLORS[s.key] }))
    .concat([{ label: 'Cancelled', value: filtered.filter(o => o.status === 'cancelled').length, color: STATUS_COLORS.cancelled }])
    .filter(s => s.value > 0);

  const dayKey = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const dayMap = new Map<string, { revenue: number; count: number }>();
  filtered.forEach(o => {
    if (!o.placedAt) return;
    const k = dayKey(new Date(o.placedAt));
    const cur = dayMap.get(k) || { revenue: 0, count: 0 };
    cur.revenue += o.total; cur.count += 1;
    dayMap.set(k, cur);
  });
  const dayEntries = Array.from(dayMap.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const revenueByDay = dayEntries.map(([label, v]) => ({ label, value: Math.round(v.revenue) }));
  const ordersByDay = dayEntries.map(([label, v]) => ({ label, value: v.count }));

  const hourMap = new Map<number, number>();
  filtered.forEach(o => { if (!o.placedAt) return; const h = new Date(o.placedAt).getHours(); hourMap.set(h, (hourMap.get(h) || 0) + 1); });
  const peakHours = Array.from(hourMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([h, count]) => ({ label: `${h % 12 || 12}${h < 12 ? 'AM' : 'PM'}`, value: count, color: C.orange }));

  const RANGE_LABEL: Record<string, string> = { today: 'Today', week: 'Last 7 days', month: 'Last 30 days', all: 'All time' };

  return (
    <>
      <PageHead title="Dashboard" sub={`Live snapshot — ${RANGE_LABEL[range]}.`}
        action={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['today', 'week', 'month', 'all'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{ ...btnGhost, padding: '7px 13px', fontSize: 12, background: range === r ? C.green : '#fff', color: range === r ? '#fff' : C.ink, borderColor: range === r ? C.green : C.line }}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        } />

      <div className="bt-grid-4" style={{ marginBottom: 16 }}>
        {[
          ['Orders', String(filtered.length)],
          ['Revenue', money(revenueLive)],
          ['Avg Order Value', money(Math.round(avgOrderValue))],
          ['Active Orders', String(activeOrders.length)],
        ].map(([lbl, val]) => (
          <div key={lbl} style={{ ...cardStyle, padding: 16 }}>
            <div style={{ color: C.muted, fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase' }}>{lbl}</div>
            <div style={{ fontSize: 25, fontWeight: 800, margin: '7px 0 2px' }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="bt-grid-2" style={{ marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}><b style={{ fontSize: 14 }}>Revenue by day</b></div>
          <div style={{ padding: 16 }}>
            {revenueByDay.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No orders in this range yet.</div> : <BarChart data={revenueByDay} color={C.green} />}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}><b style={{ fontSize: 14 }}>Order status breakdown</b></div>
          <div style={{ padding: 16 }}>
            {statusDonut.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No orders in this range yet.</div> : <DonutChart data={statusDonut} />}
          </div>
        </div>
      </div>

      <div className="bt-grid-2" style={{ marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}><b style={{ fontSize: 14 }}>Orders placed by day</b></div>
          <div style={{ padding: 16 }}>
            {ordersByDay.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No orders in this range yet.</div> : <BarChart data={ordersByDay} color={C.orange} />}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}><b style={{ fontSize: 14 }}>Peak ordering hours</b></div>
          <div style={{ padding: 16 }}>
            {peakHours.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No orders in this range yet.</div> : <HBarList items={peakHours} />}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between' }}>
          <b style={{ fontSize: 14 }}>Top rated products</b>
          <span style={{ fontSize: 9, color: '#2e7d32', background: C.greenSoft, padding: '1px 6px', borderRadius: 5, alignSelf: 'center' }}>live</span>
        </div>
        <div style={{ padding: '6px 16px' }}>
          {loading ? <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Loading…</div>
            : topRated.length === 0 ? <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>No products yet.</div>
            : topRated.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: C.greenSoft, display: 'grid', placeItems: 'center', fontSize: 16, overflow: 'hidden', flexShrink: 0 }}>
                  {p.image && p.image.startsWith('http') ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.image || '🍱')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <Stars value={p.rating} />
                </div>
                <b style={{ fontSize: 13 }}>{money(p.offerPrice > 0 ? p.offerPrice : p.price)}</b>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

/* ============ ORDERS (live) ============ */
function Orders({ showToast }: { showToast: (m: string) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered'>('all');
  const [selected, setSelected] = useState<Order | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setOrders(await api.listOrders()); } catch (e: any) { showToast(e.message || 'Load failed'); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  let filtered = orders;
  if (filter === 'active') filtered = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  if (filter === 'delivered') filtered = orders.filter(o => o.status === 'delivered');

  return (
    <>
      <PageHead title="Orders" sub="Live order list — click Track to view & advance the status timeline." />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['all', 'active', 'delivered'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...btnGhost, background: filter === f ? C.green : '#fff', color: filter === f ? '#fff' : C.ink, borderColor: filter === f ? C.green : C.line, textTransform: 'capitalize' }}>{f}</button>
        ))}
      </div>
      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
          <thead><tr><th style={th}>Order #</th><th style={th}>Customer</th><th style={th}>Total</th><th style={th}>Status</th><th style={th}>Placed</th><th style={th}></th></tr></thead>
          <tbody>
            {loading ? <tr><td style={td} colSpan={6}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td style={{ ...td, textAlign: 'center', padding: 50, color: C.muted }} colSpan={6}>No orders yet. Orders placed by customers will appear here.</td></tr>
              : filtered.map(o => (
                <tr key={o.id}>
                  <td style={td}><b>{o.orderNumber}</b></td>
                  <td style={td}>User #{o.userId}</td>
                  <td style={td}><b>{money(o.total)}</b></td>
                  <td style={td}>{orderStatusPill(o.status)}</td>
                  <td style={td}><small>{o.placedAt ? new Date(o.placedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</small></td>
                  <td style={td}><button style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }} onClick={() => setSelected(o)}>Track →</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} onChanged={load} showToast={showToast} />}
    </>
  );
}

function OrderDetail({ order, onClose, onChanged, showToast }:
  { order: Order; onClose: () => void; onChanged: () => void; showToast: (m: string) => void }) {
  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(order);
  const [busy, setBusy] = useState(false);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [chosenRider, setChosenRider] = useState<number | ''>(current.deliveryPartnerId || '');

  /* prep video + printing */
  const [full, setFull] = useState<any>(null);
  const [prepVideoUrl, setPrepVideoUrl] = useState<string>('');
  const [savingVideo, setSavingVideo] = useState(false);
  const [invoiceCfg, setInvoiceCfg] = useState<InvoiceConfigT | null>(null);

  useEffect(() => {
    let alive = true;
    api.getOrderFull(order.id)
      .then((o) => { if (alive) { setFull(o); setPrepVideoUrl(o?.prepVideoUrl || ''); } })
      .catch(() => {});
    fetchStoreSettings()
      .then((s) => { if (alive) setInvoiceCfg(s?.invoiceConfig || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [order.id]);

  async function savePrepVideo() {
    setSavingVideo(true);
    try {
      const o = await api.setPrepVideo(order.id, prepVideoUrl.trim() || null);
      setFull(o);
      showToast(prepVideoUrl.trim() ? 'Prep video attached — customer notified 🎬' : 'Prep video removed');
    } catch (e: any) { showToast(e.message || 'Could not save video'); }
    setSavingVideo(false);
  }

  function buildInvoiceOrder(): InvoiceOrder {
    const src = full || current;
    return {
      orderNumber: src.orderNumber,
      placedAt: src.placedAt,
      items: (src.items || []).map((it: any) => ({
        productName: it.productName, quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice), lineTotal: Number(it.lineTotal),
      })),
      subtotal: Number(src.subtotal), discount: Number(src.discount),
      deliveryCharge: Number(src.deliveryCharge), tax: Number(src.tax || 0),
      walletUsed: Number(src.walletUsed), tip: Number(src.tip || 0),
      total: Number(src.total),
      deliveryAddress: src.deliveryAddress,
      customerName: src.customerName || `User #${src.userId}`,
      paymentMethod: src.paymentMethod,
      cookingNote: src.cookingNote,
      deliveryInstructions: src.deliveryInstructions,
      status: src.status,
    };
  }
  function printChef() { printHtml(chefTicket(buildInvoiceOrder(), invoiceCfg)); }
  function printCustomer() { printHtml(customerInvoice(buildInvoiceOrder(), invoiceCfg)); }
  function previewCustomer() { openHtmlPreview(customerInvoice(buildInvoiceOrder(), invoiceCfg)); }

  const load = useCallback(async () => {
    setLoading(true);
    try { setHistory(await api.getOrderHistory(order.id)); } catch (e: any) { showToast(e.message || 'Could not load history'); }
    setLoading(false);
  }, [order.id, showToast]);
  useEffect(() => { load(); }, [load]);

  const curIdx = ORDER_FLOW.findIndex(s => s.key === current.status);
  const isCancelled = current.status === 'cancelled';
  const nextStep = !isCancelled ? ORDER_FLOW[curIdx + 1] : null;

  /* The next step needs a rider chosen (assigned_to_delivery), and no rider
     is attached yet → show the picker instead of a blind advance button. */
  const needsRider =
    !!nextStep &&
    nextStep.key === 'assigned_to_delivery' &&
    !current.deliveryPartnerId;

  /* Load the rider list once we're at the dispatch step. */
  useEffect(() => {
    if (!needsRider) return;
    let alive = true;
    api.listRidersForAssignment()
      .then((list) => { if (alive) setRiders(list); })
      .catch((e) => showToast(e.message || 'Could not load riders'));
    return () => { alive = false; };
  }, [needsRider, showToast]);

  async function advance() {
    if (!nextStep) return;
    setBusy(true);
    try {
      await api.advanceOrderStatus(order.id, nextStep.key);
      setCurrent((c) => ({ ...c, status: nextStep.key }));
      showToast(`Advanced to "${nextStep.label}"`);
      await load(); onChanged();
    } catch (e: any) { showToast(e.message || 'Could not advance'); }
    setBusy(false);
  }

  /* Assign the chosen rider, which also moves the order to assigned_to_delivery. */
  async function assignChosenRider() {
    if (!chosenRider) return;
    setBusy(true);
    try {
      await api.assignRider(order.id, Number(chosenRider));
      const r = riders.find((x) => x.id === Number(chosenRider));
      setCurrent((c) => ({
        ...c,
        status: 'assigned_to_delivery',
        deliveryPartnerId: Number(chosenRider),
      }));
      showToast(`Assigned to ${r?.name || 'rider #' + chosenRider}`);
      await load(); onChanged();
    } catch (e: any) { showToast(e.message || 'Could not assign rider'); }
    setBusy(false);
  }

  return (
    <Modal title={`Order ${order.orderNumber}`} onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div><small style={{ color: C.muted }}>CUSTOMER</small><br /><b>User #{order.userId}</b></div>
        <div style={{ textAlign: 'right' }}><small style={{ color: C.muted }}>TOTAL</small><br /><b style={{ fontSize: 17 }}>{money(order.total)}</b></div>
      </div>
      {isCancelled && <div style={{ marginBottom: 14 }}>{orderStatusPill('cancelled')}</div>}

      <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Status timeline</div>
      <div>
        {ORDER_FLOW.map((s, i) => {
          const done = i <= curIdx;
          const isCurrent = i === curIdx;
          const histEntry = history.find(h => h.status === s.key);
          return (
            <div key={s.key} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i === ORDER_FLOW.length - 1 ? 0 : 20 }}>
              {i !== ORDER_FLOW.length - 1 && <div style={{ position: 'absolute', left: 12, top: 26, bottom: -4, width: 2, background: i < curIdx ? C.green : C.line }} />}
              <div style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${done ? C.green : C.line}`, background: done ? C.green : '#fff', color: done ? '#fff' : C.muted, display: 'grid', placeItems: 'center', fontSize: 11, flexShrink: 0, zIndex: 1, boxShadow: isCurrent ? `0 0 0 4px ${C.orangeSoft}` : 'none', borderColor: isCurrent ? C.orange : (done ? C.green : C.line) }}>
                {i < curIdx ? '✓' : isCurrent ? '●' : ''}
              </div>
              <div>
                <b style={{ fontSize: 13, color: isCurrent ? C.orange : C.ink }}>{s.label}</b>
                {histEntry && <div style={{ fontSize: 11, color: C.muted }}>{new Date(histEntry.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {needsRider && (
        <div style={{ marginTop: 18, padding: 14, border: `1px solid ${C.line}`, borderRadius: 12, background: '#fafcfb' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: C.ink }}>
            🛵 Choose a delivery partner
          </div>
          {riders.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.muted }}>Loading riders… (none appear here if no active rider exists)</div>
          ) : (
            <select
              value={chosenRider}
              onChange={(e) => setChosenRider(e.target.value ? Number(e.target.value) : '')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13, color: C.ink, background: '#fff' }}
            >
              <option value="">— select a rider —</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || 'Rider #' + r.id}{r.mobile ? ` · ${r.mobile}` : ''}
                  {r.isAvailable ? ' · free' : ` · ${r.activeOrders} active`}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── PREP VIDEO (signature feature) ── */}
      <div style={{ marginTop: 18, padding: 14, border: `1px solid ${C.line}`, borderRadius: 12, background: '#fafcfb' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: C.ink }}>
          🎬 Prep video (shown to the customer while cooking)
        </div>
        <ImageUpload
          folder="orders"
          accept="video"
          value={prepVideoUrl}
          onChange={setPrepVideoUrl}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button style={{ ...btnPrimary, opacity: savingVideo ? 0.6 : 1 }} disabled={savingVideo} onClick={savePrepVideo}>
            {savingVideo ? 'Saving…' : (full?.prepVideoUrl ? 'Update video' : 'Attach & notify customer')}
          </button>
          {full?.prepVideoUrl && (
            <button style={btnGhost} disabled={savingVideo} onClick={() => { setPrepVideoUrl(''); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── PRINT: chef ticket + customer invoice ── */}
      <div style={{ marginTop: 14, padding: 14, border: `1px solid ${C.line}`, borderRadius: 12, background: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: C.ink }}>🖨️ Print</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnGhost} onClick={printChef} disabled={!full}>👨‍🍳 Chef ticket</button>
          <button style={btnGhost} onClick={printCustomer} disabled={!full}>🧾 Customer invoice</button>
          <button style={{ ...btnGhost, color: C.muted }} onClick={previewCustomer} disabled={!full}>👁 Preview</button>
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>
          Layout & branding are controlled in Store Settings → Invoice layout.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <button style={btnGhost} onClick={onClose}>Close</button>
        {isCancelled ? <Pill kind="out">Order cancelled</Pill>
          : needsRider
            ? <button style={btnPrimary} disabled={busy || !chosenRider} onClick={assignChosenRider}>{busy ? 'Assigning…' : 'Assign rider'}</button>
          : nextStep ? <button style={btnPrimary} disabled={busy} onClick={advance}>{busy ? 'Updating…' : `Advance → ${nextStep.label}`}</button>
          : <Pill kind="active">Order complete</Pill>}
      </div>
    </Modal>
  );
}

/* ============ ASSIGN COUPON TO USER ============ */
function CouponAssignments({ showToast }: { showToast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponId, setCouponId] = useState<number | ''>('');
  const [userId, setUserId] = useState<number | ''>('');
  const [userSearch, setUserSearch] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c, u] = await Promise.all([
        fetchCouponAssignments(ADMIN_KEY_HEADER()),
        api.genericList('coupons').catch(() => []),
        api.genericList('users').catch(() => []),
      ]);
      setRows(a); setCoupons(c); setUsers(u);
    } catch (e: any) { showToast(e.message || 'Load failed'); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const userLabel = (u: any) => {
    const name = [u.firstName ?? u.first_name, u.lastName ?? u.last_name].filter(Boolean).join(' ');
    return `${name || 'User'} · ${u.email || u.mobile || ''} · #${u.id}`;
  };
  const filteredUsers = userSearch.trim()
    ? users.filter((u) => userLabel(u).toLowerCase().includes(userSearch.toLowerCase()))
    : users;

  async function assign() {
    if (!couponId || !userId) { showToast('Pick a coupon and a customer'); return; }
    setBusy(true);
    try {
      await assignCoupon(Number(couponId), Number(userId), note.trim() || undefined, ADMIN_KEY_HEADER());
      showToast('Coupon assigned 🎁');
      setNote(''); setUserId(''); setUserSearch('');
      await load();
    } catch (e: any) { showToast(e.message || 'Could not assign'); }
    setBusy(false);
  }

  async function removeRow(id: number) {
    try {
      await deleteCouponAssignment(id, ADMIN_KEY_HEADER());
      showToast('Assignment removed');
      await load();
    } catch (e: any) { showToast(e.message || 'Could not remove'); }
  }

  return (
    <>
      <PageHead title="Assign Coupon" sub="Gift a specific coupon to a specific customer. Assigned coupons bypass the global usage limit — the gift is the authorization." />

      <div style={{ ...cardStyle, padding: 18, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>🎁 New assignment</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: C.muted }}>Coupon</label>
            <select style={inputStyle} value={couponId} onChange={(e) => setCouponId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— select coupon —</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.description ? `· ${c.description}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted }}>Customer</label>
            <input style={{ ...inputStyle, marginBottom: 6 }} placeholder="Search name / email / mobile…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            <select style={inputStyle} value={userId} onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : '')} size={1}>
              <option value="">— select customer —</option>
              {filteredUsers.slice(0, 100).map((u) => (
                <option key={u.id} value={u.id}>{userLabel(u)}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, color: C.muted }}>Note (optional, internal)</label>
          <input style={inputStyle} placeholder="e.g. compensation for late order #BT123" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div style={{ marginTop: 14 }}>
          <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={assign}>
            {busy ? 'Assigning…' : 'Assign coupon'}
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
          <thead><tr>
            <th style={th}>Coupon</th><th style={th}>Customer</th><th style={th}>Note</th>
            <th style={th}>Status</th><th style={th}>Assigned</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td style={td} colSpan={6}>Loading…</td></tr>
              : rows.length === 0 ? <tr><td style={{ ...td, textAlign: 'center', padding: 50, color: C.muted }} colSpan={6}>No coupons assigned yet.</td></tr>
              : rows.map((r) => (
                <tr key={r.id}>
                  <td style={td}><b>{r.couponCode || `#${r.couponId}`}</b></td>
                  <td style={td}>{r.userName || r.userEmail || `User #${r.userId}`}</td>
                  <td style={td}><small style={{ color: C.muted }}>{r.note || '—'}</small></td>
                  <td style={td}>
                    {r.isUsed
                      ? <Pill kind="out">Used{r.orderId ? ` · #${r.orderId}` : ''}</Pill>
                      : <Pill kind="active">Available</Pill>}
                  </td>
                  <td style={td}><small>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</small></td>
                  <td style={td}>
                    {!r.isUsed && (
                      <button style={{ ...btnGhost, padding: '6px 12px', fontSize: 12, color: C.red, borderColor: '#f5c6cb' }} onClick={() => removeRow(r.id)}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============ ORDER ITEMS (live) ============ */
function OrderItemsPage({ showToast }: { showToast: (m: string) => void }) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<number | 'all'>('all');
  const [editing, setEditing] = useState<Partial<OrderItem> | null>(null);
  const [confirmDel, setConfirmDel] = useState<OrderItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, o, p] = await Promise.all([api.listOrderItems(), api.listOrders().catch(() => []), api.listProducts().catch(() => [])]);
      setItems(i); setOrders(o); setProducts(p);
    } catch (e: any) { showToast(e.message || 'Load failed'); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const orderNumber = (id: number) => orders.find(o => o.id === id)?.orderNumber || `#${id}`;
  const filtered = orderFilter === 'all' ? items : items.filter(i => i.orderId === orderFilter);

  async function save(d: Partial<OrderItem>) {
    try {
      if (d.id) await api.updateOrderItem(d.id, d); else await api.createOrderItem(d);
      setEditing(null); showToast(d.id ? 'Item updated' : 'Item added'); load();
    } catch (e: any) { showToast(e.message || 'Save failed'); }
  }
  async function del(i: OrderItem) {
    try { await api.deleteOrderItem(i.id); setConfirmDel(null); showToast('Item deleted'); load(); }
    catch (e: any) { showToast(e.message || 'Delete failed'); }
  }

  return (
    <>
      <PageHead title="Order Items" sub="Line items inside each order."
        action={<button style={btnPrimary} onClick={() => setEditing({ orderId: orders[0]?.id, quantity: 1, unitPrice: 0, lineTotal: 0 })}>＋ Add Item</button>} />
      <div style={{ marginBottom: 14 }}>
        <select style={{ ...inputStyle, maxWidth: 260, width: 'auto' }} value={orderFilter} onChange={e => setOrderFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">All orders</option>
          {orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber}</option>)}
        </select>
      </div>
      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
          <thead><tr><th style={th}>Order</th><th style={th}>Product</th><th style={th}>Unit Price</th><th style={th}>Qty</th><th style={th}>Line Total</th><th style={th}></th></tr></thead>
          <tbody>
            {loading ? <tr><td style={td} colSpan={6}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td style={{ ...td, textAlign: 'center', padding: 50, color: C.muted }} colSpan={6}>No order items yet.</td></tr>
              : filtered.map(i => (
                <tr key={i.id}>
                  <td style={td}><b>{orderNumber(i.orderId)}</b></td>
                  <td style={td}>{i.productName}</td>
                  <td style={td}>{money(i.unitPrice)}</td>
                  <td style={td}>{i.quantity}</td>
                  <td style={td}><b>{money(i.lineTotal)}</b></td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditing(i)} style={{ ...btnGhost, padding: '6px 10px' }}>✏️</button>
                      <button onClick={() => setConfirmDel(i)} style={{ ...btnGhost, padding: '6px 10px', color: C.red }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {editing && <OrderItemModal item={editing} orders={orders} products={products} onClose={() => setEditing(null)} onSave={save} />}
      {confirmDel && (
        <Modal title="Delete order item" onClose={() => setConfirmDel(null)}>
          <p>Delete <b>{confirmDel.productName}</b> from {orderNumber(confirmDel.orderId)}?</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button style={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button style={{ ...btnPrimary, background: C.red, borderColor: C.red }} onClick={() => del(confirmDel)}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function OrderItemModal({ item, orders, products, onClose, onSave }:
  { item: Partial<OrderItem>; orders: Order[]; products: Product[]; onClose: () => void; onSave: (d: Partial<OrderItem>) => void }) {
  const [f, setF] = useState<Partial<OrderItem>>({ orderId: orders[0]?.id, productId: products[0]?.id, productName: '', unitPrice: 0, quantity: 1, lineTotal: 0, ...item });
  const set = (k: keyof OrderItem, v: any) => setF(s => ({ ...s, [k]: v }));

  function pickProduct(pid: number) {
    const p = products.find(x => x.id === pid);
    if (!p) return;
    const price = p.offerPrice > 0 ? p.offerPrice : p.price;
    setF(s => ({ ...s, productId: pid, productName: p.name, unitPrice: price, lineTotal: price * (s.quantity || 1) }));
  }
  function setQty(q: number) { setF(s => ({ ...s, quantity: q, lineTotal: (s.unitPrice || 0) * q })); }
  function setUnitPrice(p: number) { setF(s => ({ ...s, unitPrice: p, lineTotal: p * (s.quantity || 1) })); }

  return (
    <Modal title={item.id ? 'Edit Order Item' : 'Add Order Item'} onClose={onClose}>
      <Field label="Order *">
        <select style={inputStyle} value={f.orderId} onChange={e => set('orderId', Number(e.target.value))}>
          {orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber}</option>)}
        </select>
      </Field>
      <Field label="Pick a product (auto-fills name & price)">
        <select style={inputStyle} value={f.productId} onChange={e => pickProduct(Number(e.target.value))}>
          <option value="">— choose —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Product name *"><input style={inputStyle} value={f.productName || ''} onChange={e => set('productName', e.target.value)} placeholder="e.g. Grilled Chicken Bowl" /></Field>
      <Row3>
        <Field label="Unit price (₹) *"><input style={inputStyle} type="number" value={f.unitPrice || ''} onChange={e => setUnitPrice(Number(e.target.value) || 0)} /></Field>
        <Field label="Quantity *"><input style={inputStyle} type="number" min={1} value={f.quantity || ''} onChange={e => setQty(Number(e.target.value) || 1)} /></Field>
        <Field label="Line total (₹)"><input style={inputStyle} type="number" value={f.lineTotal || ''} onChange={e => set('lineTotal', Number(e.target.value) || 0)} /></Field>
      </Row3>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={() => { if (!f.orderId || !f.productName) return alert('Order and product name are required'); onSave(f); }}>{item.id ? 'Save changes' : 'Add item'}</button>
      </div>
    </Modal>
  );
}

/* ============ PRODUCTS (live) ============ */
function Products({ showToast }: { showToast: (m: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [confirmDel, setConfirmDel] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([api.listProducts(), api.listCategories().catch(() => [])]);
      setProducts(p); setCats(c);
    } catch (e: any) { showToast(e.message || 'Load failed'); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const catName = (id: number) => cats.find(c => c.id === id)?.name || '—';

  async function save(d: Partial<Product>) {
    try {
      if (d.id) await api.updateProduct(d.id, d); else await api.createProduct(d);
      setEditing(null); showToast(d.id ? 'Product updated' : 'Product created'); load();
    } catch (e: any) { showToast(e.message || 'Save failed'); }
  }
  async function del(p: Product) {
    try { await api.deleteProduct(p.id); setConfirmDel(null); showToast('Product deleted'); load(); }
    catch (e: any) { showToast(e.message || 'Delete failed'); }
  }

  return (
    <>
      <PageHead title="Products" sub="Manage your menu — pricing, nutrition, media & status."
        action={<button style={btnPrimary} onClick={() => setEditing({ status: 'active', categoryId: cats[0]?.id })}>＋ Add Product</button>} />
      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
          <thead><tr><th style={th}>Product</th><th style={th}>Category</th><th style={th}>Nutrition</th><th style={th}>Price</th><th style={th}>Status</th><th style={th}></th></tr></thead>
          <tbody>
            {loading ? <tr><td style={td} colSpan={6}>Loading…</td></tr>
              : products.length === 0 ? <tr><td style={{ ...td, textAlign: 'center', padding: 50, color: C.muted }} colSpan={6}>No products yet. Click "Add Product".</td></tr>
              : products.map(p => {
                const off = p.offerPrice > 0;
                return (
                  <tr key={p.id}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: C.greenSoft, display: 'grid', placeItems: 'center', fontSize: 17, overflow: 'hidden', flexShrink: 0 }}>
                          {p.image && p.image.startsWith('http') ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.image || '🍱')}
                        </div>
                        <div><b>{p.name}</b><div style={{ color: C.muted, fontSize: 12 }}>{p.description.slice(0, 36)}</div></div>
                      </div>
                    </td>
                    <td style={td}>{catName(p.categoryId)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {[`${p.calories}cal`, `${p.protein}g P`, `${p.carbs}g C`, `${p.fat}g F`].map(x => <span key={x} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: C.bg, color: C.muted, fontWeight: 600 }}>{x}</span>)}
                      </div>
                    </td>
                    <td style={td}><b>{money(off ? p.offerPrice : p.price)}</b>{off && <s style={{ color: C.muted, marginLeft: 5, fontSize: 12 }}>{money(p.price)}</s>}</td>
                    <td style={td}><Pill kind={p.status}>{p.status === 'active' ? 'Active' : 'Inactive'}</Pill></td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditing(p)} style={{ ...btnGhost, padding: '6px 10px' }}>✏️</button>
                        <button onClick={() => setConfirmDel(p)} style={{ ...btnGhost, padding: '6px 10px', color: C.red }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {editing && <ProductModal product={editing} cats={cats} onClose={() => setEditing(null)} onSave={save} />}
      {confirmDel && (
        <Modal title="Delete product" onClose={() => setConfirmDel(null)}>
          <p>Delete <b>{confirmDel.name}</b>? This can't be undone.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button style={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button style={{ ...btnPrimary, background: C.red, borderColor: C.red }} onClick={() => del(confirmDel)}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ProductModal({ product, cats, onClose, onSave }:
  { product: Partial<Product>; cats: Category[]; onClose: () => void; onSave: (d: Partial<Product>) => void }) {
  const [f, setF] = useState<Partial<Product>>({ name: '', description: '', image: '', videoUrl: '', price: 0, offerPrice: 0, calories: 0, protein: 0, carbs: 0, fat: 0, status: 'active', categoryId: cats[0]?.id, isTodaysSpecial: false, isVeg: true, specialTag: '', isSpinWheel: false, ...product });
  const set = (k: keyof Product, v: any) => setF(s => ({ ...s, [k]: v }));
  const num = (k: keyof Product, v: string) => set(k, v === '' ? 0 : Number(v));
  return (
    <Modal title={product.id ? 'Edit Product' : 'Add Product'} onClose={onClose}>
      <Field label="Product name *"><input style={inputStyle} value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Grilled Chicken Bowl" /></Field>
      <Row>
        <Field label="Category *"><select style={inputStyle} value={f.categoryId} onChange={e => set('categoryId', Number(e.target.value))}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Status"><select style={inputStyle} value={f.status} onChange={e => set('status', e.target.value as Status)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="out_of_stock">Out of stock</option></select></Field>
      </Row>
      <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 70 }} value={f.description || ''} onChange={e => set('description', e.target.value)} /></Field>
      <Row>
        <Field label="Price (₹) *"><input style={inputStyle} type="number" value={f.price || ''} onChange={e => num('price', e.target.value)} /></Field>
        <Field label="Offer price (₹)"><input style={inputStyle} type="number" value={f.offerPrice || ''} onChange={e => num('offerPrice', e.target.value)} /></Field>
      </Row>
      <Row3>
        <Field label="Calories"><input style={inputStyle} type="number" value={f.calories || ''} onChange={e => num('calories', e.target.value)} /></Field>
        <Field label="Protein (g)"><input style={inputStyle} type="number" value={f.protein || ''} onChange={e => num('protein', e.target.value)} /></Field>
        <Field label="Carbs (g)"><input style={inputStyle} type="number" value={f.carbs || ''} onChange={e => num('carbs', e.target.value)} /></Field>
      </Row3>
      <Field label="Fat (g)"><input style={inputStyle} type="number" value={f.fat || ''} onChange={e => num('fat', e.target.value)} /></Field>

      <div style={{ fontWeight: 700, fontSize: 13, margin: '8px 0 10px', color: C.ink }}>Visibility & highlights</div>
      <Row>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: f.isTodaysSpecial ? '#fff7ed' : '#fff' }}>
          <input type="checkbox" checked={!!f.isTodaysSpecial} onChange={e => set('isTodaysSpecial', e.target.checked)} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>⚡ Today&apos;s Special</div>
            <div style={{ fontSize: 11, color: C.muted }}>Shows in the highlighted strip on the home page</div>
          </div>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: f.isVeg === false ? '#fdecea' : '#fff' }}>
          <input type="checkbox" checked={f.isVeg !== false} onChange={e => set('isVeg', e.target.checked)} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>🟢 Vegetarian</div>
            <div style={{ fontSize: 11, color: C.muted }}>Untick for non-veg (VEG filter hides it)</div>
          </div>
        </label>
      </Row>
      <Row>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: f.isSpinWheel ? '#f0fdf4' : '#fff' }}>
          <input type="checkbox" checked={!!f.isSpinWheel} onChange={e => set('isSpinWheel', e.target.checked)} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>🎡 Spin Wheel item</div>
            <div style={{ fontSize: 11, color: C.muted }}>Included in the &quot;Surprise me!&quot; wheel (needs 4+ flagged items, else wheel uses full menu)</div>
          </div>
        </label>
      </Row>
      {f.isTodaysSpecial && (
        <Field label="Special tag (badge text)"><input style={inputStyle} value={f.specialTag || ''} onChange={e => set('specialTag', e.target.value)} placeholder="e.g. TODAY ONLY · CHEF'S PICK · ₹99 DEAL" maxLength={40} /></Field>
      )}

      <div style={{ fontWeight: 700, fontSize: 13, margin: '8px 0 10px', color: C.ink }}>Photo & video</div>
      <Field label="Product image"><ImageUpload folder="products" value={f.image} onChange={url => set('image', url)} /></Field>
      <Field label="Product video"><ImageUpload folder="products" accept="video" value={f.videoUrl} onChange={url => set('videoUrl', url)} /></Field>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={() => { if (!f.name || !f.price) return alert('Name and price are required'); onSave(f); }}>{product.id ? 'Save changes' : 'Create product'}</button>
      </div>
    </Modal>
  );
}

/* ============ CATEGORIES (live) ============ */
function Categories({ showToast }: { showToast: (m: string) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [confirmDel, setConfirmDel] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCats(await api.listCategories()); } catch (e: any) { showToast(e.message || 'Load failed'); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  async function save(d: Partial<Category>) {
    try {
      if (d.id) await api.updateCategory(d.id, d); else await api.createCategory(d);
      setEditing(null); showToast(d.id ? 'Category updated' : 'Category created'); load();
    } catch (e: any) { showToast(e.message || 'Save failed'); }
  }
  async function del(c: Category) {
    try { await api.deleteCategory(c.id); setConfirmDel(null); showToast('Category deleted'); load(); }
    catch (e: any) { showToast(e.message || 'Delete failed'); }
  }

  const nextSort = cats.length ? Math.max(...cats.map(c => c.sortOrder || 0)) + 1 : 1;

  return (
    <>
      <PageHead title="Categories" sub="Organize your menu into sections." action={<button style={btnPrimary} onClick={() => setEditing({ status: 'active' })}>＋ Add Category</button>} />
      <div className="bt-grid-3">
        {loading ? <div style={{ ...cardStyle, padding: 18 }}>Loading…</div>
          : cats.length === 0 ? <div style={{ ...cardStyle, padding: 40, color: C.muted }}>No categories yet.</div>
          : cats.map(c => (
            <div key={c.id} style={{ ...cardStyle, padding: 16 }}>
              <div style={{ display: 'flex', gap: 11 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: C.greenSoft, display: 'grid', placeItems: 'center', fontSize: 24, overflow: 'hidden', flexShrink: 0 }}>
                  {c.image && c.image.startsWith('http') ? <img src={c.image} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (c.image || '🗂️')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>{c.name}</b>
                  <div style={{ color: C.muted, fontSize: 12, margin: '3px 0 7px' }}>{c.description}</div>
                  <Pill kind={c.status}>{c.status === 'active' ? 'Active' : 'Inactive'}</Pill>
                  <span style={{ color: C.muted, fontSize: 11, marginLeft: 7 }}>#{c.sortOrder}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 13 }}>
                <button style={{ ...btnGhost, fontSize: 12, padding: '6px 11px' }} onClick={() => setEditing(c)}>✏️ Edit</button>
                <button style={{ ...btnGhost, fontSize: 12, padding: '6px 11px', color: C.red }} onClick={() => setConfirmDel(c)}>🗑️ Delete</button>
              </div>
            </div>
          ))}
      </div>
      {editing && <CategoryModal cat={editing} nextSort={nextSort} onClose={() => setEditing(null)} onSave={save} />}
      {confirmDel && (
        <Modal title="Delete category" onClose={() => setConfirmDel(null)}>
          <p>Delete <b>{confirmDel.name}</b>?</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button style={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button style={{ ...btnPrimary, background: C.red, borderColor: C.red }} onClick={() => del(confirmDel)}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CategoryModal({ cat, nextSort, onClose, onSave }:
  { cat: Partial<Category>; nextSort: number; onClose: () => void; onSave: (d: Partial<Category>) => void }) {
  const [f, setF] = useState<Partial<Category>>({ name: '', description: '', image: '', status: 'active', sortOrder: cat.id ? cat.sortOrder : nextSort, ...cat });
  const set = (k: keyof Category, v: any) => setF(s => ({ ...s, [k]: v }));
  return (
    <Modal title={cat.id ? 'Edit Category' : 'Add Category'} onClose={onClose}>
      <Field label="Name *"><input style={inputStyle} value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Protein Meals" /></Field>
      <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 70 }} value={f.description || ''} onChange={e => set('description', e.target.value)} /></Field>
      <Field label="Category image"><ImageUpload folder="categories" value={f.image} onChange={url => set('image', url)} /></Field>
      <Row>
        <Field label="Sort number"><input style={inputStyle} type="number" value={f.sortOrder ?? ''} onChange={e => set('sortOrder', e.target.value === '' ? 0 : Number(e.target.value))} /></Field>
        <Field label="Status"><select style={inputStyle} value={f.status} onChange={e => set('status', e.target.value as Status)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="out_of_stock">Out of stock</option></select></Field>
      </Row>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={() => { if (!f.name) return alert('Name is required'); onSave(f); }}>{cat.id ? 'Save' : 'Create'}</button>
      </div>
    </Modal>
  );
}

/* ============ modal + form helpers ============ */
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(13,59,46,.45)', backdropFilter: 'blur(3px)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 14px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 580, boxShadow: '0 24px 60px rgba(13,59,46,.3)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.muted }}>×</button>
        </div>
        <div style={{ padding: 20, maxHeight: '64vh', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{label}</label>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>; }
function Row3({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>{children}</div>; }

/* ============ login gate ============ */
export default function AdminPage() {
  const [session, setSession] = useState<{ adminKey: string; name?: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.adminKey) setSession(s);
      }
    } catch {}
    setChecked(true);
  }, []);

  async function doLogin() {
    if (!email.trim() || !password) { setErr('Enter email and password'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${API_BASE}/admin-users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.adminKey) {
        setErr(data?.message || 'Invalid email or password');
        return;
      }
      const s = { adminKey: data.adminKey, name: data.admin?.name, email: data.admin?.email };
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(s));
      setSession(s);
    } catch {
      setErr('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setSession(null); setEmail(''); setPassword('');
  }

  if (!checked) return null;
  if (session) return <AdminDashboard onLogout={logout} />;

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 13px', borderRadius: 10, fontSize: 14,
    border: `1px solid ${C.line}`, outline: 'none', background: '#fff', color: C.ink,
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: `linear-gradient(160deg, ${C.darkGreen} 0%, #145341 60%, ${C.green} 130%)`, padding: 16, fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 18, padding: '30px 26px', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg,${C.green},${C.orange})`, display: 'grid', placeItems: 'center', fontWeight: 800, color: '#fff', fontSize: 20 }}>B</div>
          <div>
            <b style={{ fontSize: 17, color: C.ink }}>Bites Theory</b>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1.2, fontWeight: 700 }}>ADMIN CONSOLE</div>
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Email</label>
        <input style={{ ...inp, marginBottom: 14 }} type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="admin@bitetheory.com" autoComplete="username" />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Password</label>
        <input style={{ ...inp, marginBottom: 6 }} type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
          onKeyDown={(e) => { if (e.key === 'Enter') doLogin(); }} />

        {err && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, margin: '8px 0 2px' }}>⚠️ {err}</div>}

        <button onClick={doLogin} disabled={busy}
          style={{ width: '100%', marginTop: 16, padding: '12px 14px', borderRadius: 11, border: 'none', cursor: busy ? 'wait' : 'pointer', background: busy ? '#8fbf92' : C.green, color: '#fff', fontWeight: 800, fontSize: 14.5, letterSpacing: 0.3 }}>
          {busy ? 'Signing in…' : 'Sign in →'}
        </button>

        <div style={{ marginTop: 14, fontSize: 11, color: C.muted, textAlign: 'center' }}>
          Access is restricted to Bites Theory staff.
        </div>
      </div>
    </div>
  );
}