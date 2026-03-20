# Changelog

All notable changes to this project will be documented in this file.

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
