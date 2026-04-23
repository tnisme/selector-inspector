# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4] - 2026-04-23

### Changed

- **Isolated Script Execution World**: All injected scripts now run in Chrome's `ISOLATED` world instead of `MAIN`. This prevents conflicts with the host page's JavaScript environment and aligns with Manifest V3 best practices.

### Fixed

- **Proactive Engine Injection**: On the first inspection attempt, engine scripts are now injected immediately alongside the `panel-opened` message rather than waiting for the next retry cycle, reducing startup latency.
- **Descriptive Load Errors**: When engine scripts fail to load in the target frame, the error message now includes the underlying reason and suggests re-selecting the context from the dropdown as a recovery step.

## [0.1.3] - 2026-04-02

### Added

- **Shadow DOM Inspection**: Native support for inspecting elements within open Shadow DOM boundaries across all locator engines (CSS, Playwright, and Smart Locator). Elements hidden in heavily nested web components can now be targeted seamlessly with selectors like `rect[fill='orange']`.

## [0.1.2] - 2026-03-20

### Added

- **Cross-Origin Iframe Inspection**: Unlocked the ability to inspect elements inside cross-origin iframes (like YouTube embeds, Ads) using the powerful Chrome Scripting API.
- **Auto-Refresh Contexts on Tab Switch**: The Side Panel now automatically detects when you switch browser tabs and instantly refreshes the DOM Contexts for the new page.

## [0.1.1] - 2026-02-03

### Fixed

- Smart Locator: Fixed handling of CSS combinators (`+`, `~`, `>`) and mixed chains after custom pseudo-selectors (e.g., `:has(...) + div`).

## [0.1.0] - 2026-01-20

### Added

- Initial public release
- Inspect element locators (CSS, XPath, Smart Locator)
- Popup UI with visual overlay
