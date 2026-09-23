<script setup lang="ts">
import { defineMessages, injectNotificationManager, RadioButtons, useVIntl } from '@modrinth/ui'
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'

import { appSettingsKeys, get, set } from '@/helpers/settings.ts'
import { instanceKeys } from '@/pages/instance/query-options'
import { CONTENT_PLATFORM_IDS, CONTENT_PLATFORMS, type ContentPlatformId } from '@/platforms'

const { formatMessage } = useVIntl()
const { handleError } = injectNotificationManager()
const queryClient = useQueryClient()

const messages = defineMessages({
	defaultPlatformTitle: {
		id: 'app.settings.platforms.default-platform.title',
		defaultMessage: 'Default platform',
	},
	defaultPlatformDescription: {
		id: 'app.settings.platforms.default-platform.description',
		defaultMessage:
			'Used to identify content added outside of Refract, such as files copied into the mods folder, when more than one platform recognizes it. Content installed from a platform always links to that platform.',
	},
})

const defaultPlatform = ref<ContentPlatformId>((await get()).default_content_platform)

async function setDefaultPlatform(platform: ContentPlatformId) {
	const previous = defaultPlatform.value
	defaultPlatform.value = platform
	try {
		const settings = await get()
		settings.default_content_platform = platform
		await set(settings)
		queryClient.setQueryData(appSettingsKeys.all, settings)
		await queryClient.invalidateQueries({ queryKey: [...instanceKeys.all, 'content'] })
	} catch (error) {
		defaultPlatform.value = previous
		handleError(error as Error)
	}
}
</script>

<template>
	<div class="flex flex-col gap-2.5">
		<h2 class="m-0 text-lg font-semibold text-contrast">
			{{ formatMessage(messages.defaultPlatformTitle) }}
		</h2>
		<p class="m-0 leading-tight text-secondary">
			{{ formatMessage(messages.defaultPlatformDescription) }}
		</p>
		<RadioButtons
			:model-value="defaultPlatform"
			:items="CONTENT_PLATFORM_IDS"
			class="!flex-row flex-wrap"
			@update:model-value="setDefaultPlatform"
		>
			<template #default="{ item }">
				<component :is="CONTENT_PLATFORMS[item].icon" class="h-5 w-5" aria-hidden="true" />
				{{ CONTENT_PLATFORMS[item].name }}
			</template>
		</RadioButtons>
	</div>
</template>
