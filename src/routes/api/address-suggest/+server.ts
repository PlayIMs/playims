import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type NominatimResult = {
	display_name?: string;
	address?: Record<string, string | undefined>;
};

export const GET: RequestHandler = async ({ url, fetch }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 4) {
		return json({ success: true, data: [] });
	}

	try {
		// Basic, low-volume autocomplete using OpenStreetMap Nominatim.
		// If you move to Google/Mapbox later, keep this endpoint shape stable for the UI.
		const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
		nominatimUrl.searchParams.set('format', 'jsonv2');
		nominatimUrl.searchParams.set('addressdetails', '1');
		nominatimUrl.searchParams.set('limit', '5');
		nominatimUrl.searchParams.set('q', q);

		const resp = await fetch(nominatimUrl.toString(), {
			headers: {
				Accept: 'application/json'
			}
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
					'cache-control': 'public, max-age=60'
				}
			}
		);
	} catch (e) {
		return json({ success: false, error: 'Address lookup failed' }, { status: 502 });
	}
};
