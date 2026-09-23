import { useQueryClient } from '@tanstack/vue-query'
import { type MaybeRefOrGetter, toValue, watch } from 'vue'

import {
	getCurseForgeClient,
	hasCurseForgeApiKey,
	MINECRAFT_GAME_ID,
	toExternalSource,
} from '@/helpers/curseforge'
import {
	type DetectedExternalFile,
	get_external_detection_candidates,
	record_external_detection,
} from '@/helpers/instance'
import { instanceKeys } from '@/pages/instance/query-options'

/** Looks up an instance's files on CurseForge by fingerprint and returns the files it recognises. */
async function detectCurseForgeFiles(instanceId: string): Promise<DetectedExternalFile[]> {
	const candidates = await get_external_detection_candidates(instanceId, 'curseforge')
	if (candidates.length === 0) return []

	const client = await getCurseForgeClient()
	const result = await client.fingerprints.getMatches(
		candidates.map((candidate) => candidate.fingerprint),
		MINECRAFT_GAME_ID,
	)
	const matchesByFingerprint = new Map(
		result.exactMatches.map((match) => [match.file.fileFingerprint, match]),
	)
	const modIds = [...new Set(result.exactMatches.map((match) => match.id))]
	const mods = modIds.length > 0 ? await client.mods.getMods({ modIds }) : []
	const modsById = new Map(mods.map((mod) => [mod.id, mod]))

	const detected = candidates.flatMap((candidate) => {
		const match = matchesByFingerprint.get(candidate.fingerprint)
		const mod = match && modsById.get(match.id)
		return mod ? [{ sha1: candidate.sha1, source: toExternalSource(mod, match.file) }] : []
	})
	await record_external_detection(
		'curseforge',
		candidates.map((candidate) => candidate.sha1),
		detected,
	)
	return detected
}

/**
 * Identifies files added to an instance outside the app on CurseForge whenever its content is
 * loaded, and reloads the content when any are found. Files are only looked up once in a while,
 * so this is cheap to run on every load.
 */
export function useCurseForgeDetection(
	instanceId: MaybeRefOrGetter<string | undefined>,
	contentLoadedAt: MaybeRefOrGetter<number>,
) {
	const queryClient = useQueryClient()
	const running = new Set<string>()

	async function detect(id: string) {
		if (running.has(id) || !hasCurseForgeApiKey()) return
		running.add(id)
		try {
			const detected = await detectCurseForgeFiles(id)
			if (detected.length > 0) {
				await queryClient.invalidateQueries({ queryKey: instanceKeys.content(id) })
			}
		} catch (error) {
			console.warn('Failed to identify content on CurseForge', error)
		} finally {
			running.delete(id)
		}
	}

	watch(
		() => [toValue(instanceId), toValue(contentLoadedAt)] as const,
		([id, loadedAt]) => {
			if (id && loadedAt > 0) void detect(id)
		},
		{ immediate: true },
	)
}
