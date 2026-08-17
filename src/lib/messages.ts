// Message contracts exchanged between extension contexts (popup, background
// service worker, Chrome offscreen document). Every message carries a
// distinct `type`; each listener early-returns on the ones it doesn't own
// since they all share one runtime.onMessage bus.

/** A page the user has queued for the current book. The `html` snapshot is
 * kept so conversion never re-fetches the page (which would lose auth/session
 * state and re-run scripts) — see serialize_active_tab.ts. */
export interface ReadingListItem {
  id: string;
  url: string;
  title: string;
  addedAt: number;
  html: string;
}

/** Lightweight view of a queued item for the popup list — no `html`, so the
 * popup never has to ship page snapshots back and forth over runtime.onMessage. */
export type ReadingListSummary = Omit<ReadingListItem, "html">;

/** popup or context menu -> background: snapshot the active tab and queue it. */
export interface AddActiveTabMessage {
  type: "add-active-tab";
}

/** popup -> background: drop a queued page. */
export interface RemovePageMessage {
  type: "remove-page";
  id: string;
}

/** popup -> background: move a queued page to a new position. List order is
 * chapter order in the finished book. */
export interface ReorderPageMessage {
  type: "reorder-page";
  id: string;
  toIndex: number;
}

/** popup -> background: what's currently queued? */
export interface GetReadingListMessage {
  type: "get-reading-list";
}

/** popup or context menu -> background: build the queued pages into one EPUB
 * and save it. `bookTitle` overrides the default (first page's title). */
export interface ConvertListMessage {
  type: "convert-list";
  bookTitle?: string;
}

/** popup -> background: what is the conversion doing right now? */
export interface GetConversionStatusMessage {
  type: "get-conversion-status";
}

export type ConversionStatus =
  | { state: "idle" }
  | { state: "converting"; bookTitle?: string }
  | { state: "done"; bookTitle: string }
  | { state: "error"; message: string };

/** background -> popup (broadcast): the conversion status changed. */
export interface StatusUpdateMessage {
  type: "status-update";
  status: ConversionStatus;
}

/** background -> popup (broadcast): the reading list changed (add/remove). */
export interface ReadingListUpdateMessage {
  type: "reading-list-update";
  items: ReadingListSummary[];
}

/** background -> offscreen (Chrome only): build these pages into one EPUB. */
export interface OffscreenConvertMessage {
  type: "offscreen-convert";
  pages: { url: string; html: string }[];
  bookTitle?: string;
}

export interface OffscreenConvertSucceeded {
  blobUrl: string;
  bookTitle: string;
}

export interface OperationFailed {
  error: string;
}

export type OffscreenConvertResponse =
  | OffscreenConvertSucceeded
  | OperationFailed;

export function isFailure(response: unknown): response is OperationFailed {
  return (
    typeof response === "object" &&
    response !== null &&
    typeof (response as { error?: unknown }).error === "string"
  );
}
