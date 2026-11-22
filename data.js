"use strict";

const storageKey = "cnit280-clothing-store";
const storedSnapshots = new WeakMap();

// Old inventory-only records gain an empty sales list in memory.
function readStoredData() {
  const raw = localStorage.getItem(storageKey);
  const stored = raw === null ? sampleData() : JSON.parse(raw);
  if (!Array.isArray(stored?.products) ||
      (stored.sales !== undefined && !Array.isArray(stored.sales))) {
    throw new Error("Saved data could not be opened.");
  }
  const result = { ...stored, sales: stored.sales ?? [] };
  storedSnapshots.set(result, raw);
  return result;
}

function persistData(nextData, previousData) {
  if (localStorage.getItem(storageKey) !== storedSnapshots.get(previousData)) {
    throw new Error("Data changed in another tab. Refresh before saving.");
  }
  const serialized = JSON.stringify(nextData);
  // One write stores stock and history together. Callers only update memory after success.
  localStorage.setItem(storageKey, serialized);
  storedSnapshots.set(nextData, serialized);
}

// Explicit reset can recover unreadable saved data as well.
function resetStoredData(nextData) {
  localStorage.setItem(storageKey, JSON.stringify(nextData));
  storedSnapshots.set(nextData, localStorage.getItem(storageKey));
}
