# Locator Inspector

A Chrome extension to test element locators (CSS, XPath, Playwright-like syntax) against live pages and visually verify matches.

## What This Is

Locator Inspector lets you:

- Test **CSS selectors** against live DOM with instant visual feedback
- Test **XPath expressions** (1.0 standard) with error reporting
- Test **Playwright-style locators** (`getByRole()`, `getByText()`, `getByTestId()`) via browser emulation
- Test **smart locator chains** (`selector >> descendant >> ...`) as a developer convenience
- **Inspect inside iframes** seamlessly using the explicit DOM Context dropdown (supports both same-origin 🟢 and cross-origin 🔴)
- **Deep search into Shadow DOM** seamlessly across CSS, Playwright, and Smart Locators
- See matches highlighted on the page with numbered badges
- **Score your locators** (0–100) with a per-rule breakdown and actionable suggestions — updated live as you type and verified after each inspection
- **Pick Element** — click any element on the page with a DevTools-style hover highlight and instantly receive ranked locator suggestions
- **Type-aware suggestions** — suggestions are generated in the format of your selected type (CSS, XPath, Playwright, or Smart), validated against that type's engine, and scored accordingly
- **DevTools Panel** — open as a full Chrome DevTools panel (DevTools → "Locator Inspector" tab) with the same UI as the side panel
- **Elements Panel Sidebar** — a "Locators" pane inside the DevTools Elements panel: select any element to see scored, type-tagged locator suggestions, copy them, or send them directly to the panel for inspection

**Intended use**: Rapid validation of selectors during test development. Not a replacement for running actual test code.

## What This Is NOT

- **Not Playwright.js**: This extension emulates basic Playwright locator syntax in the browser. It does not execute Playwright locator logic. Use actual Playwright/Cypress/Selenium for real test execution.
- **Not a test recorder**: Does not capture user actions or generate test code.
- **Not a production inspector**: For development/test authoring only.
- **Not a full element inspector**: Does not show DOM tree, computed styles, or event listeners.

---

## Installation

### From Release (Recommended)

1. Go to [Releases](https://github.com/tnisme/selector-inspector/releases)
2. Download the latest `.zip` file (e.g., `locator-inspector-0.4.0.zip`)
3. Extract to any folder (e.g., `~/Downloads/locator-inspector/`)
4. Open Chrome → `chrome://extensions/` → Enable **Developer mode** (top right)
5. Click **Load unpacked** → Select the extracted folder
6. Icon appears in your toolbar

### From Source (Development)

```bash
git clone <repository>
cd selector-inspector
npm run build
# Output: dist/locator-inspector/
# Then: chrome://extensions/ → Load unpacked → select dist/locator-inspector/
```

---

## Quick Start

### Side Panel
1. Click the extension icon → side panel opens
2. Select locator type: **CSS**, **XPath**, **Playwright**, or **Smart**
3. Select your target **DOM Context** (Target the Top Document or choose a specific iframe)
4. Enter your locator expression and press **Enter** to inspect, or click **Pick Element** to click an element directly on the page
5. Matched elements highlight on the page with numbered badges
6. If the score is below 80, the suggestion panel surfaces ranked alternative locators in your selected type
7. Click a suggestion to apply it and re-inspect instantly

### DevTools Panel
1. Open Chrome DevTools (`F12` / `Cmd+Option+I`) → click the **"Locator Inspector"** tab
2. The same UI as the side panel is available here — type locators and inspect against the DevTools-inspected page

### Elements Panel Sidebar
1. Open Chrome DevTools → **Elements** panel → click the **"Locators"** tab in the right sidebar
2. Select any element in the Elements tree → ranked locator suggestions appear instantly
3. Click a selector text to copy it; use the → button to send it to the Locator Inspector panel; use the eye button to highlight matching elements on the page

---

## Intended Workflow

1. Identify candidate selector using Locator Inspector
2. Verify uniqueness and scope visually
3. Copy selector into your test code
4. Validate behavior in your actual test framework

---

## Supported Locators

### CSS Selectors

Standard `document.querySelectorAll()` syntax. Errors reported with specific message.

**Examples**: `.button`, `#submit`, `input[type="text"]`, `div > span:first-child`

### XPath (1.0)

Standard XPath 1.0 via `document.evaluate()` with `ORDERED_NODE_SNAPSHOT_TYPE`.

**Examples**: `//button[text()="Submit"]`, `//div[@class="header"]//span`, `//input[@id]`

### Playwright Locators (Emulated)

**WARNING**: This is a browser-side emulation. Real Playwright.js may behave differently.

**Supported**:

- `getByRole(role)` — Matches `[role="role"]` + semantic elements (`<button>`, `<input>`, etc.)
- `getByText(text)` — Matches elements containing exact text (case-sensitive)
- `getByTestId(id)` — Matches `[data-testid]`, `[data-test-id]`, or `[data-cy]`

**Not supported**: `getByPlaceholder()`, `getByLabel()`, `getByAltText()`, `getByTitle()`, `getByPlaceholder()`, locator chains with `.and()`, `.or()`, `.not()`, etc.

### Smart Locators

Playwright-like chain syntax: `selector >> descendant >> another`

Useful for readability during test development. Evaluates left-to-right with context passing.

**Examples**: `button >> text=Submit`, `div.panel >> input[type="text"]`, `form >> :has(> label)`

---

## Locator Suggestions

When the live score falls below 80, the suggestion panel opens automatically with ranked alternative locators.

### Pick Element

Click **Pick Element** to enter pick mode. While active:

- Hover over the page to see a **blue highlight box** and a floating label showing `tag#id.class  W × H` (identical to DevTools element inspection)
- Click any element to instantly receive suggestions for it
- Click **Cancel Pick** (or the button again) to exit without selecting

### Type-Aware Suggestions

Suggestions are generated in the format of the currently selected locator type:

| Type | Example suggestion |
|---|---|
| **CSS** | `[data-testid="submit-btn"]`, `button[type="submit"]:enabled` |
| **XPath** | `//*[@data-testid="submit-btn"]`, `//button[normalize-space()="Submit"]` |
| **Playwright** | `getByTestId("submit-btn")`, `getByRole("button")` |
| **Smart** | `[data-testid="submit-btn"]:visible`, `button:text-is("Submit")` |

Clicking a suggestion applies it to the locator field **and** updates the type dropdown to match, so inspection runs in the correct mode.

### How Suggestions Are Generated

1. **Candidate generation** — attributes are extracted from the element and mapped to type-specific locator patterns (test ids, roles, aria labels, text, name, placeholder, class, etc.)
2. **Validation** — each candidate is tested against the live DOM using the appropriate engine; only candidates that actually match the target element are kept
3. **Pseudo narrowing** — non-unique candidates are retried with `:visible`, `:enabled`, `:checked` appended (smart/css modes) to find a unique match automatically
4. **Ancestor narrowing** — if no unique locator is found, the engine walks up to 5 ancestor levels looking for a stable anchor (`[data-testid]`, `#id`, `[role]`, `tag.class`) and combines it with the candidate: e.g. `[data-testid="modal"] button`
5. **Scoring & ranking** — each suggestion is scored using the same 0–100 engine as the main locator field, with unique matches ranked first

---

## How It Works

### Architecture Overview

```
Extension UI
  ├── Chrome Side Panel (popup.html)          ← sendMessage lifecycle
  └── Chrome DevTools
        ├── DevTools Panel (popup.html)        ← port: devtools-panel
        └── Elements Sidebar (sidebar.html)    ← port: sidebar-pane
              ↑ data from devtools.js          ← port: devtools-sidebar
    ↓
Background service worker (background.js)
    ↓
Content script injector
    ↓
Page context (ISOLATED world)
    ├── CSS engine (document.querySelectorAll)
    ├── XPath engine (document.evaluate)
    ├── Playwright emulation engine
    ├── Smart locator resolver
    ├── Candidate generator (type-aware)
    ├── Suggestion engine (validate + narrow + score)
    └── Overlay renderer (visual highlights + pick mode)
```

### Execution Flow

#### Side Panel
1. User opens extension → background service worker opens side panel
2. Panel sends `"panel-opened"` message → background injects content scripts
3. Content scripts load all engines into the page's ISOLATED world
4. User enters locator expression (or picks an element) → UI sends to page context
5. Appropriate engine evaluates expression against live DOM
6. Matching elements highlighted with badges for 5 seconds
7. If score < 80, suggestion engine runs and surfaces ranked alternatives
8. User closes panel → cleanup removes overlays and listeners

#### DevTools Panel / Elements Sidebar
1. `devtools.html` loads `devtools.js` → creates the "Locator Inspector" panel and "Locators" Elements sidebar pane
2. `devtools.js` connects to background via `devtools-sidebar` port, sends `INIT { tabId }`
3. Background injects content scripts into the inspected tab
4. User selects an element in the Elements panel → `devtools.js` runs `ANALYSIS_CODE` via `inspectedWindow.eval` (main world) to get basic suggestions + element XPath path
5. `devtools.js` sends `GET_SMART_SUGGESTIONS` to background → background executes `window.__suggestLocators` in ISOLATED world using the XPath to re-locate the element → returns smart suggestions
6. Merged, deduplicated, re-scored suggestions are sent as `SIDEBAR_UPDATE` → background relays to `sidebar.html` via `sidebar-pane` port
7. "Use in Panel" from sidebar → background forwards to panel port as `ELEMENT_SUGGESTIONS`
8. "Highlight" from sidebar → background executes `window.__locatorInspect` in ISOLATED world

### Key Constraints

- **ISOLATED world injection**: Engines run in Chrome's isolated script world, separate from page JavaScript. Page scripts cannot interfere with `window.__locatorEngines` or `window.__locatorInspect()`.
- **300ms debounce**: Reduces excessive DOM queries while typing; manual `Ctrl+Enter` bypasses this.
- **5-second highlights**: Auto-cleanup prevents UI clutter; type a new locator to re-highlight.
- **Single active tab**: Only the currently active tab is inspected; switching tabs requires re-activation.

---

## Scope & Non-Goals

### What We Support

- [x] Standard CSS selectors
- [x] XPath 1.0 expressions
- [x] Basic Playwright locator emulation (3 types)
- [x] Simple smart locator chains (`>>` operator)
- [x] Execute locators inside same-origin and cross-origin iframes
- [x] Shadow DOM piercing (`.shadowRoot` traversal)
- [x] Live visual feedback on matches
- [x] Persistence of last locator/type
- [x] Light/dark theme toggle
- [x] Locator quality scoring (0–100) with breakdown and suggestions
- [x] Pick Element mode with DevTools-style hover highlight
- [x] Type-aware locator suggestions (CSS, XPath, Playwright, Smart)
- [x] Pseudo-selector auto-narrowing (`:visible`, `:enabled`, `:checked`)
- [x] Ancestor context narrowing for elements with no unique own attributes
- [x] Chrome DevTools panel (same popup UI as a DevTools tab)
- [x] Elements panel "Locators" sidebar pane (per-element suggestions, copy, highlight, "Use in Panel")

### What We Do NOT Support

- [ ] Playwright's full locator API (many locators not emulated)
- [ ] XPath/CSS context awareness within chains
- [ ] Recording actions or generating test code
- [ ] Exporting selectors to test frameworks
- [ ] Dynamic re-highlighting on DOM mutations
- [ ] Performance optimization for massive DOMs (100K+ elements)

---

## Design Decisions & Trade-offs

### Why Browser-Side Emulation, Not Playwright API?

The extension has no Node.js runtime or bundler. Emulating Playwright syntax in the browser is the only practical approach. **Consequence**: Behavior may diverge from real Playwright. Always validate selectors in your actual test framework.

### Why 300ms Debounce?

Prevents excessive DOM queries while typing. **Trade-off**: Less responsive than instant evaluation. Keyboard shortcut available for manual trigger.

### Why ISOLATED World Injection?

Engines run in Chrome's ISOLATED world so page scripts cannot interfere with `window.__locatorEngines` or the overlay state. **Trade-off**: Slightly more complex communication between the popup and page context via `chrome.scripting.executeScript`.

### Why Single Active Tab?

Content scripts are injected per-tab. Inspecting inactive tabs requires switching focus. **Simplifies**: Tab management logic; reduces resource usage.

### Why 5-Second Highlight Timeout?

Prevents overlays from accumulating if user forgets them. **Trade-off**: Cannot persist highlights across multiple inspections without re-typing.

---

## Known Limitations

### Selector Evaluation

| Issue                               | Reason                                                      | Workaround                                              |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| XPath errors cryptic                | Only returns `error.message`; no parse tree                 | Check syntax in browser DevTools console                |
| Playwright emulation incomplete     | Only 3 locator types; no `.and()`, `.or()`                  | Use CSS/XPath for complex selectors; test in Playwright |
| CSS/XPath context ignored in chains | Smart locator `>>` doesn't pass context to CSS/XPath engine | Use Playwright chains which support context             |
| Case-sensitive text matching        | `getByText()` does exact match, not case-insensitive        | Manually test case variations                           |

### DOM & Page Context

| Issue                          | Reason                                                  | Impact                                         |
| ------------------------------ | ------------------------------------------------------- | ---------------------------------------------- |
| Dynamic DOM not re-highlighted | No mutation observer; highlights only on manual trigger | Manual re-trigger needed for AJAX updates      |
| Large DOMs may freeze UI       | No optimization for 100K+ element pages                 | Try limiting selector scope (tag, class, etc.) |

### Performance & Resource

| Issue                                         | Reason                                                 | Consequence                                   |
| --------------------------------------------- | ------------------------------------------------------ | --------------------------------------------- |
| Overlay calculation not throttled             | `getBoundingClientRect()` called per element on scroll | Scrolling may lag on pages with many matches  |
| Smart locator recursive parsing not optimized | Single-pass engine; no caching or optimization         | Complex chains may be slow                    |
| No pagination for large result sets           | All matches rendered as overlays                       | UI clutter if selector matches 1000+ elements |

### Browser & Platform

| Constraint          | Details                                                         |
| ------------------- | --------------------------------------------------------------- |
| Chrome only         | Manifest V3 Windows/macOS/Linux; no Edge/Firefox/Safari support |
| Chrome 90+ required | Manifest V3 introduced in Chrome 91                             |
| No offline mode     | Requires active page and live DOM                               |

---

## Release & Versioning

### Version 0.4.0 (Jun 2026)

**Status**: Feature release. Adds the Chrome DevTools panel (popup UI reused as a DevTools tab) and the Elements panel "Locators" sidebar pane (per-element locator suggestions with scoring, filtering, copy, highlight, and "Use in Panel"). Background extended with three new port connections and pending-data queuing.

### Version 0.3.0 (May 2026)

**Status**: Feature release. Adds the Pick Element button with DevTools-style hover highlight, type-aware locator suggestions (CSS/XPath/Playwright/Smart), pseudo-selector auto-narrowing, and ancestor context narrowing. Breaking changes possible without notice.

### Version 0.2.0 (Apr 2026)

**Status**: Feature release. Adds the Locator Scorer, a full UI redesign, Inter font, and DOM depth reporting. Breaking changes possible without notice.

### Version 0.1.0 (Jan 2026)

**Status**: Initial release. Breaking changes possible without notice.

**What 0.x means**: Experimental. Core behavior, API, and UI may change. **Not** a stable release.

### Release Process

- Manual via GitHub Releases
- ZIP contains pre-built `dist/locator-inspector/` ready to load
- No auto-update; users manually download new versions
- No Chrome Web Store distribution (yet)

### Version Updates

Versions manually updated in:

1. `manifest.json` (`version` field)
2. `CHANGELOG.md`

No semantic versioning guarantees; features may be added/removed in point releases.

---

## Technical Details

### Requirements

- **Chrome**: 90+ (Manifest V3)
- **OS**: Windows, macOS, Linux
- **JavaScript**: ES6+ (no TypeScript)

### Permissions

| Permission      | Purpose                                           |
| --------------- | ------------------------------------------------- |
| `scripting`     | Inject engines into pages                         |
| `activeTab`     | Read active tab info                              |
| `storage`       | Save locator type and value                       |
| `sidePanel`     | Display side panel UI                             |
| `webNavigation` | Detect page navigations for DevTools integration  |
| `<all_urls>`    | Inject into any website                           |

### Storage

- **Locator type & value**: Saved to `chrome.storage.local` (browser-managed, per-profile)
- **Theme preference**: Saved to `localStorage` (page-scoped; cleared on site data clear)
- **No cloud sync**: All data stays on your machine

### Dependencies

- **Runtime**: None (uses only Chrome APIs and browser globals)
- **Build**: Node.js 14+, standard library only (`fs`, `path`)
- **Development**: None

---

## Contributing

### Current State

This is an open-source hobby project. It is **not optimized for external contributions** yet:

- No `CONTRIBUTING.md`
- No issue templates
- No PR templates
- No code of conduct
- No CI/CD or automated testing
- Manual review and testing only

### License

**No LICENSE file in repository.** Legal status unclear. If you want to:

- **Fork**: Ask the maintainer
- **Use in commercial product**: Ask the maintainer
- **Contribute**: Ask the maintainer

Recommended: Suggest the maintainer add MIT, Apache 2.0, or GPL 3.0 before accepting contributions.

### If You Want to Contribute

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes, rebuild: `npm run build`
4. Test manually in Chrome with load unpacked
5. Commit with clear messages
6. Submit a pull request with a detailed description

---

## Testing & Stability

### What's Tested

- Manual testing only: Open in Chrome, inspect real pages

### What's NOT Tested

- No unit tests
- No integration tests
- No E2E tests
- No automated CI/CD
- No test coverage
- No regression testing

### Before Using in Production

1. **Test with your real test framework** (Playwright, Cypress, etc.)
2. **Verify selector behavior** is identical to your test framework
3. **Assume browser-side emulation may differ** from actual runtime

---

## FAQ

### Q: Can I use this to write my tests?

**A**: No. Use it to **find** selectors during test authoring. Always run tests in your actual test framework (Playwright, Cypress, Selenium).

### Q: Does this work on `<iframe>` or `<shadow-root>`?

**A**: Yes! Full support is available for both same-origin and cross-origin iframes via the explicit "DOM Context" dropdown. Shadow DOM inspection is fully supported natively using recursive `.shadowRoot` traversal across all locator engines.

### Q: My selector works here but not in Playwright. Why?

**A**: This extension emulates basic Playwright syntax in the browser. Real Playwright.js may behave differently due to:

- Different scoping rules
- Stricter element visibility checks
- Unimplemented locator types (e.g., `getByLabel`)

Always test in your actual test framework.

### Q: Can I export selectors to my test file?

**A**: No. Copy-paste from the extension; we don't export test code.

### Q: Is my data safe?

**A**: Yes. Everything stays in your browser. No external API calls, no cloud storage, no telemetry.

---

## Troubleshooting

### Extension icon doesn't appear

- **Check**: `chrome://extensions/` → Ensure Locator Inspector is **enabled**
- **Try**: Reload: `chrome://extensions/` → Reload button next to the extension

### Locator doesn't match anything

- **Check**: Reload the page (`F5` or `Cmd + R`)
- **Check**: Switch to a different locator type (CSS → XPath, etc.) to verify the page loads
- **Check**: Try a simple selector first (e.g., `body`, `div`, `p`)

### Overlays disappear too fast

- **Expected**: Overlays auto-disappear after 5 seconds
- **Try**: Type a new locator to re-inspect

### Performance is slow

- **Check**: Page has many matches (try a more specific selector)
- **Check**: Page has 100K+ DOM elements (this may not perform well)
- **Try**: Use browser DevTools console to verify selector directly: `document.querySelectorAll('...')`

---

## Support & Feedback

- **Report a bug**: [Issues](../../issues)
- **Request a feature**: [Issues](../../issues)
- **View source**: [GitHub](../../)

---

Designed as a practical aid during test authoring, not as a source of truth.
