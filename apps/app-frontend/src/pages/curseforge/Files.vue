<script setup lang="ts">
import { CheckIcon, DownloadIcon, ExternalIcon, SpinnerIcon } from '@modrinth/assets'
import {
	Button,
	Card,
	commonMessages,
	defineMessages,
	LoadingIndicator,
	Pagination,
	TagItem,
	TagTagItem,
	Toggle,
	useFormatDateTime,
	useVIntl,
	VersionChannelIndicator,
} from '@modrinth/ui'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { File as CurseForgeFile, Mod } from 'curseforge-js'
import { computed, ref, watch } from 'vue'

import { SwapIcon } from '@/assets/icons/index.js'
import {
	type CurseForgeProjectType,
	fileGameVersions,
	fileLoaders,
	fileSupportsLoaders,
	getCurseForgeClient,
	getLoaderTypes,
	releaseChannel,
} from '@/helpers/curseforge'
import type { GameInstance } from '@/helpers/types'

const props = defineProps<{
	mod: Mod
	contentType: CurseForgeProjectType | null
	instance: GameInstance | null
	installedFileId: string | null
	installing: boolean
	install: (file?: CurseForgeFile) => void
}>()

const { formatMessage } = useVIntl()
const formatDate = useFormatDateTime({ year: 'numeric', month: 'short', day: 'numeric' })

const PAGE_SIZE = 50
/** How many Minecraft versions to list per file before collapsing the rest. */
const MAX_VISIBLE_GAME_VERSIONS = 3

const messages = defineMessages({
	onlyCompatible: {
		id: 'app.curseforge.files.only-compatible',
		defaultMessage: 'Only show files for {instance}',
	},
	noFiles: { id: 'app.curseforge.files.none', defaultMessage: 'No files found.' },
	loadError: {
		id: 'app.curseforge.files.load-error',
		defaultMessage: 'Could not load files from CurseForge.',
	},
	switchTo: { id: 'app.curseforge.files.switch', defaultMessage: 'Switch' },
	downloadOnCurseForge: {
		id: 'app.curseforge.files.download-on-curseforge',
		defaultMessage: 'Download on CurseForge',
	},
	moreVersions: { id: 'app.curseforge.files.more-versions', defaultMessage: '+{count}' },
	downloads: {
		id: 'app.curseforge.files.downloads',
		defaultMessage: '{count, plural, one {# download} other {# downloads}}',
	},
})

const onlyCompatible = ref(true)
const page = ref(1)
const filterByInstance = computed(() => !!props.instance && onlyCompatible.value)

watch([filterByInstance, () => props.mod.id], () => {
	page.value = 1
})

const filesQuery = useQuery(
	computed(() => ({
		queryKey: [
			'curseforge',
			'files',
			props.mod.id,
			filterByInstance.value ? props.instance?.game_version : null,
			page.value,
		],
		queryFn: async () => {
			const client = await getCurseForgeClient()
			return client.files.list(props.mod.id, {
				gameVersion: filterByInstance.value ? props.instance?.game_version : undefined,
				index: (page.value - 1) * PAGE_SIZE,
				pageSize: PAGE_SIZE,
			})
		},
		placeholderData: keepPreviousData,
		staleTime: 60 * 1000,
	})),
)

const files = computed(() => {
	const all = filesQuery.data.value?.data ?? []
	if (!filterByInstance.value || !props.instance || !props.contentType) return all
	const loaderTypes = getLoaderTypes(props.contentType, props.instance.loader)
	return all.filter((file) => fileSupportsLoaders(file, loaderTypes))
})
const pageCount = computed(() =>
	Math.max(1, Math.ceil((filesQuery.data.value?.pagination.totalCount ?? 0) / PAGE_SIZE)),
)

function isInstalled(file: CurseForgeFile) {
	return props.installedFileId === String(file.id)
}

function canDownload(file: CurseForgeFile) {
	return !!file.downloadUrl && props.mod.allowModDistribution !== false
}

function openFileOnCurseForge(file: CurseForgeFile) {
	if (props.mod.links?.websiteUrl) void openUrl(`${props.mod.links.websiteUrl}/files/${file.id}`)
}
</script>

<template>
	<div class="flex flex-col gap-4">
		<div class="flex flex-wrap items-center gap-4">
			<label v-if="instance" class="flex cursor-pointer items-center gap-2 font-medium text-contrast">
				<Toggle v-model="onlyCompatible" small />
				{{ formatMessage(messages.onlyCompatible, { instance: instance.name }) }}
			</label>
			<Pagination
				:page="page"
				:count="pageCount"
				class="ml-auto"
				@switch-page="(value: number) => (page = value)"
			/>
		</div>

		<LoadingIndicator v-if="filesQuery.isPending.value" />
		<Card v-else-if="filesQuery.isError.value">{{ formatMessage(messages.loadError) }}</Card>
		<Card v-else-if="files.length === 0">{{ formatMessage(messages.noFiles) }}</Card>
		<Card v-else class="!p-0">
			<div
				v-for="file in files"
				:key="file.id"
				class="flex flex-wrap items-center gap-x-4 gap-y-2 border-0 border-b border-solid border-divider px-4 py-3 last:border-b-0"
			>
				<VersionChannelIndicator :channel="releaseChannel(file.releaseType)" size="sm" />
				<div class="flex min-w-0 flex-1 flex-col">
					<span class="truncate font-semibold text-contrast">{{ file.displayName }}</span>
					<span class="truncate text-sm text-secondary">{{ file.fileName }}</span>
				</div>
				<div class="flex flex-wrap items-center gap-1">
					<TagTagItem v-for="loader in fileLoaders(file)" :key="loader" :tag="loader" />
					<TagItem
						v-for="version in fileGameVersions(file).slice(0, MAX_VISIBLE_GAME_VERSIONS)"
						:key="version"
					>
						{{ version }}
					</TagItem>
					<TagItem
						v-if="fileGameVersions(file).length > MAX_VISIBLE_GAME_VERSIONS"
						v-tooltip="fileGameVersions(file).slice(MAX_VISIBLE_GAME_VERSIONS).join(', ')"
					>
						{{
							formatMessage(messages.moreVersions, {
								count: fileGameVersions(file).length - MAX_VISIBLE_GAME_VERSIONS,
							})
						}}
					</TagItem>
				</div>
				<div class="flex w-40 flex-col text-sm text-secondary">
					<span>{{ formatDate(new Date(file.fileDate)) }}</span>
					<span>
						{{ formatMessage(messages.downloads, { count: file.downloadCount }) }}
					</span>
				</div>
				<div class="flex w-48 justify-end">
					<Button v-if="isInstalled(file)" disabled>
						<CheckIcon />
						{{ formatMessage(commonMessages.installedLabel) }}
					</Button>
					<Button v-else-if="!canDownload(file)" @click="openFileOnCurseForge(file)">
						<ExternalIcon />
						{{ formatMessage(messages.downloadOnCurseForge) }}
					</Button>
					<Button v-else-if="instance" :disabled="installing" @click="install(file)">
						<SpinnerIcon v-if="installing" class="animate-spin" />
						<SwapIcon v-else-if="installedFileId" />
						<DownloadIcon v-else />
						{{
							formatMessage(installedFileId ? messages.switchTo : commonMessages.installButton)
						}}
					</Button>
				</div>
			</div>
		</Card>

		<div v-if="pageCount > 1" class="flex justify-end">
			<Pagination :page="page" :count="pageCount" @switch-page="(value: number) => (page = value)" />
		</div>
	</div>
</template>
