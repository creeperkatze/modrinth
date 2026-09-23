<script setup lang="ts">
import { ExternalIcon } from '@modrinth/assets'
import { Avatar, commonMessages, defineMessages, TagItem, TagTagItem, useVIntl } from '@modrinth/ui'
import { RouterLink } from 'vue-router'

import type { ProjectCreator, ProjectDetail, ProjectLink } from './types'

/** Project page sidebar sections built from platform-independent project data. */
defineProps<{
	gameVersions: string[]
	/** Loader tags, such as `fabric` or `neoforge`. */
	loaders: string[]
	links: ProjectLink[]
	creators: ProjectCreator[]
	details: ProjectDetail[]
}>()

const { formatMessage } = useVIntl()

const messages = defineMessages({
	compatibility: { id: 'app.project-page.sidebar.compatibility', defaultMessage: 'Compatibility' },
	minecraftVersions: {
		id: 'app.project-page.sidebar.minecraft-versions',
		defaultMessage: 'Minecraft: Java Edition',
	},
	platforms: { id: 'app.project-page.sidebar.platforms', defaultMessage: 'Platforms' },
	links: { id: 'app.project-page.sidebar.links', defaultMessage: 'Links' },
	creators: { id: 'app.project-page.sidebar.creators', defaultMessage: 'Creators' },
})
</script>

<template>
	<section v-if="gameVersions.length > 0 || loaders.length > 0" class="sidebar-section">
		<h2 class="m-0 text-lg">{{ formatMessage(messages.compatibility) }}</h2>
		<template v-if="gameVersions.length > 0">
			<h3 class="m-0 text-base text-secondary">{{ formatMessage(messages.minecraftVersions) }}</h3>
			<div class="flex flex-wrap gap-1">
				<TagItem v-for="version in gameVersions" :key="version">{{ version }}</TagItem>
			</div>
		</template>
		<template v-if="loaders.length > 0">
			<h3 class="m-0 text-base text-secondary">{{ formatMessage(messages.platforms) }}</h3>
			<div class="flex flex-wrap gap-1">
				<TagTagItem v-for="loader in loaders" :key="loader" :tag="loader" />
			</div>
		</template>
	</section>

	<section v-if="links.length > 0" class="sidebar-section">
		<h2 class="m-0 text-lg">{{ formatMessage(messages.links) }}</h2>
		<div class="flex flex-col gap-3 font-semibold">
			<a
				v-for="link in links"
				:key="link.url"
				:href="link.url"
				target="_blank"
				class="flex w-fit items-center gap-2 leading-[1.2] text-primary hover:underline"
			>
				<component :is="link.icon" aria-hidden="true" />
				{{ link.label }}
				<ExternalIcon aria-hidden="true" />
			</a>
		</div>
	</section>

	<section v-if="creators.length > 0" class="sidebar-section">
		<h2 class="m-0 text-lg">{{ formatMessage(messages.creators) }}</h2>
		<component
			:is="creator.link ? RouterLink : 'span'"
			v-for="creator in creators"
			:key="creator.id"
			:to="creator.link ?? undefined"
			class="flex w-fit items-center gap-2 font-semibold text-primary"
			:class="{ 'hover:underline': creator.link }"
		>
			<Avatar
				:src="creator.avatarUrl"
				:alt="creator.name"
				:tint-by="creator.id"
				size="1.5rem"
				circle
			/>
			{{ creator.name }}
		</component>
	</section>

	<section v-if="details.length > 0" class="sidebar-section">
		<h2 class="m-0 text-lg">{{ formatMessage(commonMessages.detailsLabel) }}</h2>
		<div
			v-for="detail in details"
			:key="detail.text"
			class="flex items-center gap-2"
			:class="{ 'text-secondary': detail.secondary }"
		>
			<component :is="detail.icon" aria-hidden="true" class="shrink-0" />
			{{ detail.text }}
		</div>
	</section>
</template>

<style scoped lang="scss">
.sidebar-section {
	@apply flex flex-col gap-2 border-0 border-b-[1px] border-solid border-[--brand-gradient-border] p-4;
}
</style>
