<template>
	<ProjectPageGallery :items="items" @expand="trackExpand" @navigate="trackNavigation" />
</template>

<script setup>
import { computed } from 'vue'

import ProjectPageGallery from '@/components/ui/project-page/ProjectPageGallery.vue'
import { trackEvent } from '@/helpers/analytics'

const MC_SERVER_BANNER_NAME = '__mc_server_banner__'

const props = defineProps({
	project: {
		type: Object,
		default: () => ({}),
	},
})

const items = computed(
	() =>
		props.project.gallery
			?.filter((image) => image.title !== MC_SERVER_BANNER_NAME)
			.map((image) => ({
				id: image.url,
				url: image.raw_url ?? 'https://cdn.modrinth.com/placeholder-banner.svg',
				thumbnailUrl: image.url,
				title: image.title,
				description: image.description,
				date: image.created,
			})) ?? [],
)

function trackExpand(item) {
	trackEvent('GalleryImageExpand', {
		project_id: props.project.id,
		url: item.id,
	})
}

function trackNavigation(itemId, _index, direction) {
	trackEvent(direction === 'next' ? 'GalleryImageNext' : 'GalleryImagePrevious', {
		project_id: props.project.id,
		url: itemId,
	})
}
</script>
