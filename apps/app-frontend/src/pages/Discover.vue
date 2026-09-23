<script setup lang="ts">
import { ChevronRightIcon, CompassIcon } from '@modrinth/assets'
import { commonMessages, defineMessages, useVIntl } from '@modrinth/ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { CONTENT_PLATFORM_IDS, CONTENT_PLATFORMS, platformBrowseRoute } from '@/platforms'
import { useRootBreadcrumb } from '@/providers/breadcrumbs'

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
})

useRootBreadcrumb({
	slot: 'discover',
	id: 'discover',
	label: () => formatMessage(commonMessages.discoverContentLabel),
	to: () => route.fullPath,
	visual: { type: 'icon', component: CompassIcon },
})

const platforms = computed(() =>
	CONTENT_PLATFORM_IDS.map((id) => {
		const platform = CONTENT_PLATFORMS[id]
		return {
			...platform,
			to: platformBrowseRoute(id, platform.defaultProjectType, route.query),
		}
	}),
)
</script>

<template>
	<div class="flex flex-col gap-6 p-6">
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
