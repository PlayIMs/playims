import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		port: 5180,
		strictPort: true
	},
	plugins: [
		sveltekit(),
		tailwindcss(),
		SvelteKitPWA({
			// Registration is handled in src/hooks.client.ts to keep dev/prod behavior explicit.
			injectRegister: false,
			manifest: {
				name: 'PlayIMs - Intramural Sports League Manager',
				short_name: 'PlayIMs',
				theme_color: '#7c3aed',
				background_color: '#ffffff',
				display: 'standalone',
				scope: '/',
				start_url: '/'
			},
			pwaAssets: {
				// we will configure the PWA asset generation next
				config: true
			},
			kit: {
				includeVersionFile: true
			},
			workbox: {
				globStrict: false,
				modifyURLPrefix: {},
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,webmanifest}']
			}
		})
	],
	optimizeDeps: {
		include: [
			'@tabler/icons-svelte',
			'@tabler/icons-svelte/icons/layout-dashboard',
			'@tabler/icons-svelte/icons/ball-football',
			'@tabler/icons-svelte/icons/trophy',
			'@tabler/icons-svelte/icons/user-cog',
			'@tabler/icons-svelte/icons/building',
			'@tabler/icons-svelte/icons/shopping-cart',
			'@tabler/icons-svelte/icons/credit-card',
			'@tabler/icons-svelte/icons/file-text',
			'@tabler/icons-svelte/icons/chart-bar',
			'@tabler/icons-svelte/icons/settings',
			'@tabler/icons-svelte/icons/help-circle',
			'@tabler/icons-svelte/icons/chevron-left',
			'@tabler/icons-svelte/icons/chevron-right',
			'@tabler/icons-svelte/icons/message-circle',
			'@tabler/icons-svelte/icons/calendar',
			'@tabler/icons-svelte/icons/clock',
			'@tabler/icons-svelte/icons/live-photo',
			'@tabler/icons-svelte/icons/users',
			'@tabler/icons-svelte/icons/alert-triangle',
			'@tabler/icons-svelte/icons/check',
			'@tabler/icons-svelte/icons/player-play',
			'@tabler/icons-svelte/icons/plus',
			'@tabler/icons-svelte/icons/search',
			'@tabler/icons-svelte/icons/arrow-right',
			'@tabler/icons-svelte/icons/pencil',
			'@tabler/icons-svelte/icons/archive',
			'@tabler/icons-svelte/icons/restore',
			'@tabler/icons-svelte/icons/trash',
			'@tabler/icons-svelte/icons/alert-circle',
			'@tabler/icons-svelte/icons/map-pin',
			'@tabler/icons-svelte/icons/square',
			'@tabler/icons-svelte/icons/transfer',
			'@tabler/icons-svelte/icons/map-pin-plus',
			'@tabler/icons-svelte/icons/external-link',
			'@tabler/icons-svelte/icons/x'
		]
	},
	ssr: {
		noExternal: ['@tabler/icons-svelte']
	}
});
