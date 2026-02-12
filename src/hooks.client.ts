import { dev } from '$app/environment';
import type { HandleClientError } from '@sveltejs/kit';

export const init = async () => {
	if (!('serviceWorker' in navigator)) {
		return;
	}

	if (dev) {
		// Prevent stale caches while actively developing auth/session flows.
		const registrations = await navigator.serviceWorker.getRegistrations();
		for (const registration of registrations) {
			await registration.unregister();
		}
		return;
	}

	await navigator.serviceWorker.register('/service-worker.js', { type: 'module' });
};

export const handleError: HandleClientError = ({ error }) => {
	console.error('Client runtime error:', error);
	return {
		message: 'Unexpected client error.'
	};
};
