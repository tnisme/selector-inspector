/**
 * Context UI Management
 * Manages context selector UI and state in the popup
 */

import { triggerInspection } from './popup.inject.js';
import { showResult } from './popup.ui.js';
import { ContextTree } from '../context/contextModel.js';

let _activeContextId = 'frame-0'; // Default to top document
let _contextTree = null;
let _currentTabId = null;
let _lifecycleCleanup = null;

async function initContextUI() {
    const contextSelect = document.getElementById('context');
    const refreshBtn = document.getElementById('refreshContexts');

    // Load contexts on init
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
        _currentTabId = tabs[0].id;
        await loadContexts(tabs[0].id);
    }

    // Automatically refresh contexts when switching tabs in the same window
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        _currentTabId = activeInfo.tabId;
        await loadContexts(activeInfo.tabId);
    });

    // Context selection
    contextSelect.addEventListener('change', async (e) => {
        const contextId = e.target.value;
        await switchContext(contextId);
    });

    // Manual refresh
    refreshBtn.addEventListener('click', async () => {
        if (_currentTabId) {
            await loadContexts(_currentTabId);
            showResult('Contexts refreshed', 'info');
        }
    });

    // Hover preview (optional enhancement)
    contextSelect.addEventListener('mouseover', (e) => {
        if (e.target.tagName === 'OPTION' && e.target.value !== 'frame-0') {
            highlightIframe(e.target.value);
        }
    });

    contextSelect.addEventListener('mouseout', () => {
        clearIframeHighlight();
    });
}

async function loadContexts(tabId) {
    try {
        // Inject context scripts if not already loaded (for MAIN world usage)
        await ensureContextScriptsLoaded(tabId);

        // Discover contexts using webNavigation API
        const frames = await chrome.webNavigation.getAllFrames({ tabId });

        if (!frames || frames.length === 0) {
            throw new Error('No frames found');
        }

        const mainFrame = frames.find((f) => f.frameId === 0);
        if (!mainFrame) {
            throw new Error('Main frame not found');
        }

        const pageOrigin = new URL(mainFrame.url).origin;

        // Build tree using imported ContextTree class
        const tree = new ContextTree();
        tree.buildFromFrames(frames, pageOrigin);

        console.log('[Context] Discovered', frames.length, 'frames:', frames);
        console.log('[Context] Tree:', tree);

        _contextTree = tree;

        // Populate UI
        populateContextSelector(tree);

        // Restore saved context or default to top
        const saved = await getSavedContext(tabId);
        if (saved && tree.getContextById(saved)) {
            _activeContextId = saved;
        } else {
            _activeContextId = 'frame-0';
        }

        document.getElementById('context').value = _activeContextId;
        updateActiveContextIndicator();

        // Watch for changes
        if (_lifecycleCleanup) _lifecycleCleanup();
        _lifecycleCleanup = watchContextChangesLocal(tabId);
    } catch (error) {
        console.error('[Context] Load failed:', error);
        showResult(`Failed to load contexts: ${error.message}`, 'error');
    }
}

async function ensureContextScriptsLoaded(tabId) {
    try {
        // Check if ContextTree is already available
        const checkResult = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => typeof window.ContextTree,
            world: 'MAIN',
        });

        if (checkResult?.[0]?.result === 'function') {
            return; // Already loaded
        }

        // Inject context model script
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['context/contextModel.js'],
            world: 'MAIN',
        });

        console.log('[Context] Scripts injected into tab', tabId);
    } catch (error) {
        console.error('[Context] Failed to inject scripts:', error);
    }
}

function populateContextSelector(tree) {
    const select = document.getElementById('context');
    select.innerHTML = '';

    function addOption(context, depth = 0) {
        const option = document.createElement('option');
        option.value = context.id;

        // Use Unicode for indentation
        const indent = depth > 0 ? '  '.repeat(depth) + '↳ ' : '';
        option.textContent = indent + context.displayLabel;

        if (!context.isInspectable) {
            option.disabled = true;
            option.title =
                'Cross-origin iframe. Cannot inspect due to browser security.';
            option.style.opacity = '0.5';
        }

        // Add origin badge
        if (context.type === 'iframe') {
            const badge = context.originType === 'same-origin' ? ' 🟢' : ' 🔴';
            option.textContent += badge;
        }

        select.appendChild(option);

        // Add children recursively
        context.children.forEach((child) => addOption(child, depth + 1));
    }

    if (tree.root) {
        addOption(tree.root);
    }
}

async function switchContext(contextId) {
    _activeContextId = contextId;
    updateActiveContextIndicator();

    // Persist
    if (_currentTabId) {
        await saveContext(_currentTabId, contextId);
    }

    // Re-trigger inspection if locator exists
    const locator = document.getElementById('locator').value.trim();
    if (locator) {
        triggerInspection();
    }
}

function updateActiveContextIndicator() {
    const label = document.getElementById('activeContextLabel');
    const context = _contextTree?.getContextById(_activeContextId);

    if (context) {
        label.textContent = context.displayLabel;
        label.style.color = context.isInspectable ? 'var(--text)' : '#F44336';
    } else {
        label.textContent = 'Top Document';
        label.style.color = 'var(--text)';
    }
}

function watchContextChangesLocal(tabId) {
    const onCommitted = (details) => {
        if (details.tabId === tabId) {
            console.log('[Context] Frame event:', details.frameId);
            // Optionally refresh contexts on frame navigation
        }
    };

    const onCompleted = async (details) => {
        if (details.tabId === tabId && details.frameId === 0) {
            // Main frame navigation, refresh contexts
            console.log('[Context] Main frame navigated, refreshing contexts');
            await loadContexts(tabId);
        }
    };

    chrome.webNavigation.onCommitted.addListener(onCommitted);
    chrome.webNavigation.onCompleted.addListener(onCompleted);

    return () => {
        chrome.webNavigation.onCommitted.removeListener(onCommitted);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
    };
}

async function resetToTopDocument() {
    _activeContextId = 'frame-0';
    document.getElementById('context').value = 'frame-0';
    updateActiveContextIndicator();

    if (_currentTabId) {
        await saveContext(_currentTabId, 'frame-0');
    }
}

// Context persistence (simplified for MVP)
async function saveContext(tabId, contextId) {
    const key = `context_${tabId}`;
    await chrome.storage.local.set({ [key]: contextId });
}

async function getSavedContext(tabId) {
    const key = `context_${tabId}`;
    const result = await chrome.storage.local.get(key);
    return result[key];
}

function getActiveContextId() {
    return _activeContextId;
}

function getActiveContextLabel() {
    const context = _contextTree?.getContextById(_activeContextId);
    return context?.displayLabel || 'Top Document';
}

function getFrameIdFromContextId(contextId) {
    if (contextId === 'top' || !contextId || contextId === 'frame-0') return 0;
    return parseInt(contextId.replace('frame-', ''));
}

// Iframe preview (optional)
async function highlightIframe(contextId) {
    if (!_currentTabId) return;

    const frameId = getFrameIdFromContextId(contextId);
    if (frameId === 0) return;

    try {
        await chrome.scripting.executeScript({
            target: { tabId: _currentTabId },
            func: (_fId) => {
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach((iframe) => {
                    // This is a simplified approach - proper implementation would need frame tracking
                    iframe.style.outline = '3px dashed #2196F3';
                    iframe.style.outlineOffset = '2px';
                });
            },
            args: [frameId],
            world: 'MAIN',
        });
    } catch (error) {
        console.error('[Context] Highlight failed:', error);
    }
}

async function clearIframeHighlight() {
    if (!_currentTabId) return;

    try {
        await chrome.scripting.executeScript({
            target: { tabId: _currentTabId },
            func: () => {
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach((iframe) => {
                    iframe.style.outline = '';
                    iframe.style.outlineOffset = '';
                });
            },
            world: 'MAIN',
        });
    } catch (_error) {
        // Ignore errors
    }
}

export {
    initContextUI,
    loadContexts,
    switchContext,
    getActiveContextId,
    getActiveContextLabel,
    getFrameIdFromContextId,
    resetToTopDocument,
};
