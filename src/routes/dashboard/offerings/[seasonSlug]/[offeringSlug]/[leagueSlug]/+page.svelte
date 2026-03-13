<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import HeaderHierarchyTabs from '$lib/components/navigation/HeaderHierarchyTabs.svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import OfferingsTable from '$lib/components/OfferingsTable.svelte';
	import SmallStandingsTable from '$lib/components/SmallStandingsTable.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import SplitAddAction from '$lib/components/dashboard/SplitAddAction.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import type { HeaderHierarchySegment } from '$lib/components/navigation/header-hierarchy.js';
	import type { OfferingsTableColumn } from '$lib/components/offerings-table.js';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import type { ManageIntramuralLeagueResponse } from '$lib/server/intramural-offerings-validation';
	import { toast } from '$lib/toasts';
	import { parseDateTooltipValue } from '$lib/utils/date-tooltip.js';
	import { compareByDayOfWeekAndTime } from '$lib/utils/schedule-sort.js';
	import { createWizardDirtyState, slugifyFinal } from '$lib/components/wizard';
	import {
		inferDivisionNameDetails
	} from '$lib/utils/division-schedule-inference.js';
	import CreateDivisionWizard from './_wizards/CreateDivisionWizard.svelte';
	import MoveTeamWizard from './_wizards/MoveTeamWizard.svelte';
	import CreateTeamWizard from './_wizards/CreateTeamWizard.svelte';
	import {
		IconBallAmericanFootball,
		IconBallBaseball,
		IconBallBasketball,
		IconBallFootball,
		IconBallTennis,
		IconBallVolleyball,
		IconCrosshair,
		IconDots,
		IconLock,
		IconLockOpen,
		IconShip,
		IconTarget,
		IconTrash
	} from '@tabler/icons-svelte';

	type DivisionSection = NonNullable<PageData['divisions']>[number];
	type DivisionStandingsRow = DivisionSection['standings'][number];
	type HierarchyOption = NonNullable<PageData['offeringOptions']>[number];
	type PlacementValue = 'active' | 'waitlist';
	type StandingsDisplayRow = {
		rank: number;
		teamId: string;
		teamName: string;
		wins: number | null;
		losses: number | null;
		ties: number | null;
		points: number | null;
		winPct: string | null;
		streak: string | null;
		sportsmanshipRating: string | null;
		forfeits: number | null;
		forgoes: number | null;
		hasPostedStandings: boolean;
	};

	interface DropdownOption {
		value: string;
		label: string;
		labelIcon?: typeof IconLock;
		labelIconClass?: string;
		labelIconAriaLabel?: string;
		description?: string;
		statusLabel?: string;
		disabled?: boolean;
		separatorBefore?: boolean;
		tooltip?: string;
		disabledTooltip?: string;
	}

	type TeamActionValue = 'move-team' | 'invite-members' | 'team-settings' | 'delete-team';
	type DivisionActionValue = 'modify-division' | 'delete-division' | 'archive-division';

	interface DivisionWizardForm {
		name: string;
		slug: string;
		maxTeams: string;
		description: string;
		dayOfWeek: string;
		gameTime: string;
		location: string;
		startDate: string;
		isLocked: boolean;
	}

	interface TeamWizardForm {
		name: string;
		slug: string;
		divisionId: string;
		description: string;
		placement: PlacementValue;
		teamColor: string;
	}

	interface TeamPlacementRow {
		id: string;
		name: string;
		slug: string;
		divisionId: string;
		placement: PlacementValue;
		rosterSize: number;
		dateCreated: string | null;
		description: string | null;
	}

	interface TeamActionContext {
		id: string;
		name: string;
		currentDivisionId: string;
		currentDivisionName: string;
		currentPlacement: PlacementValue;
	}

	interface DivisionActionContext {
		id: string;
		name: string;
	}

	interface CreateTeamDivisionStatus {
		name: string;
		isLocked: boolean;
		isFull: boolean;
		defaultsToWaitlist: boolean;
	}

	interface MoveTeamWizardForm {
		divisionId: string;
		placement: PlacementValue;
	}

	type ActiveTeamRow = DivisionSection['teams'][number];
	type WaitlistTeamRow = NonNullable<PageData['waitlistTeams']>[number];

	const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

	const ROW_DROPDOWN_BUTTON_CLASS =
		'w-full min-w-[10rem] border border-secondary-300 bg-white px-3 py-1.5 text-xs leading-5 font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-neutral-50 focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0';
	const ACTION_DROPDOWN_BUTTON_CLASS =
		'inline-flex h-9 w-9 items-center justify-center border-0 bg-transparent p-0 text-secondary-700 cursor-pointer opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:bg-neutral-100 hover:text-secondary-900 focus:outline-none focus-visible:bg-neutral-100 focus-visible:text-secondary-900';
	const SECTION_ACTION_DROPDOWN_BUTTON_CLASS =
		'inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-950 bg-white p-0 text-neutral-950 cursor-pointer hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';
	const ACTION_DROPDOWN_LIST_CLASS = 'mt-1 w-52 border-2 border-neutral-950 bg-white z-20';
	const ACTION_DROPDOWN_OPTION_CLASS =
		'w-full px-3 py-2 text-left text-sm text-neutral-950 cursor-pointer';

	let { data } = $props<{ data: PageData }>();

	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).offerings
	);

	function normalizeAuthRole(
		value: string | null | undefined
	): 'participant' | 'manager' | 'admin' | 'dev' {
		const normalized = value?.trim().toLowerCase();
		if (normalized === 'manager' || normalized === 'admin' || normalized === 'dev') {
			return normalized;
		}
		return 'participant';
	}

	const canManageLeague = $derived.by(() => {
		const role = normalizeAuthRole(data?.authMode?.effectiveRole);
		return role === 'manager' || role === 'admin' || role === 'dev';
	});

	function sportIconFor(offeringName: string, sportName: string | null | undefined) {
		const key = `${offeringName} ${sportName ?? ''}`.trim().toLowerCase();
		if (key.includes('flag football')) return IconBallAmericanFootball;
		if (key.includes('basketball')) return IconBallBasketball;
		if (key.includes('soccer')) return IconBallFootball;
		if (key.includes('volleyball')) return IconBallVolleyball;
		if (key.includes('spikeball')) return IconCrosshair;
		if (key.includes('pickleball')) return IconBallTennis;
		if (key.includes('cornhole')) return IconTarget;
		if (key.includes('battleship')) return IconShip;
		if (key.includes('softball') || key.includes('baseball')) return IconBallBaseball;
		return IconBallFootball;
	}

	function formatDate(
		value: string | null | undefined,
		options?: Intl.DateTimeFormatOptions
	): string {
		if (!value) return 'TBD';
		const parsed = parseDateTooltipValue(value);
		if (!parsed || Number.isNaN(parsed.getTime())) return 'TBD';
		return parsed.toLocaleDateString('en-US', options);
	}

	function formatDateTime(value: string | null | undefined): string {
		if (!value) return 'TBD';
		const parsed = parseDateTooltipValue(value);
		if (!parsed || Number.isNaN(parsed.getTime())) return 'TBD';
		if (!valueHasExplicitTime(value)) {
			return parsed.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		}
		return parsed.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function valueHasExplicitTime(value: string | null | undefined): boolean {
		return typeof value === 'string' && DATE_TIME_PATTERN.test(value.trim());
	}

	function formatDateRange(
		start: string | null | undefined,
		end: string | null | undefined
	): string {
		if (!start && !end) return 'TBD';
		if (start && end) {
			return `${formatDate(start, { month: 'short', day: 'numeric' })} - ${formatDate(end, {
				month: 'short',
				day: 'numeric'
			})}`;
		}
		return formatDate(start ?? end, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatFullDateRange(
		start: string | null | undefined,
		end: string | null | undefined
	): string {
		if (!start && !end) return 'TBD';
		if (start && end) {
			return `${formatDate(start, {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			})} - ${formatDate(end, {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			})}`;
		}
		return formatDate(start ?? end, {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatSeasonPhaseDate(value: string | null | undefined): string {
		if (!value) return 'TBD';
		const parsed = parseDateTooltipValue(value);
		if (!parsed || Number.isNaN(parsed.getTime())) return 'TBD';
		const isCurrentYear = parsed.getFullYear() === new Date().getFullYear();
		return parsed.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			...(isCurrentYear ? {} : { year: 'numeric' })
		});
	}

	function formatSeasonPhaseRange(
		start: string | null | undefined,
		end: string | null | undefined,
		emptyLabel = 'TBD'
	): string {
		if (!start && !end) return emptyLabel;
		if (start && end) {
			return `${formatSeasonPhaseDate(start)} - ${formatSeasonPhaseDate(end)}`;
		}
		return formatSeasonPhaseDate(start ?? end);
	}

	function formatSeasonPhaseBoundaryText(
		value: string | null | undefined,
		futureLabel: string,
		pastLabel: string
	): string {
		if (!value) return `${futureLabel} TBD`;
		const parsed = parseDateTooltipValue(value);
		if (!parsed || Number.isNaN(parsed.getTime())) return `${futureLabel} TBD`;
		const label = parsed.getTime() <= Date.now() ? pastLabel : futureLabel;
		return `${label} ${formatSeasonPhaseDate(value)}`;
	}

	function formatLeagueDeadlineDate(value: string | null | undefined): string {
		if (!value) return 'TBD';
		const parsed = parseDateTooltipValue(value);
		if (!parsed || Number.isNaN(parsed.getTime())) return 'TBD';
		const currentYear = new Date().getFullYear();
		const includeYear = parsed.getFullYear() !== currentYear;
		return parsed.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			...(includeYear ? { year: 'numeric' } : {}),
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	function leagueRegistrationWindowInfo(): { openText: string; closeText: string } {
		const nowMs = Date.now();
		const regStartValue = data.league?.regStartDate ?? null;
		const regEndValue = data.league?.regEndDate ?? null;
		const regStart = parseDateTooltipValue(regStartValue);
		const regEnd = parseDateTooltipValue(regEndValue);
		const hasStarted = regStart ? regStart.getTime() <= nowMs : false;
		const hasClosed = regEnd ? regEnd.getTime() < nowMs : false;

		return {
			openText: regStartValue
				? hasStarted
					? `Opened ${formatLeagueDeadlineDate(regStartValue)}`
					: `Opens ${formatLeagueDeadlineDate(regStartValue)}`
				: 'Opens TBD',
			closeText: regEndValue
				? hasClosed
					? `Closed ${formatLeagueDeadlineDate(regEndValue)}`
					: `Closes ${formatLeagueDeadlineDate(regEndValue)}`
				: 'Closes TBD'
		};
	}

	function leagueJoinTeamDeadlineText(): string {
		const deadline = joinTeamDeadline();
		if (!deadline) return 'Join by TBD';
		return `Join by ${formatLeagueDeadlineDate(deadline)}`;
	}

	function divisionCapacityLabel(division: DivisionSection): string {
		if (typeof division.maxTeams === 'number') {
			return `${division.teamCount} / ${division.maxTeams} teams`;
		}
		return `${division.teamCount} teams`;
	}

	function divisionMetaLine(division: DivisionSection): string {
		return [division.dayOfWeek, division.gameTime, division.location].filter(Boolean).join(' / ');
	}

	function approvalBadgeLabel(isApproved: boolean): string {
		return isApproved ? 'Approved' : 'Unapproved';
	}

	function approvalBadgeClass(isApproved: boolean): string {
		return isApproved ? 'badge-secondary-outlined' : 'badge-primary-outlined';
	}

	function captainLabel(captainName: string | null | undefined): string {
		return captainName?.trim() || 'No Captain';
	}

	function hasRosterLimit(): boolean {
		return typeof data.offering?.maxPlayers === 'number';
	}

	function normalizeSearchValue(value: string | null | undefined): string {
		return value?.trim().toLowerCase() ?? '';
	}

	function parseWinPctValue(value: string | null | undefined): number {
		if (!value) return Number.NEGATIVE_INFINITY;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
	}

	function formatStandingCell(value: number | string | null | undefined): string {
		if (value === null || value === undefined) return '-';
		if (typeof value === 'string' && value.trim().length === 0) return '-';
		return String(value);
	}

	function formatStreak(value: string | null | undefined): string {
		if (!value) return '-';
		const trimmed = value.trim().toUpperCase();
		if (!trimmed || trimmed === '--') return '-';
		const prefixMatch = /^([WLT])\s*(\d+)$/.exec(trimmed);
		if (prefixMatch) {
			return `${prefixMatch[2]}${prefixMatch[1]}`;
		}
		const suffixMatch = /^(\d+)\s*([WLT])$/.exec(trimmed);
		if (suffixMatch) {
			return `${suffixMatch[1]}${suffixMatch[2]}`;
		}
		return trimmed;
	}

	function formatForfeitSummary(
		forfeits: number | null | undefined,
		forgoes: number | null | undefined
	): string {
		return `${formatStandingCell(forfeits)} / ${formatStandingCell(forgoes)}`;
	}

	function lockStatus(isLocked: boolean): {
		label: 'Locked' | 'Unlocked';
		icon: typeof IconLock;
	} {
		if (isLocked) {
			return {
				label: 'Locked',
				icon: IconLock
			};
		}
		return {
			label: 'Unlocked',
			icon: IconLockOpen
		};
	}

	function divisionLockTooltip(division: DivisionSection): string {
		return division.isLocked ? 'This division cannot be joined' : 'This division can be joined';
	}

	function joinTeamDeadline(): string | null {
		return data.league?.seasonStartDate ?? data.league?.regEndDate ?? null;
	}

	function waitlistIsOpen(): boolean {
		const deadline = joinTeamDeadline();
		if (!deadline) return true;
		const parsed = parseDateTooltipValue(deadline);
		if (!parsed) return true;
		const cutoff = new Date(parsed);
		if (!valueHasExplicitTime(deadline)) {
			cutoff.setHours(23, 59, 59, 999);
		}
		return cutoff.getTime() >= Date.now();
	}

	function waitlistTooltip(): string {
		return waitlistIsOpen() ? 'This waitlist can be joined' : 'This waitlist cannot be joined';
	}

	function compareDivisionsBySchedule(a: DivisionSection, b: DivisionSection): number {
		return compareByDayOfWeekAndTime(a, b);
	}

	function matchesSearchTerm(values: Array<string | null | undefined>, query: string): boolean {
		if (!query) return true;
		return values.some((value) => normalizeSearchValue(value).includes(query));
	}

	function teamMatchesSearch(
		team: Pick<ActiveTeamRow, 'name' | 'slug' | 'captainName' | 'description'>,
		query: string,
		divisionName?: string
	): boolean {
		return matchesSearchTerm(
			[team.name, team.slug, team.captainName, team.description, divisionName],
			query
		);
	}

	function waitlistTeamMatchesSearch(team: WaitlistTeamRow, query: string): boolean {
		return matchesSearchTerm(
			[team.name, team.slug, team.captainName, team.description, team.preferredDivisionName],
			query
		);
	}

	function divisionMatchesSearch(division: DivisionSection, query: string): boolean {
		return (
			matchesSearchTerm(
				[
					division.name,
					division.slug,
					division.description,
					division.dayOfWeek,
					division.gameTime,
					division.location
				],
				query
			) || division.teams.some((team) => teamMatchesSearch(team, query, division.name))
		);
	}

	function buildStandingsRows(division: DivisionSection): StandingsDisplayRow[] {
		const standingsByTeamId = new Map<string, DivisionStandingsRow>(
			division.standings.map((row: DivisionStandingsRow) => [row.teamId, row])
		);
		const rows: StandingsDisplayRow[] = division.teams.map((team: ActiveTeamRow) => {
			const standing = standingsByTeamId.get(team.id);
			return {
				rank: 0,
				teamId: team.id,
				teamName: team.name,
				wins: standing?.wins ?? null,
				losses: standing?.losses ?? null,
				ties: standing?.ties ?? null,
				points: standing?.points ?? null,
				winPct: standing?.winPct ?? null,
				streak: standing?.streak ?? null,
				sportsmanshipRating: null,
				forfeits: null,
				forgoes: null,
				hasPostedStandings: Boolean(standing)
			};
		});

		for (const standing of division.standings) {
			if (rows.some((row) => row.teamId === standing.teamId)) continue;
			rows.push({
				rank: 0,
				teamId: standing.teamId,
				teamName: standing.teamName,
				wins: standing.wins,
				losses: standing.losses,
				ties: standing.ties,
				points: standing.points,
				winPct: standing.winPct,
				streak: standing.streak,
				sportsmanshipRating: null,
				forfeits: null,
				forgoes: null,
				hasPostedStandings: true
			});
		}

		return rows
			.sort((a, b) => {
				if (a.hasPostedStandings !== b.hasPostedStandings) {
					return a.hasPostedStandings ? -1 : 1;
				}
				if ((b.points ?? Number.NEGATIVE_INFINITY) !== (a.points ?? Number.NEGATIVE_INFINITY)) {
					return (b.points ?? Number.NEGATIVE_INFINITY) - (a.points ?? Number.NEGATIVE_INFINITY);
				}
				const winPctDiff = parseWinPctValue(b.winPct) - parseWinPctValue(a.winPct);
				if (winPctDiff !== 0) return winPctDiff;
				if ((b.wins ?? Number.NEGATIVE_INFINITY) !== (a.wins ?? Number.NEGATIVE_INFINITY)) {
					return (b.wins ?? Number.NEGATIVE_INFINITY) - (a.wins ?? Number.NEGATIVE_INFINITY);
				}
				return a.teamName.localeCompare(b.teamName);
			})
			.map((row, index) => ({
				...row,
				rank: index + 1
			}));
	}

	function standingsMatchSearch(row: StandingsDisplayRow, query: string): boolean {
		return matchesSearchTerm(
			[
				String(row.rank),
				row.teamName,
				formatStandingCell(row.wins),
				formatStandingCell(row.losses),
				formatStandingCell(row.ties),
				formatStandingCell(row.points),
				row.winPct,
				formatStreak(row.streak),
				row.sportsmanshipRating,
				formatForfeitSummary(row.forfeits, row.forgoes)
			],
			query
		);
	}

	function divisionTableColumnsFor(): OfferingsTableColumn[] {
		return [
			{
				key: 'team',
				label: 'Team',
				width: '32%',
				rowHeader: true,
				headerTextAlignment: 'left',
				cellTextAlignment: 'left',
				cellVerticalAlignment: 'middle'
			},
			{
				key: 'date-created',
				label: 'Date Created',
				width: '22%',
				headerTextAlignment: 'left',
				cellTextAlignment: 'left',
				cellVerticalAlignment: 'middle'
			},
			{
				key: 'date-joined',
				label: 'Date Joined',
				width: '22%',
				headerTextAlignment: 'left',
				cellTextAlignment: 'left',
				cellVerticalAlignment: 'middle'
			},
			{
				key: 'roster',
				label: 'Roster',
				width: '12%',
				headerTextAlignment: 'center',
				cellTextAlignment: 'center',
				cellVerticalAlignment: 'middle'
			},
			{
				key: 'status',
				label: 'Status',
				width: '12%',
				headerTextAlignment: 'center',
				cellTextAlignment: 'center',
				cellVerticalAlignment: 'middle'
			}
		];
	}

	function waitlistTableColumnsFor(canManage: boolean): OfferingsTableColumn[] {
		const manageColumns: OfferingsTableColumn[] = canManage
			? [
					{
						key: 'manage',
						label: '',
						width: '12%',
						cellVerticalAlignment: 'top'
					}
				]
			: [];

		return [
			{
				key: 'team',
				label: 'Team',
				width: canManage ? '26%' : '34%',
				rowHeader: true
			},
			{
				key: 'date-created',
				label: 'Date Created',
				width: canManage ? '18%' : '20%',
				cellVerticalAlignment: 'top'
			},
			{
				key: 'preferred-division',
				label: 'Preferred Division',
				width: canManage ? '18%' : '20%',
				cellVerticalAlignment: 'top'
			},
			{
				key: 'roster',
				label: 'Roster',
				width: '12%',
				cellVerticalAlignment: 'top'
			},
			{
				key: 'status',
				label: 'Status',
				width: '14%',
				cellVerticalAlignment: 'top'
			},
			...manageColumns
		];
	}

	function firstFieldError(
		fieldErrors: Record<string, string[] | undefined> | undefined
	): string | null {
		if (!fieldErrors) return null;
		for (const value of Object.values(fieldErrors)) {
			if (Array.isArray(value) && value[0]) return value[0];
		}
		return null;
	}

	function readScopedFieldErrors(
		fieldErrors: Record<string, string[] | undefined> | undefined,
		scope: string
	): Record<string, string> {
		const scopedErrors: Record<string, string> = {};
		if (!fieldErrors) return scopedErrors;

		for (const [key, value] of Object.entries(fieldErrors)) {
			if (!key.startsWith(`${scope}.`) || !Array.isArray(value) || !value[0]) continue;
			scopedErrors[key.slice(scope.length + 1)] = value[0];
		}

		return scopedErrors;
	}

	async function readResponse(response: Response): Promise<ManageIntramuralLeagueResponse> {
		try {
			return (await response.json()) as ManageIntramuralLeagueResponse;
		} catch {
			return {
				success: false,
				error: 'Unexpected server response.'
			};
		}
	}

	function managementApiPath(): string | null {
		if (!data.season?.slug || !data.league?.slug) return null;
		return `/api/intramural-sports/leagues/${data.season.slug}/${data.league.slug}/management`;
	}

	function offeringHref(): string {
		if (!data.season?.slug || !data.offering?.slug) return '/dashboard/offerings';
		return `/dashboard/offerings/${data.season.slug}/${data.offering.slug}`;
	}

	function defaultDivisionForm(): DivisionWizardForm {
		return {
			name: '',
			slug: '',
			maxTeams: '8',
			description: '',
			dayOfWeek: '',
			gameTime: '',
			location: '',
			startDate: '',
			isLocked: false
		};
	}

	function divisionFormFromDivision(division: DivisionSection): DivisionWizardForm {
		return {
			name: division.name ?? '',
			slug: division.slug ?? '',
			maxTeams:
				typeof division.maxTeams === 'number' && Number.isFinite(division.maxTeams)
					? String(division.maxTeams)
					: '',
			description: division.description ?? '',
			dayOfWeek: division.dayOfWeek ?? '',
			gameTime: division.gameTime ?? '',
			location: division.location ?? '',
			startDate: division.startDate ?? '',
			isLocked: Boolean(division.isLocked)
		};
	}

	function defaultTeamForm(divisionId = data.divisions[0]?.id ?? ''): TeamWizardForm {
		return {
			name: '',
			slug: '',
			divisionId,
			description: '',
			placement: 'active',
			teamColor: ''
		};
	}

	function findDivisionById(divisionId: string): DivisionSection | undefined {
		return data.divisions.find((division: DivisionSection) => division.id === divisionId);
	}

	function shouldDefaultTeamToWaitlist(divisionId: string): boolean {
		const division = findDivisionById(divisionId);
		if (!division) return false;
		return Boolean(division.isLocked) || isDivisionFull(divisionId);
	}

	function defaultCreateTeamPlacement(
		divisionId: string,
		requestedPlacement: PlacementValue = 'active'
	): PlacementValue {
		if (requestedPlacement === 'waitlist') return 'waitlist';
		return shouldDefaultTeamToWaitlist(divisionId) ? 'waitlist' : 'active';
	}

	const divisionOptions = $derived.by<DropdownOption[]>(() =>
		data.divisions.map((division: DivisionSection) => ({
			value: division.id,
			label: division.name,
			labelIcon: division.isLocked ? IconLock : IconLockOpen,
			labelIconClass: division.isLocked ? undefined : 'opacity-50',
			labelIconAriaLabel: division.isLocked ? 'Locked division' : 'Unlocked division',
			statusLabel: divisionCapacityLabel(division)
		}))
	);

	const placementOptions = [
		{ value: 'active', label: 'Division', statusLabel: 'Counts against division capacity' },
		{ value: 'waitlist', label: 'Waitlist', statusLabel: 'Saved for later placement' }
	] satisfies DropdownOption[];

	const divisionTableColumns = $derived.by<OfferingsTableColumn[]>(() => divisionTableColumnsFor());

	const waitlistTableColumns = $derived.by<OfferingsTableColumn[]>(() =>
		waitlistTableColumnsFor(canManageLeague)
	);

	const allLeagueTeams = $derived.by<TeamPlacementRow[]>(() => [
		...data.divisions.flatMap((division: DivisionSection) =>
			division.teams.map((team: ActiveTeamRow) => ({
				id: team.id,
				name: team.name,
				slug: team.slug,
				divisionId: division.id,
				placement: 'active' as const,
				rosterSize: team.rosterSize,
				dateCreated: team.dateCreated,
				description: team.description
			}))
		),
		...data.waitlistTeams.map((team: WaitlistTeamRow) => ({
			id: team.id,
			name: team.name,
			slug: team.slug,
			divisionId: team.preferredDivisionId,
			placement: 'waitlist' as const,
			rosterSize: team.rosterSize,
			dateCreated: team.dateCreated,
			description: team.description
		}))
	]);

	let searchQuery = $state('');

	const normalizedSearchQuery = $derived.by(() => normalizeSearchValue(searchQuery));

	const visibleDivisions = $derived.by<DivisionSection[]>(() => {
		const query = normalizedSearchQuery;
		const divisions = query
			? data.divisions.filter((division: DivisionSection) => divisionMatchesSearch(division, query))
			: data.divisions;
		return [...divisions].sort(compareDivisionsBySchedule);
	});

	const visibleWaitlistTeams = $derived.by<WaitlistTeamRow[]>(() => {
		const query = normalizedSearchQuery;
		if (!query) return data.waitlistTeams;
		return data.waitlistTeams.filter((team: WaitlistTeamRow) =>
			waitlistTeamMatchesSearch(team, query)
		);
	});

	const visibleDivisionStandings = $derived.by<Map<string, StandingsDisplayRow[]>>(() => {
		const query = normalizedSearchQuery;
		return new Map(
			visibleDivisions.map((division: DivisionSection) => {
				const rows = buildStandingsRows(division);
				return [division.id, query ? rows.filter((row) => standingsMatchSearch(row, query)) : rows];
			})
		);
	});

	const hasSearchQuery = $derived.by(() => normalizedSearchQuery.length > 0);
	const registrationWindowDetails = $derived.by(() => leagueRegistrationWindowInfo());
	const joinTeamDeadlineDisplayText = $derived.by(() => leagueJoinTeamDeadlineText());

	function leagueDetailHref(
		leagueSlug: string | null | undefined,
		leagueId?: string | null | undefined
	): string {
		if (!data.season?.slug || !data.offering?.slug) return offeringHref();
		const routeLeagueSlug = leagueSlug?.trim() || leagueId?.trim();
		if (!routeLeagueSlug) return offeringHref();
		return `/dashboard/offerings/${data.season.slug}/${data.offering.slug}/${routeLeagueSlug}`;
	}

	const leagueDropdownOptions = $derived.by<DropdownOption[]>(() =>
		(data.leagues ?? []).map((league: NonNullable<PageData['leagues']>[number]) => ({
			value: leagueDetailHref(league.slug, league.id),
			label: league.name,
			statusLabel: league.isLocked ? 'Locked' : undefined
		}))
	);

	const selectedLeagueValue = $derived.by(() =>
		leagueDetailHref(data.league?.slug, data.league?.id)
	);
	const hierarchySegments = $derived.by<HeaderHierarchySegment[]>(() => {
		if (!data.offering || !data.league) return [];

		const currentOfferingHref = offeringHref();
		const currentLeagueHref = leagueDetailHref(data.league.slug, data.league.id);

		return [
			{
				key: 'offerings',
				label: pageLabel,
				href: '/dashboard/offerings',
				currentValue: currentLeagueHref,
				menuAriaLabel: 'Offerings list',
				options: [],
				showMenu: false
			},
			{
				key: 'offering',
				label: data.offering.name,
				href: currentOfferingHref,
				currentValue: currentOfferingHref,
				menuAriaLabel: 'Switch offering',
				options: (data.offeringOptions ?? []).map((option: HierarchyOption) => ({
					value: option.href,
					label: option.label
				}))
			},
			{
				key: 'league',
				label: data.league.name,
				href: currentLeagueHref,
				currentValue: currentLeagueHref,
				menuAriaLabel: 'Switch league',
				options: (data.leagues ?? []).map((league: NonNullable<PageData['leagues']>[number]) => ({
					value: leagueDetailHref(league.slug, league.id),
					label: league.name
				}))
			}
		];
	});

	const leagueAddActionOptions = $derived.by<DropdownOption[]>(() => [
		{
			value: 'create-division',
			label: 'Add Division'
		},
		{
			value: 'create-team',
			label: 'Add Team'
		}
	]);

	let createDivisionOpen = $state(false);
	let createTeamOpen = $state(false);
	let editDivisionOpen = $state(false);
	let createDivisionUnsavedConfirmOpen = $state(false);
	let createTeamUnsavedConfirmOpen = $state(false);
	let editDivisionUnsavedConfirmOpen = $state(false);
	let createDivisionSubmitting = $state(false);
	let createTeamSubmitting = $state(false);
	let editDivisionSubmitting = $state(false);
	let createDivisionValidationVisible = $state(false);
	let createTeamValidationVisible = $state(false);
	let editDivisionValidationVisible = $state(false);
	let createDivisionSlugTouched = $state(false);
	let createTeamSlugTouched = $state(false);
	let editDivisionSlugTouched = $state(false);
	let createDivisionDayOfWeekManual = $state(false);
	let createDivisionGameTimeManual = $state(false);
	let createDivisionFormError = $state('');
	let createTeamFormError = $state('');
	let editDivisionFormError = $state('');
	let createDivisionServerFieldErrors = $state<Record<string, string>>({});
	let createTeamServerFieldErrors = $state<Record<string, string>>({});
	let editDivisionServerFieldErrors = $state<Record<string, string>>({});
	let createDivisionForm = $state<DivisionWizardForm>(defaultDivisionForm());
	let createTeamForm = $state<TeamWizardForm>(defaultTeamForm());
	let editDivisionForm = $state<DivisionWizardForm>(defaultDivisionForm());
	let createDivisionInitialForm = $state<DivisionWizardForm>(defaultDivisionForm());
	let createTeamInitialForm = $state<TeamWizardForm>(defaultTeamForm());
	let editDivisionInitialForm = $state<DivisionWizardForm>(defaultDivisionForm());
	let editDivisionContext = $state<DivisionActionContext | null>(null);
	let activeMoveTeamId = $state<string | null>(null);
	let moveTeamContext = $state<TeamActionContext | null>(null);
	let moveTeamForm = $state<MoveTeamWizardForm>({
		divisionId: '',
		placement: 'active'
	});
	let moveTeamInitialForm = $state<MoveTeamWizardForm>({
		divisionId: '',
		placement: 'active'
	});
	let moveTeamUnsavedConfirmOpen = $state(false);
	let moveTeamSubmitting = $state(false);
	let moveTeamFormError = $state('');
	let removeModalTeam = $state<{ id: string; name: string } | null>(null);
	let removingTeamId = $state<string | null>(null);
	const createDivisionDirtyState = createWizardDirtyState<DivisionWizardForm>();
	const editDivisionDirtyState = createWizardDirtyState<DivisionWizardForm>();
	const createTeamDirtyState = createWizardDirtyState<TeamWizardForm>();
	const moveTeamDirtyState = createWizardDirtyState<MoveTeamWizardForm>();

	function clearCreateDivisionApiErrors(): void {
		createDivisionFormError = '';
		if (Object.keys(createDivisionServerFieldErrors).length > 0) {
			createDivisionServerFieldErrors = {};
		}
	}

	function clearEditDivisionApiErrors(): void {
		editDivisionFormError = '';
		if (Object.keys(editDivisionServerFieldErrors).length > 0) {
			editDivisionServerFieldErrors = {};
		}
	}

	function clearCreateTeamApiErrors(): void {
		createTeamFormError = '';
		if (Object.keys(createTeamServerFieldErrors).length > 0) {
			createTeamServerFieldErrors = {};
		}
	}

	function resetCreateDivisionWizard(): void {
		createDivisionInitialForm = defaultDivisionForm();
		createDivisionForm = { ...createDivisionInitialForm };
		createDivisionValidationVisible = false;
		createDivisionSlugTouched = false;
		createDivisionDayOfWeekManual = false;
		createDivisionGameTimeManual = false;
		createDivisionServerFieldErrors = {};
		createDivisionFormError = '';
		createDivisionUnsavedConfirmOpen = false;
		createDivisionDirtyState.clearBaseline();
	}

	function handleCreateDivisionNameInput(value: string): void {
		createDivisionForm.name = value;
		if (!createDivisionSlugTouched) {
			createDivisionForm.slug = slugifyFinal(value);
		}

		const inferred = inferDivisionNameDetails(value);
		if (!createDivisionDayOfWeekManual) {
			createDivisionForm.dayOfWeek = inferred.dayOfWeek;
		}
		if (!createDivisionGameTimeManual) {
			createDivisionForm.gameTime = inferred.gameTime;
		}
	}

	function handleCreateDivisionDayOfWeekInput(value: string): void {
		createDivisionDayOfWeekManual = value.trim().length > 0;
		createDivisionForm.dayOfWeek = value;
		if (!createDivisionDayOfWeekManual) {
			createDivisionForm.dayOfWeek = inferDivisionNameDetails(createDivisionForm.name).dayOfWeek;
		}
	}

	function handleCreateDivisionGameTimeInput(value: string): void {
		createDivisionGameTimeManual = value.trim().length > 0;
		createDivisionForm.gameTime = value;
		if (!createDivisionGameTimeManual) {
			createDivisionForm.gameTime = inferDivisionNameDetails(createDivisionForm.name).gameTime;
		}
	}

	function resetEditDivisionWizard(division: DivisionSection | null = null): void {
		editDivisionInitialForm = division ? divisionFormFromDivision(division) : defaultDivisionForm();
		editDivisionForm = { ...editDivisionInitialForm };
		editDivisionValidationVisible = false;
		editDivisionSlugTouched = false;
		editDivisionServerFieldErrors = {};
		editDivisionFormError = '';
		editDivisionUnsavedConfirmOpen = false;
		editDivisionDirtyState.clearBaseline();
	}

	function resetCreateTeamWizard(
		divisionId = data.divisions[0]?.id ?? '',
		placement: PlacementValue = 'active'
	): void {
		createTeamInitialForm = {
			...defaultTeamForm(divisionId),
			placement: defaultCreateTeamPlacement(divisionId, placement)
		};
		createTeamForm = { ...createTeamInitialForm };
		createTeamValidationVisible = false;
		createTeamSlugTouched = false;
		createTeamServerFieldErrors = {};
		createTeamFormError = '';
		createTeamUnsavedConfirmOpen = false;
		createTeamDirtyState.clearBaseline();
	}

	function openCreateDivisionWizard(): void {
		resetCreateDivisionWizard();
		createDivisionDirtyState.captureBaseline(createDivisionForm);
		createDivisionOpen = true;
	}

	function openEditDivisionWizard(division: DivisionSection): void {
		editDivisionContext = {
			id: division.id,
			name: division.name
		};
		resetEditDivisionWizard(division);
		editDivisionDirtyState.captureBaseline(editDivisionForm);
		editDivisionOpen = true;
	}

	function openCreateTeamWizard(
		divisionId = data.divisions[0]?.id ?? '',
		placement: PlacementValue = 'active'
	): void {
		resetCreateTeamWizard(divisionId, placement);
		createTeamDirtyState.captureBaseline(createTeamForm);
		createTeamOpen = true;
	}

	async function handleLeagueChange(value: string): Promise<void> {
		if (!value || value === selectedLeagueValue) return;
		await goto(value);
	}

	function handleLeagueAddAction(action: string): void {
		if (action === 'create-team') {
			openCreateTeamWizard();
			return;
		}

		openCreateDivisionWizard();
	}

	function closeCreateDivisionWizard(): void {
		createDivisionOpen = false;
		resetCreateDivisionWizard();
	}

	function closeEditDivisionWizard(): void {
		editDivisionOpen = false;
		editDivisionContext = null;
		resetEditDivisionWizard();
	}

	function closeCreateTeamWizard(): void {
		createTeamOpen = false;
		resetCreateTeamWizard();
	}

	function resetMoveTeamWizard(team: TeamActionContext | null): void {
		if (!team) {
			moveTeamInitialForm = {
				divisionId: data.divisions[0]?.id ?? '',
				placement: 'active'
			};
		} else {
			moveTeamInitialForm = {
				divisionId: team.currentDivisionId,
				placement: team.currentPlacement
			};
		}
		moveTeamForm = { ...moveTeamInitialForm };
		moveTeamFormError = '';
		moveTeamUnsavedConfirmOpen = false;
		moveTeamDirtyState.clearBaseline();
	}

	function openMoveTeamWizard(team: TeamActionContext): void {
		moveTeamContext = team;
		resetMoveTeamWizard(team);
		moveTeamDirtyState.captureBaseline(moveTeamForm);
	}

	function closeMoveTeamWizard(): void {
		moveTeamContext = null;
		resetMoveTeamWizard(null);
	}

	function hasUnsavedCreateDivisionChanges(): boolean {
		return createDivisionDirtyState.isDirty(createDivisionForm);
	}

	function hasUnsavedEditDivisionChanges(): boolean {
		return editDivisionDirtyState.isDirty(editDivisionForm);
	}

	function hasUnsavedCreateTeamChanges(): boolean {
		return createTeamDirtyState.isDirty(createTeamForm);
	}

	function hasUnsavedMoveTeamChanges(): boolean {
		return moveTeamDirtyState.isDirty(moveTeamForm);
	}

	function hasUnsavedLeagueWizardChanges(): boolean {
		return (
			(createDivisionOpen && hasUnsavedCreateDivisionChanges()) ||
			(editDivisionOpen && hasUnsavedEditDivisionChanges()) ||
			(createTeamOpen && hasUnsavedCreateTeamChanges()) ||
			Boolean(moveTeamContext && hasUnsavedMoveTeamChanges())
		);
	}

	function requestCloseCreateDivisionWizard(): void {
		if (!createDivisionOpen || createDivisionSubmitting) return;
		if (!hasUnsavedCreateDivisionChanges()) {
			closeCreateDivisionWizard();
			return;
		}
		createDivisionUnsavedConfirmOpen = true;
	}

	function requestCloseEditDivisionWizard(): void {
		if (!editDivisionOpen || editDivisionSubmitting) return;
		if (!hasUnsavedEditDivisionChanges()) {
			closeEditDivisionWizard();
			return;
		}
		editDivisionUnsavedConfirmOpen = true;
	}

	function requestCloseCreateTeamWizard(): void {
		if (!createTeamOpen || createTeamSubmitting) return;
		if (!hasUnsavedCreateTeamChanges()) {
			closeCreateTeamWizard();
			return;
		}
		createTeamUnsavedConfirmOpen = true;
	}

	function requestCloseMoveTeamWizard(): void {
		if (!moveTeamContext || moveTeamSubmitting) return;
		if (!hasUnsavedMoveTeamChanges()) {
			closeMoveTeamWizard();
			return;
		}
		moveTeamUnsavedConfirmOpen = true;
	}

	function getDivisionFieldErrors(
		values: DivisionWizardForm,
		options?: { excludeDivisionId?: string | null }
	): Record<string, string> {
		const errors: Record<string, string> = {};
		const name = values.name.trim();
		const slug = values.slug.trim();
		const normalizedName = name.toLowerCase();
		const normalizedSlug = slug.toLowerCase();
		const maxTeams = Number(values.maxTeams);
		const excludeDivisionId = options?.excludeDivisionId ?? null;

		if (!name) errors['name'] = 'Division name is required.';
		if (!slug) errors['slug'] = 'Division slug is required.';
		if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
			errors['slug'] = 'Division slug must use lowercase letters, numbers, and dashes only.';
		}
		if (!Number.isInteger(maxTeams) || maxTeams < 1) {
			errors['maxTeams'] = 'Division team limit must be at least 1.';
		} else if (maxTeams > 128) {
			errors['maxTeams'] = 'Division team limit must be 128 or less.';
		}

		if (
			name &&
			data.divisions.some(
				(division: DivisionSection) =>
					division.id !== excludeDivisionId && division.name.trim().toLowerCase() === normalizedName
			)
		) {
			errors['name'] = 'A division with this name already exists for this league.';
		}

		if (
			slug &&
			data.divisions.some(
				(division: DivisionSection) =>
					division.id !== excludeDivisionId && division.slug.trim().toLowerCase() === normalizedSlug
			)
		) {
			errors['slug'] = 'A division with this slug already exists for this league.';
		}

		return errors;
	}

	function isDivisionFull(divisionId: string, ignoreTeamId?: string): boolean {
		const division = data.divisions.find(
			(candidate: DivisionSection) => candidate.id === divisionId
		);
		if (!division || typeof division.maxTeams !== 'number') return false;

		const activeCount = allLeagueTeams.filter((team) => {
			if (ignoreTeamId && team.id === ignoreTeamId) return false;
			return team.divisionId === divisionId && team.placement === 'active';
		}).length;

		return activeCount >= division.maxTeams;
	}

	function getCreateTeamFieldErrors(values: TeamWizardForm): Record<string, string> {
		const errors: Record<string, string> = {};
		const name = values.name.trim();
		const slug = values.slug.trim();
		const normalizedSlug = slug.toLowerCase();
		const targetDivision = findDivisionById(values.divisionId);

		if (!name) errors['name'] = 'Team name is required.';
		if (!slug) errors['slug'] = 'Team slug is required.';
		if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
			errors['slug'] = 'Team slug must use lowercase letters, numbers, and dashes only.';
		}
		if (!values.divisionId) {
			errors['divisionId'] = 'Select a division for this team.';
		}

		if (values.divisionId && !targetDivision) {
			errors['divisionId'] = 'Select a valid division for this league.';
		}

		if (slug && allLeagueTeams.some((team) => team.slug.trim().toLowerCase() === normalizedSlug)) {
			errors['slug'] = 'A team with this slug already exists in this league.';
		}

		if (values.placement === 'active' && targetDivision?.isLocked) {
			errors['divisionId'] = 'This division is locked. Add the team to the waitlist instead.';
		} else if (
			values.placement === 'active' &&
			values.divisionId &&
			isDivisionFull(values.divisionId)
		) {
			errors['divisionId'] =
				'This division is already at capacity. Add the team to the waitlist instead.';
		}

		return errors;
	}

	function getMoveTeamFieldErrors(values: MoveTeamWizardForm): Record<string, string> {
		const errors: Record<string, string> = {};
		if (!moveTeamContext) return errors;

		if (!values.divisionId) {
			errors['divisionId'] = 'Select a division for this team.';
		} else if (
			!data.divisions.some((division: DivisionSection) => division.id === values.divisionId)
		) {
			errors['divisionId'] = 'Select a valid division for this league.';
		}

		if (
			values.placement === 'active' &&
			values.divisionId &&
			isDivisionFull(values.divisionId, moveTeamContext.id)
		) {
			errors['divisionId'] =
				'This division is already at capacity. Keep the team on the waitlist instead.';
		}

		return errors;
	}

	const createDivisionFieldErrors = $derived.by(() => ({
		...(createDivisionValidationVisible ? getDivisionFieldErrors(createDivisionForm) : {}),
		...createDivisionServerFieldErrors
	}));
	const editDivisionFieldErrors = $derived.by(() => ({
		...(editDivisionValidationVisible
			? getDivisionFieldErrors(editDivisionForm, {
					excludeDivisionId: editDivisionContext?.id ?? null
				})
			: {}),
		...editDivisionServerFieldErrors
	}));

	const createTeamFieldErrors = $derived.by(() => ({
		...(createTeamValidationVisible ? getCreateTeamFieldErrors(createTeamForm) : {}),
		...createTeamServerFieldErrors
	}));

	const createTeamSelectedDivisionStatus = $derived.by<CreateTeamDivisionStatus | null>(() => {
		const division = findDivisionById(createTeamForm.divisionId);
		if (!division) return null;

		const isLocked = Boolean(division.isLocked);
		const isFull = isDivisionFull(division.id);

		return {
			name: division.name,
			isLocked,
			isFull,
			defaultsToWaitlist: isLocked || isFull
		};
	});

	const moveTeamFieldErrors = $derived.by(() => getMoveTeamFieldErrors(moveTeamForm));

	const canSubmitCreateDivision = $derived.by(() => !createDivisionSubmitting);
	const canSubmitEditDivision = $derived.by(
		() => Boolean(editDivisionContext) && !editDivisionSubmitting && hasUnsavedEditDivisionChanges()
	);

	const canSubmitCreateTeam = $derived.by(() => !createTeamSubmitting);

	const canSubmitMoveTeam = $derived.by(
		() =>
			Boolean(moveTeamContext) &&
			Object.keys(getMoveTeamFieldErrors(moveTeamForm)).length === 0 &&
			hasUnsavedMoveTeamChanges() &&
			!moveTeamSubmitting
	);

	async function createDivision(): Promise<void> {
		createDivisionValidationVisible = true;
		const clientErrors = getDivisionFieldErrors(createDivisionForm);
		if (Object.keys(clientErrors).length > 0 || !data.league?.id) {
			return;
		}

		const apiPath = managementApiPath();
		if (!apiPath) {
			toast.error('League route is missing season or league slug.', {
				title: data.league?.name ?? pageLabel
			});
			return;
		}

		createDivisionSubmitting = true;
		createDivisionFormError = '';
		createDivisionServerFieldErrors = {};

		try {
			const response = await fetch(apiPath, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'create-division',
					leagueId: data.league.id,
					division: {
						name: createDivisionForm.name.trim(),
						slug: createDivisionForm.slug.trim(),
						description: createDivisionForm.description.trim() || null,
						dayOfWeek: createDivisionForm.dayOfWeek.trim() || null,
						gameTime: createDivisionForm.gameTime.trim() || null,
						maxTeams: Number(createDivisionForm.maxTeams),
						location: createDivisionForm.location.trim() || null,
						isLocked: createDivisionForm.isLocked,
						startDate: createDivisionForm.startDate || null
					}
				})
			});
			const payload = await readResponse(response);
			if (!response.ok || !payload.success) {
				createDivisionServerFieldErrors = readScopedFieldErrors(payload.fieldErrors, 'division');
				createDivisionFormError =
					payload.error ??
					firstFieldError(payload.fieldErrors) ??
					'Unable to create division right now.';
				return;
			}

			closeCreateDivisionWizard();
			await invalidateAll();
			toast.success('Division added.', {
				title: data.league.name
			});
		} catch {
			createDivisionFormError = 'Unable to create division right now.';
		} finally {
			createDivisionSubmitting = false;
		}
	}

	async function editDivision(): Promise<void> {
		editDivisionValidationVisible = true;
		const clientErrors = getDivisionFieldErrors(editDivisionForm, {
			excludeDivisionId: editDivisionContext?.id ?? null
		});
		if (Object.keys(clientErrors).length > 0 || !data.league?.id || !editDivisionContext?.id) {
			return;
		}

		const apiPath = managementApiPath();
		if (!apiPath) {
			toast.error('League route is missing season or league slug.', {
				title: data.league?.name ?? pageLabel
			});
			return;
		}

		editDivisionSubmitting = true;
		editDivisionFormError = '';
		editDivisionServerFieldErrors = {};

		try {
			const response = await fetch(apiPath, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'update-division',
					leagueId: data.league.id,
					divisionId: editDivisionContext.id,
					division: {
						name: editDivisionForm.name.trim(),
						slug: editDivisionForm.slug.trim(),
						description: editDivisionForm.description.trim() || null,
						dayOfWeek: editDivisionForm.dayOfWeek.trim() || null,
						gameTime: editDivisionForm.gameTime.trim() || null,
						maxTeams: Number(editDivisionForm.maxTeams),
						location: editDivisionForm.location.trim() || null,
						isLocked: editDivisionForm.isLocked,
						startDate: editDivisionForm.startDate || null
					}
				})
			});
			const payload = await readResponse(response);
			if (!response.ok || !payload.success) {
				editDivisionServerFieldErrors = readScopedFieldErrors(payload.fieldErrors, 'division');
				editDivisionFormError =
					payload.error ??
					firstFieldError(payload.fieldErrors) ??
					'Unable to update division right now.';
				return;
			}

			closeEditDivisionWizard();
			await invalidateAll();
			toast.success('Division updated.', {
				title: data.league.name
			});
		} catch {
			editDivisionFormError = 'Unable to update division right now.';
		} finally {
			editDivisionSubmitting = false;
		}
	}

	async function createTeam(): Promise<void> {
		createTeamValidationVisible = true;
		const clientErrors = getCreateTeamFieldErrors(createTeamForm);
		if (Object.keys(clientErrors).length > 0 || !data.league?.id) {
			return;
		}

		const apiPath = managementApiPath();
		if (!apiPath) {
			toast.error('League route is missing season or league slug.', {
				title: data.league?.name ?? pageLabel
			});
			return;
		}

		createTeamSubmitting = true;
		createTeamFormError = '';
		createTeamServerFieldErrors = {};

		try {
			const response = await fetch(apiPath, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'create-team',
					leagueId: data.league.id,
					team: {
						divisionId: createTeamForm.divisionId,
						name: createTeamForm.name.trim(),
						slug: createTeamForm.slug.trim(),
						description: createTeamForm.description.trim() || null,
						imageUrl: null,
						teamColor: createTeamForm.teamColor.trim() || null,
						placement: createTeamForm.placement
					}
				})
			});
			const payload = await readResponse(response);
			if (!response.ok || !payload.success) {
				createTeamServerFieldErrors = readScopedFieldErrors(payload.fieldErrors, 'team');
				createTeamFormError =
					payload.error ??
					firstFieldError(payload.fieldErrors) ??
					'Unable to create team right now.';
				return;
			}

			const placement = createTeamForm.placement;
			closeCreateTeamWizard();
			await invalidateAll();
			toast.success(placement === 'waitlist' ? 'Team added to the waitlist.' : 'Team created.', {
				title: data.league.name
			});
		} catch {
			createTeamFormError = 'Unable to create team right now.';
		} finally {
			createTeamSubmitting = false;
		}
	}

	function handleCreateTeamDivisionChange(divisionId: string): void {
		const followedPreviousDefault =
			createTeamForm.placement === defaultCreateTeamPlacement(createTeamForm.divisionId);
		createTeamForm.divisionId = divisionId;
		if (followedPreviousDefault) {
			createTeamForm.placement = defaultCreateTeamPlacement(divisionId);
		}
		clearCreateTeamApiErrors();
	}

	function handleCreateTeamWaitlistChange(checked: boolean): void {
		createTeamForm.placement = checked ? 'waitlist' : 'active';
		clearCreateTeamApiErrors();
	}

	function teamActionOptions(team: TeamActionContext): DropdownOption[] {
		return [
			{
				value: 'move-team',
				label: 'Move Team',
				description: `Currently in ${team.currentPlacement === 'waitlist' ? 'waitlist' : team.currentDivisionName}`
			},
			{
				value: 'invite-members',
				label: 'Invite Members',
				description: 'Coming soon',
				disabled: true,
				disabledTooltip: 'Member invites are not wired on this page yet.'
			},
			{
				value: 'team-settings',
				label: 'Team Settings',
				description: 'Coming soon',
				disabled: true,
				disabledTooltip: 'Team settings are not wired on this page yet.'
			},
			{
				value: 'delete-team',
				label: 'Delete Team',
				description: 'Remove this team from the league',
				separatorBefore: true
			}
		];
	}

	async function updateTeamPlacement(
		teamId: string,
		targetDivisionId: string,
		targetPlacement: PlacementValue
	): Promise<boolean> {
		if (!data.league?.id) return false;

		const apiPath = managementApiPath();
		if (!apiPath) {
			toast.error('League route is missing season or league slug.', {
				title: data.league?.name ?? pageLabel
			});
			return false;
		}

		activeMoveTeamId = teamId;
		try {
			const response = await fetch(apiPath, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'move-team',
					leagueId: data.league.id,
					teamId,
					divisionId: targetDivisionId,
					placement: targetPlacement
				})
			});
			const payload = await readResponse(response);
			if (!response.ok || !payload.success) {
				toast.error(
					payload.error ??
						firstFieldError(payload.fieldErrors) ??
						'Unable to update team placement right now.',
					{
						title: data.league.name
					}
				);
				return false;
			}

			await invalidateAll();
			toast.success('Team placement updated.', {
				title: data.league.name
			});
			return true;
		} catch {
			toast.error('Unable to update team placement right now.', {
				title: data.league?.name ?? pageLabel
			});
			return false;
		} finally {
			activeMoveTeamId = null;
		}
	}

	async function submitMoveTeam(): Promise<void> {
		if (!moveTeamContext) return;

		const clientErrors = getMoveTeamFieldErrors(moveTeamForm);
		if (Object.keys(clientErrors).length > 0 || !hasUnsavedMoveTeamChanges()) {
			return;
		}

		moveTeamSubmitting = true;
		moveTeamFormError = '';

		const didMove = await updateTeamPlacement(
			moveTeamContext.id,
			moveTeamForm.divisionId,
			moveTeamForm.placement
		);

		moveTeamSubmitting = false;
		if (!didMove) {
			moveTeamFormError = 'Unable to move team right now.';
			return;
		}

		closeMoveTeamWizard();
	}

	function divisionActionOptions(division: DivisionSection): DropdownOption[] {
		return [
			{
				value: 'modify-division',
				label: 'Modify',
				description: `Edit ${division.name}`
			},
			{
				value: 'delete-division',
				label: 'Delete',
				description: 'Coming soon',
				disabled: true,
				disabledTooltip: 'Delete division is not available yet.'
			},
			{
				value: 'archive-division',
				label: 'Archive',
				description: 'Coming soon',
				disabled: true,
				disabledTooltip: 'Archive division is not available yet.'
			}
		];
	}

	function handleTeamAction(action: TeamActionValue, team: TeamActionContext): void {
		if (action === 'move-team') {
			openMoveTeamWizard(team);
			return;
		}

		if (action === 'delete-team') {
			openRemoveTeam(team);
		}
	}

	function handleDivisionAction(action: DivisionActionValue, division: DivisionSection): void {
		if (action === 'modify-division') {
			openEditDivisionWizard(division);
		}
	}

	function openRemoveTeam(team: { id: string; name: string }): void {
		removeModalTeam = team;
	}

	async function confirmRemoveTeam(): Promise<void> {
		if (!data.league?.id || !removeModalTeam) return;

		const apiPath = managementApiPath();
		if (!apiPath) {
			toast.error('League route is missing season or league slug.', {
				title: data.league?.name ?? pageLabel
			});
			return;
		}

		removingTeamId = removeModalTeam.id;
		try {
			const response = await fetch(apiPath, {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'remove-team',
					leagueId: data.league.id,
					teamId: removeModalTeam.id
				})
			});
			const payload = await readResponse(response);
			if (!response.ok || !payload.success) {
				toast.error(
					payload.error ??
						firstFieldError(payload.fieldErrors) ??
						'Unable to remove team right now.',
					{
						title: data.league.name
					}
				);
				return;
			}

			removeModalTeam = null;
			await invalidateAll();
			toast.success('Team removed.', {
				title: data.league.name
			});
		} catch {
			toast.error('Unable to remove team right now.', {
				title: data.league?.name ?? pageLabel
			});
		} finally {
			removingTeamId = null;
		}
	}

	function divisionHref(division: DivisionSection): string {
		if (!data.season?.slug || !data.offering?.slug || !data.league?.slug) {
			return offeringHref();
		}
		return `/dashboard/offerings/${data.season.slug}/${data.offering.slug}/${data.league.slug}/${division.slug || division.id}`;
	}

	beforeNavigate((navigation) => {
		if (typeof window === 'undefined') return;
		if (!hasUnsavedLeagueWizardChanges() || navigation.willUnload) return;
		if (
			window.confirm('You have unsaved wizard changes. Leave this page and discard those changes?')
		) {
			return;
		}
		navigation.cancel();
	});

	$effect(() => {
		if (typeof window === 'undefined' || !hasUnsavedLeagueWizardChanges()) return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	const HeaderIcon = $derived.by(() =>
		sportIconFor(data.offering?.name ?? data.league?.name ?? 'League', data.offering?.sport ?? null)
	);
</script>

<svelte:head>
	<title>{data.league?.name ?? pageLabel} - PlayIMs</title>
	<meta
		name="description"
		content="League information, division standings, waitlist management, and team placement tools."
	/>
</svelte:head>

<div class="w-full space-y-4">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex items-center gap-3 py-2 lg:py-3">
				<div
					class="bg-primary text-white border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
					aria-hidden="true"
				>
					<HeaderIcon class="w-7 h-7 lg:w-8 lg:h-8" />
				</div>
				<div class="relative min-w-0">
					<h1
						class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
					>
						{data.league?.name ?? 'League'}
					</h1>
					{#if hierarchySegments.length > 0}
						<div class="absolute left-0 top-[calc(100%+0.2rem)] z-10">
							<HeaderHierarchyTabs
								segments={hierarchySegments}
								class="max-w-[min(100vw-7rem,100%)]"
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<div class="space-y-4 px-4 lg:px-6">
		{#if data.error}
			<div class="border-2 border-warning-300 bg-warning-50 p-4 text-sm text-neutral-950">
				{data.error}
			</div>
		{/if}

		{#if data.league}
			<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="space-y-3 border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">
									{data.offering?.name ?? 'League'}
								</h2>
								<ListboxDropdown
									options={leagueDropdownOptions}
									value={selectedLeagueValue}
									ariaLabel="Select league for this offering"
									buttonClass="button-secondary-outlined min-w-[11rem] px-3 py-1 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
									emptyText="No other leagues available."
									disabled={leagueDropdownOptions.length <= 1}
									on:change={(event) => {
										void handleLeagueChange(event.detail.value);
									}}
								/>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.divisionCount} divisions
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.activeTeamCount} active teams
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.waitlistCount} waitlist
								</span>
								{#if canManageLeague}
									<SplitAddAction
										options={leagueAddActionOptions}
										on:click={openCreateDivisionWizard}
										on:action={(event) => {
											handleLeagueAddAction(event.detail.value);
										}}
									/>
								{/if}
							</div>
						</div>
						<SearchInput
							id="league-search"
							label="Search divisions and teams"
							value={searchQuery}
							placeholder="Search division, team, captain, or waitlist"
							autocomplete="off"
							wrapperClass="relative"
							iconClass="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-950"
							inputClass="input-secondary py-1 pl-10 pr-10 text-sm disabled:cursor-not-allowed"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-950 hover:text-secondary-900"
							clearIconClass="h-4 w-4"
							clearAriaLabel="Clear league search"
							on:input={(event) => {
								searchQuery = event.detail.value;
							}}
						/>
					</div>

					<div class="min-h-[34rem]">
						{#if visibleDivisions.length === 0 && visibleWaitlistTeams.length === 0}
							<div class="p-4">
								<div
									class={`space-y-2 border p-4 ${hasSearchQuery ? 'border-warning-300 bg-warning-50' : 'border-neutral-950 bg-white'}`}
								>
									<h3 class="text-xl font-bold font-serif text-neutral-950">
										{#if hasSearchQuery}
											No matches found
										{:else}
											No divisions yet
										{/if}
									</h3>
									<p class="text-sm font-sans text-neutral-950">
										{#if hasSearchQuery}
											No divisions or waitlist teams match "{searchQuery.trim()}".
										{:else}
											Create a division to start organizing teams for this league.
										{/if}
									</p>
								</div>
							</div>
						{:else}
							<div class="divide-y divide-neutral-950">
								{#each visibleDivisions as division}
									<section
										id={`division-${division.slug || division.id}`}
										class="scroll-mt-4 space-y-3 p-4"
									>
										<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<a
														href={divisionHref(division)}
														class="text-2xl font-bold font-serif text-neutral-950 hover:underline"
													>
														{division.name}
													</a>
													<HoverTooltip
														text={divisionLockTooltip(division)}
														wrapperClass="inline-flex shrink-0"
													>
														<span class="inline-flex text-neutral-950" aria-hidden="true">
															{#if division.isLocked}
																<IconLock class="h-4 w-4" />
															{:else}
																<IconLockOpen class="h-4 w-4 opacity-50" />
															{/if}
														</span>
													</HoverTooltip>
													<span class="sr-only">{division.isLocked ? 'Locked' : 'Unlocked'}</span>
													<span class="text-sm font-sans font-normal text-neutral-950">
														{divisionCapacityLabel(division)}
													</span>
												</div>
												{#if divisionMetaLine(division)}
													<p
														class="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-800"
													>
														{divisionMetaLine(division)}
													</p>
												{/if}
											</div>
											<div class="flex flex-wrap items-center gap-2">
												{#if division.waitlistCount > 0}
													<span class="badge-primary-outlined text-xs uppercase tracking-wide">
														{division.waitlistCount} Waitlist
													</span>
												{/if}
												{#if canManageLeague}
													<div class="flex items-center">
														<ListboxDropdown
															options={divisionActionOptions(division)}
															value=""
															mode="action"
															align="right"
															ariaLabel={`Actions for ${division.name}`}
															buttonClass={SECTION_ACTION_DROPDOWN_BUTTON_CLASS}
															listClass={ACTION_DROPDOWN_LIST_CLASS}
															optionClass={ACTION_DROPDOWN_OPTION_CLASS}
															activeOptionClass="bg-neutral-100 text-neutral-950"
															on:action={(event) =>
																handleDivisionAction(
																	event.detail.value as DivisionActionValue,
																	division
																)}
														>
															{#snippet trigger()}<IconDots class="h-4 w-4" />{/snippet}
														</ListboxDropdown>
													</div>
												{/if}
											</div>
										</div>

										{#if division.description}
											<p class="text-sm leading-6 text-neutral-950">{division.description}</p>
										{/if}

										<OfferingsTable
											columns={divisionTableColumns}
											rows={division.teams}
											caption={`${division.name} teams table`}
										>
											{#snippet emptyBody()}
												<tr class="bg-neutral-25">
													<td
														colspan={divisionTableColumns.length}
														class="px-2 py-10 text-center text-sm italic text-neutral-700"
													>
														No teams have been placed in this division yet.
													</td>
												</tr>
											{/snippet}

											{#snippet cell(team, column)}
												{@const activeTeam = team as ActiveTeamRow}
												{#if column.key === 'team'}
													<div class="flex items-center gap-2">
														<div
															class="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-white"
															aria-hidden="true"
														>
															<HeaderIcon class="h-5 w-5" />
														</div>
														<div class="min-w-0">
															<p class="font-sans text-sm font-bold text-neutral-950">
																{activeTeam.name}
															</p>
															<p
																class="mt-0 font-sans text-[11px] font-normal leading-tight text-neutral-700"
															>
																{captainLabel(activeTeam.captainName)}
															</p>
															{#if activeTeam.description}
																<div class="mt-1 max-w-full overflow-x-auto pb-1 scrollbar-thin">
																	<p
																		class="min-w-max font-sans text-xs leading-snug whitespace-nowrap text-neutral-700"
																	>
																		{activeTeam.description}
																	</p>
																</div>
															{/if}
														</div>
													</div>
												{:else if column.key === 'date-created'}
													<p class="font-sans text-xs leading-snug text-neutral-950">
														<DateHoverText
															display={formatDateTime(activeTeam.dateCreated)}
															value={activeTeam.dateCreated}
															includeTime
															wrapperClass="inline"
														/>
													</p>
												{:else if column.key === 'date-joined'}
													<p class="font-sans text-xs leading-snug text-neutral-950">
														<DateHoverText
															display={formatDateTime(activeTeam.dateJoined)}
															value={activeTeam.dateJoined}
															includeTime
															wrapperClass="inline"
														/>
													</p>
												{:else if column.key === 'roster'}
													<div class="flex w-full justify-center">
														<p class="font-sans text-xs leading-snug text-neutral-950">
															{activeTeam.rosterSize} /
															{#if hasRosterLimit()}
																{data.offering?.maxPlayers}
															{:else}
																<span class="text-sm leading-none" aria-label="No max players">
																	&infin;
																</span>
															{/if}
														</p>
													</div>
												{:else if column.key === 'status'}
													<div class="flex w-full justify-center">
														<span
															class={`inline-flex ${approvalBadgeClass(true)} text-xs uppercase tracking-wide`}
														>
															{approvalBadgeLabel(true)}
														</span>
													</div>
												{/if}
											{/snippet}
										</OfferingsTable>
									</section>
								{/each}

								<section class="space-y-3 p-4">
									<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<h2 class="text-2xl font-bold font-serif text-neutral-950">Waitlist</h2>
												<HoverTooltip text={waitlistTooltip()} wrapperClass="inline-flex shrink-0">
													<span class="inline-flex text-neutral-950" aria-hidden="true">
														{#if waitlistIsOpen()}
															<IconLockOpen class="h-4 w-4 opacity-50" />
														{:else}
															<IconLock class="h-4 w-4" />
														{/if}
													</span>
												</HoverTooltip>
												<span class="sr-only">{waitlistIsOpen() ? 'Unlocked' : 'Locked'}</span>
											</div>
											<p class="mt-1 text-xs leading-tight text-neutral-700">
												Join deadline:
												<DateHoverText
													display={formatDateTime(joinTeamDeadline())}
													value={joinTeamDeadline()}
													includeTime
													textClass="ml-1"
												/>
											</p>
										</div>
										<div class="flex flex-wrap items-center gap-1">
											<span class="badge-primary-outlined text-xs uppercase tracking-wide">
												{visibleWaitlistTeams.length} Showing
											</span>
										</div>
									</div>
									<OfferingsTable
										columns={waitlistTableColumns}
										rows={visibleWaitlistTeams}
										caption="League waitlist table"
										rowClass={() => (canManageLeague ? 'group' : '')}
									>
										{#snippet emptyBody()}
											<tr class="bg-neutral-25">
												<td
													colspan={waitlistTableColumns.length}
													class="px-2 py-8 text-center text-sm italic text-neutral-700"
												>
													{#if hasSearchQuery}
														No waitlist teams match this search.
													{:else}
														No teams are on the waitlist right now.
													{/if}
												</td>
											</tr>
										{/snippet}

										{#snippet cell(team, column)}
											{@const waitlistTeam = team as WaitlistTeamRow}
											{#if column.key === 'team'}
												<div class="flex items-center gap-2">
													<div
														class="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-white"
														aria-hidden="true"
													>
														<HeaderIcon class="h-5 w-5" />
													</div>
													<div class="min-w-0">
														<div class="space-y-px">
															<p class="font-sans text-sm leading-tight font-bold text-neutral-950">
																{waitlistTeam.name}
															</p>
															<p
																class="font-sans text-[11px] leading-none font-normal text-neutral-700"
															>
																{captainLabel(waitlistTeam.captainName)}
															</p>
														</div>
														{#if waitlistTeam.description}
															<div class="mt-1 max-w-full overflow-x-auto pb-1 scrollbar-thin">
																<p
																	class="min-w-max font-sans text-xs leading-snug whitespace-nowrap text-neutral-700"
																>
																	{waitlistTeam.description}
																</p>
															</div>
														{/if}
													</div>
												</div>
											{:else if column.key === 'date-created'}
												<p class="font-sans text-xs leading-snug text-neutral-950">
													<DateHoverText
														display={formatDateTime(waitlistTeam.dateCreated)}
														value={waitlistTeam.dateCreated}
														includeTime
														wrapperClass="inline"
													/>
												</p>
											{:else if column.key === 'preferred-division'}
												<p class="font-sans text-xs leading-snug text-neutral-950">
													{waitlistTeam.preferredDivisionName}
												</p>
											{:else if column.key === 'roster'}
												<p class="font-sans text-xs leading-snug text-neutral-950">
													{waitlistTeam.rosterSize} /
													{#if hasRosterLimit()}
														{data.offering?.maxPlayers}
													{:else}
														<span class="text-sm leading-none" aria-label="No max players">
															&infin;
														</span>
													{/if}
												</p>
											{:else if column.key === 'status'}
												<span
													class={`${approvalBadgeClass(false)} text-xs uppercase tracking-wide`}
												>
													{approvalBadgeLabel(false)}
												</span>
											{:else if column.key === 'manage' && canManageLeague}
												<div class="flex justify-end">
													<ListboxDropdown
														options={teamActionOptions({
															id: waitlistTeam.id,
															name: waitlistTeam.name,
															currentDivisionId: waitlistTeam.preferredDivisionId,
															currentDivisionName: waitlistTeam.preferredDivisionName,
															currentPlacement: 'waitlist'
														})}
														value=""
														mode="action"
														align="right"
														ariaLabel={`Actions for ${waitlistTeam.name}`}
														buttonClass={ACTION_DROPDOWN_BUTTON_CLASS}
														listClass={ACTION_DROPDOWN_LIST_CLASS}
														optionClass={ACTION_DROPDOWN_OPTION_CLASS}
														activeOptionClass="bg-neutral-100 text-neutral-950"
														on:action={(event) =>
															handleTeamAction(event.detail.value as TeamActionValue, {
																id: waitlistTeam.id,
																name: waitlistTeam.name,
																currentDivisionId: waitlistTeam.preferredDivisionId,
																currentDivisionName: waitlistTeam.preferredDivisionName,
																currentPlacement: 'waitlist'
															})}
													>
														{#snippet trigger()}<IconDots class="h-4 w-4" />{/snippet}
													</ListboxDropdown>
												</div>
											{/if}
										{/snippet}
									</OfferingsTable>
								</section>
							</div>
						{/if}
					</div>
				</section>

				<aside class="w-full min-w-0 space-y-4">
					<DashboardSidebarPanel title="League Information" contentClass="space-y-2.5 p-3">
						{#snippet content()}
							<div class="space-y-2.5 text-[13px] text-neutral-950">
								<div class="border border-neutral-950 bg-white p-2.5">
									<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
										<div class="min-w-0">
											<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
												Regular Season
											</p>
											<p class="mt-0.5 leading-tight">
												<DateHoverText
													display={formatSeasonPhaseBoundaryText(
														data.league.seasonStartDate,
														'Starts',
														'Started'
													)}
													value={data.league.seasonStartDate}
													wrapperClass="inline"
												/>
											</p>
											<p class="leading-tight">
												<DateHoverText
													display={formatSeasonPhaseBoundaryText(
														data.league.seasonEndDate,
														'Ends',
														'Ended'
													)}
													value={data.league.seasonEndDate}
													wrapperClass="inline"
												/>
											</p>
										</div>
										<div
											class="min-w-0 border-t border-secondary-200 pt-2 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-0"
										>
											<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
												Preseason
											</p>
											<p class="mt-0.5 leading-tight">
												{#if data.league.hasPreseason}
													<DateHoverText
														display={formatSeasonPhaseBoundaryText(
															data.league.preseasonStartDate,
															'Starts',
															'Started'
														)}
														value={data.league.preseasonStartDate}
														wrapperClass="inline"
													/>
												{:else}
													No preseason
												{/if}
											</p>
											{#if data.league.hasPreseason}
												<p class="leading-tight">
													<DateHoverText
														display={formatSeasonPhaseBoundaryText(
															data.league.preseasonEndDate,
															'Ends',
															'Ended'
														)}
														value={data.league.preseasonEndDate}
														wrapperClass="inline"
													/>
												</p>
											{/if}
										</div>
										<div
											class="min-w-0 border-t border-secondary-200 pt-2 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-0"
										>
											<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
												Postseason
											</p>
											<p class="mt-0.5 leading-tight">
												{#if data.league.hasPostseason}
													<DateHoverText
														display={formatSeasonPhaseBoundaryText(
															data.league.postseasonStartDate,
															'Starts',
															'Started'
														)}
														value={data.league.postseasonStartDate}
														wrapperClass="inline"
													/>
												{:else}
													No postseason
												{/if}
											</p>
											{#if data.league.hasPostseason}
												<p class="leading-tight">
													<DateHoverText
														display={formatSeasonPhaseBoundaryText(
															data.league.postseasonEndDate,
															'Ends',
															'Ended'
														)}
														value={data.league.postseasonEndDate}
														wrapperClass="inline"
													/>
												</p>
											{/if}
										</div>
									</div>
								</div>
								<div class="border border-neutral-950 bg-white p-2.5">
									<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
										<div class="min-w-0">
											<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
												Team Registration
											</p>
											<p class="mt-0.5 leading-tight">
												<DateHoverText
													display={registrationWindowDetails.openText}
													value={data.league.regStartDate}
													includeTime
													wrapperClass="inline"
												/>
											</p>
											<p class="leading-tight">
												<DateHoverText
													display={registrationWindowDetails.closeText}
													value={data.league.regEndDate}
													includeTime
													wrapperClass="inline"
												/>
											</p>
										</div>
										<div
											class="min-w-0 border-t border-secondary-200 pt-2 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-0"
										>
											<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
												Join Team Deadline
											</p>
											<p class="mt-0.5 leading-tight">
												<DateHoverText
													display={joinTeamDeadlineDisplayText}
													value={joinTeamDeadline()}
													includeTime
													wrapperClass="inline"
												/>
											</p>
										</div>
									</div>
								</div>
							</div>
						{/snippet}
					</DashboardSidebarPanel>

					<DashboardSidebarPanel title="League Standings" contentClass="space-y-3 p-3">
						{#snippet content()}
							{#if visibleDivisions.length === 0}
								<p class="text-sm font-sans text-neutral-950">
									{#if hasSearchQuery}
										No divisions match this search.
									{:else}
										No divisions available yet.
									{/if}
								</p>
							{:else}
								<div class="space-y-3">
									{#each visibleDivisions as division}
										<section class="space-y-2 border border-neutral-950 bg-white p-2.5">
											<div class="flex items-start justify-between gap-3">
												<div class="min-w-0">
													<div class="flex flex-wrap items-center gap-1.5">
														<a
															href={`#division-${division.slug || division.id}`}
															class="font-serif text-lg font-bold text-neutral-950 underline-offset-2 hover:underline"
														>
															{division.name}
														</a>
														<HoverTooltip
															text={divisionLockTooltip(division)}
															wrapperClass="inline-flex shrink-0"
														>
															<span class="inline-flex text-neutral-950" aria-hidden="true">
																{#if division.isLocked}
																	<IconLock class="h-4 w-4" />
																{:else}
																	<IconLockOpen class="h-4 w-4 opacity-50" />
																{/if}
															</span>
														</HoverTooltip>
														<span class="sr-only">{division.isLocked ? 'Locked' : 'Unlocked'}</span>
														<span
															class="text-[11px] font-sans font-normal leading-tight text-neutral-950"
														>
															{divisionCapacityLabel(division)}
														</span>
													</div>
												</div>
												<button
													type="button"
													class="mt-[0.35rem] shrink-0 text-[11px] font-sans font-semibold text-neutral-700 underline underline-offset-2 hover:text-neutral-950"
												>
													View Full Standings
												</button>
											</div>
											<SmallStandingsTable
												rows={visibleDivisionStandings.get(division.id) ?? []}
												icon={HeaderIcon}
												caption={`${division.name} standings table`}
												{hasSearchQuery}
												emptySearchMessage="No standings rows match this search"
												emptyMessage={division.teamCount === 0
													? 'No teams in this division yet'
													: 'No standings posted yet'}
											/>
										</section>
									{/each}
								</div>
							{/if}
						{/snippet}
					</DashboardSidebarPanel>
				</aside>
			</div>
		{:else}
			<div class="border-2 border-neutral-950 bg-white p-6 text-sm text-neutral-950">
				League details are not available right now.
			</div>
		{/if}
	</div>
</div>
<CreateDivisionWizard
	open={createDivisionOpen}
	form={createDivisionForm}
	fieldErrors={createDivisionFieldErrors}
	formError={createDivisionFormError}
	submitting={createDivisionSubmitting}
	canSubmit={canSubmitCreateDivision}
	slugTouched={createDivisionSlugTouched}
	unsavedConfirmOpen={createDivisionUnsavedConfirmOpen}
	showLocation={false}
	showStartDate={false}
	onSlugTouchedChange={(value) => {
		createDivisionSlugTouched = value;
	}}
	onNameInput={handleCreateDivisionNameInput}
	onDayOfWeekInput={handleCreateDivisionDayOfWeekInput}
	onGameTimeInput={handleCreateDivisionGameTimeInput}
	onRequestClose={requestCloseCreateDivisionWizard}
	onSubmit={createDivision}
	onInput={clearCreateDivisionApiErrors}
	onUnsavedConfirm={closeCreateDivisionWizard}
	onUnsavedCancel={() => {
		createDivisionUnsavedConfirmOpen = false;
	}}
/>

<CreateDivisionWizard
	open={editDivisionOpen}
	form={editDivisionForm}
	fieldErrors={editDivisionFieldErrors}
	formError={editDivisionFormError}
	submitting={editDivisionSubmitting}
	canSubmit={canSubmitEditDivision}
	slugTouched={editDivisionSlugTouched}
	unsavedConfirmOpen={editDivisionUnsavedConfirmOpen}
	title="Edit Division"
	closeAriaLabel="Close edit division wizard"
	submitLabel="Save Changes"
	submittingLabel="Saving..."
	errorToastTitle="Edit division"
	onSlugTouchedChange={(value) => {
		editDivisionSlugTouched = value;
	}}
	onRequestClose={requestCloseEditDivisionWizard}
	onSubmit={editDivision}
	onInput={clearEditDivisionApiErrors}
	onUnsavedConfirm={closeEditDivisionWizard}
	onUnsavedCancel={() => {
		editDivisionUnsavedConfirmOpen = false;
	}}
/>

<CreateTeamWizard
	open={createTeamOpen}
	form={createTeamForm}
	fieldErrors={createTeamFieldErrors}
	formError={createTeamFormError}
	submitting={createTeamSubmitting}
	canSubmit={canSubmitCreateTeam}
	slugTouched={createTeamSlugTouched}
	{divisionOptions}
	selectedDivisionStatus={createTeamSelectedDivisionStatus}
	unsavedConfirmOpen={createTeamUnsavedConfirmOpen}
	onSlugTouchedChange={(value) => {
		createTeamSlugTouched = value;
	}}
	onDivisionChange={handleCreateTeamDivisionChange}
	onWaitlistChange={handleCreateTeamWaitlistChange}
	onRequestClose={requestCloseCreateTeamWizard}
	onSubmit={createTeam}
	onInput={clearCreateTeamApiErrors}
	onUnsavedConfirm={closeCreateTeamWizard}
	onUnsavedCancel={() => {
		createTeamUnsavedConfirmOpen = false;
	}}
/>

<MoveTeamWizard
	open={Boolean(moveTeamContext)}
	teamName={moveTeamContext?.name ?? ''}
	currentDivisionName={moveTeamContext?.currentDivisionName ?? ''}
	currentPlacement={moveTeamContext?.currentPlacement ?? 'active'}
	form={moveTeamForm}
	fieldErrors={moveTeamFieldErrors}
	formError={moveTeamFormError}
	submitting={moveTeamSubmitting}
	canSubmit={canSubmitMoveTeam}
	unsavedConfirmOpen={moveTeamUnsavedConfirmOpen}
	{divisionOptions}
	{placementOptions}
	onRequestClose={requestCloseMoveTeamWizard}
	onSubmit={submitMoveTeam}
	onInput={() => {
		moveTeamFormError = '';
	}}
	onUnsavedConfirm={closeMoveTeamWizard}
	onUnsavedCancel={() => {
		moveTeamUnsavedConfirmOpen = false;
	}}
/>

<ModalShell
	open={Boolean(removeModalTeam)}
	closeAriaLabel="Close delete team confirmation"
	panelClass="w-full max-w-lg border-4 border-secondary bg-neutral-400 overflow-hidden"
	on:requestClose={() => {
		if (removingTeamId) return;
		removeModalTeam = null;
	}}
>
	<div class="border-b border-secondary px-5 py-4">
		<h2 class="text-3xl font-serif font-bold text-neutral-950">Delete Team</h2>
	</div>
	<div class="space-y-4 p-5 text-sm text-neutral-950">
		<p>
			Delete <span class="font-bold">{removeModalTeam?.name ?? 'this team'}</span> from the league? This
			also clears its roster assignments and division standings entries.
		</p>
		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="button-secondary-outlined cursor-pointer"
				disabled={Boolean(removingTeamId)}
				onclick={() => {
					removeModalTeam = null;
				}}
			>
				Cancel
			</button>
			<button
				type="button"
				class="inline-flex items-center justify-center border-2 border-primary-700 bg-primary px-4 py-2 text-white cursor-pointer hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={Boolean(removingTeamId)}
				onclick={confirmRemoveTeam}
			>
				{removingTeamId ? 'Deleting...' : 'Delete Team'}
			</button>
		</div>
	</div>
</ModalShell>
