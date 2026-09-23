<script setup lang="ts">
import { CalendarIcon, DownloadIcon } from '@modrinth/assets'
import {
	Avatar,
	defineMessages,
	PageHeader,
	PageHeaderActions,
	PageHeaderMetadata,
	PageHeaderMetadataNumberItem,
	PageHeaderMetadataTagsItem,
	PageHeaderMetadataTimeItem,
	TagItem,
	useFormatNumber,
	useVIntl,
} from '@modrinth/ui'

/** Project page header built from platform-independent project data. */
defineProps<{
	projectId: string
	title: string
	summary?: string | null
	iconUrl?: string | null
	downloads?: number
	updatedAt?: string | null
	categories?: string[]
}>()

const { formatMessage } = useVIntl()
const formatNumber = useFormatNumber()

const messages = defineMessages({
	downloads: {
		id: 'app.project-page.header.downloads',
		defaultMessage: '{count, plural, one {download} other {downloads}}',
	},
	updated: { id: 'app.project-page.header.updated', defaultMessage: 'Updated' },
})
</script>

<template>
	<PageHeader :title="title" :summary="summary">
		<template #leading>
			<Avatar :src="iconUrl" :alt="title" :tint-by="projectId" size="96px" />
		</template>
		<template #metadata>
			<PageHeaderMetadata>
				<PageHeaderMetadataNumberItem
					v-if="downloads !== undefined"
					:icon="DownloadIcon"
					:value="downloads"
					:label="formatMessage(messages.downloads, { count: downloads })"
					:tooltip="formatNumber(downloads)"
				/>
				<PageHeaderMetadataTimeItem
					v-if="updatedAt"
					:icon="CalendarIcon"
					:date="updatedAt"
					:label="formatMessage(messages.updated)"
				/>
				<PageHeaderMetadataTagsItem v-if="categories?.length" class="hidden md:flex">
					<TagItem v-for="category in categories" :key="category">{{ category }}</TagItem>
				</PageHeaderMetadataTagsItem>
			</PageHeaderMetadata>
		</template>
		<template #actions>
			<PageHeaderActions>
				<slot name="actions" />
			</PageHeaderActions>
		</template>
	</PageHeader>
</template>
