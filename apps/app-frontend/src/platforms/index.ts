import { CurseForgeIcon, ModrinthIcon } from '@modrinth/assets'
import {
	type ContentCardPlatform,
	type ContentItem,
	defineMessages,
	type MessageDescriptor,
} from '@modrinth/ui'
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
	/** Content types that can be browsed on the platform. */
	projectTypes: string[]
	/** Content type the platform's Browse page opens on. */
	defaultProjectType: string
	/** Path prefix shared by all of this platform's project page routes. */
	projectPathPrefix: string
	projectRoute: (projectId: string | number, query?: LocationQueryRaw) => RouteLocationRaw
	/** In-app profile page of a user, listing their projects. */
	userRoute: (userId: string | number) => string
}

const messages = defineMessages({
	modrinthDescription: {
		id: 'app.platforms.modrinth.description',
		defaultMessage: 'Open source mods, modpacks, resource packs, data packs, shaders and servers.',
	},
	curseforgeDescription: {
		id: 'app.platforms.curseforge.description',
		defaultMessage:
			'Modpacks, mods, resource packs, data packs and shaders from the CurseForge library.',
	},
})

export const CONTENT_PLATFORMS: Record<ContentPlatformId, ContentPlatform> = {
	modrinth: {
		id: 'modrinth',
		name: 'Modrinth',
		icon: ModrinthIcon,
		description: messages.modrinthDescription,
		projectTypes: ['modpack', 'mod', 'resourcepack', 'datapack', 'shader', 'server'],
		defaultProjectType: 'modpack',
		projectPathPrefix: '/project/',
		projectRoute: (projectId, query) => ({ path: `/project/${projectId}`, query }),
		userRoute: (userId) => `/user/${encodeURIComponent(userId)}`,
	},
	curseforge: {
		id: 'curseforge',
		name: 'CurseForge',
		icon: CurseForgeIcon,
		description: messages.curseforgeDescription,
		projectTypes: ['modpack', 'mod', 'resourcepack', 'datapack', 'shader'],
		defaultProjectType: 'modpack',
		projectPathPrefix: '/curseforge/project/',
		projectRoute: (projectId, query) => ({ path: `/curseforge/project/${projectId}`, query }),
		userRoute: (userId) => `/curseforge/user/${encodeURIComponent(userId)}`,
	},
}

export const CONTENT_PLATFORM_IDS = Object.keys(CONTENT_PLATFORMS) as ContentPlatformId[]

export const DEFAULT_CONTENT_PLATFORM: ContentPlatformId = 'modrinth'

/** Query parameter holding the platform the Browse page searches. */
export const PLATFORM_QUERY_PARAM = 'src'

/** Query parameter holding the content type the Discover page should open platforms on. */
export const PROJECT_TYPE_QUERY_PARAM = 'type'

export function isContentPlatformId(value: unknown): value is ContentPlatformId {
	return typeof value === 'string' && value in CONTENT_PLATFORMS
}

/** The platform selected by a Browse route's query, falling back to the default platform. */
export function platformFromQuery(query: LocationQuery): ContentPlatformId {
	const platform = query[PLATFORM_QUERY_PARAM]
	return isContentPlatformId(platform) ? platform : DEFAULT_CONTENT_PLATFORM
}

/**
 * The platform a content item was installed from, or `null` for files added by hand. Files
 * installed from another platform keep that platform even when Modrinth also recognises them.
 */
export function contentItemPlatform(
	item: Pick<ContentItem, 'project' | 'external_source'>,
): ContentPlatformId | null {
	const externalPlatform = item.external_source?.platform
	if (isContentPlatformId(externalPlatform)) return externalPlatform
	return item.project ? 'modrinth' : null
}

/** The platform badge shown on a content item's card. */
export function contentItemPlatformBadge(
	item: Pick<ContentItem, 'project' | 'external_source'>,
): ContentCardPlatform | undefined {
	const platform = contentItemPlatform(item)
	if (!platform) return undefined
	return { name: CONTENT_PLATFORMS[platform].name, icon: CONTENT_PLATFORMS[platform].icon }
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
 * The Discover page for adding content to an instance, opening platforms on `projectType` where
 * they support it.
 */
export function instanceDiscoverRoute(instanceId: string, projectType?: string): RouteLocationRaw {
	return {
		path: '/discover',
		query: {
			i: instanceId,
			...(projectType ? { [PROJECT_TYPE_QUERY_PARAM]: projectType } : {}),
		},
	}
}

/** The Browse page a Discover page card opens, honouring the requested content type when supported. */
export function discoverPlatformRoute(
	platform: ContentPlatformId,
	query: LocationQuery,
): RouteLocationRaw {
	const requestedType = query[PROJECT_TYPE_QUERY_PARAM]
	const { projectTypes, defaultProjectType } = CONTENT_PLATFORMS[platform]
	const projectType =
		typeof requestedType === 'string' && projectTypes.includes(requestedType)
			? requestedType
			: defaultProjectType
	return platformBrowseRoute(platform, projectType, query)
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
