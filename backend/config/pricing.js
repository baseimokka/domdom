// backend/config/pricing.js
const MARKUP_RATE             = 0.05;
const FREE_SHIPPING_THRESHOLD = 3000;

function applyMarkup(basePrice) {
  // base + markup, rounded UP to a whole EGP. toFixed(4) first strips
  // float noise (e.g. 100 * 1.05 = 105.00000000000001) so a clean price
  // isn't pushed to the next integer.
  return Math.ceil(+(basePrice * (1 + MARKUP_RATE)).toFixed(4));
}

module.exports = { MARKUP_RATE, FREE_SHIPPING_THRESHOLD, applyMarkup };
