// frontend/js/api.js
// API base URL — override per environment via window.DOMDOM_API_BASE (set before this script loads).
const API_BASE = (typeof window !== 'undefined' && window.DOMDOM_API_BASE)
  || `${location.origin}/api`;

// Escape untrusted text before interpolating into innerHTML. Used everywhere
// user-supplied content (reviews, guest checkout fields) is rendered as HTML.
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
if (typeof window !== 'undefined') window.esc = esc;

async function req(method, path, body = null, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const t = localStorage.getItem('dd_token');
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const res = await fetch(API_BASE + path, {
    method, headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await parseBody(res);
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Parse a response defensively — some error paths (proxies, file-size
// rejections, SPA fallback) return HTML or an empty body, which would make
// res.json() throw and hide the real status.
async function parseBody(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: `Unexpected response (${res.status})` }; }
}

async function reqForm(method, path, formData) {
  const token = localStorage.getItem('dd_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { method, headers, body: formData });
  const data = await parseBody(res);
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const API = {
  // ── Auth
  register:       (name, email, password) => req('POST', '/auth/register', { name, email, password }),
  login:          (email, password)        => req('POST', '/auth/login',    { email, password }),
  me:             ()                       => req('GET',  '/auth/me', null, true),
  updateProfile:  (data)                   => req('PUT',  '/auth/profile', data, true),
  changePassword: (data)                   => req('POST', '/auth/change-password', data, true),

  // ── Categories
  getCategories:      ()          => req('GET',    '/categories'),
  getCategoriesAdmin: ()          => req('GET',    '/categories/admin/all', null, true),
  createCategory:     (data)      => req('POST',   '/categories', data, true),
  updateCategory:     (id, data)  => req('PUT',    `/categories/${id}`, data, true),
  deleteCategory:     (id)        => req('DELETE', `/categories/${id}`, null, true),

  // ── Products (public)
  getProducts:              (params = {}) => req('GET', '/products?' + new URLSearchParams(params)),
  getProduct:               (id)          => req('GET', `/products/${id}`),
  getProductCategoryCounts: ()            => req('GET', '/products/categories/list'),

  // ── Products (admin)
  getAllAdmin:     ()       => req('GET',    '/products/admin/all', null, true),
  createProduct:  (fd)     => reqForm('POST', '/products', fd),
  updateProduct:  (id, fd) => reqForm('PUT',  `/products/${id}`, fd),
  deleteProduct:  (id)     => req('DELETE', `/products/${id}`, null, true),
  restockProduct: (id, qty)=> req('PATCH',  `/products/${id}/restock`, { quantity: qty }, true),

  // ── Orders
  placeOrder:           (data)     => req('POST',  '/orders', data, true),
  myOrders:             ()         => req('GET',   '/orders', null, true),
  getOrder:             (id)       => req('GET',   `/orders/${id}`, null, true),
  allOrders:            ()         => req('GET',   '/orders/admin/all', null, true),
  getAdminOrder:        (id)       => req('GET',   `/orders/admin/${id}`, null, true),
  cancelOrder:          (id)       => req('PATCH', `/orders/${id}/cancel`, null, true),
  deleteOrder:          (id)       => req('DELETE', `/orders/${id}`, null, true),
  updateStatus:         (id, body) => req('PATCH', `/orders/${id}/status`, body, true),
  uploadPaymentProof:   (id, fd)   => reqForm('POST', `/orders/${id}/payment-proof`, fd),
  verifyPayment:        (id, body) => req('PATCH', `/orders/${id}/verify-payment`, body, true),

  // ── Shipping
  getShippingCities:    ()         => req('GET', '/shipping/cities'),

  // ── Settings
  getSettings:      ()       => req('GET', '/settings'),
  getAdminSettings: ()       => req('GET', '/admin/settings', null, true),
  updateSettings:   (data)   => req('PUT', '/admin/settings', { settings: data }, true),

  // ── Coupons
  validateCoupon:  (code, subtotal)  => req('POST',   '/coupons/validate', { code, subtotal }),
  getCouponsAdmin: ()                => req('GET',    '/coupons/admin/all', null, true),
  createCoupon:    (data)            => req('POST',   '/coupons', data, true),
  updateCoupon:    (id, data)        => req('PUT',    `/coupons/${id}`, data, true),
  deleteCoupon:    (id)              => req('DELETE', `/coupons/${id}`, null, true),

  // ── Reviews
  getReviews: (productId) => req('GET',    `/reviews?productId=${productId}`),
  addReview:  (data)      => req('POST',   '/reviews', data, true),
  delReview:  (id)        => req('DELETE', `/reviews/${id}`, null, true),

  // ── Wishlist
  getWishlist:    ()          => req('GET',    '/wishlist', null, true),
  toggleWishlist: (productId) => req('POST',   `/wishlist/${productId}`, null, true),
  removeWishlist: (productId) => req('DELETE', `/wishlist/${productId}`, null, true),

  // ── Admin
  getStats:   ()    => req('GET',    '/admin/stats', null, true),
  getUsers:   ()    => req('GET',    '/admin/users', null, true),
  deleteUser: (id)  => req('DELETE', `/admin/users/${id}`, null, true),

  // ── Newsletter
  subscribe: (email) => req('POST', '/newsletter/subscribe', { email }),

  // ── Contact messages (public submit + admin manage)
  sendContactMessage:    (data)     => req('POST',   '/contact', data),
  getContactMessages:    ()         => req('GET',    '/admin/contact-messages', null, true),
  getUnreadMessageCount: ()         => req('GET',    '/admin/contact-messages/unread-count', null, true),
  setMessageRead:        (id, read) => req('PATCH',  `/admin/contact-messages/${id}/read`, { read }, true),
  deleteContactMessage:  (id)       => req('DELETE', `/admin/contact-messages/${id}`, null, true),

  // ── Hero Banners (public)
  getActiveBanners: () => req('GET', '/hero-banners'),

  // ── Hero Banners (admin)
  getAdminBanners:  ()         => req('GET',    '/admin/hero-banners', null, true),
  createBanner:     (fd)       => reqForm('POST', '/admin/hero-banners', fd),
  updateBanner:     (id, fd)   => reqForm('PUT',  `/admin/hero-banners/${id}`, fd),
  deleteBanner:     (id)       => req('DELETE', `/admin/hero-banners/${id}`, null, true),
  toggleBanner:     (id)       => req('PATCH',  `/admin/hero-banners/${id}/toggle`, null, true),
  reorderBanners:   (items)    => req('PATCH',  '/admin/hero-banners/reorder', { items }, true),

  // ── Homepage Categories (public)
  getHomeCategories: () => req('GET', '/homepage-categories'),

  // ── Homepage Categories (admin)
  getAdminHomeCategories: ()       => req('GET',    '/admin/homepage-categories', null, true),
  createHomeCategory:     (fd)     => reqForm('POST', '/admin/homepage-categories', fd),
  updateHomeCategory:     (id, fd) => reqForm('PUT',  `/admin/homepage-categories/${id}`, fd),
  deleteHomeCategory:     (id)     => req('DELETE', `/admin/homepage-categories/${id}`, null, true),
  toggleHomeCategory:     (id)     => req('PATCH',  `/admin/homepage-categories/${id}/toggle`, null, true),
  reorderHomeCategories:  (items)  => req('PATCH',  '/admin/homepage-categories/reorder', { items }, true),

  // ── Homepage Features: Best Sellers / New Arrivals (public)
  getHomeSection: (section) => req('GET', `/homepage/${section}`),

  // ── Homepage Features (admin)
  getAdminHomeSection: (section)            => req('GET',    `/admin/homepage/${section}`, null, true),
  addHomeFeature:      (section, productId) => req('POST',   `/admin/homepage/${section}`, { productId }, true),
  removeHomeFeature:   (section, id)        => req('DELETE', `/admin/homepage/${section}/${id}`, null, true),
  toggleHomeFeature:   (section, id)        => req('PATCH',  `/admin/homepage/${section}/${id}/toggle`, null, true),
  reorderHomeFeatures: (section, items)     => req('PATCH',  `/admin/homepage/${section}/reorder`, { items }, true),
  setHomeSectionMax:   (section, max)       => req('PUT',    `/admin/homepage/${section}/max`, { max }, true),
};

// Helper: get first image from product colors array
function getProductImage(product) {
  if (!product) return null;
  return product.colors?.[0]?.images?.[0] || null;
}

// ── Clean-URL helpers ──────────────────────────────────────────────────────
// Public site origin, used to build absolute canonical / Open Graph URLs.
const SITE_URL = 'https://domdom-store.com';

// Slugify must match the backend (backend/middleware/sitemap.js) so the URLs a
// page advertises as canonical are exactly the ones in sitemap.xml.
function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Product id is a cuid (no hyphens), so a "<name>-<id>" slug is reversible:
// the id is always the final hyphen-separated segment.
function productId(p)   { return String(p._id || p.id || ''); }
function productSlug(p) {
  const base = slugify(p.name);
  const id   = productId(p);
  return base ? `${base}-${id}` : id;
}
function productUrl(p)  { return `/product/${productSlug(p)}`; }

// Parse the product id back out of a /product/:slug path segment.
function parseProductId(slug) {
  const s = String(slug || '').split('/').pop();
  const parts = s.split('-');
  return parts[parts.length - 1];
}

window.API = API;
window.getProductImage = getProductImage;
window.SITE_URL = SITE_URL;
window.slugify = slugify;
window.productSlug = productSlug;
window.productUrl = productUrl;
window.parseProductId = parseProductId;
