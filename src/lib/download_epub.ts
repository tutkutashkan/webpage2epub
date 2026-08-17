import browser from "./browser";

// Characters Chrome rejects in download filenames (path separators and
// reserved characters), collapsed to a single hyphen.
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]+/g;

/** Build a safe `<title>.epub` download filename from a book title. */
export function toEpubFilename(title: string): string {
  const base = title
    .trim()
    .replace(ILLEGAL_FILENAME_CHARS, "-")
    .replace(/\s+/g, " ");
  return `${base || "book"}.epub`;
}

/**
 * Invoke `onSettled` once the download reaches a terminal state, then stop
 * listening. Lets callers free the backing blob only after the bytes are
 * written, so we never pull data out from under an in-flight download.
 */
export function onDownloadSettled(
  downloadId: number,
  onSettled: () => void,
): void {
  const onChanged = (delta: browser.Downloads.OnChangedDownloadDeltaType) => {
    if (delta.id !== downloadId || !delta.state) {
      return;
    }
    if (
      delta.state.current === "complete" ||
      delta.state.current === "interrupted"
    ) {
      browser.downloads.onChanged.removeListener(onChanged);
      onSettled();
    }
  };
  browser.downloads.onChanged.addListener(onChanged);
}

/**
 * Start a download from an already-created blob URL and revoke that URL once
 * the download settles. The Chrome service worker cannot create blob URLs
 * itself — the offscreen document creates one and the service worker only
 * needs the string. The blob's owning context must stay alive until settle.
 *
 * @example
 *   await downloadFromBlobUrl(blobUrl, 'My Reading List', () => closeOffscreen());
 */
export default async function downloadFromBlobUrl(
  blobUrl: string,
  title: string,
  onSettled: () => void,
): Promise<number> {
  const downloadId = await browser.downloads.download({
    url: blobUrl,
    filename: toEpubFilename(title),
    saveAs: false,
  });

  onDownloadSettled(downloadId, onSettled);

  return downloadId;
}

/**
 * Save an EPUB blob, creating and revoking the object URL here. Used by the
 * Firefox background page, which — unlike the Chrome service worker — has the
 * DOM APIs to own the blob itself.
 *
 * @example
 *   await downloadEpubBlob(epubBlob, 'My Reading List');
 */
export async function downloadEpubBlob(
  epub: Blob,
  title: string,
): Promise<number> {
  const objectUrl = URL.createObjectURL(epub);
  return downloadFromBlobUrl(objectUrl, title, () =>
    URL.revokeObjectURL(objectUrl),
  );
}
