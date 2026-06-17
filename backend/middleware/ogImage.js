// backend/middleware/ogImage.js
// ──────────────────────────────────────────────────────────────────────────
// On-the-fly Open Graph share images (1200×630 JPEG) so product/page links
// preview correctly on WhatsApp, Facebook, Instagram, X, iMessage & LinkedIn —
// platforms that often won't render the WebP product photos or a tiny favicon.
//
//   GET /og/product/:id.jpg  → product photo centred on a 1200×630 cream card
//   GET /og/default.jpg      → branded card (logo on cream) for non-product pages
//
// Fail-safe by design:
//   • sharp is loaded lazily; if it is missing/unavailable the routes fall back
//     to the raw favicon, so the site keeps working and the deploy can't break.
//   • Any per-image error degrades to the default card, never a broken response.
//   • Generated cards are cached on disk and regenerated only when the source
//     image changes.
// ──────────────────────────────────────────────────────────────────────────
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const { mapProduct } = require('../data/map');

const BACKEND     = path.join(__dirname, '..');
const FAVICON     = path.join(BACKEND, '../frontend/images/favicon.png');
const CACHE_DIR   = path.join(BACKEND, 'uploads', 'og-cache');
const W = 1200, H = 630;
const CREAM = { r: 251, g: 247, b: 243 };       // brand background

try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}

// Lazy, optional sharp — never crash the process if it isn't installed.
let _sharp; let _sharpTried = false;
function sharp() {
  if (!_sharpTried) { _sharpTried = true; try { _sharp = require('sharp'); } catch (e) {
    console.warn('ogImage: sharp unavailable, OG images fall back to favicon —', e.message);
    _sharp = null;
  } }
  return _sharp;
}

// Map a stored "/uploads/…" image path to its file on disk (null if external/none).
function localFile(imgPath) {
  if (!imgPath || /^https?:\/\//i.test(imgPath)) return null;
  const rel = imgPath.replace(/^\/+/, '');
  if (!rel.startsWith('uploads/')) return null;
  const file = path.join(BACKEND, rel);
  return fs.existsSync(file) ? file : null;
}

function sendJpeg(res, file) {
  res.type('jpeg');
  res.set('Cache-Control', 'public, max-age=86400');
  return res.sendFile(file);
}

// Compose a centred image onto the 1200×630 cream canvas.
async function card(innerBuffer) {
  const s = sharp();
  return s({ create: { width: W, height: H, channels: 3, background: CREAM } })
    .composite([{ input: innerBuffer, gravity: 'centre' }])
    .jpeg({ quality: 84, progressive: true })
    .toBuffer();
}

// ── default (branded) card ─────────────────────────────────────────────────
async function buildDefault() {
  const logo = await sharp()(FAVICON).resize(360, 360, { fit: 'inside', withoutEnlargement: false }).toBuffer();
  return card(logo);
}
async function defaultFile() {
  const f = path.join(CACHE_DIR, 'default.jpg');
  if (!fs.existsSync(f)) fs.writeFileSync(f, await buildDefault());
  return f;
}
async function serveDefault(res) {
  try {
    if (!sharp()) return sendJpeg(res, FAVICON);     // no sharp → raw favicon
    return sendJpeg(res, await defaultFile());
  } catch (e) {
    console.error('ogImage(default):', e.message);
    return sendJpeg(res, FAVICON);
  }
}

// ── product card ────────────────────────────────────────────────────────────
async function buildProduct(srcFile) {
  const photo = await sharp()(srcFile).rotate()
    .resize(540, 540, { fit: 'inside', withoutEnlargement: true }).toBuffer();
  return card(photo);
}

async function productOgImage(req, res) {
  try {
    if (!sharp()) return serveDefault(res);
    const raw = await prisma.product.findUnique({ where: { id: req.params.id }, include: { colors: true } });
    if (!raw) return serveDefault(res);

    const p   = mapProduct(raw);
    const img = (p.colors.find(c => Array.isArray(c.images) && c.images.length) || {}).images?.[0];
    const src = localFile(img);
    if (!src) return serveDefault(res);               // external/missing photo → branded card

    // Cache keyed by source file + mtime, so re-uploads invalidate automatically.
    const key  = crypto.createHash('md5').update(src + ':' + fs.statSync(src).mtimeMs).digest('hex');
    const file = path.join(CACHE_DIR, key + '.jpg');
    if (!fs.existsSync(file)) fs.writeFileSync(file, await buildProduct(src));
    return sendJpeg(res, file);
  } catch (e) {
    console.error('ogImage(product):', e.message);
    return serveDefault(res);
  }
}

function defaultOgImage(req, res) { return serveDefault(res); }

module.exports = { productOgImage, defaultOgImage };
