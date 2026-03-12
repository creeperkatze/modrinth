import { createApp, h, ref } from 'vue'
import FloatingVue from 'floating-vue'
import { provideI18n } from '@modrinth/ui'
import FooterBadge from '../components/FooterBadge.vue'
import NotificationsIndicator from '../components/NotificationsIndicator.vue'
import SidebarExtra from '../components/SidebarExtra.vue'
import '../assets/modrinth-classes.css'
import '../assets/tailwind.css'

export default defineContentScript({
	matches: ['https://modrinth.com/*', 'https://staging.modrinth.com/*'],
	// 'manifest' tells Chrome to auto-load the compiled CSS (Tailwind utilities,
	// scoped @modrinth/ui component styles, floating-vue positioning CSS) as a
	// content stylesheet before the script runs.
	cssInjectionMode: 'manifest',

	main() {
		let container: HTMLElement | null = null
		let currentApp: ReturnType<typeof createApp> | null = null

		function unmount() {
			if (currentApp) {
				currentApp.unmount()
				currentApp = null
			}
			if (container?.parentElement) {
				container.parentElement.removeChild(container)
			}
			container = null
		}

		function inject() {
			// Already injected and container is still live — nothing to do.
			if (container && document.contains(container)) return

			// Clean up any previous app whose container was detached.
			unmount()

			const header = document.querySelector('header')
			if (!header) return

			// Find the user menu trigger button. Strategy:
			// 1. Look for .btn-dropdown-animation buttons (applied by @modrinth/ui's
			//    OverflowMenu via $attrs from the class prop in default.vue).
			// 2. Fall back to any header button that contains an img (user avatar).
			const dropdownTriggers = [
				...header.querySelectorAll<HTMLElement>('.btn-dropdown-animation'),
			]
			let userTrigger: HTMLElement | null = dropdownTriggers[dropdownTriggers.length - 1] ?? null

			if (!userTrigger) {
				const headerButtons = [...header.querySelectorAll<HTMLElement>('button')]
				userTrigger =
					headerButtons.filter((b) => b.querySelector('img')).at(-1) ??
					headerButtons.at(-1) ??
					null
			}

			if (!userTrigger) return

			// Walk UP from the trigger button until we reach a flex ancestor.
			let childInFlex: HTMLElement = userTrigger
			let flexRow: HTMLElement | null = userTrigger.parentElement
			while (flexRow && flexRow !== header) {
				const { display } = window.getComputedStyle(flexRow)
				if (display === 'flex' || display === 'inline-flex') break
				childInFlex = flexRow
				flexRow = flexRow.parentElement as HTMLElement | null
			}

			if (!flexRow) return

			container = document.createElement('div')
			container.id = 'modrinth-ext-notifications'
			// display:contents makes the container invisible to flex layout —
			// the Vue component's root element becomes the effective flex item.
			container.style.display = 'contents'
			flexRow.insertBefore(container, childInFlex)

			const app = createApp({
				setup() {
					provideI18n({ locale: ref('en-US'), t: (key: string) => key, setLocale: () => {} })
				},
				render: () => h(NotificationsIndicator),
			})
			app.use(FloatingVue)
			app.mount(container)
			currentApp = app
		}

		// Debounce helper — waits for DOM activity to settle before injecting.
		let debounceTimer: ReturnType<typeof setTimeout> | null = null
		function scheduleInject() {
			if (debounceTimer) clearTimeout(debounceTimer)
			debounceTimer = setTimeout(() => {
				debounceTimer = null
				inject()
			}, 300)
		}

		// Hook into the page's Nuxt router so we can unmount *before* navigation
		// starts (beforeEach) and re-inject *after* it completes (afterEach).
		//
		// Vue 3 attaches __vue_app__ to the root mount element (#__nuxt), giving
		// reliable access to the router without relying on window globals.
		//
		// Without beforeEach: Nuxt swaps layouts mid-navigation, our container is
		// removed from the DOM, and the still-running Vue app tries to insert into
		// a null parent — corrupting the page's DOM and crashing its floating-vue.
		function hookRouter() {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const nuxtRoot = document.getElementById('__nuxt') as any
			const nuxtRouter =
				nuxtRoot?.__vue_app__?.config?.globalProperties?.$router ??
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(window as any).__nuxt_app?.vueApp?.config?.globalProperties?.$router
			if (!nuxtRouter) return false
			nuxtRouter.beforeEach(() => {
				unmount()
				unmountSidebar()
			})
			nuxtRouter.afterEach(() => {
				scheduleInject()
				scheduleInjectSidebar()
			})
			return true
		}

		// Schedule the initial injection and try to hook the router right away.
		scheduleInject()
		if (!hookRouter()) {
			// Router not ready yet — keep trying on DOM mutations until it is.
			const initObserver = new MutationObserver(() => {
				if (hookRouter()) initObserver.disconnect()
			})
			initObserver.observe(document.documentElement, { childList: true, subtree: true })
		}

		// Safety-net MutationObserver: if the container is removed from the DOM
		// by anything OTHER than our beforeEach hook (e.g. Nuxt re-rendering the
		// header during hydration), unmount the Vue app IMMEDIATELY so it stops
		// trying to write to a detached DOM tree, then schedule re-injection.
		//
		// Do NOT disconnect on success — we must keep watching for future removals.
		const domObserver = new MutationObserver(() => {
			if (container && !document.contains(container)) {
				unmount()
				scheduleInject()
			}
			if (footerContainer && !document.contains(footerContainer)) {
				unmountFooter()
			}
			if (sidebarContainer && !document.contains(sidebarContainer)) {
				unmountSidebar()
			}
			injectFooterBadge()
			injectSidebar()
		})
		domObserver.observe(document.documentElement, { childList: true, subtree: true })

		let sidebarContainer: HTMLElement | null = null
		let sidebarApp: ReturnType<typeof createApp> | null = null

		function unmountSidebar() {
			if (sidebarApp) {
				sidebarApp.unmount()
				sidebarApp = null
			}
			if (sidebarContainer?.parentElement) {
				sidebarContainer.parentElement.removeChild(sidebarContainer)
			}
			sidebarContainer = null
		}

		function findAnchorElement(): { after: HTMLElement; fallback?: boolean } | null {
			const path = window.location.pathname

			if (/^\/(mod|plugin|datapack|shader|resourcepack|modpack)\/[^/]+\/?$/.test(path)) {
				// Project page: after the "Details" card.
				for (const card of document.querySelectorAll<HTMLElement>(
					'.card.flex-card.experimental-styles-within',
				)) {
					if (card.querySelector('h2')?.textContent?.trim() === 'Details')
						return { after: card }
				}
				return null
			}

			if (/^\/user\/[^/]+\/?$/.test(path)) {
				// User profile page: after the last .card.flex-card, or append to sidebar if none.
				const sidebar = document.querySelector<HTMLElement>('.normal-page__sidebar')
				if (!sidebar) return null
				const cards = sidebar.querySelectorAll<HTMLElement>('.card.flex-card')
				if (cards.length > 0) return { after: cards[cards.length - 1] }
				return { after: sidebar, fallback: true }
			}

			if (/^\/organization\/[^/]+\/?$/.test(path)) {
				// Organization page: after the "Members" card.
				const sidebar = document.querySelector<HTMLElement>('.normal-page__sidebar')
				if (!sidebar) return null
				const cards = sidebar.querySelectorAll<HTMLElement>('.card.flex-card')
				if (cards.length > 0) return { after: cards[cards.length - 1] }
				return null
			}

			if (/^\/collection\/[^/]+\/?$/.test(path)) {
				// Collection page uses SidebarCard (div.flex.flex-col.gap-3.p-4).
				const sidebar = document.querySelector<HTMLElement>('.ui-normal-page__sidebar')
				if (!sidebar) return null
				const cards = sidebar.querySelectorAll<HTMLElement>('.flex.flex-col.gap-3.p-4')
				if (cards.length > 0) return { after: cards[cards.length - 1] }
				return null
			}

			return null
		}

		function injectSidebar() {
			if (sidebarContainer && document.contains(sidebarContainer)) return
			unmountSidebar()

			const anchor = findAnchorElement()
			if (!anchor) return

			sidebarContainer = document.createElement('div')
			sidebarContainer.id = 'modrinth-ext-sidebar-extra'
			sidebarContainer.style.display = 'contents'
			if (anchor.fallback) {
				anchor.after.appendChild(sidebarContainer)
			} else {
				anchor.after.after(sidebarContainer)
			}

			const pageUrl = window.location.href.split('?')[0].split('#')[0]
			sidebarApp = createApp(h(SidebarExtra, { pageUrl }))
			sidebarApp.mount(sidebarContainer)
		}

		let sidebarDebounce: ReturnType<typeof setTimeout> | null = null
		function scheduleInjectSidebar() {
			if (sidebarDebounce) clearTimeout(sidebarDebounce)
			sidebarDebounce = setTimeout(() => {
				sidebarDebounce = null
				injectSidebar()
			}, 300)
		}

		scheduleInjectSidebar()

		let footerContainer: HTMLElement | null = null
		let footerApp: ReturnType<typeof createApp> | null = null

		function unmountFooter() {
			if (footerApp) {
				footerApp.unmount()
				footerApp = null
			}
			if (footerContainer?.parentElement) {
				footerContainer.parentElement.removeChild(footerContainer)
			}
			footerContainer = null
		}

		function injectFooterBadge() {
			if (footerContainer && document.contains(footerContainer)) return
			unmountFooter()

			const openSourceLink = document.querySelector<HTMLAnchorElement>(
				'footer a[href="https://github.com/modrinth/code"]',
			)
			if (!openSourceLink) return

			const flexCol = openSourceLink.closest('.flex.flex-wrap.justify-center.gap-3')
			if (!flexCol) return

			footerContainer = document.createElement('div')
			footerContainer.id = 'modrinth-ext-footer-badge'
			footerContainer.style.display = 'contents'
			flexCol.appendChild(footerContainer)

			footerApp = createApp(h(FooterBadge))
			footerApp.mount(footerContainer)
		}

		injectFooterBadge()
	},
})
