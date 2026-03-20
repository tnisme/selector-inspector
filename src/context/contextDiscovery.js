/**
 * Context Discovery Engine
 * Discovers and tracks iframe contexts using chrome.webNavigation API
 */

import { ContextTree } from './contextModel.js';

/**
 * Discover all frames in a tab using chrome.webNavigation.getAllFrames()
 * @param {number} tabId
 * @returns {Promise<ContextTree>}
 */
async function discoverContexts(tabId) {
    try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId });

        if (!frames || frames.length === 0) {
            throw new Error('No frames found');
        }

        // Get page origin from main frame (frameId: 0)
        const mainFrame = frames.find((f) => f.frameId === 0);
        if (!mainFrame) {
            throw new Error('Main frame not found');
        }

        const pageOrigin = new URL(mainFrame.url).origin;

        const tree = new ContextTree();
        tree.buildFromFrames(frames, pageOrigin);

        console.log('[Context Discovery] Found', frames.length, 'frames');
        return tree;
    } catch (error) {
        console.error('[Context Discovery] Failed:', error);
        throw error;
    }
}

/**
 * Watch for frame lifecycle events
 * @param {number} tabId
 * @param {Function} onContextChanged - Callback when contexts change
 * @returns {Function} Cleanup function to remove listeners
 */
function watchContextChanges(tabId, onContextChanged) {
    // Listen for frame creation/navigation
    const onCommitted = (details) => {
        if (details.tabId === tabId) {
            console.log('[Context] Frame event:', details.frameId, details.url);
            onContextChanged('frame_committed', details.frameId);
        }
    };

    // Listen for navigation completion (to detect removed frames)
    const onCompleted = async (details) => {
        if (details.tabId === tabId && details.frameId === 0) {
            // Main frame navigation completed, refresh all contexts
            try {
                const tree = await discoverContexts(tabId);
                onContextChanged('frames_updated', tree);
            } catch (error) {
                console.error('[Context] Failed to refresh on navigation:', error);
            }
        }
    };

    chrome.webNavigation.onCommitted.addListener(onCommitted);
    chrome.webNavigation.onCompleted.addListener(onCompleted);

    console.log('[Context] Watching changes for tab', tabId);

    // Return cleanup function
    return () => {
        chrome.webNavigation.onCommitted.removeListener(onCommitted);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        console.log('[Context] Stopped watching tab', tabId);
    };
}

/**
 * Validate that a context still exists
 * @param {number} tabId
 * @param {number} frameId
 * @returns {Promise<boolean>}
 */
async function validateContext(tabId, frameId) {
    try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        return frames.some((f) => f.frameId === frameId);
    } catch (error) {
        console.error('[Context] Validation failed:', error);
        return false;
    }
}

// Export for use in popup
export { discoverContexts, watchContextChanges, validateContext };
