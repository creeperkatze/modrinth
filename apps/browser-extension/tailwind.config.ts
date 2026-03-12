import preset from '@modrinth/tooling-config/tailwind/tailwind-preset.ts'
import type { Config } from 'tailwindcss'

const config: Config = {
	content: [
		'./components/**/*.{js,vue,ts}',
		'./entrypoints/**/*.{js,vue,ts}',
		'../../packages/ui/src/**/*.{js,vue,ts}',
	],
	presets: [preset],
}

export default config
