import browser from "./browser";
import { ReadingListItem, ReadingListSummary } from "./messages";

// The queue lives in chrome.storage.local (not just an in-memory background
// variable) so it survives MV3 service-worker shutdowns between page adds —
// a user building a book over several tabs, minutes apart, must not lose
// earlier pages when the worker naps. `unlimitedStorage` is requested in the
// manifest because full page snapshots easily exceed the default 10 MB quota.
const STORAGE_KEY = "readingList";

async function readAll(): Promise<ReadingListItem[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const items = stored[STORAGE_KEY];
  return Array.isArray(items) ? (items as ReadingListItem[]) : [];
}

async function writeAll(items: ReadingListItem[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: items });
}

function toSummary(item: ReadingListItem): ReadingListSummary {
  const { id, url, title, addedAt } = item;
  return { id, url, title, addedAt };
}

/** Append a page to the queue and return the full list as summaries. */
export async function addItem(
  url: string,
  title: string,
  html: string,
): Promise<ReadingListSummary[]> {
  const items = await readAll();
  const item: ReadingListItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url,
    title: title || url,
    addedAt: Date.now(),
    html,
  };
  items.push(item);
  await writeAll(items);
  return items.map(toSummary);
}

/** Remove a queued page by id and return the remaining list as summaries. */
export async function removeItem(id: string): Promise<ReadingListSummary[]> {
  const items = (await readAll()).filter((item) => item.id !== id);
  await writeAll(items);
  return items.map(toSummary);
}

/**
 * Move a queued page to a new position and return the reordered summaries.
 * List order is chapter order, so this is how the user arranges the book.
 * An unknown id or out-of-range index leaves the list untouched rather than
 * throwing — the popup can race a removal against a drop.
 */
export async function reorderItem(
  id: string,
  toIndex: number,
): Promise<ReadingListSummary[]> {
  const items = await readAll();
  const fromIndex = items.findIndex((item) => item.id === id);
  if (fromIndex === -1 || toIndex < 0 || toIndex >= items.length) {
    return items.map(toSummary);
  }

  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  await writeAll(items);
  return items.map(toSummary);
}

export async function listSummaries(): Promise<ReadingListSummary[]> {
  return (await readAll()).map(toSummary);
}

/** Full items (with HTML snapshots) for conversion, in the order added. */
export async function listForConversion(): Promise<ReadingListItem[]> {
  return readAll();
}

/** Empty the queue — called once a book has been built and downloaded. */
export async function clear(): Promise<void> {
  await writeAll([]);
}
