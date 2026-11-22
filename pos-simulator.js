"use strict";

// Generates a transaction only. Stock checks and saving belong to processSale().
function generateSimulatedSale(current) {
  const products = current.products.filter(product =>
    product.variants.some(variant => variant.quantity > 0)
  );
  if (!products.length) throw new Error("No inventory is available. Add stock in Inventory before simulating a sale.");
  const product = products[Math.floor(Math.random() * products.length)];
  const variants = product.variants.filter(variant => variant.quantity > 0);
  const variant = variants[Math.floor(Math.random() * variants.length)];
  const quantity = 1 + Math.floor(Math.random() * Math.min(3, variant.quantity));
  return {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    isSimulated: true,
    items: [{
      productId: product.id, variantId: variant.id, quantity,
      unitPriceCents: product.priceCents,
    }],
  };
}
