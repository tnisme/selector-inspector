/**
 * DOM Context Model
 * Represents a browsing context (top document or iframe) with Chrome frame ID integration
 */

/**
 * @typedef {Object} DOMContext
 * @property {string} id - Extension's context ID (for UI)
 * @property {number} frameId - Chrome's frame ID (for execution)
 * @property {'top-document'|'iframe'} type
 * @property {number} parentFrameId - Chrome's parent frame ID
 * @property {string} url - Frame URL
 * @property {'same-origin'|'cross-origin'|'unknown'} originType
 * @property {DOMContext[]} children
 * @property {boolean} isInspectable
 * @property {string} displayLabel - UI label (e.g., "iframe[src=checkout.html]")
 */

class DOMContext {
    constructor(frameId, parentFrameId, url, pageOrigin) {
        this.id = `frame-${frameId}`;
        this.frameId = frameId;
        this.type = frameId === 0 ? 'top-document' : 'iframe';
        this.parentFrameId = parentFrameId;
        this.url = url;
        this.originType = this.classifyOrigin(url, pageOrigin);
        this.children = [];
        // The extension has <all_urls> permission, allowing chrome.scripting to run in cross-origin frames.
        this.isInspectable = true;
        this.displayLabel = this.generateLabel();
    }

    classifyOrigin(frameUrl, pageOrigin) {
        try {
            // Handle special cases
            if (frameUrl === 'about:blank' || frameUrl.startsWith('about:srcdoc')) {
                return 'same-origin'; // Inherits parent origin
            }
            if (frameUrl.startsWith('data:') || frameUrl.startsWith('blob:')) {
                return 'cross-origin';
            }

            const frameOrigin = new URL(frameUrl).origin;
            return frameOrigin === pageOrigin ? 'same-origin' : 'cross-origin';
        } catch {
            return 'unknown';
        }
    }

    generateLabel() {
        if (this.type === 'top-document') {
            return 'Top Document';
        }

        try {
            if (this.url === 'about:blank') return 'iframe[about:blank]';
            if (this.url.startsWith('about:srcdoc')) return 'iframe[srcdoc]';
            if (this.url.startsWith('javascript:')) return 'iframe[javascript]';

            const url = new URL(this.url);
            let pathStr = url.pathname + url.search;

            if (pathStr === '/' || pathStr === '') {
                pathStr = url.hostname;
            } else if (url.hostname && this.originType === 'cross-origin') {
                // If it's cross-origin, prefix with hostname for clarity
                pathStr = url.hostname + pathStr;
            }

            const maxLen = 45;
            if (pathStr.length > maxLen) {
                pathStr = '...' + pathStr.substring(pathStr.length - (maxLen - 3));
            }

            return `iframe[src="${pathStr}"]`;
        } catch {
            return `iframe[frameId=${this.frameId}]`;
        }
    }
}

class ContextTree {
    constructor() {
        this.root = null;
        this.registry = new Map(); // frameId → DOMContext
    }

    buildFromFrames(frames, pageOrigin) {
        this.registry.clear();

        // Create all contexts
        frames.forEach((frame) => {
            const context = new DOMContext(
                frame.frameId,
                frame.parentFrameId,
                frame.url,
                pageOrigin
            );
            this.registry.set(frame.frameId, context);
        });

        // Build hierarchy
        frames.forEach((frame) => {
            const context = this.registry.get(frame.frameId);
            if (frame.parentFrameId === -1) {
                this.root = context;
            } else {
                const parent = this.registry.get(frame.parentFrameId);
                if (parent) {
                    parent.children.push(context);
                } else {
                    console.warn(`[ContextTree] Parent frame ${frame.parentFrameId} not found for frame ${frame.frameId}. Attaching to root.`);
                    if (this.root) {
                        this.root.children.push(context);
                    }
                }
            }
        });

        // First pass might miss root if main frame wasn't first, but it usually is.
        // Just in case orphaned frames were processed before root:
        frames.forEach((frame) => {
            const context = this.registry.get(frame.frameId);
            if (frame.parentFrameId !== -1 && !this.registry.has(frame.parentFrameId)) {
                if (this.root && !this.root.children.includes(context)) {
                    this.root.children.push(context);
                }
            }
        });

        return this.root;
    }

    getContext(frameId) {
        return this.registry.get(frameId);
    }

    getContextById(contextId) {
        const frameId = parseInt(contextId.replace('frame-', ''));
        return this.registry.get(frameId);
    }

    getAllContexts() {
        return Array.from(this.registry.values());
    }

    toJSON() {
        return {
            root: this.root,
            contexts: this.getAllContexts(),
        };
    }
}

// Export for use in popup and content scripts
if (typeof window !== 'undefined') {
    window.DOMContext = DOMContext;
    window.ContextTree = ContextTree;
}

// ES6 exports for popup script
export { DOMContext, ContextTree };
