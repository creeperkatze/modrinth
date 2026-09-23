<script setup lang="ts">
import type { Mod } from 'curseforge-js'
import { computed } from 'vue'

import ProjectPageGallery from '@/components/ui/project-page/ProjectPageGallery.vue'
import type { ProjectGalleryItem } from '@/components/ui/project-page/types'

const props = defineProps<{
	mod: Mod
}>()

const items = computed<ProjectGalleryItem[]>(() =>
	props.mod.screenshots.map((screenshot) => ({
		id: String(screenshot.id),
		url: screenshot.url,
		thumbnailUrl: screenshot.thumbnailUrl,
		title: screenshot.title,
		description: screenshot.description,
	})),
)
</script>

<template>
	<ProjectPageGallery :items="items" />
</template>
