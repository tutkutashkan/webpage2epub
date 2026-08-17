# Privacy Policy — Convert2EPUB

**Last updated:** August 17, 2026

Convert2EPUB ("the extension") is a browser extension that lets you collect
web pages into a reading list and save them as a single EPUB book. This
policy explains what data the extension touches and what it does with it.

## What data the extension reads

When you click **"Add this page"** (from the toolbar popup or the
right-click menu), the extension reads the content of the page you're
currently viewing — its URL, title, HTML content, and any images embedded
in the article — so it can turn that page into a chapter of your book.

The extension does **not** read any page you haven't explicitly added, and
it does not track your browsing history, activity, or the tabs you have
open otherwise.

## Where that data goes

Nowhere but your own device. Convert2EPUB has no backend server. Page
content you add is:

- Stored locally in your browser's extension storage, only for as long as
  it's queued in your reading list
- Converted into the EPUB file entirely on your device (in a local
  background/offscreen browser context)
- Cleared from storage once the book is saved (or whenever you remove a
  page or clear the list yourself)

The finished `.epub` file is saved to your device using your browser's own
downloads feature, the same way any other file download works.

## The one network permission, explained

To embed the images that appear in a saved article, the extension needs
permission to fetch images from whatever site each page's images are
hosted on. This permission (`<all_urls>`, used only for image loading) is
**optional** and is requested the first time you save a book — not at
install. If you decline it, or a particular image fails to load, the book
is still built successfully; it just won't include that image.

This permission is used solely to download the image files referenced by
pages you've added. It is never used to read, monitor, or collect data
about any other site you visit.

## What we don't do

- We don't sell, rent, or share your data with any third party.
- We don't run analytics or tracking of any kind.
- We don't require an account, sign-in, or any personal information to use
  the extension.
- We don't use your data for anything other than building the EPUB book
  you asked for.

## Changes to this policy

If this policy changes, the "Last updated" date above will change too.
Material changes will also be reflected in the extension's Chrome Web
Store listing.

## Contact

Questions about this policy or the extension can be sent to
[tutkutashkan@gmail.com](mailto:tutkutashkan@gmail.com), or filed as an
issue on the [GitHub repository](https://github.com/tutkutashkan/webpage2epub).
