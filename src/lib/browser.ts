// Single import point for the extension API. webextension-polyfill normalises
// Chrome's chrome.* into the same promise-based browser.* shape Firefox uses
// natively, so the rest of the code never branches on callback vs. promise.
import browser from "webextension-polyfill";

export default browser;
