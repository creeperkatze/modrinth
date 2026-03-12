<template>
	<div class="card flex-card experimental-styles-within">
		<h2>Extra</h2>
		<div class="details-list">
			<div class="details-list__item">
				<CodeIcon aria-hidden="true" />
				<a :href="modfolioUrl" target="_blank" rel="noopener" class="hover:underline">
					Generate embed
					<ExternalIcon aria-hidden="true" class="external-icon" />
				</a>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CodeIcon, ExternalIcon, ImageIcon } from '@modrinth/assets'

const props = defineProps<{
	pageUrl: string
}>()

const modfolioUrl = computed(
	() => `https://modfolio.creeperkatze.de/?url=${encodeURIComponent(props.pageUrl)}`,
)

</script>
