export interface BreadcrumbMetadata {
	teamCount: number;
	maxTeams?: number | null;
	isLocked?: boolean;
	waitlistCount?: number;
	leagueCount?: number;
	unlockedCount?: number;
	lockedCount?: number;
}

export function breadcrumbTeamCountLabel(summary: BreadcrumbMetadata): string {
	if (summary.teamCount === 0 && !(summary.waitlistCount ?? 0)) return '';
	if (summary.teamCount === 0 && (summary.waitlistCount ?? 0) > 0) {
		return `${summary.waitlistCount} Waitlisted`;
	}
	if (typeof summary.maxTeams === 'number' && summary.maxTeams > 0) {
		return `${summary.teamCount} / ${summary.maxTeams} ${summary.maxTeams === 1 ? 'Team' : 'Teams'}`;
	}
	return `${summary.teamCount} ${summary.teamCount === 1 ? 'Team' : 'Teams'}`;
}

export function breadcrumbLeagueCountLabel(count: number): string {
	if (count === 0) return '';
	return `${count} ${count === 1 ? 'League' : 'Leagues'}`;
}

export function breadcrumbStats(summary: BreadcrumbMetadata): Array<{
	kind: 'text' | 'unlocked' | 'locked';
	label: string;
}> {
	const stats: ReturnType<typeof breadcrumbStats> = [];
	if ((summary.leagueCount ?? 0) > 0) {
		stats.push({ kind: 'text', label: breadcrumbLeagueCountLabel(summary.leagueCount!) });
	}
	if ((summary.unlockedCount ?? 0) > 0) {
		stats.push({ kind: 'unlocked', label: String(summary.unlockedCount) });
	}
	if ((summary.lockedCount ?? 0) > 0) {
		stats.push({ kind: 'locked', label: String(summary.lockedCount) });
	}
	const teamLabel = breadcrumbTeamCountLabel(summary);
	if (teamLabel) stats.push({ kind: 'text', label: teamLabel });
	return stats;
}

export interface BreadcrumbOption {
	value: string;
	label: string;
	labelClass?: string;
	description?: string;
	statusLabel?: string;
	rightLabel?: string;
	rightDescription?: string;
	searchText?: string;
	disabled?: boolean;
	separatorBefore?: boolean;
	tooltip?: string;
	disabledTooltip?: string;
}

export function breadcrumbDivisionOptions(
	options: BreadcrumbOption[],
	metadataFor: (value: string) => BreadcrumbMetadata | undefined
): BreadcrumbOption[] {
	// Sort a copy so the parent-owned options and their day/time ordering remain intact.
	return options
		.map((option) => ({ option, locked: metadataFor(option.value)?.isLocked === true }))
		.sort((a, b) => Number(a.locked) - Number(b.locked))
		.map(({ option, locked }) =>
			locked
				? { ...option, labelClass: [option.labelClass, 'opacity-50'].filter(Boolean).join(' ') }
				: option
		);
}

export interface BreadcrumbSegment {
	key: string;
	label: string;
	href: string;
	menuAriaLabel: string;
	currentValue: string;
	options: BreadcrumbOption[];
	showMenu?: boolean;
	searchEnabled?: boolean;
	searchPlaceholder?: string;
	emptyText?: string;
}
