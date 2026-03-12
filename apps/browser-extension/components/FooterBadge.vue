<template>
	<hr class="w-full border-button-border my-0.5" />
	<p class="m-0 flex items-center gap-1">
		<ExtLogo aria-hidden="true" class="h-4 w-4" />
		Modrinth Extra {{ version }}
	</p>
</template>

<script setup lang="ts">
import ExtLogo from '../public/icon.svg'

const version = browser.runtime.getManifest().version
</script>
