<script setup lang="ts">
import { CheckIcon, ExternalIcon, PlusIcon, SpinnerIcon } from '@modrinth/assets'
import { Button, commonMessages, defineMessages, ProjectCard, useVIntl } from '@modrinth/ui'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { Mod } from 'curseforge-js'
import type { RouteLocationRaw } from 'vue-router'

import { CONTENT_PLATFORMS } from '@/platforms'

/** A CurseForge project in a list, with an install button or a link to download it manually. */
const props = withDefaults(
	defineProps<{
		mod: Mod
		link: RouteLocationRaw
		installed?: boolean
		installing?: boolean
		displayedDate?: 'published' | 'updated'
	}>(),
	{ installed: false, installing: false, displayedDate: 'updated' },
)

const emit = defineEmits<{ install: [] }>()

const { formatMessage } = useVIntl()

const messages = defineMessages({
	downloadOnCurseForge: {
		id: 'app.browse.curseforge.download-on-curseforge',
		defaultMessage: 'Download on CurseForge',
	},
	downloadOnCurseForgeTooltip: {
		id: 'app.browse.curseforge.download-on-curseforge.tooltip',
		defaultMessage: "This project's author doesn't allow downloads from other apps",
	},
})

function openOnCurseForge() {
	if (props.mod.links?.websiteUrl) void openUrl(props.mod.links.websiteUrl)
}
</script>

<template>
	<ProjectCard
		:link="link"
		:title="mod.name"
		:icon-url="mod.logo?.thumbnailUrl || mod.logo?.url || undefined"
		:author="
			mod.authors[0]
				? {
						name: mod.authors[0].name,
						link: CONTENT_PLATFORMS.curseforge.userRoute(mod.authors[0].id),
					}
				: undefined
		"
		:summary="mod.summary"
		:tags="mod.categories.map((category) => category.name)"
		:downloads="mod.downloadCount"
		:date-updated="mod.dateModified"
		:date-published="mod.dateReleased"
		:displayed-date="displayedDate"
		layout="list"
	>
		<template #actions>
			<Button
				v-if="mod.allowModDistribution === false"
				v-tooltip="formatMessage(messages.downloadOnCurseForgeTooltip)"
				type="outlined"
				@click.stop="openOnCurseForge"
			>
				<ExternalIcon />
				{{ formatMessage(messages.downloadOnCurseForge) }}
			</Button>
			<Button
				v-else
				type="outlined"
				class="!text-brand [&>svg]:!text-brand !shadow-[inset_0_0_0_1px_var(--color-brand)]"
				:disabled="installed || installing"
				@click.stop="emit('install')"
			>
				<SpinnerIcon v-if="installing" class="animate-spin" />
				<CheckIcon v-else-if="installed" />
				<PlusIcon v-else />
				{{
					formatMessage(
						installing
							? commonMessages.installingLabel
							: installed
								? commonMessages.installedLabel
								: commonMessages.installButton,
					)
				}}
			</Button>
		</template>
	</ProjectCard>
</template>
