<script setup lang="ts">
import {
	Admonition,
	type BrowseInstallContext,
	BrowseInstallHeader,
	commonMessages,
	LoadingIndicator,
	NavTabs,
	useVIntl,
} from '@modrinth/ui'
import type { RouteLocationRaw } from 'vue-router'

import type { ContentPlatformId } from '@/platforms'
import { platformBreadcrumbDefinition } from '@/platforms/breadcrumbs'
import { provideBreadcrumbParent, useBreadcrumb } from '@/providers/breadcrumbs'

import type { ProjectPageTab } from './types'

/**
 * Page layout shared by every platform's project page. It owns the breadcrumbs, the install
 * header, loading and error states, and the tabs; platforms fill in the header, sidebar and tab
 * content through slots.
 */
const props = defineProps<{
	platform: ContentPlatformId
	/** Stable identifier of the project on its platform, used for breadcrumb identity. */
	projectId: string
	/** Project name, or `null` while it is loading. */
	title: string | null
	iconUrl?: string | null
	/** Where the project breadcrumb links to. */
	to: RouteLocationRaw
	/** Where the platform breadcrumb links to, usually the platform's Browse page. */
	platformTo: RouteLocationRaw
	installContext?: BrowseInstallContext | null
	tabs: ProjectPageTab[]
	loading?: boolean
	/** Shown instead of the page when set. */
	error?: string | null
}>()

const { formatMessage } = useVIntl()

const platformBreadcrumb = useBreadcrumb(
	platformBreadcrumbDefinition(
		() => props.platform,
		() => props.platformTo,
	),
)
const projectBreadcrumb = useBreadcrumb(
	{
		slot: 'project',
		id: () => `project:${props.platform}:${props.projectId}`,
		label: () => props.title ?? formatMessage(commonMessages.loadingLabel),
		visual: () => ({
			type: 'image',
			src: props.iconUrl,
			alt: props.title ?? undefined,
			tintBy: props.projectId,
		}),
		to: () => props.to,
	},
	{ parent: platformBreadcrumb },
)
provideBreadcrumbParent(projectBreadcrumb)
</script>

<template>
	<div class="flex flex-col gap-4 p-6">
		<div
			v-if="installContext"
			class="sticky top-0 z-20 -mx-6 -mt-6 rounded-tl-[--radius-xl] border-0 border-b border-solid bg-surface-1 px-3 py-4 border-surface-5"
		>
			<BrowseInstallHeader :install-context="installContext" />
		</div>
		<slot name="before-header" />

		<LoadingIndicator v-if="loading" />
		<Admonition v-else-if="error" type="critical">{{ error }}</Admonition>
		<template v-else>
			<Teleport to="#sidebar-teleport-target">
				<slot name="sidebar" />
			</Teleport>
			<slot name="header" />
			<NavTabs :links="tabs" />
			<slot />
		</template>
	</div>
	<slot name="after" />
</template>
