<script setup lang="ts">
import { ChevronRightIcon, CompassIcon } from '@modrinth/assets'
import { BrowseInstallHeader, commonMessages, defineMessages, useVIntl } from '@modrinth/ui'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { getInstanceIconUrl } from '@/helpers/instance'
import { instanceBreadcrumb } from '@/pages/instance/breadcrumbs'
import { instanceDetailQueryOptions } from '@/pages/instance/query-options'
import { CONTENT_PLATFORM_IDS, CONTENT_PLATFORMS, discoverPlatformRoute } from '@/platforms'
import { type BreadcrumbDefinition, useBreadcrumb, useRootBreadcrumb } from '@/providers/breadcrumbs'

const { formatMessage } = useVIntl()
const route = useRoute()

const messages = defineMessages({
	description: {
		id: 'app.discover.description',
		defaultMessage: 'Choose a platform to browse content from.',
	},
	browsePlatform: {
		id: 'app.discover.browse-platform',
		defaultMessage: 'Browse {platform}',
	},
	backToInstance: {
		id: 'app.discover.back-to-instance',
		defaultMessage: 'Back to instance',
	},
})

const instanceId = typeof route.query.i === 'string' ? route.query.i : ''
const instanceQuery = useQuery(
	computed(() => ({
		...instanceDetailQueryOptions(instanceId),
		enabled: !!instanceId,
	})),
)
const instance = computed(() => instanceQuery.data.value ?? null)

const installContext = computed(() => {
	if (!instance.value) return null
	return {
		name: instance.value.name,
		loader: instance.value.loader,
		gameVersion: instance.value.game_version,
		iconSrc: getInstanceIconUrl(instance.value.icon_path),
		backUrl: `/instance/${encodeURIComponent(instance.value.id)}`,
		backLabel: formatMessage(messages.backToInstance),
		heading: formatMessage(commonMessages.installingContentLabel),
	}
})

const discoverBreadcrumbDefinition: BreadcrumbDefinition = {
	slot: 'discover',
	id: 'discover',
	label: () => formatMessage(commonMessages.discoverContentLabel),
	to: () => route.fullPath,
	visual: { type: 'icon', component: CompassIcon },
}
if (instanceId) {
	const instanceHandle = useRootBreadcrumb(
		instanceBreadcrumb({
			instanceId,
			instance,
			loadingLabel: () => formatMessage(commonMessages.loadingLabel),
		}),
	)
	useBreadcrumb(discoverBreadcrumbDefinition, { parent: instanceHandle })
} else {
	useRootBreadcrumb(discoverBreadcrumbDefinition)
}

const platforms = computed(() =>
	CONTENT_PLATFORM_IDS.map((id) => ({
		...CONTENT_PLATFORMS[id],
		to: discoverPlatformRoute(id, route.query),
	})),
)
</script>

<template>
	<div class="flex flex-col gap-6 p-6">
		<div
			v-if="installContext"
			class="sticky top-0 z-20 -mx-6 -mt-6 rounded-tl-[--radius-xl] border-0 border-b border-solid bg-surface-1 px-3 py-4 border-surface-5"
		>
			<BrowseInstallHeader :install-context="installContext" />
		</div>
		<div class="flex flex-col gap-1">
			<h1 class="m-0 text-2xl font-extrabold text-contrast">
				{{ formatMessage(commonMessages.discoverContentLabel) }}
			</h1>
			<p class="m-0 text-secondary">{{ formatMessage(messages.description) }}</p>
		</div>
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<RouterLink
				v-for="platform in platforms"
				:key="platform.id"
				:to="platform.to"
				class="group flex flex-col gap-6 rounded-2xl border border-solid border-surface-4 bg-surface-3 p-6 transition-all hover:border-brand hover:brightness-110 focus-visible:border-brand"
			>
				<div
					class="flex size-20 items-center justify-center rounded-2xl border border-solid border-surface-5 bg-surface-2 text-contrast"
				>
					<component :is="platform.icon" class="size-12" aria-hidden="true" />
				</div>
				<div class="flex flex-col gap-2">
					<h2 class="m-0 text-2xl font-extrabold text-contrast">{{ platform.name }}</h2>
					<p class="m-0 text-base text-primary">{{ formatMessage(platform.description) }}</p>
				</div>
				<span class="mt-auto flex items-center gap-1 font-semibold text-brand">
					{{ formatMessage(messages.browsePlatform, { platform: platform.name }) }}
					<ChevronRightIcon
						class="transition-transform group-hover:translate-x-1"
						aria-hidden="true"
					/>
				</span>
			</RouterLink>
		</div>
	</div>
</template>
