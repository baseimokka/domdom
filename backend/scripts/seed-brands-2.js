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
//   e.g. target 179 -> base 170.47 -> ceil(170.47 * 1.05) = ceil(178.99) = 179
const baseFor = (target) => Math.floor((target / (1 + MARKUP_RATE)) * 100) / 100;

const templates = {
  "Acne Cleansing Gel": { description: "A gentle cleansing gel formulated for combination to oily skin. It removes impurities and regulates sebum production without drying, leaving skin clean, fresh, and balanced. Its soap-free formula respects the skin's natural moisture barrier for comfortable daily use.", details: ["Gently cleanses without over-drying","Regulates sebum production for oily skin","Soap-free, pH-balanced formula","Ideal for daily use on acne-prone skin"] },
  "Hydra-Mattifying Gel": { description: "A hydra-mattifying gel designed for combination to oily skin. It moisturizes while controlling shine and ensuring a perfect matte finish throughout the day. Its lightweight texture works perfectly as a makeup base, leaving skin hydrated yet shine-free.", details: ["Hydrates oily skin while controlling shine","Long-lasting matte effect throughout the day","Lightweight, non-greasy texture","Can be used as a makeup base"] },
  "Acne Correcting Serum": { description: "A correcting serum for combination to oily skin that actively eliminates spots, blackheads, and minimizes large pores and acne marks. Its fresh, light texture offers considerable hydration without greasiness, leaving the skin clear, smooth, and glowing.", details: ["Targets spots, blackheads, and enlarged pores","Minimizes acne marks for clearer skin","Light, hydrating, non-greasy formula","Visible results on imperfections"] },
  "Acne Cream": { description: "A global acne cream gel highly concentrated in dermatological actives for visible results on imperfections, blackheads, and red or brown marks. Its light texture hydrates and soothes discomfort without leaving a greasy film or white cast on the skin.", details: ["Concentrated dermatological actives for acne","Targets imperfections and post-acne marks","Light, non-greasy gel-cream texture","Hydrates and soothes skin discomfort"] },
  "Brightening Foaming Gel": { description: "A brightening foaming gel cleanser that gently removes impurities while working to even out skin tone and reduce pigmentation. Its rich foam cleanses without stripping, prepping the skin for your brightening routine. Suitable for all skin types.", details: ["Gentle foaming action with brightening benefits","Helps even skin tone and reduce pigmentation","Cleanses without stripping natural moisture","Suitable for all skin types"] },
  "Brightening Serum": { description: "A radiance-enhancing brightening serum that corrects brown spots and hyperpigmentation on face, neck, décolleté, and hands. Its concentrated formula visibly reduces uneven tone, revealing a more luminous, even complexion with consistent daily application.", details: ["Targets brown spots and hyperpigmentation","For face, neck, décolleté, and hands","Concentrated brightening active ingredients","Visibly evens skin tone with daily use"] },
  "Depigmenting Cream": { description: "A depigmenting cream powered by gentle exfoliants and highly dosed active ingredients to limit the pigmentation process at its source. It eliminates existing spots and prevents their reappearance, suitable for all skin types and ages for a luminous, even complexion.", details: ["Limits pigmentation at its source","Eliminates spots and prevents recurrence","Gentle exfoliant with active depigmenting agents","Suitable for all skin types and ages"] },
  "Eye Contour Cream": { description: "A targeted eye contour treatment designed to address dark circles, puffiness, and fine lines around the delicate eye area. Its lightweight, fast-absorbing formula delivers concentrated actives to visibly brighten, firm, and smooth the under-eye zone.", details: ["Targets dark circles, puffiness, and fine lines","Lightweight formula for delicate eye area","Concentrated actives for visible improvement","Gentle enough for daily morning and night use"] },
  "Brightening Body Milk": { description: "A 2-in-1 brightening body milk that combines deep hydration with skin-evening benefits. Its nourishing formula moisturizes while gradually reducing dark spots and uneven tone across the body, leaving skin soft, smooth, and visibly more luminous.", details: ["Dual-action: hydration and brightening","Gradually reduces dark spots on body","Nourishing formula for all-over care","Leaves skin soft, smooth, and luminous"] },
  "SPF Fluid": { description: "An ultra-fluid SPF50+ sunscreen specifically designed for oily and sun-sensitive skin. It intensely protects while mattifying the skin with very high broad-spectrum protection against UVA/UVB through advanced filters ensuring long-lasting, photostable protection.", details: ["SPF50+ broad-spectrum UVA/UVB protection","Ultra-fluid mattifying texture for oily skin","Photostable and long-lasting protection","Water and sweat resistant formula"] },
  "SPF Fluid Tinted": { description: "A tinted ultra-fluid SPF50+ sunscreen that provides high sun protection with a natural, even-toned finish. Designed for sun-sensitive skin, it mattifies while adding a subtle tint that evens complexion, offering invisible protection that doubles as light coverage.", details: ["SPF50+ with natural tinted finish","Evens complexion while protecting from UV","Mattifying formula for sun-sensitive skin","Doubles as light coverage base"] },
  "SPF Melting Cream": { description: "A melting cream SPF50+ sunscreen for sun-sensitive skin that provides very high broad-spectrum protection against UVA/UVB rays. Its melt-away texture coats the skin and absorbs quickly, making application a pleasure. Water and sweat resistant for reliable protection.", details: ["SPF50+ broad-spectrum melting cream texture","Absorbs quickly with luxurious feel","Water and sweat resistant formula","Reliable photostable sun protection"] },
  "SPF Melting Cream Tinted": { description: "A tinted melting cream SPF50 sunscreen combining high sun protection with a natural, healthy-looking tint. It protects from UVA/UVB damage while evening out skin tone, perfect for those who want sun defense with a touch of effortless color.", details: ["SPF50 with natural tinted coverage","Melting cream texture absorbs smoothly","Broad-spectrum UVA/UVB protection","Evens skin tone with subtle color"] },
  "SPF Spray": { description: "An SPF50+ lait spray sunscreen with a light, non-oily texture designed for face and body. Its convenient spray format provides fast, even application with very high broad-spectrum protection against UVA/UVB, ideal for active lifestyles and outdoor activities.", details: ["SPF50+ spray for face and body","Light, non-oily texture absorbs quickly","Broad-spectrum UVA/UVB protection","Convenient spray for easy reapplication"] },
  "SPF Kids": { description: "An SPF50+ kids sunscreen tested for water and sweat resistance with photostable protection. Its light, non-oily formula absorbs quickly and spreads easily on skin, leaving it hydrated, soft, and supple. Suitable for children and babies from 3 years old.", details: ["SPF50+ formulated for children's skin","Water and sweat resistant protection","Light, non-oily, easy-to-spread formula","Safe for children from 3 years old"] },
  "CICA Cream": { description: "A repairing and soothing CICA cream for face and body that restores the epidermis, moisturizes the skin, and relieves discomfort. It reduces the urge to scratch and protects damaged skin, making it ideal for irritated, reactive, and post-procedure skin.", details: ["Restores and repairs damaged epidermis","Soothes discomfort and reduces irritation","Moisturizes and protects the skin barrier","Ideal for sensitive and post-procedure skin"] },
  "Soothing Cleansing Gel": { description: "A soothing cleansing gel for irritated and damaged skin that gently cleanses without causing further irritation. Its mild, calming formula removes impurities while respecting the skin's compromised barrier, leaving skin feeling clean, comfortable, and soothed.", details: ["Gentle cleansing for irritated skin","Calming formula respects damaged barrier","Removes impurities without irritation","Leaves skin clean, comfortable, and soothed"] },
  "Hydro Gel Moisturizer": { description: "A hydro gel moisturizer for irritated and sensitive skin that delivers deep, soothing hydration. Its lightweight gel formula absorbs quickly, calming redness and restoring the moisture balance of damaged or reactive skin for lasting comfort.", details: ["Deep hydration for irritated skin","Lightweight gel absorbs instantly","Calms redness and soothes discomfort","Restores moisture balance for sensitive skin"] },
  "Emollient Cream": { description: "An extreme emollient cream for very dry, irritated, and damaged skin. Its rich, protective formula creates a barrier that locks in moisture, intensely nourishes, and repairs the skin's natural defenses, providing lasting comfort and relief from dryness.", details: ["Extreme emollient for very dry skin","Rich barrier-forming protective formula","Intensely nourishes and repairs skin","Lasting comfort and dryness relief"] },
  "Anti-Hair Loss Shampoo": { description: "An anti-hair-loss shampoo for all hair types that gently cleanses while respecting the scalp's balance. Its sulphate-free formula makes frequent use safe, strengthening hair from root to tip and creating an optimal environment for reduced shedding and healthier growth.", details: ["Anti-hair-loss formula for all hair types","Sulphate-free for gentle, frequent use","Respects scalp balance while cleansing","Strengthens hair and reduces shedding"] },
  "Anti-Dandruff Shampoo": { description: "An anti-dandruff shampoo DS that effectively targets persistent dandruff, flakes, and scalp irritation. Its specialized formula cleanses while treating the root cause of dandruff, restoring scalp health and leaving hair feeling clean, fresh, and flake-free.", details: ["Targets persistent dandruff and flakes","Treats root cause of scalp irritation","Restores scalp health with regular use","Leaves hair clean, fresh, and flake-free"] },
  "Hair Repairing Mask": { description: "A hair repairing mask that deeply nourishes and restores damaged, dry, and brittle hair. Its intensive treatment formula penetrates the hair shaft to rebuild strength, restore moisture, and add shine, transforming hair texture and health in one application.", details: ["Intensive repair for damaged and dry hair","Penetrates deep to rebuild hair strength","Restores moisture and adds brilliant shine","Visible transformation after one treatment"] },
  "Anti-Hair Loss Lotion": { description: "A concentrated anti-hair-loss lotion that acts at the heart of the hair bulb to control hair loss and promote stronger regrowth. This revitalizing concentrate delivers potent actives directly to follicles, supporting the growth of thicker, more resilient hair.", details: ["Concentrated formula targeting hair bulb","Controls hair loss and promotes regrowth","Stimulates stronger, thicker hair growth","Direct-to-scalp application for best results"] },
  "Sweat Control Roll-On": { description: "A premium sweat control roll-on antiperspirant designed for maximum protection against perspiration and body odor. Its advanced formula keeps you dry and fresh throughout the day while being gentle on skin, preventing irritation and white marks on clothing.", details: ["Maximum sweat and odor protection","Long-lasting freshness throughout the day","Gentle on skin, prevents irritation","No white marks on clothing"] },
  "Kids Hair Shampoo": { description: "A gentle, sulfate-free kids' shampoo formulated with natural oils to cleanse your child's hair without stripping its natural moisture. Its tear-free formula is safe from the first day, leaving hair clean, soft, shiny, and easy to detangle after every wash.", details: ["Sulfate-free, tear-free gentle formula","Enriched with natural oils for nourishment","Cleanses without stripping natural moisture","Leaves hair soft, shiny, and tangle-free"] },
  "Kids Hair Cream": { description: "A specialized kids' hair cream formulated to tame frizzy and unruly hair with the best detangling effect. Enriched with natural oils and butters, it moisturizes deeply, prevents frizz, and makes styling and combing effortless while keeping hair soft and healthy.", details: ["Specialized formula for frizzy kids' hair","Best-in-class detangling effect","Enriched with natural oils and butters","Prevents frizz and keeps hair soft"] },
  "Kids Detangler Spray": { description: "A lightweight kids' detangler spray that makes combing through curly and normal hair effortless. Infused with grapeseed, argan, jojoba, and sunflower oils, it softens curls, reduces frizz, and doubles as a curly hair refresher for defined, bouncy curls.", details: ["Effortless detangling for curly and normal hair","Multi-oil formula for deep hydration","Controls frizz and refreshes curls","Free from sulfates, silicone, and parabens"] },
  "Kids Conditioner": { description: "A nourishing kids' conditioner that softens, detangles, and hydrates hair after shampooing. Its gentle, tear-free formula is enriched with natural ingredients that smooth the cuticle and reduce breakage, leaving hair silky, manageable, and beautifully conditioned.", details: ["Gentle, tear-free conditioning formula","Softens, detangles, and hydrates hair","Reduces breakage and smooths cuticles","Safe for daily use on all kids' hair types"] },
  "Kids Hair Serum": { description: "A lightweight kids' hair serum infused with moringa and argan oils to add shine, reduce frizz, and protect hair from environmental damage. Its non-greasy formula smooths hair for a sleek, glossy finish while nourishing and strengthening each strand.", details: ["Infused with moringa and argan oils","Adds shine and reduces frizz","Non-greasy, lightweight formula","Protects and strengthens kids' hair"] },
  "Kids Hair Oil": { description: "A nourishing kids' hair oil formulated with natural oils to increase hair length and treat damaged hair. It strengthens and nourishes each strand for healthy, shiny hair. Free from mineral oils, sulfates, parabens, silicone, and other harsh chemicals.", details: ["Natural oils for hair growth and repair","Strengthens and nourishes each strand","Free from mineral oils and harsh chemicals","Leaves hair healthy, shiny, and strong"] },
  "Kids Shower Gel": { description: "A fun, gently scented kids' shower gel that cleanses your child's skin with a rich, bubbly lather. Its mild, tear-free formula is free from harsh chemicals, making bath time enjoyable while leaving skin clean, soft, and lightly fragranced.", details: ["Fun, gently scented bath time formula","Rich bubbly lather for effective cleansing","Mild, tear-free, and gentle on skin","Leaves skin clean, soft, and fresh"] },
  "Kids Moisturizing Cream": { description: "A gentle daily moisturizing cream for children's delicate skin. Rich in hydrating ingredients, it helps skin maintain its moisture balance throughout the day. Its mild formula is free from harsh chemicals, making it perfect for even the youngest family members.", details: ["Gentle hydration for children's skin","Maintains moisture balance all day","Mild formula free from harsh chemicals","Safe for sensitive and delicate skin"] },
  "Kids Skin Moisturizer": { description: "A moisturizing body lotion with a soft texture, rich in natural oils and honey that stimulate collagen and elastin production. It delivers soft, strong skin for you and your child, with a lightweight formula that absorbs without feeling greasy.", details: ["Rich in natural oils and honey","Stimulates collagen and elastin production","Lightweight, non-greasy absorption","Safe for both children and adults"] },
  "Kids 2-in-1 Shampoo": { description: "A convenient 2-in-1 shampoo and conditioner that cleanses and detangles kids' hair in one easy step. Its silicone-free, SLS-free, and paraben-free formula is gentle enough for daily use, leaving hair clean, soft, and manageable with minimal fuss.", details: ["2-in-1 cleansing and conditioning formula","Silicone-free, SLS-free, paraben-free","Gentle enough for daily use on kids","Leaves hair clean, soft, and tangle-free"] },
  "Kids 3-in-1 Shampoo": { description: "A tear-free 3-in-1 shampoo, conditioner, and body wash that gently cleanses hair, scalp, and body in one convenient step. Enriched with chamomile, aloe vera, and shea butter, it soothes sensitive skin while keeping hair soft, shiny, and tangle-free.", details: ["3-in-1 shampoo, conditioner, and body wash","Tear-free formula with chamomile and aloe vera","Soothes sensitive skin during bath time","Leaves hair soft, shiny, and tangle-free"] },
  "Kids Hair Mask": { description: "An intensive kids' hair mask that deeply nourishes, repairs, and strengthens hair. Its rich formula packed with natural ingredients penetrates each strand to restore moisture, add shine, and reduce breakage, making hair visibly healthier and more manageable.", details: ["Deep nourishment for kids' damaged hair","Rich formula restores moisture and shine","Reduces breakage and strengthens hair","Makes hair visibly healthier and manageable"] },
  "Kids Refreshing Spray": { description: "A hydrating kids' hair refreshing spray enriched with wheat protein, honey, and hyaluronic acid. It revitalizes and refreshes hair between washes, adding moisture and manageability while keeping hair looking fresh, shiny, and beautifully styled throughout the day.", details: ["Refreshes and revitalizes hair between washes","Enriched with wheat protein and hyaluronic acid","Adds moisture and manageability","Keeps hair fresh and beautifully styled"] },
  "Kids Nutritive Spray": { description: "A nutritive hair spray for kids that delivers essential vitamins and natural oils directly to hair strands. It detangles, conditions, and protects hair from daily damage while adding shine and softness, making it an essential part of kids' daily hair care.", details: ["Delivers vitamins and natural oils to hair","Detangles and conditions without rinsing","Protects from daily hair damage","Adds shine and softness to kids' hair"] },
  "Kids Curl Gel": { description: "A safe styling gel for kids that defines and holds curls while keeping hair looking shiny and healthy. Its lightweight, alcohol-free, PVP-free formula doesn't build up on hair, enriched with aloe vera and panthenol for gentle, effective curl definition.", details: ["Defines and holds curls without stiffness","Alcohol-free, PVP-free, no buildup","Enriched with aloe vera and panthenol","Lightweight formula for kids' hair styling"] },
  "Kids Sunscreen Lotion": { description: "A kid-friendly sunscreen lotion with broad-spectrum protection that shields delicate young skin from harmful UV rays. Its gentle, non-irritating formula is specially developed for children's sensitive skin, providing effective sun protection during outdoor play and activities.", details: ["Broad-spectrum protection for kids' skin","Gentle, non-irritating formula","Specially developed for sensitive skin","Essential for outdoor play and activities"] },
  "Kids Facial Foam": { description: "A gentle facial cleansing foam specially designed for kids' delicate facial skin. Its mild, soap-free formula cleanses away dirt and impurities without irritation, leaving young skin feeling fresh, clean, and soft with every use.", details: ["Specially designed for kids' facial skin","Mild, soap-free gentle cleansing","Removes dirt without irritation","Leaves skin fresh, clean, and soft"] },
  "Kids Roll-On Deodorant": { description: "A gentle kids' roll-on deodorant specially formulated for children's sensitive underarm skin. Its mild, skin-friendly formula provides lasting freshness with a fun, sweet scent while being free from harsh chemicals, aluminum, and alcohol for safe daily use.", details: ["Specially formulated for children's skin","Gentle, long-lasting freshness","Free from harsh chemicals and aluminum","Fun scent kids love"] },
  "Kids Roll-On Sunscreen": { description: "An innovative roll-on sunscreen SPF50+ designed for easy, mess-free application on kids' skin. Its moisturizing formula protects delicate skin from harmful UV rays while keeping it hydrated and comfortable. Perfect for active kids who need quick, even coverage.", details: ["SPF50+ roll-on for mess-free application","Moisturizing formula for kids' skin","Protects from harmful UV rays","Quick, even coverage for active kids"] },
  "Kids Detangling Conditioner": { description: "A gentle detangling conditioner that smooths and nourishes kids' hair, making combing effortless and tear-free. Enriched with natural ingredients, it softens tangles, reduces breakage, and leaves hair silky, manageable, and beautifully conditioned after every use.", details: ["Effortless detangling for kids' hair","Smooths, nourishes, and softens tangles","Reduces breakage during combing","Leaves hair silky and manageable"] },
  "Baby Oil": { description: "A gentle baby oil enriched with natural oils that deeply moisturizes and softens delicate baby skin. Its lightweight, fast-absorbing formula provides a protective layer of hydration, perfect for baby massage, cradle cap treatment, or as a daily skin moisturizer.", details: ["Enriched with natural oils for baby skin","Deeply moisturizes and softens","Lightweight, fast-absorbing formula","Perfect for massage and daily moisturizing"] },
  "Baby Shampoo": { description: "A ultra-gentle baby shampoo formulated for newborns and infants with the mildest cleansing agents. Its tear-free, hypoallergenic formula cleanses baby's delicate hair and scalp without irritation, leaving hair soft, clean, and beautifully fragrant.", details: ["Ultra-gentle formula for newborns","Tear-free and hypoallergenic","Cleanses delicate hair and scalp","Leaves baby hair soft and clean"] },
  "Anti-Cradle Cap Shampoo": { description: "A specialized anti-cradle cap foam shampoo enriched with blue chamomile and pro-vitamin B5. Designed for sensitive newborn skin, it gently eliminates cradle cap and associated flakes with an extra-gentle, tear-free formula safe from the very first days.", details: ["Eliminates cradle cap and flakes","Enriched with blue chamomile and B5","Extra-gentle tear-free formula","Safe for sensitive newborn skin"] },
  "Diaper Rash Cream": { description: "A soothing diaper rash cream that creates a protective barrier against moisture and irritation. Its gentle, zinc-enriched formula calms redness, heals irritated skin, and prevents future diaper rash, keeping baby's delicate bottom comfortable and protected.", details: ["Creates protective barrier against moisture","Calms redness and heals irritation","Zinc-enriched gentle formula","Prevents future diaper rash"] },
  "Kids Daily Moisturizer": { description: "A deeply nourishing daily moisturizer enriched with soothing chamomile extract that keeps your child's skin soft, smooth, and moisturized all day. Its gentle, dermatologist-tested formula is perfect for daily use on children's delicate and sensitive skin.", details: ["Enriched with soothing chamomile extract","Keeps skin soft and moisturized all day","Dermatologist-tested and hypoallergenic","Safe for children's delicate skin"] },
};

const products = [
  // ┌─────────────────────────────────────────┐
  // │  DERMACTIVE                              │
  // └─────────────────────────────────────────┘
  // ACTI-CLEAR
  { name: "Dermactive ACTI-CLEAR Gentle Cleansing Gel 200 ml", brand: "Dermactive", category: "skin-care", templateKey: "Acne Cleansing Gel", price: 179, oldPrice: null },
  { name: "Dermactive ACTI-CLEAR Hydra-Mattifying Gel 50 ml", brand: "Dermactive", category: "skin-care", templateKey: "Hydra-Mattifying Gel", price: 159, oldPrice: null },
  { name: "Dermactive ACTI-CLEAR Correcting Serum 30 ml", brand: "Dermactive", category: "skin-care", templateKey: "Acne Correcting Serum", price: 239, oldPrice: null },
  { name: "Dermactive ACTI-CLEAR Global AC Cream 50 ml", brand: "Dermactive", category: "skin-care", templateKey: "Acne Cream", price: 209, oldPrice: null },
  // ACTI-WHITE
  { name: "Dermactive ACTI-WHITE Foaming Gel", brand: "Dermactive", category: "skin-care", templateKey: "Brightening Foaming Gel", price: 179, oldPrice: null },
  { name: "Dermactive ACTI-WHITE Brightening Correcting Serum", brand: "Dermactive", category: "skin-care", templateKey: "Brightening Serum", price: 269, oldPrice: null },
  { name: "Dermactive ACTI-WHITE Depigmenting Cream 50 ml", brand: "Dermactive", category: "skin-care", templateKey: "Depigmenting Cream", price: 209, oldPrice: null },
  { name: "Dermactive ACTI-WHITE Eye Contour", brand: "Dermactive", category: "skin-care", templateKey: "Eye Contour Cream", price: 239, oldPrice: null },
  { name: "Dermactive ACTI-WHITE 2in1 Body Milk", brand: "Dermactive", category: "skin-care", templateKey: "Brightening Body Milk", price: 229, oldPrice: null },
  // ACTI-SOLAIRE
  { name: "Dermactive ACTI-SOLAIRE SPF50+ Ultra Fluid 50 ml", brand: "Dermactive", category: "skin-care", templateKey: "SPF Fluid", price: 279, oldPrice: null },
  { name: "Dermactive ACTI-SOLAIRE SPF50+ Ultra Fluid Light Tinted 50 ml", brand: "Dermactive", category: "skin-care", templateKey: "SPF Fluid Tinted", price: 279, oldPrice: null },
  { name: "Dermactive ACTI-SOLAIRE SPF50+ Melting Cream 50 ml", brand: "Dermactive", category: "skin-care", templateKey: "SPF Melting Cream", price: 279, oldPrice: null },
  { name: "Dermactive ACTI-SOLAIRE SPF50 Melting Cream Light Tinted 50 ml", brand: "Dermactive", category: "skin-care", templateKey: "SPF Melting Cream Tinted", price: 279, oldPrice: null },
  { name: "Dermactive ACTI-SOLAIRE SPF50+ Lait Spray 125 ml", brand: "Dermactive", category: "skin-care", templateKey: "SPF Spray", price: 299, oldPrice: null },
  { name: "Dermactive ACTI-SOLAIRE SPF50+ Kids", brand: "Dermactive", category: "skin-care", templateKey: "SPF Kids", price: 359, oldPrice: null },
  // ACTI-REPAIR
  { name: "Dermactive ACTI-REPAIR CICA Cream", brand: "Dermactive", category: "skin-care", templateKey: "CICA Cream", price: 159, oldPrice: null },
  { name: "Dermactive ACTI-REPAIR Soothing Cleansing Gel 200 ml", brand: "Dermactive", category: "skin-care", templateKey: "Soothing Cleansing Gel", price: 199, oldPrice: null },
  { name: "Dermactive ACTI-REPAIR Hydro Gel", brand: "Dermactive", category: "skin-care", templateKey: "Hydro Gel Moisturizer", price: 179, oldPrice: null },
  { name: "Dermactive ACTI-REPAIR Emollient Extreme", brand: "Dermactive", category: "skin-care", templateKey: "Emollient Cream", price: 209, oldPrice: null },
  // TRICHO-ACT
  { name: "Dermactive TRICHO-ACT Anti-Hair Loss Shampoo 200 ml", brand: "Dermactive", category: "hair-care", templateKey: "Anti-Hair Loss Shampoo", price: 189, oldPrice: null },
  { name: "Dermactive TRICHO-ACT Anti-Dandruff Shampoo DS", brand: "Dermactive", category: "hair-care", templateKey: "Anti-Dandruff Shampoo", price: 189, oldPrice: null },
  { name: "Dermactive TRICHO-ACT Hair Repairing Mask", brand: "Dermactive", category: "hair-care", templateKey: "Hair Repairing Mask", price: 189, oldPrice: null },
  { name: "Dermactive TRICHO-ACT Anti-Hair Loss Lotion Concentrate", brand: "Dermactive", category: "hair-care", templateKey: "Anti-Hair Loss Lotion", price: 269, oldPrice: null },
  // SWEAT CONTROL
  { name: "Dermactive Sweat Control Triple Effect Roll-On 60 ml", brand: "Dermactive", category: "skin-care", templateKey: "Sweat Control Roll-On", price: 169, oldPrice: null },
  { name: "Dermactive Sweat Control Refreshing Roll-On 60 ml", brand: "Dermactive", category: "skin-care", templateKey: "Sweat Control Roll-On", price: 169, oldPrice: null },
  { name: "Dermactive Sweat Control Intense Roll-On 60 ml", brand: "Dermactive", category: "skin-care", templateKey: "Sweat Control Roll-On", price: 169, oldPrice: null },

  // ┌─────────────────────────────────────────┐
  // │  PENDULINE (Kids Only)                   │
  // └─────────────────────────────────────────┘
  { name: "Penduline Kids Sulfate Free Shampoo 250 ml", brand: "Penduline", category: "kids-care", templateKey: "Kids Hair Shampoo", price: 140, oldPrice: null },
  { name: "Penduline Kids Sulfate Free Shampoo 450 ml", brand: "Penduline", category: "kids-care", templateKey: "Kids Hair Shampoo", price: 245, oldPrice: null },
  { name: "Penduline Kids Hair Cream Dry & Normal 150 ml", brand: "Penduline", category: "kids-care", templateKey: "Kids Hair Cream", price: 120, oldPrice: null },
  { name: "Penduline Kids Hair Cream Curly 150 ml", brand: "Penduline", category: "kids-care", templateKey: "Kids Hair Cream", price: 120, oldPrice: null },
  { name: "Penduline Kids Hair Cream Wavy Apricot 150 ml", brand: "Penduline", category: "kids-care", templateKey: "Kids Hair Cream", price: 120, oldPrice: null },
  { name: "Penduline Curly Kids Shampoo Shea 300 ml", brand: "Penduline", category: "kids-care", templateKey: "Kids Hair Shampoo", price: 135, oldPrice: null },
  { name: "Penduline Curly Detangler Spray 250 ml", brand: "Penduline", category: "kids-care", templateKey: "Kids Detangler Spray", price: 100, oldPrice: null },
  { name: "Penduline Curly Conditioner 300 ml", brand: "Penduline", category: "kids-care", templateKey: "Kids Conditioner", price: 120, oldPrice: null },
  { name: "Penduline Curly Styling Gel", brand: "Penduline", category: "kids-care", templateKey: "Kids Curl Gel", price: 100, oldPrice: null },
  { name: "Penduline Kids Hair Serum Moringa & Argan 60 ml", brand: "Penduline", category: "kids-care", templateKey: "Kids Hair Serum", price: 195, oldPrice: null },
  { name: "Penduline Kids Banana Shower Gel 300 ml", brand: "Penduline", category: "kids-care", templateKey: "Kids Shower Gel", price: 180, oldPrice: null },
  { name: "Penduline Kids Moisturizing Cream", brand: "Penduline", category: "kids-care", templateKey: "Kids Moisturizing Cream", price: 85, oldPrice: null },
  { name: "Penduline Kids Anti-Dandruff Cream", brand: "Penduline", category: "kids-care", templateKey: "Kids Hair Cream", price: 120, oldPrice: null },

  // ┌─────────────────────────────────────────┐
  // │  HAPPINESS (Maqam Cosmetics)             │
  // └─────────────────────────────────────────┘
  { name: "Happiness Kids Hair Shampoo 200 ml", brand: "Happiness", category: "kids-care", templateKey: "Kids Hair Shampoo", price: 160, oldPrice: null },
  { name: "Happiness Kids Hair Shampoo 400 ml", brand: "Happiness", category: "kids-care", templateKey: "Kids Hair Shampoo", price: 270, oldPrice: null },
  { name: "Happiness Kids Hair Cream 150 ml", brand: "Happiness", category: "kids-care", templateKey: "Kids Hair Cream", price: 185, oldPrice: null },
  { name: "Happiness Kids Hair Cream 300 ml", brand: "Happiness", category: "kids-care", templateKey: "Kids Hair Cream", price: 295, oldPrice: null },
  { name: "Happiness Kids Hair Oil 120 ml", brand: "Happiness", category: "kids-care", templateKey: "Kids Hair Oil", price: 235, oldPrice: null },
  { name: "Happiness Kids Hair Oil 200 ml", brand: "Happiness", category: "kids-care", templateKey: "Kids Hair Oil", price: 325, oldPrice: null },
  { name: "Happiness Kids Daily Skin Moisturizer 150 ml", brand: "Happiness", category: "kids-care", templateKey: "Kids Skin Moisturizer", price: 130, oldPrice: null },
  { name: "Happiness Kids Diaper Rash Cream", brand: "Happiness", category: "kids-care", templateKey: "Diaper Rash Cream", price: 125, oldPrice: null },

  // ┌─────────────────────────────────────────┐
  // │  SUPERKIDS (Parkville)                   │
  // └─────────────────────────────────────────┘
  { name: "SuperKids Hair Cream 200 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Hair Cream", price: 145, oldPrice: null },
  { name: "SuperKids Hair Leave In Conditioner 250 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Detangling Conditioner", price: 170, oldPrice: null },
  { name: "SuperKids Hair Mask 300 gm", brand: "SuperKids", category: "kids-care", templateKey: "Kids Hair Mask", price: 200, oldPrice: null },
  { name: "SuperKids 2 In 1 Shampoo & Conditioner 500 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids 2-in-1 Shampoo", price: 190, oldPrice: null },
  { name: "SuperKids Kids Shampoo Green Apple 300 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Hair Shampoo", price: 135, oldPrice: null },
  { name: "SuperKids 3 In 1 Strawberry Milkshake Shampoo 500 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids 3-in-1 Shampoo", price: 190, oldPrice: null },
  { name: "SuperKids Kids Strawberry Milkshake Shampoo 300 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Hair Shampoo", price: 135, oldPrice: null },
  { name: "SuperKids Baby Shampoo 200 ml", brand: "SuperKids", category: "kids-care", templateKey: "Baby Shampoo", price: 120, oldPrice: null },
  { name: "SuperKids Hair Serum 100 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Hair Serum", price: 350, oldPrice: null },
  { name: "SuperKids Refreshing Spray 250 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Refreshing Spray", price: 110, oldPrice: null },
  { name: "SuperKids Nutritive Hair Spray 120 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Nutritive Spray", price: 145, oldPrice: null },
  { name: "SuperKids Detangling Hair Spray 120 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Detangler Spray", price: 145, oldPrice: null },
  { name: "SuperKids Curly Hair Shampoo 300 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Hair Shampoo", price: 135, oldPrice: null },
  { name: "SuperKids Curly Gel 250 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Curl Gel", price: 170, oldPrice: null },
  { name: "SuperKids Sunscreen Lotion 200 ml", brand: "SuperKids", category: "kids-care", templateKey: "Kids Sunscreen Lotion", price: 275, oldPrice: null },
  { name: "SuperKids Facial Foam", brand: "SuperKids", category: "kids-care", templateKey: "Kids Facial Foam", price: 120, oldPrice: null },
  { name: "SuperKids Roll-On Pineapple Scent", brand: "SuperKids", category: "kids-care", templateKey: "Kids Roll-On Deodorant", price: 100, oldPrice: null },

  // ┌─────────────────────────────────────────┐
  // │  BLANKIE KIDS                            │
  // └─────────────────────────────────────────┘
  { name: "Blankie 3-in-1 Shampoo Conditioner & Body Wash 200 ml", brand: "Blankie", category: "kids-care", templateKey: "Kids 3-in-1 Shampoo", price: 360, oldPrice: null },
  { name: "Blankie Hair Cream 120 ml", brand: "Blankie", category: "kids-care", templateKey: "Kids Hair Cream", price: 420, oldPrice: null },
  { name: "Blankie Detangling Conditioner", brand: "Blankie", category: "kids-care", templateKey: "Kids Detangling Conditioner", price: 400, oldPrice: null },
  { name: "Blankie Daily Moisturizer", brand: "Blankie", category: "kids-care", templateKey: "Kids Daily Moisturizer", price: 400, oldPrice: null },
  { name: "Blankie Moisturizing Sunscreen SPF50+", brand: "Blankie", category: "kids-care", templateKey: "Kids Roll-On Sunscreen", price: 400, oldPrice: null },
  { name: "Blankie Cotton Candy Roll-On Deodorant 40 ml", brand: "Blankie", category: "kids-care", templateKey: "Kids Roll-On Deodorant", price: 350, oldPrice: null },
  { name: "Blankie Baby Oil", brand: "Blankie", category: "kids-care", templateKey: "Baby Oil", price: 350, oldPrice: null },
];

const DEFAULTS = { emoji: "✨", badge: null, stock: 100, lowStockThreshold: 10, rating: 0, reviewCount: 0, active: true };

// SKU generator — replicated from backend/controllers/mysql/productController.js
// so the seed produces the same clean, sequential DD-XXX-### scheme. Queries
// fresh each call, so numbering stays correct as products are created one at a
// time within this run.
const SKU_RE = /^(DD-[A-Z0-9]+)-(\d+)$/i;
async function generateSku(category) {
  const all = await prisma.product.findMany({ select: { sku: true, category: true } });

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

async function main() {
  let added = 0;
  let skipped = 0;
  for (const product of products) {
    const existing = await prisma.product.findFirst({ where: { name: product.name, brand: product.brand } });
    if (existing) { console.log("Skipped: " + product.name); skipped++; continue; }
    const template = templates[product.templateKey];
    if (!template) { console.error("Missing template: " + product.templateKey + " for " + product.name); skipped++; continue; }
    const sku = await generateSku(product.category);
    await prisma.product.create({
      data: {
        name: product.name, brand: product.brand, category: product.category,
        price: baseFor(product.price), oldPrice: product.oldPrice != null ? baseFor(product.oldPrice) : null,
        description: template.description, details: template.details,
        emoji: DEFAULTS.emoji, badge: DEFAULTS.badge, sku,
        stock: product.stock !== undefined ? product.stock : DEFAULTS.stock,
        lowStockThreshold: DEFAULTS.lowStockThreshold, rating: DEFAULTS.rating,
        reviewCount: DEFAULTS.reviewCount, active: DEFAULTS.active,
        colors: { create: [{ name: "Default", hex: "", images: [], sortOrder: 0 }] },
      },
    });
    console.log("Added: " + product.name + "  (" + sku + ")"); added++;
  }
  console.log("");
  console.log("====================================");
  console.log("Added: " + added);
  console.log("Skipped: " + skipped);
  console.log("Finished Successfully");
  console.log("====================================");
}

main()
  .catch((error) => { console.error("Seed failed:", error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
