<script setup lang="ts">
import { CalendarIcon, ExternalIcon } from '@modrinth/assets'
import { Button, Card, ImageViewerEditor, useFormatDateTime } from '@modrinth/ui'
import { openUrl } from '@tauri-apps/plugin-opener'
import { computed, ref } from 'vue'

import type { ProjectGalleryItem } from './types'

const props = defineProps<{
	items: ProjectGalleryItem[]
}>()

const emit = defineEmits<{
	expand: [item: ProjectGalleryItem, index: number]
	navigate: [itemId: string, index: number, direction: 'next' | 'previous']
}>()

const formatDate = useFormatDateTime({ year: 'numeric', month: 'long', day: 'numeric' })

const galleryViewer = ref<InstanceType<typeof ImageViewerEditor> | null>(null)
const galleryViewerItems = computed(() =>
	props.items.map((item) => ({
		id: item.id,
		src: item.url,
		alt: item.title || 'Gallery image',
		title: item.title ?? undefined,
		description: item.description ?? undefined,
	})),
)

function expand(item: ProjectGalleryItem, index: number) {
	galleryViewer.value?.show(index)
	emit('expand', item, index)
}
</script>

<template>
	<div class="grid w-full grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
		<Card v-for="(item, index) in items" :key="item.id" class="!m-0 flex flex-col overflow-hidden !p-0">
			<button class="m-0 cursor-pointer border-none bg-transparent p-0" @click="expand(item, index)">
				<img
					:src="item.thumbnailUrl || item.url"
					:alt="item.title ?? ''"
					class="aspect-[2/1] w-full object-cover object-center"
				/>
			</button>
			<div class="flex grow flex-col gap-1 p-4">
				<h3 v-if="item.title" class="m-0 text-base text-contrast">{{ item.title }}</h3>
				<span v-if="item.description">{{ item.description }}</span>
			</div>
			<span v-if="item.date" class="flex items-center gap-1 px-4 pb-4 text-secondary">
				<CalendarIcon aria-hidden="true" />
				{{ formatDate(new Date(item.date)) }}
			</span>
		</Card>
	</div>
	<ImageViewerEditor
		ref="galleryViewer"
		:items="galleryViewerItems"
		editor="disabled"
		@navigate="
			(item: { id: string }, index: number, direction: 'next' | 'previous') =>
				emit('navigate', item.id, index, direction)
		"
	>
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
