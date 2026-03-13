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
				description:
					'Modern intramural sports league management platform with intuitive team management, automated scheduling, and real-time standings.',
				theme_color: '#CE1126',
				background_color: '#EEDBCE',
				display: 'standalone',
				display_override: ['window-controls-overlay'],
				scope: '/',
				start_url: '/',
				lang: 'en-US'
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
		include: ['@tabler/icons-svelte']
	},
	ssr: {
		noExternal: ['@tabler/icons-svelte']
	}
});
