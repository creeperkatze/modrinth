<script setup lang="ts">
import { CheckIcon, DownloadIcon, ExternalIcon, PlusIcon, SearchIcon, SpinnerIcon } from '@modrinth/assets'
import {
	Admonition,
	Button,
	Combobox,
	type ComboboxOption,
	commonMessages,
	defineMessages,
	formatProjectTypeSentence,
	Input,
	LoadingIndicator,
	NavTabs,
	Pagination,
	ProjectCard,
	ProjectCardList,
	useVIntl,
} from '@modrinth/ui'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import { openUrl } from '@tauri-apps/plugin-opener'
import { refDebounced } from '@vueuse/core'
import { type Mod, ModsSearchSortField, type SortOrder } from 'curseforge-js'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCurseForgeInstall } from '@/composables/curseforge/use-curseforge-install'
import {
	CURSEFORGE_CLASS_IDS,
	curseForgeModQueryKey,
	getCurseForgeClient,
	getLoaderTypes,
	hasCurseForgeApiKey,
	isCurseForgeContentType,
	MINECRAFT_GAME_ID,
} from '@/helpers/curseforge'
import { list as listInstances } from '@/helpers/instance'
import type { GameInstance } from '@/helpers/types'
import { CONTENT_PLATFORMS } from '@/platforms'

type ProjectTypeTab = {
	label: string
	href: string
	shown?: boolean
}

type SortOption = {
	key: string
	field: ModsSearchSortField
	order: SortOrder
	label: string
}

const props = defineProps<{
	projectType: string
	instance: GameInstance | null
	projectTypeTabs: ProjectTypeTab[]
}>()

const { formatMessage } = useVIntl()
const queryClient = useQueryClient()
const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 20
/** CurseForge rejects searches where `index + pageSize` exceeds this. */
const MAX_SEARCH_WINDOW = 10_000

const messages = defineMessages({
	missingApiKeyTitle: {
		id: 'app.browse.curseforge.missing-api-key.title',
		defaultMessage: 'CurseForge API key missing',
	},
	missingApiKeyBody: {
		id: 'app.browse.curseforge.missing-api-key.body',
		defaultMessage:
			'Set CURSEFORGE_API_KEY in packages/app-lib/.env and restart the app to browse CurseForge.',
	},
	unsupportedTypeTitle: {
		id: 'app.browse.curseforge.unsupported-type.title',
		defaultMessage: "CurseForge {projectType} aren't supported yet",
	},
	unsupportedTypeBody: {
		id: 'app.browse.curseforge.unsupported-type.body',
		defaultMessage: 'Switch to Modrinth or pick another content type.',
	},
	selectInstanceTitle: {
		id: 'app.browse.curseforge.select-instance.title',
		defaultMessage: 'Select an instance to install to',
	},
	selectInstanceBody: {
		id: 'app.browse.curseforge.select-instance.body',
		defaultMessage:
			'CurseForge content is installed into a specific instance. Pick one to filter results by its Minecraft version and loader.',
	},
	selectInstancePlaceholder: {
		id: 'app.browse.curseforge.select-instance.placeholder',
		defaultMessage: 'Select instance',
	},
	searchPlaceholder: {
		id: 'app.browse.curseforge.search-placeholder',
		defaultMessage: 'Search {projectType} on CurseForge...',
	},
	allCategories: {
		id: 'app.browse.curseforge.all-categories',
		defaultMessage: 'All categories',
	},
	sortPopularity: {
		id: 'app.browse.curseforge.sort.popularity',
		defaultMessage: 'Popularity',
	},
	sortDownloads: {
		id: 'app.browse.curseforge.sort.downloads',
		defaultMessage: 'Downloads',
	},
	sortUpdated: {
		id: 'app.browse.curseforge.sort.updated',
		defaultMessage: 'Recently updated',
	},
	sortNewest: {
		id: 'app.browse.curseforge.sort.newest',
		defaultMessage: 'Newest',
	},
	sortName: {
		id: 'app.browse.curseforge.sort.name',
		defaultMessage: 'Name',
	},
	searchFailed: {
		id: 'app.browse.curseforge.search-failed',
		defaultMessage: 'Could not load results from CurseForge.',
	},
	noResults: {
		id: 'app.browse.curseforge.no-results',
		defaultMessage: 'No results found for your query!',
	},
	downloadOnCurseForge: {
		id: 'app.browse.curseforge.download-on-curseforge',
		defaultMessage: 'Download on CurseForge',
	},
	downloadOnCurseForgeTooltip: {
		id: 'app.browse.curseforge.download-on-curseforge.tooltip',
		defaultMessage: "This project's author doesn't allow downloads from other apps",
	},
})

const contentType = computed(() =>
	isCurseForgeContentType(props.projectType) ? props.projectType : null,
)

const tabs = computed(() =>
	props.projectTypeTabs.filter((tab) =>
		isCurseForgeContentType(new URL(tab.href, 'http://tabs').pathname.split('/')[2] ?? ''),
	),
)

const sortOptions = computed<SortOption[]>(() => [
	{
		key: 'popularity',
		field: ModsSearchSortField.Popularity,
		order: 'desc',
		label: formatMessage(messages.sortPopularity),
	},
	{
		key: 'downloads',
		field: ModsSearchSortField.TotalDownloads,
		order: 'desc',
		label: formatMessage(messages.sortDownloads),
	},
	{
		key: 'updated',
		field: ModsSearchSortField.LastUpdated,
		order: 'desc',
		label: formatMessage(messages.sortUpdated),
	},
	{
		key: 'newest',
		field: ModsSearchSortField.ReleasedDate,
		order: 'desc',
		label: formatMessage(messages.sortNewest),
	},
	{
		key: 'name',
		field: ModsSearchSortField.Name,
		order: 'asc',
		label: formatMessage(messages.sortName),
	},
])
const sortKey = ref('popularity')
const sort = computed(
	() => sortOptions.value.find((option) => option.key === sortKey.value) ?? sortOptions.value[0],
)
const sortComboboxOptions = computed<ComboboxOption<string>[]>(() =>
	sortOptions.value.map((option) => ({ value: option.key, label: option.label })),
)

const query = ref('')
const debouncedQuery = refDebounced(query, 300)
/** `0` means all categories. */
const categoryId = ref(0)
const page = ref(1)

watch([debouncedQuery, sortKey, categoryId, contentType, () => props.instance?.id], () => {
	page.value = 1
})
watch(contentType, () => {
	categoryId.value = 0
})

const enabled = computed(() => hasCurseForgeApiKey() && contentType.value !== null)

const categoriesQuery = useQuery(
	computed(() => ({
		queryKey: ['curseforge', 'categories', contentType.value],
		queryFn: async () => {
			const client = await getCurseForgeClient()
			return client.categories.list({
				gameId: MINECRAFT_GAME_ID,
				classId: CURSEFORGE_CLASS_IDS[contentType.value!],
			})
		},
		enabled: enabled.value,
		staleTime: 60 * 60 * 1000,
	})),
)
const categoryOptions = computed<ComboboxOption<number>[]>(() => [
	{ value: 0, label: formatMessage(messages.allCategories) },
	...(categoriesQuery.data.value ?? [])
		.filter((category) => !category.isClass)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((category) => ({ value: category.id, label: category.name })),
])

const searchOptions = computed(() => {
	const type = contentType.value
	if (!type) return null
	return {
		gameId: MINECRAFT_GAME_ID,
		classId: CURSEFORGE_CLASS_IDS[type],
		searchFilter: debouncedQuery.value.trim() || undefined,
		sortField: sort.value.field,
		sortOrder: sort.value.order,
		categoryId: categoryId.value || undefined,
		gameVersion: props.instance?.game_version,
		modLoaderTypes: props.instance ? getLoaderTypes(type, props.instance.loader) : undefined,
		index: (page.value - 1) * PAGE_SIZE,
		pageSize: PAGE_SIZE,
	}
})

const searchQuery = useQuery(
	computed(() => ({
		queryKey: ['curseforge', 'search', searchOptions.value],
		queryFn: async () => {
			const client = await getCurseForgeClient()
			const options = searchOptions.value!
			return client.mods.search({
				...options,
				modLoaderTypes: options.modLoaderTypes?.length ? options.modLoaderTypes : undefined,
			})
		},
		enabled: enabled.value && searchOptions.value !== null,
		placeholderData: keepPreviousData,
		staleTime: 30_000,
	})),
)

const results = computed(() => searchQuery.data.value?.data ?? [])
const pageCount = computed(() => {
	const total = Math.min(searchQuery.data.value?.pagination.totalCount ?? 0, MAX_SEARCH_WINDOW)
	return Math.max(1, Math.ceil(total / PAGE_SIZE))
})

const instancesQuery = useQuery({
	queryKey: ['curseforge', 'instances'],
	queryFn: listInstances,
	enabled: computed(() => !props.instance),
})
const instanceOptions = computed<ComboboxOption<string>[]>(() =>
	(instancesQuery.data.value ?? []).map((instance) => ({
		value: instance.id,
		label: `${instance.name} (${instance.loader} ${instance.game_version})`,
	})),
)

function selectInstance(instanceId: string) {
	void router.replace({ query: { ...route.query, i: instanceId } })
}

const { installedFile, installing, install: installProject } = useCurseForgeInstall(
	() => props.instance,
)

function isInstalled(mod: Mod) {
	return !!installedFile(mod)
}

function install(mod: Mod) {
	if (contentType.value) void installProject(mod, contentType.value)
}

watch(
	results,
	(mods) => {
		for (const mod of mods) {
			queryClient.setQueryData(curseForgeModQueryKey(mod.id), mod)
		}
	},
	{ immediate: true },
)

function projectLink(mod: Mod) {
	return CONTENT_PLATFORMS.curseforge.projectRoute(mod.id, {
		...(route.query.i ? { i: route.query.i } : {}),
		b: route.fullPath,
	})
}

function isRestricted(mod: Mod) {
	return mod.allowModDistribution === false
}

function openOnCurseForge(mod: Mod) {
	if (mod.links?.websiteUrl) {
		void openUrl(mod.links.websiteUrl)
	}
}
</script>

<template>
	<NavTabs :links="tabs" replace />

	<Admonition
		v-if="!hasCurseForgeApiKey()"
		type="warning"
		:header="formatMessage(messages.missingApiKeyTitle)"
	>
		{{ formatMessage(messages.missingApiKeyBody) }}
	</Admonition>
	<Admonition
		v-else-if="!contentType"
		type="info"
		:header="
			formatMessage(messages.unsupportedTypeTitle, {
				projectType: formatProjectTypeSentence(formatMessage, projectType, 2),
			})
		"
	>
		{{ formatMessage(messages.unsupportedTypeBody) }}
	</Admonition>
	<template v-else>
		<Admonition
			v-if="!instance"
			type="info"
			:header="formatMessage(messages.selectInstanceTitle)"
		>
			<div class="flex flex-col gap-3">
				<span>{{ formatMessage(messages.selectInstanceBody) }}</span>
				<Combobox
					:options="instanceOptions"
					:placeholder="formatMessage(messages.selectInstancePlaceholder)"
					searchable
					class="!w-[20rem] max-w-full"
					@update:model-value="(value: string) => selectInstance(value)"
				/>
			</div>
		</Admonition>

		<Input
			v-model="query"
			:icon="SearchIcon"
			type="text"
			autocomplete="off"
			:placeholder="
				formatMessage(messages.searchPlaceholder, {
					projectType: formatProjectTypeSentence(formatMessage, projectType, 2),
				})
			"
			clearable
			wrapper-class="w-full"
			size="large"
			@clear="query = ''"
		/>

		<div class="flex flex-wrap items-center gap-2">
			<Combobox
				v-model="sortKey"
				:options="sortComboboxOptions"
				trigger-type="base"
				class="!w-[16rem] min-w-max max-w-full"
			>
				<template #prefix>
					<span class="font-semibold text-primary">
						{{ formatMessage(commonMessages.sortByLabel) }}
					</span>
				</template>
			</Combobox>
			<Combobox
				v-model="categoryId"
				:options="categoryOptions"
				trigger-type="base"
				class="!w-[16rem] min-w-max max-w-full"
			/>
			<Pagination
				:page="page"
				:count="pageCount"
				class="ml-auto"
				@switch-page="(value: number) => (page = value)"
			/>
		</div>

		<div class="search mt-1 [overflow-anchor:none]">
			<section v-if="searchQuery.isPending.value" class="offline">
				<LoadingIndicator />
			</section>
			<section v-else-if="searchQuery.isError.value" class="offline">
				<p>{{ formatMessage(messages.searchFailed) }}</p>
			</section>
			<section v-else-if="results.length === 0" class="offline">
				<p>{{ formatMessage(messages.noResults) }}</p>
			</section>
			<ProjectCardList v-else layout="list">
				<ProjectCard
					v-for="mod in results"
					:key="mod.id"
					:link="projectLink(mod)"
					:title="mod.name"
					:icon-url="mod.logo?.thumbnailUrl || mod.logo?.url || undefined"
					:author="
						mod.authors[0] ? { name: mod.authors[0].name, link: mod.authors[0].url } : undefined
					"
					:summary="mod.summary"
					:tags="mod.categories.map((category) => category.name)"
					:downloads="mod.downloadCount"
					:date-updated="mod.dateModified"
					:date-published="mod.dateReleased"
					:displayed-date="sortKey === 'newest' ? 'published' : 'updated'"
					layout="list"
				>
					<template #actions>
						<Button
							v-if="isRestricted(mod)"
							v-tooltip="formatMessage(messages.downloadOnCurseForgeTooltip)"
							type="outlined"
							@click.stop="openOnCurseForge(mod)"
						>
							<ExternalIcon />
							{{ formatMessage(messages.downloadOnCurseForge) }}
						</Button>
						<Button
							v-else-if="instance"
							type="outlined"
							class="!text-brand [&>svg]:!text-brand !shadow-[inset_0_0_0_1px_var(--color-brand)]"
							:disabled="isInstalled(mod) || installing.has(mod.id)"
							@click.stop="install(mod)"
						>
							<SpinnerIcon v-if="installing.has(mod.id)" class="animate-spin" />
							<CheckIcon v-else-if="isInstalled(mod)" />
							<PlusIcon v-else />
							{{
								formatMessage(
									installing.has(mod.id)
										? commonMessages.installingLabel
										: isInstalled(mod)
											? commonMessages.installedLabel
											: commonMessages.installButton,
								)
							}}
						</Button>
						<Button v-else type="outlined" disabled>
							<DownloadIcon />
							{{ formatMessage(commonMessages.installButton) }}
						</Button>
					</template>
				</ProjectCard>
			</ProjectCardList>
		</div>

		<div class="flex justify-end">
			<Pagination :page="page" :count="pageCount" @switch-page="(value: number) => (page = value)" />
		</div>
	</template>
</template>
