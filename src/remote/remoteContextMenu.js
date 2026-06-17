function getSubmenuDirection(menuX, menuWidth, submenuWidth, viewportWidth) {
    return menuX + menuWidth + submenuWidth > viewportWidth ? 'left' : 'right';
}

function shouldCloseContextMenu(target) {
    return !target?.closest?.('.context-menu');
}

export { getSubmenuDirection, shouldCloseContextMenu };
