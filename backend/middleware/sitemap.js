// backend/middleware/sitemap.js
// Dynamic /sitemap.xml — static pages + active categories + active products,
// straight from the database so it stays in sync as the catalogue changes.
// Resilient: if the DB query fails it still serves the static page URLs.
const prisma = require('../config/prisma');

const SITE_URL = (process.env.SITE_URL || 'https://domdom-store.com').replace(/\/+$/, '');

// Must produce the SAME slug as the frontend (frontend/js/api.js) so the
// sitemap URLs match the canonical URLs the pages advertise.
function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function productSlug(p) {
  const base = slugify(p.name);
  return base ? `${base}-${p.id}` : String(p.id);
}

function urlTag({ loc, lastmod, priority }) {
  return `  <url><loc>${loc}</loc>` +
    (lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : '') +
    (priority ? `<priority>${priority}</priority>` : '') +
    `</url>`;
}

async function sitemapHandler(req, res) {
  const urls = [
    { loc: `${SITE_URL}/`,               priority: '1.0' },
    { loc: `${SITE_URL}/shop`,           priority: '0.9' },
    { loc: `${SITE_URL}/about`,          priority: '0.6' },
    { loc: `${SITE_URL}/contact`,        priority: '0.6' },
    { loc: `${SITE_URL}/privacy-policy`, priority: '0.3' },
    { loc: `${SITE_URL}/terms`,          priority: '0.3' },
  ];

  try {
    const [cats, prods] = await Promise.all([
      prisma.category.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
      prisma.product.findMany({ where: { active: true }, select: { id: true, name: true, updatedAt: true } }),
    ]);
    for (const c of cats)
      urls.push({ loc: `${SITE_URL}/category/${c.slug}`, lastmod: c.updatedAt, priority: '0.8' });
    for (const p of prods)
      urls.push({ loc: `${SITE_URL}/product/${productSlug(p)}`, lastmod: p.updatedAt, priority: '0.7' });
  } catch (e) {
    console.error('sitemap: DB query failed, serving static URLs only —', e.message);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(urlTag).join('\n') +
    `\n</urlset>\n`;

  res.set('Content-Type', 'application/xml; charset=utf-8').send(xml);
}

module.exports = { sitemapHandler, slugify, productSlug };
