import { DatabaseOperations } from '$lib/database';
import { resolveClientId } from '$lib/server/client-context';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

const createEventSchema = z.object({
	type: z.string().trim().min(1),
	offeringId: z.string().uuid().optional(),
	leagueId: z.string().uuid().optional(),
	divisionId: z.string().uuid().optional(),
	facilityId: z.string().uuid().optional(),
	facilityAreaId: z.string().uuid().optional(),
	homeTeamId: z.string().uuid().optional(),
	awayTeamId: z.string().uuid().optional(),
	scheduledStartAt: z.string().trim().optional(),
	scheduledEndAt: z.string().trim().optional(),
	actualStartAt: z.string().trim().optional(),
	actualEndAt: z.string().trim().optional(),
	status: z.string().trim().optional(),
	isPostseason: z.number().int().optional(),
	roundLabel: z.string().trim().optional(),
	weekNumber: z.number().int().optional(),
	homeScore: z.number().int().optional(),
	awayScore: z.number().int().optional(),
	winnerTeamId: z.string().uuid().optional(),
	forfeitType: z.string().trim().optional(),
	notes: z.string().trim().optional(),
	isActive: z.number().int().optional()
});

export const GET: RequestHandler = async ({ platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const clientId = resolveClientId(locals);
		const events = await dbOps.events.getAll(clientId);

		return json({
			success: true,
			data: events,
			count: events.length
		});
	} catch (error) {
		console.error('Failed to fetch events:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch events'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	try {
		const payload = await request.json();
		const clientId = resolveClientId(locals);
		const parsed = createEventSchema.safeParse(payload);
		if (!parsed.success) {
			return json(
				{
					success: false,
					error: 'Invalid request payload'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const event = await dbOps.events.create({
			clientId,
			type: parsed.data.type,
			offeringId: parsed.data.offeringId,
			leagueId: parsed.data.leagueId,
			divisionId: parsed.data.divisionId,
			facilityId: parsed.data.facilityId,
			facilityAreaId: parsed.data.facilityAreaId,
			homeTeamId: parsed.data.homeTeamId,
			awayTeamId: parsed.data.awayTeamId,
			scheduledStartAt: parsed.data.scheduledStartAt,
			scheduledEndAt: parsed.data.scheduledEndAt,
			actualStartAt: parsed.data.actualStartAt,
			actualEndAt: parsed.data.actualEndAt,
			status: parsed.data.status,
			isPostseason: parsed.data.isPostseason,
			roundLabel: parsed.data.roundLabel,
			weekNumber: parsed.data.weekNumber,
			homeScore: parsed.data.homeScore,
			awayScore: parsed.data.awayScore,
			winnerTeamId: parsed.data.winnerTeamId,
			forfeitType: parsed.data.forfeitType,
			notes: parsed.data.notes,
			isActive: parsed.data.isActive
		});

		return json(
			{
				success: true,
				data: event
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create event:', error);
		return json(
			{
				success: false,
				error: 'Failed to create event'
			},
			{ status: 500 }
		);
	}
};
