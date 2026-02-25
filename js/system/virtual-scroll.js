/**
 * Virtual Scroll Utility
 *
 * Efficiently renders large lists by only rendering visible items.
 * Reduces DOM nodes and improves performance for lists with 100+ items.
 *
 * Usage:
 *   const scroller = createVirtualScroll({
 *       container: document.getElementById('my-list'),
 *       itemHeight: 24,
 *       renderItem: (item, index) => {
 *           const el = document.createElement('div');
 *           el.textContent = item.name;
 *           return el;
 *       },
 *       totalCount: items.length
 *   });
 *   scroller.setItems(items);
 */

export function createVirtualScroll(options) {
    const {
        container,
        itemHeight,
        renderItem,
        buffer = 5,
        totalCount = 0,
        onScrollEnd
    } = options;

    let items = [];
    let scrollTop = 0;
    let count = totalCount;
    let isRendering = false;

    // Create inner container for proper scrolling
    const innerContainer = document.createElement('div');
    innerContainer.style.cssText = 'position:relative;min-height:100%;';
    container.appendChild(innerContainer);

    function render() {
        if (isRendering) return;
        isRendering = true;

        const containerHeight = container.clientHeight;
        const visibleStart = Math.floor(scrollTop / itemHeight);
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const renderStart = Math.max(0, visibleStart - buffer);
        const renderEnd = Math.min(count, visibleStart + visibleCount + buffer);

        // Set total height for scrollbar
        innerContainer.style.height = `${count * itemHeight}px`;

        // Clear and render visible items
        innerContainer.innerHTML = '';

        for (let i = renderStart; i < renderEnd; i++) {
            const item = items[i];
            if (item === undefined) continue;

            const el = renderItem(item, i);
            el.style.cssText = `
                position: absolute;
                top: ${i * itemHeight}px;
                height: ${itemHeight}px;
                left: 0;
                right: 0;
                box-sizing: border-box;
            `;
            innerContainer.appendChild(el);
        }

        isRendering = false;

        // Callback when scrolled near bottom
        if (onScrollEnd && visibleStart + visibleCount >= count - buffer) {
            onScrollEnd();
        }
    }

    function setItems(newItems) {
        items = newItems;
        count = items.length;
        render();
    }

    function setTotalCount(newCount) {
        count = newCount;
        render();
    }

    function getItem(index) {
        return items[index];
    }

    function scrollToIndex(index) {
        const targetTop = index * itemHeight;
        container.scrollTop = targetTop;
    }

    function scrollToTop() {
        container.scrollTop = 0;
    }

    function getVisibleRange() {
        const containerHeight = container.clientHeight;
        const visibleStart = Math.floor(scrollTop / itemHeight);
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        return {
            start: Math.max(0, visibleStart),
            end: Math.min(count, visibleStart + visibleCount)
        };
    }

    function refresh() {
        render();
    }

    // Debounced scroll handler
    let scrollTimeout = null;
    function handleScroll() {
        scrollTop = container.scrollTop;

        if (scrollTimeout) {
            cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = requestAnimationFrame(render);
    }

    container.addEventListener('scroll', handleScroll, { passive: true });

    // Initial render
    render();

    return {
        setItems,
        setTotalCount,
        getItem,
        scrollToIndex,
        scrollToTop,
        getVisibleRange,
        refresh,
        destroy: () => {
            container.removeEventListener('scroll', handleScroll);
            if (scrollTimeout) {
                cancelAnimationFrame(scrollTimeout);
            }
            innerContainer.remove();
        }
    };
}

// Also expose globally for non-module apps
window.createVirtualScroll = createVirtualScroll;
