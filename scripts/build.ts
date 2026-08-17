import { rm, mkdir, copyFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";
import mergeManifest from "./merge_manifest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALL_BROWSERS = ["chrome", "firefox"] as const;
type Browser = (typeof ALL_BROWSERS)[number];

function buildTargets(browser: Browser): string[] {
  return browser === "firefox" ? ["firefox115"] : ["chrome111"];
}

// background runs on both browsers (Chrome service worker / Firefox background
// page); offscreen is Chrome-only and gated out of the Firefox build, which
// never references it (no manifest entry, inline conversion path instead).
function entryPoints(browser: Browser): Record<string, string> {
  const entries: Record<string, string> = {
    popup: join(root, "src/popup/popup.ts"),
    background: join(root, "src/background/background.ts"),
  };
  if (browser === "chrome") {
    entries.offscreen = join(root, "src/offscreen/offscreen.ts");
  }
  return entries;
}

// html2epub ships raw TS and imports a .png as a data URL
// (node_modules/html2epub/src/load_images.ts), so esbuild transpiles deps
// directly and maps .png -> dataurl. Output is ESM because the manifests'
// background entries and the HTML pages all load their scripts as modules.
async function bundleEntryPoints(
  browser: Browser,
  outDir: string,
): Promise<void> {
  await esbuild.build({
    entryPoints: entryPoints(browser),
    bundle: true,
    // Split shared deps (html2epub, jepub, jszip, the polyfill) into chunk
    // files so they are stored once instead of inlined into every entry point.
    splitting: true,
    format: "esm",
    target: buildTargets(browser),
    loader: { ".png": "dataurl" },
    outdir: outDir,
    logLevel: "info",
  });
}

async function copyIcons(outDir: string): Promise<void> {
  const iconsDir = join(root, "src/icons");
  const outIconsDir = join(outDir, "icons");
  await mkdir(outIconsDir, { recursive: true });
  // Only the generated sizes — never anything else that happens to sit in
  // the directory. The source artwork lives in assets/ for the same reason.
  const files = (await readdir(iconsDir)).filter((f) => /^icon\d+\.png$/.test(f));
  await Promise.all(
    files.map((f) => copyFile(join(iconsDir, f), join(outIconsDir, f))),
  );
}

// The design tokens and the popup's own stylesheet are plain CSS linked by
// popup.html, not imported through esbuild, so they are copied as-is. The
// fonts land in dist/fonts/ because tokens.css resolves its @font-face URLs
// relative to itself at the output root.
async function copyStyles(outDir: string): Promise<void> {
  await copyFile(
    join(root, "src/styles/tokens.css"),
    join(outDir, "tokens.css"),
  );
  await copyFile(
    join(root, "src/popup/popup.css"),
    join(outDir, "popup.css"),
  );

  const fontsDir = join(root, "src/fonts");
  const outFontsDir = join(outDir, "fonts");
  await mkdir(outFontsDir, { recursive: true });
  const fonts = (await readdir(fontsDir)).filter((f) => f.endsWith(".woff2"));
  await Promise.all(
    fonts.map((f) => copyFile(join(fontsDir, f), join(outFontsDir, f))),
  );
}

async function buildBrowser(browser: Browser): Promise<void> {
  const outDir = join(root, "dist", browser);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await bundleEntryPoints(browser, outDir);
  await copyFile(join(root, "src/popup/popup.html"), join(outDir, "popup.html"));
  // offscreen.html hosts the Chrome-only offscreen document; Firefox never
  // loads it, so it is gated out alongside its bundle.
  if (browser === "chrome") {
    await copyFile(
      join(root, "src/offscreen/offscreen.html"),
      join(outDir, "offscreen.html"),
    );
  }
  await copyIcons(outDir);
  await copyStyles(outDir);

  const manifest = await mergeManifest(browser);
  await writeFile(
    join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log(`Built dist/${browser}`);
}

const requested = process.argv[2];
if (requested && !(ALL_BROWSERS as readonly string[]).includes(requested)) {
  throw new Error(
    `Unknown browser "${requested}"; expected one of ${ALL_BROWSERS.join(", ")}`,
  );
}
const browsers: Browser[] = requested
  ? [requested as Browser]
  : [...ALL_BROWSERS];

await Promise.all(browsers.map(buildBrowser));
