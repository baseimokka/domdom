// backend/middleware/ssrMeta.js
// ──────────────────────────────────────────────────────────────────────────
// Server-side <head> META injection — for /product/:slug and /category/:slug ONLY.
//
// It replaces a single marker-delimited block
//     <!--SSR_META_START--> … <!--SSR_META_END-->
// inside the static page's <head> with per-product / per-category
// title · description · canonical · Open Graph (+ Product JSON-LD for products),
// so crawlers AND non-JS social scrapers get correct tags in the FIRST response.
//
// Strictly scoped to the meta block:
//   • The page <body>, client-side product loading, layout, nav and routing are
//     left completely untouched.
//   • Any failure degrades safely: injection/DB error → original file unchanged;
//     product not found → real 404 page. It never emits broken HTML.
//   • Identical output for bots and humans — there is no user-agent sniffing.
// ──────────────────────────────────────────────────────────────────────────
const fs     = require('fs');
const path   = require('path');
const prisma = require('../config/prisma');
const { mapProduct } = require('../data/map');
const { slugify }    = require('./sitemap');

const FRONTEND       = path.join(__dirname, '../../frontend');
const SITE_URL       = (process.env.SITE_URL || 'https://domdom-store.com').replace(/\/+$/, '');
const PRODUCT_FILE   = path.join(FRONTEND, 'pages/product.html');
const CATEGORY_FILE  = path.join(FRONTEND, 'pages/shop.html');
const NOT_FOUND_FILE = path.join(FRONTEND, '404.html');

// Single block per file, replaced wholesale.
const MARKER = /<!--SSR_META_START-->[\s\S]*?<!--SSR_META_END-->/;

// Read each template once and keep it in memory (pristine copy reused per request).
const cache = {};
function template(file) {
  if (cache[file] === undefined) cache[file] = fs.readFileSync(file, 'utf8');
  return cache[file];
}

// ── small, dependency-free helpers ────────────────────────────────────────
function escAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// JSON-LD inside <script> must never contain a literal "</script>" — escaping
// every "<" to < makes that impossible while staying valid JSON.
function jsonLd(obj) { return JSON.stringify(obj).replace(/</g, '\\u003c'); }
function clean(text, max = 160) { return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function absUrl(u) {
  if (!u) return `${SITE_URL}/images/favicon.png`;
  if (/^https?:\/\//i.test(u)) return u;
  return `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
}
function parseId(slug) {
  const parts = decodeURIComponent(slug).split('-');
  return parts[parts.length - 1];          // cuid has no '-', so it's the last segment
}
function firstImage(p) {
  const c = (p.colors || []).find(c => Array.isArray(c.images) && c.images.length);
  return c ? c.images[0] : null;
}

// ── meta block builders ───────────────────────────────────────────────────
function buildProductMeta(p) {
  const url   = `${SITE_URL}/product/${slugify(p.name)}-${p._id}`;
  const photo = absUrl(firstImage(p));                 // real product photo → JSON-LD (Google supports WebP)
  const ogImg = `${SITE_URL}/og/product/${p._id}.jpg`; // generated 1200×630 JPEG → social share card
  const desc  = clean(p.description || `Shop ${p.name} at DomDom Store — premium cruelty-free beauty with cash on delivery across Egypt.`);
  const title = `${p.name} — DomDom Store`;

  const product = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: p.name,
    image: [photo],
    description: desc,
    brand: { '@type': 'Brand', name: p.brand || 'DomDom' },
    category: p.category || undefined,
    sku: p.sku || undefined,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'EGP',
      price: Number(p.finalPrice).toFixed(2),
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
    }
  };
  if (p.reviewCount > 0 && p.rating > 0) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(p.rating).toFixed(1),
      reviewCount: p.reviewCount
    };
  }
  const breadcrumb = {
    '@context': 'https://schema.org/',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
      { '@type': 'ListItem', position: 3, name: p.name, item: url }
    ]
  };

  // ids are preserved so the existing client-side applyProductSeo() keeps working.
  return `<title>${escAttr(title)}</title>
<meta name="description" id="meta-description" content="${escAttr(desc)}">
<link rel="canonical" id="canonical-link" href="${escAttr(url)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="product">
<meta property="og:site_name" content="DomDom Store">
<meta property="og:title" id="og-title" content="${escAttr(title)}">
<meta property="og:description" id="og-desc" content="${escAttr(desc)}">
<meta property="og:url" id="og-url" content="${escAttr(url)}">
<meta property="og:image" id="og-image" content="${escAttr(ogImg)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${escAttr(p.name)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(title)}">
<meta name="twitter:description" content="${escAttr(desc)}">
<meta name="twitter:image" content="${escAttr(ogImg)}">
<script type="application/ld+json" id="product-jsonld">${jsonLd([product, breadcrumb])}</script>`;
}

function buildCategoryMeta(cat, slug) {
  const url   = `${SITE_URL}/category/${slug}`;
  const title = `${cat.name} — DomDom Store`;
  const desc  = clean(`Shop ${cat.name} at DomDom Store — premium cruelty-free beauty. Cash on delivery across Egypt.`);
  return `<title>${escAttr(title)}</title>
<meta name="description" content="${escAttr(desc)}">
<link rel="canonical" href="${escAttr(url)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="DomDom Store">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:url" content="${escAttr(url)}">
<meta property="og:image" content="${SITE_URL}/og/default.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`;
}

// ── route handlers (called from serveClean for those two paths only) ───────
async function renderProduct(req, res) {
  let tpl;
  try { tpl = template(PRODUCT_FILE); }
  catch (e) { return res.sendFile(PRODUCT_FILE); }            // unreadable template → static

  try {
    const id  = parseId(req.path.replace(/^\/product\//, ''));
    const raw = await prisma.product.findUnique({ where: { id }, include: { colors: true } });
    if (!raw) return res.status(404).sendFile(NOT_FOUND_FILE); // exists-check failed → real 404

    const html = tpl.replace(MARKER, buildProductMeta(mapProduct(raw)));
    if (html === tpl) return res.sendFile(PRODUCT_FILE);       // marker missing → original
    return res.type('html').send(html);
  } catch (e) {
    console.error('ssrMeta(product): serving static fallback —', e.message);
    if (res.headersSent) return;
    return res.sendFile(PRODUCT_FILE);                          // DB/injection error → original
  }
}

async function renderCategory(req, res) {
  let tpl;
  try { tpl = template(CATEGORY_FILE); }
  catch (e) { return res.sendFile(CATEGORY_FILE); }

  try {
    const slug = decodeURIComponent(req.path.replace(/^\/category\//, ''));
    const cat  = await prisma.category.findFirst({ where: { slug, active: true } });
    if (!cat) return res.sendFile(CATEGORY_FILE);               // unknown category → shop page (unchanged behaviour)

    const html = tpl.replace(MARKER, buildCategoryMeta(cat, slug));
    if (html === tpl) return res.sendFile(CATEGORY_FILE);
    return res.type('html').send(html);
  } catch (e) {
    console.error('ssrMeta(category): serving static fallback —', e.message);
    if (res.headersSent) return;
    return res.sendFile(CATEGORY_FILE);
  }
}

module.exports = { renderProduct, renderCategory, buildProductMeta, buildCategoryMeta, MARKER };
