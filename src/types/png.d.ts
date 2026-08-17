// Ambient module declaration for the .png import in html2epub's
// load_images.ts (bundled as raw TS — see extract_page_content.ts). Global
// ambient declarations apply to the whole TS program, so this also covers
// that node_modules import even though it isn't under src/.
declare module "*.png" {
  const src: string;
  export default src;
}
