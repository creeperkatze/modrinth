<script setup lang="ts">
import { Card, LoadingIndicator } from '@modrinth/ui'
import { configuredXss } from '@modrinth/utils'
import { useQuery } from '@tanstack/vue-query'
import type { Mod } from 'curseforge-js'
import { computed } from 'vue'

import { getCurseForgeClient } from '@/helpers/curseforge'

const props = defineProps<{
	mod: Mod
}>()

const descriptionQuery = useQuery(
	computed(() => ({
		queryKey: ['curseforge', 'description', props.mod.id],
		queryFn: async () => (await getCurseForgeClient()).mods.getDescription(props.mod.id),
		staleTime: 5 * 60 * 1000,
	})),
)

const description = computed(() => configuredXss.process(descriptionQuery.data.value ?? ''))
</script>

<template>
	<Card>
		<LoadingIndicator v-if="descriptionQuery.isPending.value" />
		<div v-else class="markdown-body" v-html="description" />
	</Card>
</template>
