import browser from "../lib/browser";
import {
  AddActiveTabMessage,
  ConversionStatus,
  ConvertListMessage,
  GetConversionStatusMessage,
  GetReadingListMessage,
  ReadingListSummary,
  ReadingListUpdateMessage,
  RemovePageMessage,
  ReorderPageMessage,
  StatusUpdateMessage,
} from "../lib/messages";
import statusView, { StatusTone } from "./status_view";
import icon from "./icons";
import { ensureImageHostAccess } from "../lib/image_host_permission";

// The popup is a passive view over the background's queue and conversion
// status: the background owns both, broadcasting every change, so the popup
// stays correct no matter which trigger (toolbar button or page context menu)
// changed them. Closing the popup mid-build no longer aborts it.

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element in popup.html`);
  }
  return element as T;
}

const addButton = requireElement<HTMLButtonElement>("add");
const list = requireElement<HTMLUListElement>("list");
const emptyHint = requireElement<HTMLParagraphElement>("empty-hint");
const reorderHint = requireElement<HTMLParagraphElement>("reorder-hint");
const titleInput = requireElement<HTMLInputElement>("book-title");
const saveButton = requireElement<HTMLButtonElement>("save");
const status = requireElement<HTMLParagraphElement>("status");

let latestStatus: ConversionStatus = { state: "idle" };
let latestItems: ReadingListSummary[] = [];

// Both buttons are labelled icon+text, and the label is rebuilt whenever its
// text changes, so each one owns a small builder rather than a textContent
// assignment that would wipe the icon.
function setButtonLabel(
  button: HTMLButtonElement,
  glyph: Parameters<typeof icon>[0],
  label: string,
  count?: number,
): void {
  button.textContent = "";
  button.append(icon(glyph, 16), label);
  if (count !== undefined) {
    const countEl = document.createElement("span");
    countEl.className = "count";
    countEl.textContent = String(count);
    button.append(countEl);
  }
}

const STATUS_ICONS: Record<StatusTone, Parameters<typeof icon>[0] | null> = {
  none: null,
  working: "loader-circle",
  done: "circle-check",
  error: "circle-alert",
};

function renderStatus(state: ConversionStatus): void {
  latestStatus = state;
  const view = statusView(state);

  status.textContent = "";
  status.classList.toggle("is-shown", view.tone !== "none");
  status.classList.toggle("is-working", view.tone === "working");
  status.classList.toggle("is-done", view.tone === "done");
  status.classList.toggle("is-error", view.tone === "error");

  const glyph = STATUS_ICONS[view.tone];
  if (glyph) {
    const wrapper = document.createElement("span");
    wrapper.className = "status-icon";
    wrapper.append(icon(glyph, 15));
    status.append(wrapper);
  }
  if (view.text) {
    const text = document.createElement("span");
    text.textContent = view.text;
    status.append(text);
  }

  addButton.disabled = view.busy;
  renderSaveButton();
}

function renderSaveButton(): void {
  saveButton.disabled =
    latestItems.length === 0 || latestStatus.state === "converting";
  setButtonLabel(
    saveButton,
    "download",
    "Save as EPUB",
    latestItems.length > 0 ? latestItems.length : undefined,
  );
}

// Id of the row currently being dragged. Held here rather than read back out
// of dataTransfer because dragover must decide drop styling, and dataTransfer
// payloads are unreadable during dragover for security reasons.
let draggingId: string | null = null;

function clearDropMarkers(): void {
  for (const li of Array.from(list.children)) {
    li.classList.remove("drop-before", "drop-after");
  }
}

function renderList(items: ReadingListSummary[]): void {
  latestItems = items;
  list.textContent = "";
  emptyHint.style.display = items.length === 0 ? "" : "none";
  // Reordering only means something once there are two chapters to reorder.
  reorderHint.style.display = items.length > 1 ? "" : "none";

  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.id = item.id;
    li.dataset.index = String(index);

    const handle = document.createElement("span");
    handle.className = "handle";
    handle.append(icon("grip-vertical", 16));

    const titleSpan = document.createElement("span");
    titleSpan.className = "item-title";
    titleSpan.textContent = item.title;
    titleSpan.title = item.url;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icon-btn";
    removeButton.append(icon("x", 15));
    removeButton.setAttribute("aria-label", `Remove ${item.title}`);
    removeButton.title = `Remove ${item.title}`;
    removeButton.addEventListener("click", () => removePage(item.id));

    li.addEventListener("dragstart", (event) => {
      draggingId = item.id;
      li.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", item.id);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
      }
    });

    li.addEventListener("dragend", () => {
      draggingId = null;
      li.classList.remove("dragging");
      clearDropMarkers();
    });

    li.addEventListener("dragover", (event) => {
      if (draggingId === null || draggingId === item.id) {
        return;
      }
      event.preventDefault(); // permits the drop
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      const midpoint = li.getBoundingClientRect().top + li.offsetHeight / 2;
      const dropBefore = event.clientY < midpoint;
      clearDropMarkers();
      li.classList.add(dropBefore ? "drop-before" : "drop-after");
    });

    li.addEventListener("drop", (event) => {
      event.preventDefault();
      const movedId = draggingId;
      clearDropMarkers();
      if (movedId === null || movedId === item.id) {
        return;
      }
      const midpoint = li.getBoundingClientRect().top + li.offsetHeight / 2;
      const dropBefore = event.clientY < midpoint;
      // splice-based reorder in the store removes the item first, so a target
      // that sits after the dragged row shifts up by one — account for that
      // here so the row lands exactly where the marker showed it would.
      const fromIndex = latestItems.findIndex((i) => i.id === movedId);
      let toIndex = dropBefore ? index : index + 1;
      if (fromIndex < toIndex) {
        toIndex -= 1;
      }
      reorderPage(movedId, toIndex);
    });

    li.append(handle, titleSpan, removeButton);
    list.append(li);
  });

  renderSaveButton();
}

function addCurrentPage(): void {
  const message: AddActiveTabMessage = { type: "add-active-tab" };
  void browser.runtime
    .sendMessage(message)
    .then((items) => renderList(items as ReadingListSummary[]))
    .catch(() => undefined);
}

function removePage(id: string): void {
  const message: RemovePageMessage = { type: "remove-page", id };
  void browser.runtime
    .sendMessage(message)
    .then((items) => renderList(items as ReadingListSummary[]))
    .catch(() => undefined);
}

function reorderPage(id: string, toIndex: number): void {
  const message: ReorderPageMessage = { type: "reorder-page", id, toIndex };
  void browser.runtime
    .sendMessage(message)
    .then((items) => renderList(items as ReadingListSummary[]))
    .catch(() => undefined);
}

function saveBook(): void {
  const message: ConvertListMessage = {
    type: "convert-list",
    bookTitle: titleInput.value.trim() || undefined,
  };
  // permissions.request() must run inside the click's own call stack — this
  // is that stack, so it's called first and awaited before anything else.
  // Declining it isn't fatal: conversion still runs, just with placeholder
  // images instead of the page's real ones. Fire and forget from here on —
  // the UI is driven by status-update broadcasts, and the background keeps
  // building even if this popup closes.
  void ensureImageHostAccess().finally(() => {
    void browser.runtime.sendMessage(message).catch(() => undefined);
  });
}

function isStatusUpdate(message: unknown): message is StatusUpdateMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "status-update"
  );
}

function isReadingListUpdate(
  message: unknown,
): message is ReadingListUpdateMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "reading-list-update"
  );
}

// A popup opened from the context menu may miss broadcasts that fired before
// its listener was ready, so it asks the background for a fresh snapshot on load.
async function loadCurrentState(): Promise<void> {
  const statusQuery: GetConversionStatusMessage = {
    type: "get-conversion-status",
  };
  const listQuery: GetReadingListMessage = { type: "get-reading-list" };

  const [status, items] = await Promise.all([
    browser.runtime.sendMessage(statusQuery) as Promise<
      ConversionStatus | undefined
    >,
    browser.runtime.sendMessage(listQuery) as Promise<
      ReadingListSummary[] | undefined
    >,
  ]);

  renderList(items ?? []);
  if (status) {
    renderStatus(status);
  }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (isStatusUpdate(message)) {
    renderStatus(message.status);
  }
  if (isReadingListUpdate(message)) {
    renderList(message.items);
  }
  return undefined;
});

setButtonLabel(addButton, "book-marked", "Add this page");
addButton.addEventListener("click", addCurrentPage);
saveButton.addEventListener("click", saveBook);
void loadCurrentState();
