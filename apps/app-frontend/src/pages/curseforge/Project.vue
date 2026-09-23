<script setup lang="ts">
import {
	CalendarIcon,
	CheckIcon,
	ClipboardCopyIcon,
	CodeIcon,
	CurseForgeIcon,
	DownloadIcon,
	ExternalIcon,
	GlobeIcon,
	IssuesIcon,
	MoreVerticalIcon,
	SpinnerIcon,
	WikiIcon,
} from '@modrinth/assets'
import {
	Admonition,
	Avatar,
	BrowseInstallHeader,
	Button,
	Combobox,
	type ComboboxOption,
	commonMessages,
	defineMessages,
	LoadingIndicator,
	NavTabs,
	PageHeader,
	PageHeaderActions,
	PageHeaderMetadata,
	PageHeaderMetadataNumberItem,
	PageHeaderMetadataTagsItem,
	PageHeaderMetadataTimeItem,
	TagItem,
	TagTagItem,
	TeleportOverflowMenu,
	useFormatDateTime,
	useFormatNumber,
	useVIntl,
} from '@modrinth/ui'
import { useQuery } from '@tanstack/vue-query'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { File as CurseForgeFile } from 'curseforge-js'
import { computed, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { SwapIcon } from '@/assets/icons/index.js'
import { useCurseForgeInstall } from '@/composables/curseforge/use-curseforge-install'
import {
	compareGameVersionsDesc,
	contentTypeFromClassId,
	curseForgeModQueryKey,
	getCurseForgeClient,
	hasCurseForgeApiKey,
	LOADER_TAGS,
} from '@/helpers/curseforge'
import { getInstanceIconUrl, list as listInstances } from '@/helpers/instance'
import { instanceDetailQueryOptions } from '@/pages/instance/query-options'
import { provideBreadcrumbParent, useBreadcrumb } from '@/providers/breadcrumbs'

const { formatMessage } = useVIntl()
const formatNumber = useFormatNumber()
const formatDate = useFormatDateTime({ year: 'numeric', month: 'long', day: 'numeric' })
const route = useRoute()
const router = useRouter()

const messages = defineMessages({
	curseForge: {
		id: 'app.curseforge.project.breadcrumb',
		defaultMessage: 'CurseForge',
	},
	missingApiKey: {
		id: 'app.curseforge.project.missing-api-key',
		defaultMessage:
			'Set CURSEFORGE_API_KEY in packages/app-lib/.env and restart the app to view CurseForge projects.',
	},
	loadError: {
		id: 'app.curseforge.project.load-error',
		defaultMessage: 'This CurseForge project could not be loaded.',
	},
	descriptionTab: { id: 'app.curseforge.project.tab.description', defaultMessage: 'Description' },
	filesTab: { id: 'app.curseforge.project.tab.files', defaultMessage: 'Files' },
	galleryTab: { id: 'app.curseforge.project.tab.gallery', defaultMessage: 'Gallery' },
	downloads: {
		id: 'app.curseforge.project.downloads',
		defaultMessage: '{count, plural, one {download} other {downloads}}',
	},
	updated: { id: 'app.curseforge.project.updated', defaultMessage: 'Updated' },
	moreOptions: { id: 'app.curseforge.project.more-options', defaultMessage: 'More options' },
	openOnCurseForge: {
		id: 'app.curseforge.project.open-on-curseforge',
		defaultMessage: 'Open on CurseForge',
	},
	downloadOnCurseForge: {
		id: 'app.curseforge.project.download-on-curseforge',
		defaultMessage: 'Download on CurseForge',
	},
	downloadOnCurseForgeTooltip: {
		id: 'app.curseforge.project.download-on-curseforge.tooltip',
		defaultMessage: "This project's author doesn't allow downloads from other apps",
	},
	installTo: {
		id: 'app.curseforge.project.install-to',
		defaultMessage: 'Install to instance...',
	},
	switchVersion: {
		id: 'app.curseforge.project.switch-version',
		defaultMessage: 'Switch version',
	},
	backToBrowse: { id: 'app.curseforge.project.back-to-browse', defaultMessage: 'Back to discover' },
	backToInstance: {
		id: 'app.curseforge.project.back-to-instance',
		defaultMessage: 'Back to instance',
	},
	compatibility: { id: 'app.curseforge.project.compatibility', defaultMessage: 'Compatibility' },
	minecraftVersions: {
		id: 'app.curseforge.project.minecraft-versions',
		defaultMessage: 'Minecraft: Java Edition',
	},
	platforms: { id: 'app.curseforge.project.platforms', defaultMessage: 'Platforms' },
	links: { id: 'app.curseforge.project.links', defaultMessage: 'Links' },
	projectPage: { id: 'app.curseforge.project.links.page', defaultMessage: 'CurseForge page' },
	wiki: { id: 'app.curseforge.project.links.wiki', defaultMessage: 'Wiki' },
	issues: { id: 'app.curseforge.project.links.issues', defaultMessage: 'Issues' },
	source: { id: 'app.curseforge.project.links.source', defaultMessage: 'Source' },
	creators: { id: 'app.curseforge.project.creators', defaultMessage: 'Creators' },
	created: { id: 'app.curseforge.project.details.created', defaultMessage: 'Created {date}' },
	updatedOn: { id: 'app.curseforge.project.details.updated', defaultMessage: 'Updated {date}' },
	projectId: { id: 'app.curseforge.project.details.id', defaultMessage: 'Project ID {id}' },
})

const displayedRoute = shallowRef(router.currentRoute.value)
watch(
	() => router.currentRoute.value,
	(nextRoute) => {
		if (nextRoute.path.startsWith('/curseforge/')) {
			displayedRoute.value = nextRoute
		}
	},
	{ immediate: true },
)

const modId = computed(() => Number(displayedRoute.value.params.id))
const instanceId = computed(() => {
	const id = displayedRoute.value.query.i
	return typeof id === 'string' ? id : ''
})

const modQuery = useQuery(
	computed(() => ({
		queryKey: curseForgeModQueryKey(modId.value),
		queryFn: async () => (await getCurseForgeClient()).mods.get(modId.value),
		enabled: hasCurseForgeApiKey() && Number.isFinite(modId.value),
		staleTime: 5 * 60 * 1000,
	})),
)
const mod = computed(() => modQuery.data.value ?? null)
const contentType = computed(() => (mod.value ? contentTypeFromClassId(mod.value.classId) : null))

const instanceQuery = useQuery(
	computed(() => ({
		...instanceDetailQueryOptions(instanceId.value),
		enabled: !!instanceId.value,
	})),
)
const instance = computed(() => instanceQuery.data.value ?? null)
const { installedFile, installing, install: installProject } = useCurseForgeInstall(instance)

const isInstalling = computed(() => !!mod.value && installing.value.has(mod.value.id))
const isInstalled = computed(() => !!mod.value && !!installedFile(mod.value))
const isRestricted = computed(() => mod.value?.allowModDistribution === false)

function withQuery(path: string) {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(route.query)) {
		if (typeof value === 'string') params.set(key, value)
	}
	const query = params.toString()
	return query ? `${path}?${query}` : path
}

const projectPath = computed(() => `/curseforge/${modId.value}`)
const filesHref = computed(() => withQuery(`${projectPath.value}/files`))

const browseHref = computed(() => {
	const browsePath = displayedRoute.value.query.b
	if (typeof browsePath === 'string' && browsePath.startsWith('/browse/')) return browsePath
	const params = new URLSearchParams({ src: 'curseforge' })
	if (instanceId.value) params.set('i', instanceId.value)
	return `/browse/${contentType.value ?? 'mod'}?${params}`
})

const sourceBreadcrumb = useBreadcrumb({
	slot: 'source',
	id: 'source:curseforge',
	label: () => formatMessage(messages.curseForge),
	to: browseHref,
	visual: { type: 'icon', component: CurseForgeIcon },
})
const projectBreadcrumb = useBreadcrumb(
	{
		slot: 'project',
		id: () => `curseforge:${modId.value}`,
		label: () => mod.value?.name ?? formatMessage(commonMessages.loadingLabel),
		visual: () => ({
			type: 'image',
			src: mod.value?.logo?.thumbnailUrl,
			alt: mod.value?.name,
			tintBy: String(modId.value),
		}),
		to: () => displayedRoute.value.fullPath,
	},
	{ parent: sourceBreadcrumb },
)
provideBreadcrumbParent(projectBreadcrumb)

const installContext = computed(() => {
	if (!instance.value) return null
	const fromBrowse = typeof displayedRoute.value.query.b === 'string'
	return {
		name: instance.value.name,
		loader: instance.value.loader,
		gameVersion: instance.value.game_version,
		iconSrc: getInstanceIconUrl(instance.value.icon_path),
		backUrl: fromBrowse ? browseHref.value : `/instance/${encodeURIComponent(instance.value.id)}`,
		backLabel: formatMessage(fromBrowse ? messages.backToBrowse : messages.backToInstance),
		heading: formatMessage(commonMessages.installingContentLabel),
	}
})

const instancesQuery = useQuery({
	queryKey: ['curseforge', 'instances'],
	queryFn: listInstances,
	enabled: computed(() => !instance.value),
})
const instanceOptions = computed<ComboboxOption<string>[]>(() =>
	(instancesQuery.data.value ?? []).map((candidate) => ({
		value: candidate.id,
		label: `${candidate.name} (${candidate.loader} ${candidate.game_version})`,
	})),
)

function selectInstance(id: string) {
	void router.replace({ query: { ...route.query, i: id } })
}

function install(file?: CurseForgeFile) {
	if (mod.value && contentType.value) void installProject(mod.value, contentType.value, file)
}

function openOnCurseForge(path = '') {
	if (mod.value?.links?.websiteUrl) void openUrl(`${mod.value.links.websiteUrl}${path}`)
}

const moreOptions = computed(() => [
	{
		id: 'open-on-curseforge',
		label: formatMessage(messages.openOnCurseForge),
		icon: ExternalIcon,
		action: () => openOnCurseForge(),
	},
	{
		id: 'copy-link',
		label: formatMessage(commonMessages.copyLinkButton),
		icon: ClipboardCopyIcon,
		action: () => navigator.clipboard.writeText(mod.value?.links?.websiteUrl ?? ''),
	},
])

const tabs = computed(() => [
	{ label: formatMessage(messages.descriptionTab), href: withQuery(projectPath.value) },
	{ label: formatMessage(messages.filesTab), href: filesHref.value },
	{
		label: formatMessage(messages.galleryTab),
		href: withQuery(`${projectPath.value}/gallery`),
		shown: (mod.value?.screenshots.length ?? 0) > 0,
	},
])

const gameVersions = computed(() =>
	[...new Set(mod.value?.latestFilesIndexes.map((index) => index.gameVersion) ?? [])]
		.filter((version) => /^\d/.test(version))
		.sort(compareGameVersionsDesc),
)
const loaders = computed(() => [
	...new Set(
		(mod.value?.latestFilesIndexes ?? [])
			.map((index) => LOADER_TAGS[index.modLoader])
			.filter((loader): loader is string => !!loader),
	),
])
</script>

<template>
	<div class="flex flex-col gap-4 p-6">
		<div
			v-if="installContext"
			class="sticky top-0 z-20 -mx-6 -mt-6 rounded-tl-[--radius-xl] border-0 border-b border-solid bg-surface-1 px-3 py-4 border-surface-5"
		>
			<BrowseInstallHeader :install-context="installContext" />
		</div>

		<Admonition v-if="!hasCurseForgeApiKey()" type="warning">
			{{ formatMessage(messages.missingApiKey) }}
		</Admonition>
		<LoadingIndicator v-else-if="modQuery.isPending.value" />
		<Admonition v-else-if="!mod" type="critical">
			{{ formatMessage(messages.loadError) }}
		</Admonition>
		<template v-else>
			<Teleport to="#sidebar-teleport-target">
				<div class="project-sidebar-section">
					<h2 class="m-0 text-lg">{{ formatMessage(messages.compatibility) }}</h2>
					<template v-if="gameVersions.length > 0">
						<h3 class="m-0 text-base text-secondary">
							{{ formatMessage(messages.minecraftVersions) }}
						</h3>
						<div class="flex flex-wrap gap-1">
							<TagItem v-for="version in gameVersions" :key="version">{{ version }}</TagItem>
						</div>
					</template>
					<template v-if="loaders.length > 0">
						<h3 class="m-0 text-base text-secondary">{{ formatMessage(messages.platforms) }}</h3>
						<div class="flex flex-wrap gap-1">
							<TagTagItem v-for="loader in loaders" :key="loader" :tag="loader" />
						</div>
					</template>
				</div>
				<div class="project-sidebar-section">
					<h2 class="m-0 text-lg">{{ formatMessage(messages.links) }}</h2>
					<div
						class="flex flex-col gap-3 font-semibold [&>a]:flex [&>a]:w-fit [&>a]:items-center [&>a]:gap-2 [&>a]:leading-[1.2] [&>a]:text-primary [&>a:hover]:underline"
					>
						<a v-if="mod.links?.websiteUrl" :href="mod.links.websiteUrl" target="_blank">
							<GlobeIcon aria-hidden="true" />
							{{ formatMessage(messages.projectPage) }}
							<ExternalIcon aria-hidden="true" />
						</a>
						<a v-if="mod.links?.wikiUrl" :href="mod.links.wikiUrl" target="_blank">
							<WikiIcon aria-hidden="true" />
							{{ formatMessage(messages.wiki) }}
							<ExternalIcon aria-hidden="true" />
						</a>
						<a v-if="mod.links?.issuesUrl" :href="mod.links.issuesUrl" target="_blank">
							<IssuesIcon aria-hidden="true" />
							{{ formatMessage(messages.issues) }}
							<ExternalIcon aria-hidden="true" />
						</a>
						<a v-if="mod.links?.sourceUrl" :href="mod.links.sourceUrl" target="_blank">
							<CodeIcon aria-hidden="true" />
							{{ formatMessage(messages.source) }}
							<ExternalIcon aria-hidden="true" />
						</a>
					</div>
				</div>
				<div v-if="mod.authors.length > 0" class="project-sidebar-section">
					<h2 class="m-0 text-lg">{{ formatMessage(messages.creators) }}</h2>
					<a
						v-for="author in mod.authors"
						:key="author.id"
						:href="author.url"
						target="_blank"
						class="flex w-fit items-center gap-2 font-semibold text-primary hover:underline"
					>
						<Avatar :alt="author.name" :tint-by="String(author.id)" size="1.5rem" circle />
						{{ author.name }}
					</a>
				</div>
				<div class="project-sidebar-section">
					<h2 class="m-0 text-lg">{{ formatMessage(commonMessages.detailsLabel) }}</h2>
					<div
						class="flex flex-col gap-3 [&>div]:flex [&>div]:items-center [&>div]:gap-2 [&>div>svg]:shrink-0"
					>
						<div>
							<CalendarIcon aria-hidden="true" />
							{{ formatMessage(messages.created, { date: formatDate(new Date(mod.dateCreated)) }) }}
						</div>
						<div>
							<CalendarIcon aria-hidden="true" />
							{{
								formatMessage(messages.updatedOn, { date: formatDate(new Date(mod.dateModified)) })
							}}
						</div>
						<div>
							<DownloadIcon aria-hidden="true" />
							{{ formatNumber(mod.downloadCount) }}
							{{ formatMessage(messages.downloads, { count: mod.downloadCount }) }}
						</div>
						<div class="text-secondary">
							<CurseForgeIcon aria-hidden="true" />
							{{ formatMessage(messages.projectId, { id: mod.id }) }}
						</div>
					</div>
				</div>
			</Teleport>

			<PageHeader :title="mod.name" :summary="mod.summary">
				<template #leading>
					<Avatar
						:src="mod.logo?.thumbnailUrl || mod.logo?.url"
						:alt="mod.name"
						:tint-by="String(mod.id)"
						size="96px"
					/>
				</template>
				<template #metadata>
					<PageHeaderMetadata>
						<PageHeaderMetadataNumberItem
							:icon="DownloadIcon"
							:value="mod.downloadCount"
							:label="formatMessage(messages.downloads, { count: mod.downloadCount })"
							:tooltip="formatNumber(mod.downloadCount)"
						/>
						<PageHeaderMetadataTimeItem
							:icon="CalendarIcon"
							:date="mod.dateModified"
							:label="formatMessage(messages.updated)"
						/>
						<PageHeaderMetadataTagsItem v-if="mod.categories.length > 0" class="hidden md:flex">
							<TagItem v-for="category in mod.categories" :key="category.id">
								{{ category.name }}
							</TagItem>
						</PageHeaderMetadataTagsItem>
					</PageHeaderMetadata>
				</template>
				<template #actions>
					<PageHeaderActions>
						<Button
							v-if="isRestricted"
							v-tooltip="formatMessage(messages.downloadOnCurseForgeTooltip)"
							size="xl"
							@click="openOnCurseForge()"
						>
							<ExternalIcon />
							{{ formatMessage(messages.downloadOnCurseForge) }}
						</Button>
						<template v-else-if="instance">
							<Button
								v-if="isInstalled && route.name !== 'CurseForgeFiles'"
								size="xl"
								@click="router.push(filesHref)"
							>
								<SwapIcon />
								{{ formatMessage(messages.switchVersion) }}
							</Button>
							<Button
								v-else
								type="colored"
								color="brand"
								size="xl"
								:disabled="isInstalled || isInstalling"
								@click="install()"
							>
								<SpinnerIcon v-if="isInstalling" class="animate-spin" />
								<CheckIcon v-else-if="isInstalled" />
								<DownloadIcon v-else />
								{{
									formatMessage(
										isInstalling
											? commonMessages.installingLabel
											: isInstalled
												? commonMessages.installedLabel
												: commonMessages.installButton,
									)
								}}
							</Button>
						</template>
						<Combobox
							v-else
							:options="instanceOptions"
							:placeholder="formatMessage(messages.installTo)"
							searchable
							class="!w-[16rem]"
							@update:model-value="(value: string) => selectInstance(value)"
						/>
						<TeleportOverflowMenu
							type="quiet"
							size="xl"
							:label="formatMessage(messages.moreOptions)"
							:options="moreOptions"
						>
							<MoreVerticalIcon />
						</TeleportOverflowMenu>
					</PageHeaderActions>
				</template>
			</PageHeader>

			<NavTabs :links="tabs" />

			<RouterView
				v-if="route.path.startsWith('/curseforge/')"
				:mod="mod"
				:content-type="contentType"
				:instance="instance"
				:installed-file-id="installedFile(mod)?.fileId ?? null"
				:installing="isInstalling"
				:install="install"
			/>
		</template>
	</div>
</template>

<style scoped lang="scss">
.project-sidebar-section {
	@apply flex flex-col gap-2 border-0 border-b-[1px] border-solid border-[--brand-gradient-border] p-4;
}
</style>
