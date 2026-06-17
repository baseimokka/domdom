// backend/middleware/cleanUrls.js
// ──────────────────────────────────────────────────────────────────────────
// Clean-URL layer for the storefront. Turns the on-disk multi-page structure
// (/pages/about.html, ?cat=, ?id=) into SEO-friendly public URLs, 301-redirects
// every legacy URL to its clean form, and serves a real 404 (no more soft-404
// homepage). Pure routing — no database access lives here.
// ──────────────────────────────────────────────────────────────────────────
const path = require('path');
const { renderProduct, renderCategory } = require('./ssrMeta');

const FRONTEND = path.join(__dirname, '../../frontend');

// Clean route → physical file (relative to the frontend dir).
const ROUTE_FILE = {
  '/':               'index.html',
  '/shop':           'pages/shop.html',
  '/about':          'pages/about.html',
  '/contact':        'pages/contact.html',
  '/privacy-policy': 'pages/privacy.html',
  '/terms':          'pages/terms.html',
  '/checkout':       'pages/checkout.html',
  '/cart':           'pages/checkout.html',
  '/orders':         'pages/orders.html',
  '/profile':        'pages/profile.html',
  '/wishlist':       'pages/wishlist.html',
  '/admin':          'pages/admin.html',
};

// Legacy /pages/<base>.html (and /<base>.html, /index.html) → clean path.
const LEGACY_PAGE = {
  index:    '/',
  shop:     '/shop',
  about:    '/about',
  contact:  '/contact',
  privacy:  '/privacy-policy',
  terms:    '/terms',
  checkout: '/checkout',
  orders:   '/orders',
  profile:  '/profile',
  wishlist: '/wishlist',
  admin:    '/admin',
};

function rawQueryOf(req) {
  const i = req.originalUrl.indexOf('?');
  return i === -1 ? '' : req.originalUrl.slice(i + 1);
}

// Rebuild a query string after dropping some keys (used to drop ?cat once it
// has been promoted to a /category/ path).
function queryWithout(rawQuery, drop = []) {
  const params = new URLSearchParams(rawQuery);
  drop.forEach(k => params.delete(k));
  const s = params.toString();
  return s ? `?${s}` : '';
}

// ── 301 redirects: every legacy URL → its single canonical clean URL.
// Runs first, before the clean router and before express.static, so the old
// .html / /pages/ paths can never be served directly (no duplicate indexing).
function legacyRedirects(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const p = req.path;
  if (p.startsWith('/api') || p.startsWith('/uploads')) return next();

  const rawQuery = rawQueryOf(req);

  // Normalise trailing slash (except root) → no-slash, preserve query.
  if (p.length > 1 && p.endsWith('/')) {
    return res.redirect(301, p.replace(/\/+$/, '') + (rawQuery ? `?${rawQuery}` : ''));
  }

  // Only legacy .html paths are rewritten here; everything else passes through.
  if (!p.endsWith('.html')) return next();

  // /pages/product.html?id=X → /product/X  (page upgrades to pretty slug client-side)
  if (p === '/pages/product.html' || p === '/product.html') {
    const id = req.query.id;
    return res.redirect(301, id ? `/product/${encodeURIComponent(id)}` : '/shop');
  }

  // /pages/shop.html?cat=X → /category/X ; otherwise → /shop (keep ?sort etc.)
  if (p === '/pages/shop.html' || p === '/shop.html') {
    const cat = req.query.cat;
    if (cat) return res.redirect(301, `/category/${encodeURIComponent(cat)}`);
    return res.redirect(301, '/shop' + queryWithout(rawQuery, ['cat']));
  }

  // Generic: /pages/<base>.html or /<base>.html or /index.html
  const base = p.replace(/^\/(?:pages\/)?/, '').replace(/\.html$/, '');
  const clean = LEGACY_PAGE[base] !== undefined ? LEGACY_PAGE[base] : `/${base}`;
  return res.redirect(301, clean + (rawQuery ? `?${rawQuery}` : ''));
}

// ── Serve the physical page for a clean URL (URL in the bar stays clean).
// Runs before express.static so /shop, /about, /product/:slug, /category/:slug
// resolve to their files; asset/uploads requests fall through to static.
function serveClean(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const p = req.path;

  if (ROUTE_FILE[p]) return res.sendFile(path.join(FRONTEND, ROUTE_FILE[p]));
  // Same route matching as before — only the response for these two paths now
  // carries server-rendered <head> meta (SEO/social). Body & routing unchanged.
  if (/^\/category\/[^/]+$/.test(p)) return renderCategory(req, res, next);
  if (/^\/product\/[^/]+$/.test(p))  return renderProduct(req, res, next);

  return next();
}

// ── Real 404 — replaces the old catch-all that returned the homepage with 200.
function notFound(req, res) {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.status(404).sendFile(path.join(FRONTEND, '404.html'));
}

module.exports = { legacyRedirects, serveClean, notFound, ROUTE_FILE };
