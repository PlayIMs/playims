/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const CACHE = `static-${version}`;
const OFFLINE_FALLBACK = '/offline.html';
const ASSETS = [...build, ...files, OFFLINE_FALLBACK];
const ASSET_SET = new Set(ASSETS);

sw.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll([...ASSET_SET]);
	}

	event.waitUntil(addFilesToCache());
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}

		await sw.clients.claim();
	}

	event.waitUntil(deleteOldCaches());
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') {
		return;
	}

	async function respondWithSafeCaching() {
		const url = new URL(event.request.url);
		if (url.origin !== sw.location.origin) {
			return fetch(event.request);
		}

		const pathname = url.pathname;
		if (pathname.startsWith('/api/') || pathname.endsWith('/__data.json')) {
			return fetch(event.request);
		}

		if (event.request.mode === 'navigate') {
			try {
				return await fetch(event.request);
			} catch {
				const cache = await caches.open(CACHE);
				const offline = await cache.match(OFFLINE_FALLBACK);
				return offline ?? Response.error();
			}
		}

		if (!ASSET_SET.has(pathname)) {
			return fetch(event.request);
		}

		const cache = await caches.open(CACHE);
		const cachedResponse = await cache.match(event.request);
		if (cachedResponse) {
			return cachedResponse;
		}

		return fetch(event.request);
	}

	event.respondWith(respondWithSafeCaching());
});

sw.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});
