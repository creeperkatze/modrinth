import svgLoader from 'vite-svg-loader'
import { defineConfig } from 'wxt'

export default defineConfig({
	extensionApi: 'chrome',
	modules: ['@wxt-dev/module-vue'],
	manifest: {
		name: 'Modrinth Extra',
		description: 'Adds unofficial extra features to the Modrinth website.',
		version: '0.0.4',
		icons: {
			128: '/icon-128.png',
		},
		permissions: [],
		host_permissions: [
			'https://modrinth.com/*',
			'https://api.modrinth.com/*',
			'https://staging.modrinth.com/*',
			'https://staging-api.modrinth.com/*',
		],
	},
	vite: () => ({
		plugins: [
			svgLoader({
				svgoConfig: {
					plugins: [
						{
							name: 'preset-default',
							params: {
								overrides: {
									removeViewBox: false,
								},
							},
						},
					],
				},
			}),
		] as any,
	}),
})
