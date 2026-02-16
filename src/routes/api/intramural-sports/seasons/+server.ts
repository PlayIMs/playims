import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import {
	createIntramuralSeasonSchema,
	type CreateIntramuralSeasonInput,
	type CreateIntramuralSeasonResponse
} from '$lib/server/intramural-offerings-validation';
import type { RequestHandler } from './$types';

const toFieldErrorMap = (
	issues: Array<{ path: Array<PropertyKey>; message: string }>
): Record<string, string[]> => {
	const fieldErrors: Record<string, string[]> = {};

	for (const issue of issues) {
		const key = issue.path.map((part) => String(part)).join('.');
		if (!fieldErrors[key]) {
			fieldErrors[key] = [];
		}
		fieldErrors[key].push(issue.message);
	}

	return fieldErrors;
};

function normalizeText(value: string | null | undefined): string {
	return value?.trim().toLowerCase() ?? '';
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to save season right now.'
			} satisfies CreateIntramuralSeasonResponse,
			{ status: 500 }
		);
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json(
			{
				success: false,
				error: 'Invalid request payload.'
			} satisfies CreateIntramuralSeasonResponse,
			{ status: 400 }
		);
	}

	const parsed = createIntramuralSeasonSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies CreateIntramuralSeasonResponse,
			{ status: 400 }
		);
	}

	const input: CreateIntramuralSeasonInput = parsed.data;
	const dbOps = new DatabaseOperations(event.platform as App.Platform);
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);

	try {
		const existingSeasons = await dbOps.seasons.getByClientId(clientId);
		const duplicateSlug = existingSeasons.find(
			(season) => normalizeText(season.slug) === normalizeText(input.season.slug)
		);
		const duplicateName = existingSeasons.find(
			(season) => normalizeText(season.name) === normalizeText(input.season.name)
		);
		const issues: Array<{ path: Array<string>; message: string }> = [];

		if (duplicateSlug) {
			issues.push({
				path: ['season', 'slug'],
				message: 'A season with this slug already exists.'
			});
		}

		if (duplicateName) {
			issues.push({
				path: ['season', 'name'],
				message: 'A season with this name already exists.'
			});
		}

		if (issues.length > 0) {
			return json(
				{
					success: false,
					error: 'Duplicate season detected.',
					fieldErrors: toFieldErrorMap(issues)
				} satisfies CreateIntramuralSeasonResponse,
				{ status: 409 }
			);
		}

		const shouldBeCurrent = input.season.isCurrent || existingSeasons.length === 0;
		const createdSeason = await dbOps.seasons.create({
			clientId,
			name: input.season.name,
			slug: input.season.slug,
			startDate: input.season.startDate,
			endDate: input.season.endDate,
			isCurrent: shouldBeCurrent ? 1 : 0,
			isActive: input.season.isActive ? 1 : 0,
			createdUser: userId,
			updatedUser: userId
		});

		if (!createdSeason?.id) {
			return json(
				{
					success: false,
					error: 'Unable to save season right now.'
				} satisfies CreateIntramuralSeasonResponse,
				{ status: 500 }
			);
		}

		if (shouldBeCurrent) {
			await dbOps.seasons.setCurrent(clientId, createdSeason.id, userId);
		}

		return json(
			{
				success: true,
				data: {
					season: {
						id: createdSeason.id,
						name: createdSeason.name?.trim() || input.season.name,
						slug: createdSeason.slug?.trim() || input.season.slug,
						startDate: createdSeason.startDate ?? input.season.startDate,
						endDate: createdSeason.endDate ?? input.season.endDate,
						isCurrent: shouldBeCurrent,
						isActive: createdSeason.isActive !== 0
					}
				}
			} satisfies CreateIntramuralSeasonResponse,
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create intramural season:', error);
		return json(
			{
				success: false,
				error: 'Unable to save season right now.'
			} satisfies CreateIntramuralSeasonResponse,
			{ status: 500 }
		);
	}
};
