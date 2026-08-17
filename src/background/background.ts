import browser from "../lib/browser";
import serializeActiveTab from "../lib/serialize_active_tab";
import downloadFromBlobUrl, { downloadEpubBlob } from "../lib/download_epub";
import convertViaOffscreen, {
  closeOffscreenDocument,
} from "../lib/convert_via_offscreen";
import * as readingList from "../lib/reading_list_store";
import { ensureImageHostAccess } from "../lib/image_host_permission";
import {
  AddActiveTabMessage,
  ConversionStatus,
  ConvertListMessage,
  GetConversionStatusMessage,
  GetReadingListMessage,
  ReadingListUpdateMessage,
  RemovePageMessage,
  ReorderPageMessage,
  StatusUpdateMessage,
} from "../lib/messages";

// Conversion (and the reading list itself) live in the background rather than
// the popup so dismissing the popup neither loses queued pages nor aborts an
// in-flight build. The popup and the page context menu both feed this one
// status/list stream, so either trigger stays in sync with the other.
//
// The same file runs in two environments and branches on DOM availability:
//   - Chrome: a service worker (no DOM) -> drives an offscreen document.
//   - Firefox: a background page (full DOM) -> converts inline.
const RUNS_IN_SERVICE_WORKER = typeof document === "undefined";

let currentStatus: ConversionStatus = { state: "idle" };

function publishStatus(status: ConversionStatus): void {
  currentStatus = status;
  const message: StatusUpdateMessage = { type: "status-update", status };
  // Rejects with "receiving end does not exist" when no popup is open; expected.
  void browser.runtime.sendMessage(message).catch(() => undefined);
}

async function publishReadingList(
  items: Awaited<ReturnType<typeof readingList.listSummaries>>,
): Promise<void> {
  const message: ReadingListUpdateMessage = {
    type: "reading-list-update",
    items,
  };
  void browser.runtime.sendMessage(message).catch(() => undefined);
}

function isType<T extends { type: string }>(
  type: T["type"],
): (message: unknown) => message is T {
  return (message: unknown): message is T =>
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === type;
}

const isAddActiveTab = isType<AddActiveTabMessage>("add-active-tab");
const isRemovePage = isType<RemovePageMessage>("remove-page");
const isReorderPage = isType<ReorderPageMessage>("reorder-page");
const isGetReadingList = isType<GetReadingListMessage>("get-reading-list");
const isConvertList = isType<ConvertListMessage>("convert-list");
const isGetConversionStatus = isType<GetConversionStatusMessage>(
  "get-conversion-status",
);

async function addActiveTabToList(): Promise<
  Awaited<ReturnType<typeof readingList.addItem>>
> {
  const { url, title, html } = await serializeActiveTab();
  return readingList.addItem(url, title, html);
}

// Firefox background page: full DOM + downloads API, so convert and save here.
//
// convert_pages pulls in html2epub, which references DOM globals (DOMParser,
// XMLSerializer, …) in its module body. It is loaded with a dynamic import so
// esbuild keeps it out of the worker's top-level evaluation: on Chrome this
// branch never runs, and a static import would bundle it into the worker and
// break registration with "DOMParser is not defined".
async function convertInlineAndDownload(
  pages: { url: string; html: string }[],
  bookTitle?: string,
): Promise<string> {
  const { default: convertPages } = await import("../lib/convert_pages");
  const { title, epub } = await convertPages(pages, bookTitle);
  await downloadEpubBlob(epub, title);
  return title;
}

// Chrome service worker: convert in the offscreen document, then download the
// blob URL it produced and close that document once the download settles.
async function convertInOffscreenAndDownload(
  pages: { url: string; html: string }[],
  bookTitle?: string,
): Promise<string> {
  const { blobUrl, bookTitle: title } = await convertViaOffscreen(
    pages,
    bookTitle,
  );
  await downloadFromBlobUrl(blobUrl, title, () => {
    void closeOffscreenDocument();
  });
  return title;
}

async function convertQueuedList(bookTitle?: string): Promise<void> {
  if (currentStatus.state === "converting") {
    return;
  }
  const queued = await readingList.listForConversion();
  if (queued.length === 0) {
    publishStatus({ state: "error", message: "No pages added yet." });
    return;
  }
  const pages = queued.map(({ url, html }) => ({ url, html }));

  publishStatus({ state: "converting", bookTitle });
  try {
    const title = RUNS_IN_SERVICE_WORKER
      ? await convertInOffscreenAndDownload(pages, bookTitle)
      : await convertInlineAndDownload(pages, bookTitle);
    await readingList.clear();
    await publishReadingList([]);
    publishStatus({ state: "done", bookTitle: title });
  } catch (error) {
    publishStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (isAddActiveTab(message)) {
    return addActiveTabToList().then((items) => {
      void publishReadingList(items);
      return items;
    });
  }
  if (isRemovePage(message)) {
    return readingList.removeItem(message.id).then((items) => {
      void publishReadingList(items);
      return items;
    });
  }
  if (isReorderPage(message)) {
    return readingList
      .reorderItem(message.id, message.toIndex)
      .then((items) => {
        void publishReadingList(items);
        return items;
      });
  }
  if (isGetReadingList(message)) {
    return readingList.listSummaries();
  }
  if (isConvertList(message)) {
    // Returning the promise keeps the MV3 worker alive until conversion ends.
    return convertQueuedList(message.bookTitle);
  }
  if (isGetConversionStatus(message)) {
    return Promise.resolve(currentStatus);
  }
  return undefined; // not ours — e.g. the offscreen document's own messages
});

// Context-menu entries mirror the popup's two actions so a user reading a
// page never has to open the popup just to queue it. Created on
// install/update (the only time a menu may be registered); removeAll first so
// an update doesn't trip "duplicate id". onClicked is wired up synchronously
// at top level so the listener exists when an MV3 worker wakes to handle a click.
const ADD_MENU_ID = "add-active-tab";
const CONVERT_MENU_ID = "convert-list";

async function registerContextMenus(): Promise<void> {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: ADD_MENU_ID,
    title: "Add page to ePub book",
    contexts: ["page"],
  });
  browser.contextMenus.create({
    id: CONVERT_MENU_ID,
    title: "Save ePub book now",
    contexts: ["page"],
  });
}

// Open the toolbar popup so the user sees the same progress/list they'd get
// from clicking the button. Best-effort: chrome.action.openPopup() needs
// Chrome 127+ (manifest min is 111) and a user gesture, so on older Chrome it
// throws — the action still completes and shows when the popup is opened
// manually. Called before any await so the click still counts as the gesture.
function openPopupForProgress(): void {
  void browser.action.openPopup?.().catch(() => undefined);
}

browser.runtime.onInstalled.addListener(() => {
  void registerContextMenus();
});

browser.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === ADD_MENU_ID) {
    openPopupForProgress();
    void addActiveTabToList().then((items) => void publishReadingList(items));
    return;
  }
  if (info.menuItemId === CONVERT_MENU_ID) {
    openPopupForProgress();
    // permissions.request() only carries user-activation from an event
    // Chrome itself dispatched with a gesture (this click) — that's lost the
    // moment an await separates it from the handler, so it goes first, before
    // convertQueuedList's own awaits (reading the list, etc.) get a chance to
    // spend it. The popup's Save button makes the same request from its own
    // click handler, since a runtime.sendMessage to here wouldn't carry it.
    void ensureImageHostAccess().finally(() => void convertQueuedList());
    return;
  }
  // another extension's menu item shares this bus — ignore it
});
