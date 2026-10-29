export function prefersReducedMotion() {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.classList.contains('motion-disabled')
    );
}
