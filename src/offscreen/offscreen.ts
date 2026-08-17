import browser from "../lib/browser";
import convertPages from "../lib/convert_pages";
import {
  OffscreenConvertMessage,
  OffscreenConvertResponse,
} from "../lib/messages";

// Runs in the Chrome offscreen document — a hidden full-DOM page the service
// worker spins up because the conversion pipeline references DOM globals the
// worker lacks. We convert here and hand back a blob URL (only this context
// can call createObjectURL); the service worker owns the chrome.downloads call.

function isOffscreenConvert(
  message: unknown,
): message is OffscreenConvertMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "offscreen-convert"
  );
}

async function convertToBlobUrl(
  message: OffscreenConvertMessage,
): Promise<OffscreenConvertResponse> {
  try {
    const { title, epub } = await convertPages(message.pages, message.bookTitle);
    return { blobUrl: URL.createObjectURL(epub), bookTitle: title };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isOffscreenConvert(message)) {
    return undefined; // not ours — let other listeners handle it
  }
  return convertToBlobUrl(message);
});
