export interface LockableDivision {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	dayOfWeek: string | null;
	gameTime: string | null;
	location: string | null;
	startDate: string | null;
	maxTeams: number | null;
	isLocked: boolean;
	doAutoLock: boolean;
}

export async function saveDivisionLock(
	apiPath: string,
	leagueId: string,
	division: LockableDivision,
	action: 'toggle' | 'revert',
	request: typeof fetch = fetch
): Promise<void> {
	const response = await request(apiPath, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			action: 'update-division',
			leagueId,
			divisionId: division.id,
			division: {
				name: division.name.trim(),
				slug: division.slug.trim(),
				description: division.description?.trim() || null,
				dayOfWeek: division.dayOfWeek?.trim() || null,
				gameTime: division.gameTime?.trim() || null,
				location: division.location?.trim() || null,
				startDate: division.startDate || null,
				maxTeams: Number(division.maxTeams),
				isLocked: action === 'toggle' ? !division.isLocked : division.isLocked,
				doAutoLock: action === 'revert'
			}
		})
	});
	const payload = (await response.json()) as {
		success?: boolean;
		error?: string;
		fieldErrors?: Record<string, string>;
	};
	if (!response.ok || !payload.success) {
		throw new Error(
			payload.error ||
				Object.values(payload.fieldErrors ?? {})[0] ||
				'Unable to update division lock right now.'
		);
	}
}
