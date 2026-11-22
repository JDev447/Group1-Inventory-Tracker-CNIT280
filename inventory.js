"use strict";

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
const editorDialog = document.querySelector("#editor-dialog");
const confirmationDialog = document.querySelector("#confirmation-dialog");
const detailsDialog = document.querySelector("#details-dialog");
const confirmationError = document.querySelector("#confirmation-error");
let confirmAction = null;
const dialogCleanups = new Map();

// Native dialogs keep keyboard focus inside and make the background inactive.
function openDialog(dialog, focusTarget) {
  const trigger = document.activeElement;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const previousBodyStyle = document.body.getAttribute("style");
  document.body.style.position = "fixed";
  document.body.style.top = "-" + scrollY + "px";
  document.body.style.left = "-" + scrollX + "px";
  document.body.style.width = "100%";
  dialog.showModal();
  focusTarget.focus({ preventScroll: true });

  const restorePage = () => {
    dialogCleanups.delete(dialog);
    if (previousBodyStyle === null) document.body.removeAttribute("style");
    else document.body.setAttribute("style", previousBodyStyle);
    // Saving rebuilds the table, so find the replacement for the original button.
    let returnTarget = trigger;
    if (!trigger.isConnected) {
      const label = trigger.getAttribute("aria-label");
      returnTarget = [...inventoryRows.querySelectorAll("button")].find(
        button => button.getAttribute("aria-label") === label
      ) ?? addProduct;
    }
    returnTarget.focus({ preventScroll: true });
    window.scrollTo(scrollX, scrollY);
    dialog.removeEventListener("close", restorePage);
  };
  dialogCleanups.set(dialog, restorePage);
  dialog.addEventListener("close", restorePage, { once: true });
}

function closeDialog(dialog) {
  dialog.close();
  dialogCleanups.get(dialog)?.();
}

function openConfirmation(title, message, action) {
  document.querySelector("#confirmation-title").textContent = title;
  document.querySelector("#confirmation-message").textContent = message;
  confirmationError.textContent = "";
  confirmAction = action;
  openDialog(confirmationDialog, document.querySelector("#confirmation-cancel"));
}

function openDetails(product) {
  document.querySelector("#details-title").textContent = product.name;
  document.querySelector("#details-description").textContent = product.description || "No description provided.";
  const total = product.variants.reduce((sum, variant) => sum + variant.quantity, 0);
  document.querySelector("#details-summary").textContent =
    "Category: " + (product.category || "Uncategorized") + " · Unit price: " +
    currency.format(product.priceCents / 100) + " · Total stock: " + total;
  const rows = document.querySelector("#details-variants");
  rows.replaceChildren();
  for (const variant of product.variants) {
    const row = rows.insertRow();
    for (const value of [variant.sku, variant.size, variant.color, variant.quantity]) {
      row.insertCell().textContent = value;
    }
  }
  if (!product.variants.length) {
    const cell = rows.insertRow().insertCell();
    cell.colSpan = 4;
    cell.textContent = "No variants recorded.";
  }
  openDialog(detailsDialog, document.querySelector("#details-title"));
}


function sampleData() {
  return {
    sales: [],
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
    return readStoredData();
  } catch {
    storageError.textContent = "Saved inventory could not be opened. Reset demo data to start fresh.";
    addProduct.disabled = true;
    return { products: [], sales: [] };
  }
}

let data = loadData();

function saveData(nextData, errorElement, reset = false) {
  try {
    if (reset) resetStoredData(nextData);
    else persistData(nextData, data);
  } catch (error) {
    errorElement.textContent = "Changes could not be saved. " + error.message;
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
      const view = actions.appendChild(document.createElement("button"));
      view.type = "button";
      view.textContent = "View";
      view.setAttribute("aria-label", "View " + product.name);
      view.addEventListener("click", () => openDetails(product));
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
  openDialog(editorDialog, focusField);
}

function closeEditor() {
  closeDialog(editorDialog);
}

function deleteProduct(product) {
  openConfirmation(
    "Delete product?",
    'Delete "' + product.name + '"? All associated size/color variants will also be deleted.',
    () => {
      const products = data.products.filter(item => item.id !== product.id);
      if (!saveData({ ...data, products }, confirmationError)) return false;
      renderInventory();
      status.textContent = product.name + " deleted.";
      return true;
    }
  );
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
  renderInventory();
  closeEditor();
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
  openConfirmation(
    "Reset demo data?",
    "Your current inventory will be replaced with the original sample data and sales history will be cleared. All demo changes will be discarded.",
    () => {
      if (!saveData(sampleData(), confirmationError, true)) return false;
      addProduct.disabled = false;
      clearFilters();
      renderInventory();
      renderSales();
      status.textContent = "Original demo inventory restored and sales history cleared.";
      return true;
    }
  );
});

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => closeDialog(button.closest("dialog")));
});
editorDialog.addEventListener("close", () => { editingProductId = null; });
confirmationDialog.addEventListener("close", () => { confirmAction = null; });
document.querySelector("#confirmation-confirm").addEventListener("click", () => {
  if (confirmAction && confirmAction()) closeDialog(confirmationDialog);
});

renderInventory();
