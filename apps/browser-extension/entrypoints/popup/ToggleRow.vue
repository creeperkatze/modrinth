<template>
	<div class="flex items-start justify-between gap-4">
		<SettingsLabel :id="id" :title="title" :description="description" />
		<button
			:id="id"
			type="button"
			role="switch"
			:aria-checked="modelValue"
			class="relative m-0 inline-flex h-5 w-[38px] shrink-0 cursor-pointer items-center rounded-full border-0 p-0 transition-colors duration-200"
			:class="modelValue ? 'bg-brand' : 'bg-button-bg'"
			@click="$emit('update:modelValue', !modelValue)"
		>
			<span
				class="absolute left-0.5 top-0.5 size-4 rounded-full transition-[transform,background-color] duration-200"
				:class="modelValue ? 'bg-black/85' : 'bg-gray-400'"
				:style="modelValue ? { transform: 'translateX(18px)' } : {}"
			/>
		</button>
	</div>
</template>

<script setup lang="ts">
import { SettingsLabel } from '@modrinth/ui'

defineProps<{
	id: string
	title: string
	description: string
	modelValue: boolean
}>()

defineEmits<{
	'update:modelValue': [value: boolean]
}>()
</script>
