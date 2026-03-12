import svgLoader from 'vite-svg-loader'
import { defineConfig } from 'wxt'

export default defineConfig({
	extensionApi: 'chrome',
	modules: ['@wxt-dev/module-vue'],
	manifest: {
		name: 'Modrinth Notifications',
		description: 'Adds a notification bell indicator to modrinth.com',
		version: '0.0.1',
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
