/**
 * Redirects the renderer to the login route through an explicit router seam.
 *
 * @param {object} [dependencies]
 * @param {function} [dependencies.loadRouter]
 * @returns {Promise<void>}
 */
export async function redirectToLogin({
    loadRouter = () => import('../plugins/router')
} = {}) {
    const { router } = await loadRouter();
    if (router.currentRoute.value.name !== 'login') {
        router.replace({ name: 'login' }).catch(() => {});
    }
}
