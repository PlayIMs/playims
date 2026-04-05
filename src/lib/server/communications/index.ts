import type { DatabaseOperations } from '$lib/database';
import { buildCommunicationFilterOptions } from './service.js';
import { CommunicationService } from './service.js';
import type { CommunicationEmailProvider } from './provider.js';
import { ResendCommunicationProvider } from './resend.js';

const readEnvValue = (event: { platform?: App.Platform }, key: string): string | null => {
	const platformValue = (event.platform?.env as Record<string, unknown> | undefined)?.[key];
	if (typeof platformValue === 'string' && platformValue.trim().length > 0) {
		return platformValue.trim();
	}

	const processValue = process.env[key];
	if (typeof processValue === 'string' && processValue.trim().length > 0) {
		return processValue.trim();
	}

	return null;
};

export const createLocalHistoryOnlyCommunicationProvider = (): CommunicationEmailProvider => ({
	async sendMessage(): Promise<{ providerMessageId: string | null }> {
		return { providerMessageId: null };
	}
});

export const createCommunicationEmailProvider = (
	event: { platform?: App.Platform }
): CommunicationEmailProvider => {
	const deliveryMode = readEnvValue(event, 'COMMUNICATION_DELIVERY_MODE');
	const apiKey = readEnvValue(event, 'RESEND_API_KEY');
	const fromEmail = readEnvValue(event, 'COMMUNICATION_FROM_EMAIL');
	const replyTo = readEnvValue(event, 'COMMUNICATION_REPLY_TO_EMAIL');

	if (deliveryMode === 'resend' && apiKey && fromEmail) {
		return new ResendCommunicationProvider({
			apiKey,
			fromEmail,
			replyTo
		});
	}

	return createLocalHistoryOnlyCommunicationProvider();
};

export const createCommunicationService = (
	event: { platform?: App.Platform },
	dbOps: DatabaseOperations
): CommunicationService => {
	return new CommunicationService({
		storage: dbOps.communications,
		emailProvider: createCommunicationEmailProvider(event)
	});
};

export const loadCommunicationFilterOptions = async (
	dbOps: DatabaseOperations,
	clientId: string
) => {
	const [seasons, offerings, leagues, divisions, teams] = await Promise.all([
		dbOps.seasons.getByClientId(clientId),
		dbOps.offerings.getByClientId(clientId),
		dbOps.leagues.getByClientId(clientId),
		dbOps.divisions.searchByClient({
			clientId,
			query: '',
			limit: 500
		}),
		dbOps.teams.searchByClient({
			clientId,
			query: '',
			limit: 500
		})
	]);

	return buildCommunicationFilterOptions({
		seasons: seasons
			.filter((season) => season.id?.trim())
			.map((season) => ({
				id: season.id!,
				name: season.name ?? null
			})),
		offerings: offerings
			.filter((offering) => offering.id?.trim())
			.map((offering) => ({
				id: offering.id!,
				name: offering.name ?? null,
				seasonId: offering.seasonId ?? null
			})),
		leagues: leagues
			.filter((league) => league.id?.trim())
			.map((league) => ({
				id: league.id!,
				name: league.name ?? null,
				seasonId: league.seasonId ?? null,
				offeringId: league.offeringId ?? null
			})),
		divisions: divisions
			.filter((division) => division.id?.trim())
			.map((division) => ({
				id: division.id!,
				name: division.name ?? null,
				leagueId: division.leagueId ?? null
			})),
		teams: teams
			.filter((team) => team.id?.trim())
			.map((team) => ({
				id: team.id!,
				name: team.name ?? 'Untitled team',
				divisionId: team.divisionId ?? null
			}))
	});
};
