<script lang="ts">
	import { replaceState } from '$app/navigation';
	import type { PageData } from './$types';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconBallAmericanFootball from '@tabler/icons-svelte/icons/ball-american-football';
	import IconBallBaseball from '@tabler/icons-svelte/icons/ball-baseball';
	import IconBallBasketball from '@tabler/icons-svelte/icons/ball-basketball';
	import IconBallFootball from '@tabler/icons-svelte/icons/ball-football';
	import IconBallTennis from '@tabler/icons-svelte/icons/ball-tennis';
	import IconBallVolleyball from '@tabler/icons-svelte/icons/ball-volleyball';
	import IconCalendar from '@tabler/icons-svelte/icons/calendar';
	import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down';
	import IconChevronUp from '@tabler/icons-svelte/icons/chevron-up';
	import IconCrosshair from '@tabler/icons-svelte/icons/crosshair';
	import IconSearch from '@tabler/icons-svelte/icons/search';
	import IconShip from '@tabler/icons-svelte/icons/ship';
	import IconTarget from '@tabler/icons-svelte/icons/target';
	import IconX from '@tabler/icons-svelte/icons/x';

	type Activity = PageData['activities'][number];
	type OfferingStatus = 'open' | 'waitlisted' | 'closed';

	interface LeagueOffering {
		id: string;
		leagueName: string;
		categoryLabel: string;
		divisionCount: number;
		status: OfferingStatus;
		statusLabel: 'Open' | 'Waitlist' | 'Closed';
		teamRegistrationOpenText: string;
		teamRegistrationCloseText: string;
		teamRegistrationDate: string | null;
		teamRegistrationCloseDate: string | null;
		joinTeamText: string;
		joinTeamDate: string | null;
		seasonRangeText: string;
		seasonConcluded: boolean;
	}

	interface OfferingGroup {
		offeringName: string;
		offeringSlug: string;
		offeringType: 'league' | 'tournament';
		divisionCount: number;
		openCount: number;
		waitlistedCount: number;
		closedCount: number;
		leagues: LeagueOffering[];
	}

	interface SemesterBoard {
		key: string;
		label: string;
		yearSort: number;
		termSort: number;
		offerings: OfferingGroup[];
		totalOfferings: number;
		totalLeagues: number;
		totalDivisions: number;
		openCount: number;
		waitlistedCount: number;
		closedCount: number;
	}

	interface DeadlineGroup {
		id: string;
		deadlineDate: string;
		deadlineText: string;
		leagues: Array<{
			id: string;
			offeringName: string;
			categoryLabel: string;
		}>;
	}

	type RegistrationWindowState = 'upcoming' | 'open' | 'closed';
	type OfferingView = 'leagues' | 'tournaments' | 'all';

	const TERM_ORDER: Record<string, number> = {
		spring: 0,
		summer: 1,
		fall: 2,
		winter: 3
	};
	const OFFERING_VIEW_STORAGE_KEY = 'intramural-offerings-view-mode';

	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');
	let showConcludedSeasons = $state(false);
	let offeringView = $state<OfferingView>('all');
	let offeringViewHydrated = $state(false);

	function isOfferingView(value: string | null): value is OfferingView {
		return value === 'leagues' || value === 'tournaments' || value === 'all';
	}

	function readStoredOfferingView(): OfferingView | null {
		if (typeof window === 'undefined') return null;
		try {
			const saved = window.localStorage.getItem(OFFERING_VIEW_STORAGE_KEY);
			const normalizedSavedView = saved === 'sports' ? 'leagues' : saved;
			return isOfferingView(normalizedSavedView) ? normalizedSavedView : null;
		} catch {
			return null;
		}
	}

	function writeStoredOfferingView(value: OfferingView): void {
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.setItem(OFFERING_VIEW_STORAGE_KEY, value);
		} catch {
			// Ignore storage quota/privacy errors; URL still persists the selected view.
		}
	}

	function parseDate(value: string | null): Date | null {
		if (!value) return null;
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}

	function toTitleCase(value: string): string {
		return value
			.split(/[\s_-]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
			.join(' ');
	}

	function slugify(value: string): string {
		return value
			.toLowerCase()
			.trim()
			.replace(/['"]/g, '')
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function normalizeSearch(value: string): string {
		return value.toLowerCase().replace(/[^a-z0-9]/g, '');
	}

	function pluralize(count: number, singular: string, plural: string): string {
		return count === 1 ? singular : plural;
	}

	function formatDate(value: string | null): string {
		const parsed = parseDate(value);
		if (!parsed) return 'TBD';
		const currentYear = new Date().getFullYear();
		const includeYear = parsed.getFullYear() !== currentYear;
		return parsed.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			...(includeYear ? { year: 'numeric' } : {}),
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatDeadlineDate(value: string | null): string {
		const parsed = parseDate(value);
		if (!parsed) return 'TBD';
		const currentYear = new Date().getFullYear();
		const includeYear = parsed.getFullYear() !== currentYear;
		const datePortion = parsed.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			...(includeYear ? { year: 'numeric' } : {})
		});
		return `${datePortion}, 11:59 PM`;
	}

	function formatRange(start: string | null, end: string | null): string {
		const parsedStart = parseDate(start);
		const parsedEnd = parseDate(end);
		if (parsedStart && parsedEnd) {
			const currentYear = new Date().getFullYear();
			const sameYear = parsedStart.getFullYear() === parsedEnd.getFullYear();
			const includeStartYear = sameYear ? false : true;
			const includeEndYear = sameYear ? parsedEnd.getFullYear() !== currentYear : true;
			const startLabel = parsedStart.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				...(includeStartYear ? { year: 'numeric' } : {})
			});
			const endLabel = parsedEnd.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				...(includeEndYear ? { year: 'numeric' } : {})
			});
			return `${startLabel} - ${endLabel}`;
		}
		if (parsedStart) return `Starts ${formatDate(start)}`;
		if (parsedEnd) return `Ends ${formatDate(end)}`;
		return 'Season dates TBD';
	}

	function normalizeGender(value: string | null): string | null {
		if (!value) return null;
		const normalized = value.trim().toLowerCase();
		if (normalized === 'mens' || normalized === 'men' || normalized === 'male') return "Men's";
		if (normalized === 'womens' || normalized === 'women' || normalized === 'female')
			return "Women's";
		if (
			normalized === 'coed' ||
			normalized === 'co-ed' ||
			normalized === 'corec' ||
			normalized === 'co-rec'
		)
			return 'CoRec';
		if (normalized === 'unified') return 'Unified';
		if (normalized === 'open') return 'Open';
		return toTitleCase(value);
	}

	function normalizeSkill(value: string | null): string | null {
		if (!value) return null;
		const normalized = value.trim().toLowerCase();
		if (normalized === 'rec' || normalized === 'recreational') return 'Recreational';
		if (normalized === 'comp' || normalized === 'competitive') return 'Competitive';
		if (normalized === 'intermediate') return 'Intermediate';
		if (normalized === 'advanced') return 'Advanced';
		if (normalized === 'beginner') return 'Beginner';
		if (normalized === 'all') return null;
		return toTitleCase(value);
	}

	function buildCategoryLabel(activity: Activity): string {
		const gender = normalizeGender(activity.gender ?? null);
		const skill = normalizeSkill(activity.skillLevel ?? null);
		if (gender && skill) return `${gender} ${skill}`;
		if (gender) return gender;
		if (skill) return skill;
		return activity.leagueName;
	}

	function getSemesterMeta(activity: Activity): {
		key: string;
		label: string;
		yearSort: number;
		termSort: number;
	} {
		let season = activity.season?.trim() ?? '';
		let year = activity.year ?? null;

		if ((!season || !year) && activity.seasonLabel) {
			const match = activity.seasonLabel.match(/(spring|summer|fall|winter)\s+(\d{4})/i);
			if (match) {
				season = match[1];
				year = Number(match[2]);
			}
		}

		if (!season) season = 'Unscheduled';
		const seasonTitle = toTitleCase(season);
		const safeYear = year ?? 0;
		const key = `${seasonTitle.toLowerCase()}-${safeYear}`;
		const label = safeYear > 0 ? `${seasonTitle} ${safeYear}` : seasonTitle;

		return {
			key,
			label,
			yearSort: safeYear,
			termSort: TERM_ORDER[seasonTitle.toLowerCase()] ?? 99
		};
	}

	function getRegistrationWindowInfo(
		activity: Activity,
		now: Date
	): {
		openText: string;
		closeText: string;
		anchorDate: string | null;
		closeDate: string | null;
		windowState: RegistrationWindowState;
	} {
		const regStart = parseDate(activity.registrationStart);
		const regEnd = parseDate(activity.registrationEnd);
		const nowMs = now.getTime();
		const hasStarted = regStart ? regStart.getTime() <= nowMs : false;
		const hasClosed = regEnd ? regEnd.getTime() < nowMs : false;

		const windowState: RegistrationWindowState = hasClosed
			? 'closed'
			: hasStarted
				? 'open'
				: 'upcoming';
		const openText = regStart
			? hasStarted
				? `Opened ${formatDeadlineDate(activity.registrationStart)}`
				: `Opens ${formatDeadlineDate(activity.registrationStart)}`
			: 'Opens TBD';
		const closeText = regEnd
			? hasClosed
				? `Closed ${formatDeadlineDate(activity.registrationEnd)}`
				: `Closes ${formatDeadlineDate(activity.registrationEnd)}`
			: 'Closes TBD';

		return {
			openText,
			closeText,
			anchorDate: activity.registrationEnd ?? activity.registrationStart ?? null,
			closeDate: activity.registrationEnd ?? null,
			windowState
		};
	}

	function getOfferingStatus(
		activity: Activity,
		windowState: RegistrationWindowState
	): OfferingStatus {
		if (!activity.isActive || windowState !== 'open') return 'closed';

		const noCapacity = activity.spotsRemaining !== null && activity.spotsRemaining <= 0;
		if (noCapacity || activity.isLocked) return 'waitlisted';

		return 'open';
	}

	function getJoinTeamInfo(activity: Activity): { text: string; date: string | null } {
		const seasonStart = parseDate(activity.seasonStart);
		const regEnd = parseDate(activity.registrationEnd);
		let joinDeadline: string | null = null;

		if (seasonStart && regEnd) {
			joinDeadline =
				seasonStart.getTime() >= regEnd.getTime() ? activity.seasonStart : activity.registrationEnd;
		} else {
			joinDeadline = activity.seasonStart ?? activity.registrationEnd ?? null;
		}

		if (!joinDeadline) return { text: 'Join team deadline TBD', date: null };
		return { text: `Join by ${formatDeadlineDate(joinDeadline)}`, date: joinDeadline };
	}

	function computeStatusCounts(leagues: LeagueOffering[]): {
		openCount: number;
		waitlistedCount: number;
		closedCount: number;
	} {
		const openCount = leagues.filter((league) => league.status === 'open').length;
		const waitlistedCount = leagues.filter((league) => league.status === 'waitlisted').length;
		const closedCount = leagues.filter((league) => league.status === 'closed').length;

		return {
			openCount,
			waitlistedCount,
			closedCount
		};
	}

	function isLeagueSeasonConcluded(league: LeagueOffering): boolean {
		return league.seasonConcluded;
	}

	function isOfferingConcluded(offering: OfferingGroup): boolean {
		return offering.leagues.length > 0 && offering.leagues.every(isLeagueSeasonConcluded);
	}

	function sortOfferingsByName(a: OfferingGroup, b: OfferingGroup): number {
		const nameDiff = a.offeringName.localeCompare(b.offeringName);
		if (nameDiff !== 0) return nameDiff;
		if (a.offeringType === b.offeringType) return 0;
		return a.offeringType === 'league' ? -1 : 1;
	}

	function offeringIconFor(offeringName: string) {
		const key = offeringName.trim().toLowerCase();
		if (key.includes('flag football')) return IconBallAmericanFootball;
		if (key.includes('basketball')) return IconBallBasketball;
		if (key.includes('soccer')) return IconBallFootball;
		if (key.includes('volleyball')) return IconBallVolleyball;
		if (key.includes('spikeball')) return IconCrosshair;
		if (key.includes('pickleball')) return IconBallTennis;
		if (key.includes('cornhole')) return IconTarget;
		if (key.includes('battleship')) return IconShip;
		if (key.includes('softball')) return IconBallBaseball;
		if (key.includes('hockey')) return IconTarget;
		return IconBallFootball;
	}

	function columnHeaderFor(group: OfferingGroup, column: 'league' | 'registration' | 'range') {
		if (column === 'league') return group.offeringType === 'tournament' ? 'Group' : 'League';
		if (column === 'registration')
			return group.offeringType === 'tournament' ? 'Tournament Registration' : 'Team Registration';
		return group.offeringType === 'tournament' ? 'Tournament Date(s)' : 'Season Date Range';
	}

	function entryLabelFor(group: OfferingGroup): 'league' | 'group' {
		return group.offeringType === 'tournament' ? 'group' : 'league';
	}

	function buildBoards(source: Activity[], splitByOfferingType = false): SemesterBoard[] {
		const now = new Date();
		const semesterMap = new Map<
			string,
			{
				key: string;
				label: string;
				yearSort: number;
				termSort: number;
				offerings: Map<string, OfferingGroup>;
			}
		>();

		for (const activity of source) {
			const semester = getSemesterMeta(activity);
			if (!semesterMap.has(semester.key)) {
				semesterMap.set(semester.key, {
					...semester,
					offerings: new Map<string, OfferingGroup>()
				});
			}

			const bucket = semesterMap.get(semester.key);
			if (!bucket) continue;

			const offeringName = activity.offeringName?.trim() || 'General Recreation';
			const offeringKey = splitByOfferingType ? `${offeringName}::${activity.offeringType}` : offeringName;
			if (!bucket.offerings.has(offeringKey)) {
				bucket.offerings.set(offeringKey, {
					offeringName,
					offeringSlug: `offering-${slugify(offeringName)}-${activity.offeringType}-${semester.key}`,
					offeringType: activity.offeringType,
					divisionCount: 0,
					openCount: 0,
					waitlistedCount: 0,
					closedCount: 0,
					leagues: []
				});
			}

			const offeringGroup = bucket.offerings.get(offeringKey);
			if (!offeringGroup) continue;

			const registrationWindow = getRegistrationWindowInfo(activity, now);
			const status = getOfferingStatus(activity, registrationWindow.windowState);
			const joinTeam = getJoinTeamInfo(activity);
			const categoryLabel = buildCategoryLabel(activity);
			const seasonEndMs = parseDate(activity.seasonEnd)?.getTime() ?? Number.POSITIVE_INFINITY;

			const leagueOffering: LeagueOffering = {
				id: activity.id,
				leagueName: activity.leagueName,
				categoryLabel,
				divisionCount: activity.divisionCount ?? 0,
				status,
				statusLabel: status === 'open' ? 'Open' : status === 'waitlisted' ? 'Waitlist' : 'Closed',
				teamRegistrationOpenText: registrationWindow.openText,
				teamRegistrationCloseText: registrationWindow.closeText,
				teamRegistrationDate: registrationWindow.anchorDate,
				teamRegistrationCloseDate: registrationWindow.closeDate,
				joinTeamText: joinTeam.text,
				joinTeamDate: joinTeam.date,
				seasonRangeText: formatRange(activity.seasonStart, activity.seasonEnd),
				seasonConcluded: seasonEndMs < now.getTime()
			};

			offeringGroup.leagues.push(leagueOffering);
			offeringGroup.divisionCount += activity.divisionCount ?? 0;
			if (status === 'open') offeringGroup.openCount += 1;
			if (status === 'waitlisted') offeringGroup.waitlistedCount += 1;
			if (status === 'closed') offeringGroup.closedCount += 1;
		}

		const boards = Array.from(semesterMap.values())
			.map((bucket) => {
				const offerings = Array.from(bucket.offerings.values())
					.map((offering) => ({
						...offering,
						leagues: offering.leagues.sort((a, b) => {
							const category = a.categoryLabel.localeCompare(b.categoryLabel);
							if (category !== 0) return category;

							const league = a.leagueName.localeCompare(b.leagueName);
							if (league !== 0) return league;

							const aDate =
								parseDate(a.teamRegistrationDate)?.getTime() ?? Number.POSITIVE_INFINITY;
							const bDate =
								parseDate(b.teamRegistrationDate)?.getTime() ?? Number.POSITIVE_INFINITY;
							return aDate - bDate;
						})
					}))
					.sort(sortOfferingsByName);

				const openCount = offerings.reduce((sum, offering) => sum + offering.openCount, 0);
				const waitlistedCount = offerings.reduce((sum, offering) => sum + offering.waitlistedCount, 0);
				const closedCount = offerings.reduce((sum, offering) => sum + offering.closedCount, 0);
				const totalLeagues = offerings.reduce((sum, offering) => sum + offering.leagues.length, 0);
				const totalDivisions = offerings.reduce((sum, offering) => sum + offering.divisionCount, 0);

				return {
					key: bucket.key,
					label: bucket.label,
					yearSort: bucket.yearSort,
					termSort: bucket.termSort,
					offerings,
					totalOfferings: offerings.length,
					totalLeagues,
					totalDivisions,
					openCount,
					waitlistedCount,
					closedCount
				} satisfies SemesterBoard;
			})
			.sort((a, b) => {
				if (a.yearSort !== b.yearSort) return b.yearSort - a.yearSort;
				if (a.termSort !== b.termSort) return a.termSort - b.termSort;
				return a.label.localeCompare(b.label);
			});

		return boards;
	}

	const showTournaments = $derived.by(() => offeringView === 'tournaments');
	const showAllOfferings = $derived.by(() => offeringView === 'all');
	const offeringTypeLabel = $derived.by(() => {
		if (showTournaments) return 'Tournaments';
		if (showAllOfferings) return 'Offerings';
		return 'Leagues';
	});

	const leagueActivities = $derived.by(() =>
		(data.activities ?? []).filter(
			(activity: Activity) => activity.isActive && activity.offeringType !== 'tournament'
		)
	);

	const tournamentActivities = $derived.by(() =>
		(data.activities ?? []).filter(
			(activity: Activity) => activity.isActive && activity.offeringType === 'tournament'
		)
	);

	const semesterBoards = $derived.by(() => {
		if (showTournaments) return buildBoards(tournamentActivities);
		if (showAllOfferings) {
			return buildBoards([...leagueActivities, ...tournamentActivities], true);
		}
		return buildBoards(leagueActivities);
	});

	$effect(() => {
		offeringView;
		showConcludedSeasons = false;
	});

	$effect(() => {
		if (offeringViewHydrated || typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		const fromUrl = url.searchParams.get('view');
		const normalizedUrlView = fromUrl === 'sports' ? 'leagues' : fromUrl;
		if (isOfferingView(normalizedUrlView)) {
			offeringView = normalizedUrlView;
		} else {
			const savedView = readStoredOfferingView();
			if (savedView) {
				offeringView = savedView;
			} else {
				offeringView = 'all';
			}
		}
		offeringViewHydrated = true;
	});

	$effect(() => {
		if (!offeringViewHydrated || typeof window === 'undefined') return;
		writeStoredOfferingView(offeringView);
		const url = new URL(window.location.href);
		if (url.searchParams.get('view') !== offeringView) {
			url.searchParams.set('view', offeringView);
			try {
				// Firefox can throw quota errors when cloning large existing history.state objects.
				replaceState(`${url.pathname}${url.search}${url.hash}`, {});
			} catch {
				// Ignore history state errors in restrictive browser modes.
			}
		}
	});

	const currentSemester = $derived.by(() => semesterBoards[0] ?? null);
	const activeSemester = $derived.by(() => currentSemester);
	const badgeOfferingCount = $derived.by(() => {
		if (!activeSemester) return 0;
		return new Set(activeSemester.offerings.map((offering) => offering.offeringName)).size;
	});
	const badgeLeagueOrGroupCount = $derived.by(() => {
		if (!activeSemester) return 0;
		return activeSemester.totalLeagues;
	});
	const badgeLeagueOrGroupLabel = $derived.by(() => {
		if (showTournaments) return pluralize(badgeLeagueOrGroupCount, 'group', 'groups');
		if (showAllOfferings)
			return pluralize(badgeLeagueOrGroupCount, 'league/group', 'leagues/groups');
		return pluralize(badgeLeagueOrGroupCount, 'league', 'leagues');
	});

	const visibleOfferings = $derived.by(() => {
		if (!activeSemester) return [];
		const query = normalizeSearch(searchQuery.trim());
		if (!query) {
			return activeSemester.offerings
				.map((offering) => ({
					...offering,
					...computeStatusCounts(offering.leagues)
				}))
				.sort(sortOfferingsByName);
		}

		return activeSemester.offerings
			.map((offering) => {
				let leagues = offering.leagues;
				if (!normalizeSearch(offering.offeringName).includes(query)) {
					leagues = offering.leagues.filter((league) => {
						const normalizedText = normalizeSearch(
							[
								offering.offeringName,
								league.categoryLabel,
								league.leagueName,
								league.teamRegistrationOpenText,
								league.teamRegistrationCloseText,
								league.joinTeamText
							].join(' ')
						);
						return normalizedText.includes(query);
					});
				}

				if (leagues.length === 0) return null;
				return {
					...offering,
					leagues,
					...computeStatusCounts(leagues)
				};
			})
			.filter((offering): offering is OfferingGroup => Boolean(offering))
			.sort(sortOfferingsByName);
	});

	const activeDeadlines = $derived.by(() => {
		if (!activeSemester) return [] as DeadlineGroup[];
		const nowMs = new Date().getTime();
		const grouped = new Map<string, DeadlineGroup>();

		for (const offering of activeSemester.offerings) {
			for (const league of offering.leagues) {
				const deadlineDate = league.teamRegistrationCloseDate;
				if (!deadlineDate) continue;
				const deadlineMs = parseDate(deadlineDate)?.getTime();
				if (deadlineMs === undefined || deadlineMs === null || deadlineMs < nowMs) continue;

				if (!grouped.has(deadlineDate)) {
					grouped.set(deadlineDate, {
						id: `deadline-${deadlineDate}`,
						deadlineDate,
						deadlineText: formatDeadlineDate(deadlineDate),
						leagues: []
					});
				}

				const bucket = grouped.get(deadlineDate);
				if (!bucket) continue;
				bucket.leagues.push({
					id: league.id,
					offeringName: offering.offeringName,
					categoryLabel: league.categoryLabel
				});
			}
		}

		return Array.from(grouped.values())
			.sort((a, b) => {
				const aMs = parseDate(a.deadlineDate)?.getTime() ?? Number.POSITIVE_INFINITY;
				const bMs = parseDate(b.deadlineDate)?.getTime() ?? Number.POSITIVE_INFINITY;
				return aMs - bMs;
			})
			.slice(0, 8);
	});

	const nonConcludedOfferings = $derived.by(() =>
		visibleOfferings.filter((offering) => !isOfferingConcluded(offering))
	);
	const concludedOfferings = $derived.by(() =>
		visibleOfferings.filter((offering) => isOfferingConcluded(offering))
	);

	function statusClass(status: OfferingStatus): string {
		if (status === 'open') return 'badge-primary';
		if (status === 'waitlisted') return 'badge-primary-outlined';
		return 'badge-secondary-outlined';
	}
</script>

<svelte:head>
	<title>Intramural Sports - PlayIMs</title>
	<meta
		name="description"
		content="View intramural tournament offerings by semester with leagues, registration status, and deadlines."
	/>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
	<header class="border-2 border-secondary-300 bg-neutral p-5 space-y-4">
		<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
			<div class="flex items-start gap-4">
				<div
					class="bg-primary text-white w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
					aria-hidden="true"
				>
					<IconBallFootball class="w-7 h-7 lg:w-8 lg:h-8" />
				</div>
				<div>
					<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
						Intramural Sports
					</h1>
				</div>
			</div>
		</div>
	</header>

	{#if data.error}
		<div class="bg-accent-100 border-2 border-accent-500 text-neutral-950 p-4">
			<div class="flex items-center gap-3">
				<IconAlertTriangle class="w-6 h-6 text-accent-700" />
				<p class="font-sans">{data.error}</p>
			</div>
		</div>
	{/if}

	{#if semesterBoards.length === 0}
		<section class="border-2 border-secondary-300 bg-neutral p-6 space-y-4">
			<div class="text-center">
				<div class="bg-secondary p-3 inline-flex mb-3" aria-hidden="true">
					<IconBallFootball class="w-7 h-7 text-white" />
				</div>
				<h2 class="text-2xl font-bold font-serif text-neutral-950">
					No
					{showTournaments ? 'tournament' : 'offering'}
					offerings yet
				</h2>
				<p class="text-sm text-neutral-950 font-sans mt-1">
					Add or enable leagues/tournaments to populate this view.
				</p>
			</div>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-hidden="true">
				<div class="border border-secondary-300 bg-white p-4 space-y-3">
					<div class="h-4 bg-neutral-100 animate-pulse w-2/5"></div>
					<div class="h-3 bg-neutral-100 animate-pulse w-full"></div>
					<div class="h-3 bg-neutral-100 animate-pulse w-5/6"></div>
					<div class="h-3 bg-neutral-100 animate-pulse w-3/4"></div>
				</div>
				<div class="border border-secondary-300 bg-white p-4 space-y-3">
					<div class="h-4 bg-neutral-100 animate-pulse w-1/3"></div>
					<div class="h-3 bg-neutral-100 animate-pulse w-full"></div>
					<div class="h-3 bg-neutral-100 animate-pulse w-4/5"></div>
					<div class="h-3 bg-neutral-100 animate-pulse w-2/3"></div>
				</div>
			</div>
		</section>
	{:else}
		<div class="grid grid-cols-1 xl:grid-cols-[1.6fr_0.7fr] gap-6">
			<section class="border-2 border-secondary-300 bg-neutral">
				<div class="p-4 border-b border-secondary-300 bg-neutral-500 space-y-3">
					<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
						<div class="flex items-center gap-2">
							<h2 class="text-2xl font-bold font-serif text-neutral-950">
								{activeSemester?.label ?? ''}
							</h2>
							<label class="sr-only" for="offering-view">Offering type</label>
							<select
								id="offering-view"
								class="select-secondary w-auto min-w-36 py-1 text-sm"
								bind:value={offeringView}
							>
								<option value="leagues">Leagues</option>
								<option value="tournaments">Tournaments</option>
								<option value="all">All</option>
							</select>
						</div>
						<div class="flex items-center gap-2 text-xs text-neutral-950 font-sans">
							<span class="border border-secondary-300 px-2 py-1">
								{badgeOfferingCount}
								{pluralize(badgeOfferingCount, 'offering', 'offerings')}
							</span>
							<span class="border border-secondary-300 px-2 py-1">
								{badgeLeagueOrGroupCount}
								{badgeLeagueOrGroupLabel}
							</span>
						</div>
					</div>
					<div class="relative">
						<IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950" />
						<label class="sr-only" for="tournament-search">Search offerings and deadlines</label>
						<input
							id="tournament-search"
							type="text"
							class="input-secondary pl-10 pr-10 py-1 text-sm"
							autocomplete="off"
							placeholder={`Search offering, ${showTournaments ? 'group' : showAllOfferings ? 'league/group' : 'league'}, or deadline`}
							bind:value={searchQuery}
						/>
						{#if searchQuery.trim().length > 0}
							<button
								type="button"
								class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-950 hover:text-secondary-900 cursor-pointer"
								aria-label="Clear search"
								onclick={() => {
									searchQuery = '';
								}}
							>
								<IconX class="w-4 h-4" />
							</button>
						{/if}
					</div>
				</div>

				{#if visibleOfferings.length === 0}
					<div class="p-8 text-center">
						<p class="text-sm text-neutral-950 font-sans">
							No {offeringTypeLabel.toLowerCase()} match this search for this semester.
						</p>
					</div>
				{:else}
					<div class="divide-y divide-secondary-300">
						{#each nonConcludedOfferings as offering}
							<article id={offering.offeringSlug} class="p-4 space-y-3">
								<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
									<div>
										<div class="flex items-center gap-2">
											<h3 class="text-2xl font-bold font-serif text-neutral-950">
												{offering.offeringName}
											</h3>
											{#if showAllOfferings}
												<span
													class="badge-secondary-outlined text-[10px] uppercase tracking-wide px-1.5 py-0 self-center"
												>
													{offering.offeringType === 'tournament' ? 'Tournament' : 'League'}
												</span>
											{/if}
										</div>
										<p class="text-xs text-neutral-950 font-sans">
											{offering.leagues.length}
											{entryLabelFor(offering)} offer{offering.leagues.length === 1
												? 'ing'
												: 'ings'}
										</p>
									</div>
									<div class="flex flex-wrap items-center gap-1">
										<span class="badge-primary text-xs uppercase tracking-wide"
											>{offering.openCount} Open</span
										>
										<span class="badge-primary-outlined text-xs uppercase tracking-wide">
											{offering.waitlistedCount} Waitlist
										</span>
										<span class="badge-secondary-outlined text-xs uppercase tracking-wide">
											{offering.closedCount} Closed
										</span>
									</div>
								</div>

								<div class="border border-secondary-300 bg-white overflow-x-auto">
									<table class="min-w-full border-collapse">
										<thead>
											<tr class="border-b border-secondary-300 bg-neutral">
												<th
													scope="col"
													class="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 px-2 py-1 min-w-48"
												>
													{columnHeaderFor(offering, 'league')}
												</th>
												<th
													scope="col"
													class="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 px-2 py-1 min-w-24"
												>
													Status
												</th>
												<th
													scope="col"
													class="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 px-2 py-1 min-w-44"
												>
													{columnHeaderFor(offering, 'registration')}
												</th>
												<th
													scope="col"
													class="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 px-2 py-1 min-w-40"
												>
													Join Team Deadline
												</th>
												<th
													scope="col"
													class="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 px-2 py-1 min-w-44"
												>
													{columnHeaderFor(offering, 'range')}
												</th>
											</tr>
										</thead>
										<tbody>
											{#each offering.leagues as league, leagueIndex}
												{@const OfferingIcon = offeringIconFor(offering.offeringName)}
												<tr
													class={`align-middle ${leagueIndex < offering.leagues.length - 1 ? 'border-b border-secondary-200' : ''} ${leagueIndex % 2 === 0 ? 'bg-neutral-25' : 'bg-neutral-05'}`}
												>
													<th scope="row" class="px-2 py-1 text-left">
														<div class="flex items-center gap-2">
															<div
																class="w-9 h-9 bg-primary text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors hover:bg-primary-700"
																aria-hidden="true"
															>
																<OfferingIcon class="w-6 h-6" />
															</div>
															<div>
																<p
																	class="text-sm font-bold text-neutral-950 font-sans hover:underline cursor-pointer"
																>
																	{league.categoryLabel}
																</p>
															</div>
														</div>
													</th>
													<td class="px-2 py-1">
														<span
															class={`${statusClass(league.status)} text-xs uppercase tracking-wide`}
														>
															{league.statusLabel}
														</span>
													</td>
													<td class="px-2 py-1">
														<p class="text-xs text-neutral-950 font-sans">
															{league.teamRegistrationOpenText}
														</p>
														<p class="text-xs text-neutral-950 font-sans mt-1">
															{league.teamRegistrationCloseText}
														</p>
													</td>
													<td class="px-2 py-1 align-top">
														<p class="text-xs text-neutral-950 font-sans">
															{league.joinTeamText}
														</p>
													</td>
													<td class="px-2 py-1 align-top">
														{#if league.seasonConcluded}
															<p
																class="text-xs text-secondary-800 font-bold uppercase tracking-wide"
															>
																Concluded
															</p>
														{/if}
														<p class="text-xs text-neutral-950 font-sans mt-1">
															{league.seasonRangeText}
														</p>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</article>
						{/each}

						{#if concludedOfferings.length > 0}
							<section class="p-4 space-y-3">
								<button
									type="button"
									class="w-full button-secondary-outlined px-3 py-2 justify-between text-left"
									onclick={() => {
										showConcludedSeasons = !showConcludedSeasons;
									}}
									aria-expanded={showConcludedSeasons}
								>
									<span
										class="text-sm font-bold font-sans text-neutral-950 uppercase tracking-wide"
									>
										Concluded Offerings ({concludedOfferings.length})
									</span>
									{#if showConcludedSeasons}
										<IconChevronUp class="w-5 h-5 text-secondary-900" />
									{:else}
										<IconChevronDown class="w-5 h-5 text-secondary-900" />
									{/if}
								</button>

								{#if showConcludedSeasons}
									<div class="divide-y divide-secondary-300 border border-secondary-300">
										{#each concludedOfferings as offering}
											<article id={offering.offeringSlug} class="p-4 space-y-3 bg-neutral">
												<div
													class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
												>
													<div>
														<div class="flex items-center gap-2">
															<h3 class="text-2xl font-bold font-serif text-neutral-950">
																{offering.offeringName}
															</h3>
															{#if showAllOfferings}
																<span
																	class="badge-secondary-outlined text-[10px] uppercase tracking-wide px-1 py-0 self-center"
																>
																	{offering.offeringType === 'tournament' ? 'Tournament' : 'League'}
																</span>
															{/if}
														</div>
														<p class="text-xs text-neutral-950 font-sans">
															{offering.leagues.length}
															{entryLabelFor(offering)} offer{offering.leagues.length === 1
																? 'ing'
																: 'ings'}
														</p>
													</div>
													<div class="flex flex-wrap items-center gap-1">
														<span class="badge-secondary text-xs uppercase tracking-wide">
															Concluded
														</span>
													</div>
												</div>

												<div class="border border-secondary-300 bg-white overflow-x-auto">
													<table class="min-w-full border-collapse">
														<thead>
															<tr class="border-b border-secondary-300 bg-neutral">
																<th
																	scope="col"
																	class="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 px-2 py-1 min-w-48"
																>
																	{columnHeaderFor(offering, 'league')}
																</th>
																<th
																	scope="col"
																	class="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 px-2 py-1 min-w-24"
																>
																	Status
																</th>
																<th
																	scope="col"
																	class="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 px-2 py-1 min-w-44"
																>
																	{columnHeaderFor(offering, 'registration')}
																</th>
																<th
																	scope="col"
																	class="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 px-2 py-1 min-w-40"
																>
																	Join Team Deadline
																</th>
																<th
																	scope="col"
																	class="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 px-2 py-1 min-w-44"
																>
																	{columnHeaderFor(offering, 'range')}
																</th>
															</tr>
														</thead>
														<tbody>
															{#each offering.leagues as league, leagueIndex}
																{@const OfferingIcon = offeringIconFor(offering.offeringName)}
																<tr
																	class={`align-middle ${leagueIndex < offering.leagues.length - 1 ? 'border-b border-secondary-200' : ''} ${leagueIndex % 2 === 0 ? 'bg-neutral-25' : 'bg-neutral-05'}`}
																>
																	<th scope="row" class="px-2 py-1 text-left">
																		<div class="flex items-center gap-2">
																			<div
																				class="w-9 h-9 bg-primary text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors hover:bg-primary-700"
																				aria-hidden="true"
																			>
																				<OfferingIcon class="w-6 h-6" />
																			</div>
																			<div>
																				<p
																					class="text-sm font-bold text-neutral-950 font-sans hover:underline cursor-pointer"
																				>
																					{league.categoryLabel}
																				</p>
																			</div>
																		</div>
																	</th>
																	<td class="px-2 py-1">
																		<span
																			class={`${statusClass(league.status)} text-xs uppercase tracking-wide`}
																		>
																			{league.statusLabel}
																		</span>
																	</td>
																	<td class="px-2 py-1">
																		<p class="text-xs text-neutral-950 font-sans">
																			{league.teamRegistrationOpenText}
																		</p>
																		<p class="text-xs text-neutral-950 font-sans mt-1">
																			{league.teamRegistrationCloseText}
																		</p>
																	</td>
																	<td class="px-2 py-1 align-top">
																		<p class="text-xs text-neutral-950 font-sans">
																			{league.joinTeamText}
																		</p>
																	</td>
																	<td class="px-2 py-1 align-top">
																		{#if league.seasonConcluded}
																			<p
																				class="text-xs text-secondary-800 font-bold uppercase tracking-wide"
																			>
																				Concluded
																			</p>
																		{/if}
																		<p class="text-xs text-neutral-950 font-sans mt-1">
																			{league.seasonRangeText}
																		</p>
																	</td>
																</tr>
															{/each}
														</tbody>
													</table>
												</div>
											</article>
										{/each}
									</div>
								{/if}
							</section>
						{/if}
					</div>
				{/if}
			</section>

			<aside class="space-y-6">
				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300 flex items-center justify-between">
						<h2 class="text-xl font-bold font-serif text-neutral-950">Upcoming Deadlines</h2>
						<IconCalendar class="w-5 h-5 text-secondary-700" />
					</div>
					{#if activeDeadlines.length === 0}
						<div class="p-4">
							<p class="text-sm text-neutral-950 font-sans">No deadlines available.</p>
						</div>
					{:else}
						<div class="divide-y divide-secondary-300">
							{#each activeDeadlines as deadline, deadlineIndex}
								<div class={`p-3 ${deadlineIndex % 2 === 0 ? 'bg-neutral-25' : 'bg-neutral-05'}`}>
									<p class="text-sm font-semibold text-neutral-950 font-sans">
										Registration Deadline: {deadline.deadlineText}
									</p>
									<div class="mt-2 flex flex-wrap gap-1">
										{#each deadline.leagues as league}
											<span class="badge-secondary-outlined text-xs">
												{league.offeringName} - {league.categoryLabel}
											</span>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>

				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300">
						<h2 class="text-xl font-bold font-serif text-neutral-950">Semester Snapshot</h2>
					</div>
					<div class="p-4 grid grid-cols-3 gap-2">
						<div class="card-secondary-outlined">
							<p class="text-[11px] uppercase tracking-wide text-neutral-950 font-bold">
								Offerings
							</p>
							<p class="text-2xl font-bold font-serif text-neutral-950">
								{activeSemester?.totalOfferings ?? 0}
							</p>
						</div>
						<div class="card-secondary-outlined">
							<p class="text-[11px] uppercase tracking-wide text-neutral-950 font-bold">
								{showTournaments ? 'Groups' : showAllOfferings ? 'Leagues/Groups' : 'Leagues'}
							</p>
							<p class="text-2xl font-bold font-serif text-neutral-950">
								{activeSemester?.totalLeagues ?? 0}
							</p>
						</div>
						<div class="card-secondary-outlined">
							<p class="text-[11px] uppercase tracking-wide text-neutral-950 font-bold">
								Divisions
							</p>
							<p class="text-2xl font-bold font-serif text-neutral-950">
								{activeSemester?.totalDivisions ?? 0}
							</p>
						</div>
						<div class="card-primary-outlined">
							<p class="text-[11px] uppercase tracking-wide text-primary-700 font-bold">Open</p>
							<p class="text-2xl font-bold font-serif text-primary-700">
								{activeSemester?.openCount ?? 0}
							</p>
						</div>
						<div class="card-primary-outlined">
							<p class="text-[11px] uppercase tracking-wide text-primary-700 font-bold">Waitlist</p>
							<p class="text-2xl font-bold font-serif text-primary-700">
								{activeSemester?.waitlistedCount ?? 0}
							</p>
						</div>
						<div class="card-secondary-outlined">
							<p class="text-[11px] uppercase tracking-wide text-secondary-900 font-bold">Closed</p>
							<p class="text-2xl font-bold font-serif text-secondary-900">
								{activeSemester?.closedCount ?? 0}
							</p>
						</div>
					</div>
				</section>
			</aside>
		</div>
	{/if}
</div>


