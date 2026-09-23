import type { Component } from 'vue'

export type ProjectPageTab = {
	label: string
	href: string
	shown?: boolean
	/** Child route segments that also mark this tab as active. */
	subpages?: string[]
}

export type ProjectLink = {
	icon: Component
	label: string
	url: string
}

export type ProjectCreator = {
	id: string
	name: string
	url?: string | null
	avatarUrl?: string | null
}

export type ProjectDetail = {
	icon: Component
	text: string
	secondary?: boolean
}

export type ProjectGalleryItem = {
	id: string
	/** Full size image. */
	url: string
	thumbnailUrl?: string | null
	title?: string | null
	description?: string | null
	date?: string | null
}
