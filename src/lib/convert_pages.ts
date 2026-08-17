import extractPageContent from "./extract_page_content";
import buildBook, { BuiltBook } from "./build_book";
import findCoverImage from "./find_cover_image";

// The whole conversion, in one place, for the two contexts that can run it:
// Chrome's offscreen document and Firefox's background page. Both have a DOM,
// which the pipeline needs; the Chrome MV3 service worker does not, which is
// the only reason the offscreen document exists.

// Runs in an extension-origin context, so the fetch is governed by the
// extension's host_permissions rather than the page's CSP — that is what lets
// cross-origin images (CDNs, other hosts) be embedded.
function fetchImageAsBlob(url: string): Promise<Blob> {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Image fetch failed for ${url}: HTTP ${response.status}`);
    }
    return response.blob();
  });
}

/**
 * Turn queued page snapshots into one EPUB: a chapter per page, in list order.
 *
 * @example
 *   const { title, epub } = await convertPages(pages, "My Reading List");
 */
export default async function convertPages(
  pages: { url: string; html: string }[],
  bookTitle?: string,
): Promise<BuiltBook> {
  const [extracted, cover] = await Promise.all([
    Promise.all(
      pages.map((page) =>
        extractPageContent(page.url, page.html, fetchImageAsBlob),
      ),
    ),
    // The first page is the book's front, so its social-preview image is the
    // most sensible automatic cover.
    findCoverImage(pages[0].url, pages[0].html, fetchImageAsBlob),
  ]);

  return buildBook(bookTitle ?? "", extracted, cover);
}
