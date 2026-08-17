import browser from "./browser";

// Embedding images means fetching them from whatever origin the page put
// them on — impossible to know in advance, so it can't be a fixed
// host_permissions list without asking for every site up front. Declaring
// <all_urls> as optional instead means the browser shows no prompt at
// install and Chrome Web Store review sees a permission the user opts into,
// not one every install carries silently.
//
// Without it, image fetches still run but are subject to normal cross-origin
// restrictions and mostly fail — extract_page_content.ts's per-image loader
// already catches that and falls back to a placeholder image (see
// load_images.ts's NO_IMAGE_DATA_URL), so a denied or skipped prompt still
// produces a complete book, just with fewer real images.
const IMAGE_HOST_PERMISSIONS = { origins: ["<all_urls>"] };

export function hasImageHostAccess(): Promise<boolean> {
  return browser.permissions.contains(IMAGE_HOST_PERMISSIONS);
}

/**
 * Ask the browser for cross-origin fetch access, if not already granted.
 * Must be called synchronously from a user-gesture handler (a click), which
 * is why both call sites — the popup's Save button and the "Save ePub book
 * now" context-menu item — request it as their first step rather than after
 * any other await.
 *
 * @example
 *   const granted = await ensureImageHostAccess();
 */
export async function ensureImageHostAccess(): Promise<boolean> {
  if (await hasImageHostAccess()) {
    return true;
  }
  try {
    return await browser.permissions.request(IMAGE_HOST_PERMISSIONS);
  } catch {
    // Firefox rejects permissions.request() outside a user-gesture call
    // stack (e.g. a background page that isn't itself the click target);
    // treat that the same as a decline rather than surfacing an error for a
    // book that will still build.
    return false;
  }
}
