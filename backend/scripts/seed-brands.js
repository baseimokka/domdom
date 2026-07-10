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
//   e.g. target 180 -> base 171.42 -> ceil(171.42 * 1.05) = ceil(179.99) = 180
const baseFor = (target) => Math.floor((target / (1 + MARKUP_RATE)) * 100) / 100;

// ══════════════════════════════════════════════
// TEMPLATES
// ══════════════════════════════════════════════

const templates = {
  // ── SKIN CARE ──────────────────────────────
  "Moisturizing Cream": {
    description:
      "A rich, intensive moisturizing cream formulated with advanced hydrating actives to deeply nourish and repair the skin barrier. It locks in moisture for hours, leaving the skin feeling soft, supple, and protected against dryness and environmental stressors.",
    details: [
      "Intensive hydration with skin barrier repair",
      "Rich, non-greasy formula for long-lasting comfort",
      "Soothes and protects against environmental stress",
      "Suitable for all skin types, dermatologically tested",
    ],
  },
  "Moisturizing Gel": {
    description:
      "A lightweight, oil-free moisturizing gel that delivers deep hydration without clogging pores. Its fast-absorbing, non-greasy formula soothes and repairs the skin barrier, leaving your complexion balanced, refreshed, and perfectly prepped for makeup or daily activities.",
    details: [
      "Oil-free, non-comedogenic gel formula",
      "Provides deep hydration and skin barrier repair",
      "Fast-absorbing with no greasy residue",
      "Suitable for all skin types including oily and sensitive",
    ],
  },
  "Cream Gel": {
    description:
      "A hybrid cream-gel moisturizer that blends the nourishment of a cream with the weightless feel of a gel. Perfect for oily and combination skin, it hydrates deeply while controlling shine and mattifying the complexion for a fresh, balanced finish all day.",
    details: [
      "Hybrid cream-gel texture for balanced hydration",
      "Controls shine and mattifies oily skin",
      "Lightweight, fast-absorbing, non-greasy",
      "Ideal for oily and combination skin types",
    ],
  },
  "Urea Cream": {
    description:
      "An intensive urea-based cream specially formulated for extremely dry, rough, and cracked skin. The high-concentration urea gently exfoliates dead cells while drawing moisture deep into the skin, resulting in noticeably smoother, softer, and healthier-looking skin with regular use.",
    details: [
      "High-concentration urea for intensive repair",
      "Exfoliates and softens rough, cracked skin",
      "Deep moisturizing action for extremely dry areas",
      "Suitable for hands, feet, elbows, and body",
    ],
  },
  "Facial Cleanser": {
    description:
      "A gentle yet effective facial cleanser that removes dirt, makeup, and impurities without stripping the skin's natural moisture. Enriched with skin-friendly ingredients, it leaves the face feeling clean, refreshed, and perfectly prepped for your skincare routine.",
    details: [
      "Gently removes makeup, dirt, and excess oil",
      "Maintains the skin's natural moisture balance",
      "Soap-free, pH-balanced formula",
      "Ideal for daily morning and evening use",
    ],
  },
  "Foam Cleanser": {
    description:
      "A hydrating foam cleanser that transforms into a rich, airy lather to deeply cleanse pores while maintaining the skin's moisture balance. Its gentle foaming action removes oil, dirt, and impurities without over-drying, leaving skin feeling clean, soft, and refreshed.",
    details: [
      "Rich, airy foam for deep pore cleansing",
      "Hydrating formula prevents over-drying",
      "Removes excess oil and impurities effectively",
      "Gentle enough for daily use on all skin types",
    ],
  },
  "Milky Cleanser": {
    description:
      "A gentle milky cleanser with a creamy, soothing texture that melts away makeup and impurities while nourishing the skin. Its hydrating formula cleanses without stripping, leaving the complexion feeling soft, smooth, and comfortably moisturized after every use.",
    details: [
      "Creamy milk texture for gentle cleansing",
      "Removes makeup and impurities without stripping",
      "Nourishing formula maintains skin hydration",
      "Perfect for dry, sensitive, and normal skin",
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
  "Face Toner": {
    description:
      "A hydration-boosting facial toner that goes beyond basic cleansing to deliver a surge of moisture and prep the skin for maximum absorption of subsequent skincare. It balances pH levels, minimizes pores, and leaves the skin feeling refreshed, toned, and radiant.",
    details: [
      "Balances skin pH and tightens pores",
      "Boosts hydration and preps for skincare absorption",
      "Removes residual impurities after cleansing",
      "Alcohol-free, gentle formula for daily use",
    ],
  },
  "CICA Cream": {
    description:
      "A restorative CICA cream infused with Centella Asiatica to accelerate skin recovery and strengthen the barrier. Its soothing formula calms inflammation, reduces redness, and provides deep hydration, making it essential for sensitive, reactive, or post-procedure skin.",
    details: [
      "Centella Asiatica formula for skin recovery",
      "Reduces redness and soothes inflammation",
      "Strengthens and restores the skin barrier",
      "Ideal for sensitive and post-procedure skin",
    ],
  },
  "Body Milk": {
    description:
      "A silky, fast-absorbing body milk that delivers all-day hydration and a beautifully smooth finish. Enriched with nourishing ingredients, it wraps the skin in lightweight moisture, leaving it feeling irresistibly soft, supple, and deeply conditioned from morning to night.",
    details: [
      "Lightweight, fast-absorbing body moisturizer",
      "Provides all-day hydration and softness",
      "Enriched with skin-nourishing ingredients",
      "Non-greasy formula for comfortable daily wear",
    ],
  },
  "Body Cream": {
    description:
      "A rich, heavy-texture body cream designed for intense moisture and long-lasting skin protection. Its deeply nourishing formula creates a protective barrier that seals in hydration, making it perfect for very dry skin that needs extra care and lasting comfort.",
    details: [
      "Heavy-texture cream for intense body moisture",
      "Creates a protective barrier against dryness",
      "Deeply nourishes and softens rough skin",
      "Long-lasting hydration for very dry skin",
    ],
  },
  "Body Wash": {
    description:
      "A gentle, hydrating body wash with a creamy lather that cleanses while maintaining the skin's natural moisture balance. Its soap-free, fragrance-free formula is ideal for sensitive skin, leaving the body feeling clean, soft, and refreshed without irritation or dryness.",
    details: [
      "Creamy lather for gentle, effective cleansing",
      "Maintains the skin's natural moisture balance",
      "Soap-free formula ideal for sensitive skin",
      "Leaves skin soft, refreshed, and hydrated",
    ],
  },
  "Hand Cream": {
    description:
      "A deeply moisturizing hand cream enriched with shea butter and nourishing oils to repair dry, cracked hands. Its fast-absorbing, non-greasy formula provides instant relief and long-lasting protection, keeping hands soft, smooth, and beautifully conditioned throughout the day.",
    details: [
      "Enriched with shea butter and nourishing oils",
      "Repairs dry, cracked, and rough hands",
      "Fast-absorbing, non-greasy formula",
      "Long-lasting moisture and protection",
    ],
  },
  "Lip Balm": {
    description:
      "A nourishing lip balm enriched with cocoa butter, honey, and panthenol to deeply hydrate and protect delicate lips. Its smooth, non-sticky formula shields against dryness and environmental damage while keeping lips soft, supple, and beautifully conditioned all day.",
    details: [
      "Enriched with cocoa butter and panthenol",
      "Deeply hydrates and protects delicate lips",
      "Smooth, non-sticky formula for comfortable wear",
      "SPF protection against sun damage",
    ],
  },
  "Lip Moisturizer": {
    description:
      "An advanced lip moisturizer designed to deliver deep, lasting hydration to dry, chapped lips. Its nourishing formula repairs and conditions the delicate lip skin, creating a smooth, supple surface that feels comfortable and looks naturally healthy with every application.",
    details: [
      "Deep hydration for dry, chapped lips",
      "Repairs and conditions delicate lip skin",
      "Smooth, non-sticky application",
      "Daily essential for healthy, supple lips",
    ],
  },
  "Nail Care": {
    description:
      "A professional nail care treatment infused with natural oils, biotin, keratin, and hyaluronic acid to strengthen, nourish, and protect nails and cuticles. It helps prevent dry, brittle, and damaged nails, promoting healthier, stronger nails with a natural, lustrous shine.",
    details: [
      "Infused with biotin, keratin, and natural oils",
      "Strengthens and nourishes nails and cuticles",
      "Prevents dry, brittle, and damaged nails",
      "Promotes healthy growth with natural shine",
    ],
  },
  "Roll-On Deodorant": {
    description:
      "A gentle hydrating roll-on deodorant that provides long-lasting freshness and odor protection. Its skin-friendly, fragrance-free formula glides on smoothly, keeping you dry and confident throughout the day without irritation, staining, or compromising the skin's natural balance.",
    details: [
      "Long-lasting freshness and odor protection",
      "Gentle, skin-friendly formula",
      "Smooth roll-on application, quick-drying",
      "Free from harsh ingredients and irritants",
    ],
  },
  "Makeup Remover": {
    description:
      "A hydrating makeup remover that gently dissolves and lifts away all traces of makeup, including waterproof formulas, without tugging or irritating the skin. Its moisturizing formula leaves the skin feeling clean, soft, and comfortably hydrated after every use.",
    details: [
      "Gently removes all makeup including waterproof",
      "No tugging or irritation on delicate skin",
      "Moisturizing formula prevents post-cleanse dryness",
      "Suitable for all skin types including sensitive",
    ],
  },
  "Feminine Cleanser": {
    description:
      "A gentle intimate feminine cleanser specially formulated with a balanced pH to cleanse and protect the delicate intimate area. Its soothing, hypoallergenic formula maintains the natural flora while providing freshness and comfort throughout the day.",
    details: [
      "pH-balanced formula for intimate care",
      "Gentle, hypoallergenic cleansing action",
      "Maintains natural protective flora",
      "Provides lasting freshness and comfort",
    ],
  },
  "Rejuvenation Cream": {
    description:
      "An anti-aging rejuvenation cream formulated to restore the skin's youthful vitality. Enriched with vitamins and antioxidants, it deeply moisturizes, improves elasticity, and reduces the appearance of fine lines, leaving the skin looking firmer, smoother, and more radiant.",
    details: [
      "Anti-aging formula with vitamins and antioxidants",
      "Improves skin elasticity and firmness",
      "Reduces the appearance of fine lines",
      "Deeply moisturizes for a radiant, youthful glow",
    ],
  },
  "Dry Skin Cream": {
    description:
      "A fragrance-free intensive cream specifically designed for dry facial skin. Its rich, protective formula delivers deep, lasting moisture while strengthening the skin barrier, providing immediate comfort and long-term relief for chronically dry, tight, and dehydrated complexions.",
    details: [
      "Fragrance-free formula for sensitive dry skin",
      "Delivers deep, lasting facial hydration",
      "Strengthens the skin's natural moisture barrier",
      "Immediate comfort for tight, dehydrated skin",
    ],
  },
  "Oily Matte Cream": {
    description:
      "A mattifying cream-gel designed specifically for oily face skin. It provides essential hydration while controlling excess sebum and shine, leaving a fresh, matte finish that lasts. Perfect as a makeup base or standalone moisturizer for oily and combination skin types.",
    details: [
      "Mattifying formula controls excess oil and shine",
      "Lightweight hydration without greasiness",
      "Long-lasting matte finish throughout the day",
      "Perfect as a makeup base for oily skin",
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
  "Sunscreen Lotion": {
    description:
      "A nourishing sunscreen lotion with broad-spectrum SPF50+ protection suitable for all skin types. Its moisturizing formula shields the skin from harmful UV rays while keeping it hydrated, smooth, and comfortable. Ideal for daily use on face and body throughout the year.",
    details: [
      "Broad-spectrum SPF50+ for full UV protection",
      "Moisturizing lotion formula for all skin types",
      "Hydrates while protecting from sun damage",
      "Suitable for daily face and body application",
    ],
  },
  "SPF Fluid": {
    description:
      "An ultra-light SPF50+ fluid sunscreen with broad-spectrum protection against UVB, UVA, blue light, and infrared radiation. Its fluid texture absorbs instantly with zero white cast, making it ideal for daily wear under makeup on all skin types, including sensitive and acne-prone.",
    details: [
      "SPF50+ broad-spectrum with blue light protection",
      "Ultra-light fluid with zero white cast",
      "Prevents sun spots, aging, and erythema",
      "Suitable for all skin types including sensitive",
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
  "Body Oil": {
    description:
      "A luxurious body oil with natural emollient ingredients that deeply nourish, soothe, and repair the skin. It absorbs quickly without leaving greasy residue, making it ideal for dry, eczema-prone, or post-procedure skin. Leaves the body feeling silky smooth with a healthy glow.",
    details: [
      "Natural emollients for deep skin nourishment",
      "Fast-absorbing, non-greasy formula",
      "Soothes eczema-prone and post-procedure skin",
      "Leaves skin silky smooth with healthy glow",
    ],
  },
  "Whitening Cream": {
    description:
      "An advanced skin-brightening cream formulated to reduce the appearance of dark spots, uneven tone, and hyperpigmentation. Powered by clinically proven whitening actives, it works gradually to reveal a more radiant, luminous, and evenly toned complexion with daily use.",
    details: [
      "Targets dark spots and uneven skin tone",
      "Contains clinically proven brightening actives",
      "Lightweight texture absorbs quickly into skin",
      "Safe for daily use with visible results over time",
    ],
  },
  "Whitening Emulsion": {
    description:
      "A brightening emulsion with natural whitening ingredients that provide skin radiance and boost luminosity. It helps prevent dark spots by inhibiting melanin synthesis, unifies skin tone, and improves moisture levels for a brighter, more even complexion across face and body.",
    details: [
      "Natural brightening ingredients boost radiance",
      "Inhibits melanin synthesis to prevent dark spots",
      "Unifies skin tone and improves moisture levels",
      "Suitable for face, body, and sensitive areas",
    ],
  },
  "Whitening Night Cream": {
    description:
      "An overnight whitening cream that works while you sleep to brighten, even out, and rejuvenate the skin. Its concentrated night-active formula targets hyperpigmentation, dark spots, and dullness, so you wake up to a visibly more radiant, rested, and luminous complexion.",
    details: [
      "Night-active formula works while you sleep",
      "Targets hyperpigmentation and dark spots",
      "Brightens and evens skin tone overnight",
      "Wake up to radiant, rejuvenated skin",
    ],
  },
  "Whitening Day Cream": {
    description:
      "A daily whitening cream that brightens and evens skin tone while providing essential daytime hydration and protection. Its lightweight formula absorbs quickly, creating the perfect canvas for makeup while continuously working to reduce dark spots and enhance natural radiance.",
    details: [
      "Brightens and evens skin tone throughout the day",
      "Lightweight formula perfect under makeup",
      "Provides essential daytime hydration",
      "Gradually reduces dark spots and dullness",
    ],
  },
  "Whitening Gel Cleanser": {
    description:
      "A brightening gel cleanser that gently removes impurities while working to even out skin tone. Its lightweight gel formula lathers into a soft foam, cleansing deeply without stripping moisture, and leaving the skin feeling fresh, bright, and ready for your whitening routine.",
    details: [
      "Gel formula with brightening action",
      "Gently removes impurities without stripping",
      "Helps even out skin tone with regular use",
      "Perfect first step in a whitening routine",
    ],
  },
  "Whitening Sensitive Zone Cream": {
    description:
      "A specialized whitening cream formulated for sensitive and intimate areas including underarms, bikini line, inner thighs, and elbows. Its gentle yet effective formula brightens dark areas without irritation, gradually revealing a more even, luminous skin tone in delicate zones.",
    details: [
      "Specially formulated for sensitive body areas",
      "Gentle brightening without irritation",
      "Targets underarms, inner thighs, and elbows",
      "Gradual, visible results with daily use",
    ],
  },
  "Whitening Sensitive Zone Foam": {
    description:
      "A gentle foaming cleanser designed specifically for intimate and sensitive area hygiene with brightening benefits. Its mild, pH-balanced formula cleanses delicately while working to even out skin tone, leaving sensitive areas feeling fresh, clean, and gradually brighter.",
    details: [
      "pH-balanced foam for sensitive area cleansing",
      "Gentle brightening action for intimate zones",
      "Mild, non-irritating formula",
      "Leaves skin fresh, clean, and comfortable",
    ],
  },
  "Whitening Deodorant": {
    description:
      "A whitening deodorant that provides long-lasting freshness and odor protection while gradually brightening the underarm area. Its gentle, skin-friendly formula glides on smoothly, keeping you dry and confident throughout the day without irritation or dark discoloration.",
    details: [
      "Dual-action: deodorant with whitening benefits",
      "Long-lasting freshness and odor protection",
      "Gentle formula prevents underarm darkening",
      "Smooth application, quick-drying finish",
    ],
  },
  "Whitening Body Lotion": {
    description:
      "A brightening body lotion that combines deep hydration with skin-evening benefits for the entire body. Its nourishing formula moisturizes while gradually reducing dark spots and uneven tone, leaving the skin feeling soft, smooth, and visibly more luminous from head to toe.",
    details: [
      "Hydrating body lotion with brightening action",
      "Gradually reduces dark spots and uneven tone",
      "Nourishing formula for all-over body care",
      "Leaves skin soft, smooth, and luminous",
    ],
  },
  "Knee Elbow Cream": {
    description:
      "A targeted treatment cream designed to smooth and brighten rough, darkened skin on knees, elbows, and other high-friction areas. Its exfoliating and moisturizing formula gently removes dead cells while nourishing the skin, revealing softer, smoother, and more even-toned skin.",
    details: [
      "Targets rough, darkened knees and elbows",
      "Exfoliates dead cells and smooths skin texture",
      "Moisturizes and brightens high-friction areas",
      "Visible improvement with consistent use",
    ],
  },
  "Foundation": {
    description:
      "A medical-cosmetic foundation that combines makeup, skincare, and sun protection in one step. It provides high coverage with a natural finish while keeping the skin hydrated, smooth, and comfortable. Water and sweat resistant, easy to blend, and suitable for all skin types.",
    details: [
      "High coverage with a natural, skin-like finish",
      "Combines makeup, skincare, and sun protection",
      "Water and sweat resistant formula",
      "Enriched with hyaluronic acid and niacinamide",
    ],
  },
  // ── HAIR CARE ──────────────────────────────
  "Hair Shampoo": {
    description:
      "A professional-grade shampoo formulated with strengthening actives to cleanse, repair, and fortify damaged hair. It gently removes buildup while restoring hair's natural strength, elasticity, and shine, leaving it feeling clean, bouncy, and visibly healthier after every wash.",
    details: [
      "Strengthening formula for damaged and thin hair",
      "Gently cleanses without stripping natural oils",
      "Restores strength, elasticity, and shine",
      "Suitable for all hair types",
    ],
  },
  "Hair Conditioner": {
    description:
      "A deeply restorative hair conditioner that detangles, softens, and protects hair from daily damage. It smooths the cuticle, locks in moisture, and reduces breakage, leaving hair feeling silky, manageable, and protected from root to tip after every use.",
    details: [
      "Deep restoration and detangling action",
      "Smooths cuticles and locks in moisture",
      "Reduces breakage and split ends",
      "Leaves hair silky, manageable, and protected",
    ],
  },
  "Hair Mask": {
    description:
      "An intensive hair mask therapy designed for deep repair and restoration of damaged, dry, and brittle hair. Its rich, concentrated formula penetrates the hair shaft to rebuild strength, restore moisture, and add brilliant shine, transforming hair texture in just one treatment.",
    details: [
      "Intensive therapy for damaged and brittle hair",
      "Penetrates deep to rebuild hair strength",
      "Restores moisture and adds brilliant shine",
      "Visible transformation after one treatment",
    ],
  },
  "Hair Serum": {
    description:
      "A lightweight hair serum that tames frizz, adds brilliant shine, and protects against heat damage. It smooths the hair cuticle, sealing in moisture and nutrients for sleek, manageable, and healthy-looking hair that stays salon-fresh between visits.",
    details: [
      "Tames frizz and flyaways instantly",
      "Adds brilliant shine without weighing hair down",
      "Provides heat protection for styling tools",
      "Seals moisture for smoother, healthier hair",
    ],
  },
  "Hair Leave-In Cream": {
    description:
      "A restorative leave-in cream that detangles, moisturizes, and strengthens hair without rinsing. Enriched with nourishing actives, it reduces hair loss, nourishes follicles, and gives hair a healthy, extra-shiny look while protecting against environmental damage throughout the day.",
    details: [
      "No-rinse formula for continuous nourishment",
      "Detangles and moisturizes all hair types",
      "Reduces hair loss and strengthens follicles",
      "Adds shine and protects against damage",
    ],
  },
  "Hair Water": {
    description:
      "A styling hair water that gives your hair instant smoothness, extra shine, and a healthier, sleeker appearance. Powered by natural keratin and vitamins, it enables effortless styling while nourishing the hair, making it an essential tool for a polished, salon-quality finish.",
    details: [
      "Instant smoothness and extra shine",
      "Powered by natural keratin and vitamins",
      "Enables easy, effortless hair styling",
      "Gives a healthier, sleeker appearance",
    ],
  },
  "Hair Mist": {
    description:
      "A refreshing hair mist that provides a floral fresh scent while hydrating and styling your hair. Its lightweight formula keeps hair smelling beautiful and feeling moisturized throughout the day, making it the perfect finishing touch to any hair routine.",
    details: [
      "Fresh, long-lasting floral fragrance for hair",
      "Hydrates and conditions while scenting",
      "Lightweight, non-weighing formula",
      "Perfect finishing touch for styled hair",
    ],
  },
  "Hair Mist SPF": {
    description:
      "A protective hair mist with SPF50 that shields hair from UV damage while adding shine and fragrance. Its innovative formula protects color-treated and natural hair from sun-induced dryness, fading, and damage, keeping hair healthy, vibrant, and beautifully scented.",
    details: [
      "SPF50 protection against UV hair damage",
      "Prevents sun-induced fading and dryness",
      "Adds shine and a fresh fragrance",
      "Ideal for color-treated and natural hair",
    ],
  },
  "Hair Fresh Scalp": {
    description:
      "A deep-cleansing scalp scrub that removes product buildup, excess oil, and impurities from the scalp. Infused with purifying actives, it refreshes and rebalances the scalp environment, promoting healthier hair growth and leaving the scalp feeling clean, invigorated, and revitalized.",
    details: [
      "Deep-cleansing scrub for scalp detox",
      "Removes buildup, oil, and impurities",
      "Refreshes and rebalances scalp health",
      "Promotes healthier, stronger hair growth",
    ],
  },
  "Fresh Scalp Spray": {
    description:
      "A refreshing scalp spray that targets dandruff, flakes, and buildup while keeping the scalp clean and balanced. Its targeted formula delivers active ingredients directly to the scalp, soothing irritation and promoting a healthier scalp environment for stronger hair growth.",
    details: [
      "Targets dandruff, flakes, and scalp buildup",
      "Spray delivery for precise scalp application",
      "Soothes irritation and promotes scalp health",
      "Leaves scalp feeling clean and refreshed",
    ],
  },
  "Antidandruff Shampoo": {
    description:
      "An effective anti-dandruff shampoo that combats flakes, itching, and scalp buildup while gently cleansing. Its active formula targets the root cause of dandruff while maintaining the hair's natural moisture, leaving both scalp and hair feeling clean, healthy, and flake-free.",
    details: [
      "Effectively combats dandruff and flakes",
      "Soothes itching and scalp irritation",
      "Gentle cleansing maintains hair moisture",
      "Regular use for a healthy, flake-free scalp",
    ],
  },
  "Hair Booster Shot": {
    description:
      "A concentrated hair booster serum designed for intensive hair fall control and repair. Its potent formula delivers a powerful blend of actives directly to hair follicles, stimulating growth, strengthening roots, and reversing damage for visibly thicker, fuller, and healthier hair.",
    details: [
      "Concentrated formula for intensive hair repair",
      "Stimulates growth and strengthens hair roots",
      "Controls hair fall with potent active ingredients",
      "Visible results with consistent daily use",
    ],
  },
  "Hair Fall Control Spray": {
    description:
      "A targeted hair fall control spray that reduces shedding and strengthens hair from root to tip. Its lightweight, non-greasy formula is applied directly to the scalp, delivering active ingredients that fortify follicles and promote a fuller, thicker head of hair over time.",
    details: [
      "Reduces hair shedding and thinning",
      "Strengthens hair from root to tip",
      "Lightweight spray for easy scalp application",
      "Promotes fuller, thicker hair growth",
    ],
  },
  "Hair Growth Spray": {
    description:
      "A scientifically formulated hair growth accelerator spray that stimulates the hair growth cycle and reduces hair fall. It activates the early anagen phase, promoting faster, healthier growth while nourishing the scalp for optimal follicle performance and visible density improvement.",
    details: [
      "Accelerates the natural hair growth cycle",
      "Stimulates early anagen phase for faster growth",
      "Reduces hair fall and improves density",
      "Nourishes scalp for optimal follicle health",
    ],
  },
  "Hair Leave-In Conditioner": {
    description:
      "A lightweight leave-in conditioner that provides ongoing moisture, detangling, and protection without weighing hair down. Its nourishing formula smooths the cuticle, reduces frizz, and shields against heat and environmental damage, keeping hair soft, manageable, and healthy all day.",
    details: [
      "Ongoing moisture and detangling without rinsing",
      "Smooths cuticles and reduces frizz",
      "Protects against heat and environmental damage",
      "Lightweight formula for all hair types",
    ],
  },
  "Hair Cream": {
    description:
      "A nourishing hair cream that deeply conditions, strengthens, and promotes growth. Its anti-hair-loss formula rejuvenates follicles, repairs damaged bonds, and protects the hair's natural color, making it an essential daily treatment for stronger, healthier, and more vibrant hair.",
    details: [
      "Anti-hair-loss formula with growth stimulation",
      "Repairs damaged bonds and strengthens hair",
      "Rejuvenates follicles and protects natural color",
      "Suitable for daily use on all hair types",
    ],
  },
  "Hair Oil": {
    description:
      "A luxurious hair oil elixir infused with botanical oils to nourish, strengthen, and add luminous shine. It penetrates the hair shaft to repair damage and prevent split ends, while taming frizz and leaving hair feeling silky, smooth, and deeply conditioned.",
    details: [
      "Infused with natural nourishing botanical oils",
      "Repairs damage and prevents split ends",
      "Adds luminous shine without greasy residue",
      "Lightweight formula suitable for all hair types",
    ],
  },
  "Hair Tonic Spray": {
    description:
      "A revitalizing hair tonic spray formulated to stimulate the scalp, strengthen hair follicles, and increase hair density. Its spray format delivers active ingredients directly to the scalp for easy, even application, promoting healthier, thicker hair growth with consistent daily use.",
    details: [
      "Stimulates scalp and strengthens follicles",
      "Increases hair density and thickness",
      "Easy spray application for even coverage",
      "Promotes healthier hair growth over time",
    ],
  },
  "Hair Vials": {
    description:
      "A professional-grade anti-hair-loss vial treatment with a revolutionary complex formula. These concentrated ampoules deliver potent actives directly to the scalp to combat thinning, nourish follicles, and stimulate blood circulation for visibly fuller, thicker, and healthier hair.",
    details: [
      "Concentrated ampoule treatment for hair loss",
      "Revolutionary complex formula with potent actives",
      "Nourishes follicles and stimulates circulation",
      "For both men and women experiencing thinning",
    ],
  },
  "Lashes Serum": {
    description:
      "An advanced lash and brow treatment serum that promotes fuller, longer, and thicker-looking lashes and brows. Its concentrated formula delivers essential nutrients to follicles, stimulating natural growth and reducing fallout for beautifully defined, healthy lashes and eyebrows.",
    details: [
      "Promotes fuller, longer-looking lashes and brows",
      "Concentrated nutrients stimulate natural growth",
      "Reduces lash and brow fallout",
      "Precision applicator for targeted treatment",
    ],
  },
  "Extreme Lashes Serum": {
    description:
      "A high-performance lash serum formulated with potent growth-stimulating actives to dramatically enhance lash length, volume, and density. Its precision applicator delivers concentrated nutrients directly to the lash line, promoting visibly fuller, healthier, and more dramatic lashes.",
    details: [
      "High-performance formula for dramatic lash growth",
      "Enhances length, volume, and density",
      "Precision applicator for lash line targeting",
      "Visible results with consistent nightly use",
    ],
  },
};

// ══════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════

const products = [
  // ┌─────────────────────────────────────────┐
  // │  MOIST-1 (Purex Health Care)            │
  // └─────────────────────────────────────────┘
  { name: "Moist-1 Cream", brand: "Moist-1", category: "skin-care", templateKey: "Moisturizing Cream", price: 180, oldPrice: null },
  { name: "Moist-1 with Urea", brand: "Moist-1", category: "skin-care", templateKey: "Urea Cream", price: 170, oldPrice: null },
  { name: "Moist-1 Milky Cleanser", brand: "Moist-1", category: "skin-care", templateKey: "Milky Cleanser", price: 210, oldPrice: null },
  { name: "Moist-1 Hyaluronic Acid Serum", brand: "Moist-1", category: "skin-care", templateKey: "Face Serum", price: 250, oldPrice: null },
  { name: "Moist-1 Centella Serum", brand: "Moist-1", category: "skin-care", templateKey: "Face Serum", price: 250, oldPrice: null },
  { name: "Moist-1 Cica Cream", brand: "Moist-1", category: "skin-care", templateKey: "CICA Cream", price: 165, oldPrice: null },
  { name: "Moist-1 Body Milk", brand: "Moist-1", category: "skin-care", templateKey: "Body Milk", price: 300, oldPrice: null },
  { name: "Moist-1 Toner", brand: "Moist-1", category: "skin-care", templateKey: "Face Toner", price: 200, oldPrice: null },
  { name: "Moist-1 Cream Gel", brand: "Moist-1", category: "skin-care", templateKey: "Cream Gel", price: 220, oldPrice: null },
  { name: "Moist-1 Hydrating Foam Cleanser", brand: "Moist-1", category: "skin-care", templateKey: "Foam Cleanser", price: 225, oldPrice: null },
  { name: "Moist-1 Hand Cream", brand: "Moist-1", category: "skin-care", templateKey: "Hand Cream", price: 120, oldPrice: null },
  { name: "Moist-1 Lip Moisturizer", brand: "Moist-1", category: "skin-care", templateKey: "Lip Moisturizer", price: 85, oldPrice: null },

  // ┌─────────────────────────────────────────┐
  // │  LEYLAK (BS Derma)                      │
  // └─────────────────────────────────────────┘
  { name: "Leylak Moisturizing Gel 50 ML", brand: "Leylak", category: "skin-care", templateKey: "Moisturizing Gel", price: 150, oldPrice: null },
  { name: "Leylak Moisturizing Gel 100 ML", brand: "Leylak", category: "skin-care", templateKey: "Moisturizing Gel", price: 250, oldPrice: null },
  { name: "Leylak Cleansing Gel", brand: "Leylak", category: "skin-care", templateKey: "Facial Cleanser", price: 250, oldPrice: null },
  { name: "Leylak Body Oil", brand: "Leylak", category: "skin-care", templateKey: "Body Oil", price: 250, oldPrice: null },
  { name: "Leylak SPF 50+ Fluid", brand: "Leylak", category: "skin-care", templateKey: "SPF Fluid", price: 350, oldPrice: null },
  { name: "Leylak Eye Contour Cream", brand: "Leylak", category: "skin-care", templateKey: "Eye Contour", price: 250, oldPrice: null },
  { name: "Leylak Eye Contour Gel", brand: "Leylak", category: "skin-care", templateKey: "Eye Contour", price: 250, oldPrice: null },
  { name: "Leylak Whitening Emulsion", brand: "Leylak", category: "skin-care", templateKey: "Whitening Emulsion", price: 250, oldPrice: null },
  { name: "Leylak Hyaluronic Acid & Vitamin C Serum", brand: "Leylak", category: "skin-care", templateKey: "Face Serum", price: 250, oldPrice: null },
  { name: "Leylak Urea Cream", brand: "Leylak", category: "skin-care", templateKey: "Urea Cream", price: 250, oldPrice: null },
  { name: "Leylak Foundation", brand: "Leylak", category: "skin-care", templateKey: "Foundation", price: 350, oldPrice: null },

  // ┌─────────────────────────────────────────┐
  // │  SHAAN (Parkville)                      │
  // └─────────────────────────────────────────┘
  { name: "Shaan Antioxidant Facial Cleanser 250 ml", brand: "Shaan", category: "skin-care", templateKey: "Facial Cleanser", price: 175, oldPrice: null },
  { name: "Shaan Soothing Gel 60 gm", brand: "Shaan", category: "skin-care", templateKey: "Moisturizing Gel", price: 100, oldPrice: null },
  { name: "Shaan Soothing Gel 120 gm", brand: "Shaan", category: "skin-care", templateKey: "Moisturizing Gel", price: 170, oldPrice: null },
  { name: "Shaan Soothing Gel 200 gm", brand: "Shaan", category: "skin-care", templateKey: "Moisturizing Gel", price: 240, oldPrice: null },
  { name: "Shaan Rejuvenation Cream 120 gm", brand: "Shaan", category: "skin-care", templateKey: "Rejuvenation Cream", price: 150, oldPrice: null },
  { name: "Shaan CICA Cream 60 ml", brand: "Shaan", category: "skin-care", templateKey: "CICA Cream", price: 200, oldPrice: null },
  { name: "Shaan CICA ARNICA+ Cream 40 gm", brand: "Shaan", category: "skin-care", templateKey: "CICA Cream", price: 250, oldPrice: null },
  { name: "Shaan Oily Matte Cream-Gel 60 gm", brand: "Shaan", category: "skin-care", templateKey: "Oily Matte Cream", price: 229, oldPrice: null },
  { name: "Shaan Dry S Cream Fragrance Free", brand: "Shaan", category: "skin-care", templateKey: "Dry Skin Cream", price: 200, oldPrice: null },
  { name: "Shaan Hydrating Makeup Remover 100 ml", brand: "Shaan", category: "skin-care", templateKey: "Makeup Remover", price: 130, oldPrice: null, stock: 0 },
  { name: "Shaan Hand Cream 60 gm", brand: "Shaan", category: "skin-care", templateKey: "Hand Cream", price: 100, oldPrice: null },
  { name: "Shaan Nail Care 4 ml", brand: "Shaan", category: "skin-care", templateKey: "Nail Care", price: 160, oldPrice: null },
  { name: "Shaan Lip Balm Cherry 5 gm", brand: "Shaan", category: "skin-care", templateKey: "Lip Balm", price: 100, oldPrice: null },
  { name: "Shaan Lip Balm Strawberry 5 gm", brand: "Shaan", category: "skin-care", templateKey: "Lip Balm", price: 100, oldPrice: null },
  { name: "Shaan Lip Balm SPF 30 5 gm", brand: "Shaan", category: "skin-care", templateKey: "Lip Balm", price: 100, oldPrice: null },
  { name: "Shaan Lip Balm Rose 5 gm", brand: "Shaan", category: "skin-care", templateKey: "Lip Balm", price: 100, oldPrice: null },
  { name: "Shaan Hydrating Roll On Fragrance Free 60 ml", brand: "Shaan", category: "skin-care", templateKey: "Roll-On Deodorant", price: 250, oldPrice: null },
  { name: "Shaan Body Milk 300 ml", brand: "Shaan", category: "skin-care", templateKey: "Body Milk", price: 230, oldPrice: null },
  { name: "Shaan Body Milk Vanilla Coconut 300 ml", brand: "Shaan", category: "skin-care", templateKey: "Body Milk", price: 250, oldPrice: null },
  { name: "Shaan Body Milk Tulip Rose 300 ml", brand: "Shaan", category: "skin-care", templateKey: "Body Milk", price: 250, oldPrice: null },
  { name: "Shaan Body Cream 470 gm", brand: "Shaan", category: "skin-care", templateKey: "Body Cream", price: 425, oldPrice: null },
  { name: "Shaan Hydrating Body Wash 480 ml", brand: "Shaan", category: "skin-care", templateKey: "Body Wash", price: 250, oldPrice: null },
  { name: "Shaan Tulip Rose Hydrating Body Wash 480 ml", brand: "Shaan", category: "skin-care", templateKey: "Body Wash", price: 260, oldPrice: null },
  { name: "Shaan Vanilla Coconut Hydrating Body Wash 480 ml", brand: "Shaan", category: "skin-care", templateKey: "Body Wash", price: 260, oldPrice: null },
  { name: "Shaan Urea 10% Body Moisturizer 200 gm", brand: "Shaan", category: "skin-care", templateKey: "Urea Cream", price: 280, oldPrice: null },
  { name: "Shaan Urea 30% Cream", brand: "Shaan", category: "skin-care", templateKey: "Urea Cream", price: 320, oldPrice: null },
  { name: "Shaan Intimate Feminine Cleanser 250 ml", brand: "Shaan", category: "skin-care", templateKey: "Feminine Cleanser", price: 160, oldPrice: null },

  // ┌─────────────────────────────────────────┐
  // │  CLARY (Parkville) — Hair Care          │
  // └─────────────────────────────────────────┘
  { name: "Clary Hair Mask 300 ml", brand: "Clary", category: "hair-care", templateKey: "Hair Mask", price: 380, oldPrice: null },
  { name: "Clary Hair Shampoo 300 ml", brand: "Clary", category: "hair-care", templateKey: "Hair Shampoo", price: 330, oldPrice: null },
  { name: "Clary Serum 100 ml", brand: "Clary", category: "hair-care", templateKey: "Hair Serum", price: 375, oldPrice: null },
  { name: "Clary Hair Conditioner 300 ml", brand: "Clary", category: "hair-care", templateKey: "Hair Conditioner", price: 345, oldPrice: null },
  { name: "Clary Hair Fresh Scalp 300 ml", brand: "Clary", category: "hair-care", templateKey: "Hair Fresh Scalp", price: 390, oldPrice: null },
  { name: "Clary Hair Leave In Cream 300 gm", brand: "Clary", category: "hair-care", templateKey: "Hair Leave-In Cream", price: 340, oldPrice: null },
  { name: "Clary Hair Water 200 ml", brand: "Clary", category: "hair-care", templateKey: "Hair Water", price: 300, oldPrice: null },
  { name: "Clary Hair Mist SPF50 120 ml", brand: "Clary", category: "hair-care", templateKey: "Hair Mist SPF", price: 320, oldPrice: null },
  { name: "Clary Hair Mist 200 ml", brand: "Clary", category: "hair-care", templateKey: "Hair Mist", price: 200, oldPrice: null },
  { name: "Clary Hair Booster Shot 30 ml", brand: "Clary", category: "hair-care", templateKey: "Hair Booster Shot", price: 500, oldPrice: null },
  { name: "Clary Antidandruff Shampoo 300 ml", brand: "Clary", category: "hair-care", templateKey: "Antidandruff Shampoo", price: 320, oldPrice: null },
  { name: "Clary Hair Fall Control Spray 200 ml", brand: "Clary", category: "hair-care", templateKey: "Hair Fall Control Spray", price: 450, oldPrice: null },
  { name: "Clary Fresh Scalp Spray", brand: "Clary", category: "hair-care", templateKey: "Fresh Scalp Spray", price: 320, oldPrice: null },

  // ┌─────────────────────────────────────────┐
  // │  SEROPIPE (Parkville) — Hair Care       │
  // └─────────────────────────────────────────┘
  { name: "Seropipe Intense Nutrition Hair Shampoo 300 ml", brand: "Seropipe", category: "hair-care", templateKey: "Hair Shampoo", price: 265, oldPrice: null },
  { name: "Seropipe Hair Conditioner 300 ml", brand: "Seropipe", category: "hair-care", templateKey: "Hair Conditioner", price: 265, oldPrice: null },
  { name: "Seropipe Hair Growth Accelerator Spray 200 ml", brand: "Seropipe", category: "hair-care", templateKey: "Hair Growth Spray", price: 265, oldPrice: null },
  { name: "Seropipe Hair Mask 300 ml", brand: "Seropipe", category: "hair-care", templateKey: "Hair Mask", price: 310, oldPrice: null },
  { name: "Seropipe Hair Serum 100 ml", brand: "Seropipe", category: "hair-care", templateKey: "Hair Serum", price: 320, oldPrice: null },
  { name: "Seropipe Hair Leave In Conditioner 200 ml", brand: "Seropipe", category: "hair-care", templateKey: "Hair Leave-In Conditioner", price: 295, oldPrice: null },
  { name: "Seropipe Extreme Lashes Serum", brand: "Seropipe", category: "hair-care", templateKey: "Extreme Lashes Serum", price: 295, oldPrice: null },

  // ┌─────────────────────────────────────────┐
  // │  CAPIXY — Hair Care                     │
  // └─────────────────────────────────────────┘
  { name: "Capixy Cream 120 ml", brand: "Capixy", category: "hair-care", templateKey: "Hair Cream", price: 320, oldPrice: null },
  { name: "Capixy Hair Shampoo 250 ml", brand: "Capixy", category: "hair-care", templateKey: "Hair Shampoo", price: 240, oldPrice: null },
  { name: "Capixy Hair Serum 120 ml", brand: "Capixy", category: "hair-care", templateKey: "Hair Serum", price: 400, oldPrice: null },
  { name: "Capixy Hair Oil Elixir 30 ml", brand: "Capixy", category: "hair-care", templateKey: "Hair Oil", price: 450, oldPrice: null },
  { name: "Capixy Hair Mask 250 ml", brand: "Capixy", category: "hair-care", templateKey: "Hair Mask", price: 350, oldPrice: null },
  { name: "Capixy Hair Hydrating Conditioner 250 ml", brand: "Capixy", category: "hair-care", templateKey: "Hair Conditioner", price: 240, oldPrice: null },
  { name: "Capixy Intense Tonic Spray 125 ml", brand: "Capixy", category: "hair-care", templateKey: "Hair Tonic Spray", price: 550, oldPrice: null },
  { name: "Capixy Anti Hair Loss Vials 70 ml", brand: "Capixy", category: "hair-care", templateKey: "Hair Vials", price: 850, oldPrice: null },
  { name: "Capixy Lashes Treatment Serum 10 ml", brand: "Capixy", category: "hair-care", templateKey: "Lashes Serum", price: 550, oldPrice: null },

  // ┌─────────────────────────────────────────┐
  // │  TETRA GLOW (Maqam Cosmetics)           │
  // └─────────────────────────────────────────┘
  { name: "Tetra Glow Sensitive Zone Whitening Cream 50 gm", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Sensitive Zone Cream", price: 345, oldPrice: null },
  { name: "Tetra Glow Sensitive Zone Whitening Foam 200 ml", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Sensitive Zone Foam", price: 240, oldPrice: null },
  { name: "Tetra Glow Whitening Night Cream 30 gm", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Night Cream", price: 335, oldPrice: null },
  { name: "Tetra Glow Whitening Gel Cleanser 200 ml", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Gel Cleanser", price: 220, oldPrice: null },
  { name: "Tetra Glow Whitening Day Cream 50 gm", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Day Cream", price: 350, oldPrice: null },
  { name: "Tetra Glow Whitening Day Cream SPF 30 50 gm", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Day Cream", price: 350, oldPrice: null },
  { name: "Tetra Glow Whitening Deodorant Crazy Love 50 ml", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Deodorant", price: 275, oldPrice: null },
  { name: "Tetra Glow Whitening Deodorant Unscented 50 ml", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Deodorant", price: 275, oldPrice: null },
  { name: "Tetra Glow Whitening Deodorant Escape 50 ml", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Deodorant", price: 275, oldPrice: null },
  { name: "Tetra Glow Whitening Deodorant Oxygen Bubbles 50 ml", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Deodorant", price: 275, oldPrice: null },
  { name: "Tetra Glow Sunscreen Gel SPF50 50 ml", brand: "Tetra Glow", category: "skin-care", templateKey: "Sunscreen Gel", price: 580, oldPrice: null },
  { name: "Tetra Glow Sunscreen Lotion SPF50+ 100 ml", brand: "Tetra Glow", category: "skin-care", templateKey: "Sunscreen Lotion", price: 400, oldPrice: null },
  { name: "Tetra Glow Knee And Elbow Rough Area Cream", brand: "Tetra Glow", category: "skin-care", templateKey: "Knee Elbow Cream", price: 260, oldPrice: null },
  { name: "Tetra Glow Whitening Body Lotion 200 gm", brand: "Tetra Glow", category: "skin-care", templateKey: "Whitening Body Lotion", price: 310, oldPrice: null },
];

// ══════════════════════════════════════════════
// DEFAULTS
// ══════════════════════════════════════════════

const DEFAULTS = {
  emoji: "✨",
  badge: null,
  stock: 100,
  lowStockThreshold: 10,
  rating: 0,
  reviewCount: 0,
  active: true,
};

// ══════════════════════════════════════════════
// SKU GENERATOR (replicated from backend/controllers/mysql/productController.js
// so the seed produces the same clean, sequential DD-XXX-### scheme). Queries
// fresh each call, so numbering stays correct as products are created one at a
// time within this run.
// ══════════════════════════════════════════════

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

// ══════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════

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
      console.log("Skipped: " + product.name);
      skipped++;
      continue;
    }

    const template = templates[product.templateKey];
    if (!template) {
      console.error("Missing template: " + product.templateKey + " for " + product.name);
      skipped++;
      continue;
    }

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

    console.log("Added: " + product.name + "  (" + sku + ")");
    added++;
  }

  console.log("");
  console.log("====================================");
  console.log("Added: " + added);
  console.log("Skipped: " + skipped);
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
