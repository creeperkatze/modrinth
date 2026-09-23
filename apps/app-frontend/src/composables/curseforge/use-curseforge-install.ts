import { defineMessages, injectNotificationManager, useVIntl } from '@modrinth/ui'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type { File as CurseForgeFile, Mod } from 'curseforge-js'
import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'

import {
	compareGameVersionsDesc,
	type CurseForgeContentType,
	type CurseForgeProjectType,
	getInstalledCurseForgeFiles,
	getLoaderTypes,
	LOADER_TAGS,
	NoCompatibleFileError,
	resolveCurseForgeInstall,
} from '@/helpers/curseforge'
import {
	install_content,
	install_create_modpack_instance,
	wait_for_install_job,
} from '@/helpers/install'
import { get_external_project_instances } from '@/helpers/instance'
import type { GameInstance } from '@/helpers/types'
import { CONTENT_PLATFORMS } from '@/platforms'
import { injectAppEvents } from '@/providers/app-events'
import {
	injectContentInstall,
	type InstallTargetInstance,
	type PlatformInstallRequest,
} from '@/providers/content-install'

const messages = defineMessages({
	restrictedTitle: {
		id: 'app.curseforge.restricted.title',
		defaultMessage: 'Some files must be downloaded manually',
	},
	restrictedBody: {
		id: 'app.curseforge.restricted.body',
		defaultMessage:
			"The authors of {names} don't allow downloads from other apps. Download them from CurseForge and add them to the instance.",
	},
	noCompatibleFileTitle: {
		id: 'app.curseforge.no-compatible-file.title',
		defaultMessage: 'No compatible file',
	},
	noCompatibleFileBody: {
		id: 'app.curseforge.no-compatible-file.body',
		defaultMessage: '{name} has no files for Minecraft {gameVersion} with this loader.',
	},
})

export function curseForgeInstalledQueryKey(instanceId: string | undefined) {
	return ['curseforge', 'installed', instanceId] as const
}

/**
 * Installs CurseForge projects and tracks which ones are installed or installing. Installs go
 * straight into `instance` when one is given, and otherwise through the shared install modal.
 * Downloads run as install jobs, so progress and failures show in the download manager.
 */
export function useCurseForgeInstall(instance: MaybeRefOrGetter<GameInstance | null>) {
	const { formatMessage } = useVIntl()
	const { addNotification, handleError } = injectNotificationManager()
	const queryClient = useQueryClient()
	const contentInstall = injectContentInstall()
	const appEvents = injectAppEvents()

	const instanceId = computed(() => toValue(instance)?.id)
	const installedQuery = useQuery(
		computed(() => ({
			queryKey: curseForgeInstalledQueryKey(instanceId.value),
			queryFn: () => getInstalledCurseForgeFiles(instanceId.value!),
			enabled: !!instanceId.value,
		})),
	)
	const installing = ref(new Set<number>())

	function installedFile(mod: Pick<Mod, 'id'>) {
		return installedQuery.data.value?.get(String(mod.id)) ?? null
	}

	function setInstalling(modId: number, value: boolean) {
		const next = new Set(installing.value)
		if (value) {
			next.add(modId)
		} else {
			next.delete(modId)
		}
		installing.value = next
	}

	/** Installs `mod` into `target` with its dependencies, replacing any installed file of it. */
	async function installInto(
		target: InstallTargetInstance,
		mod: Mod,
		contentType: CurseForgeContentType,
		file?: CurseForgeFile,
	): Promise<boolean> {
		setInstalling(mod.id, true)
		try {
			const installedFiles = await queryClient.fetchQuery({
				queryKey: curseForgeInstalledQueryKey(target.id),
				queryFn: () => getInstalledCurseForgeFiles(target.id),
			})
			const plan = await resolveCurseForgeInstall(
				mod,
				contentType,
				{
					instanceId: target.id,
					gameVersion: target.game_version,
					loader: target.loader,
					installedProjectIds: new Set(installedFiles.keys()),
				},
				{ file, replacePath: installedFiles.get(String(mod.id))?.path },
			)

			if (plan.restricted.length > 0) {
				addNotification({
					title: formatMessage(messages.restrictedTitle),
					text: formatMessage(messages.restrictedBody, {
						names: plan.restricted.map((project) => project.name).join(', '),
					}),
					type: 'warning',
				})
			}
			if (plan.files.length === 0) return false

			const job = await install_content(
				target.id,
				mod.name,
				mod.logo?.thumbnailUrl || mod.logo?.url || null,
				plan.files,
			)
			const succeeded = await wait_for_install_job(appEvents, job.job_id).then(
				() => true,
				() => false,
			)
			return succeeded && plan.files.some((entry) => entry.source.project_id === String(mod.id))
		} catch (error) {
			if (error instanceof NoCompatibleFileError) {
				addNotification({
					title: formatMessage(messages.noCompatibleFileTitle),
					text: formatMessage(messages.noCompatibleFileBody, {
						name: error.mod.name,
						gameVersion: target.game_version,
					}),
					type: 'error',
				})
			} else {
				handleError(error as Error)
			}
			return false
		} finally {
			setInstalling(mod.id, false)
			await queryClient.invalidateQueries({ queryKey: curseForgeInstalledQueryKey(target.id) })
		}
	}

	function platformInstallRequest(
		mod: Mod,
		contentType: CurseForgeContentType,
	): PlatformInstallRequest {
		const author = mod.authors[0]
		const gameVersions = [...new Set(mod.latestFilesIndexes.map((index) => index.gameVersion))]
			.filter((version) => /^\d/.test(version))
			.sort(compareGameVersionsDesc)
		const loaders =
			contentType === 'mod'
				? [
						...new Set(
							mod.latestFilesIndexes
								.map((index) => LOADER_TAGS[index.modLoader])
								.filter((loader): loader is string => !!loader),
						),
					]
				: ['vanilla']

		return {
			project: {
				title: mod.name,
				iconUrl: mod.logo?.thumbnailUrl || mod.logo?.url,
				link: `${CONTENT_PLATFORMS.curseforge.projectPathPrefix}${mod.id}`,
				owner: author ? { name: author.name, circle: true, link: author.url } : null,
			},
			loaders,
			gameVersions,
			isCompatible: (target) => {
				const loaderTypes = getLoaderTypes(contentType, target.loader)
				return mod.latestFilesIndexes.some(
					(index) =>
						index.gameVersion === target.game_version &&
						(loaderTypes.length === 0 || loaderTypes.includes(index.modLoader)),
				)
			},
			getInstalledInstanceIds: () => get_external_project_instances('curseforge', String(mod.id)),
			install: (target) => installInto(target, mod, contentType),
		}
	}

	/** Queues a new instance for the modpack's main file, or `file` when given. */
	async function installModpack(mod: Mod, file?: CurseForgeFile) {
		setInstalling(mod.id, true)
		try {
			await install_create_modpack_instance({
				type: 'fromCurseForge',
				project_id: String(mod.id),
				file_id: String(file?.id ?? mod.mainFileId),
				title: mod.name,
				icon_url: mod.logo?.thumbnailUrl || mod.logo?.url || null,
			})
		} catch (error) {
			handleError(error as Error)
		} finally {
			setInstalling(mod.id, false)
		}
	}

	/**
	 * Installs the newest compatible file of `mod`, or `file` when given. Modpacks become a new
	 * instance. Other content goes into the current instance, or without one, the install modal
	 * opens to pick or create one.
	 */
	async function install(mod: Mod, projectType: CurseForgeProjectType, file?: CurseForgeFile) {
		if (projectType === 'modpack') {
			await installModpack(mod, file)
			return
		}
		const target = toValue(instance)
		if (target) {
			await installInto(target, mod, projectType, file)
		} else {
			await contentInstall.installFromPlatform(platformInstallRequest(mod, projectType))
		}
	}

	return { installedQuery, installedFile, installing, install }
}
