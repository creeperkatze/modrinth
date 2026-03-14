import { getAuthToken, usePopupFetch } from '../composables/usePopupFetch'
import { groupNotifications } from '../helpers/platform-notifications'

const ALARM_NAME = 'modrinth-extras-poll'
const POLL_INTERVAL_MINUTES = 1

export default defineBackground(() => {
	// Firefox MV2 uses browserAction; Chrome MV3 uses action.
	const actionAPI = chrome.action ?? (chrome as any).browserAction

	async function updateBadge() {
		try {
			const { showBadge = true } = await chrome.storage.local.get('showBadge')
			if (!showBadge) {
				actionAPI?.setBadgeText({ text: '' })
				return
			}

			const token = await getAuthToken()
			if (!token) {
				actionAPI?.setBadgeText({ text: '' })
				await chrome.storage.local.set({ userId: null, notifications: null, lastUpdated: Date.now() })
				return
			}

			const user = await usePopupFetch('user')
			const notifs = await usePopupFetch(`user/${user.id}/notifications`)
			const unread: number = Array.isArray(notifs)
				? groupNotifications(notifs.filter((n: any) => !n.read)).length
				: 0

			await actionAPI.setBadgeBackgroundColor({ color: '#1bd96a' })
			await actionAPI.setBadgeText({ text: unread > 0 ? String(Math.min(unread, 99)) : '' })

			await chrome.storage.local.set({
				userId: user.id,
				notifications: notifs,
				lastUpdated: Date.now(),
			})
		} catch (err) {
			console.error('[Modrinth Extras] Background update failed:', err)
			actionAPI?.setBadgeText({ text: '' })
		}
	}

	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== 'local' || !('showBadge' in changes)) return
		if (changes.showBadge.newValue === false) {
			actionAPI?.setBadgeText({ text: '' })
		} else {
			updateBadge()
		}
	})

	chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MINUTES })

	chrome.alarms.onAlarm.addListener((alarm) => {
		if (alarm.name === ALARM_NAME) updateBadge()
	})

	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if (message.type === 'refresh') {
			updateBadge().then(() => sendResponse({ ok: true }))
			return true
		}
	})

	updateBadge()
})
