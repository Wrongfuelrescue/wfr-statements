import '@testing-library/jest-dom/vitest'

// jsdom does not implement navigation. FortnightlyForm and MonthlyForm build
// a real <a href="blob:..."> and call .click() on it to trigger a PDF
// download — a legitimate browser pattern, not something under test — and
// jsdom logs "Not implemented: navigation to another Document" to the
// virtual console (which forwards to console.error) every time. That breaks
// this project's pristine-test-output constraint. The click is real user-
// facing behaviour worth keeping; only the navigation jsdom can't perform is
// irrelevant to what these tests assert, so it's stubbed out here at the
// test seam rather than suppressed via a console mock in each test file.
if (typeof HTMLAnchorElement !== 'undefined') {
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    // No-op: prevents jsdom's unimplemented navigation from firing at all.
  }
}
