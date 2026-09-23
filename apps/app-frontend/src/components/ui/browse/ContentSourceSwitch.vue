<script setup lang="ts">
import { Chips, defineMessages, useVIntl } from '@modrinth/ui'

import type { ContentSource } from '@/helpers/curseforge'

const source = defineModel<ContentSource>({ required: true })

const { formatMessage } = useVIntl()

const sources: ContentSource[] = ['modrinth', 'curseforge']
const sourceLabels: Record<ContentSource, string> = {
	modrinth: 'Modrinth',
	curseforge: 'CurseForge',
}

const messages = defineMessages({
	source: {
		id: 'app.browse.content-source',
		defaultMessage: 'Source',
	},
})
</script>

<template>
	<div
		class="flex flex-col gap-3 border-0 border-b-[1px] border-solid border-[--brand-gradient-border] p-4 last:border-b-0"
	>
		<span class="font-medium text-contrast">{{ formatMessage(messages.source) }}</span>
		<Chips
			:model-value="source"
			@update:model-value="(value) => value && (source = value)"
			:items="sources"
			:format-label="(item: ContentSource) => sourceLabels[item]"
			:capitalize="false"
			:aria-label="formatMessage(messages.source)"
			size="small"
		/>
	</div>
</template>
