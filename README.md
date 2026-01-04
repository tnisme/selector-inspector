# Locator Inspector

A Chrome extension that helps developers and QA engineers test and validate CSS selectors, XPath expressions, Playwright locators, and smart locators directly in the browser. The extension provides real-time inspection with visual highlighting of matched elements.

## Features

- 🔍 **Multiple Locator Types**: Support for CSS selectors, XPath, Playwright locators, and smart locators
- 🎯 **Real-time Inspection**: Live inspection as you type (debounced for performance)
- ✨ **Visual Highlighting**: Automatically highlights matched elements on the page with numbered badges
- 💾 **Persistent Storage**: Saves your locator type and value for quick access
- 🚀 **Fast & Lightweight**: Minimal performance impact with efficient querying
- 🎨 **Modern UI**: Clean, intuitive interface in the side panel

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked"
5. Select the extension directory
6. The extension icon will appear in your toolbar

## Usage

1. **Open the Extension**: Click the extension icon in your Chrome toolbar to open the side panel
2. **Select Locator Type**: Choose from:
   - CSS Selector
   - XPath
   - Playwright
   - Smart Locator
3. **Enter Your Locator**: Type your locator expression in the text area
4. **View Results**: 
   - Matched elements are automatically highlighted on the page
   - The result panel shows the count and details of found elements
   - Use "Refresh Inspection" button or `Ctrl/Cmd + Enter` to manually trigger

### Keyboard Shortcuts

- `Ctrl/Cmd + Enter`: Trigger inspection manually

## Supported Locator Types

### CSS Selector

Standard CSS selectors as supported by `document.querySelectorAll()`.

**Examples:**
```
div
.button
#myId
div.container > p
[data-testid="submit"]
```

### XPath

Full XPath 1.0 support using `document.evaluate()`.

**Examples:**
```
//div[@class='container']
//button[contains(text(), 'Submit')]
//*[@id='myId']
/html/body/div[1]/p[2]
```

### Playwright Locators

Supports common Playwright locator patterns:

- `getByRole(role)` - Find by ARIA role
- `getByText(text)` - Find by text content
- `getByTestId(id)` - Find by test ID (supports `data-testid`, `data-test-id`, `data-cy`)

**Examples:**
```
getByRole('button')
getByText('Submit')
getByTestId('submit-button')
```

### Smart Locator

Enhanced CSS selectors with additional pseudo-selectors:

- `:has(selector)` - Parent selector (CSS :has() support)
- `:contains('text')` - Find elements containing specific text
- `:has-text('text')` - Alternative text matching
- `:text-is('text')` - Exact text matching
- `:visible` - Visibility filtering

**Examples:**
```
div:has(button)
.button:contains('Submit')
div:has-text('Hello')
input:visible
```

## How It Works

1. **On-Demand Injection**: When you open the side panel, the extension injects engine scripts directly into the active tab using `chrome.scripting.executeScript`
2. **Side Panel Interface**: The popup interface runs in Chrome's side panel
3. **Real-time Querying**: As you type, the extension queries the page using the selected locator type
4. **Visual Feedback**: Matched elements are highlighted with red borders and numbered badges
5. **Result Display**: Detailed information about matched elements is shown in the result panel
6. **Cleanup**: When the side panel closes, all overlays are automatically cleaned up

## Architecture

```
selector-inspector/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (injects engines on-demand)
├── popup.html             # Side panel UI
├── popup/
│   ├── popup.js          # Main popup logic
│   ├── popup.ui.js       # UI event handlers
│   ├── popup.state.js    # State management
│   └── popup.inject.js   # Inspection logic
├── engine/
│   ├── cssEngine.js      # CSS selector engine
│   ├── xpathEngine.js    # XPath engine
│   ├── playwrightEngine.js # Playwright locator engine
│   ├── smartLocatorEngine.js # Smart locator engine
│   └── injector.js       # Main inspection orchestrator
└── page/
    ├── page.inspect.js   # Inspection utilities
    ├── page.overlay.js   # Overlay rendering
    ├── page.details.js   # Element details
    └── page.clear.js     # Cleanup utilities
```

## Limitations

- **Cross-origin Iframes**: Elements in cross-origin iframes cannot be accessed due to browser security (CORS)
- **Closed Shadow DOM**: Elements in closed shadow roots may not be accessible
- **Dynamic Content**: Elements added after page load may require manual refresh

## Development

### Project Structure

The extension uses:
- **Manifest V3**: Modern Chrome extension format
- **ES6 Modules**: For code organization
- **Chrome Scripting API**: For injecting engine scripts directly into pages (no web_accessible_resources needed)
- **Chrome Storage API**: For persisting user preferences
- **ActiveTab Permission**: Only works on the active tab when side panel is open

### Building

No build step required - the extension runs directly from source. Just load it as an unpacked extension.

## License

This project is open source and available for use and modification.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Version

Current version: **0.1**

---

**Note**: This extension requires permissions to access all websites (`<all_urls>`) to inject content scripts and query page elements. No data is collected or transmitted externally.
