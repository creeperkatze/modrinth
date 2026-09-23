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
	Button,
	commonMessages,
	defineMessages,
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
import ProjectPageShell from '@/components/ui/project-page/ProjectPageShell.vue'
import ProjectPageSidebar from '@/components/ui/project-page/ProjectPageSidebar.vue'
import ProjectPageSummaryHeader from '@/components/ui/project-page/ProjectPageSummaryHeader.vue'
import type {
	ProjectCreator,
	ProjectDetail,
	ProjectLink,
	ProjectPageTab,
} from '@/components/ui/project-page/types'
import { useCurseForgeInstall } from '@/composables/curseforge/use-curseforge-install'
import {
	compareGameVersionsDesc,
	contentTypeFromClassId,
	curseForgeModQueryKey,
	getCurseForgeClient,
	hasCurseForgeApiKey,
	LOADER_TAGS,
} from '@/helpers/curseforge'
import { getInstanceIconUrl } from '@/helpers/instance'
import { instanceDetailQueryOptions } from '@/pages/instance/query-options'
import { CONTENT_PLATFORMS, projectBrowseRoute } from '@/platforms'

const { formatMessage } = useVIntl()
const formatNumber = useFormatNumber()
const formatDate = useFormatDateTime({ year: 'numeric', month: 'long', day: 'numeric' })
const route = useRoute()
const router = useRouter()

const messages = defineMessages({
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
	switchVersion: { id: 'app.curseforge.project.switch-version', defaultMessage: 'Switch version' },
	backToBrowse: { id: 'app.curseforge.project.back-to-browse', defaultMessage: 'Back to discover' },
	backToInstance: {
		id: 'app.curseforge.project.back-to-instance',
		defaultMessage: 'Back to instance',
	},
	projectPage: { id: 'app.curseforge.project.links.page', defaultMessage: 'CurseForge page' },
	wiki: { id: 'app.curseforge.project.links.wiki', defaultMessage: 'Wiki' },
	issues: { id: 'app.curseforge.project.links.issues', defaultMessage: 'Issues' },
	source: { id: 'app.curseforge.project.links.source', defaultMessage: 'Source' },
	created: { id: 'app.curseforge.project.details.created', defaultMessage: 'Created {date}' },
	updatedOn: { id: 'app.curseforge.project.details.updated', defaultMessage: 'Updated {date}' },
	downloads: {
		id: 'app.curseforge.project.details.downloads',
		defaultMessage: '{count, plural, one {# download} other {# downloads}}',
	},
	projectId: { id: 'app.curseforge.project.details.id', defaultMessage: 'Project ID {id}' },
})

const platform = CONTENT_PLATFORMS.curseforge

const displayedRoute = shallowRef(router.currentRoute.value)
watch(
	() => router.currentRoute.value,
	(nextRoute) => {
		if (nextRoute.path.startsWith(platform.projectPathPrefix)) {
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

const error = computed(() => {
	if (!hasCurseForgeApiKey()) return formatMessage(messages.missingApiKey)
	if (!modQuery.isPending.value && !mod.value) return formatMessage(messages.loadError)
	return null
})

function withQuery(path: string) {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(displayedRoute.value.query)) {
		if (typeof value === 'string') params.set(key, value)
	}
	const query = params.toString()
	return query ? `${path}?${query}` : path
}

const projectPath = computed(() => `${platform.projectPathPrefix}${modId.value}`)
const filesHref = computed(() => withQuery(`${projectPath.value}/files`))
const browseRoute = computed(() =>
	projectBrowseRoute(platform.id, contentType.value ?? 'mod', displayedRoute.value.query),
)

const tabs = computed<ProjectPageTab[]>(() => [
	{ label: formatMessage(messages.descriptionTab), href: withQuery(projectPath.value) },
	{ label: formatMessage(messages.filesTab), href: filesHref.value },
	{
		label: formatMessage(messages.galleryTab),
		href: withQuery(`${projectPath.value}/gallery`),
		shown: (mod.value?.screenshots.length ?? 0) > 0,
	},
])

const installContext = computed(() => {
	if (!instance.value) return null
	const fromBrowse = typeof displayedRoute.value.query.b === 'string'
	return {
		name: instance.value.name,
		loader: instance.value.loader,
		gameVersion: instance.value.game_version,
		iconSrc: getInstanceIconUrl(instance.value.icon_path),
		backUrl: fromBrowse ? browseRoute.value : `/instance/${encodeURIComponent(instance.value.id)}`,
		backLabel: formatMessage(fromBrowse ? messages.backToBrowse : messages.backToInstance),
		heading: formatMessage(commonMessages.installingContentLabel),
	}
})

function install(file?: CurseForgeFile) {
	if (mod.value && contentType.value) void installProject(mod.value, contentType.value, file)
}

function openOnCurseForge() {
	if (mod.value?.links?.websiteUrl) void openUrl(mod.value.links.websiteUrl)
}

const moreOptions = computed(() => [
	{
		id: 'open-on-curseforge',
		label: formatMessage(messages.openOnCurseForge),
		icon: ExternalIcon,
		action: openOnCurseForge,
	},
	{
		id: 'copy-link',
		label: formatMessage(commonMessages.copyLinkButton),
		icon: ClipboardCopyIcon,
		action: () => navigator.clipboard.writeText(mod.value?.links?.websiteUrl ?? ''),
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
const links = computed<ProjectLink[]>(() => {
	const projectLinks = mod.value?.links
	if (!projectLinks) return []
	return [
		{ icon: GlobeIcon, label: formatMessage(messages.projectPage), url: projectLinks.websiteUrl },
		{ icon: WikiIcon, label: formatMessage(messages.wiki), url: projectLinks.wikiUrl },
		{ icon: IssuesIcon, label: formatMessage(messages.issues), url: projectLinks.issuesUrl },
		{ icon: CodeIcon, label: formatMessage(messages.source), url: projectLinks.sourceUrl },
	].filter((link) => !!link.url)
})
const creators = computed<ProjectCreator[]>(
	() =>
		mod.value?.authors.map((author) => ({
			id: String(author.id),
			name: author.name,
			url: author.url,
		})) ?? [],
)
const details = computed<ProjectDetail[]>(() => {
	if (!mod.value) return []
	return [
		{
			icon: CalendarIcon,
			text: formatMessage(messages.created, { date: formatDate(new Date(mod.value.dateCreated)) }),
		},
		{
			icon: CalendarIcon,
			text: formatMessage(messages.updatedOn, {
				date: formatDate(new Date(mod.value.dateModified)),
			}),
		},
		{
			icon: DownloadIcon,
			text: formatMessage(messages.downloads, { count: formatNumber(mod.value.downloadCount) }),
		},
		{
			icon: CurseForgeIcon,
			text: formatMessage(messages.projectId, { id: mod.value.id }),
			secondary: true,
		},
	]
})
</script>

<template>
	<ProjectPageShell
		:platform="platform.id"
		:project-id="String(modId)"
		:title="mod?.name ?? null"
		:icon-url="mod?.logo?.thumbnailUrl"
		:to="displayedRoute.fullPath"
		:platform-to="browseRoute"
		:install-context="installContext"
		:tabs="tabs"
		:loading="!error && modQuery.isPending.value"
		:error="error"
	>
		<template #sidebar>
			<ProjectPageSidebar
				:game-versions="gameVersions"
				:loaders="loaders"
				:links="links"
				:creators="creators"
				:details="details"
			/>
		</template>

		<template v-if="mod" #header>
			<ProjectPageSummaryHeader
				:project-id="String(mod.id)"
				:title="mod.name"
				:summary="mod.summary"
				:icon-url="mod.logo?.thumbnailUrl || mod.logo?.url"
				:downloads="mod.downloadCount"
				:updated-at="mod.dateModified"
				:categories="mod.categories.map((category) => category.name)"
			>
				<template #actions>
					<Button
						v-if="isRestricted"
						v-tooltip="formatMessage(messages.downloadOnCurseForgeTooltip)"
						size="xl"
						@click="openOnCurseForge"
					>
						<ExternalIcon />
						{{ formatMessage(messages.downloadOnCurseForge) }}
					</Button>
					<template v-else>
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
					<TeleportOverflowMenu
						type="quiet"
						size="xl"
						:label="formatMessage(messages.moreOptions)"
						:options="moreOptions"
					>
						<MoreVerticalIcon />
					</TeleportOverflowMenu>
				</template>
			</ProjectPageSummaryHeader>
		</template>

		<RouterView
			v-if="mod && route.path.startsWith(platform.projectPathPrefix)"
			:mod="mod"
			:content-type="contentType"
			:instance="instance"
			:installed-file-id="installedFile(mod)?.fileId ?? null"
			:installing="isInstalling"
			:install="install"
		/>
	</ProjectPageShell>
</template>
