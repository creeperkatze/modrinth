export interface ExtensionSettings {
	showBadge: boolean
	showNotificationsIndicator: boolean
	showToolsSidebar: boolean
	showDependenciesSidebar: boolean
}

export const DEFAULTS: ExtensionSettings = {
	showBadge: true,
	showNotificationsIndicator: true,
	showToolsSidebar: true,
	showDependenciesSidebar: true,
}

export async function loadSettings(): Promise<ExtensionSettings> {
	const stored = await chrome.storage.local.get(Object.keys(DEFAULTS) as string[])
	return { ...DEFAULTS, ...(stored as Partial<ExtensionSettings>) }
}
