import type { ExternalContentSource } from '@modrinth/ui'
import { getVersion } from '@tauri-apps/api/app'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import CurseForgeClient, {
	type File as CurseForgeFile,
	FileRelationType,
	HashAlgo,
	type Mod,
	ModLoaderType,
} from 'curseforge-js'

import { config } from '@/config'

import { install_external_file } from './instance'
import type { ContentFileProjectType, InstanceLoader } from './types'

/** Where the Browse page searches for content. */
export type ContentSource = 'modrinth' | 'curseforge'

export const MINECRAFT_GAME_ID = 432

export type CurseForgeContentType = 'mod' | 'resourcepack' | 'shader' | 'datapack'

/** CurseForge "class" ids for each supported content type. */
export const CURSEFORGE_CLASS_IDS: Record<CurseForgeContentType, number> = {
	mod: 6,
	resourcepack: 12,
	shader: 6552,
	datapack: 6945,
}

const INSTALL_PROJECT_TYPES: Record<CurseForgeContentType, ContentFileProjectType> = {
	mod: 'mod',
	resourcepack: 'resourcepack',
	shader: 'shaderpack',
	datapack: 'datapack',
}

const LOADER_TYPES: Partial<Record<InstanceLoader, ModLoaderType[]>> = {
	forge: [ModLoaderType.Forge],
	neoforge: [ModLoaderType.NeoForge],
	fabric: [ModLoaderType.Fabric],
	quilt: [ModLoaderType.Quilt, ModLoaderType.Fabric],
}

/** Loader names as they appear in a CurseForge file's `gameVersions`. */
const LOADER_TAGS: Partial<Record<ModLoaderType, string>> = {
	[ModLoaderType.Forge]: 'forge',
	[ModLoaderType.NeoForge]: 'neoforge',
	[ModLoaderType.Fabric]: 'fabric',
	[ModLoaderType.Quilt]: 'quilt',
}

export function isCurseForgeContentType(type: string): type is CurseForgeContentType {
	return type in CURSEFORGE_CLASS_IDS
}

export function hasCurseForgeApiKey(): boolean {
	return !!config.curseforgeApiKey
}

let clientPromise: Promise<CurseForgeClient> | null = null

export function getCurseForgeClient(): Promise<CurseForgeClient> {
	clientPromise ??= getVersion().then(
		(version) =>
			new CurseForgeClient({
				apiKey: config.curseforgeApiKey,
				userAgent: `refract/${version}`,
				fetch: tauriFetch as typeof globalThis.fetch,
			}),
	)
	return clientPromise
}

/** Mod loaders to filter by for an instance, or none when the content type doesn't depend on a loader. */
export function getLoaderTypes(
	contentType: CurseForgeContentType,
	loader: InstanceLoader,
): ModLoaderType[] {
	return contentType === 'mod' ? (LOADER_TYPES[loader] ?? []) : []
}

function matchesLoader(file: CurseForgeFile, loaderTypes: ModLoaderType[]): boolean {
	if (loaderTypes.length === 0) return true
	const tags = new Set(file.gameVersions.map((version) => version.toLowerCase()))
	return loaderTypes.some((type) => {
		const tag = LOADER_TAGS[type]
		return tag !== undefined && tags.has(tag)
	})
}

/** Picks the newest file for the game version and loaders, preferring releases over betas and alphas. */
export function pickCompatibleFile(
	files: CurseForgeFile[],
	gameVersion: string,
	loaderTypes: ModLoaderType[],
): CurseForgeFile | null {
	const compatible = files
		.filter(
			(file) =>
				file.isAvailable &&
				!file.isServerPack &&
				file.gameVersions.includes(gameVersion) &&
				matchesLoader(file, loaderTypes),
		)
		.sort((a, b) => {
			if (a.releaseType !== b.releaseType) return a.releaseType - b.releaseType
			return Date.parse(b.fileDate) - Date.parse(a.fileDate)
		})
	return compatible[0] ?? null
}

export async function findCompatibleFile(
	modId: number,
	gameVersion: string,
	loaderTypes: ModLoaderType[],
): Promise<CurseForgeFile | null> {
	const client = await getCurseForgeClient()
	const { data } = await client.files.list(modId, { gameVersion, pageSize: 50 })
	return pickCompatibleFile(data, gameVersion, loaderTypes)
}

export function getSha1(file: CurseForgeFile): string | null {
	return file.hashes.find((hash) => hash.algo === HashAlgo.Sha1)?.value.toLowerCase() ?? null
}

export function toExternalSource(mod: Mod, file: CurseForgeFile): ExternalContentSource {
	const author = mod.authors[0]
	return {
		platform: 'curseforge',
		project_id: String(mod.id),
		file_id: String(file.id),
		project_slug: mod.slug,
		project_title: mod.name,
		project_icon_url: mod.logo?.thumbnailUrl || mod.logo?.url || null,
		project_url: mod.links?.websiteUrl || null,
		author_name: author?.name ?? null,
		author_url: author?.url ?? null,
		file_display_name: file.displayName,
		file_date: file.fileDate,
	}
}

export type CurseForgeInstallTarget = {
	instanceId: string
	gameVersion: string
	loader: InstanceLoader
	/** CurseForge project ids already in the instance; dependencies in this set are skipped. */
	installedProjectIds: Set<string>
}

export type CurseForgeInstallResult = {
	installed: Mod[]
	/** Projects whose authors don't allow downloads from third-party apps, to be downloaded manually. */
	restricted: Mod[]
}

export class NoCompatibleFileError extends Error {
	constructor(readonly mod: Mod) {
		super(`${mod.name} has no files for this Minecraft version and loader`)
	}
}

/** Installs a CurseForge project into an instance along with its required dependencies. */
export async function installCurseForgeProject(
	mod: Mod,
	contentType: CurseForgeContentType,
	target: CurseForgeInstallTarget,
): Promise<CurseForgeInstallResult> {
	const client = await getCurseForgeClient()
	const loaderTypes = getLoaderTypes(contentType, target.loader)
	const result: CurseForgeInstallResult = { installed: [], restricted: [] }
	const visited = new Set(target.installedProjectIds)

	async function install(project: Mod, isDependency: boolean) {
		if (visited.has(String(project.id))) return
		visited.add(String(project.id))

		const file = await findCompatibleFile(project.id, target.gameVersion, loaderTypes)
		if (!file) {
			if (isDependency) return
			throw new NoCompatibleFileError(project)
		}

		const requiredIds = file.dependencies
			.filter((dependency) => dependency.relationType === FileRelationType.RequiredDependency)
			.map((dependency) => dependency.modId)
			.filter((id) => !visited.has(String(id)))
		if (requiredIds.length > 0) {
			const dependencies = await client.mods.getMods({ modIds: requiredIds })
			for (const dependency of dependencies) {
				await install(dependency, true)
			}
		}

		const sha1 = getSha1(file)
		if (!file.downloadUrl || !sha1 || project.allowModDistribution === false) {
			result.restricted.push(project)
			return
		}

		await install_external_file(target.instanceId, {
			url: file.downloadUrl,
			file_name: file.fileName,
			sha1,
			project_type: INSTALL_PROJECT_TYPES[contentType],
			source: toExternalSource(project, file),
		})
		result.installed.push(project)
	}

	await install(mod, false)
	return result
}
