import { CurseForgeIcon, ModrinthIcon } from '@modrinth/assets'
import { defineMessages, type MessageDescriptor } from '@modrinth/ui'
import type { Component } from 'vue'
import type { LocationQuery, LocationQueryRaw, RouteLocationRaw } from 'vue-router'

export type ContentPlatformId = 'modrinth' | 'curseforge'

/** A platform that content can be browsed on and installed from. */
export interface ContentPlatform {
	id: ContentPlatformId
	/** Brand name, which is not translated. */
	name: string
	icon: Component
	description: MessageDescriptor
	/** Content type the platform's Browse page opens on. */
	defaultProjectType: string
	/** Path prefix shared by all of this platform's project page routes. */
	projectPathPrefix: string
	projectRoute: (projectId: string | number, query?: LocationQueryRaw) => RouteLocationRaw
}

const messages = defineMessages({
	modrinthDescription: {
		id: 'app.platforms.modrinth.description',
		defaultMessage: 'Open source mods, modpacks, resource packs, data packs, shaders and servers.',
	},
	curseforgeDescription: {
		id: 'app.platforms.curseforge.description',
		defaultMessage: 'Mods, resource packs, data packs and shaders from the CurseForge library.',
	},
})

export const CONTENT_PLATFORMS: Record<ContentPlatformId, ContentPlatform> = {
	modrinth: {
		id: 'modrinth',
		name: 'Modrinth',
		icon: ModrinthIcon,
		description: messages.modrinthDescription,
		defaultProjectType: 'modpack',
		projectPathPrefix: '/project/',
		projectRoute: (projectId, query) => ({ path: `/project/${projectId}`, query }),
	},
	curseforge: {
		id: 'curseforge',
		name: 'CurseForge',
		icon: CurseForgeIcon,
		description: messages.curseforgeDescription,
		defaultProjectType: 'mod',
		projectPathPrefix: '/curseforge/',
		projectRoute: (projectId, query) => ({ path: `/curseforge/${projectId}`, query }),
	},
}

export const CONTENT_PLATFORM_IDS = Object.keys(CONTENT_PLATFORMS) as ContentPlatformId[]

export const DEFAULT_CONTENT_PLATFORM: ContentPlatformId = 'modrinth'

/** Query parameter holding the platform the Browse page searches. */
export const PLATFORM_QUERY_PARAM = 'src'

export function isContentPlatformId(value: unknown): value is ContentPlatformId {
	return typeof value === 'string' && value in CONTENT_PLATFORMS
}

/** The platform selected by a Browse route's query, falling back to the default platform. */
export function platformFromQuery(query: LocationQuery): ContentPlatformId {
	const platform = query[PLATFORM_QUERY_PARAM]
	return isContentPlatformId(platform) ? platform : DEFAULT_CONTENT_PLATFORM
}

/** Whether `path` belongs to any platform's project page. */
export function isProjectPath(path: string): boolean {
	return CONTENT_PLATFORM_IDS.some((id) => path.startsWith(CONTENT_PLATFORMS[id].projectPathPrefix))
}

/** The Browse page for `projectType` on `platform`, keeping the instance context from `query`. */
export function platformBrowseRoute(
	platform: ContentPlatformId,
	projectType: string,
	query: LocationQuery,
): RouteLocationRaw {
	return {
		path: `/browse/${projectType}`,
		query: {
			...(typeof query.i === 'string' ? { i: query.i } : {}),
			...(platform !== DEFAULT_CONTENT_PLATFORM ? { [PLATFORM_QUERY_PARAM]: platform } : {}),
		},
	}
}

/**
 * Where a project page leads back to: the Browse page it was opened from (`b` query parameter),
 * or the platform's Browse page for the project's type.
 */
export function projectBrowseRoute(
	platform: ContentPlatformId,
	projectType: string,
	query: LocationQuery,
): RouteLocationRaw {
	const browsePath = query.b
	if (typeof browsePath === 'string' && browsePath.startsWith('/browse/')) return browsePath
	return platformBrowseRoute(platform, projectType, query)
}
