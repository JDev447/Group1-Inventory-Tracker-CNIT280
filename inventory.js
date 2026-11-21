"use strict";

const storageKey = "cnit280-clothing-store";
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const form = document.querySelector("#product-form");
const variantList = document.querySelector("#variants");
const variantTemplate = document.querySelector("#variant-template");
const inventoryRows = document.querySelector("#inventory-rows");
const search = document.querySelector("#search");
const sizeFilter = document.querySelector("#size-filter");
const colorFilter = document.querySelector("#color-filter");
const addProduct = document.querySelector("#add-product");
const status = document.querySelector("#status");
const storageError = document.querySelector("#storage-error");
const formError = document.querySelector("#form-error");
let editingProductId = null;

function sampleData() {
  return {
    products: [
      {
        id: "tee", name: "Essential Cotton T-Shirt", category: "Tops",
        description: "A midweight crewneck in soft cotton.", priceCents: 1999,
        variants: [
          { id: "tee-black-m", size: "M", color: "Black", sku: "TEE-BLK-M", quantity: 24 },
          { id: "tee-white-l", size: "L", color: "White", sku: "TEE-WHT-L", quantity: 16 },
          { id: "tee-black-l", size: "L", color: "Black", sku: "TEE-BLK-L", quantity: 9 },
        ],
      },
      {
        id: "jeans", name: "Straight-Leg Denim Jeans", category: "Bottoms",
        description: "Classic straight fit in medium-wash denim.", priceCents: 4999,
        variants: [
          { id: "jeans-blue-30", size: "30", color: "Blue", sku: "JNS-BLU-30", quantity: 8 },
          { id: "jeans-blue-32", size: "32", color: "Blue", sku: "JNS-BLU-32", quantity: 12 },
        ],
      },
      {
        id: "hoodie", name: "Fleece Pullover Hoodie", category: "Sweatshirts",
        description: "Brushed fleece with a kangaroo pocket.", priceCents: 3999,
        variants: [
          { id: "hoodie-gray-m", size: "M", color: "Gray", sku: "HDY-GRY-M", quantity: 6 },
          { id: "hoodie-gray-l", size: "L", color: "Gray", sku: "HDY-GRY-L", quantity: 3 },
          { id: "hoodie-black-l", size: "L", color: "Black", sku: "HDY-BLK-L", quantity: 0 },
        ],
      },
    ],
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      const data = JSON.parse(saved);
      if (!Array.isArray(data?.products)) throw new Error("Invalid inventory");
      return data;
    }
  } catch {
    storageError.textContent = "Saved inventory could not be opened. Reset demo data to start fresh.";
    addProduct.disabled = true;
    return { products: [] };
  }
  return sampleData();
}

let data = loadData();

function saveData(nextData, errorElement) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextData));
  } catch {
    errorElement.textContent = "Changes could not be saved. Check that browser storage is available and try again.";
    return false;
  }
  data = nextData;
  storageError.textContent = "";
  return true;
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function updateFilterOptions(select, values) {
  const selected = select.value;
  const options = new Map(values.map(value => [normalize(value), value]));
  const sorted = [...options].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
  select.replaceChildren(select.options[0], ...sorted.map(([key, label]) => new Option(label, key)));
  if (options.has(selected)) select.value = selected;
}

function renderInventory() {
  const variants = data.products.flatMap(product => product.variants);
  updateFilterOptions(sizeFilter, variants.map(variant => variant.size));
  updateFilterOptions(colorFilter, variants.map(variant => variant.color));
  const query = normalize(search.value);
  let visibleCount = 0;
  const rows = document.createDocumentFragment();

  for (const product of data.products) {
    const productVariants = product.variants.length ? product.variants : [null];
    for (const variant of productVariants) {
      const matchesQuery = normalize(product.name).includes(query) || normalize(variant?.sku ?? "") === query;
      const matchesSize = !sizeFilter.value || normalize(variant?.size ?? "") === sizeFilter.value;
      const matchesColor = !colorFilter.value || normalize(variant?.color ?? "") === colorFilter.value;
      if (!matchesQuery || !matchesSize || !matchesColor) continue;

      const row = rows.appendChild(document.createElement("tr"));
      const values = [
        product.name, product.category || "—", variant?.sku ?? "No variants", variant?.size ?? "—",
        variant?.color ?? "—", currency.format(product.priceCents / 100), variant?.quantity ?? "—",
      ];
      for (const value of values) row.insertCell().textContent = value;

      const actions = row.insertCell().appendChild(document.createElement("div"));
      actions.className = "actions";
      const edit = actions.appendChild(document.createElement("button"));
      edit.type = "button";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", "Edit " + (variant?.sku ?? product.name));
      edit.addEventListener("click", () => openEditor(product, variant?.id));
      const remove = actions.appendChild(document.createElement("button"));
      remove.type = "button";
      remove.textContent = "Delete product";
      remove.setAttribute("aria-label", "Delete product " + product.name);
      remove.addEventListener("click", () => deleteProduct(product));
      if (variant) visibleCount += 1;
    }
  }
  if (visibleCount === 0) {
    const cell = rows.appendChild(document.createElement("tr")).insertCell();
    cell.colSpan = 8;
    cell.textContent = data.products.length ? "No variants match your search and filters." : "No products in inventory.";
  }
  inventoryRows.replaceChildren(rows);
  document.querySelector("#inventory-summary").textContent =
    "Showing " + visibleCount + " of " + variants.length + " variants";
}

function refreshVariantRows() {
  [...variantList.children].forEach((row, index) => {
    row.querySelector("legend").textContent = "Variant " + (index + 1);
  });
}

function appendVariant(variant) {
  const row = variantTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.variantId = variant?.id ?? crypto.randomUUID();
  for (const input of row.querySelectorAll("input")) {
    input.value = variant?.[input.name] ?? "";
  }
  row.querySelector(".remove-variant").addEventListener("click", () => {
    row.remove();
    refreshVariantRows();
    document.querySelector("#add-variant").focus();
  });
  variantList.append(row);
  refreshVariantRows();
  return row;
}

function openEditor(product, variantId) {
  editingProductId = product?.id ?? null;
  status.textContent = "";
  formError.textContent = "";
  form.reset();
  variantList.replaceChildren();
  form.elements.productName.value = product?.name ?? "";
  form.elements.category.value = product?.category ?? "";
  form.elements.description.value = product?.description ?? "";
  form.elements.price.value = product ? (product.priceCents / 100).toFixed(2) : "";
  document.querySelector("#editor-title").textContent = product ? "Edit product" : "Add product";

  let focusField = form.elements.productName;
  if (product) {
    for (const variant of product.variants) {
      const row = appendVariant(variant);
      if (variant.id === variantId) focusField = row.querySelector('[name="quantity"]');
    }
  } else {
    appendVariant();
  }
  form.hidden = false;
  focusField.focus();
  form.scrollIntoView({ block: "nearest" });
}

function closeEditor() {
  form.hidden = true;
  editingProductId = null;
  addProduct.focus();
}

function deleteProduct(product) {
  if (!window.confirm('Delete "' + product.name + '" and all of its variants?')) return;

  const products = data.products.filter(item => item.id !== product.id);
  if (!saveData({ ...data, products }, storageError)) return;
  if (editingProductId === product.id) closeEditor();
  renderInventory();
  addProduct.focus();
  status.textContent = product.name + " deleted.";
}

function readProduct() {
  const name = form.elements.productName.value.trim();
  if (!name) throw new Error("Enter a product name.");
  const usedSkus = new Set();
  for (const product of data.products) {
    if (product.id === editingProductId) continue;
    for (const variant of product.variants) usedSkus.add(normalize(variant.sku));
  }

  const sizeColors = new Set();
  const variants = [...variantList.children].map((row, index) => {
    const size = row.querySelector('[name="size"]').value.trim();
    const color = row.querySelector('[name="color"]').value.trim();
    const sku = row.querySelector('[name="sku"]').value.trim();
    const quantity = row.querySelector('[name="quantity"]').valueAsNumber;
    if (!size || !color || !sku) throw new Error("Enter a size, color, and SKU for variant " + (index + 1) + ".");
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error("Enter a nonnegative whole-number quantity for " + sku + ".");
    }
    const skuKey = normalize(sku);
    if (usedSkus.has(skuKey)) throw new Error('SKU "' + sku + '" is already in use.');
    usedSkus.add(skuKey);

    const sizeColor = JSON.stringify([normalize(size), normalize(color)]);
    if (sizeColors.has(sizeColor)) throw new Error("Size " + size + " in " + color + " is already listed for this product.");
    sizeColors.add(sizeColor);
    return { id: row.dataset.variantId, size, color, sku, quantity };
  });

  return {
    id: editingProductId ?? crypto.randomUUID(),
    name,
    category: form.elements.category.value.trim(),
    description: form.elements.description.value.trim(),
    // Store prices in cents to keep future sale totals in whole numbers.
    priceCents: Math.round(form.elements.price.valueAsNumber * 100),
    variants,
  };
}

form.addEventListener("submit", event => {
  event.preventDefault();
  formError.textContent = "";
  let product;
  try {
    product = readProduct();
  } catch (error) {
    formError.textContent = error.message;
    return;
  }

  const products = editingProductId
    ? data.products.map(item => item.id === editingProductId ? product : item)
    : [...data.products, product];
  if (!saveData({ ...data, products }, formError)) return;
  closeEditor();
  renderInventory();
  status.textContent = product.name + " saved.";
});

function clearFilters() {
  search.value = "";
  sizeFilter.value = "";
  colorFilter.value = "";
}

addProduct.addEventListener("click", () => openEditor());
document.querySelector("#cancel-edit").addEventListener("click", closeEditor);
document.querySelector("#add-variant").addEventListener("click", () => {
  appendVariant().querySelector("input").focus();
});
search.addEventListener("input", renderInventory);
sizeFilter.addEventListener("change", renderInventory);
colorFilter.addEventListener("change", renderInventory);
document.querySelector("#clear-filters").addEventListener("click", () => {
  clearFilters();
  renderInventory();
});
document.querySelector("#reset-demo").addEventListener("click", () => {
  if (!window.confirm("Reset to the original demo data? This will discard your changes.")) return;
  if (!saveData(sampleData(), storageError)) return;
  addProduct.disabled = false;
  closeEditor();
  clearFilters();
  renderInventory();
  status.textContent = "Original demo inventory restored.";
});

renderInventory();
