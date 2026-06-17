function captureScrollState(root, selector) {
    if (!root?.querySelectorAll) {
        return [];
    }
    return Array.from(root.querySelectorAll(selector)).map((node, index) => ({
        index,
        scrollTop: node.scrollTop || 0,
        scrollLeft: node.scrollLeft || 0
    }));
}

function restoreScrollState(root, selector, state = []) {
    if (!root?.querySelectorAll || !Array.isArray(state) || !state.length) {
        return;
    }
    const nodes = Array.from(root.querySelectorAll(selector));
    for (const item of state) {
        const node = nodes[item.index];
        if (!node) {
            continue;
        }
        node.scrollTop = item.scrollTop || 0;
        node.scrollLeft = item.scrollLeft || 0;
    }
}

export { captureScrollState, restoreScrollState };
