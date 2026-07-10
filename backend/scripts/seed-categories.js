// backend/scripts/seed-categories.js
// ---------------------------------------------------------------------------
// Makes the seeded brands browsable in the shop. Two jobs, both idempotent:
//
//   1) Ensure the Category records exist. The shop filter sidebar, admin product
//      dropdown, homepage "Shop by Category" cards, and /category/<slug> pages
//      are ALL driven by the Category table and key off the category SLUG.
//   2) Align existing products' `category` field to that slug. Products seeded
//      before this fix stored the human label (e.g. "Skin Care"); the shop
//      filters by exact string on the slug ("skin-care"), so they must match.
//
// Safe to re-run. Run:  node backend/scripts/seed-categories.js
// ---------------------------------------------------------------------------

const path = require("path");
// Load env explicitly from backend/.env so DATABASE_URL resolves regardless of cwd.
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const prisma = require("../config/prisma");

// name -> slug/emoji/order. Slugs match categoryController.slugify() output.
const CATEGORIES = [
  { name: "Skin Care",   slug: "skin-care",   emoji: "🧴", sortOrder: 1 },
  { name: "Hair Care",   slug: "hair-care",   emoji: "💇", sortOrder: 2 },
  { name: "Body Splash", slug: "body-splash", emoji: "🌸", sortOrder: 3 },
  { name: "Body Care",   slug: "body-care",   emoji: "🧼", sortOrder: 4 },
];

// Legacy label -> slug remap for products seeded before this fix.
const REMAP = {
  "Skin Care": "skin-care",
  "Hair Care": "hair-care",
  "Body Splash": "body-splash",
  "Body Care": "body-care",
};

async function main() {
  let created = 0;
  let existed = 0;
  let remapped = 0;

  // 1) Ensure Category rows exist (match on the unique slug OR name).
  for (const c of CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { OR: [{ slug: c.slug }, { name: c.name }] },
    });
    if (existing) {
      console.log(`Category exists: ${c.name} (/${existing.slug})`);
      existed++;
      continue;
    }
    await prisma.category.create({
      data: { name: c.name, slug: c.slug, emoji: c.emoji, sortOrder: c.sortOrder, active: true },
    });
    console.log(`Category created: ${c.name} (/${c.slug})`);
    created++;
  }

  // 2) Align existing products from legacy labels to slugs.
  for (const [label, slug] of Object.entries(REMAP)) {
    const { count } = await prisma.product.updateMany({
      where: { category: label },
      data: { category: slug },
    });
    if (count > 0) console.log(`Remapped ${count} product(s): "${label}" -> "${slug}"`);
    remapped += count;
  }

  console.log("");
  console.log("====================================");
  console.log(`Categories created: ${created}`);
  console.log(`Categories already existed: ${existed}`);
  console.log(`Products remapped to slugs: ${remapped}`);
  console.log("Finished Successfully");
  console.log("====================================");
}

main()
  .catch((error) => {
    console.error("Category seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
