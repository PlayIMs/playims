import { eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clientNavigationLabels, type ClientNavigationLabel } from '../schema/index.js';
import type { DashboardNavKey, DashboardNavigationLabels } from '$lib/dashboard/navigation';

interface ClientNavigationLabelEntry {
	tabKey: DashboardNavKey;
	label: string;
	sortOrder: number;
}

const D1_MAX_BIND_PARAMS = 100;
const CLIENT_NAV_LABEL_INSERT_COLUMN_COUNT = 9;
const MAX_CLIENT_NAV_ROWS_PER_INSERT = Math.max(
	1,
	Math.floor((D1_MAX_BIND_PARAMS - 1) / CLIENT_NAV_LABEL_INSERT_COLUMN_COUNT)
);

const isMissingSortOrderColumnError = (message: string): boolean =>
	/no such column:\s*sort_order/i.test(message) ||
	/has no column named\s+sort_order/i.test(message);

export type ClientNavigationLabelRecord = Omit<ClientNavigationLabel, 'sortOrder'> & {
	sortOrder?: number | null;
};

export class ClientNavigationLabelOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<ClientNavigationLabelRecord[]> {
		try {
			return await this.db
				.select()
				.from(clientNavigationLabels)
				.where(eq(clientNavigationLabels.clientId, clientId));
		} catch (error) {
			const message = error instanceof Error ? error.message : '';
			if (!isMissingSortOrderColumnError(message)) {
				throw error;
			}

			// Legacy table support: environments that have navigation labels but not sort_order.
			return await this.db.all<ClientNavigationLabelRecord>(sql`
				select
					id,
					client_id as clientId,
					tab_key as tabKey,
					label,
					null as sortOrder,
					created_at as createdAt,
					updated_at as updatedAt,
					created_user as createdUser,
					updated_user as updatedUser
				from client_navigation_labels
				where client_id = ${clientId}
				order by rowid asc
			`);
		}
	}

	async replaceForClient(
		clientId: string,
		entries: ClientNavigationLabelEntry[],
		updatedUser?: string | null
	): Promise<ClientNavigationLabelRecord[]> {
		const now = new Date().toISOString();

		await this.db.delete(clientNavigationLabels).where(eq(clientNavigationLabels.clientId, clientId));

		if (entries.length > 0) {
			try {
				const rows = entries.map((entry) => ({
					id: crypto.randomUUID(),
					clientId,
					tabKey: entry.tabKey,
					label: entry.label.trim(),
					sortOrder: entry.sortOrder,
					createdAt: now,
					updatedAt: now,
					createdUser: updatedUser ?? null,
					updatedUser: updatedUser ?? null
				}));

				for (let index = 0; index < rows.length; index += MAX_CLIENT_NAV_ROWS_PER_INSERT) {
					const chunk = rows.slice(index, index + MAX_CLIENT_NAV_ROWS_PER_INSERT);
					await this.db.insert(clientNavigationLabels).values(chunk);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : '';
				if (!isMissingSortOrderColumnError(message)) {
					throw error;
				}

				// Legacy table support: environments that have 0020 but not 0021.
				for (const entry of entries) {
					await this.db.run(sql`
						insert into client_navigation_labels (
							id,
							client_id,
							tab_key,
							label,
							created_at,
							updated_at,
							created_user,
							updated_user
						) values (
							${crypto.randomUUID()},
							${clientId},
							${entry.tabKey},
							${entry.label.trim()},
							${now},
							${now},
							${updatedUser ?? null},
							${updatedUser ?? null}
						)
					`);
				}
			}
		}

		return await this.getByClientId(clientId);
	}

	async replaceAllForClient(
		clientId: string,
		labels: DashboardNavigationLabels,
		order: DashboardNavKey[],
		updatedUser?: string | null
	): Promise<ClientNavigationLabelRecord[]> {
		return await this.replaceForClient(
			clientId,
			order.map((tabKey, index) => ({
				tabKey,
				label: labels[tabKey],
				sortOrder: index
			})),
			updatedUser
		);
	}
}
