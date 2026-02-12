<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { onDestroy, tick } from 'svelte';
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
	import IconPlus from '@tabler/icons-svelte/icons/plus';
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
			offeringSlug: string;
			offeringName: string;
			categoryLabel: string;
		}>;
	}

	type RegistrationWindowState = 'upcoming' | 'open' | 'closed';
	type OfferingView = 'leagues' | 'tournaments' | 'all';
	type WizardStep = 1 | 2 | 3 | 4 | 5;

	interface WizardOfferingInput {
		name: string;
		slug: string;
		isActive: boolean;
		imageUrl: string;
		minPlayers: number;
		maxPlayers: number;
		rulebookUrl: string;
		sport: string;
		type: 'league' | 'tournament';
		description: string;
	}

	interface WizardLeagueInput {
		name: string;
		slug: string;
		description: string;
		season: string;
		gender: 'mens' | 'womens' | 'corec' | 'unified';
		skillLevel: 'competitive' | 'intermediate' | 'recreational' | 'all';
		regStartDate: string;
		regEndDate: string;
		seasonStartDate: string;
		seasonEndDate: string;
		hasPostseason: boolean;
		postseasonStartDate: string;
		postseasonEndDate: string;
		hasPreseason: boolean;
		preseasonStartDate: string;
		preseasonEndDate: string;
		isActive: boolean;
		isLocked: boolean;
		imageUrl: string;
	}

	interface WizardFormState {
		offering: WizardOfferingInput;
		league: WizardLeagueInput;
	}

	interface CreateOfferingApiResponse {
		success: boolean;
		data?: {
			offeringId: string;
			leagueId: string;
			activity: Activity;
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	const TERM_ORDER: Record<string, number> = {
		spring: 0,
		summer: 1,
		fall: 2,
		winter: 3
	};
	const OFFERING_VIEW_STORAGE_KEY = 'intramural-offerings-view-mode';
	const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
	const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
	const currentYear = new Date().getFullYear();
	const seasonPlaceholder =
		new Date().getMonth() <= 5 ? `Spring ${currentYear}` : `Fall ${currentYear}`;
	const WIZARD_STEP_TITLES: Record<WizardStep, string> = {
		1: 'Offering Basics',
		2: 'Offering Setup',
		3: 'League Basics',
		4: 'League Schedule',
		5: 'Review & Create'
	};
	const WIZARD_STEP_FIELDS: Record<WizardStep, string[]> = {
		1: ['offering.name', 'offering.slug', 'offering.sport', 'offering.type', 'offering.description'],
		2: [
			'offering.imageUrl',
			'offering.minPlayers',
			'offering.maxPlayers',
			'offering.rulebookUrl'
		],
		3: [
			'league.name',
			'league.slug',
			'league.description',
			'league.season',
			'league.gender',
			'league.skillLevel'
		],
		4: [
			'league.regStartDate',
			'league.regEndDate',
			'league.seasonStartDate',
			'league.seasonEndDate',
			'league.preseasonStartDate',
			'league.preseasonEndDate',
			'league.postseasonStartDate',
			'league.postseasonEndDate',
			'league.imageUrl',
			'league.scheduleRange'
		],
		5: []
	};

	let { data } = $props<{ data: PageData }>();

	let activities = $state<Activity[]>([]);
	let searchQuery = $state('');
	let showConcludedSeasons = $state(false);
	let offeringView = $state<OfferingView>('all');
	let offeringViewHydrated = $state(false);
	let highlightedLeagueRowId = $state<string | null>(null);
	let highlightTimeout: ReturnType<typeof setTimeout> | null = null;
	let isCreateModalOpen = $state(false);
	let createStep = $state<WizardStep>(1);
	let createSubmitting = $state(false);
	let createFormError = $state('');
	let createSuccessMessage = $state('');
	let offeringSlugTouched = $state(false);
	let leagueSlugTouched = $state(false);
	let serverFieldErrors = $state<Record<string, string>>({});
	let createForm = $state<WizardFormState>({
		offering: {
			name: '',
			slug: '',
			isActive: true,
			imageUrl: '',
			minPlayers: 0,
			maxPlayers: 0,
			rulebookUrl: '',
			sport: '',
			type: 'league',
			description: ''
		},
		league: {
			name: '',
			slug: '',
			description: '',
			season: '',
			gender: 'mens',
			skillLevel: 'competitive',
			regStartDate: '',
			regEndDate: '',
			seasonStartDate: '',
			seasonEndDate: '',
			hasPostseason: false,
			postseasonStartDate: '',
			postseasonEndDate: '',
			hasPreseason: false,
			preseasonStartDate: '',
			preseasonEndDate: '',
			isActive: true,
			isLocked: false,
			imageUrl: ''
		}
	});

	function getLeagueRowId(offeringSlug: string, leagueId: string): string {
		return `league-row-${offeringSlug}-${leagueId}`;
	}

	async function scrollToLeagueRow(offeringSlug: string, leagueId: string): Promise<void> {
		if (typeof window === 'undefined') return;
		const rowId = getLeagueRowId(offeringSlug, leagueId);

		let rowElement = document.getElementById(rowId);
		if (!rowElement && searchQuery.trim().length > 0) {
			searchQuery = '';
			await tick();
			rowElement = document.getElementById(rowId);
		}

		if (
			!rowElement &&
			concludedOfferings.some((offering) =>
				offering.leagues.some((league) => league.id === leagueId)
			)
		) {
			showConcludedSeasons = true;
			await tick();
			rowElement = document.getElementById(rowId);
		}

		if (!rowElement) return;

		rowElement.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
			inline: 'nearest'
		});

		if (highlightTimeout) clearTimeout(highlightTimeout);
		if (highlightedLeagueRowId === rowId) {
			highlightedLeagueRowId = null;
			await tick();
		}

		highlightedLeagueRowId = rowId;
		highlightTimeout = setTimeout(() => {
			if (highlightedLeagueRowId === rowId) highlightedLeagueRowId = null;
		}, 3000);
	}

	onDestroy(() => {
		if (highlightTimeout) clearTimeout(highlightTimeout);
	});

	$effect(() => {
		activities = [...(data.activities ?? [])];
	});

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

	function resetCreateWizard(): void {
		createStep = 1;
		createSubmitting = false;
		createFormError = '';
		offeringSlugTouched = false;
		leagueSlugTouched = false;
		serverFieldErrors = {};
		createForm = {
			offering: {
				name: '',
				slug: '',
				isActive: true,
				imageUrl: '',
				minPlayers: 0,
				maxPlayers: 0,
				rulebookUrl: '',
				sport: '',
				type: 'league',
				description: ''
			},
			league: {
				name: '',
				slug: '',
				description: '',
				season: '',
				gender: 'mens',
				skillLevel: 'competitive',
				regStartDate: '',
				regEndDate: '',
				seasonStartDate: '',
				seasonEndDate: '',
				hasPostseason: false,
				postseasonStartDate: '',
				postseasonEndDate: '',
				hasPreseason: false,
				preseasonStartDate: '',
				preseasonEndDate: '',
				isActive: true,
				isLocked: false,
				imageUrl: ''
			}
		};
	}

	function openCreateWizard(): void {
		resetCreateWizard();
		isCreateModalOpen = true;
	}

	function closeCreateWizard(): void {
		isCreateModalOpen = false;
		resetCreateWizard();
	}

	function clearCreateApiErrors(): void {
		if (Object.keys(serverFieldErrors).length > 0) {
			serverFieldErrors = {};
		}
		if (createFormError) {
			createFormError = '';
		}
	}

	function toDateMs(value: string): number | null {
		if (!DATE_REGEX.test(value)) return null;
		const parsed = new Date(`${value}T00:00:00.000Z`).getTime();
		return Number.isNaN(parsed) ? null : parsed;
	}

	function isValidUrl(value: string): boolean {
		try {
			const url = new URL(value);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}

	function getClientFieldErrors(values: WizardFormState): Record<string, string> {
		const errors: Record<string, string> = {};
		const offeringName = values.offering.name.trim();
		const offeringSlug = values.offering.slug.trim();
		const offeringSport = values.offering.sport.trim();
		const offeringImageUrl = values.offering.imageUrl.trim();
		const offeringRulebookUrl = values.offering.rulebookUrl.trim();
		const offeringDescription = values.offering.description.trim();
		const leagueName = values.league.name.trim();
		const leagueSlug = values.league.slug.trim();
		const leagueDescription = values.league.description.trim();
		const leagueSeason = values.league.season.trim();
		const leagueImageUrl = values.league.imageUrl.trim();

		if (!offeringName) errors['offering.name'] = 'Offering name is required.';
		if (!offeringSlug) {
			errors['offering.slug'] = 'Offering slug is required.';
		} else if (!SLUG_REGEX.test(offeringSlug)) {
			errors['offering.slug'] = 'Use lowercase letters, numbers, and dashes only.';
		}
		if (!offeringSport) errors['offering.sport'] = 'Sport is required.';
		if (!values.offering.type) errors['offering.type'] = 'Offering type is required.';
		if (!offeringDescription) errors['offering.description'] = 'Offering description is required.';
		if (!offeringImageUrl) {
			errors['offering.imageUrl'] = 'Offering image URL is required.';
		} else if (!isValidUrl(offeringImageUrl)) {
			errors['offering.imageUrl'] = 'Enter a valid image URL.';
		}

		if (!Number.isInteger(values.offering.minPlayers) || values.offering.minPlayers < 1) {
			errors['offering.minPlayers'] = 'Minimum players must be at least 1.';
		}

		if (!Number.isInteger(values.offering.maxPlayers) || values.offering.maxPlayers < 1) {
			errors['offering.maxPlayers'] = 'Maximum players must be at least 1.';
		}

		if (
			Number.isInteger(values.offering.minPlayers) &&
			Number.isInteger(values.offering.maxPlayers) &&
			values.offering.minPlayers > values.offering.maxPlayers
		) {
			errors['offering.maxPlayers'] = 'Maximum players must be greater than or equal to minimum players.';
		}

		if (!offeringRulebookUrl) {
			errors['offering.rulebookUrl'] = 'Rulebook URL is required.';
		} else if (!isValidUrl(offeringRulebookUrl)) {
			errors['offering.rulebookUrl'] = 'Enter a valid rulebook URL.';
		}

		if (!leagueName) errors['league.name'] = 'League name is required.';
		if (!leagueSlug) {
			errors['league.slug'] = 'League slug is required.';
		} else if (!SLUG_REGEX.test(leagueSlug)) {
			errors['league.slug'] = 'Use lowercase letters, numbers, and dashes only.';
		}
		if (!leagueDescription) errors['league.description'] = 'League description is required.';
		if (!leagueSeason) errors['league.season'] = 'Season is required.';
		if (!values.league.gender) errors['league.gender'] = 'Gender is required.';
		if (!values.league.skillLevel) errors['league.skillLevel'] = 'Skill level is required.';

		const regStartMs = toDateMs(values.league.regStartDate);
		const regEndMs = toDateMs(values.league.regEndDate);
		const seasonStartMs = toDateMs(values.league.seasonStartDate);
		const seasonEndMs = toDateMs(values.league.seasonEndDate);

		if (!values.league.regStartDate) {
			errors['league.regStartDate'] = 'Registration start date is required.';
		} else if (regStartMs === null) {
			errors['league.regStartDate'] = 'Use YYYY-MM-DD format.';
		}

		if (!values.league.regEndDate) {
			errors['league.regEndDate'] = 'Registration end date is required.';
		} else if (regEndMs === null) {
			errors['league.regEndDate'] = 'Use YYYY-MM-DD format.';
		}

		if (!values.league.seasonStartDate) {
			errors['league.seasonStartDate'] = 'Season start date is required.';
		} else if (seasonStartMs === null) {
			errors['league.seasonStartDate'] = 'Use YYYY-MM-DD format.';
		}

		if (!values.league.seasonEndDate) {
			errors['league.seasonEndDate'] = 'Season end date is required.';
		} else if (seasonEndMs === null) {
			errors['league.seasonEndDate'] = 'Use YYYY-MM-DD format.';
		}

		if (regStartMs !== null && regEndMs !== null && regStartMs > regEndMs) {
			errors['league.scheduleRange'] =
				'Registration end date must be on or after registration start date.';
		}

		if (regEndMs !== null && seasonStartMs !== null && regEndMs > seasonStartMs) {
			errors['league.scheduleRange'] =
				'Season start date must be on or after registration end date.';
		}

		if (seasonStartMs !== null && seasonEndMs !== null && seasonStartMs > seasonEndMs) {
			errors['league.scheduleRange'] = 'Season end date must be on or after season start date.';
		}

		const preseasonStartMs = toDateMs(values.league.preseasonStartDate);
		const preseasonEndMs = toDateMs(values.league.preseasonEndDate);
		if (values.league.hasPreseason) {
			if (!values.league.preseasonStartDate) {
				errors['league.preseasonStartDate'] = 'Preseason start date is required.';
			}
			if (!values.league.preseasonEndDate) {
				errors['league.preseasonEndDate'] = 'Preseason end date is required.';
			}
			if (
				preseasonStartMs !== null &&
				preseasonEndMs !== null &&
				preseasonStartMs > preseasonEndMs
			) {
				errors['league.preseasonEndDate'] =
					'Preseason end date must be on or after preseason start date.';
			}
			if (preseasonEndMs !== null && seasonStartMs !== null && preseasonEndMs > seasonStartMs) {
				errors['league.preseasonEndDate'] = 'Preseason must end on or before season start date.';
			}
		}

		const postseasonStartMs = toDateMs(values.league.postseasonStartDate);
		const postseasonEndMs = toDateMs(values.league.postseasonEndDate);
		if (values.league.hasPostseason) {
			if (!values.league.postseasonStartDate) {
				errors['league.postseasonStartDate'] = 'Postseason start date is required.';
			}
			if (!values.league.postseasonEndDate) {
				errors['league.postseasonEndDate'] = 'Postseason end date is required.';
			}
			if (
				postseasonStartMs !== null &&
				postseasonEndMs !== null &&
				postseasonStartMs > postseasonEndMs
			) {
				errors['league.postseasonEndDate'] =
					'Postseason end date must be on or after postseason start date.';
			}
			if (seasonEndMs !== null && postseasonStartMs !== null && postseasonStartMs < seasonEndMs) {
				errors['league.postseasonStartDate'] = 'Postseason must start on or after season end date.';
			}
		}

		if (!leagueImageUrl) {
			errors['league.imageUrl'] = 'League image URL is required.';
		} else if (!isValidUrl(leagueImageUrl)) {
			errors['league.imageUrl'] = 'Enter a valid image URL.';
		}

		return errors;
	}

	function firstInvalidStep(errors: Record<string, string>): WizardStep {
		for (const step of [1, 2, 3, 4] as const) {
			const fields = WIZARD_STEP_FIELDS[step];
			if (fields.some((field) => Boolean(errors[field]))) return step;
		}
		return 5;
	}

	function stepHasErrors(step: WizardStep, errors: Record<string, string>): boolean {
		if (step === 5) return Object.keys(errors).length > 0;
		return WIZARD_STEP_FIELDS[step].some((field) => Boolean(errors[field]));
	}

	function toServerFieldErrorMap(
		fieldErrors: Record<string, string[] | undefined> | undefined
	): Record<string, string> {
		const flattened: Record<string, string> = {};
		if (!fieldErrors) return flattened;

		for (const [key, value] of Object.entries(fieldErrors)) {
			if (Array.isArray(value) && value.length > 0 && value[0]) {
				flattened[key] = value[0];
			}
		}

		return flattened;
	}

	function normalizeDateForRequest(value: string): string {
		return value.trim();
	}

	async function submitCreateWizard(): Promise<void> {
		const clientErrors = getClientFieldErrors(createForm);
		if (Object.keys(clientErrors).length > 0) {
			createStep = firstInvalidStep(clientErrors);
			return;
		}

		createSubmitting = true;
		createFormError = '';
		serverFieldErrors = {};
		createSuccessMessage = '';

		const payload = {
			offering: {
				name: createForm.offering.name.trim(),
				slug: createForm.offering.slug.trim(),
				isActive: createForm.offering.isActive,
				imageUrl: createForm.offering.imageUrl.trim(),
				minPlayers: createForm.offering.minPlayers,
				maxPlayers: createForm.offering.maxPlayers,
				rulebookUrl: createForm.offering.rulebookUrl.trim(),
				sport: createForm.offering.sport.trim(),
				type: createForm.offering.type,
				description: createForm.offering.description.trim()
			},
			league: {
				name: createForm.league.name.trim(),
				slug: createForm.league.slug.trim(),
				description: createForm.league.description.trim(),
				season: createForm.league.season.trim(),
				gender: createForm.league.gender,
				skillLevel: createForm.league.skillLevel,
				regStartDate: normalizeDateForRequest(createForm.league.regStartDate),
				regEndDate: normalizeDateForRequest(createForm.league.regEndDate),
				seasonStartDate: normalizeDateForRequest(createForm.league.seasonStartDate),
				seasonEndDate: normalizeDateForRequest(createForm.league.seasonEndDate),
				hasPostseason: createForm.league.hasPostseason,
				postseasonStartDate: createForm.league.hasPostseason
					? normalizeDateForRequest(createForm.league.postseasonStartDate)
					: null,
				postseasonEndDate: createForm.league.hasPostseason
					? normalizeDateForRequest(createForm.league.postseasonEndDate)
					: null,
				hasPreseason: createForm.league.hasPreseason,
				preseasonStartDate: createForm.league.hasPreseason
					? normalizeDateForRequest(createForm.league.preseasonStartDate)
					: null,
				preseasonEndDate: createForm.league.hasPreseason
					? normalizeDateForRequest(createForm.league.preseasonEndDate)
					: null,
				isActive: createForm.league.isActive,
				isLocked: createForm.league.isLocked,
				imageUrl: createForm.league.imageUrl.trim()
			}
		};

		try {
			const response = await fetch('/api/intramural-sports/offerings', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			let body: CreateOfferingApiResponse | null = null;
			try {
				body = (await response.json()) as CreateOfferingApiResponse;
			} catch {
				body = null;
			}

			if (!response.ok || !body?.success || !body.data?.activity) {
				serverFieldErrors = toServerFieldErrorMap(body?.fieldErrors);
				const combinedErrors = {
					...getClientFieldErrors(createForm),
					...serverFieldErrors
				};
				createStep = firstInvalidStep(combinedErrors);
				createFormError = body?.error || 'Unable to save offering right now.';
				return;
			}

			activities = [body.data.activity, ...activities];
			offeringView = 'all';
			searchQuery = '';
			createSuccessMessage = 'Offering and league created successfully.';
			closeCreateWizard();
		} catch {
			createFormError = 'Unable to save offering right now.';
		} finally {
			createSubmitting = false;
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

	function buildCategoryLabel(activity: Activity): string {
		const gender = normalizeGender(activity.gender ?? null);
		if (gender) return gender;
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
			const offeringKey = splitByOfferingType
				? `${offeringName}::${activity.offeringType}`
				: offeringName;
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
				const waitlistedCount = offerings.reduce(
					(sum, offering) => sum + offering.waitlistedCount,
					0
				);
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
		activities.filter(
			(activity: Activity) => activity.isActive && activity.offeringType !== 'tournament'
		)
	);

	const tournamentActivities = $derived.by(() =>
		activities.filter(
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
					offeringSlug: offering.offeringSlug,
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
	const clientCreateFieldErrors = $derived.by(() => getClientFieldErrors(createForm));
	const createFieldErrors = $derived.by(() => ({
		...clientCreateFieldErrors,
		...serverFieldErrors
	}));
	const canGoNextStep = $derived.by(() => !stepHasErrors(createStep, createFieldErrors));
	const canSubmitCreate = $derived.by(
		() => createStep === 5 && Object.keys(createFieldErrors).length === 0 && !createSubmitting
	);
	const createStepProgress = $derived.by(() => Math.round((createStep / 5) * 100));

	function nextCreateStep(): void {
		clearCreateApiErrors();
		if (createStep === 5 || !canGoNextStep) return;
		createStep = (createStep + 1) as WizardStep;
	}

	function previousCreateStep(): void {
		clearCreateApiErrors();
		if (createStep === 1) return;
		createStep = (createStep - 1) as WizardStep;
	}

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
			<div class="flex items-center justify-start xl:justify-end">
				<button
					type="button"
					class="button-accent px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-2 cursor-pointer"
					onclick={openCreateWizard}
				>
					<IconPlus class="w-4 h-4" />
					Add offering
				</button>
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

	{#if createSuccessMessage}
		<div class="bg-primary-100 border-2 border-primary-500 text-neutral-950 p-4">
			<p class="font-sans text-sm">{createSuccessMessage}</p>
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
				<div class="p-4 border-b border-secondary-300 bg-neutral-600/66 space-y-3">
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
												{@const rowId = getLeagueRowId(offering.offeringSlug, league.id)}
												<tr
													id={rowId}
													class={`align-middle ${leagueIndex < offering.leagues.length - 1 ? 'border-b border-secondary-200' : ''} ${leagueIndex % 2 === 0 ? 'bg-neutral-25' : 'bg-neutral-05'}`}
													class:league-row-highlight={highlightedLeagueRowId === rowId}
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
																{@const rowId = getLeagueRowId(offering.offeringSlug, league.id)}
																<tr
																	id={rowId}
																	class={`align-middle ${leagueIndex < offering.leagues.length - 1 ? 'border-b border-secondary-200' : ''} ${leagueIndex % 2 === 0 ? 'bg-neutral-25' : 'bg-neutral-05'}`}
																	class:league-row-highlight={highlightedLeagueRowId === rowId}
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
					<div
						class="p-4 border-b border-secondary-300 bg-neutral-600/66 flex items-center justify-between"
					>
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
											<button
												type="button"
												class="badge-secondary-outlined text-xs cursor-pointer transition-colors duration-150 hover:bg-secondary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500"
												onclick={() => {
													void scrollToLeagueRow(league.offeringSlug, league.id);
												}}
											>
												{league.offeringName} - {league.categoryLabel}
											</button>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>

				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300 bg-neutral-600/66">
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

{#if isCreateModalOpen}
	<div
		class="fixed inset-0 bg-black/55 z-50 flex items-start justify-center p-5 lg:p-8 overflow-y-auto"
		onclick={closeCreateWizard}
		onkeydown={(event) => {
			if (event.key === 'Escape') closeCreateWizard();
		}}
		role="button"
		tabindex="0"
		aria-label="Close create offering modal"
	>
		<div
			class="w-full max-w-5xl border-4 border-secondary bg-neutral-400"
			onclick={(event) => event.stopPropagation()}
			role="presentation"
		>
			<div class="p-4 border-b border-secondary space-y-3">
				<div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<h2 class="text-3xl font-bold font-serif text-neutral-950">New Intramural Offering</h2>
						<p class="text-sm font-sans text-neutral-950">
							Step {createStep} of 5: {WIZARD_STEP_TITLES[createStep]}
						</p>
					</div>
					<button
						type="button"
						class="button-secondary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer"
						onclick={closeCreateWizard}
					>
						Close
					</button>
				</div>
				<div class="border border-secondary-300 bg-white h-3">
					<div class="h-full bg-secondary" style={`width: ${createStepProgress}%`}></div>
				</div>
			</div>

			<form
				class="p-4 space-y-5"
				onsubmit={(event) => {
					event.preventDefault();
					void submitCreateWizard();
				}}
				oninput={clearCreateApiErrors}
			>
				{#if createFormError}
					<div class="border-2 border-error-300 bg-error-50 p-3">
						<p class="text-error-800 text-sm font-sans">{createFormError}</p>
					</div>
				{/if}

				{#if createStep === 1}
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div>
							<label for="offering-name" class="block text-sm font-sans text-neutral-950 mb-1"
								>Offering name</label
							>
							<input
								id="offering-name"
								type="text"
								class="input-secondary"
								value={createForm.offering.name}
								placeholder="Basketball"
								oninput={(event) => {
									const value = (event.currentTarget as HTMLInputElement).value;
									createForm.offering.name = value;
									if (!offeringSlugTouched) {
										createForm.offering.slug = slugify(value);
									}
								}}
								autocomplete="off"
							/>
							{#if createFieldErrors['offering.name']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.name']}</p>
							{/if}
						</div>

						<div>
							<label for="offering-slug" class="block text-sm font-sans text-neutral-950 mb-1"
								>Offering slug</label
							>
							<input
								id="offering-slug"
								type="text"
								class="input-secondary"
								value={createForm.offering.slug}
								placeholder="basketball"
								oninput={(event) => {
									offeringSlugTouched = true;
									createForm.offering.slug = slugify(
										(event.currentTarget as HTMLInputElement).value
									);
								}}
								autocomplete="off"
							/>
							{#if createFieldErrors['offering.slug']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.slug']}</p>
							{/if}
						</div>

						<div>
							<label for="offering-sport" class="block text-sm font-sans text-neutral-950 mb-1"
								>Sport</label
							>
							<input
								id="offering-sport"
								type="text"
								class="input-secondary"
								bind:value={createForm.offering.sport}
								placeholder="Basketball"
								autocomplete="off"
							/>
							{#if createFieldErrors['offering.sport']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.sport']}</p>
							{/if}
						</div>

						<div>
							<label for="offering-type" class="block text-sm font-sans text-neutral-950 mb-1"
								>Offering type</label
							>
							<select
								id="offering-type"
								class="select-secondary"
								bind:value={createForm.offering.type}
							>
								<option value="league">League</option>
								<option value="tournament">Tournament</option>
							</select>
							{#if createFieldErrors['offering.type']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.type']}</p>
							{/if}
						</div>

						<div class="lg:col-span-2">
							<label for="offering-description" class="block text-sm font-sans text-neutral-950 mb-1"
								>Offering description</label
							>
							<textarea
								id="offering-description"
								class="textarea-secondary min-h-28"
								bind:value={createForm.offering.description}
								placeholder="Describe this offering."
							></textarea>
							{#if createFieldErrors['offering.description']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.description']}</p>
							{/if}
						</div>
					</div>
				{/if}

				{#if createStep === 2}
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div>
							<label for="offering-min-players" class="block text-sm font-sans text-neutral-950 mb-1"
								>Minimum players</label
							>
							<input
								id="offering-min-players"
								type="number"
								class="input-secondary"
								min="1"
								step="1"
								value={createForm.offering.minPlayers > 0
									? String(createForm.offering.minPlayers)
									: ''}
								oninput={(event) => {
									const parsed = Number.parseInt(
										(event.currentTarget as HTMLInputElement).value,
										10
									);
									createForm.offering.minPlayers = Number.isNaN(parsed) ? 0 : parsed;
								}}
							/>
							{#if createFieldErrors['offering.minPlayers']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.minPlayers']}</p>
							{/if}
						</div>

						<div>
							<label for="offering-max-players" class="block text-sm font-sans text-neutral-950 mb-1"
								>Maximum players</label
							>
							<input
								id="offering-max-players"
								type="number"
								class="input-secondary"
								min="1"
								step="1"
								value={createForm.offering.maxPlayers > 0
									? String(createForm.offering.maxPlayers)
									: ''}
								oninput={(event) => {
									const parsed = Number.parseInt(
										(event.currentTarget as HTMLInputElement).value,
										10
									);
									createForm.offering.maxPlayers = Number.isNaN(parsed) ? 0 : parsed;
								}}
							/>
							{#if createFieldErrors['offering.maxPlayers']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.maxPlayers']}</p>
							{/if}
						</div>

						<div>
							<label for="offering-image-url" class="block text-sm font-sans text-neutral-950 mb-1"
								>Offering image URL</label
							>
							<input
								id="offering-image-url"
								type="url"
								class="input-secondary"
								bind:value={createForm.offering.imageUrl}
								placeholder="https://example.com/offering-image.jpg"
								autocomplete="off"
							/>
							{#if createFieldErrors['offering.imageUrl']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.imageUrl']}</p>
							{/if}
						</div>

						<div>
							<label for="offering-rulebook-url" class="block text-sm font-sans text-neutral-950 mb-1"
								>Rulebook URL</label
							>
							<input
								id="offering-rulebook-url"
								type="url"
								class="input-secondary"
								bind:value={createForm.offering.rulebookUrl}
								placeholder="https://example.com/rules"
								autocomplete="off"
							/>
							{#if createFieldErrors['offering.rulebookUrl']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.rulebookUrl']}</p>
							{/if}
						</div>

						<div class="lg:col-span-2 border border-secondary-300 bg-white p-3">
							<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
								<input
									type="checkbox"
									class="toggle-secondary"
									bind:checked={createForm.offering.isActive}
								/>
								Offering is active
							</label>
						</div>
					</div>
				{/if}

				{#if createStep === 3}
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div>
							<label for="league-name" class="block text-sm font-sans text-neutral-950 mb-1"
								>League name</label
							>
							<input
								id="league-name"
								type="text"
								class="input-secondary"
								value={createForm.league.name}
								placeholder="Men's"
								oninput={(event) => {
									const value = (event.currentTarget as HTMLInputElement).value;
									createForm.league.name = value;
									if (!leagueSlugTouched) {
										createForm.league.slug = slugify(value);
									}
								}}
								autocomplete="off"
							/>
							{#if createFieldErrors['league.name']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.name']}</p>
							{/if}
						</div>

						<div>
							<label for="league-slug" class="block text-sm font-sans text-neutral-950 mb-1"
								>League slug</label
							>
							<input
								id="league-slug"
								type="text"
								class="input-secondary"
								value={createForm.league.slug}
								placeholder="basketball-mens-spring-2026"
								oninput={(event) => {
									leagueSlugTouched = true;
									createForm.league.slug = slugify(
										(event.currentTarget as HTMLInputElement).value
									);
								}}
								autocomplete="off"
							/>
							{#if createFieldErrors['league.slug']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.slug']}</p>
							{/if}
						</div>

						<div>
							<label for="league-season" class="block text-sm font-sans text-neutral-950 mb-1"
								>Season</label
							>
							<input
								id="league-season"
								type="text"
								class="input-secondary"
								bind:value={createForm.league.season}
								placeholder={seasonPlaceholder}
								autocomplete="off"
							/>
							<p class="text-xs text-neutral-950 mt-1">
								Short answer text. Example: <span class="font-semibold">{seasonPlaceholder}</span>.
							</p>
							{#if createFieldErrors['league.season']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.season']}</p>
							{/if}
						</div>

						<div>
							<label for="league-gender" class="block text-sm font-sans text-neutral-950 mb-1"
								>Gender</label
							>
							<select
								id="league-gender"
								class="select-secondary"
								bind:value={createForm.league.gender}
							>
								<option value="mens">Men's</option>
								<option value="womens">Women's</option>
								<option value="corec">CoRec</option>
								<option value="unified">Unified</option>
							</select>
							{#if createFieldErrors['league.gender']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.gender']}</p>
							{/if}
						</div>

						<div>
							<label for="league-skill-level" class="block text-sm font-sans text-neutral-950 mb-1"
								>Skill level</label
							>
							<select
								id="league-skill-level"
								class="select-secondary"
								bind:value={createForm.league.skillLevel}
							>
								<option value="competitive">Competitive</option>
								<option value="intermediate">Intermediate</option>
								<option value="recreational">Recreational</option>
								<option value="all">All</option>
							</select>
							{#if createFieldErrors['league.skillLevel']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.skillLevel']}</p>
							{/if}
						</div>

						<div class="lg:col-span-2">
							<label for="league-description" class="block text-sm font-sans text-neutral-950 mb-1"
								>League description</label
							>
							<textarea
								id="league-description"
								class="textarea-secondary min-h-28"
								bind:value={createForm.league.description}
								placeholder="Describe this league."
							></textarea>
							{#if createFieldErrors['league.description']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.description']}</p>
							{/if}
						</div>
					</div>
				{/if}

				{#if createStep === 4}
					<div class="space-y-4">
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<div>
								<label for="league-reg-start" class="block text-sm font-sans text-neutral-950 mb-1"
									>Registration start date</label
								>
								<input
									id="league-reg-start"
									type="date"
									class="input-secondary"
									bind:value={createForm.league.regStartDate}
								/>
								{#if createFieldErrors['league.regStartDate']}
									<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.regStartDate']}</p>
								{/if}
							</div>
							<div>
								<label for="league-reg-end" class="block text-sm font-sans text-neutral-950 mb-1"
									>Registration end date</label
								>
								<input
									id="league-reg-end"
									type="date"
									class="input-secondary"
									bind:value={createForm.league.regEndDate}
								/>
								{#if createFieldErrors['league.regEndDate']}
									<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.regEndDate']}</p>
								{/if}
							</div>
							<div>
								<label for="league-season-start" class="block text-sm font-sans text-neutral-950 mb-1"
									>Season start date</label
								>
								<input
									id="league-season-start"
									type="date"
									class="input-secondary"
									bind:value={createForm.league.seasonStartDate}
								/>
								{#if createFieldErrors['league.seasonStartDate']}
									<p class="text-xs text-error-700 mt-1">
										{createFieldErrors['league.seasonStartDate']}
									</p>
								{/if}
							</div>
							<div>
								<label for="league-season-end" class="block text-sm font-sans text-neutral-950 mb-1"
									>Season end date</label
								>
								<input
									id="league-season-end"
									type="date"
									class="input-secondary"
									bind:value={createForm.league.seasonEndDate}
								/>
								{#if createFieldErrors['league.seasonEndDate']}
									<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.seasonEndDate']}</p>
								{/if}
							</div>
						</div>

						{#if createFieldErrors['league.scheduleRange']}
							<p class="text-xs text-error-700">{createFieldErrors['league.scheduleRange']}</p>
						{/if}

						<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<div class="border border-secondary-300 bg-white p-3 space-y-3">
								<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
									<input
										type="checkbox"
										class="toggle-secondary"
										bind:checked={createForm.league.hasPreseason}
										onchange={() => {
											if (!createForm.league.hasPreseason) {
												createForm.league.preseasonStartDate = '';
												createForm.league.preseasonEndDate = '';
											}
										}}
									/>
									Has preseason
								</label>
								{#if createForm.league.hasPreseason}
									<div class="space-y-3">
										<div>
											<label
												for="league-preseason-start"
												class="block text-sm font-sans text-neutral-950 mb-1">Preseason start</label
											>
											<input
												id="league-preseason-start"
												type="date"
												class="input-secondary"
												bind:value={createForm.league.preseasonStartDate}
											/>
											{#if createFieldErrors['league.preseasonStartDate']}
												<p class="text-xs text-error-700 mt-1">
													{createFieldErrors['league.preseasonStartDate']}
												</p>
											{/if}
										</div>
										<div>
											<label
												for="league-preseason-end"
												class="block text-sm font-sans text-neutral-950 mb-1">Preseason end</label
											>
											<input
												id="league-preseason-end"
												type="date"
												class="input-secondary"
												bind:value={createForm.league.preseasonEndDate}
											/>
											{#if createFieldErrors['league.preseasonEndDate']}
												<p class="text-xs text-error-700 mt-1">
													{createFieldErrors['league.preseasonEndDate']}
												</p>
											{/if}
										</div>
									</div>
								{/if}
							</div>

							<div class="border border-secondary-300 bg-white p-3 space-y-3">
								<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
									<input
										type="checkbox"
										class="toggle-secondary"
										bind:checked={createForm.league.hasPostseason}
										onchange={() => {
											if (!createForm.league.hasPostseason) {
												createForm.league.postseasonStartDate = '';
												createForm.league.postseasonEndDate = '';
											}
										}}
									/>
									Has postseason
								</label>
								{#if createForm.league.hasPostseason}
									<div class="space-y-3">
										<div>
											<label
												for="league-postseason-start"
												class="block text-sm font-sans text-neutral-950 mb-1">Postseason start</label
											>
											<input
												id="league-postseason-start"
												type="date"
												class="input-secondary"
												bind:value={createForm.league.postseasonStartDate}
											/>
											{#if createFieldErrors['league.postseasonStartDate']}
												<p class="text-xs text-error-700 mt-1">
													{createFieldErrors['league.postseasonStartDate']}
												</p>
											{/if}
										</div>
										<div>
											<label
												for="league-postseason-end"
												class="block text-sm font-sans text-neutral-950 mb-1">Postseason end</label
											>
											<input
												id="league-postseason-end"
												type="date"
												class="input-secondary"
												bind:value={createForm.league.postseasonEndDate}
											/>
											{#if createFieldErrors['league.postseasonEndDate']}
												<p class="text-xs text-error-700 mt-1">
													{createFieldErrors['league.postseasonEndDate']}
												</p>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						</div>

						<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<div class="border border-secondary-300 bg-white p-3">
								<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
									<input type="checkbox" class="toggle-secondary" bind:checked={createForm.league.isActive} />
									League is active
								</label>
							</div>
							<div class="border border-secondary-300 bg-white p-3">
								<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
									<input type="checkbox" class="toggle-secondary" bind:checked={createForm.league.isLocked} />
									League is locked
								</label>
							</div>
						</div>

						<div>
							<label for="league-image-url" class="block text-sm font-sans text-neutral-950 mb-1"
								>League image URL</label
							>
							<input
								id="league-image-url"
								type="url"
								class="input-secondary"
								bind:value={createForm.league.imageUrl}
								placeholder="https://example.com/league-image.jpg"
								autocomplete="off"
							/>
							{#if createFieldErrors['league.imageUrl']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.imageUrl']}</p>
							{/if}
						</div>
					</div>
				{/if}

				{#if createStep === 5}
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div class="border-2 border-secondary-300 bg-white p-4 space-y-2">
							<h3 class="text-lg font-bold font-serif text-neutral-950">Offering</h3>
							<p class="text-sm text-neutral-950"><span class="font-semibold">Name:</span> {createForm.offering.name}</p>
							<p class="text-sm text-neutral-950"><span class="font-semibold">Slug:</span> {createForm.offering.slug}</p>
							<p class="text-sm text-neutral-950"><span class="font-semibold">Sport:</span> {createForm.offering.sport}</p>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Type:</span>
								{createForm.offering.type === 'tournament' ? 'Tournament' : 'League'}
							</p>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Players:</span>
								{createForm.offering.minPlayers} - {createForm.offering.maxPlayers}
							</p>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Year:</span>
								Auto: {currentYear}
							</p>
						</div>
						<div class="border-2 border-secondary-300 bg-white p-4 space-y-2">
							<h3 class="text-lg font-bold font-serif text-neutral-950">League</h3>
							<p class="text-sm text-neutral-950"><span class="font-semibold">Name:</span> {createForm.league.name}</p>
							<p class="text-sm text-neutral-950"><span class="font-semibold">Slug:</span> {createForm.league.slug}</p>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Season:</span>
								{createForm.league.season}
							</p>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Gender / Skill:</span>
								{normalizeGender(createForm.league.gender) ?? createForm.league.gender} / {toTitleCase(
									createForm.league.skillLevel
								)}
							</p>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Registration:</span>
								{createForm.league.regStartDate} to {createForm.league.regEndDate}
							</p>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Season range:</span>
								{createForm.league.seasonStartDate} to {createForm.league.seasonEndDate}
							</p>
						</div>
					</div>
				{/if}

				<div class="pt-2 border-t border-secondary-300 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<button type="button" class="button-secondary cursor-pointer" onclick={closeCreateWizard}>
						Cancel
					</button>
					<div class="flex items-center gap-2 justify-end">
						{#if createStep > 1}
							<button
								type="button"
								class="button-secondary-outlined cursor-pointer"
								onclick={previousCreateStep}
							>
								Back
							</button>
						{/if}
						{#if createStep < 5}
							<button
								type="button"
								class="button-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								onclick={nextCreateStep}
								disabled={!canGoNextStep}
							>
								Next
							</button>
						{:else}
							<button
								type="submit"
								class="button-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
								disabled={!canSubmitCreate}
							>
								<IconPlus class="w-4 h-4" />
								{createSubmitting ? 'Creating...' : 'Create Offering'}
							</button>
						{/if}
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	:global(tr.league-row-highlight > th),
	:global(tr.league-row-highlight > td) {
		animation: league-row-highlight-fade 3s linear;
	}

	@keyframes league-row-highlight-fade {
		0% {
			background-color: transparent;
		}
		4% {
			background-color: rgb(0 0 0 / 0.2);
		}
		37% {
			background-color: rgb(0 0 0 / 0.2);
		}
		100% {
			background-color: transparent;
		}
	}
</style>
