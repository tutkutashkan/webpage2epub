import jEpub from "jepub";
import { ExtractedPage } from "./extract_page_content";

export interface BuiltBook {
  title: string;
  epub: Blob;
}

/**
 * Combine already-extracted pages into a single EPUB: one chapter per page,
 * in list order, with images deduped across pages (extract_page_content.ts
 * ids images by a hash of their URL, so the same image reused on two pages
 * collapses to one entry automatically via the Map key).
 *
 * @example
 *   const { title, epub } = await buildBook("My Reading List", pages);
 */
export default async function buildBook(
  bookTitle: string,
  pages: ExtractedPage[],
  cover: Blob | null = null,
): Promise<BuiltBook> {
  if (pages.length === 0) {
    throw new Error("Cannot build a book from an empty reading list.");
  }

  const jepub = new jEpub();
  const title = bookTitle.trim() || pages[0].title || "My Reading List";

  jepub.init({
    i18n: "en",
    title,
    author: "",
    publisher: "Webpage to ePub Book",
    description:
      pages.length === 1
        ? pages[0].title
        : `${pages.length} pages saved from the web.`,
    tags: [],
  });
  jepub.uuid(`webpage2epub-book-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  jepub.date(new Date());

  if (cover) {
    // A cover is a nicety, and jEpub rejects formats it can't type — never
    // let one bad image cost the user the whole book.
    try {
      jepub.cover(cover);
    } catch {
      // proceed without a cover
    }
  }

  const images = new Map<string, { blob: Blob }>();
  for (const page of pages) {
    for (const image of page.images) {
      if (!images.has(image.id)) {
        images.set(image.id, { blob: image.blob });
      }
    }
  }
  for (const [id, image] of images) {
    jepub.image(image.blob, id, {});
  }

  for (const page of pages) {
    jepub.add(page.title, page.contentHtml);
  }

  const epub = (await jepub.generate("blob")) as Blob;

  return { title, epub };
}
