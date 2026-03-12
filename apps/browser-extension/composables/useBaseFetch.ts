const API_BASES: Record<string, string> = {
	'modrinth.com': 'https://api.modrinth.com',
	'staging.modrinth.com': 'https://staging-api.modrinth.com',
}

function getApiBase(): string {
	return API_BASES[location.hostname] ?? 'https://api.modrinth.com'
}

let cachedToken: string | null = null

function getToken(): string {
	if (cachedToken !== null) return cachedToken
	const cookie = document.cookie.split('; ').find((row) => row.startsWith('auth-token='))
	cachedToken = cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : ''
	return cachedToken
}

/** Call this if the user logs in/out mid-session. */
export function invalidateTokenCache() {
	cachedToken = null
}

/**
 * Browser-compatible drop-in for Nuxt's useBaseFetch.
 * Reads the auth token from the `auth-token` cookie (httpOnly: false on modrinth.com).
 */
export async function useBaseFetch(
	url: string,
	options: RequestInit & { apiVersion?: number } = {},
): Promise<any> {
	const { apiVersion = 2, ...fetchOptions } = options as RequestInit & { apiVersion?: number }
	const token = getToken()

	const res = await fetch(`${getApiBase()}/v${apiVersion}/${url}`, {
		...fetchOptions,
		headers: {
			...(token ? { Authorization: token } : {}),
			...((fetchOptions.headers as Record<string, string>) ?? {}),
		},
	})

	if (res.status === 204 || res.headers.get('content-length') === '0') return null
	if (!res.ok) throw new Error(`Modrinth API ${res.status}: ${url}`)
	return res.json()
}
