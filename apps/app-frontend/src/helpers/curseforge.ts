import type { ExternalContentSource } from '@modrinth/ui'
import { getVersion } from '@tauri-apps/api/app'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import CurseForgeClient, {
	type File as CurseForgeFile,
	FileRelationType,
	FileReleaseType,
	HashAlgo,
	type Mod,
	ModLoaderType,
} from 'curseforge-js'

import { config } from '@/config'

import { get_content_items, install_external_file, remove_project } from './instance'
import type { ContentFileProjectType, InstanceLoader } from './types'

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

/** Loader names as they appear in a CurseForge file's `gameVersions`, matching Modrinth's loader tags. */
export const LOADER_TAGS: Partial<Record<ModLoaderType, string>> = {
	[ModLoaderType.Forge]: 'forge',
	[ModLoaderType.NeoForge]: 'neoforge',
	[ModLoaderType.Fabric]: 'fabric',
	[ModLoaderType.Quilt]: 'quilt',
}

export function isCurseForgeContentType(type: string): type is CurseForgeContentType {
	return type in CURSEFORGE_CLASS_IDS
}

export function contentTypeFromClassId(classId: number | null): CurseForgeContentType | null {
	const entry = Object.entries(CURSEFORGE_CLASS_IDS).find(([, id]) => id === classId)
	return entry ? (entry[0] as CurseForgeContentType) : null
}

export function hasCurseForgeApiKey(): boolean {
	return !!config.curseforgeApiKey
}

export function curseForgeModQueryKey(modId: number) {
	return ['curseforge', 'mod', modId] as const
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

export function fileSupportsLoaders(file: CurseForgeFile, loaderTypes: ModLoaderType[]): boolean {
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
				fileSupportsLoaders(file, loaderTypes),
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

/** Loader tags a file lists in its `gameVersions`. */
export function fileLoaders(file: CurseForgeFile): string[] {
	const tags = new Set(Object.values(LOADER_TAGS))
	return file.gameVersions
		.map((version) => version.toLowerCase())
		.filter((version) => tags.has(version))
}

/** Minecraft versions a file lists in its `gameVersions`. */
export function fileGameVersions(file: CurseForgeFile): string[] {
	return file.gameVersions.filter((version) => /^\d/.test(version))
}

export function releaseChannel(releaseType: FileReleaseType): 'release' | 'beta' | 'alpha' {
	switch (releaseType) {
		case FileReleaseType.Beta:
			return 'beta'
		case FileReleaseType.Alpha:
			return 'alpha'
		default:
			return 'release'
	}
}

/** Sorts Minecraft version strings newest first. */
export function compareGameVersionsDesc(a: string, b: string): number {
	return b.localeCompare(a, undefined, { numeric: true })
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

export type InstalledCurseForgeFile = {
	fileId: string
	/** Path of the installed file relative to the instance directory. */
	path: string
}

/** CurseForge projects installed in an instance, keyed by CurseForge project id. */
export async function getInstalledCurseForgeFiles(
	instanceId: string,
): Promise<Map<string, InstalledCurseForgeFile>> {
	const items = await get_content_items(instanceId)
	const installed = new Map<string, InstalledCurseForgeFile>()
	for (const item of items) {
		const source = item.external_source
		if (source?.platform === 'curseforge' && item.file_path) {
			installed.set(source.project_id, { fileId: source.file_id, path: item.file_path })
		}
	}
	return installed
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

export type CurseForgeInstallOptions = {
	/** A specific file of the project to install instead of the newest compatible one. */
	file?: CurseForgeFile
	/** An installed file of the same project to remove once the new file is installed. */
	replacePath?: string
}

/** Installs a CurseForge project into an instance along with its required dependencies. */
export async function installCurseForgeProject(
	mod: Mod,
	contentType: CurseForgeContentType,
	target: CurseForgeInstallTarget,
	options: CurseForgeInstallOptions = {},
): Promise<CurseForgeInstallResult> {
	const client = await getCurseForgeClient()
	const loaderTypes = getLoaderTypes(contentType, target.loader)
	const result: CurseForgeInstallResult = { installed: [], restricted: [] }
	const visited = new Set(target.installedProjectIds)

	async function install(project: Mod, isDependency: boolean) {
		if (isDependency && visited.has(String(project.id))) return
		visited.add(String(project.id))

		const file =
			!isDependency && options.file
				? options.file
				: await findCompatibleFile(project.id, target.gameVersion, loaderTypes)
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

		const path = await install_external_file(target.instanceId, {
			url: file.downloadUrl,
			file_name: file.fileName,
			sha1,
			project_type: INSTALL_PROJECT_TYPES[contentType],
			source: toExternalSource(project, file),
		})
		if (!isDependency) root.path = path
		result.installed.push(project)
	}

	const root: { path: string | null } = { path: null }
	await install(mod, false)
	if (options.replacePath && root.path && root.path !== options.replacePath) {
		await remove_project(target.instanceId, options.replacePath)
	}
	return result
}
