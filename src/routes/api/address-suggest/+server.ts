import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

type NominatimResult = {
	display_name?: string;
	address?: Record<string, string | undefined>;
};

const querySchema = z.object({
	q: z
		.string()
		.trim()
		.max(120)
		.regex(/^[a-zA-Z0-9\s,.'#/-]*$/, 'Query contains unsupported characters')
		.optional()
});

export const GET: RequestHandler = async ({ url, fetch }) => {
	const parsedQuery = querySchema.safeParse({
		q: url.searchParams.get('q') ?? undefined
	});
	if (!parsedQuery.success) {
		return json(
			{
				success: false,
				error: 'Invalid query'
			},
			{ status: 400 }
		);
	}

	const q = parsedQuery.data.q ?? '';
	if (q.length < 4) {
		return json(
			{ success: true, data: [] },
			{
				headers: {
					'cache-control': 'private, max-age=60'
				}
			}
		);
	}

	try {
		// Basic, low-volume autocomplete using OpenStreetMap Nominatim.
		// If you move to Google/Mapbox later, keep this endpoint shape stable for the UI.
		const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
		nominatimUrl.searchParams.set('format', 'jsonv2');
		nominatimUrl.searchParams.set('addressdetails', '1');
		nominatimUrl.searchParams.set('limit', '5');
		nominatimUrl.searchParams.set('q', q);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);
		const resp = await fetch(nominatimUrl.toString(), {
			headers: {
				Accept: 'application/json'
			},
			signal: controller.signal
		}).finally(() => {
			clearTimeout(timeout);
		});

		if (!resp.ok) {
			return json({ success: false, error: 'Address lookup failed' }, { status: 502 });
		}

		const raw = (await resp.json()) as NominatimResult[];
		const data = raw.map((r) => {
			const a = r.address ?? {};
			const city = a.city || a.town || a.village || a.hamlet || a.county;
			return {
				label: r.display_name || '',
				city: city || '',
				state: a.state || '',
				postalCode: a.postcode || '',
				country: a.country || ''
			};
		});

		return json(
			{
				success: true,
				data
			},
			{
				headers: {
					// Short cache to reduce repeated lookups
					'cache-control': 'private, max-age=60'
				}
			}
		);
	} catch {
		return json({ success: false, error: 'Address lookup failed' }, { status: 502 });
	}
};
