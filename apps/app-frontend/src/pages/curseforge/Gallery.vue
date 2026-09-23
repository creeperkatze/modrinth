<script setup lang="ts">
import { ExternalIcon } from '@modrinth/assets'
import { Button, Card, ImageViewerEditor } from '@modrinth/ui'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { Mod } from 'curseforge-js'
import { computed, ref } from 'vue'

const props = defineProps<{
	mod: Mod
}>()

const galleryViewer = ref<InstanceType<typeof ImageViewerEditor> | null>(null)
const galleryViewerItems = computed(() =>
	props.mod.screenshots.map((screenshot) => ({
		id: String(screenshot.id),
		src: screenshot.url,
		alt: screenshot.title || 'Gallery image',
		title: screenshot.title,
		description: screenshot.description,
	})),
)
</script>

<template>
	<div class="grid w-full grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
		<Card
			v-for="(screenshot, index) in mod.screenshots"
			:key="screenshot.id"
			class="!m-0 flex flex-col overflow-hidden !p-0"
		>
			<button
				class="m-0 cursor-pointer border-none bg-transparent p-0"
				@click="galleryViewer?.show(index)"
			>
				<img
					:src="screenshot.thumbnailUrl || screenshot.url"
					:alt="screenshot.title"
					class="aspect-[2/1] w-full object-cover object-center"
				/>
			</button>
			<div class="flex grow flex-col gap-1 p-4">
				<h3 class="m-0 text-base text-contrast">{{ screenshot.title }}</h3>
				<span v-if="screenshot.description">{{ screenshot.description }}</span>
			</div>
		</Card>
	</div>
	<ImageViewerEditor ref="galleryViewer" :items="galleryViewerItems" editor="disabled">
		<template #actions="{ item }">
			<Button
				type="quiet"
				class="!w-9 !rounded-full !p-0"
				aria-label="Open image in new tab"
				@click="openUrl(item.src)"
			>
				<ExternalIcon aria-hidden="true" />
			</Button>
		</template>
	</ImageViewerEditor>
</template>
