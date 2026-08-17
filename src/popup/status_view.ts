import { ConversionStatus } from "../lib/messages";

export type StatusTone = "none" | "working" | "done" | "error";

export interface StatusView {
  text: string;
  tone: StatusTone;
  busy: boolean;
}

/**
 * Map a background conversion status to what the popup should render. Pure so
 * it can be unit-tested without the extension runtime.
 *
 * Copy follows the design system's voice: it says what is happening in the
 * user's words ("Building your book"), never the machine's ("Step 3/4").
 *
 * @example
 *   statusView({ state: "done", bookTitle: "Hi" }); // { text: 'Saved “Hi”.', … }
 */
export default function statusView(status: ConversionStatus): StatusView {
  switch (status.state) {
    case "idle":
      return { text: "", tone: "none", busy: false };
    case "converting":
      return {
        text: status.bookTitle
          ? `Building “${status.bookTitle}”…`
          : "Building your book…",
        tone: "working",
        busy: true,
      };
    case "done":
      return {
        text: `Saved “${status.bookTitle}” to your downloads.`,
        tone: "done",
        busy: false,
      };
    case "error":
      return { text: status.message, tone: "error", busy: false };
  }
}
