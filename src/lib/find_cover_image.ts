// Picks a cover for the book from the first queued page's social-preview
// metadata. Parses the raw page HTML rather than reusing extract_page_content's
// output, because that pipeline cleans the document down to its main content
// and drops <head> — where these tags live.

// In source order: og:image is the most deliberate choice a publisher makes,
// twitter:image is its usual twin, and the itemprop/link forms are the older
// fallbacks still common on blogs.
const COVER_SELECTORS = [
  'meta[property="og:image"][content]',
  'meta[name="og:image"][content]',
  'meta[property="twitter:image"][content]',
  'meta[name="twitter:image"][content]',
  'meta[itemprop="image"][content]',
  'link[rel="image_src"][href]',
];

function findCoverUrl(html: string, pageUrl: string): string | null {
  const document = new DOMParser().parseFromString(html, "text/html");

  for (const selector of COVER_SELECTORS) {
    const element = document.querySelector(selector);
    const value = (
      element?.getAttribute("content") ?? element?.getAttribute("href")
    )?.trim();

    if (value) {
      try {
        return new URL(value, pageUrl).toString();
      } catch {
        // A malformed URL in one tag shouldn't stop the later candidates.
      }
    }
  }

  return null;
}

/**
 * Resolve and fetch a cover image for the book, or null when the page
 * advertises none / it can't be fetched. A missing cover is normal, not an
 * error — the book is still perfectly valid without one, so every failure
 * path here returns null rather than throwing.
 *
 * @example
 *   const cover = await findCoverImage(url, html, fetchImageAsBlob);
 */
export default async function findCoverImage(
  pageUrl: string,
  html: string,
  loadImageFrom: (url: string) => Promise<Blob>,
): Promise<Blob | null> {
  const coverUrl = findCoverUrl(html, pageUrl);
  if (!coverUrl) {
    return null;
  }

  try {
    const blob = await loadImageFrom(coverUrl);
    return blob.type.startsWith("image/") ? blob : null;
  } catch {
    return null;
  }
}
