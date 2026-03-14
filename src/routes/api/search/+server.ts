import { json } from '@sveltejs/kit';
import { getMegaSearchResponse } from '$lib/server/search/service.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const query = event.url.searchParams.get('q') ?? '';
	const response = await getMegaSearchResponse(event, query);
	return json(response);
};
