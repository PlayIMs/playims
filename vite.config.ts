import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			injectRegister: 'inline',
			manifest: {
				name: 'PlayIMs - Intramural Sports League Manager',
				short_name: 'PlayIMs',
				theme_color: '#2563eb',
				background_color: '#ffffff',
				display: 'standalone',
				scope: '/',
				start_url: '/'
			},
			pwaAssets: {
				// we will configure the PWA asset generation next
				config: true
			}
		})
	]
});
