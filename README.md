# Locator Inspector

A Chrome extension to test element locators (CSS, XPath, Playwright-like syntax) against live pages and visually verify matches.

## What This Is

Locator Inspector lets you:

- Test **CSS selectors** against live DOM with instant visual feedback
- Test **XPath expressions** (1.0 standard) with error reporting
- Test **Playwright-style locators** (`getByRole()`, `getByText()`, `getByTestId()`) via browser emulation
- Test **smart locator chains** (`selector >> descendant >> ...`) as a developer convenience
- See matches highlighted on the page with numbered badges
- Save your last locator and selected type automatically

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
2. Download the latest `.zip` file (e.g., `locator-inspector-0.1.0.zip`)
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

1. Click the extension icon → side panel opens
2. Select locator type: **CSS**, **XPath**, **Playwright**, or **Smart**
3. Enter your locator expression
4. Matched elements highlight on the page with numbered badges
5. Adjust and test until you have the right selector

**Keyboard shortcut**: `Ctrl + Enter` (Windows/Linux) or `Cmd + Enter` (macOS) to inspect without debounce.

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

## How It Works

### Architecture Overview

```
Extension UI (Chrome side panel)
    ↓
Content script injector (background.js)
    ↓
Page context (MAIN world isolation)
    ├── CSS engine (document.querySelectorAll)
    ├── XPath engine (document.evaluate)
    ├── Playwright emulation engine
    ├── Smart locator resolver
    └── Overlay renderer (visual highlights)
```

### Execution Flow

1. User opens extension → background service worker opens side panel
2. Panel sends `"panel-opened"` message → background injects content scripts
3. Content scripts load all four locator engines into page's MAIN world (not isolated)
4. User enters locator expression → UI sends to page context
5. Appropriate engine evaluates expression against live DOM
6. Matching elements highlighted with badges for 5 seconds
7. User closes panel → cleanup removes overlays and listeners

### Key Constraints

- **MAIN world injection**: Engines run in page context (not isolated sandbox) to access real DOM and render overlays. This means page JavaScript can see `window.__locatorEngines` and `window.__locatorInspect()`.
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
- [x] Live visual feedback on matches
- [x] Persistence of last locator/type
- [x] Light/dark theme toggle

### What We Do NOT Support

- [ ] Shadow DOM piercing (`.shadowRoot` traversal)
- [ ] Cross-origin iframes (browser security blocks this)
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

### Why MAIN World Injection?

Overlay rendering requires direct DOM access. Isolated world scripts cannot manipulate page DOM. **Trade-off**: Page scripts can interfere with the extension; no XSS protection.

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
| Shadow DOM not supported       | Requires `.shadowRoot` traversal; not implemented       | Cannot inspect web components                  |
| Cross-origin iframes blocked   | Browser security; content script injection fails        | Only inspect same-origin frames                |
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

| Permission   | Purpose                     |
| ------------ | --------------------------- |
| `scripting`  | Inject engines into pages   |
| `activeTab`  | Read active tab info        |
| `storage`    | Save locator type and value |
| `sidePanel`  | Display side panel UI       |
| `<all_urls>` | Inject into any website     |

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

**A**: Same-origin `<iframe>` may work (untested). Shadow DOM is not supported.

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
