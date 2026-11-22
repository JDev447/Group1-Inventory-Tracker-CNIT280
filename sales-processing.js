"use strict";

// Receives completed transaction data. It has no dependency on page elements.
function processSale(transaction) {
  if (!transaction || typeof transaction.id !== "string" || !transaction.id.trim() ||
      typeof transaction.occurredAt !== "string" ||
      !Number.isFinite(Date.parse(transaction.occurredAt)) ||
      typeof transaction.isSimulated !== "boolean" ||
      !Array.isArray(transaction.items) || transaction.items.length === 0) {
    throw new Error("The transaction is missing valid identifying information or items.");
  }

  const current = readStoredData();
  if (current.sales.some(sale => sale.id === transaction.id)) {
    throw new Error("This transaction has already been recorded.");
  }
  const next = structuredClone(current);
  const items = [];
  let totalCents = 0;

  for (const requested of transaction.items) {
    if (!requested || !Number.isSafeInteger(requested.quantity) || requested.quantity <= 0 ||
        !Number.isSafeInteger(requested.unitPriceCents) || requested.unitPriceCents < 0) {
      throw new Error("Each sale item needs a positive whole-number quantity and valid price.");
    }
    const product = next.products.find(product => product.id === requested.productId);
    const variant = product?.variants.find(variant => variant.id === requested.variantId);
    if (!product || !variant) throw new Error("The selected product or variant no longer exists.");
    if (!Number.isSafeInteger(variant.quantity) || variant.quantity < requested.quantity) {
      throw new Error("Insufficient stock for " + variant.sku + ".");
    }

    const lineTotalCents = requested.quantity * requested.unitPriceCents;
    totalCents += lineTotalCents;
    if (!Number.isSafeInteger(totalCents)) throw new Error("The transaction total is too large.");
    variant.quantity -= requested.quantity;
    items.push({
      productId: product.id, variantId: variant.id, productName: product.name,
      sku: variant.sku, size: variant.size, color: variant.color,
      quantity: requested.quantity, unitPriceCents: requested.unitPriceCents, lineTotalCents,
    });
  }

  const sale = {
    id: transaction.id,
    occurredAt: new Date(transaction.occurredAt).toISOString(),
    isSimulated: transaction.isSimulated,
    items,
    totalCents,
  };
  next.sales.push(sale);
  persistData(next, current);
  return { data: next, sale };
}
