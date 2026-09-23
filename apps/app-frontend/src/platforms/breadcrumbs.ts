import { type MaybeRefOrGetter, toValue } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { BreadcrumbDefinition } from '@/providers/breadcrumbs'

import { CONTENT_PLATFORMS, type ContentPlatformId } from './index'

/** Breadcrumb for the platform content is browsed on, placed between "Discover" and a project. */
export function platformBreadcrumbDefinition(
	platform: MaybeRefOrGetter<ContentPlatformId>,
	to: MaybeRefOrGetter<RouteLocationRaw | undefined>,
): BreadcrumbDefinition {
	return {
		slot: 'platform',
		id: () => `platform:${toValue(platform)}`,
		label: () => CONTENT_PLATFORMS[toValue(platform)].name,
		visual: () => ({ type: 'icon', component: CONTENT_PLATFORMS[toValue(platform)].icon }),
		to,
	}
}
