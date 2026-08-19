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

/**
 * Ask the browser for cross-origin fetch access. Must be called
 * synchronously from a user-gesture handler (a click) — no `await` before
 * this call, not even a fast one — which is why both call sites — the
 * popup's Save button and the "Save ePub book now" context-menu item —
 * request it as their very first step.
 *
 * There's deliberately no "already granted?" pre-check here: an earlier
 * version called permissions.contains() first and only requested if that
 * came back false. That contains() call resolves in a couple of
 * milliseconds, but Firefox still counts it as an intervening await and
 * spends the click's transient activation on it — request() then fails with
 * "may only be called from a user input handler", confirmed by testing a
 * real Firefox build. permissions.request() already resolves immediately
 * without prompting when every requested permission is already held (per the
 * WebExtensions spec, honoured by both browsers), so the pre-check bought
 * nothing and broke Firefox for it.
 *
 * @example
 *   const granted = await ensureImageHostAccess();
 */
export async function ensureImageHostAccess(): Promise<boolean> {
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
