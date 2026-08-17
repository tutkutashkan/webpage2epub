// Lucide icons (v0.469, ISC), inlined as path data.
//
// The design system loads Lucide from a CDN and wraps it in an Icon component.
// An extension can't: MV3 forbids remote scripts, and a popup should render
// without a network round-trip. So the handful of glyphs the popup uses are
// carried here as their Lucide path data, drawn with the system's own
// geometry — 24x24 viewBox, stroke 1.75, currentColor, no fills — so they are
// the same marks, not lookalikes.

const PATHS: Record<string, string> = {
  "book-marked":
    '<path d="M10 2v8l3-3 3 3V2"/><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  "grip-vertical":
    '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "circle-check":
    '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  "circle-alert":
    '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  "loader-circle":
    '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
};

/**
 * Build an inline Lucide SVG. Decorative by default (`aria-hidden`), because
 * every icon in this popup sits beside its own label or inside a button that
 * carries an aria-label.
 *
 * @example
 *   button.append(icon("download", 16));
 */
export default function icon(name: keyof typeof PATHS, size = 18): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.75");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = PATHS[name];
  return svg;
}
