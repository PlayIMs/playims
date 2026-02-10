import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			platformProxy: {
				// Lets normal `pnpm dev` use Wrangler bindings/secrets (D1/auth)
				// so we keep HMR + real local auth/DB behavior in one workflow.
				configPath: 'wrangler.toml',
				persist: true
			}
		}),
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
