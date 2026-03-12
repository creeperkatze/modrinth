import { createApp, h, ref } from 'vue'
import FloatingVue from 'floating-vue'
import { provideI18n } from '@modrinth/ui'
import NotificationsIndicator from '../components/NotificationsIndicator.vue'
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

		// Hook into the page's Nuxt router to re-inject after each navigation.
		// This handles layout switches that remove and recreate the header.
		function hookRouter() {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const nuxtRouter = (window as any).__nuxt_app?.vueApp?.config?.globalProperties?.$router
			if (!nuxtRouter) return false
			nuxtRouter.afterEach(() => scheduleInject())
			return true
		}

		// Schedule the initial injection and try to hook the router right away.
		scheduleInject()
		if (!hookRouter()) {
			// Router not ready yet — watch for the Nuxt app to initialise.
			const initObserver = new MutationObserver(() => {
				if (hookRouter()) initObserver.disconnect()
			})
			initObserver.observe(document.documentElement, { childList: true, subtree: true })
		}

		// Fallback MutationObserver for the initial injection before the Nuxt app
		// is ready (covers pages that are already hydrated when the script runs).
		const domObserver = new MutationObserver(() => {
			if (container && document.contains(container)) {
				domObserver.disconnect()
				return
			}
			scheduleInject()
		})
		domObserver.observe(document.documentElement, { childList: true, subtree: true })
	},
})
