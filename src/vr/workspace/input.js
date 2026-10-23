/** Map a full overlay point into the letterboxed VR viewport, rejecting borders. */
export function mapWorkspacePoint(
    root,
    image,
    x,
    y,
    width = 1280,
    height = 1024
) {
    if (![x, y].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1)
        return null;
    const scale = Math.min(image.width / width, image.height / height);
    if (!(scale > 0)) return null;
    const left = image.left + (image.width - width * scale) / 2;
    const top = image.top + (image.height - height * scale) / 2;
    const px = root.left + x * root.width;
    const py = root.top + y * root.height;
    if (
        px < left ||
        px > left + width * scale ||
        py < top ||
        py > top + height * scale
    )
        return null;
    return {
        x: Math.min((px - left) / (width * scale), 1),
        y: Math.min((py - top) / (height * scale), 1)
    };
}
