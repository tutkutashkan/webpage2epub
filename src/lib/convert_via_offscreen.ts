import browser from "./browser";
import {
  OffscreenConvertMessage,
  OffscreenConvertResponse,
  OffscreenConvertSucceeded,
  isFailure,
} from "./messages";

// The MV3 service worker has no DOM, so it delegates the actual conversion to
// an offscreen document. chrome.offscreen is Chrome-only and absent from
// webextension-polyfill — a deliberate, scoped exception to importing
// browser.ts everywhere else.

const OFFSCREEN_URL = "offscreen.html";

// Chrome rejects a second createDocument with this message. Catching it
// (rather than calling getContexts) keeps us off the newer API and avoids a
// minimum_chrome_version bump.
const ALREADY_EXISTS = "Only a single offscreen document";

async function ensureOffscreenDocument(): Promise<void> {
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification:
        "Build the queued pages into an EPUB using DOM APIs the service worker lacks.",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (!reason.includes(ALREADY_EXISTS)) {
      throw error;
    }
  }
}

/** Tear down the offscreen document, revoking any blob URLs it created. */
export async function closeOffscreenDocument(): Promise<void> {
  // Swallow "no offscreen document" races — closing an absent one is a no-op.
  await chrome.offscreen.closeDocument().catch(() => {});
}

/**
 * Build the queued pages into one EPUB in the offscreen document and return
 * the resulting blob URL plus book title. The offscreen document keeps the
 * blob alive until closeOffscreenDocument() runs.
 *
 * @example
 *   const { blobUrl, bookTitle } = await convertViaOffscreen(pages, "My Book");
 */
export default async function convertViaOffscreen(
  pages: { url: string; html: string }[],
  bookTitle?: string,
): Promise<OffscreenConvertSucceeded> {
  await ensureOffscreenDocument();

  const message: OffscreenConvertMessage = {
    type: "offscreen-convert",
    pages,
    bookTitle,
  };
  const response = (await browser.runtime.sendMessage(
    message,
  )) as OffscreenConvertResponse;

  if (isFailure(response)) {
    throw new Error(`Conversion failed: ${response.error}`);
  }
  return response;
}
