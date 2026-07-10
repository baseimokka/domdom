const path = require("path");
// Load env explicitly from backend/.env so DATABASE_URL resolves no matter
// which directory the script is launched from. dotenv never overrides an
// already-set env. (Prisma Client does not auto-load .env at runtime.)
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const prisma = require("../config/prisma");

const MARKUP_RATE = 0.05; // keep in sync with backend/config/pricing.js

// The store applies applyMarkup(base) = ceil(base * 1.05) to every product's
// stored `price` at display AND order time (see backend/config/pricing.js).
// To make the customer see an exact target price we store a REDUCED base that
// ceils back up to that target: floor(target / 1.05, 2 decimals).
//   e.g. target 240 -> base 228.57 -> ceil(228.57 * 1.05) = ceil(239.998) = 240
const baseFor = (target) => Math.floor((target / (1 + MARKUP_RATE)) * 100) / 100;

// ──────────────────────────────────────────────
// Templates
// ──────────────────────────────────────────────

const templates = {
  "Moisturizing Gel": {
    description:
      "A lightweight, oil-free moisturizing gel that delivers deep hydration without clogging pores. Formulated with dermatologist-approved ingredients, it absorbs instantly to soothe, repair, and protect the skin barrier, leaving your complexion balanced, soft, and refreshed all day long.",
    details: [
      "Oil-free, non-comedogenic gel formula",
      "Provides deep hydration and skin barrier repair",
      "Fast-absorbing with no greasy residue",
      "Suitable for all skin types including sensitive skin",
    ],
  },
  "Moisturizing Cream": {
    description:
      "A rich, nourishing moisturizing cream designed to lock in moisture and restore the skin's natural protective barrier. Infused with advanced hydrating actives, it deeply conditions the skin, improving texture and elasticity while providing long-lasting comfort and softness.",
    details: [
      "Rich cream formula for intense long-lasting moisture",
      "Strengthens and restores the skin barrier",
      "Improves skin texture, smoothness, and elasticity",
      "Dermatologically tested for all skin types",
    ],
  },
  "Whitening Cream": {
    description:
      "An advanced skin-brightening cream formulated to reduce the appearance of dark spots, uneven tone, and hyperpigmentation. Powered by clinically proven whitening actives, it works gradually to reveal a more radiant, luminous, and evenly toned complexion with daily use.",
    details: [
      "Targets dark spots and uneven skin tone",
      "Contains clinically proven brightening actives",
      "Lightweight texture absorbs quickly into the skin",
      "Safe for daily use with visible results over time",
    ],
  },
  "Facial Cleanser": {
    description:
      "A gentle yet effective facial cleanser that removes dirt, makeup, and impurities without stripping the skin's natural moisture. Formulated with skin-friendly ingredients, it leaves the face feeling clean, refreshed, and perfectly prepped for your skincare routine.",
    details: [
      "Gently removes makeup, dirt, and excess oil",
      "Maintains the skin's natural moisture balance",
      "Soap-free, pH-balanced formula",
      "Ideal for daily morning and evening use",
    ],
  },
  "Double Cleanser": {
    description:
      "A dual-action facial double cleanser that combines oil-based and water-based cleansing in one step. It melts away sunscreen, makeup, and sebum in the first phase, then deeply purifies pores in the second, delivering a thorough yet gentle cleanse every time.",
    details: [
      "Two-phase cleansing in a single product",
      "Effectively dissolves makeup and sunscreen",
      "Deeply purifies pores without over-drying",
      "Leaves skin clean, soft, and balanced",
    ],
  },
  "Sunscreen Gel": {
    description:
      "A high-performance sunscreen gel with broad-spectrum SPF50+ protection against UVA and UVB rays. Its ultra-light, non-greasy gel texture blends seamlessly into the skin, providing invisible sun defense that feels weightless and comfortable under makeup or on its own.",
    details: [
      "Broad-spectrum SPF50+ UVA/UVB protection",
      "Lightweight, invisible gel finish",
      "Non-greasy, non-comedogenic formula",
      "Suitable as a makeup base for daily wear",
    ],
  },
  "Sunscreen Spray": {
    description:
      "A convenient broad-spectrum SPF50+ sunscreen spray that delivers fast, even, and mess-free sun protection. The ultra-fine mist dries quickly to a weightless finish, making it perfect for on-the-go reapplication throughout the day without disrupting makeup.",
    details: [
      "Broad-spectrum SPF50+ in a fine mist spray",
      "Quick-drying, weightless, and non-sticky",
      "Easy reapplication over makeup",
      "Water-resistant formula for active lifestyles",
    ],
  },
  "Eye Contour": {
    description:
      "A targeted eye contour treatment designed to address dark circles, puffiness, and fine lines around the delicate eye area. Its lightweight, fast-absorbing formula delivers concentrated actives to visibly brighten, firm, and smooth the under-eye zone with consistent use.",
    details: [
      "Targets dark circles, puffiness, and fine lines",
      "Lightweight formula for the delicate eye area",
      "Concentrated actives for visible improvement",
      "Gentle enough for daily morning and night use",
    ],
  },
  "Body Milk": {
    description:
      "A silky, fast-absorbing body milk that delivers all-day hydration and a beautifully scented finish. Enriched with nourishing ingredients, it wraps the skin in lightweight moisture, leaving it feeling irresistibly soft, smooth, and delicately fragranced from morning to night.",
    details: [
      "Lightweight, fast-absorbing body moisturizer",
      "Provides all-day hydration and softness",
      "Enriched with skin-nourishing ingredients",
      "Leaves a subtle, long-lasting fragrance on skin",
    ],
  },
  "Anti-aging Serum": {
    description:
      "A powerful anti-aging whitening serum that combines advanced brightening technology with wrinkle-fighting actives. This concentrated formula targets fine lines, dark spots, and loss of firmness, promoting a visibly younger, brighter, and more even-toned complexion with every application.",
    details: [
      "Dual-action: anti-aging and skin brightening",
      "Reduces fine lines, wrinkles, and dark spots",
      "Concentrated serum for maximum potency",
      "Promotes firmer, more youthful-looking skin",
    ],
  },
  "Face Serum": {
    description:
      "A high-potency facial serum formulated with targeted active ingredients to address specific skin concerns. Its lightweight, fast-penetrating texture delivers concentrated actives deep into the skin for visible results, helping to refine, brighten, and transform your complexion over time.",
    details: [
      "High-concentration active ingredient formula",
      "Lightweight texture penetrates deeply into skin",
      "Targets specific skin concerns for visible results",
      "Use daily before moisturizer for best results",
    ],
  },
  "CICA Spray": {
    description:
      "A soothing CICA spray enriched with Centella Asiatica extract to calm, repair, and protect irritated or compromised skin. The fine mist delivers instant relief and hydration, making it ideal for post-procedure care, sunburn, or whenever your skin needs calming support.",
    details: [
      "Enriched with Centella Asiatica (CICA) extract",
      "Calms redness, irritation, and sensitivity",
      "Fine mist for easy, even application",
      "Ideal for post-procedure and sensitive skin care",
    ],
  },
  "CICA Cleanser": {
    description:
      "A gentle CICA facial cleanser infused with Centella Asiatica to cleanse without irritation. It removes impurities while soothing and strengthening the skin barrier, making it the perfect daily cleanser for sensitive, reactive, or post-treatment skin that needs extra care.",
    details: [
      "Gentle cleansing with Centella Asiatica (CICA)",
      "Soothes and strengthens the skin barrier",
      "Removes impurities without causing irritation",
      "Perfect for sensitive and post-treatment skin",
    ],
  },
  "CICA Cream": {
    description:
      "A restorative CICA cream gel formulated with Centella Asiatica to accelerate skin recovery and strengthen the barrier. Its lightweight gel-cream texture soothes inflammation, reduces redness, and provides deep hydration, making it essential for damaged, irritated, or sensitive skin.",
    details: [
      "Centella Asiatica formula for skin recovery",
      "Reduces redness and soothes inflammation",
      "Lightweight gel-cream texture, non-heavy",
      "Strengthens and restores the skin barrier",
    ],
  },
  "CICA Lotion": {
    description:
      "A nourishing CICA creamy lotion that combines the healing power of Centella Asiatica with rich emollients. It delivers deep, lasting moisture while calming and repairing the skin, ideal as a daily moisturizer for those with dry, sensitive, or barrier-compromised skin.",
    details: [
      "Creamy lotion with Centella Asiatica (CICA)",
      "Deep, lasting moisture for dry and sensitive skin",
      "Repairs and calms barrier-compromised skin",
      "Rich yet comfortable for daily use",
    ],
  },
  "Roll-On Deodorant": {
    description:
      "A gentle antiperspirant whitening roll-on that provides long-lasting freshness and odor protection while gradually brightening the underarm area. Its alcohol-free, skin-friendly formula glides on smoothly, keeping you dry and confident throughout the day without irritation.",
    details: [
      "Antiperspirant with whitening action for underarms",
      "Long-lasting freshness and odor protection",
      "Alcohol-free, gentle on sensitive skin",
      "Smooth roll-on application, quick-drying",
    ],
  },
  "Urea Cream": {
    description:
      "An intensive Urea 10% cream specially formulated for extremely dry, rough, and cracked skin. The high-concentration urea gently exfoliates dead cells while drawing moisture deep into the skin, resulting in noticeably smoother, softer, and healthier-looking skin with regular use.",
    details: [
      "10% Urea concentration for intensive repair",
      "Exfoliates and softens rough, cracked skin",
      "Deep moisturizing action for extremely dry areas",
      "Suitable for hands, feet, elbows, and body",
    ],
  },
  "Acne Treatment": {
    description:
      "A targeted acne treatment gel formulated to combat breakouts, reduce inflammation, and prevent future blemishes. Its fast-acting, non-drying formula works to unclog pores and control excess oil while supporting the skin's natural healing process for a clearer complexion.",
    details: [
      "Targets active breakouts and prevents new ones",
      "Reduces inflammation and redness quickly",
      "Non-drying formula that respects the skin barrier",
      "Controls excess oil and unclogs pores",
    ],
  },
  "Whitening Soap": {
    description:
      "A skin-brightening cleansing soap bar enriched with whitening actives that gently cleanse while working to even out skin tone. It removes impurities and dullness with every wash, gradually revealing brighter, smoother, and more luminous skin from head to toe.",
    details: [
      "Cleansing bar with skin-brightening actives",
      "Gently evens out skin tone with regular use",
      "Removes impurities and surface dullness",
      "Suitable for face and body use",
    ],
  },
  "Hair Serum": {
    description:
      "A lightweight, silicone-enriched hair serum that tames frizz, adds brilliant shine, and protects against heat damage. It smooths the hair cuticle, sealing in moisture and nutrients for sleek, manageable, and healthy-looking hair that stays salon-fresh between visits.",
    details: [
      "Tames frizz and flyaways instantly",
      "Adds brilliant shine without weighing hair down",
      "Provides heat protection for styling tools",
      "Seals moisture for smoother, healthier hair",
    ],
  },
  "Hair Cream": {
    description:
      "A nourishing hair cream that deeply conditions and strengthens hair from root to tip. Formulated with restorative ingredients, it repairs damage, reduces breakage, and adds softness and manageability, making it an essential daily styling and treatment product for all hair types.",
    details: [
      "Deep conditioning from root to tip",
      "Repairs damage and reduces hair breakage",
      "Adds softness, shine, and manageability",
      "Suitable for daily use on all hair types",
    ],
  },
  "Hair Oil": {
    description:
      "A lightweight, fast-absorbing hair oil infused with natural oils to nourish, strengthen, and add luminous shine. It penetrates the hair shaft to repair damage and prevent split ends, while taming frizz and leaving hair feeling silky, smooth, and deeply conditioned.",
    details: [
      "Infused with natural nourishing oils",
      "Repairs damage and prevents split ends",
      "Adds luminous shine without greasy residue",
      "Lightweight formula suitable for all hair types",
    ],
  },
  "Hair Tonic": {
    description:
      "A revitalizing hair tonic formulated to stimulate the scalp, strengthen hair follicles, and promote healthier, thicker-looking hair growth. Its refreshing formula invigorates the scalp, reduces hair fall, and creates an optimal environment for stronger, more resilient hair over time.",
    details: [
      "Stimulates scalp and strengthens hair follicles",
      "Helps reduce hair fall and thinning",
      "Promotes healthier, thicker-looking hair growth",
      "Refreshing formula for daily scalp care",
    ],
  },
  "Eyebrow Serum": {
    description:
      "A precision eyebrow serum designed to nourish, strengthen, and promote fuller, thicker-looking brows. Its concentrated formula delivers essential nutrients directly to the brow hair follicles, supporting natural growth and reducing brow hair loss for beautifully defined, healthy eyebrows.",
    details: [
      "Promotes fuller, thicker-looking eyebrows",
      "Nourishes and strengthens brow hair follicles",
      "Precision applicator for targeted treatment",
      "Visible results with consistent daily use",
    ],
  },
  "Shampoo": {
    description:
      "A professional-grade shampoo formulated with keratin and strengthening actives to cleanse, repair, and fortify damaged hair. It gently removes buildup while restoring hair's natural strength, elasticity, and shine, leaving it feeling clean, bouncy, and visibly healthier after every wash.",
    details: [
      "Keratin-enriched formula for hair repair",
      "Gently cleanses without stripping natural oils",
      "Restores strength, elasticity, and shine",
      "Suitable for damaged, treated, and color-treated hair",
    ],
  },
  "Conditioner": {
    description:
      "A deeply restorative conditioner enriched with keratin to detangle, soften, and protect hair from daily damage. It smooths the cuticle, locks in moisture, and reduces breakage, leaving hair feeling silky, manageable, and protected from root to tip after every use.",
    details: [
      "Keratin-enriched for deep restoration",
      "Detangles and softens hair instantly",
      "Locks in moisture and reduces breakage",
      "Leaves hair silky, manageable, and protected",
    ],
  },
  "Shampoo & Conditioner": {
    description:
      "A dual-action shampoo and conditioner that cleanses and conditions in one convenient step. Formulated for scalp health and anti-dandruff care, it removes flakes and buildup while leaving hair clean, moisturized, and manageable, simplifying your hair care routine without compromise.",
    details: [
      "2-in-1 cleansing and conditioning formula",
      "Targets dandruff, flakes, and scalp buildup",
      "Leaves hair clean, soft, and manageable",
      "Convenient single-step hair care solution",
    ],
  },
};

// ──────────────────────────────────────────────
// Product definitions
// ──────────────────────────────────────────────

const products = [
  // ════════════════════════════════════════════
  // SKIN CARE — Skykur Moisturizing Gel
  // ════════════════════════════════════════════
  {
    name: "Skykur Gel 120 gm",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Moisturizing Gel",
    price: 240,
    oldPrice: null,
  },
  {
    name: "Skykur Gel 60 gm",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Moisturizing Gel",
    price: 150,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Skykur Moisturizing Cream
  // ════════════════════════════════════════════
  {
    name: "SkyKur Cream 120 gm",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Moisturizing Cream",
    price: 225,
    oldPrice: null,
  },
  {
    name: "SkyKur Cream 240 gm",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Moisturizing Cream",
    price: 270,
    oldPrice: 360,
  },
  {
    name: "Skykur Cream 60 gm",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Moisturizing Cream",
    price: 140,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Ventamor Whitening Cream
  // ════════════════════════════════════════════
  {
    name: "Ventamor Whitening Cream",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Whitening Cream",
    price: 230,
    oldPrice: null,
  },
  {
    name: "Ventamor Whitening Night Cream Gel",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Whitening Cream",
    price: 275,
    oldPrice: null,
  },
  {
    name: "Ventamor Whitening Cream for Sensitive Area 60 gm",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Whitening Cream",
    price: 275,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Ventamor Facial Cleanser
  // ════════════════════════════════════════════
  {
    name: "Ventamor Facial Wash",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Facial Cleanser",
    price: 220,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Ventamor Double Cleanser
  // ════════════════════════════════════════════
  {
    name: "Ventamor Facial Double Cleanser 200 ml",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Double Cleanser",
    price: 270,
    oldPrice: null,
  },
  {
    name: "Ventamor Facial Double Cleanser 120 gm",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Double Cleanser",
    price: 180,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Ventamor Sunscreen
  // ════════════════════════════════════════════
  {
    name: "Ventamor Sunscreen Gel SPF50+ (75 gm)",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Sunscreen Gel",
    price: 395,
    oldPrice: null,
  },
  {
    name: "Ventamor Sunscreen Gel SPF50+ (50 gm)",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Sunscreen Gel",
    price: 290,
    oldPrice: null,
    stock: 0,
  },
  {
    name: "Ventamor Sunscreen Spray SPF50+",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Sunscreen Spray",
    price: 495,
    oldPrice: null,
    stock: 0,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Ventamor Eye Contour
  // ════════════════════════════════════════════
  {
    name: "Ventamor Eye Contour",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Eye Contour",
    price: 350,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Skykur Body Milk
  // ════════════════════════════════════════════
  {
    name: "Skykur Body Milk Original 200 ml",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Body Milk",
    price: 260,
    oldPrice: null,
  },
  {
    name: "Skykur Body Milk Fresh Jasmin",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Body Milk",
    price: 260,
    oldPrice: null,
  },
  {
    name: "Skykur Body Milk Strawberry",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Body Milk",
    price: 260,
    oldPrice: null,
  },
  {
    name: "Skykur Body Milk Creamy Peach",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Body Milk",
    price: 260,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Ventamor Anti-aging Serum
  // ════════════════════════════════════════════
  {
    name: "Ventamor Antiaging Whitening Serum",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Anti-aging Serum",
    price: 425,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Skykur Face Serums
  // ════════════════════════════════════════════
  {
    name: "Skykur Niacinamide Serum",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Face Serum",
    price: 425,
    oldPrice: null,
  },
  {
    name: "Skykur Vitamin C Serum",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Face Serum",
    price: 425,
    oldPrice: null,
  },
  {
    name: "Skykur Retinol Intense Serum",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Face Serum",
    price: 425,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Skykur CICA Line
  // ════════════════════════════════════════════
  {
    name: "Skykur CICA Spray 200 ml",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "CICA Spray",
    price: 550,
    oldPrice: null,
  },
  {
    name: "Skykur CICA Facial Cleanser 200 ml",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "CICA Cleanser",
    price: 350,
    oldPrice: null,
  },
  {
    name: "Skykur CICA Cream Gel 60 gm",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "CICA Cream",
    price: 245,
    oldPrice: null,
  },
  {
    name: "Skykur CICA Creamy Lotion 120 ml",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "CICA Lotion",
    price: 445,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Ventamor Roll-On Deodorants
  // ════════════════════════════════════════════
  {
    name: "Ventamor Antiperspirant Whitening Roll-On Bubble Gum",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Roll-On Deodorant",
    price: 185,
    oldPrice: null,
  },
  {
    name: "Ventamor Antiperspirant Whitening Roll-On Fresh Lavender",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Roll-On Deodorant",
    price: 185,
    oldPrice: null,
  },
  {
    name: "Ventamor Antiperspirant Whitening Roll-On White Musk",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Roll-On Deodorant",
    price: 185,
    oldPrice: null,
    stock: 0,
  },
  {
    name: "Ventamor Antiperspirant Whitening Roll-On Neutral",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Roll-On Deodorant",
    price: 185,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Skykur Urea Cream
  // ════════════════════════════════════════════
  {
    name: "Skykur Urea Cream 10% (200gm)",
    brand: "Skykur",
    category: "skin-care",
    templateKey: "Urea Cream",
    price: 340,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Ventamor Acne Treatment
  // ════════════════════════════════════════════
  {
    name: "Ventamor Acne Gel",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Acne Treatment",
    price: 210,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // SKIN CARE — Whitening Soaps
  // ════════════════════════════════════════════
  {
    name: "Ventamor Whitening Soap",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Whitening Soap",
    price: 80,
    oldPrice: null,
  },
  {
    name: "Ventamor Whitening Soap Black",
    brand: "Ventamor",
    category: "skin-care",
    templateKey: "Whitening Soap",
    price: 85,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // HAIR CARE — Relat
  // ════════════════════════════════════════════
  {
    name: "Relat Hair Serum 60ml",
    brand: "Relat",
    category: "hair-care",
    templateKey: "Hair Serum",
    price: 275,
    oldPrice: null,
  },
  {
    name: "Relat Hair Cream 120 gm",
    brand: "Relat",
    category: "hair-care",
    templateKey: "Hair Cream",
    price: 275,
    oldPrice: null,
  },
  {
    name: "Relat Hair Oil 120 ml",
    brand: "Relat",
    category: "hair-care",
    templateKey: "Hair Oil",
    price: 240,
    oldPrice: null,
  },
  {
    name: "Relat Hair Tonic 120 ml",
    brand: "Relat",
    category: "hair-care",
    templateKey: "Hair Tonic",
    price: 280,
    oldPrice: null,
  },
  {
    name: "Relat Eyebrow Serum",
    brand: "Relat",
    category: "hair-care",
    templateKey: "Eyebrow Serum",
    price: 595,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // HAIR CARE — Keranty
  // ════════════════════════════════════════════
  {
    name: "Keranty Shampoo 200 ml",
    brand: "Keranty",
    category: "hair-care",
    templateKey: "Shampoo",
    price: 240,
    oldPrice: null,
  },
  {
    name: "Keranty Conditioner 200 ml",
    brand: "Keranty",
    category: "hair-care",
    templateKey: "Conditioner",
    price: 220,
    oldPrice: null,
  },

  // ════════════════════════════════════════════
  // HAIR CARE — Selenix
  // ════════════════════════════════════════════
  {
    name: "Selenix Shampoo & Conditioner 150 ml",
    brand: "Selenix",
    category: "hair-care",
    templateKey: "Shampoo & Conditioner",
    price: 190,
    oldPrice: null,
  },
];

// ──────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────

const DEFAULTS = {
  emoji: "✨",
  badge: null,
  stock: 100,
  lowStockThreshold: 10,
  rating: 0,
  reviewCount: 0,
  active: true,
};

// ──────────────────────────────────────────────
// SKU generator (replicated from backend/controllers/mysql/productController.js
// so the seed produces the same clean, sequential DD-XXX-### scheme). Queries
// fresh each call, so numbering stays correct as products are created one at a
// time within this run.
// ──────────────────────────────────────────────

const SKU_RE = /^(DD-[A-Z0-9]+)-(\d+)$/i;
async function generateSku(category) {
  const all = await prisma.product.findMany({ select: { sku: true, category: true } });

  // Adopt the prefix the category already uses, if any of its products have a parseable SKU
  let prefix = null;
  for (const p of all) {
    if (p.category !== category) continue;
    const m = (p.sku || "").match(SKU_RE);
    if (m) { prefix = m[1].toUpperCase(); break; }
  }
  if (!prefix) {
    const code = String(category || "GEN").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 3).padEnd(3, "X");
    prefix = `DD-${code}`;
  }

  // Next number = highest existing for this prefix + 1 (scan all SKUs to avoid collisions)
  const taken = new Set();
  let maxNum = 0;
  for (const p of all) {
    const sku = (p.sku || "").toUpperCase();
    taken.add(sku);
    const m = sku.match(SKU_RE);
    if (m && m[1] === prefix) maxNum = Math.max(maxNum, parseInt(m[2], 10));
  }

  let n = maxNum + 1, sku;
  do { sku = `${prefix}-${String(n++).padStart(3, "0")}`; } while (taken.has(sku.toUpperCase()));
  return sku;
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  let added = 0;
  let skipped = 0;

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: {
        name: product.name,
        brand: product.brand,
      },
    });

    if (existing) {
      console.log(`Skipped: ${product.name}`);
      skipped++;
      continue;
    }

    const template = templates[product.templateKey];
    const sku = await generateSku(product.category);

    await prisma.product.create({
      data: {
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: baseFor(product.price),
        oldPrice: product.oldPrice != null ? baseFor(product.oldPrice) : null,
        description: template.description,
        details: template.details,
        emoji: DEFAULTS.emoji,
        badge: DEFAULTS.badge,
        sku,
        stock: product.stock !== undefined ? product.stock : DEFAULTS.stock,
        lowStockThreshold: DEFAULTS.lowStockThreshold,
        rating: DEFAULTS.rating,
        reviewCount: DEFAULTS.reviewCount,
        active: DEFAULTS.active,
        colors: {
          create: [
            {
              name: "Default",
              hex: "",
              images: [],
              sortOrder: 0,
            },
          ],
        },
      },
    });

    console.log(`Added: ${product.name}  (${sku})`);
    added++;
  }

  console.log("");
  console.log("====================================");
  console.log(`Added: ${added}`);
  console.log(`Skipped: ${skipped}`);
  console.log("Finished Successfully");
  console.log("====================================");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
