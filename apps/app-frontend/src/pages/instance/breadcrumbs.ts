import { type MaybeRefOrGetter, toValue } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { getInstanceIconUrl } from '@/helpers/instance'
import type { GameInstance } from '@/helpers/types'
import type { BreadcrumbDefinition } from '@/providers/breadcrumbs'

/** Breadcrumb for the instance a page adds content to. */
export function instanceBreadcrumb(options: {
	instanceId: MaybeRefOrGetter<string>
	instance: MaybeRefOrGetter<Pick<GameInstance, 'name' | 'icon_path'> | null | undefined>
	/** Shown until the instance has loaded. */
	loadingLabel: MaybeRefOrGetter<string>
	/** Defaults to the instance's page. */
	to?: MaybeRefOrGetter<RouteLocationRaw | undefined>
}): BreadcrumbDefinition {
	return {
		slot: 'instance',
		id: () => `instance:${toValue(options.instanceId)}`,
		label: () => toValue(options.instance)?.name ?? toValue(options.loadingLabel),
		visual: () => ({
			type: 'image',
			src: getInstanceIconUrl(toValue(options.instance)?.icon_path),
			alt: toValue(options.instance)?.name,
			tintBy: toValue(options.instanceId),
		}),
		to: () =>
			toValue(options.to) ?? `/instance/${encodeURIComponent(toValue(options.instanceId))}`,
	}
}
