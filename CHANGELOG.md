# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-05-02

### Added

- **Pick Element Button**: A dedicated "Pick Element" button lets you click any element on the live page to instantly receive locator suggestions, without typing anything first. Activating pick mode shows a dashed-border animated button and a status hint; clicking again cancels it.
- **DevTools-style Hover Highlight**: While in pick mode, hovering over the page shows a blue highlight box around the element under the cursor, with a floating info label displaying the tag name, id, class, and dimensions — matching the feel of browser DevTools element inspection.
- **Type-Aware Locator Suggestions**: The locator suggestion engine now generates candidates in the format matching the user's selected type. Selecting **CSS** produces pure CSS selectors; **XPath** produces XPath expressions (`//*[@data-testid="..."]`, `//tag[normalize-space()="..."]`); **Playwright** produces API calls (`getByTestId`, `getByRole`, `getByText`); **Smart** retains the previous behavior with Playwright pseudos (`:text-is()`, `:has-text()`, `:visible`).
- **Pseudo-Selector Auto-Narrowing**: When a candidate locator matches multiple elements, the suggestion engine automatically tries appending `:visible`, `:enabled`, `:checked` (smart mode) or `:enabled`, `:checked` (css mode) — including combinations — to find a unique match without user intervention.
- **Ancestor Context Narrowing**: When no unique locator can be found from the element's own attributes, the engine walks up the DOM (up to 5 levels) to find a stable ancestor anchor (`[data-testid]`, `#id`, `[role]`, or `tag.class`) and generates narrowed locators like `[data-testid="parent"] button`. XPath type uses XPath ancestor chaining (`//*[@data-testid="parent"]//button`).

### Changed

- **Suggestion Scoring**: Each suggested locator is now scored using the type it was generated for (CSS, XPath, Playwright, Smart) instead of always scoring as smart. Clicking a suggestion also sets the type dropdown to match the suggestion's format.
- **Multi-Match Handling**: When a locator matches more than one element and the score is below 80, the panel now shows a prompt directing the user to use "Pick Element" to inspect a specific one, rather than silently discarding suggestions.

## [0.2.0] - 2026-04-29

### Added

- **Locator Scorer**: A new static + live scoring engine (`src/scorer/locatorScorer.mjs`) that rates every locator from 0–100. Scores are shown in a collapsible panel with a per-rule breakdown (e.g. semantic anchor, dynamic tokens, positional selectors, DOM depth) and actionable improvement suggestions.
- **Live Score Updates**: Score recalculates immediately on every keystroke (static preview) and updates to a verified score after each inspection round-trip, reflecting actual match count and element metadata.
- **Inter Font**: Bundled Inter typeface for a cleaner, more readable UI.
- **DOM Depth Reporting**: Each matched element now reports its depth from `<body>` (`domDepth`), used by the scorer to penalise overly deep structural selectors.

### Changed

- **UI Redesign**: Full visual overhaul of `popup.html` — new layout, improved typography, tokenised CSS variables for syntax colours (`--syntax-tag`, `--syntax-id`, `--syntax-class`, `--syntax-attr`, `--syntax-text`), and a dedicated result header (`resultTitle`) showing match count or status.
- **Theme System**: Simplified theme toggling in `theme.js` using a new `li-theme` storage key. Icon and `data-theme` attribute now updated through a single `applyTheme()` helper.
- **Result Display**: Result area refactored into `resultWrap` / `resultBox` / `resultTitle` / `result` hierarchy. Item hover now uses `var(--item-hover)` instead of a hard-coded `rgba` value.

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
