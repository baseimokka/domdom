// backend/config/pricing.js
const MARKUP_RATE             = 0.05;
const FREE_SHIPPING_THRESHOLD = 3000;

function applyMarkup(basePrice) {
  return +(basePrice * (1 + MARKUP_RATE)).toFixed(2);
}

module.exports = { MARKUP_RATE, FREE_SHIPPING_THRESHOLD, applyMarkup };
