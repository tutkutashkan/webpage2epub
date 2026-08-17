// Runs the "front half" of html2epub's own pipeline — DOM parse, cleanup,
// element replacement, main-content detection, image loading, link fixing —
// on one page, then stops short of html2epub's own createEpub step. That lets
// build_book.ts add every queued page as a chapter of ONE jEpub session
// instead of getting back N separate single-chapter EPUBs to merge.
//
// html2epub ships raw TS (package.json "main": "src/index.ts"), so its
// internal step modules are reachable via deep imports the same way the
// reference webpage-to-epub extension bundles the package itself — see
// html2epub's src/index.ts for the pipeline this mirrors.
import convertTextToDOM from "html2epub/src/convert_text_dom";
import getMetadataStep from "html2epub/src/get_metadata";
import cleanDocument from "html2epub/src/clean_document";
import replaceElements from "html2epub/src/replace_elements";
import getMainContent from "html2epub/src/get_main_content";
import loadImagesStepFactory from "html2epub/src/load_images";
import replaceUrlLinks from "html2epub/src/fix_links/replace_url_links";
import setExternalLinksBlank from "html2epub/src/fix_links/set_external_links_blank";
import { Step, Process } from "html2epub/src/step";

export interface ExtractedImage {
  id: string;
  blob: Blob;
  attributes: Record<string, string>;
}

export interface ExtractedPage {
  title: string;
  contentHtml: string;
  images: ExtractedImage[];
}

function getHtmlContent(element: Element): string {
  const xmlSerializer = new XMLSerializer();
  const domParser = new DOMParser();

  // Round-trip through XML then HTML, same as html2epub/src/index.ts: it
  // normalises the serialized markup (self-closing void tags, entity
  // escaping) into what jEpub's EJS templates expect.
  const htmlCode = xmlSerializer.serializeToString(element);
  const xhtmlElement = domParser.parseFromString(htmlCode, "text/html");
  const xhtmlCode = xmlSerializer.serializeToString(xhtmlElement);
  const xhtmlDocument = domParser.parseFromString(xhtmlCode, "text/html");

  return replaceCommentsImagesByImages(xhtmlDocument.body.innerHTML);
}

// load_images.ts replaces each <img> with an HTML comment placeholder
// (`<!-- <%= image['id'] %> -->`) so it survives DOM serialization; jEpub's
// own template syntax expects it unwrapped, so strip the comment markers here.
function replaceCommentsImagesByImages(content: string): string {
  return content
    .replace(/<!--\s*<%= image\[/g, "<%= image[")
    .replace(/] %>\s*-->/g, "] %>");
}

/**
 * Extract one page's readable content, ready to be added as a book chapter.
 *
 * @example
 *   const { title, contentHtml, images } = await extractPageContent(
 *     url, html, (imgUrl) => fetch(imgUrl).then((r) => r.blob()),
 *   );
 */
export default async function extractPageContent(
  url: string,
  html: string,
  loadImageFrom: (url: string) => Promise<Blob>,
): Promise<ExtractedPage> {
  const urlStep = new Step("URL step", () => url);
  const htmlStep = new Step("HTML step", () => html);
  const loadImages = loadImagesStepFactory(loadImageFrom);
  const wrapAsElementsStep = new Step(
    "Wrap main content as an element list",
    (mainElement: Element) => [mainElement],
  );
  // Process.process() only surfaces the LAST step's result, so the tails we
  // need (images from loadImages, the linked-fixed element, the title from
  // metadata) are combined here into the one ExtractedPage this function returns.
  const combineStep = new Step(
    "Combine extracted content",
    (
      images: ExtractedImage[],
      fixedElements: Element[],
      metadata: { title: string },
    ): ExtractedPage => ({
      title: metadata.title,
      contentHtml: getHtmlContent(fixedElements[0]),
      images,
    }),
  );

  const process = new Process([
    { step: urlStep },
    { step: htmlStep },
    { step: convertTextToDOM, dependencies: [htmlStep] },
    { step: getMetadataStep, dependencies: [convertTextToDOM, urlStep] },
    { step: cleanDocument, dependencies: [convertTextToDOM] },
    { step: replaceElements, dependencies: [convertTextToDOM] },
    { step: getMainContent, dependencies: [convertTextToDOM] },
    { step: loadImages, dependencies: [getMainContent, urlStep] },
    { step: wrapAsElementsStep, dependencies: [getMainContent] },
    { step: replaceUrlLinks, dependencies: [wrapAsElementsStep, urlStep] },
    { step: setExternalLinksBlank, dependencies: [replaceUrlLinks] },
    {
      step: combineStep,
      dependencies: [loadImages, setExternalLinksBlank, getMetadataStep],
    },
  ]);

  const noopLogger = { log: () => {}, error: () => {} };
  return (await process.process(
    () => {},
    noopLogger,
  )) as ExtractedPage;
}
