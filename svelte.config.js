import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'base-uri': ['self'],
				'object-src': ['none'],
				'frame-ancestors': ['none'],
				'form-action': ['self'],
				'img-src': ['self', 'data:', 'blob:', 'https:'],
				'font-src': ['self', 'https://fonts.gstatic.com', 'data:'],
				'style-src': ['self', 'https://fonts.googleapis.com'],
				'script-src': ['self'],
				'connect-src': ['self'],
				'worker-src': ['self'],
				'manifest-src': ['self']
			}
		}
	}
};

export default config;
