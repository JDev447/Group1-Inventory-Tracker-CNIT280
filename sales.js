"use strict";

const salesRows = document.querySelector("#sales-rows");
const salesError = document.querySelector("#sales-error");
const salesStatus = document.querySelector("#sales-status");
const saleDetailsDialog = document.querySelector("#sale-details-dialog");
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function renderSales() {
  const sales = [...data.sales].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  salesRows.replaceChildren();
  const revenue = sales.reduce((sum, sale) => sum + sale.totalCents, 0);
  document.querySelector("#sales-summary").textContent =
    sales.length + " recorded transactions · Total revenue " + currency.format(revenue / 100);

  for (const sale of sales) {
    const row = salesRows.insertRow();
    const values = [
      sale.id, dateTime.format(new Date(sale.occurredAt)),
      sale.items.map(item => item.productName).join(", "),
      sale.items.map(item => item.size).join(", "),
      sale.items.map(item => item.color).join(", "),
      sale.items.reduce((sum, item) => sum + item.quantity, 0),
      currency.format(sale.totalCents / 100), sale.isSimulated ? "Simulated · Demo data" : "POS",
    ];
    for (const value of values) row.insertCell().textContent = value;
    const view = row.insertCell().appendChild(document.createElement("button"));
    view.type = "button";
    view.textContent = "View";
    view.setAttribute("aria-label", "View transaction " + sale.id);
    view.addEventListener("click", () => openSaleDetails(sale));
  }
  if (!sales.length) {
    const cell = salesRows.insertRow().insertCell();
    cell.colSpan = 9;
    cell.textContent = "No sales recorded yet. Use Simulate POS Sale to receive a demo transaction.";
  }
}

function openSaleDetails(sale) {
  document.querySelector("#sale-details-info").textContent =
    "Transaction " + sale.id + "\n" + dateTime.format(new Date(sale.occurredAt)) +
    "\n" + (sale.isSimulated ? "Simulated POS sale · Demo data" : "POS transaction");
  const rows = document.querySelector("#sale-details-items");
  rows.replaceChildren();
  for (const item of sale.items) {
    const row = rows.insertRow();
    for (const value of [
      item.productName, item.sku, item.size, item.color, item.quantity,
      currency.format(item.unitPriceCents / 100), currency.format(item.lineTotalCents / 100),
    ]) row.insertCell().textContent = value;
  }
  document.querySelector("#sale-details-total").textContent = "Sale total " + currency.format(sale.totalCents / 100);
  openDialog(saleDetailsDialog, document.querySelector("#sale-details-title"));
}

function simulatePosSale() {
  salesError.textContent = "";
  salesStatus.textContent = "";
  try {
    const transaction = generateSimulatedSale(readStoredData());
    const result = processSale(transaction);
    data = result.data;
    renderInventory();
    renderSales();
    salesStatus.textContent = "Demo transaction recorded. Inventory updated. Sale total " +
      currency.format(result.sale.totalCents / 100) + ".";
  } catch (error) {
    salesError.textContent = error.message;
  }
}

function showPage(focusHeading = false) {
  const page = location.hash === "#sales" ? "sales" : "inventory";
  document.querySelector("#inventory").hidden = page !== "inventory";
  document.querySelector("#sales").hidden = page !== "sales";
  document.querySelectorAll('nav a[href^="#"]').forEach(link => {
    if (link.hash === "#" + page) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (focusHeading) document.querySelector("#" + page + " h1").focus({ preventScroll: true });
}

document.querySelector("#inventory h1").tabIndex = -1;
document.querySelector("#simulate-sale").addEventListener("click", simulatePosSale);
window.addEventListener("hashchange", () => showPage(true));
renderSales();
showPage();
