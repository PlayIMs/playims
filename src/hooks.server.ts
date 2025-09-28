import { dev } from '$app/environment';

export function handle({ event, resolve }) {
	// Handle Chrome DevTools project settings request
	if (dev && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
		return new Response('Go away, Chrome DevTools!', { status: 404 });
	}

	return resolve(event);
}
