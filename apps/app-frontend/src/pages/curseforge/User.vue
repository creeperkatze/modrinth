<script setup lang="ts">
import { BoxIcon, CalendarIcon, DownloadIcon, ExternalIcon } from '@modrinth/assets'
import {
	Admonition,
	Avatar,
	Button,
	defineMessages,
	getProjectTypeCategoryMessage,
	LoadingIndicator,
	NavTabs,
	PageHeader,
	PageHeaderActions,
	PageHeaderMetadata,
	PageHeaderMetadataNumberItem,
	PageHeaderMetadataTimeItem,
	ProjectCardList,
	useFormatNumber,
	useVIntl,
} from '@modrinth/ui'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { openUrl } from '@tauri-apps/plugin-opener'
import { type Mod, ModsSearchSortField } from 'curseforge-js'
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import CurseForgeProjectCard from '@/components/ui/curseforge/CurseForgeProjectCard.vue'
import { useCurseForgeInstall } from '@/composables/curseforge/use-curseforge-install'
import {
	curseForgeAvatarUrl,
	CURSEFORGE_CLASS_IDS,
	type CurseForgeContentType,
	curseForgeModQueryKey,
	curseForgeUserQueryOptions,
	getCurseForgeClient,
	hasCurseForgeApiKey,
	isCurseForgeContentType,
	MINECRAFT_GAME_ID,
} from '@/helpers/curseforge'
import { CONTENT_PLATFORMS } from '@/platforms'
import { useBreadcrumb } from '@/providers/breadcrumbs'

/** The most projects of one type CurseForge returns in a single search. */
const PROJECTS_PER_TYPE = 50

const route = useRoute()
const queryClient = useQueryClient()
const { formatMessage } = useVIntl()
const formatNumber = useFormatNumber()
const platform = CONTENT_PLATFORMS.curseforge

const messages = defineMessages({
	projects: {
		id: 'app.curseforge.user.projects',
		defaultMessage: '{count, plural, one {project} other {projects}}',
	},
	downloads: {
		id: 'app.curseforge.user.downloads',
		defaultMessage: '{count, plural, one {download} other {downloads}}',
	},
	joined: { id: 'app.curseforge.user.joined', defaultMessage: 'Joined' },
	viewOnCurseForge: {
		id: 'app.curseforge.user.view-on-curseforge',
		defaultMessage: 'View on CurseForge',
	},
	loadFailed: {
		id: 'app.curseforge.user.load-failed',
		defaultMessage: 'Could not load this user from CurseForge.',
	},
	noProjects: {
		id: 'app.curseforge.user.no-projects',
		defaultMessage: "This user hasn't published any projects that Refract supports.",
	},
	missingApiKeyTitle: {
		id: 'app.browse.curseforge.missing-api-key.title',
		defaultMessage: 'CurseForge API key missing',
	},
	missingApiKeyBody: {
		id: 'app.browse.curseforge.missing-api-key.body',
		defaultMessage:
			'Set CURSEFORGE_API_KEY in packages/app-lib/.env and restart the app to browse CurseForge.',
	},
})

const contentTypes = Object.keys(CURSEFORGE_CLASS_IDS) as CurseForgeContentType[]

const userId = computed(() => Number(route.params.id))

const userQuery = useQuery(computed(() => curseForgeUserQueryOptions(userId.value)))

const projectsQuery = useQuery(
	computed(() => ({
		queryKey: ['curseforge', 'user', userId.value, 'projects'],
		queryFn: async () => {
			const client = await getCurseForgeClient()
			const results = await Promise.all(
				contentTypes.map((type) =>
					client.mods.search({
						gameId: MINECRAFT_GAME_ID,
						classId: CURSEFORGE_CLASS_IDS[type],
						authorId: userId.value,
						sortField: ModsSearchSortField.TotalDownloads,
						sortOrder: 'desc',
						pageSize: PROJECTS_PER_TYPE,
					}),
				),
			)
			return Object.fromEntries(
				contentTypes.map((type, index) => [type, results[index].data]),
			) as Record<CurseForgeContentType, Mod[]>
		},
		enabled: hasCurseForgeApiKey() && Number.isFinite(userId.value),
		staleTime: 5 * 60_000,
	})),
)

const projectsByType = computed(() => projectsQuery.data.value)
const allProjects = computed(() => contentTypes.flatMap((type) => projectsByType.value?.[type] ?? []))
const typesWithProjects = computed(() =>
	contentTypes.filter((type) => (projectsByType.value?.[type]?.length ?? 0) > 0),
)

const selectedType = computed<CurseForgeContentType | null>(() => {
	const requested = route.params.projectType
	if (typeof requested === 'string' && isCurseForgeContentType(requested)) return requested
	return typesWithProjects.value[0] ?? null
})
const shownProjects = computed(() =>
	selectedType.value ? (projectsByType.value?.[selectedType.value] ?? []) : [],
)

/** The user's author entry on one of their projects, used when the user lookup fails. */
const author = computed(() =>
	allProjects.value
		.flatMap((mod) => mod.authors)
		.find((projectAuthor) => projectAuthor.id === userId.value),
)
const name = computed(
	() => userQuery.data.value?.displayName ?? author.value?.name ?? String(route.params.id),
)
const avatarUrl = computed(() => curseForgeAvatarUrl(userQuery.data.value))
const totalDownloads = computed(() =>
	allProjects.value.reduce((total, mod) => total + mod.downloadCount, 0),
)

/** The first tab links to the bare profile path, which shows the first type with projects. */
const tabs = computed(() =>
	typesWithProjects.value.map((type, index) => ({
		label: formatMessage(getProjectTypeCategoryMessage(type)),
		href:
			index === 0 ? platform.userRoute(userId.value) : `${platform.userRoute(userId.value)}/${type}`,
	})),
)

const { installing, install } = useCurseForgeInstall(null)

function projectLink(mod: Mod) {
	return platform.projectRoute(mod.id)
}

watch(
	allProjects,
	(mods) => {
		for (const mod of mods) {
			queryClient.setQueryData(curseForgeModQueryKey(mod.id), mod)
		}
	},
	{ immediate: true },
)

useBreadcrumb({
	slot: 'user',
	id: () => `curseforge-user:${userId.value}`,
	label: name,
	to: () => route.fullPath,
	visual: () => ({
		type: 'image',
		src: avatarUrl.value,
		alt: name.value,
		circle: true,
		tintBy: String(userId.value),
	}),
})
</script>

<template>
	<div class="flex w-full flex-col gap-4 p-6">
		<Admonition
			v-if="!hasCurseForgeApiKey()"
			type="warning"
			:header="formatMessage(messages.missingApiKeyTitle)"
		>
			{{ formatMessage(messages.missingApiKeyBody) }}
		</Admonition>
		<template v-else>
			<PageHeader :title="name">
				<template #leading>
					<Avatar :src="avatarUrl" :alt="name" :tint-by="String(userId)" size="96px" circle />
				</template>
				<template #metadata>
					<PageHeaderMetadata>
						<PageHeaderMetadataNumberItem
							v-if="projectsQuery.data.value"
							:icon="BoxIcon"
							:value="allProjects.length"
							:label="formatMessage(messages.projects, { count: allProjects.length })"
						/>
						<PageHeaderMetadataNumberItem
							v-if="projectsQuery.data.value"
							:icon="DownloadIcon"
							:value="totalDownloads"
							:label="formatMessage(messages.downloads, { count: totalDownloads })"
							:tooltip="formatNumber(totalDownloads)"
						/>
						<PageHeaderMetadataTimeItem
							v-if="userQuery.data.value?.dateCreated"
							:icon="CalendarIcon"
							:date="userQuery.data.value.dateCreated"
							:label="formatMessage(messages.joined)"
						/>
					</PageHeaderMetadata>
				</template>
				<template #actions>
					<PageHeaderActions>
						<Button v-if="author?.url" type="outlined" @click="openUrl(author.url)">
							<ExternalIcon />
							{{ formatMessage(messages.viewOnCurseForge) }}
						</Button>
					</PageHeaderActions>
				</template>
			</PageHeader>

			<section v-if="projectsQuery.isPending.value" class="flex justify-center py-8">
				<LoadingIndicator />
			</section>
			<p v-else-if="projectsQuery.isError.value" class="m-0 text-secondary">
				{{ formatMessage(messages.loadFailed) }}
			</p>
			<p v-else-if="typesWithProjects.length === 0" class="m-0 text-secondary">
				{{ formatMessage(messages.noProjects) }}
			</p>
			<template v-else>
				<NavTabs v-if="tabs.length > 1" :links="tabs" replace />
				<ProjectCardList layout="list">
					<CurseForgeProjectCard
						v-for="mod in shownProjects"
						:key="mod.id"
						:mod="mod"
						:link="projectLink(mod)"
						:installing="installing.has(mod.id)"
						@install="selectedType && install(mod, selectedType)"
					/>
				</ProjectCardList>
			</template>
		</template>
	</div>
</template>
