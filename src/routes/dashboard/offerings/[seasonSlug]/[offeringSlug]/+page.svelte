<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import {
		adjustEditingIndexOnRemove,
		adjustEditingIndexOnReorder,
		applyLiveSlugInput,
		duplicateCollectionItem,
		isRequiredFieldMessage,
		moveCollectionItemByOffset,
		pickFieldErrors,
		removeCollectionItem,
		slugifyFinal,
		toServerFieldErrorMap,
		WizardDraftCollection,
		WizardStepFooter
	} from '$lib/components/wizard';
	import CreateLeagueWizard from '../../_wizards/CreateLeagueWizard.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import OfferingsTable from '$lib/components/OfferingsTable.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import SplitAddAction from '$lib/components/dashboard/SplitAddAction.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import type { OfferingsTableColumn } from '$lib/components/offerings-table.js';
	import { toast } from '$lib/toasts';
	import { generateUuidV4 } from '$lib/utils/uuid.js';
	import {
		IconBallAmericanFootball,
		IconBallBaseball,
		IconBallBasketball,
		IconBallFootball,
		IconBallTennis,
		IconBallVolleyball,
		IconCopy,
		IconCrosshair,
		IconLock,
		IconLockOpen,
		IconPencil,
		IconRestore,
		IconShip,
		IconTarget
	} from '@tabler/icons-svelte';

	type OfferingLeagueRow = NonNullable<PageData['leagues']>[number];
	type OfferingDivisionRow = OfferingLeagueRow['divisions'][number];
	type OfferingType = 'league' | 'tournament';
	type LeagueWizardStep = 1 | 2 | 3 | 4;
	type LeagueGender = '' | 'male' | 'female' | 'mixed';
	type LeagueSkillLevel = '' | 'competitive' | 'intermediate' | 'recreational' | 'all';

	interface DropdownOption {
		value: string;
		label: string;
		statusLabel?: string;
		separatorBefore?: boolean;
		disabled?: boolean;
		tooltip?: string;
		disabledTooltip?: string;
	}

	interface SelectedWizardOffering {
		id: string;
		name: string;
		type: OfferingType;
		isActive: boolean;
	}

	interface LeagueTemplate {
		id: string;
		offeringId: string;
		seasonId: string;
		name: string;
		slug: string;
		description: string | null;
		gender: string | null;
		skillLevel: string | null;
		regStartDate: string | null;
		regEndDate: string | null;
		seasonStartDate: string | null;
		seasonEndDate: string | null;
		hasPostseason: boolean;
		postseasonStartDate: string | null;
		postseasonEndDate: string | null;
		hasPreseason: boolean;
		preseasonStartDate: string | null;
		preseasonEndDate: string | null;
		isActive: boolean;
		isLocked: boolean;
		imageUrl: string | null;
		stackOrder: number | null;
	}

	interface WizardLeagueInput {
		draftId: string;
		name: string;
		slug: string;
		stackOrder: number;
		isSlugManual: boolean;
		description: string;
		seasonId: string;
		gender: LeagueGender;
		skillLevel: LeagueSkillLevel;
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

	interface LeagueWizardFormState {
		offeringId: string;
		league: WizardLeagueInput;
		leagues: WizardLeagueInput[];
	}

	interface CreateLeagueApiResponse {
		success: boolean;
		data?: {
			offeringId: string;
			leagueIds: string[];
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
	const DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
	const FORM_DROPDOWN_BUTTON_CLASS =
		'w-full border-2 border-secondary-400 bg-white px-4 py-2 text-base leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)] disabled:cursor-not-allowed disabled:opacity-60';

	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');
	let isCreateLeagueModalOpen = $state(false);
	let createLeagueWizardUnsavedConfirmOpen = $state(false);
	let createLeagueStep = $state<LeagueWizardStep>(1);
	let createLeagueSubmitting = $state(false);
	let createLeagueFormError = $state('');
	let createLeagueEditingIndex = $state<number | null>(null);
	let createLeagueDraftActive = $state(false);
	let createLeagueSlugTouched = $state(false);
	let createLeagueServerFieldErrors = $state<Record<string, string>>({});
	let createLeagueForm = $state<LeagueWizardFormState>({
		offeringId: '',
		league: {
			draftId: '',
			name: '',
			slug: '',
			stackOrder: 1,
			isSlugManual: false,
			description: '',
			seasonId: '',
			gender: '',
			skillLevel: '',
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
		},
		leagues: []
	});

	function normalizeAuthRole(
		value: string | null | undefined
	): 'participant' | 'manager' | 'admin' | 'dev' {
		const normalized = value?.trim().toLowerCase();
		if (normalized === 'manager' || normalized === 'admin' || normalized === 'dev') {
			return normalized;
		}
		return 'participant';
	}

	const canManageOffering = $derived.by(() => {
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

	function toTitleCase(value: string | null | undefined): string | null {
		const normalized = value?.trim();
		if (!normalized) return null;
		return normalized
			.split(/[\s_-]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function offeringType(): OfferingType {
		return data.offering?.type?.trim().toLowerCase() === 'tournament' ? 'tournament' : 'league';
	}

	function entryUnitSingular(): 'league' | 'group' {
		return offeringType() === 'tournament' ? 'group' : 'league';
	}

	function entryUnitPlural(): 'leagues' | 'groups' {
		return offeringType() === 'tournament' ? 'groups' : 'leagues';
	}

	function entryUnitTitleSingular(): 'League' | 'Group' {
		return offeringType() === 'tournament' ? 'Group' : 'League';
	}

	function createLeagueDraftId(): string {
		return generateUuidV4();
	}

	function todayDateString(): string {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function defaultDateTimeValue(type: 'start' | 'end'): string {
		return `${todayDateString()}T${type === 'start' ? '00:00' : '23:59'}`;
	}

	function defaultLeagueNamePlaceholder(isTournament: boolean): string {
		return isTournament ? 'Pool A' : "Men's";
	}

	function defaultLeagueSlug(leagueName: string, offeringName: string): string {
		void offeringName;
		return slugifyFinal(leagueName);
	}

	function defaultLeagueSlugPlaceholder(input: {
		leagueName: string;
		offeringName: string;
		isTournament: boolean;
	}): string {
		const fallbackLeagueName = defaultLeagueNamePlaceholder(input.isTournament);
		const resolvedLeagueName = input.leagueName.trim() || fallbackLeagueName;
		const resolvedOfferingName = input.offeringName.trim();
		const slug = defaultLeagueSlug(resolvedLeagueName, resolvedOfferingName);
		if (slug) return slug;
		return input.isTournament ? 'pool-a' : 'mens-league';
	}

	function pluralize(count: number, singular: string, plural: string): string {
		return count === 1 ? singular : plural;
	}

	function wizardEntryStepTitle(step: LeagueWizardStep): string {
		if (step === 1) return `${entryUnitTitleSingular()} Setup`;
		if (step === 2) return `${entryUnitTitleSingular()} Basics`;
		if (step === 3) return `${entryUnitTitleSingular()} Schedule`;
		return 'Review & Create';
	}

	function getSeasonLabel(): string {
		return data.season?.name?.trim() || 'Season';
	}

	function normalizeLeagueGender(value: string | null): LeagueGender {
		if (value === 'male' || value === 'female' || value === 'mixed') return value;
		return '';
	}

	function normalizeLeagueSkillLevel(value: string | null): LeagueSkillLevel {
		if (
			value === 'competitive' ||
			value === 'intermediate' ||
			value === 'recreational' ||
			value === 'all'
		) {
			return value;
		}
		return '';
	}

	function displayLeagueGender(value: string | null | undefined): string | null {
		if (!value) return null;
		if (value === 'male') return 'Male';
		if (value === 'female') return 'Female';
		if (value === 'mixed') return 'Mixed';
		return toTitleCase(value);
	}

	function createEmptyLeague(): WizardLeagueInput {
		return {
			draftId: createLeagueDraftId(),
			name: '',
			slug: '',
			stackOrder: 1,
			isSlugManual: false,
			description: '',
			seasonId: data.season?.id ?? '',
			gender: '',
			skillLevel: '',
			regStartDate: defaultDateTimeValue('start'),
			regEndDate: defaultDateTimeValue('end'),
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
		};
	}

	function createEmptyCreateLeagueForm(): LeagueWizardFormState {
		return {
			offeringId: data.offering?.id ?? '',
			league: createEmptyLeague(),
			leagues: []
		};
	}

	function resetCreateLeagueWizard(): void {
		createLeagueStep = 1;
		createLeagueSubmitting = false;
		createLeagueFormError = '';
		createLeagueWizardUnsavedConfirmOpen = false;
		createLeagueEditingIndex = null;
		createLeagueDraftActive = false;
		createLeagueSlugTouched = false;
		createLeagueServerFieldErrors = {};
		createLeagueForm = createEmptyCreateLeagueForm();
	}

	function hasLeagueDraftData(values: WizardLeagueInput): boolean {
		return (
			values.name.trim().length > 0 ||
			values.slug.trim().length > 0 ||
			values.description.trim().length > 0 ||
			values.gender.length > 0 ||
			values.skillLevel.length > 0 ||
			values.regStartDate.trim().length > 0 ||
			values.regEndDate.trim().length > 0 ||
			values.seasonStartDate.trim().length > 0 ||
			values.seasonEndDate.trim().length > 0 ||
			values.hasPreseason ||
			values.preseasonStartDate.trim().length > 0 ||
			values.preseasonEndDate.trim().length > 0 ||
			values.hasPostseason ||
			values.postseasonStartDate.trim().length > 0 ||
			values.postseasonEndDate.trim().length > 0 ||
			!values.isActive ||
			values.isLocked ||
			values.imageUrl.trim().length > 0
		);
	}

	function hasUnsavedCreateLeagueWizardChanges(): boolean {
		return (
			createLeagueDraftActive ||
			(createLeagueDraftActive && hasLeagueDraftData(createLeagueForm.league)) ||
			createLeagueForm.leagues.length > 0
		);
	}

	function openCreateLeagueWizard(): void {
		if (!canManageOffering || !data.offering?.id) return;
		resetCreateLeagueWizard();
		createLeagueForm.offeringId = data.offering.id;
		createLeagueForm.league.seasonId = data.season?.id ?? '';
		isCreateLeagueModalOpen = true;
	}

	function closeCreateLeagueWizard(): void {
		isCreateLeagueModalOpen = false;
		createLeagueWizardUnsavedConfirmOpen = false;
		resetCreateLeagueWizard();
	}

	function requestCloseCreateLeagueWizard(): void {
		if (!isCreateLeagueModalOpen || createLeagueSubmitting) return;
		if (!hasUnsavedCreateLeagueWizardChanges()) {
			closeCreateLeagueWizard();
			return;
		}
		createLeagueWizardUnsavedConfirmOpen = true;
	}

	function confirmDiscardCreateLeagueWizard(): void {
		createLeagueWizardUnsavedConfirmOpen = false;
		closeCreateLeagueWizard();
	}

	function cancelDiscardCreateLeagueWizard(): void {
		createLeagueWizardUnsavedConfirmOpen = false;
	}

	function clearCreateLeagueApiErrors(): void {
		if (Object.keys(createLeagueServerFieldErrors).length > 0) {
			createLeagueServerFieldErrors = {};
		}
		if (createLeagueFormError) {
			createLeagueFormError = '';
		}
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		const hasUnsavedChanges =
			isCreateLeagueModalOpen && hasUnsavedCreateLeagueWizardChanges();
		if (!hasUnsavedChanges) return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	function leagueStatusFor(league: OfferingLeagueRow) {
		if (!league.isActive || league.isLocked) {
			return {
				label: 'Closed',
				className: 'badge-primary'
			};
		}

		const now = Date.now();
		const start = league.regStartDate ? Date.parse(league.regStartDate) : Number.NaN;
		const end = league.regEndDate ? Date.parse(league.regEndDate) : Number.NaN;
		if (Number.isFinite(start) && start > now) {
			return {
				label: 'Upcoming',
				className: 'badge-primary'
			};
		}
		if (Number.isFinite(end) && end < now) {
			return {
				label: 'Closed',
				className: 'badge-primary'
			};
		}

		return {
			label: 'Open',
			className: 'badge-primary'
		};
	}

	function divisionLockStatus(division: OfferingDivisionRow): {
		label: 'Locked' | 'Unlocked';
		icon: typeof IconLock;
	} {
		if (division.isLocked) {
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

	function divisionJoinTooltip(division: OfferingDivisionRow): string {
		return division.isLocked ? 'This division cannot be joined' : 'This division can be joined';
	}

	function formatDate(
		value: string | null | undefined,
		options?: Intl.DateTimeFormatOptions
	): string {
		if (!value) return 'TBD';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'TBD';
		return parsed.toLocaleDateString('en-US', options);
	}

	function formatDateTime(value: string | null | undefined): string {
		if (!value) return 'TBD';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'TBD';
		return parsed.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function toDateMs(value: string): number | null {
		const normalized = value.trim();
		if (DATE_REGEX.test(normalized)) {
			const parsed = new Date(`${normalized}T00:00:00`).getTime();
			return Number.isNaN(parsed) ? null : parsed;
		}
		if (DATE_TIME_REGEX.test(normalized)) {
			const parsed = new Date(normalized).getTime();
			return Number.isNaN(parsed) ? null : parsed;
		}
		return null;
	}

	function toDateOnlyMs(value: string): number | null {
		const normalized = value.trim();
		if (DATE_REGEX.test(normalized)) return toDateMs(normalized);
		if (!DATE_TIME_REGEX.test(normalized)) return null;
		return toDateMs(normalized.slice(0, 10));
	}

	function isValidUrl(value: string): boolean {
		try {
			const url = new URL(value);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}

	function normalizeOptionalTextForRequest(value: string): string | null {
		const normalized = value.trim();
		return normalized.length > 0 ? normalized : null;
	}

	function normalizeOptionalUrlForRequest(value: string): string | null {
		const normalized = value.trim();
		return normalized.length > 0 ? normalized : null;
	}

	function normalizeDateForRequest(value: string): string {
		return value.trim();
	}

	function normalizeLeagueStackOrder(leagues: WizardLeagueInput[]): WizardLeagueInput[] {
		return leagues.map((league, index) => ({
			...league,
			stackOrder: index + 1
		}));
	}

	function mapLeagueForRequest(league: WizardLeagueInput) {
		return {
			name: league.name.trim(),
			slug: slugifyFinal(league.slug),
			stackOrder:
				Number.isInteger(league.stackOrder) && league.stackOrder > 0 ? league.stackOrder : 1,
			description: normalizeOptionalTextForRequest(league.description),
			seasonId: league.seasonId.trim(),
			gender: league.gender || null,
			skillLevel: league.skillLevel || null,
			regStartDate: normalizeDateForRequest(league.regStartDate),
			regEndDate: normalizeDateForRequest(league.regEndDate),
			seasonStartDate: normalizeDateForRequest(league.seasonStartDate),
			seasonEndDate: normalizeDateForRequest(league.seasonEndDate),
			hasPostseason: league.hasPostseason,
			postseasonStartDate: league.hasPostseason
				? normalizeDateForRequest(league.postseasonStartDate)
				: null,
			postseasonEndDate: league.hasPostseason
				? normalizeDateForRequest(league.postseasonEndDate)
				: null,
			hasPreseason: league.hasPreseason,
			preseasonStartDate: league.hasPreseason
				? normalizeDateForRequest(league.preseasonStartDate)
				: null,
			preseasonEndDate: league.hasPreseason
				? normalizeDateForRequest(league.preseasonEndDate)
				: null,
			isActive: league.isActive,
			isLocked: league.isLocked,
			imageUrl: normalizeOptionalUrlForRequest(league.imageUrl)
		};
	}

	function parseDate(value: string | null | undefined): Date | null {
		if (!value) return null;
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}

	function formatReviewDate(value: string | null | undefined, withTime = false): string {
		const parsed = parseDate(value);
		if (!parsed) return 'TBD';
		return withTime
			? parsed.toLocaleString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
					hour: 'numeric',
					minute: '2-digit'
				})
			: parsed.toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				});
	}

	function formatReviewRange(
		start: string | null | undefined,
		end: string | null | undefined,
		withTime = false
	): string {
		const startLabel = formatReviewDate(start, withTime);
		const endLabel = formatReviewDate(end, withTime);
		if (start && end) return `${startLabel} - ${endLabel}`;
		if (start) return `Starts ${startLabel}`;
		if (end) return `Ends ${endLabel}`;
		return 'TBD';
	}

	function normalizeSearchValue(value: string | null | undefined): string {
		return value?.trim().toLowerCase() ?? '';
	}

	function matchesSearchTerm(values: Array<string | null | undefined>, query: string): boolean {
		if (!query) return true;
		return values.some((value) => normalizeSearchValue(value).includes(query));
	}

	function leagueMetaLine(league: OfferingLeagueRow): string {
		return `${toTitleCase(league.gender) ?? 'Open'} / ${toTitleCase(league.skillLevel) ?? 'All Levels'}`;
	}

	function leagueHref(league: OfferingLeagueRow): string {
		const seasonSlug = data.season?.slug?.trim();
		const offeringSlug = data.offering?.slug?.trim();
		const leagueSlug = league.slug?.trim() || league.id;
		if (!seasonSlug || !offeringSlug || !leagueSlug) return '/dashboard/offerings';
		return `/dashboard/offerings/${seasonSlug}/${offeringSlug}/${leagueSlug}`;
	}

	function offeringSeasonHref(
		seasonSlug: string | null | undefined,
		offeringSlug: string | null | undefined
	): string {
		const normalizedSeasonSlug = seasonSlug?.trim();
		const normalizedOfferingSlug = offeringSlug?.trim();
		if (!normalizedSeasonSlug || !normalizedOfferingSlug) {
			return '/dashboard/offerings';
		}
		return `/dashboard/offerings/${normalizedSeasonSlug}/${normalizedOfferingSlug}`;
	}

	function divisionHref(league: OfferingLeagueRow, division: OfferingDivisionRow): string {
		const seasonSlug = data.season?.slug?.trim();
		const offeringSlug = data.offering?.slug?.trim();
		const leagueSlug = league.slug?.trim() || league.id;
		const divisionSlug = division.slug?.trim() || division.id;
		if (!seasonSlug || !offeringSlug || !leagueSlug || !divisionSlug) return leagueHref(league);
		return `/dashboard/offerings/${seasonSlug}/${offeringSlug}/${leagueSlug}/${divisionSlug}`;
	}

	function buildDraftFromTemplate(template: LeagueTemplate): WizardLeagueInput {
		const baseName = template.name.trim() || entryUnitTitleSingular();
		const sourceSlug = slugifyFinal(template.slug || template.name || 'entry');
		let nextName = `${baseName} Copy`;
		let nextSlug = `${sourceSlug}-copy`;
		let suffix = 1;
		const existingNames = new Set([
			...leagueTemplates.map((league: LeagueTemplate) => league.name.trim().toLowerCase()),
			...createLeagueForm.leagues.map((league) => league.name.trim().toLowerCase())
		]);
		const existingSlugs = new Set([
			...leagueTemplates.map((league: LeagueTemplate) => slugifyFinal(league.slug || '')),
			...createLeagueForm.leagues.map((league) => slugifyFinal(league.slug))
		]);
		while (existingNames.has(nextName.toLowerCase()) || existingSlugs.has(nextSlug)) {
			suffix += 1;
			nextName = `${baseName} Copy ${suffix}`;
			nextSlug = `${sourceSlug}-copy-${suffix}`;
		}

		return {
			draftId: createLeagueDraftId(),
			name: nextName,
			slug: nextSlug,
			stackOrder: createLeagueForm.leagues.length + 1,
			isSlugManual: false,
			description: template.description ?? '',
			seasonId: data.season?.id ?? '',
			gender: normalizeLeagueGender(template.gender),
			skillLevel: normalizeLeagueSkillLevel(template.skillLevel),
			regStartDate: template.regStartDate ?? defaultDateTimeValue('start'),
			regEndDate: template.regEndDate ?? defaultDateTimeValue('end'),
			seasonStartDate: template.seasonStartDate ?? '',
			seasonEndDate: template.seasonEndDate ?? '',
			hasPostseason: template.hasPostseason,
			postseasonStartDate: template.postseasonStartDate ?? '',
			postseasonEndDate: template.postseasonEndDate ?? '',
			hasPreseason: template.hasPreseason,
			preseasonStartDate: template.preseasonStartDate ?? '',
			preseasonEndDate: template.preseasonEndDate ?? '',
			isActive: template.isActive,
			isLocked: template.isLocked,
			imageUrl: template.imageUrl ?? ''
		};
	}

	function addOrUpdateCreateLeagueDraft(): boolean {
		const draftErrors = {
			...getCreateLeagueStepClientErrors(createLeagueForm, 2),
			...getCreateLeagueStepClientErrors(createLeagueForm, 3)
		};
		if (Object.keys(draftErrors).length > 0) {
			createLeagueStep = firstInvalidCreateLeagueStep(draftErrors);
			return false;
		}

		const normalizedLeague: WizardLeagueInput = {
			...createLeagueForm.league,
			name: createLeagueForm.league.name.trim(),
			slug: slugifyFinal(createLeagueForm.league.slug),
			stackOrder:
				createLeagueEditingIndex === null
					? createLeagueForm.leagues.length + 1
					: (createLeagueForm.leagues[createLeagueEditingIndex]?.stackOrder ??
						createLeagueForm.league.stackOrder),
			isSlugManual: createLeagueSlugTouched,
			description: createLeagueForm.league.description.trim(),
			seasonId: data.season?.id ?? '',
			regStartDate: createLeagueForm.league.regStartDate.trim(),
			regEndDate: createLeagueForm.league.regEndDate.trim(),
			seasonStartDate: createLeagueForm.league.seasonStartDate.trim(),
			seasonEndDate: createLeagueForm.league.seasonEndDate.trim(),
			preseasonStartDate: createLeagueForm.league.preseasonStartDate.trim(),
			preseasonEndDate: createLeagueForm.league.preseasonEndDate.trim(),
			postseasonStartDate: createLeagueForm.league.postseasonStartDate.trim(),
			postseasonEndDate: createLeagueForm.league.postseasonEndDate.trim(),
			imageUrl: createLeagueForm.league.imageUrl.trim()
		};

		if (createLeagueEditingIndex === null) {
			createLeagueForm.leagues = normalizeLeagueStackOrder([
				...createLeagueForm.leagues,
				normalizedLeague
			]);
		} else {
			createLeagueForm.leagues = normalizeLeagueStackOrder(
				createLeagueForm.leagues.map((league, index) =>
					index === createLeagueEditingIndex ? normalizedLeague : league
				)
			);
		}

		createLeagueForm.league = createEmptyLeague();
		createLeagueEditingIndex = null;
		createLeagueSlugTouched = false;
		createLeagueDraftActive = false;
		return true;
	}

	function startAddingCreateLeagueDraft(): void {
		clearCreateLeagueApiErrors();
		createLeagueEditingIndex = null;
		createLeagueSlugTouched = false;
		createLeagueForm.league = {
			...createEmptyLeague(),
			stackOrder: createLeagueForm.leagues.length + 1
		};
		createLeagueDraftActive = true;
		createLeagueStep = 2;
	}

	function cancelCreateLeagueDraft(): void {
		createLeagueEditingIndex = null;
		createLeagueSlugTouched = false;
		createLeagueDraftActive = false;
		createLeagueForm.league = createEmptyLeague();
	}

	function startEditingCreateLeague(index: number): void {
		if (!createLeagueForm.leagues[index]) return;
		clearCreateLeagueApiErrors();
		createLeagueEditingIndex = index;
		const sourceLeague = createLeagueForm.leagues[index];
		const inferredManualSlug =
			typeof sourceLeague.isSlugManual === 'boolean'
				? sourceLeague.isSlugManual
				: slugifyFinal(sourceLeague.slug) !==
					defaultLeagueSlug(sourceLeague.name, selectedLeagueWizardOffering?.name ?? '');
		createLeagueSlugTouched = inferredManualSlug;
		createLeagueForm.league = {
			...sourceLeague,
			isSlugManual: inferredManualSlug
		};
		createLeagueDraftActive = true;
		createLeagueStep = 2;
	}

	function duplicateCreateLeague(index: number): void {
		if (!createLeagueForm.leagues[index]) return;
		const source = createLeagueForm.leagues[index];
		const baseName = source.name.trim() || entryUnitTitleSingular();
		const baseSlug = slugifyFinal(source.slug || source.name || 'entry');
		let copyNumber = 1;
		let nextName = `${baseName} Copy`;
		let nextSlug = `${baseSlug}-copy`;
		const existingNames = new Set(
			createLeagueForm.leagues.map((league) => league.name.trim().toLowerCase())
		);
		const existingSlugs = new Set(
			createLeagueForm.leagues.map((league) => slugifyFinal(league.slug))
		);
		while (existingNames.has(nextName.toLowerCase()) || existingSlugs.has(nextSlug)) {
			copyNumber += 1;
			nextName = `${baseName} Copy ${copyNumber}`;
			nextSlug = `${baseSlug}-copy-${copyNumber}`;
		}

		const duplicate: WizardLeagueInput = {
			...source,
			draftId: createLeagueDraftId(),
			name: nextName,
			slug: nextSlug,
			isSlugManual: false
		};
		createLeagueForm.leagues = normalizeLeagueStackOrder(
			duplicateCollectionItem(createLeagueForm.leagues, index, () => duplicate)
		);
		if (createLeagueEditingIndex !== null && createLeagueEditingIndex > index) {
			createLeagueEditingIndex += 1;
		}
	}

	function moveCreateLeague(index: number, direction: 'up' | 'down'): void {
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (
			index < 0 ||
			targetIndex < 0 ||
			index >= createLeagueForm.leagues.length ||
			targetIndex >= createLeagueForm.leagues.length
		) {
			return;
		}

		createLeagueForm.leagues = normalizeLeagueStackOrder(
			moveCollectionItemByOffset(createLeagueForm.leagues, index, direction === 'up' ? -1 : 1)
		);
		createLeagueEditingIndex = adjustEditingIndexOnReorder(
			createLeagueEditingIndex,
			index,
			targetIndex
		);
	}

	function removeCreateLeague(index: number): void {
		if (!createLeagueForm.leagues[index]) return;
		const wasEditingRemoved = createLeagueEditingIndex === index;
		createLeagueForm.leagues = normalizeLeagueStackOrder(
			removeCollectionItem(createLeagueForm.leagues, index)
		);
		createLeagueEditingIndex = adjustEditingIndexOnRemove(createLeagueEditingIndex, index);
		if (wasEditingRemoved) {
			cancelCreateLeagueDraft();
		}
	}

	function copyFromExistingLeagueTemplate(template: LeagueTemplate): void {
		clearCreateLeagueApiErrors();
		createLeagueEditingIndex = null;
		createLeagueForm.league = buildDraftFromTemplate(template);
		createLeagueSlugTouched = false;
		createLeagueDraftActive = true;
		createLeagueStep = 2;
	}

	function openCreateEntryFlow(): void {
		openCreateLeagueWizard();
	}

	async function handleAddAction(action: string): Promise<void> {
		if (action === 'create-division') {
			const targetLeague = visibleLeagues[0] ?? data.leagues[0] ?? null;
			if (targetLeague) {
				await goto(leagueHref(targetLeague));
			}
			return;
		}
		openCreateEntryFlow();
	}

	function getLeagueFieldErrors(
		values: WizardLeagueInput,
		prefix = 'league'
	): Record<string, string> {
		const errors: Record<string, string> = {};
		const leagueName = values.name.trim();
		const leagueSlug = slugifyFinal(values.slug);
		const leagueSeasonId = values.seasonId.trim();
		const leagueImageUrl = values.imageUrl.trim();

		if (!leagueName) errors[`${prefix}.name`] = 'League name is required.';
		if (!leagueSlug) errors[`${prefix}.slug`] = 'League slug is required.';
		if (!leagueSeasonId) errors[`${prefix}.seasonId`] = 'Season is required.';

		const regStartMs = toDateMs(values.regStartDate);
		const regEndMs = toDateMs(values.regEndDate);
		const regEndDateOnlyMs = toDateOnlyMs(values.regEndDate);
		const seasonStartMs = toDateMs(values.seasonStartDate);
		const seasonEndMs = toDateMs(values.seasonEndDate);

		if (!values.regStartDate.trim()) {
			errors[`${prefix}.regStartDate`] = 'Registration start date is required.';
		} else if (regStartMs === null) {
			errors[`${prefix}.regStartDate`] = 'Use YYYY-MM-DDTHH:mm format.';
		}

		if (!values.regEndDate.trim()) {
			errors[`${prefix}.regEndDate`] = 'Registration end date is required.';
		} else if (regEndMs === null) {
			errors[`${prefix}.regEndDate`] = 'Use YYYY-MM-DDTHH:mm format.';
		}

		if (!values.seasonStartDate.trim()) {
			errors[`${prefix}.seasonStartDate`] = 'Season start date is required.';
		} else if (seasonStartMs === null) {
			errors[`${prefix}.seasonStartDate`] = 'Use YYYY-MM-DD format.';
		}

		if (!values.seasonEndDate.trim()) {
			errors[`${prefix}.seasonEndDate`] = 'Season end date is required.';
		} else if (seasonEndMs === null) {
			errors[`${prefix}.seasonEndDate`] = 'Use YYYY-MM-DD format.';
		}

		if (regStartMs !== null && regEndMs !== null && regStartMs > regEndMs) {
			errors[`${prefix}.scheduleRange`] =
				'Registration deadline must be on or after registration start.';
		}

		if (regEndDateOnlyMs !== null && seasonStartMs !== null && regEndDateOnlyMs > seasonStartMs) {
			errors[`${prefix}.scheduleRange`] =
				'Season start date must be on or after registration deadline.';
		}

		if (seasonStartMs !== null && seasonEndMs !== null && seasonStartMs > seasonEndMs) {
			errors[`${prefix}.scheduleRange`] = 'Season end date must be on or after season start date.';
		}

		const preseasonStartMs = toDateMs(values.preseasonStartDate);
		const preseasonEndMs = toDateMs(values.preseasonEndDate);
		if (values.hasPreseason) {
			if (!values.preseasonStartDate.trim()) {
				errors[`${prefix}.preseasonStartDate`] = 'Preseason start date is required.';
			}
			if (!values.preseasonEndDate.trim()) {
				errors[`${prefix}.preseasonEndDate`] = 'Preseason end date is required.';
			}
			if (
				preseasonStartMs !== null &&
				preseasonEndMs !== null &&
				preseasonStartMs > preseasonEndMs
			) {
				errors[`${prefix}.preseasonEndDate`] =
					'Preseason end date must be on or after preseason start date.';
			}
			if (preseasonEndMs !== null && seasonStartMs !== null && preseasonEndMs > seasonStartMs) {
				errors[`${prefix}.preseasonEndDate`] = 'Preseason must end on or before season start date.';
			}
		}

		const postseasonStartMs = toDateMs(values.postseasonStartDate);
		const postseasonEndMs = toDateMs(values.postseasonEndDate);
		if (values.hasPostseason) {
			if (!values.postseasonStartDate.trim()) {
				errors[`${prefix}.postseasonStartDate`] = 'Postseason start date is required.';
			}
			if (!values.postseasonEndDate.trim()) {
				errors[`${prefix}.postseasonEndDate`] = 'Postseason end date is required.';
			}
			if (
				postseasonStartMs !== null &&
				postseasonEndMs !== null &&
				postseasonStartMs > postseasonEndMs
			) {
				errors[`${prefix}.postseasonEndDate`] =
					'Postseason end date must be on or after postseason start date.';
			}
			if (seasonEndMs !== null && postseasonStartMs !== null && postseasonStartMs < seasonEndMs) {
				errors[`${prefix}.postseasonStartDate`] =
					'Postseason must start on or after season end date.';
			}
		}

		if (leagueImageUrl && !isValidUrl(leagueImageUrl)) {
			errors[`${prefix}.imageUrl`] = 'Enter a valid image URL.';
		}

		return errors;
	}

	function getLeagueCollectionScopeErrors(
		leagues: WizardLeagueInput[],
		prefix = 'leagues'
	): Record<string, string> {
		const errors: Record<string, string> = {};
		const seenNames = new Map<string, number>();
		const seenSlugs = new Map<string, number>();

		for (const [index, league] of leagues.entries()) {
			const normalizedName = league.name.trim().toLowerCase();
			if (normalizedName) {
				const previousNameIndex = seenNames.get(normalizedName);
				if (previousNameIndex !== undefined) {
					errors[`${prefix}.${index}.name`] =
						'League/group name must be unique within this offering.';
				} else {
					seenNames.set(normalizedName, index);
				}
			}

			const normalizedSlug = slugifyFinal(league.slug);
			if (normalizedSlug) {
				const previousSlugIndex = seenSlugs.get(normalizedSlug);
				if (previousSlugIndex !== undefined) {
					errors[`${prefix}.${index}.slug`] =
						'League/group slug must be unique within this offering.';
				} else {
					seenSlugs.set(normalizedSlug, index);
				}
			}
		}

		return errors;
	}

	function getExistingOfferingLeagueScopeErrors(
		offeringId: string,
		leagues: WizardLeagueInput[],
		prefix = 'leagues'
	): Record<string, string> {
		const normalizedOfferingId = offeringId.trim();
		if (!normalizedOfferingId) return {};

		const existingNames = new Set(
			leagueTemplates
				.map((league) => league.name.trim().toLowerCase())
				.filter((name) => name.length > 0)
		);
		const existingSlugs = new Set(
			leagueTemplates.map((league) => slugifyFinal(league.slug)).filter((slug) => slug.length > 0)
		);

		const errors: Record<string, string> = {};
		for (const [index, league] of leagues.entries()) {
			const normalizedName = league.name.trim().toLowerCase();
			if (normalizedName && existingNames.has(normalizedName)) {
				errors[`${prefix}.${index}.name`] =
					'An entry with this name already exists for the selected offering.';
			}

			const normalizedSlug = slugifyFinal(league.slug);
			if (normalizedSlug && existingSlugs.has(normalizedSlug)) {
				errors[`${prefix}.${index}.slug`] =
					'An entry with this slug already exists for the selected offering.';
			}
		}

		return errors;
	}

	function getCreateLeagueStepClientErrors(
		values: LeagueWizardFormState,
		step: LeagueWizardStep
	): Record<string, string> {
		if (step === 1) {
			return values.offeringId.trim()
				? {}
				: {
						offeringId: 'Offering is required.'
					};
		}

		if (step === 2) {
			if (!createLeagueDraftActive) return {};
			return pickFieldErrors(getLeagueFieldErrors(values.league), [
				'league.name',
				'league.slug',
				'league.description',
				'league.seasonId',
				'league.gender',
				'league.skillLevel'
			]);
		}

		if (step === 3) {
			if (!createLeagueDraftActive) return {};
			return pickFieldErrors(getLeagueFieldErrors(values.league), [
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
			]);
		}

		return getCreateLeagueSubmitErrors(values);
	}

	function getCreateLeagueSubmitErrors(values: LeagueWizardFormState): Record<string, string> {
		const errors: Record<string, string> = {};
		if (!values.offeringId.trim()) {
			errors['offeringId'] = 'Offering is required.';
		}
		if (values.leagues.length === 0) {
			errors['leagues'] = `Add at least one ${entryUnitSingular()}.`;
		} else {
			values.leagues.forEach((league, index) => {
				Object.assign(errors, getLeagueFieldErrors(league, `leagues.${index}`));
			});
			Object.assign(errors, getLeagueCollectionScopeErrors(values.leagues));
			Object.assign(errors, getExistingOfferingLeagueScopeErrors(values.offeringId, values.leagues));
		}
		return errors;
	}

	function firstInvalidCreateLeagueStep(errors: Record<string, string>): LeagueWizardStep {
		const keys = Object.keys(errors);
		if (keys.includes('offeringId')) return 1;
		if (
			keys.some((key) =>
				[
					'league.name',
					'league.slug',
					'league.description',
					'league.seasonId',
					'league.gender',
					'league.skillLevel'
				].includes(key)
			)
		) {
			return 2;
		}
		if (keys.some((key) => key.startsWith('league.'))) return 3;
		if (keys.some((key) => key === 'leagues' || key.startsWith('leagues.'))) return 4;
		return 4;
	}

	function nextCreateLeagueStep(): void {
		clearCreateLeagueApiErrors();
		if (createLeagueStep === 4 || createLeagueSubmitting) return;
		const stepErrors = getCreateLeagueStepClientErrors(createLeagueForm, createLeagueStep);
		if (Object.keys(stepErrors).length > 0) {
			createLeagueStep = firstInvalidCreateLeagueStep(stepErrors);
			return;
		}

		if (createLeagueStep === 2) {
			createLeagueStep = createLeagueDraftActive ? 3 : 4;
			return;
		}

		if (createLeagueStep === 3) {
			if (!createLeagueDraftActive) {
				createLeagueStep = 2;
				return;
			}
			if (!addOrUpdateCreateLeagueDraft()) return;
			createLeagueStep = 2;
			return;
		}

		createLeagueStep = (createLeagueStep + 1) as LeagueWizardStep;
	}

	function previousCreateLeagueStep(): void {
		clearCreateLeagueApiErrors();
		if (createLeagueStep === 1) return;
		if (createLeagueStep === 4) {
			createLeagueStep = createLeagueDraftActive ? 3 : 2;
			return;
		}
		createLeagueStep = (createLeagueStep - 1) as LeagueWizardStep;
	}

	function handleCreateLeagueBackAction(): void {
		if (createLeagueDraftActive && (createLeagueStep === 2 || createLeagueStep === 3)) {
			cancelCreateLeagueDraft();
			createLeagueStep = 2;
			return;
		}
		previousCreateLeagueStep();
	}

	function startEditingCreateLeagueOffering(): void {
		clearCreateLeagueApiErrors();
		createLeagueStep = 1;
	}

	function startEditingCreateLeagues(): void {
		clearCreateLeagueApiErrors();
		createLeagueStep = 2;
	}

	async function submitCreateLeagueWizard(): Promise<void> {
		const clientErrors = getCreateLeagueSubmitErrors(createLeagueForm);
		if (Object.keys(clientErrors).length > 0) {
			createLeagueStep = firstInvalidCreateLeagueStep(clientErrors);
			return;
		}

		createLeagueSubmitting = true;
		createLeagueFormError = '';
		createLeagueServerFieldErrors = {};

		const payload = {
			offeringId: createLeagueForm.offeringId,
			leagues: createLeagueForm.leagues.map(mapLeagueForRequest)
		};

		try {
			const response = await fetch('/api/intramural-sports/leagues', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			let body: CreateLeagueApiResponse | null = null;
			try {
				body = (await response.json()) as CreateLeagueApiResponse;
			} catch {
				body = null;
			}

			if (!response.ok || !body?.success || !body?.data) {
				createLeagueServerFieldErrors = toServerFieldErrorMap(body?.fieldErrors);
				const combinedErrors = {
					...getCreateLeagueSubmitErrors(createLeagueForm),
					...createLeagueServerFieldErrors
				};
				createLeagueStep = firstInvalidCreateLeagueStep(combinedErrors);
				createLeagueFormError = body?.error || 'Unable to save league right now.';
				return;
			}

			const createdCount = body.data.leagueIds.length;
			await invalidateAll();
			closeCreateLeagueWizard();
			toast.success(
				`${createdCount} ${pluralize(createdCount, entryUnitSingular(), entryUnitPlural())} created successfully.`,
				{
					title: `New ${entryUnitTitleSingular()}`
				}
			);
		} catch {
			createLeagueFormError = `Unable to save ${entryUnitPlural()} right now.`;
		} finally {
			createLeagueSubmitting = false;
		}
	}

	function leagueMatchesSearch(league: OfferingLeagueRow, query: string): boolean {
		return matchesSearchTerm(
			[
				league.name,
				league.slug,
				league.description,
				leagueMetaLine(league),
				leagueStatusFor(league).label,
				formatDateTime(league.regStartDate),
				formatDateTime(league.regEndDate)
			],
			query
		);
	}

	function divisionMatchesSearch(division: OfferingDivisionRow, query: string): boolean {
		return matchesSearchTerm(
			[
				division.name,
				division.slug,
				division.description,
				division.dayOfWeek,
				division.gameTime,
				division.location,
				divisionLockStatus(division).label,
				String(division.maxTeams ?? ''),
				String(division.teamCount),
				String(division.waitlistCount),
				formatDate(division.startDate, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})
			],
			query
		);
	}

	function leagueVisibleTeamCount(league: OfferingLeagueRow): number {
		return league.divisions.reduce((sum, division) => sum + division.teamCount, 0);
	}

	function leagueVisibleWaitlistCount(league: OfferingLeagueRow): number {
		return league.divisions.reduce((sum, division) => sum + division.waitlistCount, 0);
	}

	const HeaderIcon = $derived.by(() =>
		sportIconFor(data.offering?.name ?? 'Offering', data.offering?.sport ?? null)
	);

	const normalizedSearchQuery = $derived.by(() => normalizeSearchValue(searchQuery));

	const visibleLeagues = $derived.by<OfferingLeagueRow[]>(() => {
		const query = normalizedSearchQuery;
		if (!query) return data.leagues;

		return data.leagues.flatMap((league: OfferingLeagueRow) => {
			const showAllDivisions = leagueMatchesSearch(league, query);
			const matchingDivisions = showAllDivisions
				? league.divisions
				: league.divisions.filter((division: OfferingDivisionRow) =>
						divisionMatchesSearch(division, query)
					);

			if (!showAllDivisions && matchingDivisions.length === 0) {
				return [];
			}

			return [
				{
					...league,
					divisions: matchingDivisions,
					divisionCount: matchingDivisions.length,
					teamCount: matchingDivisions.reduce((sum, division) => sum + division.teamCount, 0),
					waitlistCount: matchingDivisions.reduce(
						(sum, division) => sum + division.waitlistCount,
						0
					)
				}
			];
		});
	});

	const hasSearchQuery = $derived.by(() => normalizedSearchQuery.length > 0);

	function seasonHistoryStatusLabel(season: NonNullable<PageData['seasonHistory']>[number]): string {
		if (season.isCurrent) return 'CURRENT';
		const today = new Date().toISOString().slice(0, 10);
		return season.startDate > today ? 'FUTURE' : 'PAST';
	}

	const seasonHistoryDropdownOptions = $derived.by<DropdownOption[]>(() =>
		(data.seasonHistory ?? []).map((season: NonNullable<PageData['seasonHistory']>[number]) => ({
			value: offeringSeasonHref(season.seasonSlug, season.offeringSlug),
			label: season.seasonName,
			statusLabel: seasonHistoryStatusLabel(season)
		}))
	);

	const selectedSeasonHistoryValue = $derived.by(() =>
		offeringSeasonHref(data.season?.slug, data.offering?.slug)
	);

	async function handleSeasonHistoryChange(value: string): Promise<void> {
		if (!value || value === selectedSeasonHistoryValue) return;
		await goto(value);
	}

	const entryAddActionOptions = $derived.by<DropdownOption[]>(() => [
		{
			value: 'create-league',
			label: 'Add League'
		},
		{
			value: 'create-division',
			label: 'Add Division',
			disabled: data.leagues.length === 0
		}
	]);

	const divisionTableColumns = $derived.by<OfferingsTableColumn[]>(() => [
		{
			key: 'division',
			label: 'Division',
			widthClass: 'w-[58%]',
			rowHeader: true
		},
		{
			key: 'max-teams',
			label: 'Max Teams',
			widthClass: 'w-[14%]',
			headerClass: 'text-center',
			cellClass: 'align-top text-center'
		},
		{
			key: 'confirmed',
			label: 'Confirmed',
			widthClass: 'w-[14%]',
			headerClass: 'text-center',
			cellClass: 'align-top text-center'
		},
		{
			key: 'pending',
			label: 'Pending',
			widthClass: 'w-[14%]',
			headerClass: 'text-center',
			cellClass: 'align-top text-center'
		}
	]);
	const leagueGenderDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: '', label: 'Select...' },
		{ value: 'male', label: 'Male' },
		{ value: 'female', label: 'Female' },
		{ value: 'mixed', label: 'Mixed' }
	]);
	const leagueSkillLevelDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: '', label: 'Select...' },
		{ value: 'competitive', label: 'Competitive' },
		{ value: 'intermediate', label: 'Intermediate' },
		{ value: 'recreational', label: 'Recreational' },
		{ value: 'all', label: 'All' }
	]);
	const leagueTemplates = $derived.by<LeagueTemplate[]>(() =>
		data.leagues
			.map((league: NonNullable<PageData['leagues']>[number], index: number) => ({
				id: league.id,
				offeringId: data.offering?.id ?? '',
				seasonId: data.season?.id ?? '',
				name: league.name,
				slug: league.slug,
				description: league.description,
				gender: league.gender,
				skillLevel: league.skillLevel,
				regStartDate: league.regStartDate,
				regEndDate: league.regEndDate,
				seasonStartDate: league.seasonStartDate,
				seasonEndDate: league.seasonEndDate,
				hasPostseason: false,
				postseasonStartDate: null,
				postseasonEndDate: null,
				hasPreseason: false,
				preseasonStartDate: null,
				preseasonEndDate: null,
				isActive: league.isActive,
				isLocked: league.isLocked,
				imageUrl: null,
				stackOrder: index + 1
			}))
			.sort((a: LeagueTemplate, b: LeagueTemplate) => {
				const orderDiff =
					(a.stackOrder ?? Number.MAX_SAFE_INTEGER) - (b.stackOrder ?? Number.MAX_SAFE_INTEGER);
				if (orderDiff !== 0) return orderDiff;
				return a.name.localeCompare(b.name);
			})
	);
	const selectedLeagueWizardOffering = $derived.by<SelectedWizardOffering | null>(() => {
		if (!data.offering?.id) return null;
		return {
			id: data.offering.id,
			name: data.offering.name,
			type: offeringType(),
			isActive: data.offering.isActive !== false
		};
	});
	const selectedOfferingLeagueTemplates = $derived.by<LeagueTemplate[]>(() => leagueTemplates);
	const clientCreateLeagueFieldErrors = $derived.by(() =>
		getCreateLeagueStepClientErrors(createLeagueForm, createLeagueStep)
	);
	const rawCreateLeagueFieldErrors = $derived.by(() => ({
		...clientCreateLeagueFieldErrors,
		...createLeagueServerFieldErrors
	}));
	const createLeagueFieldErrors = $derived.by(() => {
		const visibleErrors: Record<string, string> = {};
		for (const [key, value] of Object.entries(rawCreateLeagueFieldErrors)) {
			if (!isRequiredFieldMessage(value)) {
				visibleErrors[key] = value;
			}
		}
		return visibleErrors;
	});
	const canGoNextCreateLeagueStep = $derived.by(() => {
		if (createLeagueStep >= 4 || createLeagueSubmitting) return false;
		if (createLeagueStep === 1) return true;
		return Object.keys(clientCreateLeagueFieldErrors).length === 0;
	});
	const canSubmitCreateLeague = $derived.by(
		() =>
			createLeagueStep === 4 &&
			Object.keys(getCreateLeagueSubmitErrors(createLeagueForm)).length === 0 &&
			Object.keys(createLeagueServerFieldErrors).length === 0 &&
			!createLeagueDraftActive &&
			!createLeagueSubmitting
	);
	const createLeagueStepProgress = $derived.by(() => Math.round((createLeagueStep / 4) * 100));
</script>

<svelte:head>
	<title>{data.offering?.name ?? 'Offering'} - PlayIMs</title>
	<meta
		name="description"
		content="Offering details and all leagues available within this season offering."
	/>
</svelte:head>

<div class="w-full space-y-4">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex items-center gap-3 py-2 lg:py-3">
				<div
					class="bg-primary text-white border-2 border-primary-700 flex h-[2.75rem] w-[2.75rem] items-center justify-center lg:h-[3.4rem] lg:w-[3.4rem]"
					aria-hidden="true"
				>
					<HeaderIcon class="h-7 w-7 lg:h-8 lg:w-8" />
				</div>
				<h1
					class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
				>
					{data.offering?.name ?? 'Offering'}
				</h1>
			</div>
		</div>
	</header>

	<div class="space-y-4 px-4 lg:px-6">
		{#if data.error}
			<div class="border-2 border-warning-300 bg-warning-50 p-4 text-sm text-neutral-950">
				{data.error}
			</div>
		{/if}

		{#if data.offering}
			<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="space-y-3 border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">
									{data.offering.name}
								</h2>
								<ListboxDropdown
									options={seasonHistoryDropdownOptions}
									value={selectedSeasonHistoryValue}
									ariaLabel="Offering season history"
									buttonClass="button-secondary-outlined px-3 py-1 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
									emptyText="No other seasons available."
									disabled={seasonHistoryDropdownOptions.length <= 1}
									on:change={(event) => {
										void handleSeasonHistoryChange(event.detail.value);
									}}
								/>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.leagueCount}
									{entryUnitPlural()}
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.divisionCount} divisions
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.openCount} open
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.closedCount} closed
								</span>
								{#if canManageOffering}
									<SplitAddAction
										options={entryAddActionOptions}
										on:click={() => {
											void openCreateEntryFlow();
										}}
										on:action={(event) => {
											void handleAddAction(event.detail.value);
										}}
									/>
								{/if}
							</div>
						</div>
						<SearchInput
							id="offering-search"
							label={`Search ${entryUnitPlural()} and divisions`}
							value={searchQuery}
							placeholder={`Search ${entryUnitSingular()}, division, schedule, or location`}
							autocomplete="off"
							wrapperClass="relative"
							iconClass="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-950"
							inputClass="input-secondary py-1 pl-10 pr-10 text-sm disabled:cursor-not-allowed"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-950 hover:text-secondary-900"
							clearIconClass="h-4 w-4"
							clearAriaLabel={`Clear ${entryUnitSingular()} and division search`}
							on:input={(event) => {
								searchQuery = event.detail.value;
							}}
						/>
					</div>

					<div class="min-h-[34rem]">
						{#if visibleLeagues.length === 0}
							<div class="p-4">
								<div
									class={`space-y-2 border p-4 ${hasSearchQuery ? 'border-warning-300 bg-warning-50' : 'border-neutral-950 bg-white'}`}
								>
									<h3 class="text-xl font-bold font-serif text-neutral-950">
										{#if hasSearchQuery}
											No matches found
										{:else}
											No {entryUnitPlural()} yet
										{/if}
									</h3>
									<p class="text-sm font-sans text-neutral-950">
										{#if hasSearchQuery}
											No {entryUnitPlural()} or divisions match "{searchQuery.trim()}".
										{:else}
											No {entryUnitPlural()} exist for this offering yet.
										{/if}
									</p>
								</div>
							</div>
						{:else}
							<div class="divide-y divide-neutral-950">
								{#each visibleLeagues as league}
									<section class="space-y-3 p-4">
										<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<a
														href={leagueHref(league)}
														class="text-2xl font-bold font-serif text-neutral-950 hover:underline"
													>
														{league.name}
													</a>
													<span
														class="badge-secondary-outlined px-1.5 py-0 text-[10px] uppercase tracking-wide"
													>
														{entryUnitTitleSingular()}
										</span>
									</div>
									{#if league.description}
										<p class="mt-1 text-sm leading-6 text-neutral-950">
											{league.description}
													</p>
												{/if}
											</div>
											<div class="flex flex-wrap items-center gap-1">
												<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
													{league.divisions.length} divisions
												</span>
												<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
													{leagueVisibleTeamCount(league)} teams
												</span>
												{#if leagueVisibleWaitlistCount(league) > 0}
													<span class="badge-primary-outlined text-xs uppercase tracking-wide">
														{leagueVisibleWaitlistCount(league)} waitlist
													</span>
												{/if}
												<span
													class={`${leagueStatusFor(league).className} px-2 py-0.5 text-xs font-bold uppercase tracking-wide`}
												>
													{leagueStatusFor(league).label}
												</span>
											</div>
										</div>

										<OfferingsTable
											columns={divisionTableColumns}
											rows={league.divisions}
											caption={`${league.name} divisions table`}
										>
											{#snippet emptyBody()}
												<tr class="bg-neutral-25">
													<td
														colspan={divisionTableColumns.length}
														class="px-2 py-10 text-center text-sm italic text-neutral-700"
													>
														No divisions exist for this {entryUnitSingular()} yet.
													</td>
												</tr>
											{/snippet}

											{#snippet cell(division, column)}
												{@const offeringDivision = division as OfferingDivisionRow}
												{@const divisionStatus = divisionLockStatus(offeringDivision)}
												{#if column.key === 'division'}
													<div class="flex items-center gap-2">
														<div
															class="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-white"
															aria-hidden="true"
														>
															<HeaderIcon class="h-5 w-5" />
														</div>
														<div class="min-w-0">
															<div class="flex items-center gap-1.5">
																<a
																	href={divisionHref(league, offeringDivision)}
																	class="font-sans text-sm font-bold text-neutral-950 hover:underline"
																>
																	{offeringDivision.name}
																</a>
																<HoverTooltip
																	text={divisionJoinTooltip(offeringDivision)}
																	wrapperClass="inline-flex shrink-0"
																>
																	<span class="inline-flex text-neutral-950" aria-hidden="true">
																		<divisionStatus.icon
																			class={`h-4 w-4 ${divisionStatus.label === 'Unlocked' ? 'opacity-50' : ''}`}
																		/>
																	</span>
																</HoverTooltip>
																<span class="sr-only">{divisionStatus.label}</span>
															</div>
															{#if offeringDivision.description}
																<p class="mt-1 font-sans text-xs leading-snug text-neutral-700">
																	{offeringDivision.description}
																</p>
															{/if}
														</div>
													</div>
												{:else if column.key === 'max-teams'}
													<p class="font-sans text-sm font-semibold text-neutral-950">
														{offeringDivision.maxTeams ?? '-'}
													</p>
												{:else if column.key === 'confirmed'}
													<p class="font-sans text-sm font-semibold text-neutral-950">
														{offeringDivision.teamCount}
													</p>
												{:else if column.key === 'pending'}
													<p class="font-sans text-sm font-semibold text-neutral-950">
														{offeringDivision.waitlistCount}
													</p>
												{/if}
											{/snippet}
										</OfferingsTable>
									</section>
								{/each}
							</div>
						{/if}
					</div>
				</section>

				<aside class="w-full min-w-0 space-y-6">
					<DashboardSidebarPanel title="Offering Snapshot">
						{#snippet content()}
							<div class="space-y-3 text-sm text-neutral-950">
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Season
									</p>
									<p class="mt-1 font-semibold">{data.season?.name ?? 'TBD'}</p>
									<p class="mt-1 text-xs text-neutral-700">
										Type: {toTitleCase(data.offering.type) ?? 'League'}
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Sport
									</p>
									<p class="mt-1 font-semibold">{data.offering.sport ?? 'Not specified'}</p>
									<p class="mt-1 text-xs text-neutral-700">
										Roster: {data.offering.minPlayers ?? 'TBD'} min / {data.offering.maxPlayers ??
											'TBD'} max
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Description
									</p>
									<p class="mt-1 leading-6">
										{data.offering.description ?? 'No offering description has been added yet.'}
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Rulebook
									</p>
									{#if data.offering.rulebookUrl}
										<a
											href={data.offering.rulebookUrl}
											target="_blank"
											rel="noreferrer"
											class="mt-1 inline-flex font-semibold text-secondary-900 underline underline-offset-2"
										>
											Open rulebook
										</a>
									{:else}
										<p class="mt-1">No rulebook linked yet.</p>
									{/if}
								</div>
							</div>
						{/snippet}
					</DashboardSidebarPanel>

					<DashboardSidebarPanel title={`${entryUnitTitleSingular()} Snapshot`}>
						{#snippet content()}
							{#if visibleLeagues.length === 0}
								<p class="text-sm font-sans text-neutral-950">
									{#if hasSearchQuery}
										No {entryUnitPlural()} match this search right now.
									{:else}
										No {entryUnitPlural()} are available yet.
									{/if}
								</p>
							{:else}
								<div class="space-y-3">
									{#each visibleLeagues as league}
										{@const leagueStatus = leagueStatusFor(league)}
										<a
											href={leagueHref(league)}
											class="block border border-neutral-950 bg-white p-3 transition-colors hover:bg-neutral-25"
										>
											<div class="flex items-start justify-between gap-3">
												<div class="min-w-0">
													<p class="font-serif text-lg font-bold text-neutral-950">
														{league.name}
													</p>
												</div>
												<div class="flex flex-col items-end gap-1">
													<span
														class={`${leagueStatus.className} px-2 py-0.5 text-xs font-bold uppercase tracking-wide`}
													>
														{leagueStatus.label}
													</span>
													<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
														{league.divisions.length} divisions
													</span>
													<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
														{leagueVisibleTeamCount(league)} teams
													</span>
												</div>
											</div>
										</a>
									{/each}
								</div>
							{/if}
						{/snippet}
					</DashboardSidebarPanel>
				</aside>
			</div>
		{:else}
			<div class="border-2 border-neutral-950 bg-white p-6 text-sm text-neutral-950">
				Offering details are not available right now.
			</div>
		{/if}
	</div>
</div>

<CreateLeagueWizard
	open={isCreateLeagueModalOpen}
	step={createLeagueStep}
	stepTitle={wizardEntryStepTitle(createLeagueStep)}
	stepProgress={createLeagueStepProgress}
	formError={createLeagueFormError}
	title={`New ${entryUnitTitleSingular()}`}
	unsavedConfirmOpen={createLeagueWizardUnsavedConfirmOpen}
	formClass={`p-4 space-y-5 flex-1 min-h-0 ${
		createLeagueStep === 2 && !createLeagueDraftActive ? 'overflow-hidden' : 'overflow-y-auto'
	}`}
	onRequestClose={requestCloseCreateLeagueWizard}
	onSubmit={() => {
		void submitCreateLeagueWizard();
	}}
	onInput={clearCreateLeagueApiErrors}
	onUnsavedConfirm={confirmDiscardCreateLeagueWizard}
	onUnsavedCancel={cancelDiscardCreateLeagueWizard}
>
	{#if createLeagueStep === 1}
		<div class="space-y-4">
			<div class="border border-neutral-950 bg-white p-3 text-sm text-neutral-950 space-y-2">
				<div class="flex items-center justify-between gap-2">
					<p>
						<span class="font-semibold">Offering:</span>
						{selectedLeagueWizardOffering?.name ?? 'Offering'}
					</p>
					<p>
						<span class="font-semibold">Type:</span>
						{selectedLeagueWizardOffering?.type === 'tournament' ? 'Tournament' : 'League'}
					</p>
				</div>
				<p>
					<span class="font-semibold">Season:</span>
					{getSeasonLabel()}
				</p>
				<p>
					<span class="font-semibold">Status:</span>
					{selectedLeagueWizardOffering?.isActive ? 'Active' : 'Inactive'}
				</p>
			</div>

			{#if selectedOfferingLeagueTemplates.length === 0}
				<div class="border border-secondary-200 bg-neutral p-4 text-sm text-neutral-950">
					No existing {entryUnitPlural()} for this offering yet. Continue to add a new one.
				</div>
			{:else}
				<div class="border border-secondary-200 bg-neutral p-2 space-y-2">
					<p class="text-xs font-semibold uppercase tracking-wide text-neutral-950">
						Copy Existing {entryUnitTitleSingular()}
					</p>
					<div
						class="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400"
					>
						{#each selectedOfferingLeagueTemplates as existingLeague}
							<HoverTooltip text={`Duplicate ${entryUnitSingular()} settings`}>
								<button
									type="button"
									class="h-14 w-full border border-secondary-300 bg-white px-2 py-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left cursor-pointer hover:bg-neutral-200 active:bg-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
									aria-label={`Duplicate ${existingLeague.name}`}
									onclick={() => {
										copyFromExistingLeagueTemplate(existingLeague);
									}}
								>
									<span class="min-w-0">
										<span class="block truncate text-sm font-semibold text-neutral-950">
											{existingLeague.name}
										</span>
										<span class="block truncate text-xs text-neutral-900">
											{getSeasonLabel()}
										</span>
									</span>
									<IconCopy class="h-4 w-4 shrink-0" />
								</button>
							</HoverTooltip>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if createLeagueStep === 2}
		<div class="space-y-4">
			<div class="border border-neutral-950 bg-white p-3 text-sm text-neutral-950">
				Adding to <span class="font-semibold">{selectedLeagueWizardOffering?.name}</span>
			</div>

			{#if !createLeagueDraftActive}
				<div class="space-y-2">
					{#if createLeagueFieldErrors['leagues']}
						<p class="text-xs text-error-700">{createLeagueFieldErrors['leagues']}</p>
					{/if}
					<WizardDraftCollection
						title={offeringType() === 'tournament' ? 'Tournament Groups' : 'Leagues'}
						itemSingular={entryUnitSingular()}
						itemPlural={entryUnitPlural()}
						items={createLeagueForm.leagues}
						draftActive={createLeagueDraftActive}
						emptyMessage={`No ${entryUnitPlural()} added yet. Use the plus button to add one.`}
						onAdd={startAddingCreateLeagueDraft}
						onEdit={startEditingCreateLeague}
						onCopy={duplicateCreateLeague}
						onMoveUp={(index) => moveCreateLeague(index, 'up')}
						onMoveDown={(index) => moveCreateLeague(index, 'down')}
						onRemove={removeCreateLeague}
						getItemName={(item) => (item as WizardLeagueInput).name}
						getItemSlug={(item) => (item as WizardLeagueInput).slug}
						listClass="space-y-2 max-h-[52vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400"
					>
						{#snippet itemBody(item)}
							{@const league = item as WizardLeagueInput}
							<div class="grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-neutral-950 sm:grid-cols-2">
								<p><span class="font-semibold">Season:</span> {getSeasonLabel()}</p>
								<p>
									<span class="font-semibold">Gender:</span>
									{displayLeagueGender(league.gender) ?? 'Unspecified'}
								</p>
								<p>
									<span class="font-semibold">Skill Level:</span>
									{league.skillLevel ? toTitleCase(league.skillLevel) : 'Unspecified'}
								</p>
								<p>
									<span class="font-semibold">Status:</span>
									{league.isActive ? 'Active' : 'Inactive'} | {league.isLocked
										? 'Locked'
										: 'Unlocked'}
								</p>
								<p class="sm:col-span-2">
									<span class="font-semibold">Registration:</span>
									{formatReviewRange(league.regStartDate, league.regEndDate, true)}
								</p>
								<p class="sm:col-span-2">
									<span class="font-semibold">Season Dates:</span>
									{formatReviewRange(league.seasonStartDate, league.seasonEndDate)}
								</p>
								{#if league.hasPreseason}
									<p class="sm:col-span-2">
										<span class="font-semibold">Preseason:</span>
										{formatReviewRange(league.preseasonStartDate, league.preseasonEndDate)}
									</p>
								{/if}
								{#if league.hasPostseason}
									<p class="sm:col-span-2">
										<span class="font-semibold">Postseason:</span>
										{formatReviewRange(league.postseasonStartDate, league.postseasonEndDate)}
									</p>
								{/if}
							</div>
							{#if league.description.trim()}
								<p class="text-xs text-neutral-950">
									<span class="font-semibold">Description:</span>
									{league.description.trim()}
								</p>
							{/if}
						{/snippet}
					</WizardDraftCollection>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div>
						<label for="league-wizard-name" class="mb-1 block text-sm font-sans text-neutral-950"
							>Name <span class="text-error-700">*</span></label
						>
						<input
							id="league-wizard-name"
							type="text"
							class="input-secondary"
							value={createLeagueForm.league.name}
							placeholder={defaultLeagueNamePlaceholder(offeringType() === 'tournament')}
							oninput={(event) => {
								const value = (event.currentTarget as HTMLInputElement).value;
								createLeagueForm.league.name = value;
								if (!createLeagueSlugTouched) {
									createLeagueForm.league.slug = defaultLeagueSlug(
										value,
										selectedLeagueWizardOffering?.name ?? ''
									);
									createLeagueForm.league.isSlugManual = false;
								}
							}}
							autocomplete="off"
						/>
						{#if createLeagueFieldErrors['league.name']}
							<p class="mt-1 text-xs text-error-700">{createLeagueFieldErrors['league.name']}</p>
						{/if}
					</div>

					<div>
						<div class="mb-1 flex min-h-6 items-center gap-1.5">
							<label for="league-wizard-slug" class="text-sm leading-6 font-sans text-neutral-950"
								>Slug <span class="text-error-700">*</span></label
							>
							<InfoPopover
								buttonAriaLabel="League slug help"
								buttonVariant="label-inline"
								align="left"
							>
								<div class="space-y-2">
									<p>A slug is the URL-friendly identifier used in links and lookups.</p>
									<p>Leave the default slug if you are unsure.</p>
								</div>
							</InfoPopover>
						</div>
						<div class="relative">
							<input
								id="league-wizard-slug"
								type="text"
								class="input-secondary pr-10"
								value={createLeagueForm.league.slug}
								placeholder={defaultLeagueSlugPlaceholder({
									leagueName: createLeagueForm.league.name,
									offeringName: selectedLeagueWizardOffering?.name ?? '',
									isTournament: offeringType() === 'tournament'
								})}
								oninput={(event) => {
									createLeagueSlugTouched = true;
									createLeagueForm.league.isSlugManual = true;
									createLeagueForm.league.slug = applyLiveSlugInput(
										event.currentTarget as HTMLInputElement
									);
								}}
								autocomplete="off"
							/>
							<HoverTooltip
								text="Revert to default"
								wrapperClass="absolute right-2 top-1/2 inline-flex shrink-0 z-10"
							>
								<button
									type="button"
									tabindex="-1"
									class="-translate-y-1/2 inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none"
									aria-label="Revert league slug to default"
									onclick={() => {
										createLeagueSlugTouched = false;
										createLeagueForm.league.isSlugManual = false;
										createLeagueForm.league.slug = defaultLeagueSlug(
											createLeagueForm.league.name,
											selectedLeagueWizardOffering?.name ?? ''
										);
									}}
								>
									<IconRestore class="h-4 w-4" />
								</button>
							</HoverTooltip>
						</div>
						{#if createLeagueFieldErrors['league.slug']}
							<p class="mt-1 text-xs text-error-700">{createLeagueFieldErrors['league.slug']}</p>
						{/if}
					</div>

					<div>
						<p class="mb-1 block text-sm font-sans text-neutral-950">
							Season <span class="text-error-700">*</span>
						</p>
						<div class="border-2 border-secondary-400 bg-white px-4 py-2 text-base text-neutral-950">
							{getSeasonLabel()}
						</div>
					</div>

					<div>
						<p class="mb-1 block text-sm font-sans text-neutral-950">Gender</p>
						<ListboxDropdown
							options={leagueGenderDropdownOptions}
							value={createLeagueForm.league.gender}
							ariaLabel="League wizard gender"
							buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
							on:change={(event) => {
								createLeagueForm.league.gender = event.detail.value as LeagueGender;
								clearCreateLeagueApiErrors();
							}}
						/>
					</div>

					<div>
						<p class="mb-1 block text-sm font-sans text-neutral-950">Skill Level</p>
						<ListboxDropdown
							options={leagueSkillLevelDropdownOptions}
							value={createLeagueForm.league.skillLevel}
							ariaLabel="League wizard skill level"
							buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
							on:change={(event) => {
								createLeagueForm.league.skillLevel = event.detail.value as LeagueSkillLevel;
								clearCreateLeagueApiErrors();
							}}
						/>
					</div>

					<div class="lg:col-span-2">
						<label
							for="league-wizard-description"
							class="mb-1 block text-sm font-sans text-neutral-950">Description</label
						>
						<textarea
							id="league-wizard-description"
							class="textarea-secondary min-h-28"
							bind:value={createLeagueForm.league.description}
							placeholder={`Describe this ${entryUnitSingular()}.`}
						></textarea>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if createLeagueStep === 3}
		<div class="space-y-4">
			{#if !createLeagueDraftActive}
				<div class="border border-neutral-950 bg-white p-4">
					<p class="text-sm leading-5 font-sans text-neutral-950">
						No {entryUnitSingular()} draft is open. Go back to {wizardEntryStepTitle(2)} and
						click the plus button to add one.
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div>
						<label
							for="league-wizard-reg-start"
							class="mb-1 block text-sm font-sans text-neutral-950"
							>{offeringType() === 'tournament'
								? 'Tournament Registration Opens'
								: 'Team Registration Opens'}
							<span class="text-error-700">*</span></label
						>
						<input
							id="league-wizard-reg-start"
							type="datetime-local"
							class="input-secondary"
							bind:value={createLeagueForm.league.regStartDate}
							onfocus={() => {
								if (!createLeagueForm.league.regStartDate.trim()) {
									createLeagueForm.league.regStartDate = defaultDateTimeValue('start');
								}
							}}
						/>
						{#if createLeagueFieldErrors['league.regStartDate']}
							<p class="mt-1 text-xs text-error-700">
								{createLeagueFieldErrors['league.regStartDate']}
							</p>
						{/if}
					</div>

					<div>
						<label for="league-wizard-reg-end" class="mb-1 block text-sm font-sans text-neutral-950"
							>{offeringType() === 'tournament'
								? 'Tournament Registration Deadline'
								: 'Team Registration Deadline'}
							<span class="text-error-700">*</span></label
						>
						<input
							id="league-wizard-reg-end"
							type="datetime-local"
							class="input-secondary"
							bind:value={createLeagueForm.league.regEndDate}
							onfocus={() => {
								if (!createLeagueForm.league.regEndDate.trim()) {
									createLeagueForm.league.regEndDate = defaultDateTimeValue('end');
								}
							}}
						/>
						{#if createLeagueFieldErrors['league.regEndDate']}
							<p class="mt-1 text-xs text-error-700">
								{createLeagueFieldErrors['league.regEndDate']}
							</p>
						{/if}
					</div>

					<div>
						<label
							for="league-wizard-season-start"
							class="mb-1 block text-sm font-sans text-neutral-950"
							>Season Start Date <span class="text-error-700">*</span></label
						>
						<input
							id="league-wizard-season-start"
							type="date"
							class="input-secondary"
							bind:value={createLeagueForm.league.seasonStartDate}
						/>
						{#if createLeagueFieldErrors['league.seasonStartDate']}
							<p class="mt-1 text-xs text-error-700">
								{createLeagueFieldErrors['league.seasonStartDate']}
							</p>
						{/if}
					</div>

					<div>
						<label
							for="league-wizard-season-end"
							class="mb-1 block text-sm font-sans text-neutral-950"
							>Season End Date <span class="text-error-700">*</span></label
						>
						<input
							id="league-wizard-season-end"
							type="date"
							class="input-secondary"
							bind:value={createLeagueForm.league.seasonEndDate}
						/>
						{#if createLeagueFieldErrors['league.seasonEndDate']}
							<p class="mt-1 text-xs text-error-700">
								{createLeagueFieldErrors['league.seasonEndDate']}
							</p>
						{/if}
					</div>
				</div>

				{#if createLeagueFieldErrors['league.scheduleRange']}
					<p class="text-xs text-error-700">{createLeagueFieldErrors['league.scheduleRange']}</p>
				{/if}

				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div class="space-y-3 border border-neutral-950 bg-white p-3">
						<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
							<input
								type="checkbox"
								class="toggle-secondary"
								bind:checked={createLeagueForm.league.hasPreseason}
								onchange={() => {
									if (!createLeagueForm.league.hasPreseason) {
										createLeagueForm.league.preseasonStartDate = '';
										createLeagueForm.league.preseasonEndDate = '';
									}
								}}
							/>
							Has Preseason
						</label>
						{#if createLeagueForm.league.hasPreseason}
							<div class="space-y-3">
								<div>
									<label
										for="league-wizard-preseason-start"
										class="mb-1 block text-sm font-sans text-neutral-950">Preseason Start</label
									>
									<input
										id="league-wizard-preseason-start"
										type="date"
										class="input-secondary"
										bind:value={createLeagueForm.league.preseasonStartDate}
									/>
									{#if createLeagueFieldErrors['league.preseasonStartDate']}
										<p class="mt-1 text-xs text-error-700">
											{createLeagueFieldErrors['league.preseasonStartDate']}
										</p>
									{/if}
								</div>
								<div>
									<label
										for="league-wizard-preseason-end"
										class="mb-1 block text-sm font-sans text-neutral-950">Preseason End</label
									>
									<input
										id="league-wizard-preseason-end"
										type="date"
										class="input-secondary"
										bind:value={createLeagueForm.league.preseasonEndDate}
									/>
									{#if createLeagueFieldErrors['league.preseasonEndDate']}
										<p class="mt-1 text-xs text-error-700">
											{createLeagueFieldErrors['league.preseasonEndDate']}
										</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>

					<div class="space-y-3 border border-neutral-950 bg-white p-3">
						<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
							<input
								type="checkbox"
								class="toggle-secondary"
								bind:checked={createLeagueForm.league.hasPostseason}
								onchange={() => {
									if (!createLeagueForm.league.hasPostseason) {
										createLeagueForm.league.postseasonStartDate = '';
										createLeagueForm.league.postseasonEndDate = '';
									}
								}}
							/>
							Has Postseason
						</label>
						{#if createLeagueForm.league.hasPostseason}
							<div class="space-y-3">
								<div>
									<label
										for="league-wizard-postseason-start"
										class="mb-1 block text-sm font-sans text-neutral-950">Postseason Start</label
									>
									<input
										id="league-wizard-postseason-start"
										type="date"
										class="input-secondary"
										bind:value={createLeagueForm.league.postseasonStartDate}
									/>
									{#if createLeagueFieldErrors['league.postseasonStartDate']}
										<p class="mt-1 text-xs text-error-700">
											{createLeagueFieldErrors['league.postseasonStartDate']}
										</p>
									{/if}
								</div>
								<div>
									<label
										for="league-wizard-postseason-end"
										class="mb-1 block text-sm font-sans text-neutral-950">Postseason End</label
									>
									<input
										id="league-wizard-postseason-end"
										type="date"
										class="input-secondary"
										bind:value={createLeagueForm.league.postseasonEndDate}
									/>
									{#if createLeagueFieldErrors['league.postseasonEndDate']}
										<p class="mt-1 text-xs text-error-700">
											{createLeagueFieldErrors['league.postseasonEndDate']}
										</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div class="border border-neutral-950 bg-white p-3">
						<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
							<input
								type="checkbox"
								class="toggle-secondary"
								bind:checked={createLeagueForm.league.isActive}
							/>
							Active
						</label>
					</div>
					<div class="border border-neutral-950 bg-white p-3">
						<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
							<input
								type="checkbox"
								class="toggle-secondary"
								bind:checked={createLeagueForm.league.isLocked}
							/>
							Locked
						</label>
					</div>
				</div>

				<div>
					<label for="league-wizard-image-url" class="mb-1 block text-sm font-sans text-neutral-950"
						>Image URL</label
					>
					<input
						id="league-wizard-image-url"
						type="url"
						class="input-secondary"
						bind:value={createLeagueForm.league.imageUrl}
						placeholder="https://example.com/league-image.jpg"
						autocomplete="off"
					/>
					{#if createLeagueFieldErrors['league.imageUrl']}
						<p class="mt-1 text-xs text-error-700">{createLeagueFieldErrors['league.imageUrl']}</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if createLeagueStep === 4}
		<div class="space-y-4">
			<div class="space-y-2 border-2 border-neutral-950 bg-white p-4">
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Offering</h3>
					<HoverTooltip text="Edit offering details">
						<button
							type="button"
							class="button-secondary-outlined p-1.5 cursor-pointer"
							aria-label="Edit offering details"
							onclick={startEditingCreateLeagueOffering}
						>
							<IconPencil class="h-4 w-4" />
						</button>
					</HoverTooltip>
				</div>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Name:</span>
					{selectedLeagueWizardOffering?.name ?? 'Offering'}
				</p>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Type:</span>
					{selectedLeagueWizardOffering?.type === 'tournament' ? 'Tournament' : 'League'}
					<span class="ml-3 font-semibold">Season:</span>
					{getSeasonLabel()}
				</p>
			</div>

			<div class="space-y-3 border-2 border-neutral-950 bg-white p-4">
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">
						{entryUnitSingular() === 'group' ? 'Groups' : 'Leagues'}
					</h3>
					<HoverTooltip text={`Edit ${entryUnitPlural()}`}>
						<button
							type="button"
							class="button-secondary-outlined p-1.5 cursor-pointer"
							aria-label={`Edit ${entryUnitPlural()}`}
							onclick={startEditingCreateLeagues}
						>
							<IconPencil class="h-4 w-4" />
						</button>
					</HoverTooltip>
				</div>
				{#if createLeagueFieldErrors['leagues']}
					<p class="text-xs text-error-700">{createLeagueFieldErrors['leagues']}</p>
				{/if}
				{#if createLeagueForm.leagues.length === 0}
					<p class="text-sm font-sans text-neutral-950">
						No {entryUnitPlural()} will be created.
					</p>
				{:else}
					<div class="max-h-[45vh] space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400">
						{#each createLeagueForm.leagues as league}
							<div class="space-y-2 border border-neutral-950 bg-neutral p-3">
								<div>
									<p class="text-sm font-semibold text-neutral-950">
										{league.name.trim() || `Untitled ${entryUnitTitleSingular()}`}
									</p>
									<p class="text-xs text-neutral-900">Slug: {league.slug || 'TBD'}</p>
								</div>
								<div class="grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-neutral-950 sm:grid-cols-2">
									<p>
										<span class="font-semibold">Season:</span>
										{getSeasonLabel()}
									</p>
									<p>
										<span class="font-semibold">Gender:</span>
										{displayLeagueGender(league.gender) ?? 'Unspecified'}
									</p>
									<p>
										<span class="font-semibold">Skill Level:</span>
										{league.skillLevel ? toTitleCase(league.skillLevel) : 'Unspecified'}
									</p>
									<p>
										<span class="font-semibold">Status:</span>
										{league.isActive ? 'Active' : 'Inactive'} | {league.isLocked
											? 'Locked'
											: 'Unlocked'}
									</p>
									<p class="sm:col-span-2">
										<span class="font-semibold">Registration:</span>
										{formatReviewRange(league.regStartDate, league.regEndDate, true)}
									</p>
									<p class="sm:col-span-2">
										<span class="font-semibold">Season Dates:</span>
										{formatReviewRange(league.seasonStartDate, league.seasonEndDate)}
									</p>
									{#if league.hasPreseason}
										<p class="sm:col-span-2">
											<span class="font-semibold">Preseason:</span>
											{formatReviewRange(league.preseasonStartDate, league.preseasonEndDate)}
										</p>
									{/if}
									{#if league.hasPostseason}
										<p class="sm:col-span-2">
											<span class="font-semibold">Postseason:</span>
											{formatReviewRange(league.postseasonStartDate, league.postseasonEndDate)}
										</p>
									{/if}
								</div>
								{#if league.description.trim()}
									<p class="text-xs text-neutral-950">
										<span class="font-semibold">Description:</span>
										{league.description.trim()}
									</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<WizardStepFooter
			step={createLeagueStep}
			lastStep={4}
			showBack={createLeagueStep > 1}
			canGoNext={canGoNextCreateLeagueStep}
			canSubmit={canSubmitCreateLeague}
			nextLabel={createLeagueStep === 3 && createLeagueDraftActive
				? createLeagueEditingIndex === null
					? `Add ${entryUnitTitleSingular()}`
					: `Update ${entryUnitTitleSingular()}`
				: createLeagueStep === 2
					? 'Review'
					: 'Next'}
			submitLabel="Create"
			submittingLabel="Creating..."
			isSubmitting={createLeagueSubmitting}
			on:back={handleCreateLeagueBackAction}
			on:next={nextCreateLeagueStep}
		/>
	{/snippet}
</CreateLeagueWizard>
