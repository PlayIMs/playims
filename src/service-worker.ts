/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

// List of assets to cache
const ASSETS = [
	...build, // the app itself
	...files // everything in `static`
];

// Install event - cache all static assets
sw.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

// Activate event - remove old caches
sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

// Fetch event - serve from cache, fall back to network
sw.addEventListener('fetch', (event) => {
	// Ignore non-GET requests
	if (event.request.method !== 'GET') return;

	// Ignore API requests (don't cache dynamic data)
	if (event.request.url.includes('/api/')) return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// Try the cache first
		const cachedResponse = await cache.match(event.request);
		if (cachedResponse) {
			return cachedResponse;
		}

		// Try the network
		try {
			const response = await fetch(event.request);
			// Cache successful responses for static assets
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			return response;
		} catch (error) {
			// Network failed - return offline fallback for navigation requests
			if (event.request.mode === 'navigate') {
				const offlineResponse = await cache.match('/offline');
				if (offlineResponse) {
					return offlineResponse;
				}
			}
			throw error;
		}
	}

	event.respondWith(respond());
});

// Handle messages from the client
sw.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});
