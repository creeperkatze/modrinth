import { defineMessages, injectNotificationManager, useVIntl } from '@modrinth/ui'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type { File as CurseForgeFile, Mod } from 'curseforge-js'
import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'

import {
	type CurseForgeContentType,
	getInstalledCurseForgeFiles,
	installCurseForgeProject,
	NoCompatibleFileError,
} from '@/helpers/curseforge'
import type { GameInstance } from '@/helpers/types'

const messages = defineMessages({
	installed: {
		id: 'app.curseforge.install-success.title',
		defaultMessage: 'Installed {name}',
	},
	installedWithDependencies: {
		id: 'app.curseforge.install-success.dependencies',
		defaultMessage:
			'Also installed {count, plural, one {# dependency} other {# dependencies}}: {names}',
	},
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

/** Installs CurseForge projects into an instance and tracks which ones are installed or installing. */
export function useCurseForgeInstall(instance: MaybeRefOrGetter<GameInstance | null>) {
	const { formatMessage } = useVIntl()
	const { addNotification, handleError } = injectNotificationManager()
	const queryClient = useQueryClient()

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

	/** Installs the newest compatible file of `mod`, or `file` when given, replacing any installed file of it. */
	async function install(mod: Mod, contentType: CurseForgeContentType, file?: CurseForgeFile) {
		const target = toValue(instance)
		if (!target) return

		setInstalling(mod.id, true)
		try {
			const installedFiles = installedQuery.data.value ?? new Map()
			const result = await installCurseForgeProject(
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

			const dependencies = result.installed.filter((project) => project.id !== mod.id)
			if (result.installed.some((project) => project.id === mod.id)) {
				addNotification({
					title: formatMessage(messages.installed, { name: mod.name }),
					text:
						dependencies.length > 0
							? formatMessage(messages.installedWithDependencies, {
									count: dependencies.length,
									names: dependencies.map((project) => project.name).join(', '),
								})
							: undefined,
					type: 'success',
				})
			}
			if (result.restricted.length > 0) {
				addNotification({
					title: formatMessage(messages.restrictedTitle),
					text: formatMessage(messages.restrictedBody, {
						names: result.restricted.map((project) => project.name).join(', '),
					}),
					type: 'warning',
				})
			}
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
		} finally {
			setInstalling(mod.id, false)
			await queryClient.invalidateQueries({ queryKey: curseForgeInstalledQueryKey(target.id) })
		}
	}

	return { installedQuery, installedFile, installing, install }
}
