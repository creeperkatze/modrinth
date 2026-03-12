/**
 * Utilities for accessing the host page's Nuxt 3 router from a content script.
 *
 * Nuxt 3 explicitly sets `window.__nuxt_app = nuxtApp` on the client, and
 * `nuxtApp.$router` is a first-class public property — preferred over digging
 * through Vue internals (`__vue_app__.config.globalProperties.$router`).
 *
 * Falls back to the Vue 3 internal path for resilience, and ultimately to a
 * full page load if no router is available yet.
 */

export function getPageRouter(): { push: (path: string) => void } | null {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const w = window as any
	return (
		w.__nuxt_app?.$router ??
		(document.getElementById('__nuxt') as any)?.__vue_app__?.config?.globalProperties?.$router ??
		null
	)
}

/** Resolve a relative path to an absolute modrinth.com URL (for href attributes). */
export function resolveLink(link: string): string {
	if (link.startsWith('http')) return link
	return 'https://modrinth.com' + link
}

/** Navigate using the page router for a client-side transition, falling back to a full load. */
export function navigate(path: string): void {
	const router = getPageRouter()
	if (router) {
		router.push(path)
	} else {
		window.location.href = resolveLink(path)
	}
}
