<script lang="ts">
	import { invalidateAll, replaceState } from '$app/navigation';
	import { onDestroy, tick } from 'svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import {
		adjustEditingIndexOnRemove,
		adjustEditingIndexOnReorder,
		duplicateCollectionItem,
		moveCollectionItemByOffset,
		removeCollectionItem,
		applyLiveSlugInput,
		createWizardDirtyState,
		isRequiredFieldMessage,
		pickFieldErrors,
		slugifyFinal,
		toServerFieldErrorMap,
		WizardDraftCollection,
		WizardStepFooter
	} from '$lib/components/wizard';
	import CreateLeagueWizard from './_wizards/CreateLeagueWizard.svelte';
	import CreateOfferingWizard from './_wizards/CreateOfferingWizard.svelte';
	import CreateSeasonWizard from './_wizards/CreateSeasonWizard.svelte';
	import BulkEditLeaguesWizard from './_wizards/BulkEditLeaguesWizard.svelte';
	import EditOfferingWizard from './_wizards/EditOfferingWizard.svelte';
	import ManageSeasonWizard from './_wizards/ManageSeasonWizard.svelte';
	import type { PageData } from './$types';
	import {
		IconAlertTriangle,
		IconBallAmericanFootball,
		IconBallBaseball,
		IconBallBasketball,
		IconBallFootball,
		IconBallTennis,
		IconBallVolleyball,
		IconCalendar,
		IconCopy,
		IconCrosshair,
		IconDots,
		IconHistory,
		IconPencil,
		IconPlus,
		IconRestore,
		IconShip,
		IconTarget,
		IconTrash
	} from '@tabler/icons-svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import DataTableLinkedLabel from '$lib/components/data-table/DataTableLinkedLabel.svelte';
	import DataTableRowActions from '$lib/components/data-table/DataTableRowActions.svelte';
	import SplitAddAction from '$lib/components/dashboard/SplitAddAction.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import {
		createDataTableRowActionColumn,
		type DataTableColumn
	} from '$lib/components/data-table.js';
	import { buildPreviousOfferingLinkChoices } from '$lib/utils/offering-linking.js';
	import {
		getCurrentAcademicSeasonLabel,
		inferAcademicSeasonRangeFromName,
		resolveAcademicSeasonEndDate
	} from '$lib/utils/academic-season.js';
	import {
		buildOfferingTimelineGroups,
		formatTimelineRelativeDayLabel,
		findInitialTimelineGroup,
		getTimelineEventCompactLabel,
		type OfferingTimelineLeagueSource
	} from '$lib/utils/offering-sidebar-timeline.js';
	import {
		getCreateOfferingVisibleSteps,
		shouldShowOfferingLinkStep,
		type OfferingWizardStep as WizardStep
	} from '$lib/utils/offering-wizard-steps.js';
	import {
		getEffectiveOfferingEndMs,
		isOfferingTimelineConcluded
	} from '$lib/utils/offering-timeline.js';
	import { toast } from '$lib/toasts';
	import { generateUuidV4 } from '$lib/utils/uuid.js';

	type Activity = PageData['activities'][number];
	type LeagueOfferingOption = PageData['leagueOfferingOptions'][number];
	type OfferingTemplate = PageData['offeringTemplates'][number];
	type LeagueTemplate = PageData['leagueTemplates'][number];
	type OfferingStatus = 'open' | 'waitlisted' | 'closed';

	interface LeagueOffering {
		id: string;
		leagueSlug: string | null;
		leagueName: string;
		stackOrder: number;
		categoryLabel: string;
		divisionCount: number;
		status: OfferingStatus;
		statusLabel: 'Open' | 'Waitlist' | 'Closed' | 'Upcoming' | 'Concluded';
		teamRegistrationOpenText: string;
		teamRegistrationCloseText: string;
		teamRegistrationOpenDate: string | null;
		teamRegistrationDate: string | null;
		teamRegistrationCloseDate: string | null;
		joinTeamText: string;
		joinTeamDate: string | null;
		seasonRangeText: string;
		seasonStartDate: string | null;
		seasonEndDate: string | null;
		hasPostseason: boolean;
		postseasonEndDate: string | null;
		seasonConcluded: boolean;
	}

	interface OfferingGroup {
		offeringId: string | null;
		offeringName: string;
		offeringSlug: string;
		offeringType: 'league' | 'tournament';
		divisionCount: number;
		openCount: number;
		waitlistedCount: number;
		closedCount: number;
		leagues: LeagueOffering[];
	}

	interface SeasonBoard {
		key: string;
		label: string;
		offerings: OfferingGroup[];
		totalOfferings: number;
		totalLeagues: number;
		totalDivisions: number;
		openCount: number;
		waitlistedCount: number;
		closedCount: number;
	}

	type SeasonHistorySeason = PageData['seasons'][number];

	interface OfferingTimelineOfferingBucket {
		key: string;
		offeringName: string;
		offeringSlug: string;
		events: {
			id: string;
			type: 'registration-deadline' | 'join-team-deadline' | 'season-start' | 'season-end';
			date: string;
			label: string;
			leagueId: string;
			categoryLabel: string;
			offeringName: string;
			offeringSlug: string;
			isPast: boolean;
		}[];
	}

	interface OfferingTimelineDisplayGroup {
		id: string;
		date: string;
		ms: number;
		isPast: boolean;
		offeringBuckets: OfferingTimelineOfferingBucket[];
	}

	type RegistrationWindowState = 'upcoming' | 'open' | 'closed';
	type OfferingView = 'leagues' | 'tournaments' | 'all';
	type LeagueWizardStep = 1 | 2 | 3 | 4;
	type BulkLeagueWizardStep = 1 | 2 | 3;
	type SeasonWizardStep = 1 | 2 | 3 | 4;
	type AuthRole = 'participant' | 'manager' | 'admin' | 'dev';
	type LeagueWizardMode = 'create' | 'edit';
	type SeasonCopyScope = 'offerings-only' | 'offerings-leagues' | 'offerings-all';
	type LeagueChoice = 'yes' | 'no';
	type LeagueGender = '' | 'male' | 'female' | 'mixed';
	type LeagueSkillLevel = '' | 'competitive' | 'intermediate' | 'recreational' | 'all';
	type BulkBooleanChoice = 'unchanged' | 'true' | 'false';
	type BulkLeagueGenderChoice = 'unchanged' | 'male' | 'female' | 'mixed';
	type BulkLeagueSkillLevelChoice =
		| 'unchanged'
		| 'competitive'
		| 'intermediate'
		| 'recreational'
		| 'all';
	interface DropdownOption {
		value: string;
		label: string;
		statusLabel?: string;
		disabled?: boolean;
		separatorBefore?: boolean;
		tooltip?: string;
		disabledTooltip?: string;
	}

	interface WizardOfferingInput {
		seasonId: string;
		name: string;
		slug: string;
		linkedOfferingId: string;
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

	interface WizardFormState {
		offering: WizardOfferingInput;
		addLeagues: LeagueChoice;
		league: WizardLeagueInput;
		leagues: WizardLeagueInput[];
	}

	interface LeagueWizardFormState {
		offeringId: string;
		league: WizardLeagueInput;
		leagues: WizardLeagueInput[];
	}

	interface BulkLeagueEditFormState {
		description: string;
		gender: BulkLeagueGenderChoice;
		skillLevel: BulkLeagueSkillLevelChoice;
		regStartDate: string;
		regEndDate: string;
		seasonStartDate: string;
		seasonEndDate: string;
		hasPostseason: BulkBooleanChoice;
		postseasonStartDate: string;
		postseasonEndDate: string;
		hasPreseason: BulkBooleanChoice;
		preseasonStartDate: string;
		preseasonEndDate: string;
		isActive: BulkBooleanChoice;
		isLocked: BulkBooleanChoice;
		imageUrl: string;
	}

	interface WizardSeasonInput {
		name: string;
		slug: string;
		startDate: string;
		endDate: string;
		isCurrent: boolean;
		isActive: boolean;
	}

	interface WizardSeasonCopyInput {
		enabled: boolean;
		sourceSeasonId: string;
		scope: SeasonCopyScope;
		includeDivisions: boolean;
	}

	interface UpdateOfferingApiResponse {
		success: boolean;
		data?: {
			offeringId: string;
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	interface SeasonCopyPreview {
		offeringCount: number;
		leagueCount: number;
		tournamentGroupCount: number;
		divisionCount: number;
	}

	interface CreateOfferingApiResponse {
		success: boolean;
		data?: {
			offeringId: string;
			leagueIds: string[];
			activities: Activity[];
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	interface CreateSeasonApiResponse {
		success: boolean;
		data?: {
			season: {
				id: string;
				name: string;
				slug: string;
				startDate: string;
				endDate: string | null;
				isCurrent: boolean;
				isActive: boolean;
			};
			copySummary?: {
				offeringCount: number;
				leagueCount: number;
				divisionCount: number;
			};
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	interface UpdateLeagueApiResponse {
		success: boolean;
		data?: {
			leagueId: string;
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	interface BulkUpdateLeaguesApiResponse {
		success: boolean;
		data?: {
			leagueIds: string[];
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	const OFFERING_VIEW_STORAGE_KEY = 'intramural-offerings-view-mode';
	const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
	const DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
	const WIZARD_STEP_TITLES: Record<WizardStep, string> = {
		1: 'Offering Basics',
		2: 'Link to Previous Offering',
		3: 'Offering Setup',
		4: 'League Options',
		5: 'League Schedule',
		6: 'Review & Create'
	};
	const SEASON_WIZARD_STEP_TITLES: Record<SeasonWizardStep, string> = {
		1: 'Season Details',
		2: 'Copy Content',
		3: 'Current Season Transition',
		4: 'Review & Create'
	};
	const BULK_LEAGUE_WIZARD_STEP_TITLES: Record<BulkLeagueWizardStep, string> = {
		1: 'Select Leagues',
		2: 'Shared Updates',
		3: 'Review Changes'
	};
	const COMPACT_DROPDOWN_BUTTON_CLASS =
		'button-neutral-outlined w-auto h-[1.875rem] min-w-36 px-3 py-1 text-sm font-semibold cursor-pointer inline-flex items-center justify-between gap-2';
	const HISTORY_BUTTON_CLASS =
		'button-neutral-outlined h-[1.875rem] w-[1.875rem] px-0 cursor-pointer inline-flex items-center justify-center text-neutral-950';
	const HISTORY_DROPDOWN_LIST_CLASS = 'w-64';
	const HISTORY_DROPDOWN_FOOTER_ACTION_CLASS =
		'w-full button-neutral-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer justify-center';
	const HISTORY_DROPDOWN_FOOTER_ICON_ACTION_CLASS =
		'button-neutral-outlined dashboard-icon-button cursor-pointer text-neutral-950';
	const HEADER_ICON_CLASS = 'h-4 w-4 shrink-0 text-neutral-950';
	const HEADER_COUNT_BADGE_CLASS =
		'badge-neutral-outlined h-[1.875rem] bg-transparent px-2.5 font-normal normal-case tracking-normal';
	const HEADER_SPLIT_ADD_BUTTON_CLASS =
		'button-primary-outlined h-[1.875rem] px-2 text-xs font-bold uppercase tracking-wide cursor-pointer';
	const HEADER_SPLIT_ADD_MENU_BUTTON_CLASS =
		'button-primary-outlined -ml-[2px] h-[1.875rem] px-1 cursor-pointer';
	const DEFAULT_ACADEMIC_SEASON_PLACEHOLDER = getCurrentAcademicSeasonLabel();
	const FORM_DROPDOWN_BUTTON_CLASS =
		'w-full border-2 border-secondary-400 bg-white px-4 py-2 text-base leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)] disabled:cursor-not-allowed disabled:opacity-60';
	let { data } = $props<{ data: PageData }>();
	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).offerings
	);

	function normalizeAuthRole(value: string | null | undefined): AuthRole {
		const normalized = value?.trim().toLowerCase();
		if (normalized === 'manager' || normalized === 'admin' || normalized === 'dev') {
			return normalized;
		}
		return 'participant';
	}

	const canManageOfferings = $derived.by(() => data.permissions?.MANAGE_OFFERINGS === true);
	const canEditLeagueRows = $derived.by(() => canManageOfferings);
	const canEditOfferingSettings = $derived.by(() => canManageOfferings);

	let activities = $state<Activity[]>([]);
	let seasons = $state<PageData['seasons']>([]);
	let selectedSeasonId = $state('');
	const offeringTemplates = $derived.by(() => data.offeringTemplates ?? []);
	let leagueTemplates = $state<LeagueTemplate[]>([]);
	let leagueOfferingOptions = $state<PageData['leagueOfferingOptions']>([]);
	let searchQuery = $state('');
	let offeringView = $state<OfferingView>('all');
	let offeringViewHydrated = $state(false);
	let seasonSelectionHydrated = $state(false);
	let createLeagueRequestHydrated = $state(false);
	let highlightedLeagueRowId = $state<string | null>(null);
	let highlightedOfferingArticleId = $state<string | null>(null);
	let timelineContainerElement = $state<HTMLDivElement | null>(null);
	let highlightTimeout: ReturnType<typeof setTimeout> | null = null;
	let offeringHighlightTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastTimelineAutoScrollSignature = '';
	let isCreateSeasonModalOpen = $state(false);
	let isManageSeasonModalOpen = $state(false);
	let createSeasonWizardUnsavedConfirmOpen = $state(false);
	let createSeasonStep = $state<SeasonWizardStep>(1);
	let createSeasonSubmitting = $state(false);
	let createSeasonFormError = $state('');
	let createSeasonServerFieldErrors = $state<Record<string, string>>({});
	let seasonSlugTouched = $state(false);
	let createSeasonStartDateTouched = $state(false);
	let createSeasonEndDateTouched = $state(false);
	let createSeasonForm = $state<WizardSeasonInput>(createEmptySeasonForm(false));
	let createSeasonInitialForm = $state<WizardSeasonInput>(createEmptySeasonForm(false));
	let createSeasonCopy = $state<WizardSeasonCopyInput>({
		enabled: false,
		sourceSeasonId: '',
		scope: 'offerings-all',
		includeDivisions: false
	});
	let createSeasonInitialCopy = $state<WizardSeasonCopyInput>({
		enabled: false,
		sourceSeasonId: '',
		scope: 'offerings-all',
		includeDivisions: false
	});
	let createSeasonReplaceExistingCurrent = $state(true);
	let createSeasonDeactivateExistingCurrent = $state(false);
	let isCreateModalOpen = $state(false);
	let createWizardUnsavedConfirmOpen = $state(false);
	let createStep = $state<WizardStep>(1);
	let createSubmitting = $state(false);
	let createFormError = $state('');
	let createSuccessMessage = $state('');
	let isEditOfferingModalOpen = $state(false);
	let editOfferingWizardUnsavedConfirmOpen = $state(false);
	let editOfferingValidationVisible = $state(false);
	let editOfferingSubmitting = $state(false);
	let editOfferingFormError = $state('');
	let editOfferingServerFieldErrors = $state<Record<string, string>>({});
	let editingOfferingId = $state<string | null>(null);
	let bulkEditingOfferingId = $state<string | null>(null);
	let bulkEditingOfferingName = $state('');
	let bulkEditingEntryLabelPlural = $state('Leagues');
	let offeringSlugTouched = $state(false);
	let leagueSlugTouched = $state(false);
	let leagueEditingIndex = $state<number | null>(null);
	let leagueDraftActive = $state(false);
	let serverFieldErrors = $state<Record<string, string>>({});
	let isBulkEditLeaguesModalOpen = $state(false);
	let bulkEditLeaguesUnsavedConfirmOpen = $state(false);
	let bulkEditLeaguesValidationVisible = $state(false);
	let bulkEditLeaguesStep = $state<BulkLeagueWizardStep>(1);
	let bulkEditLeaguesSubmitting = $state(false);
	let bulkEditLeaguesFormError = $state('');
	let bulkEditLeaguesServerFieldErrors = $state<Record<string, string>>({});
	let bulkEditLeagueSelectedIds = $state<string[]>([]);
	let isCreateLeagueModalOpen = $state(false);
	let createLeagueWizardUnsavedConfirmOpen = $state(false);
	let createLeagueStep = $state<LeagueWizardStep>(1);
	let createLeagueMode = $state<LeagueWizardMode>('create');
	let createLeagueSubmitting = $state(false);
	let createLeagueFormError = $state('');
	let createLeagueOfferingFilter = $state<'league' | 'tournament' | 'all'>('all');
	let createLeagueEditingIndex = $state<number | null>(null);
	let editingLeagueId = $state<string | null>(null);
	let editingLeagueOfferingSlug = $state<string | null>(null);
	let createLeagueDraftActive = $state(false);
	let createLeagueSlugTouched = $state(false);
	let createLeagueCopiedFromExisting = $state(false);
	let createLeagueServerFieldErrors = $state<Record<string, string>>({});
	let createLeagueForm = $state<LeagueWizardFormState>(createEmptyCreateLeagueForm());
	let editOfferingForm = $state<WizardOfferingInput>(createEmptyOfferingInput());
	let bulkEditLeaguesForm = $state<BulkLeagueEditFormState>(createEmptyBulkLeagueEditForm());
	let createSeasonStartDateInput = $state<HTMLInputElement | null>(null);
	let createSeasonEndDateInput = $state<HTMLInputElement | null>(null);
	let lastPageErrorToast = $state('');
	let lastSuccessToast = $state('');
	const createOfferingWizardDirtyState = createWizardDirtyState<WizardFormState>();
	const editOfferingWizardDirtyState = createWizardDirtyState<WizardOfferingInput>();
	const bulkEditLeaguesDirtyState = createWizardDirtyState<{
		offeringId: string | null;
		selectedLeagueIds: string[];
		form: BulkLeagueEditFormState;
	}>();
	const createLeagueWizardDirtyState = createWizardDirtyState<LeagueWizardFormState>();
	const createSeasonWizardDirtyState = createWizardDirtyState<{
		form: WizardSeasonInput;
		copy: WizardSeasonCopyInput;
		replaceExistingCurrent: boolean;
		deactivateExistingCurrent: boolean;
	}>();

	function padTwo(value: number): string {
		return String(value).padStart(2, '0');
	}

	$effect(() => {
		const message = (data?.error ?? '').trim();
		if (!message) {
			lastPageErrorToast = '';
			return;
		}

		if (message === lastPageErrorToast) {
			return;
		}

		lastPageErrorToast = message;
		toast.error(message, {
			id: 'offerings-page-error',
			title: pageLabel,
			duration: null,
			showProgress: false
		});
	});

	$effect(() => {
		const message = createSuccessMessage.trim();
		if (!message) {
			lastSuccessToast = '';
			return;
		}

		if (message === lastSuccessToast) {
			return;
		}

		lastSuccessToast = message;
		toast.success(message, {
			id: 'offerings-success',
			title: pageLabel
		});
	});

	function todayDateString(): string {
		const now = new Date();
		return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
	}

	function formatDateOnly(date: Date): string {
		return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
	}

	function parseDateOnly(value: string): Date | null {
		const normalized = value.trim();
		if (!DATE_REGEX.test(normalized)) return null;

		const [yearPart, monthPart, dayPart] = normalized.split('-');
		const year = Number(yearPart);
		const month = Number(monthPart);
		const day = Number(dayPart);
		const parsed = new Date(year, month - 1, day);
		if (
			Number.isNaN(parsed.getTime()) ||
			parsed.getFullYear() !== year ||
			parsed.getMonth() !== month - 1 ||
			parsed.getDate() !== day
		) {
			return null;
		}
		return parsed;
	}

	function seasonStatusLabelForHistory(season: SeasonHistorySeason): 'CURRENT' | 'PAST' | 'FUTURE' {
		if (season.isCurrent) return 'CURRENT';
		const today = todayDateString();
		return season.startDate > today ? 'FUTURE' : 'PAST';
	}

	function seasonHistoryRank(season: SeasonHistorySeason): number {
		if (season.isCurrent) return 1;
		const today = todayDateString();
		return season.startDate > today ? 0 : 2;
	}

	function compareSeasonHistoryOrder(a: SeasonHistorySeason, b: SeasonHistorySeason): number {
		const rankDiff = seasonHistoryRank(a) - seasonHistoryRank(b);
		if (rankDiff !== 0) return rankDiff;

		const startDateDiff = b.startDate.localeCompare(a.startDate);
		if (startDateDiff !== 0) return startDateDiff;

		return a.name.localeCompare(b.name);
	}

	function defaultDateTimeValue(type: 'start' | 'end'): string {
		return `${todayDateString()}T${type === 'start' ? '00:00' : '23:59'}`;
	}

	function defaultLeagueSlug(leagueName: string, offeringName: string): string {
		void offeringName;
		return slugifyFinal(leagueName);
	}

	function defaultLeagueNamePlaceholder(isTournament: boolean): string {
		return isTournament ? 'Pool A' : "Men's";
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

	function handleSeasonHistoryChange(value: string): void {
		if (!value || value === selectedSeasonId) return;
		selectedSeasonId = value;
	}

	function openDatePicker(input: HTMLInputElement | null): void {
		if (!input) return;
		input.focus();
		const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
		pickerInput.showPicker?.();
	}

	function focusCreateSeasonEndDateOnReverseTab(event: KeyboardEvent): void {
		if (event.key !== 'Tab' || !event.shiftKey) return;
		if (!createSeasonEndDateInput) return;
		event.preventDefault();
		createSeasonEndDateInput.focus();
	}

	function createLeagueDraftId(): string {
		return generateUuidV4();
	}

	function createEmptyLeague(): WizardLeagueInput {
		return {
			draftId: createLeagueDraftId(),
			name: '',
			slug: '',
			stackOrder: 1,
			isSlugManual: false,
			description: '',
			seasonId: '',
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

	function createEmptyOfferingInput(): WizardOfferingInput {
		return {
			seasonId: '',
			name: '',
			slug: '',
			linkedOfferingId: '',
			isActive: true,
			imageUrl: '',
			minPlayers: 0,
			maxPlayers: 0,
			rulebookUrl: '',
			sport: '',
			type: 'league',
			description: ''
		};
	}

	function createEmptyCreateForm(): WizardFormState {
		return {
			offering: createEmptyOfferingInput(),
			addLeagues: 'no',
			league: createEmptyLeague(),
			leagues: []
		};
	}

	function createEmptyCreateLeagueForm(): LeagueWizardFormState {
		return {
			offeringId: '',
			league: createEmptyLeague(),
			leagues: []
		};
	}

	function createEmptyBulkLeagueEditForm(): BulkLeagueEditFormState {
		return {
			description: '',
			gender: 'unchanged',
			skillLevel: 'unchanged',
			regStartDate: '',
			regEndDate: '',
			seasonStartDate: '',
			seasonEndDate: '',
			hasPostseason: 'unchanged',
			postseasonStartDate: '',
			postseasonEndDate: '',
			hasPreseason: 'unchanged',
			preseasonStartDate: '',
			preseasonEndDate: '',
			isActive: 'unchanged',
			isLocked: 'unchanged',
			imageUrl: ''
		};
	}

	function createEmptySeasonForm(defaultCurrent: boolean): WizardSeasonInput {
		const startDate = todayDateString();
		return {
			name: '',
			slug: '',
			startDate,
			endDate: resolveAcademicSeasonEndDate('', startDate),
			isCurrent: defaultCurrent,
			isActive: true
		};
	}

	function createEmptySeasonCopy(defaultSourceSeasonId: string): WizardSeasonCopyInput {
		return {
			enabled: false,
			sourceSeasonId: defaultSourceSeasonId,
			scope: 'offerings-all',
			includeDivisions: false
		};
	}

	let createForm = $state<WizardFormState>(createEmptyCreateForm());

	function isTournamentWizard(): boolean {
		return createForm.offering.type === 'tournament';
	}

	function wizardUnitSingular(): 'league' | 'group' {
		return isTournamentWizard() ? 'group' : 'league';
	}

	function wizardUnitPlural(): 'leagues' | 'groups' {
		return isTournamentWizard() ? 'groups' : 'leagues';
	}

	function wizardUnitTitleSingular(): 'League' | 'Group' {
		return isTournamentWizard() ? 'Group' : 'League';
	}

	function wizardUnitTitlePlural(): 'Leagues' | 'Groups' {
		return isTournamentWizard() ? 'Groups' : 'Leagues';
	}

	function wizardStepTitle(step: WizardStep): string {
		if (step === 4) return isTournamentWizard() ? 'Tournament Groups' : 'League Options';
		if (step === 5) return isTournamentWizard() ? 'Tournament Schedule' : 'League Schedule';
		return WIZARD_STEP_TITLES[step];
	}

	function seasonWizardStepTitle(step: SeasonWizardStep): string {
		return SEASON_WIZARD_STEP_TITLES[step];
	}

	function seasonCopyScopeLabel(scope: SeasonCopyScope): string {
		if (scope === 'offerings-only') return 'Offerings only';
		if (scope === 'offerings-leagues') return 'Offerings + leagues';
		return 'Offerings + leagues + tournaments';
	}

	function addEntryActionLabel(): 'Add League' | 'Add Group' | 'Add League/Group' {
		if (offeringView === 'tournaments') return 'Add Group';
		if (offeringView === 'all') return 'Add League/Group';
		return 'Add League';
	}

	function handleOfferingViewChange(value: string): void {
		if (value !== 'leagues' && value !== 'tournaments' && value !== 'all') return;
		offeringView = value;
	}

	function handleAddActionDropdown(value: string): void {
		if (!canManageOfferings) return;
		if (value === 'add-offering') {
			openCreateWizard();
			return;
		}
		if (value === 'add-entry') {
			if (addEntryOptionCount <= 0) return;
			openCreateLeagueWizard();
			return;
		}
		if (value === 'add-season') {
			openCreateSeasonWizard();
		}
	}

	function handleCreateLeagueOfferingChange(value: string): void {
		if (
			value !== createLeagueForm.offeringId &&
			(createLeagueForm.leagues.length > 0 || createLeagueDraftActive)
		) {
			const confirmed =
				typeof window === 'undefined'
					? true
					: window.confirm(
							'Switching offerings clears your in-progress league/group list. Continue?'
						);
			if (!confirmed) return;
			createLeagueForm.leagues = [];
			cancelCreateLeagueDraft();
			createLeagueCopiedFromExisting = false;
		}

		createLeagueForm.offeringId = value;
		if (!createLeagueSlugTouched) {
			const offeringName = getLeagueOfferingById(value)?.name ?? '';
			createLeagueForm.league.slug = defaultLeagueSlug(createLeagueForm.league.name, offeringName);
		}
		clearCreateLeagueApiErrors();
	}

	function wizardEntryType(): 'league' | 'tournament' | null {
		const selectedOffering = getLeagueOfferingById(createLeagueForm.offeringId);
		if (selectedOffering) return selectedOffering.type;
		if (createLeagueOfferingFilter === 'all') return null;
		return createLeagueOfferingFilter;
	}

	function wizardEntryUnitSingular(): 'league' | 'group' | 'league/group' {
		const type = wizardEntryType();
		if (type === 'tournament') return 'group';
		if (type === 'league') return 'league';
		return 'league/group';
	}

	function wizardEntryUnitPlural(): 'leagues' | 'groups' | 'leagues/groups' {
		const type = wizardEntryType();
		if (type === 'tournament') return 'groups';
		if (type === 'league') return 'leagues';
		return 'leagues/groups';
	}

	function wizardEntryUnitTitleSingular(): 'League' | 'Group' | 'League/Group' {
		const type = wizardEntryType();
		if (type === 'tournament') return 'Group';
		if (type === 'league') return 'League';
		return 'League/Group';
	}

	function wizardEntryUnitTitlePlural(): 'Leagues' | 'Groups' | 'Leagues/Groups' {
		const type = wizardEntryType();
		if (type === 'tournament') return 'Groups';
		if (type === 'league') return 'Leagues';
		return 'Leagues/Groups';
	}

	function wizardEntryStepTitle(step: LeagueWizardStep): string {
		if (step === 1) return 'Choose Offering';
		if (step === 2) return `${wizardEntryUnitTitleSingular()} Basics`;
		if (step === 3) return `${wizardEntryUnitTitleSingular()} Schedule`;
		return createLeagueMode === 'edit' ? 'Review & Update' : 'Review & Create';
	}

	function getSeasonById(seasonId: string | null | undefined) {
		if (!seasonId) return null;
		return seasons.find((season) => season.id === seasonId) ?? null;
	}

	function seasonUrlSlug(season: PageData['seasons'][number]): string {
		return slugifyFinal(season.name ?? '');
	}

	function resolveSeasonIdFromUrlSeasonParam(value: string | null): string | null {
		if (!value) return null;
		const normalized = value.trim();
		if (!normalized) return null;
		const bySlug = seasons.find((season) => seasonUrlSlug(season) === normalized);
		if (bySlug) return bySlug.id;
		// Backward compatibility for older links that used season IDs.
		const byId = seasons.find((season) => season.id === normalized);
		return byId?.id ?? null;
	}

	function normalizeSeasonName(value: string | null | undefined): string {
		return value?.trim().toLowerCase() ?? '';
	}

	function getSeasonLabel(seasonId: string | null | undefined): string {
		const season = getSeasonById(seasonId);
		return season?.name ?? 'Unscheduled';
	}

	function resolveActivitySeasonId(activity: Activity): string | null {
		if (activity.seasonId) return activity.seasonId;
		const activitySeasonName = normalizeSeasonName(activity.seasonLabel ?? activity.season);
		if (!activitySeasonName) return null;
		const matchedSeason = seasons.find(
			(season) => normalizeSeasonName(season.name) === activitySeasonName
		);
		return matchedSeason?.id ?? null;
	}

	function getLeagueRowId(offeringSlug: string, leagueId: string): string {
		return `league-row-${offeringSlug}-${leagueId}`;
	}

	function getOfferingArticleId(offeringSlug: string): string {
		return `offering-article-${offeringSlug}`;
	}

	async function scrollToOfferingArticle(offeringSlug: string): Promise<void> {
		if (typeof window === 'undefined') return;
		const articleId = getOfferingArticleId(offeringSlug);

		let articleElement = document.getElementById(articleId);
		if (!articleElement && searchQuery.trim().length > 0) {
			searchQuery = '';
			await tick();
			articleElement = document.getElementById(articleId);
		}

		if (!articleElement) return;

		articleElement.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
			inline: 'nearest'
		});

		if (offeringHighlightTimeout) clearTimeout(offeringHighlightTimeout);
		if (highlightedOfferingArticleId === articleId) {
			highlightedOfferingArticleId = null;
			await tick();
		}

		highlightedOfferingArticleId = articleId;
		offeringHighlightTimeout = setTimeout(() => {
			if (highlightedOfferingArticleId === articleId) highlightedOfferingArticleId = null;
		}, 3000);
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

		if (!rowElement) {
			const matchedActivity = activities.find(
				(activity) => activity.id === leagueId || activity.leagueId === leagueId
			);
			const activitySeasonId = matchedActivity ? resolveActivitySeasonId(matchedActivity) : null;
			if (activitySeasonId && activitySeasonId !== selectedSeasonId) {
				selectedSeasonId = activitySeasonId;
				await tick();
				rowElement = document.getElementById(rowId);
			}
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
		if (offeringHighlightTimeout) clearTimeout(offeringHighlightTimeout);
	});

	$effect(() => {
		activities = [...(data.activities ?? [])];
	});

	$effect(() => {
		seasons = [...(data.seasons ?? [])].sort(compareSeasonHistoryOrder);
	});

	$effect(() => {
		if (seasons.length === 0) {
			selectedSeasonId = '';
			seasonSelectionHydrated = true;
			return;
		}
		const selectableSeasons = seasons.filter((season) => season.isActive);
		const seasonPool = selectableSeasons.length > 0 ? selectableSeasons : seasons;

		if (!seasonSelectionHydrated) {
			if (shouldHydrateSeasonFromUrlOnLoad()) {
				const seasonFromUrl = readSeasonFromUrl();
				if (seasonFromUrl && seasonPool.some((season) => season.id === seasonFromUrl)) {
					selectedSeasonId = seasonFromUrl;
					seasonSelectionHydrated = true;
					return;
				}
			}
			seasonSelectionHydrated = true;
		}

		const preferredSeasonId = data.currentSeasonId ?? seasonPool[0]?.id ?? '';
		if (!selectedSeasonId || !seasonPool.some((season) => season.id === selectedSeasonId)) {
			selectedSeasonId = seasonPool.some((season) => season.id === preferredSeasonId)
				? preferredSeasonId
				: (seasonPool[0]?.id ?? '');
		}
	});

	$effect(() => {
		leagueTemplates = [...(data.leagueTemplates ?? [])];
	});

	$effect(() => {
		leagueOfferingOptions = [...(data.leagueOfferingOptions ?? [])];
	});

	function isOfferingView(value: string | null): value is OfferingView {
		return value === 'leagues' || value === 'tournaments' || value === 'all';
	}

	function normalizeOfferingViewAlias(value: string | null): string | null {
		if (!value) return value;
		if (value === 'sports' || value === 'sport' || value === 'league') return 'leagues';
		if (value === 'tournament') return 'tournaments';
		return value;
	}

	function readStoredOfferingView(): OfferingView | null {
		if (typeof window === 'undefined') return null;
		try {
			const saved = window.localStorage.getItem(OFFERING_VIEW_STORAGE_KEY);
			const normalizedSavedView = normalizeOfferingViewAlias(saved);
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

	function readSeasonFromUrl(): string | null {
		if (typeof window === 'undefined') return null;
		try {
			const url = new URL(window.location.href);
			const seasonFromUrl = url.searchParams.get('season');
			return resolveSeasonIdFromUrlSeasonParam(seasonFromUrl);
		} catch {
			return null;
		}
	}

	function readCreateLeagueRequestFromUrl(): { offeringId: string } | null {
		if (typeof window === 'undefined') return null;
		try {
			const url = new URL(window.location.href);
			if (url.searchParams.get('action') !== 'create-league') {
				return null;
			}
			const offeringId = url.searchParams.get('offeringId')?.trim() ?? '';
			if (!offeringId) return null;
			return { offeringId };
		} catch {
			return null;
		}
	}

	function clearCreateLeagueRequestFromUrl(): void {
		if (typeof window === 'undefined') return;
		try {
			const url = new URL(window.location.href);
			url.searchParams.delete('action');
			url.searchParams.delete('offeringId');
			replaceState(`${url.pathname}${url.search}${url.hash}`, {});
		} catch {
			// Ignore history state errors in restrictive browser modes.
		}
	}

	function shouldHydrateSeasonFromUrlOnLoad(): boolean {
		if (typeof window === 'undefined' || typeof performance === 'undefined') return false;
		try {
			const [navigationEntry] = performance.getEntriesByType(
				'navigation'
			) as PerformanceNavigationTiming[];
			return navigationEntry?.type === 'reload';
		} catch {
			return false;
		}
	}

	function resetCreateWizard(): void {
		createStep = 1;
		createSubmitting = false;
		createFormError = '';
		createWizardUnsavedConfirmOpen = false;
		offeringSlugTouched = false;
		leagueSlugTouched = false;
		leagueEditingIndex = null;
		leagueDraftActive = false;
		serverFieldErrors = {};
		createForm = createEmptyCreateForm();
		createOfferingWizardDirtyState.clearBaseline();
	}

	function resetCreateSeasonWizard(): void {
		const baseForm = createEmptySeasonForm(seasons.length === 0);
		const defaultCopySourceSeasonId =
			selectedSeasonId && seasons.some((season) => season.id === selectedSeasonId)
				? selectedSeasonId
				: (seasons[0]?.id ?? '');
		const baseCopy = createEmptySeasonCopy(defaultCopySourceSeasonId);
		createSeasonStep = 1;
		createSeasonSubmitting = false;
		createSeasonFormError = '';
		createSeasonWizardUnsavedConfirmOpen = false;
		createSeasonServerFieldErrors = {};
		seasonSlugTouched = false;
		createSeasonStartDateTouched = false;
		createSeasonEndDateTouched = false;
		createSeasonCopy = { ...baseCopy };
		createSeasonInitialCopy = { ...baseCopy };
		createSeasonReplaceExistingCurrent = true;
		createSeasonDeactivateExistingCurrent = false;
		createSeasonForm = { ...baseForm };
		createSeasonInitialForm = { ...baseForm };
		createSeasonWizardDirtyState.clearBaseline();
	}

	function resetCreateLeagueWizard(): void {
		createLeagueMode = 'create';
		createLeagueStep = 1;
		createLeagueSubmitting = false;
		createLeagueFormError = '';
		createLeagueWizardUnsavedConfirmOpen = false;
		createLeagueEditingIndex = null;
		editingLeagueId = null;
		editingLeagueOfferingSlug = null;
		createLeagueDraftActive = false;
		createLeagueSlugTouched = false;
		createLeagueCopiedFromExisting = false;
		createLeagueServerFieldErrors = {};
		createLeagueForm = createEmptyCreateLeagueForm();
		createLeagueWizardDirtyState.clearBaseline();
	}

	function openCreateSeasonWizardWithCopy(copyFromSeasonId?: string): void {
		if (!canManageOfferings) return;
		resetCreateSeasonWizard();
		const normalizedSourceSeasonId = copyFromSeasonId?.trim() ?? '';
		if (
			normalizedSourceSeasonId &&
			seasons.some((season) => season.id === normalizedSourceSeasonId)
		) {
			const duplicateCopyDefaults: WizardSeasonCopyInput = {
				...createSeasonCopy,
				enabled: true,
				sourceSeasonId: normalizedSourceSeasonId
			};
			createSeasonCopy = { ...duplicateCopyDefaults };
			createSeasonInitialCopy = { ...duplicateCopyDefaults };
		}
		createSeasonWizardDirtyState.captureBaseline({
			form: createSeasonForm,
			copy: createSeasonCopy,
			replaceExistingCurrent: createSeasonReplaceExistingCurrent,
			deactivateExistingCurrent: createSeasonDeactivateExistingCurrent
		});
		isCreateSeasonModalOpen = true;
	}

	function openCreateSeasonWizard(): void {
		openCreateSeasonWizardWithCopy();
	}

	function applyCreateSeasonDateInferenceFromName(nextName: string): void {
		const inferredRange = inferAcademicSeasonRangeFromName(nextName);
		if (!inferredRange) return;

		if (!createSeasonStartDateTouched) {
			createSeasonForm.startDate = inferredRange.startDate;
		}
		if (!createSeasonEndDateTouched) {
			createSeasonForm.endDate = inferredRange.endDate;
		}
	}

	function syncCreateSeasonEndDateFromStart(nextStartDate: string): void {
		if (createSeasonEndDateTouched) return;
		createSeasonForm.endDate = resolveAcademicSeasonEndDate(createSeasonForm.name, nextStartDate);
	}

	function openManageSeasonWizard(): void {
		if (!canManageOfferings) return;
		isManageSeasonModalOpen = true;
	}

	function openCreateWizard(): void {
		if (!canManageOfferings) return;
		resetCreateWizard();
		createForm.offering.type = createWizardDefaultOfferingType();
		createForm.offering.seasonId = selectedSeasonId;
		createForm.league.seasonId = selectedSeasonId;
		createOfferingWizardDirtyState.captureBaseline(createForm);
		isCreateModalOpen = true;
	}

	function openCreateLeagueWizard(): void {
		if (!canManageOfferings) return;
		resetCreateLeagueWizard();
		createLeagueMode = 'create';
		createLeagueOfferingFilter =
			offeringView === 'tournaments' ? 'tournament' : offeringView === 'leagues' ? 'league' : 'all';
		createLeagueForm.league.seasonId = selectedSeasonId;
		createLeagueWizardDirtyState.captureBaseline(createLeagueForm);
		isCreateLeagueModalOpen = true;
	}

	function openCreateLeagueWizardForOffering(offeringId: string): boolean {
		if (!canManageOfferings) return false;
		const selectedOffering = getLeagueOfferingById(offeringId);
		if (!selectedOffering?.id) return false;
		resetCreateLeagueWizard();
		createLeagueMode = 'create';
		createLeagueOfferingFilter = selectedOffering.type === 'tournament' ? 'tournament' : 'league';
		createLeagueForm.offeringId = selectedOffering.id;
		createLeagueForm.league.seasonId = selectedOffering.seasonId || selectedSeasonId;
		createLeagueWizardDirtyState.captureBaseline(createLeagueForm);
		isCreateLeagueModalOpen = true;
		return true;
	}

	function buildEditableOfferingInput(template: OfferingTemplate): WizardOfferingInput {
		return {
			seasonId: template.seasonId,
			name: template.name.trim(),
			slug: slugifyFinal(template.slug || template.name || ''),
			linkedOfferingId: '',
			isActive: template.isActive,
			imageUrl: template.imageUrl ?? '',
			minPlayers: template.minPlayers ?? 0,
			maxPlayers: template.maxPlayers ?? 0,
			rulebookUrl: template.rulebookUrl ?? '',
			sport: template.sport ?? '',
			type: template.type,
			description: template.description ?? ''
		};
	}

	function openEditOfferingWizard(offering: OfferingGroup): void {
		if (!canEditOfferingSettings || !offering.offeringId) return;

		const template = offeringTemplates.find(
			(existingOffering: OfferingTemplate) => existingOffering.id === offering.offeringId
		);
		if (!template) {
			toast.error('Unable to load this offering right now.', {
				title: pageLabel
			});
			return;
		}

		resetEditOfferingWizard();
		editingOfferingId = template.id;
		editOfferingForm = buildEditableOfferingInput(template);
		editOfferingWizardDirtyState.captureBaseline(editOfferingForm);
		isEditOfferingModalOpen = true;
	}

	function bulkEditActionLabel(offering: OfferingGroup): string {
		return entryLabelFor(offering) === 'group' ? 'Bulk Edit Groups' : 'Bulk Edit Leagues';
	}

	function offeringActionOptions(offering: OfferingGroup): DropdownOption[] {
		return [
			{
				value: 'edit-offering',
				label: 'Edit Offering'
			},
			{
				value: 'bulk-edit-leagues',
				label: bulkEditActionLabel(offering),
				disabled: offering.leagues.length === 0,
				disabledTooltip:
					entryLabelFor(offering) === 'group'
						? 'Add groups before bulk editing.'
						: 'Add leagues before bulk editing.'
			}
		];
	}

	function createBulkLeagueTemplateMap(offeringId: string): Map<string, LeagueTemplate> {
		return new Map(
			leagueTemplates
				.filter((league) => league.offeringId === offeringId)
				.map((league) => [league.id, league] as const)
		);
	}

	function getBulkEditSelectedLeagueTemplates(): LeagueTemplate[] {
		const offeringId = bulkEditingOfferingId?.trim() ?? '';
		if (!offeringId) return [];

		const templatesById = createBulkLeagueTemplateMap(offeringId);
		return bulkEditLeagueSelectedIds
			.map((leagueId) => templatesById.get(leagueId))
			.filter((league): league is LeagueTemplate => Boolean(league));
	}

	function resetBulkEditLeaguesWizard(): void {
		isBulkEditLeaguesModalOpen = false;
		bulkEditLeaguesUnsavedConfirmOpen = false;
		bulkEditLeaguesValidationVisible = false;
		bulkEditLeaguesStep = 1;
		bulkEditLeaguesSubmitting = false;
		bulkEditLeaguesFormError = '';
		bulkEditLeaguesServerFieldErrors = {};
		bulkEditingOfferingId = null;
		bulkEditingOfferingName = '';
		bulkEditingEntryLabelPlural = 'Leagues';
		bulkEditLeagueSelectedIds = [];
		bulkEditLeaguesForm = createEmptyBulkLeagueEditForm();
		bulkEditLeaguesDirtyState.clearBaseline();
	}

	function closeBulkEditLeaguesWizard(): void {
		resetBulkEditLeaguesWizard();
	}

	function openBulkEditLeaguesWizard(offering: OfferingGroup): void {
		if (!canEditLeagueRows || !offering.offeringId || offering.leagues.length === 0) return;

		const selectedLeagueIds = offering.leagues
			.map((league) => league.id?.trim() ?? '')
			.filter((leagueId) => leagueId.length > 0);
		if (selectedLeagueIds.length === 0) {
			toast.error('Unable to load leagues for bulk editing right now.', {
				title: pageLabel
			});
			return;
		}

		resetBulkEditLeaguesWizard();
		bulkEditingOfferingId = offering.offeringId;
		bulkEditingOfferingName = offering.offeringName;
		bulkEditingEntryLabelPlural = entryLabelFor(offering) === 'group' ? 'Groups' : 'Leagues';
		bulkEditLeagueSelectedIds = selectedLeagueIds;
		bulkEditLeaguesDirtyState.captureBaseline({
			offeringId: offering.offeringId,
			selectedLeagueIds,
			form: bulkEditLeaguesForm
		});
		isBulkEditLeaguesModalOpen = true;
	}

	function handleOfferingAction(action: string, offering: OfferingGroup): void {
		if (action === 'edit-offering') {
			openEditOfferingWizard(offering);
			return;
		}

		if (action === 'bulk-edit-leagues') {
			openBulkEditLeaguesWizard(offering);
		}
	}

	function buildEditableLeagueDraft(template: LeagueTemplate): WizardLeagueInput {
		return {
			draftId: template.id,
			name: template.name.trim(),
			slug: slugifyFinal(template.slug || template.name || ''),
			stackOrder: template.stackOrder ?? 1,
			isSlugManual: true,
			description: template.description ?? '',
			seasonId: template.seasonId ?? selectedSeasonId,
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

	function openEditLeagueWizard(offering: OfferingGroup, league: LeagueOffering): void {
		if (!canEditLeagueRows || !offering.offeringId) return;

		const template = leagueTemplates.find(
			(existingLeague) =>
				existingLeague.id === league.id && existingLeague.offeringId === offering.offeringId
		);
		if (!template) {
			toast.error('Unable to load this league right now.', {
				title: pageLabel
			});
			return;
		}

		const editableLeague = buildEditableLeagueDraft(template);
		resetCreateLeagueWizard();
		createLeagueMode = 'edit';
		createLeagueOfferingFilter = offering.offeringType === 'tournament' ? 'tournament' : 'league';
		createLeagueForm.offeringId = offering.offeringId;
		createLeagueForm.leagues = [editableLeague];
		createLeagueForm.league = { ...editableLeague };
		createLeagueEditingIndex = 0;
		createLeagueDraftActive = true;
		createLeagueSlugTouched = true;
		editingLeagueId = template.id;
		editingLeagueOfferingSlug = offering.offeringSlug;
		createLeagueStep = 2;
		createLeagueWizardDirtyState.captureBaseline(createLeagueForm);
		isCreateLeagueModalOpen = true;
	}

	function closeCreateSeasonWizard(): void {
		isCreateSeasonModalOpen = false;
		createSeasonWizardUnsavedConfirmOpen = false;
		resetCreateSeasonWizard();
	}

	function closeManageSeasonWizard(): void {
		isManageSeasonModalOpen = false;
	}

	async function handleManageSeasonSaved(
		event: CustomEvent<{ selectedSeasonId?: string | null }>
	): Promise<void> {
		const suggestedSeasonId = event.detail?.selectedSeasonId ?? null;
		await invalidateAll();
		if (suggestedSeasonId) {
			selectedSeasonId = suggestedSeasonId;
		}
	}

	function handleManageSeasonDuplicate(event: CustomEvent<{ sourceSeasonId: string }>): void {
		const sourceSeasonId = event.detail?.sourceSeasonId?.trim() ?? '';
		closeManageSeasonWizard();
		openCreateSeasonWizardWithCopy(sourceSeasonId);
	}

	function closeCreateWizard(): void {
		isCreateModalOpen = false;
		createWizardUnsavedConfirmOpen = false;
		resetCreateWizard();
	}

	function resetEditOfferingWizard(): void {
		isEditOfferingModalOpen = false;
		editOfferingWizardUnsavedConfirmOpen = false;
		editOfferingValidationVisible = false;
		editOfferingSubmitting = false;
		editOfferingFormError = '';
		editOfferingServerFieldErrors = {};
		editingOfferingId = null;
		offeringSlugTouched = false;
		editOfferingForm = createEmptyOfferingInput();
		editOfferingWizardDirtyState.clearBaseline();
	}

	function closeEditOfferingWizard(): void {
		resetEditOfferingWizard();
	}

	function hasUnsavedBulkEditLeaguesChanges(): boolean {
		return bulkEditLeaguesDirtyState.isDirty({
			offeringId: bulkEditingOfferingId,
			selectedLeagueIds: bulkEditLeagueSelectedIds,
			form: bulkEditLeaguesForm
		});
	}

	function closeCreateLeagueWizard(): void {
		isCreateLeagueModalOpen = false;
		createLeagueWizardUnsavedConfirmOpen = false;
		resetCreateLeagueWizard();
	}

	function createWizardDefaultOfferingType(): 'league' | 'tournament' {
		return offeringView === 'tournaments' ? 'tournament' : 'league';
	}

	function hasUnsavedCreateWizardChanges(): boolean {
		return createOfferingWizardDirtyState.isDirty(createForm);
	}

	function hasUnsavedEditOfferingChanges(): boolean {
		return editOfferingWizardDirtyState.isDirty(editOfferingForm);
	}

	function hasUnsavedCreateLeagueWizardChanges(): boolean {
		return createLeagueWizardDirtyState.isDirty(createLeagueForm);
	}

	function hasUnsavedCreateSeasonWizardChanges(): boolean {
		return createSeasonWizardDirtyState.isDirty({
			form: createSeasonForm,
			copy: createSeasonCopy,
			replaceExistingCurrent: createSeasonReplaceExistingCurrent,
			deactivateExistingCurrent: createSeasonDeactivateExistingCurrent
		});
	}

	function requestCloseCreateWizard(): void {
		if (!isCreateModalOpen) return;
		if (createSubmitting) return;
		if (!hasUnsavedCreateWizardChanges()) {
			closeCreateWizard();
			return;
		}
		createWizardUnsavedConfirmOpen = true;
	}

	function requestCloseEditOfferingWizard(): void {
		if (!isEditOfferingModalOpen) return;
		if (editOfferingSubmitting) return;
		if (!hasUnsavedEditOfferingChanges()) {
			closeEditOfferingWizard();
			return;
		}
		editOfferingWizardUnsavedConfirmOpen = true;
	}

	function requestCloseBulkEditLeaguesWizard(): void {
		if (!isBulkEditLeaguesModalOpen) return;
		if (bulkEditLeaguesSubmitting) return;
		if (!hasUnsavedBulkEditLeaguesChanges()) {
			closeBulkEditLeaguesWizard();
			return;
		}
		bulkEditLeaguesUnsavedConfirmOpen = true;
	}

	function requestCloseCreateLeagueWizard(): void {
		if (!isCreateLeagueModalOpen) return;
		if (createLeagueSubmitting) return;
		if (!hasUnsavedCreateLeagueWizardChanges()) {
			closeCreateLeagueWizard();
			return;
		}
		createLeagueWizardUnsavedConfirmOpen = true;
	}

	function requestCloseCreateSeasonWizard(): void {
		if (!isCreateSeasonModalOpen) return;
		if (createSeasonSubmitting) return;
		if (!hasUnsavedCreateSeasonWizardChanges()) {
			closeCreateSeasonWizard();
			return;
		}
		createSeasonWizardUnsavedConfirmOpen = true;
	}

	function confirmDiscardCreateWizard(): void {
		createWizardUnsavedConfirmOpen = false;
		closeCreateWizard();
	}

	function cancelDiscardCreateWizard(): void {
		createWizardUnsavedConfirmOpen = false;
	}

	function confirmDiscardEditOfferingWizard(): void {
		editOfferingWizardUnsavedConfirmOpen = false;
		closeEditOfferingWizard();
	}

	function cancelDiscardEditOfferingWizard(): void {
		editOfferingWizardUnsavedConfirmOpen = false;
	}

	function confirmDiscardBulkEditLeaguesWizard(): void {
		bulkEditLeaguesUnsavedConfirmOpen = false;
		closeBulkEditLeaguesWizard();
	}

	function cancelDiscardBulkEditLeaguesWizard(): void {
		bulkEditLeaguesUnsavedConfirmOpen = false;
	}

	function confirmDiscardCreateLeagueWizard(): void {
		createLeagueWizardUnsavedConfirmOpen = false;
		closeCreateLeagueWizard();
	}

	function cancelDiscardCreateLeagueWizard(): void {
		createLeagueWizardUnsavedConfirmOpen = false;
	}

	function confirmDiscardCreateSeasonWizard(): void {
		createSeasonWizardUnsavedConfirmOpen = false;
		closeCreateSeasonWizard();
	}

	function cancelDiscardCreateSeasonWizard(): void {
		createSeasonWizardUnsavedConfirmOpen = false;
	}

	function clearCreateApiErrors(): void {
		if (Object.keys(serverFieldErrors).length > 0) {
			serverFieldErrors = {};
		}
		if (createFormError) {
			createFormError = '';
		}
	}

	function clearEditOfferingApiErrors(): void {
		if (Object.keys(editOfferingServerFieldErrors).length > 0) {
			editOfferingServerFieldErrors = {};
		}
		if (editOfferingFormError) {
			editOfferingFormError = '';
		}
	}

	function clearBulkEditLeaguesApiErrors(): void {
		if (Object.keys(bulkEditLeaguesServerFieldErrors).length > 0) {
			bulkEditLeaguesServerFieldErrors = {};
		}
		if (bulkEditLeaguesFormError) {
			bulkEditLeaguesFormError = '';
		}
	}

	function clearCreateLeagueApiErrors(): void {
		if (Object.keys(createLeagueServerFieldErrors).length > 0) {
			createLeagueServerFieldErrors = {};
		}
		if (createLeagueFormError) {
			createLeagueFormError = '';
		}
	}

	function clearCreateSeasonApiErrors(): void {
		if (Object.keys(createSeasonServerFieldErrors).length > 0) {
			createSeasonServerFieldErrors = {};
		}
		if (createSeasonFormError) {
			createSeasonFormError = '';
		}
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		const hasUnsavedCreateOfferingChanges = isCreateModalOpen && hasUnsavedCreateWizardChanges();
		const hasUnsavedEditOfferingWizardChanges =
			isEditOfferingModalOpen && hasUnsavedEditOfferingChanges();
		const hasUnsavedBulkLeagueChanges =
			isBulkEditLeaguesModalOpen && hasUnsavedBulkEditLeaguesChanges();
		const hasUnsavedCreateLeagueChanges =
			isCreateLeagueModalOpen && hasUnsavedCreateLeagueWizardChanges();
		const hasUnsavedCreateSeasonChanges =
			isCreateSeasonModalOpen && hasUnsavedCreateSeasonWizardChanges();
		if (
			!hasUnsavedCreateOfferingChanges &&
			!hasUnsavedEditOfferingWizardChanges &&
			!hasUnsavedBulkLeagueChanges &&
			!hasUnsavedCreateLeagueChanges &&
			!hasUnsavedCreateSeasonChanges
		)
			return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

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

	function getSeasonFieldErrors(values: WizardSeasonInput): Record<string, string> {
		const errors: Record<string, string> = {};
		const name = values.name.trim();
		const slug = slugifyFinal(values.slug);
		const startDate = values.startDate.trim();
		const endDate = values.endDate.trim();

		if (!name) errors['season.name'] = 'Season name is required.';
		if (!slug) errors['season.slug'] = 'Season slug is required.';
		if (name) {
			const normalizedName = name.toLowerCase();
			const duplicateName = seasons.find(
				(season) => season.name.trim().toLowerCase() === normalizedName
			);
			if (duplicateName) {
				errors['season.name'] =
					duplicateName.isActive === false
						? 'An archived season with this name already exists.'
						: 'A season with this name already exists.';
			}
		}
		if (slug) {
			const duplicateSlug = seasons.find((season) => slugifyFinal(season.slug) === slug);
			if (duplicateSlug) {
				errors['season.slug'] =
					duplicateSlug.isActive === false
						? 'An archived season with this slug already exists.'
						: 'A season with this slug already exists.';
			}
		}
		if (!startDate) {
			errors['season.startDate'] = 'Season start date is required.';
		} else if (!DATE_REGEX.test(startDate)) {
			errors['season.startDate'] = 'Use YYYY-MM-DD format.';
		}

		if (endDate && !DATE_REGEX.test(endDate)) {
			errors['season.endDate'] = 'Use YYYY-MM-DD format.';
		}

		const startMs = toDateOnlyMs(startDate);
		const endMs = endDate ? toDateOnlyMs(endDate) : null;
		if (startMs !== null && endMs !== null && endMs < startMs) {
			errors['season.endDate'] = 'End date must be on or after start date.';
		}

		return errors;
	}

	function getSeasonCopyFieldErrors(values: WizardSeasonCopyInput): Record<string, string> {
		const errors: Record<string, string> = {};
		if (!values.enabled) return errors;

		if (!values.sourceSeasonId.trim()) {
			errors['copyOptions.sourceSeasonId'] = 'Select a season to copy from.';
		} else if (!seasons.some((season) => season.id === values.sourceSeasonId)) {
			errors['copyOptions.sourceSeasonId'] = 'Select a valid source season.';
		}

		if (values.scope === 'offerings-only' && values.includeDivisions) {
			errors['copyOptions.includeDivisions'] =
				'Divisions/groups can only be copied when leagues or tournament groups are included.';
		}

		return errors;
	}

	function getSeasonTransitionFieldErrors(): Record<string, string> {
		const errors: Record<string, string> = {};
		if (!createSeasonCurrentTransitionRequired) return errors;

		if (!createSeasonReplaceExistingCurrent && createSeasonDeactivateExistingCurrent) {
			errors['season.transition'] =
				'The previous current season can only be marked inactive if it is no longer current.';
		}

		return errors;
	}

	function getSeasonStepClientErrors(
		values: WizardSeasonInput,
		copyValues: WizardSeasonCopyInput,
		step: SeasonWizardStep
	): Record<string, string> {
		const allErrors = {
			...getSeasonFieldErrors(values),
			...getSeasonCopyFieldErrors(copyValues),
			...getSeasonTransitionFieldErrors()
		};

		if (step === 1) {
			return pickFieldErrors(allErrors, [
				'season.name',
				'season.slug',
				'season.startDate',
				'season.endDate'
			]);
		}

		if (step === 2) {
			return pickFieldErrors(allErrors, [
				'copyOptions.sourceSeasonId',
				'copyOptions.includeDivisions'
			]);
		}

		if (step === 3) {
			return pickFieldErrors(allErrors, ['season.transition']);
		}

		return allErrors;
	}

	function firstInvalidCreateSeasonStep(errors: Record<string, string>): SeasonWizardStep {
		const stepOneKeys = new Set([
			'season.name',
			'season.slug',
			'season.startDate',
			'season.endDate'
		]);
		const stepTwoKeys = new Set(['copyOptions.sourceSeasonId', 'copyOptions.includeDivisions']);
		const stepThreeKeys = new Set(['season.transition']);
		for (const key of Object.keys(errors)) {
			if (stepOneKeys.has(key)) return 1;
			if (stepTwoKeys.has(key)) return 2;
			if (stepThreeKeys.has(key)) return 3;
		}
		return 4;
	}

	function getTakenOfferingSlugsForSeason(
		seasonId: string,
		excludeOfferingId: string | null = null
	): Set<string> {
		const normalizedSeasonId = seasonId.trim();
		if (!normalizedSeasonId) return new Set<string>();
		return new Set(
			leagueOfferingOptions
				.filter(
					(offering) =>
						offering.seasonId === normalizedSeasonId &&
						(!excludeOfferingId || offering.id !== excludeOfferingId)
				)
				.map((offering) => slugifyFinal(offering.slug || ''))
				.filter((slug) => slug.length > 0)
		);
	}

	function getTakenOfferingNamesForSeason(
		seasonId: string,
		excludeOfferingId: string | null = null
	): Set<string> {
		const normalizedSeasonId = seasonId.trim();
		if (!normalizedSeasonId) return new Set<string>();
		return new Set(
			leagueOfferingOptions
				.filter(
					(offering) =>
						offering.seasonId === normalizedSeasonId &&
						(!excludeOfferingId || offering.id !== excludeOfferingId)
				)
				.map((offering) => offering.name.trim().toLowerCase())
				.filter((name) => name.length > 0)
		);
	}

	function suggestNextOfferingSlug(
		slug: string,
		seasonId: string,
		excludeOfferingId: string | null = null
	): string | null {
		const normalizedSlug = slugifyFinal(slug);
		if (!normalizedSlug) return null;
		const takenSlugs = getTakenOfferingSlugsForSeason(seasonId, excludeOfferingId);
		if (!takenSlugs.has(normalizedSlug)) return normalizedSlug;
		let suffix = 1;
		let suggestedSlug = `${normalizedSlug}-${suffix}`;
		while (takenSlugs.has(suggestedSlug)) {
			suffix += 1;
			suggestedSlug = `${normalizedSlug}-${suffix}`;
		}
		return suggestedSlug;
	}

	function getOfferingFieldErrors(
		values: WizardOfferingInput,
		excludeOfferingId: string | null = null
	): Record<string, string> {
		const errors: Record<string, string> = {};
		const seasonId = values.seasonId.trim();
		const name = values.name.trim();
		const slug = slugifyFinal(values.slug);
		const imageUrl = values.imageUrl.trim();
		const rulebookUrl = values.rulebookUrl.trim();

		if (!seasonId) errors['offering.seasonId'] = 'Season is required.';
		if (!name) errors['offering.name'] = 'Offering name is required.';
		if (!slug) errors['offering.slug'] = 'Offering slug is required.';
		if (!values.type) errors['offering.type'] = 'Type is required.';
		if (seasonId && name) {
			const takenNames = getTakenOfferingNamesForSeason(seasonId, excludeOfferingId);
			if (takenNames.has(name.toLowerCase())) {
				errors['offering.name'] =
					'An offering with this name already exists for the selected season.';
			}
		}
		if (seasonId && slug) {
			const takenSlugs = getTakenOfferingSlugsForSeason(seasonId, excludeOfferingId);
			if (takenSlugs.has(slug)) {
				const suggestedSlug = suggestNextOfferingSlug(slug, seasonId, excludeOfferingId);
				errors['offering.slug'] = suggestedSlug
					? `An offering with this slug already exists for the selected season. Try "${suggestedSlug}".`
					: 'An offering with this slug already exists for the selected season.';
			}
		}
		if (values.linkedOfferingId.trim()) {
			const linkedOffering = leagueOfferingOptions.find(
				(offering) => offering.id === values.linkedOfferingId.trim()
			);
			if (!linkedOffering) {
				errors['offering.linkedOfferingId'] = 'Select a valid offering to link.';
			} else if (linkedOffering.seasonId === seasonId) {
				errors['offering.linkedOfferingId'] = 'Linked offering must be from a different season.';
			}
		}

		if (imageUrl && !isValidUrl(imageUrl)) {
			errors['offering.imageUrl'] = 'Enter a valid image URL.';
		}

		if (rulebookUrl && !isValidUrl(rulebookUrl)) {
			errors['offering.rulebookUrl'] = 'Enter a valid rulebook URL.';
		}

		const hasMinPlayers = values.minPlayers > 0;
		const hasMaxPlayers = values.maxPlayers > 0;

		if (hasMinPlayers && (!Number.isInteger(values.minPlayers) || values.minPlayers < 1)) {
			errors['offering.minPlayers'] = 'Minimum roster players must be at least 1.';
		}

		if (hasMaxPlayers && (!Number.isInteger(values.maxPlayers) || values.maxPlayers < 1)) {
			errors['offering.maxPlayers'] = 'Maximum roster players must be at least 1.';
		}

		if (hasMinPlayers && hasMaxPlayers && values.minPlayers > values.maxPlayers) {
			errors['offering.maxPlayers'] =
				'Maximum roster players must be greater than or equal to minimum roster players.';
		}

		return errors;
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
		prefix = 'leagues',
		excludeLeagueId: string | null = null
	): Record<string, string> {
		const normalizedOfferingId = offeringId.trim();
		if (!normalizedOfferingId) return {};

		const existingLeagues = leagueTemplates.filter(
			(league) =>
				league.offeringId === normalizedOfferingId &&
				(!excludeLeagueId || league.id !== excludeLeagueId)
		);
		const existingNames = new Set(
			existingLeagues
				.map((league) => league.name.trim().toLowerCase())
				.filter((name) => name.length > 0)
		);
		const existingSlugs = new Set(
			existingLeagues.map((league) => slugifyFinal(league.slug)).filter((slug) => slug.length > 0)
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

	function getCurrentStepClientErrors(
		values: WizardFormState,
		step: WizardStep
	): Record<string, string> {
		if (step === 1) {
			return pickFieldErrors(getOfferingFieldErrors(values.offering), [
				'offering.seasonId',
				'offering.name',
				'offering.slug',
				'offering.type',
				'offering.description'
			]);
		}

		if (step === 2) {
			return pickFieldErrors(getOfferingFieldErrors(values.offering), [
				'offering.linkedOfferingId'
			]);
		}

		if (step === 3) {
			return pickFieldErrors(getOfferingFieldErrors(values.offering), [
				'offering.imageUrl',
				'offering.minPlayers',
				'offering.maxPlayers',
				'offering.rulebookUrl'
			]);
		}

		if (step === 4) {
			if (!leagueDraftActive) return {};
			return pickFieldErrors(getLeagueFieldErrors(values.league), [
				'league.name',
				'league.slug',
				'league.description',
				'league.seasonId',
				'league.gender',
				'league.skillLevel'
			]);
		}

		if (step === 5) {
			if (!leagueDraftActive) return {};
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

		return getSubmitClientErrors(values);
	}

	function getSubmitClientErrors(values: WizardFormState): Record<string, string> {
		const errors: Record<string, string> = {
			...getOfferingFieldErrors(values.offering)
		};

		if (values.leagues.length > 0) {
			values.leagues.forEach((league, index) => {
				Object.assign(errors, getLeagueFieldErrors(league, `leagues.${index}`));
			});
			Object.assign(errors, getLeagueCollectionScopeErrors(values.leagues));
		}

		return errors;
	}

	function firstInvalidStep(errors: Record<string, string>): WizardStep {
		const keys = Object.keys(errors);
		if (
			keys.some((key) =>
				[
					'offering.seasonId',
					'offering.name',
					'offering.slug',
					'offering.sport',
					'offering.type'
				].includes(key)
			)
		) {
			return 1;
		}
		if (keys.some((key) => key === 'offering.linkedOfferingId')) {
			return 2;
		}
		if (
			keys.some((key) =>
				[
					'offering.imageUrl',
					'offering.minPlayers',
					'offering.maxPlayers',
					'offering.rulebookUrl'
				].includes(key)
			)
		) {
			return 3;
		}
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
			return 4;
		}
		if (keys.some((key) => key.startsWith('league.'))) {
			return 5;
		}
		return 6;
	}

	function normalizeDateForRequest(value: string): string {
		return value.trim();
	}

	function normalizeOptionalTextForRequest(value: string): string | null {
		const normalized = value.trim();
		return normalized.length > 0 ? normalized : null;
	}

	function normalizeOptionalUrlForRequest(value: string): string | null {
		const normalized = value.trim();
		return normalized.length > 0 ? normalized : null;
	}

	function normalizePlayerCountForRequest(value: number): number | null {
		return Number.isInteger(value) && value > 0 ? value : null;
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

	function addOrUpdateDraftLeague(): boolean {
		const draftErrors = {
			...getCurrentStepClientErrors(createForm, 4),
			...getCurrentStepClientErrors(createForm, 5)
		};
		if (Object.keys(draftErrors).length > 0) {
			createStep = firstInvalidStep(draftErrors);
			return false;
		}

		const normalizedLeague: WizardLeagueInput = {
			...createForm.league,
			name: createForm.league.name.trim(),
			slug: slugifyFinal(createForm.league.slug),
			stackOrder:
				leagueEditingIndex === null
					? createForm.leagues.length + 1
					: (createForm.leagues[leagueEditingIndex]?.stackOrder ?? createForm.league.stackOrder),
			isSlugManual: leagueSlugTouched,
			description: createForm.league.description.trim(),
			seasonId: createForm.offering.seasonId.trim() || createForm.league.seasonId.trim(),
			regStartDate: createForm.league.regStartDate.trim(),
			regEndDate: createForm.league.regEndDate.trim(),
			seasonStartDate: createForm.league.seasonStartDate.trim(),
			seasonEndDate: createForm.league.seasonEndDate.trim(),
			preseasonStartDate: createForm.league.preseasonStartDate.trim(),
			preseasonEndDate: createForm.league.preseasonEndDate.trim(),
			postseasonStartDate: createForm.league.postseasonStartDate.trim(),
			postseasonEndDate: createForm.league.postseasonEndDate.trim(),
			imageUrl: createForm.league.imageUrl.trim()
		};

		if (leagueEditingIndex === null) {
			createForm.leagues = normalizeLeagueStackOrder([...createForm.leagues, normalizedLeague]);
		} else {
			createForm.leagues = normalizeLeagueStackOrder(
				createForm.leagues.map((league, index) =>
					index === leagueEditingIndex ? normalizedLeague : league
				)
			);
		}

		createForm.league = createEmptyLeague();
		createForm.league.seasonId = createForm.offering.seasonId || selectedSeasonId;
		createForm.addLeagues = createForm.leagues.length > 0 ? 'yes' : 'no';
		leagueEditingIndex = null;
		leagueSlugTouched = false;
		leagueDraftActive = false;
		return true;
	}

	function startAddingLeague(): void {
		clearCreateApiErrors();
		leagueEditingIndex = null;
		leagueSlugTouched = false;
		createForm.league = {
			...createEmptyLeague(),
			stackOrder: createForm.leagues.length + 1,
			seasonId: createForm.offering.seasonId || selectedSeasonId
		};
		createForm.addLeagues = 'yes';
		leagueDraftActive = true;
		createStep = 4;
	}

	function cancelLeagueDraft(): void {
		leagueEditingIndex = null;
		leagueSlugTouched = false;
		leagueDraftActive = false;
		createForm.league = createEmptyLeague();
		createForm.league.seasonId = createForm.offering.seasonId || selectedSeasonId;
		if (createForm.leagues.length === 0) {
			createForm.addLeagues = 'no';
		}
	}

	function startEditingLeague(index: number): void {
		if (!createForm.leagues[index]) return;
		clearCreateApiErrors();
		leagueEditingIndex = index;
		const sourceLeague = createForm.leagues[index];
		const inferredManualSlug =
			typeof sourceLeague.isSlugManual === 'boolean'
				? sourceLeague.isSlugManual
				: slugifyFinal(sourceLeague.slug) !==
					defaultLeagueSlug(sourceLeague.name, createForm.offering.name);
		leagueSlugTouched = inferredManualSlug;
		createForm.league = {
			...sourceLeague,
			isSlugManual: inferredManualSlug
		};
		createForm.addLeagues = 'yes';
		leagueDraftActive = true;
		createStep = 4;
	}

	function startEditingOffering(): void {
		clearCreateApiErrors();
		createStep = 1;
	}

	function startEditingLeagues(): void {
		clearCreateApiErrors();
		createStep = 4;
	}

	function duplicateLeague(index: number): void {
		if (!createForm.leagues[index]) return;
		const source = createForm.leagues[index];
		const baseName = source.name.trim() || 'League';
		const baseSlug = slugifyFinal(source.slug || source.name || 'league');
		let copyNumber = 1;
		let nextName = `${baseName} Copy`;
		let nextSlug = `${baseSlug}-copy`;
		const existingNames = new Set(
			createForm.leagues.map((league) => league.name.trim().toLowerCase())
		);
		const existingSlugs = new Set(createForm.leagues.map((league) => slugifyFinal(league.slug)));
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
		createForm.addLeagues = 'yes';
		createForm.leagues = normalizeLeagueStackOrder(
			duplicateCollectionItem(createForm.leagues, index, () => duplicate)
		);
		if (leagueEditingIndex !== null && leagueEditingIndex > index) {
			leagueEditingIndex += 1;
		}
	}

	function moveLeague(index: number, direction: 'up' | 'down'): void {
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (
			index < 0 ||
			targetIndex < 0 ||
			index >= createForm.leagues.length ||
			targetIndex >= createForm.leagues.length
		) {
			return;
		}

		createForm.leagues = normalizeLeagueStackOrder(
			moveCollectionItemByOffset(createForm.leagues, index, direction === 'up' ? -1 : 1)
		);
		leagueEditingIndex = adjustEditingIndexOnReorder(leagueEditingIndex, index, targetIndex);
	}

	function removeLeague(index: number): void {
		if (!createForm.leagues[index]) return;
		const wasEditingRemoved = leagueEditingIndex === index;
		createForm.leagues = normalizeLeagueStackOrder(removeCollectionItem(createForm.leagues, index));
		leagueEditingIndex = adjustEditingIndexOnRemove(leagueEditingIndex, index);
		if (wasEditingRemoved) {
			cancelLeagueDraft();
			return;
		}
		if (createForm.leagues.length === 0) {
			createForm.addLeagues = 'no';
		}
	}

	async function submitEditOfferingWizard(): Promise<void> {
		editOfferingValidationVisible = true;
		const clientErrors = getOfferingFieldErrors(editOfferingForm, editingOfferingId);
		if (Object.keys(clientErrors).length > 0) {
			return;
		}

		const offeringId = editingOfferingId?.trim() ?? '';
		if (!offeringId) {
			editOfferingFormError = 'Unable to update offering right now.';
			return;
		}

		editOfferingSubmitting = true;
		editOfferingFormError = '';
		editOfferingServerFieldErrors = {};
		createSuccessMessage = '';

		try {
			const response = await fetch('/api/intramural-sports/offerings', {
				method: 'PATCH',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					offeringId,
					offering: {
						name: editOfferingForm.name.trim(),
						slug: slugifyFinal(editOfferingForm.slug),
						isActive: editOfferingForm.isActive,
						imageUrl: normalizeOptionalUrlForRequest(editOfferingForm.imageUrl),
						minPlayers: normalizePlayerCountForRequest(editOfferingForm.minPlayers),
						maxPlayers: normalizePlayerCountForRequest(editOfferingForm.maxPlayers),
						rulebookUrl: normalizeOptionalUrlForRequest(editOfferingForm.rulebookUrl),
						sport: normalizeOptionalTextForRequest(editOfferingForm.sport),
						description: normalizeOptionalTextForRequest(editOfferingForm.description)
					}
				})
			});

			let body: UpdateOfferingApiResponse | null = null;
			try {
				body = (await response.json()) as UpdateOfferingApiResponse;
			} catch {
				body = null;
			}

			if (!response.ok || !body?.success || !body?.data?.offeringId) {
				editOfferingServerFieldErrors = toServerFieldErrorMap(body?.fieldErrors);
				editOfferingFormError = body?.error || 'Unable to update offering right now.';
				return;
			}

			createSuccessMessage = 'Offering updated successfully.';
			closeEditOfferingWizard();
			await invalidateAll();
		} catch {
			editOfferingFormError = 'Unable to update offering right now.';
		} finally {
			editOfferingSubmitting = false;
		}
	}

	function normalizeBulkEditServerFieldErrors(
		fieldErrors: Record<string, string[] | undefined> | undefined
	): Record<string, string> {
		const mapped = toServerFieldErrorMap(fieldErrors);
		const normalized: Record<string, string> = {};

		for (const [key, value] of Object.entries(mapped)) {
			if (key.length === 0) {
				normalized.changes = value;
				continue;
			}
			if (key === 'leagueIds' || key === 'changes') {
				normalized[key] = value;
				continue;
			}

			if (key.startsWith('changes.')) {
				normalized[key.slice('changes.'.length)] = value;
				continue;
			}

			normalized[key] = value;
		}

		return normalized;
	}

	async function submitBulkEditLeaguesWizard(): Promise<void> {
		bulkEditLeaguesValidationVisible = true;
		const clientErrors = getBulkEditLeaguesFieldErrors();
		if (Object.keys(clientErrors).length > 0) {
			bulkEditLeaguesStep = clientErrors.selectedLeagueIds ? 1 : 2;
			return;
		}

		const offeringId = bulkEditingOfferingId?.trim() ?? '';
		const selectedLeagueIds = bulkEditLeagueSelectedIds
			.map((leagueId) => leagueId.trim())
			.filter((leagueId) => leagueId.length > 0);
		if (!offeringId || selectedLeagueIds.length === 0) {
			bulkEditLeaguesFormError = `Unable to bulk edit ${bulkEditingEntryLabelPlural.toLowerCase()} right now.`;
			return;
		}

		bulkEditLeaguesSubmitting = true;
		bulkEditLeaguesFormError = '';
		bulkEditLeaguesServerFieldErrors = {};
		createSuccessMessage = '';

		try {
			const response = await fetch('/api/intramural-sports/leagues', {
				method: 'PATCH',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					action: 'bulk-update',
					offeringId,
					leagueIds: selectedLeagueIds,
					changes: buildBulkEditLeagueChangesPayload(bulkEditLeaguesForm)
				})
			});

			let body: BulkUpdateLeaguesApiResponse | null = null;
			try {
				body = (await response.json()) as BulkUpdateLeaguesApiResponse;
			} catch {
				body = null;
			}

			if (!response.ok || !body?.success || !body?.data?.leagueIds?.length) {
				bulkEditLeaguesServerFieldErrors = normalizeBulkEditServerFieldErrors(body?.fieldErrors);
				bulkEditLeaguesFormError =
					body?.error ||
					`Unable to bulk edit ${bulkEditingEntryLabelPlural.toLowerCase()} right now.`;
				bulkEditLeaguesStep = bulkEditLeaguesServerFieldErrors.selectedLeagueIds ? 1 : 2;
				return;
			}

			const updatedCount = body.data.leagueIds.length;
			createSuccessMessage = `${updatedCount} ${pluralize(
				updatedCount,
				bulkEditingEntryLabelPlural.slice(0, -1).toLowerCase(),
				bulkEditingEntryLabelPlural.toLowerCase()
			)} updated successfully.`;
			closeBulkEditLeaguesWizard();
			await invalidateAll();
		} catch {
			bulkEditLeaguesFormError = `Unable to bulk edit ${bulkEditingEntryLabelPlural.toLowerCase()} right now.`;
		} finally {
			bulkEditLeaguesSubmitting = false;
		}
	}

	async function submitCreateWizard(): Promise<void> {
		const clientErrors = getSubmitClientErrors(createForm);
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
				seasonId: createForm.offering.seasonId.trim(),
				name: createForm.offering.name.trim(),
				slug: slugifyFinal(createForm.offering.slug),
				linkedOfferingId: createForm.offering.linkedOfferingId.trim() || null,
				isActive: createForm.offering.isActive,
				imageUrl: normalizeOptionalUrlForRequest(createForm.offering.imageUrl),
				minPlayers: normalizePlayerCountForRequest(createForm.offering.minPlayers),
				maxPlayers: normalizePlayerCountForRequest(createForm.offering.maxPlayers),
				rulebookUrl: normalizeOptionalUrlForRequest(createForm.offering.rulebookUrl),
				sport: normalizeOptionalTextForRequest(createForm.offering.sport),
				type: createForm.offering.type,
				description: normalizeOptionalTextForRequest(createForm.offering.description)
			},
			leagues: createForm.leagues.map((league) =>
				mapLeagueForRequest({
					...league,
					seasonId: createForm.offering.seasonId.trim() || league.seasonId
				})
			)
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

			if (!response.ok || !body?.success || !body?.data) {
				serverFieldErrors = toServerFieldErrorMap(body?.fieldErrors);
				const combinedErrors = {
					...getSubmitClientErrors(createForm),
					...serverFieldErrors
				};
				createStep = firstInvalidStep(combinedErrors);
				createFormError = body?.error || 'Unable to save offering right now.';
				return;
			}

			searchQuery = '';
			const createdLeagueCount = body.data.leagueIds.length;
			createSuccessMessage =
				createdLeagueCount > 0
					? `Offering and ${createdLeagueCount} ${pluralize(createdLeagueCount, 'league', 'leagues')} created successfully.`
					: 'Offering created successfully.';
			await invalidateAll();
			selectedSeasonId = payload.offering.seasonId;
			closeCreateWizard();
		} catch {
			createFormError = 'Unable to save offering right now.';
		} finally {
			createSubmitting = false;
		}
	}

	async function submitCreateSeasonWizard(): Promise<void> {
		const clientErrors = {
			...getSeasonFieldErrors(createSeasonForm),
			...getSeasonCopyFieldErrors(createSeasonCopy),
			...getSeasonTransitionFieldErrors()
		};
		if (Object.keys(clientErrors).length > 0) {
			createSeasonStep = firstInvalidCreateSeasonStep(clientErrors);
			return;
		}

		createSeasonSubmitting = true;
		createSeasonFormError = '';
		createSeasonServerFieldErrors = {};
		createSuccessMessage = '';
		const existingCurrentSeasonIdAtSubmit = existingCurrentSeason?.id ?? null;
		const applyExistingCurrentTransition =
			createSeasonForm.isCurrent && existingCurrentSeasonIdAtSubmit !== null;
		const includeSeasonCopy =
			createSeasonCopy.enabled && createSeasonCopy.sourceSeasonId.trim().length > 0;
		const normalizedCopyScope: SeasonCopyScope =
			createSeasonCopy.scope === 'offerings-leagues' ||
			createSeasonCopy.scope === 'offerings-all' ||
			createSeasonCopy.scope === 'offerings-only'
				? createSeasonCopy.scope
				: 'offerings-all';

		const payload = {
			season: {
				name: createSeasonForm.name.trim(),
				slug: slugifyFinal(createSeasonForm.slug),
				startDate: createSeasonForm.startDate.trim(),
				endDate: createSeasonForm.endDate.trim() || null,
				isCurrent: createSeasonWillBeCurrent,
				isActive: createSeasonForm.isActive
			},
			currentSeasonTransition: applyExistingCurrentTransition
				? {
						clearExistingCurrent: createSeasonReplaceExistingCurrent,
						deactivateExistingCurrent: createSeasonWillDeactivateExistingCurrent
					}
				: undefined,
			copyOptions: includeSeasonCopy
				? {
						sourceSeasonId: createSeasonCopy.sourceSeasonId.trim(),
						scope: normalizedCopyScope,
						includeDivisions:
							normalizedCopyScope === 'offerings-only' ? false : createSeasonCopy.includeDivisions
					}
				: undefined
		};

		try {
			const response = await fetch('/api/intramural-sports/seasons', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			let body: CreateSeasonApiResponse | null = null;
			try {
				body = (await response.json()) as CreateSeasonApiResponse;
			} catch {
				body = null;
			}

			if (!response.ok || !body?.success || !body?.data?.season) {
				createSeasonServerFieldErrors = toServerFieldErrorMap(body?.fieldErrors);
				const combinedErrors = {
					...getSeasonFieldErrors(createSeasonForm),
					...getSeasonCopyFieldErrors(createSeasonCopy),
					...getSeasonTransitionFieldErrors(),
					...createSeasonServerFieldErrors
				};
				createSeasonStep = firstInvalidCreateSeasonStep(combinedErrors);
				createSeasonFormError = body?.error || 'Unable to save season right now.';
				return;
			}

			const createdSeason = body.data.season;
			const shouldDeactivateExistingCurrentOnClient =
				createdSeason.isCurrent &&
				createSeasonWillDeactivateExistingCurrent &&
				existingCurrentSeasonIdAtSubmit !== null;
			const mergedSeasons = seasons
				.filter((season) => season.id !== createdSeason.id)
				.map((season) => ({
					...season,
					isCurrent: createdSeason.isCurrent ? false : season.isCurrent,
					isActive:
						shouldDeactivateExistingCurrentOnClient && season.id === existingCurrentSeasonIdAtSubmit
							? false
							: season.isActive
				}));
			mergedSeasons.push({
				id: createdSeason.id,
				name: createdSeason.name,
				slug: createdSeason.slug,
				startDate: createdSeason.startDate,
				endDate: createdSeason.endDate,
				isCurrent: createdSeason.isCurrent,
				isActive: createdSeason.isActive
			});
			seasons = mergedSeasons.sort(compareSeasonHistoryOrder);

			selectedSeasonId = createdSeason.id;

			const copySummary = body.data.copySummary;
			if (copySummary) {
				const copyParts: string[] = [];
				if (copySummary.offeringCount > 0) {
					copyParts.push(
						`${copySummary.offeringCount} ${pluralize(copySummary.offeringCount, 'offering', 'offerings')}`
					);
				}
				if (copySummary.leagueCount > 0) {
					copyParts.push(
						`${copySummary.leagueCount} ${pluralize(copySummary.leagueCount, 'league/group', 'leagues/groups')}`
					);
				}
				if (copySummary.divisionCount > 0) {
					copyParts.push(
						`${copySummary.divisionCount} ${pluralize(copySummary.divisionCount, 'division/group', 'divisions/groups')}`
					);
				}

				createSuccessMessage =
					copyParts.length > 0
						? `Season "${createdSeason.name}" created successfully. Copied ${copyParts.join(', ')}.`
						: `Season "${createdSeason.name}" created successfully.`;
			} else {
				createSuccessMessage = `Season "${createdSeason.name}" created successfully.`;
			}

			await invalidateAll();
			closeCreateSeasonWizard();
		} catch {
			createSeasonFormError = 'Unable to save season right now.';
		} finally {
			createSeasonSubmitting = false;
		}
	}

	function getLeagueOfferingById(offeringId: string): LeagueOfferingOption | null {
		const selectedOffering = leagueOfferingOptions.find(
			(offering: LeagueOfferingOption) => offering.id === offeringId
		);
		return selectedOffering ?? null;
	}

	function createLeagueStepTitle(step: LeagueWizardStep): string {
		return wizardEntryStepTitle(step);
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

	function parseBulkBooleanChoice(value: BulkBooleanChoice): boolean | undefined {
		if (value === 'unchanged') return undefined;
		return value === 'true';
	}

	function hasBulkEditLeaguesFieldChanges(form: BulkLeagueEditFormState): boolean {
		return (
			form.description.trim().length > 0 ||
			form.gender !== 'unchanged' ||
			form.skillLevel !== 'unchanged' ||
			form.regStartDate.trim().length > 0 ||
			form.regEndDate.trim().length > 0 ||
			form.seasonStartDate.trim().length > 0 ||
			form.seasonEndDate.trim().length > 0 ||
			form.hasPostseason !== 'unchanged' ||
			form.postseasonStartDate.trim().length > 0 ||
			form.postseasonEndDate.trim().length > 0 ||
			form.hasPreseason !== 'unchanged' ||
			form.preseasonStartDate.trim().length > 0 ||
			form.preseasonEndDate.trim().length > 0 ||
			form.isActive !== 'unchanged' ||
			form.isLocked !== 'unchanged' ||
			form.imageUrl.trim().length > 0
		);
	}

	function applyBulkEditFormToLeague(
		template: LeagueTemplate,
		form: BulkLeagueEditFormState
	): WizardLeagueInput {
		const merged = buildEditableLeagueDraft(template);

		if (form.description.trim()) merged.description = form.description.trim();
		if (form.gender !== 'unchanged') merged.gender = form.gender;
		if (form.skillLevel !== 'unchanged') merged.skillLevel = form.skillLevel;
		if (form.regStartDate.trim()) merged.regStartDate = form.regStartDate.trim();
		if (form.regEndDate.trim()) merged.regEndDate = form.regEndDate.trim();
		if (form.seasonStartDate.trim()) merged.seasonStartDate = form.seasonStartDate.trim();
		if (form.seasonEndDate.trim()) merged.seasonEndDate = form.seasonEndDate.trim();
		if (form.imageUrl.trim()) merged.imageUrl = form.imageUrl.trim();

		const hasPostseason = parseBulkBooleanChoice(form.hasPostseason);
		if (hasPostseason !== undefined) {
			merged.hasPostseason = hasPostseason;
			if (!hasPostseason) {
				merged.postseasonStartDate = '';
				merged.postseasonEndDate = '';
			}
		}
		if (form.postseasonStartDate.trim()) {
			merged.postseasonStartDate = form.postseasonStartDate.trim();
		}
		if (form.postseasonEndDate.trim()) {
			merged.postseasonEndDate = form.postseasonEndDate.trim();
		}

		const hasPreseason = parseBulkBooleanChoice(form.hasPreseason);
		if (hasPreseason !== undefined) {
			merged.hasPreseason = hasPreseason;
			if (!hasPreseason) {
				merged.preseasonStartDate = '';
				merged.preseasonEndDate = '';
			}
		}
		if (form.preseasonStartDate.trim()) {
			merged.preseasonStartDate = form.preseasonStartDate.trim();
		}
		if (form.preseasonEndDate.trim()) {
			merged.preseasonEndDate = form.preseasonEndDate.trim();
		}

		const isActive = parseBulkBooleanChoice(form.isActive);
		if (isActive !== undefined) merged.isActive = isActive;

		const isLocked = parseBulkBooleanChoice(form.isLocked);
		if (isLocked !== undefined) merged.isLocked = isLocked;

		return merged;
	}

	function getBulkEditLeaguesFieldErrors(): Record<string, string> {
		const errors: Record<string, string> = { ...bulkEditLeaguesServerFieldErrors };
		if (!bulkEditLeaguesValidationVisible) return errors;

		if (bulkEditLeagueSelectedIds.length === 0) {
			errors.selectedLeagueIds = `Select at least one ${bulkEditingEntryLabelPlural.toLowerCase()}.`;
		}

		if (!hasBulkEditLeaguesFieldChanges(bulkEditLeaguesForm)) {
			errors.changes = 'Choose at least one field to update.';
			return errors;
		}

		const selectedTemplates = getBulkEditSelectedLeagueTemplates();
		if (selectedTemplates.length !== bulkEditLeagueSelectedIds.length) {
			errors.selectedLeagueIds = 'Some selected leagues could not be loaded.';
			return errors;
		}

		const postseasonDatesTouched =
			bulkEditLeaguesForm.postseasonStartDate.trim().length > 0 ||
			bulkEditLeaguesForm.postseasonEndDate.trim().length > 0;
		if (postseasonDatesTouched) {
			if (bulkEditLeaguesForm.hasPostseason === 'false') {
				errors.hasPostseason = 'Postseason dates cannot be set while postseason is being disabled.';
			} else if (
				bulkEditLeaguesForm.hasPostseason === 'unchanged' &&
				selectedTemplates.some((league) => !league.hasPostseason)
			) {
				errors.hasPostseason =
					'Set postseason to Enabled before bulk editing postseason dates for leagues that do not already use postseason.';
			}
		}

		const preseasonDatesTouched =
			bulkEditLeaguesForm.preseasonStartDate.trim().length > 0 ||
			bulkEditLeaguesForm.preseasonEndDate.trim().length > 0;
		if (preseasonDatesTouched) {
			if (bulkEditLeaguesForm.hasPreseason === 'false') {
				errors.hasPreseason = 'Preseason dates cannot be set while preseason is being disabled.';
			} else if (
				bulkEditLeaguesForm.hasPreseason === 'unchanged' &&
				selectedTemplates.some((league) => !league.hasPreseason)
			) {
				errors.hasPreseason =
					'Set preseason to Enabled before bulk editing preseason dates for leagues that do not already use preseason.';
			}
		}

		for (const template of selectedTemplates) {
			const mergedLeague = applyBulkEditFormToLeague(template, bulkEditLeaguesForm);
			const mergedErrors = getLeagueFieldErrors(mergedLeague);
			const candidateEntries = Object.entries(mergedErrors).map(([key, value]) => [
				key.replace(/^league\./, ''),
				value
			] as const);

			for (const [key, value] of candidateEntries) {
				const fieldKey =
					key === 'scheduleRange'
						? 'scheduleRange'
						: key === 'regStartDate' ||
							  key === 'regEndDate' ||
							  key === 'seasonStartDate' ||
							  key === 'seasonEndDate' ||
							  key === 'preseasonStartDate' ||
							  key === 'preseasonEndDate' ||
							  key === 'postseasonStartDate' ||
							  key === 'postseasonEndDate' ||
							  key === 'imageUrl'
							? key
							: null;
				if (!fieldKey || errors[fieldKey]) continue;

				const isTouched =
					fieldKey === 'regStartDate'
						? bulkEditLeaguesForm.regStartDate.trim().length > 0
						: fieldKey === 'regEndDate'
							? bulkEditLeaguesForm.regEndDate.trim().length > 0
							: fieldKey === 'seasonStartDate'
								? bulkEditLeaguesForm.seasonStartDate.trim().length > 0
								: fieldKey === 'seasonEndDate'
									? bulkEditLeaguesForm.seasonEndDate.trim().length > 0
									: fieldKey === 'preseasonStartDate' || fieldKey === 'preseasonEndDate'
										? bulkEditLeaguesForm.hasPreseason !== 'unchanged' ||
											preseasonDatesTouched
										: fieldKey === 'postseasonStartDate' || fieldKey === 'postseasonEndDate'
											? bulkEditLeaguesForm.hasPostseason !== 'unchanged' ||
												postseasonDatesTouched
											: fieldKey === 'imageUrl'
												? bulkEditLeaguesForm.imageUrl.trim().length > 0
												: bulkEditLeaguesForm.regStartDate.trim().length > 0 ||
													bulkEditLeaguesForm.regEndDate.trim().length > 0 ||
													bulkEditLeaguesForm.seasonStartDate.trim().length > 0 ||
													bulkEditLeaguesForm.seasonEndDate.trim().length > 0 ||
													bulkEditLeaguesForm.hasPreseason !== 'unchanged' ||
													preseasonDatesTouched ||
													bulkEditLeaguesForm.hasPostseason !== 'unchanged' ||
													postseasonDatesTouched;
				if (!isTouched) continue;

				errors[fieldKey] =
					selectedTemplates.length > 1 ? `${template.name}: ${value}` : value;
			}
		}

		return errors;
	}

	function bulkLeagueStepTitle(step: BulkLeagueWizardStep): string {
		return BULK_LEAGUE_WIZARD_STEP_TITLES[step];
	}

	function bulkLeagueStepProgress(step: BulkLeagueWizardStep): number {
		return Math.round((step / 3) * 100);
	}

	function toggleBulkEditLeagueSelection(leagueId: string): void {
		const normalizedLeagueId = leagueId.trim();
		if (!normalizedLeagueId) return;
		bulkEditLeagueSelectedIds = bulkEditLeagueSelectedIds.includes(normalizedLeagueId)
			? bulkEditLeagueSelectedIds.filter((value) => value !== normalizedLeagueId)
			: [...bulkEditLeagueSelectedIds, normalizedLeagueId];
		clearBulkEditLeaguesApiErrors();
	}

	function selectAllBulkEditLeagues(): void {
		bulkEditLeagueSelectedIds = getBulkEditableLeaguesForCurrentOffering()
			.map((league) => league.id)
			.filter((leagueId) => leagueId.trim().length > 0);
		clearBulkEditLeaguesApiErrors();
	}

	function clearBulkEditLeagueSelection(): void {
		bulkEditLeagueSelectedIds = [];
		clearBulkEditLeaguesApiErrors();
	}

	function getBulkEditableLeaguesForCurrentOffering(): LeagueTemplate[] {
		const offeringId = bulkEditingOfferingId?.trim() ?? '';
		if (!offeringId) return [];
		return leagueTemplates.filter((league) => league.offeringId === offeringId);
	}

	function buildBulkEditLeagueChangesPayload(form: BulkLeagueEditFormState): Record<string, unknown> {
		const changes: Record<string, unknown> = {};

		if (form.description.trim()) changes.description = normalizeOptionalTextForRequest(form.description);
		if (form.gender !== 'unchanged') changes.gender = form.gender;
		if (form.skillLevel !== 'unchanged') changes.skillLevel = form.skillLevel;
		if (form.regStartDate.trim()) changes.regStartDate = normalizeDateForRequest(form.regStartDate);
		if (form.regEndDate.trim()) changes.regEndDate = normalizeDateForRequest(form.regEndDate);
		if (form.seasonStartDate.trim()) {
			changes.seasonStartDate = normalizeDateForRequest(form.seasonStartDate);
		}
		if (form.seasonEndDate.trim()) changes.seasonEndDate = normalizeDateForRequest(form.seasonEndDate);

		const hasPostseason = parseBulkBooleanChoice(form.hasPostseason);
		if (hasPostseason !== undefined) changes.hasPostseason = hasPostseason;
		if (form.postseasonStartDate.trim()) {
			changes.postseasonStartDate = normalizeDateForRequest(form.postseasonStartDate);
		}
		if (form.postseasonEndDate.trim()) {
			changes.postseasonEndDate = normalizeDateForRequest(form.postseasonEndDate);
		}

		const hasPreseason = parseBulkBooleanChoice(form.hasPreseason);
		if (hasPreseason !== undefined) changes.hasPreseason = hasPreseason;
		if (form.preseasonStartDate.trim()) {
			changes.preseasonStartDate = normalizeDateForRequest(form.preseasonStartDate);
		}
		if (form.preseasonEndDate.trim()) {
			changes.preseasonEndDate = normalizeDateForRequest(form.preseasonEndDate);
		}

		const isActive = parseBulkBooleanChoice(form.isActive);
		if (isActive !== undefined) changes.isActive = isActive;
		const isLocked = parseBulkBooleanChoice(form.isLocked);
		if (isLocked !== undefined) changes.isLocked = isLocked;
		if (form.imageUrl.trim()) changes.imageUrl = normalizeOptionalUrlForRequest(form.imageUrl);

		return changes;
	}

	function bulkEditChangeSummary(): string[] {
		const lines: string[] = [];
		if (bulkEditLeaguesForm.description.trim()) lines.push('Description');
		if (bulkEditLeaguesForm.gender !== 'unchanged') lines.push('Gender');
		if (bulkEditLeaguesForm.skillLevel !== 'unchanged') lines.push('Skill level');
		if (bulkEditLeaguesForm.regStartDate.trim()) lines.push('Registration start');
		if (bulkEditLeaguesForm.regEndDate.trim()) lines.push('Registration end');
		if (bulkEditLeaguesForm.seasonStartDate.trim()) lines.push('Season start');
		if (bulkEditLeaguesForm.seasonEndDate.trim()) lines.push('Season end');
		if (bulkEditLeaguesForm.hasPreseason !== 'unchanged') lines.push('Preseason enabled state');
		if (bulkEditLeaguesForm.preseasonStartDate.trim()) lines.push('Preseason start');
		if (bulkEditLeaguesForm.preseasonEndDate.trim()) lines.push('Preseason end');
		if (bulkEditLeaguesForm.hasPostseason !== 'unchanged') lines.push('Postseason enabled state');
		if (bulkEditLeaguesForm.postseasonStartDate.trim()) lines.push('Postseason start');
		if (bulkEditLeaguesForm.postseasonEndDate.trim()) lines.push('Postseason end');
		if (bulkEditLeaguesForm.isActive !== 'unchanged') lines.push('Active state');
		if (bulkEditLeaguesForm.isLocked !== 'unchanged') lines.push('Locked state');
		if (bulkEditLeaguesForm.imageUrl.trim()) lines.push('Image URL');
		return lines;
	}

	function nextBulkEditLeaguesStep(): void {
		bulkEditLeaguesValidationVisible = true;
		const errors = getBulkEditLeaguesFieldErrors();
		if (
			(bulkEditLeaguesStep === 1 && errors.selectedLeagueIds) ||
			(bulkEditLeaguesStep === 2 &&
				Object.keys(errors).some((key) => key !== 'selectedLeagueIds'))
		) {
			return;
		}

		if (bulkEditLeaguesStep < 3) {
			bulkEditLeaguesStep = (bulkEditLeaguesStep + 1) as BulkLeagueWizardStep;
		}
	}

	function previousBulkEditLeaguesStep(): void {
		clearBulkEditLeaguesApiErrors();
		if (bulkEditLeaguesStep > 1) {
			bulkEditLeaguesStep = (bulkEditLeaguesStep - 1) as BulkLeagueWizardStep;
		}
	}

	function buildDraftFromTemplate(template: LeagueTemplate): WizardLeagueInput {
		const baseName = template.name.trim() || (template.offeringId ? 'League' : 'Group');
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
			seasonId: template.seasonId ?? selectedSeasonId,
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

	function mapDraftLeagueToTemplate(
		leagueId: string,
		offeringId: string,
		league: WizardLeagueInput,
		stackOrder: number | null
	): LeagueTemplate {
		return {
			id: leagueId,
			offeringId,
			seasonId: league.seasonId.trim(),
			name: league.name.trim() || 'Untitled League',
			slug: slugifyFinal(league.slug),
			description: normalizeOptionalTextForRequest(league.description),
			season: getSeasonLabel(league.seasonId),
			gender: league.gender || null,
			skillLevel: league.skillLevel || null,
			regStartDate: normalizeDateForRequest(league.regStartDate) || null,
			regEndDate: normalizeDateForRequest(league.regEndDate) || null,
			seasonStartDate: normalizeDateForRequest(league.seasonStartDate) || null,
			seasonEndDate: normalizeDateForRequest(league.seasonEndDate) || null,
			hasPostseason: league.hasPostseason,
			postseasonStartDate: league.hasPostseason
				? normalizeDateForRequest(league.postseasonStartDate) || null
				: null,
			postseasonEndDate: league.hasPostseason
				? normalizeDateForRequest(league.postseasonEndDate) || null
				: null,
			hasPreseason: league.hasPreseason,
			preseasonStartDate: league.hasPreseason
				? normalizeDateForRequest(league.preseasonStartDate) || null
				: null,
			preseasonEndDate: league.hasPreseason
				? normalizeDateForRequest(league.preseasonEndDate) || null
				: null,
			isActive: league.isActive,
			isLocked: league.isLocked,
			imageUrl: normalizeOptionalUrlForRequest(league.imageUrl),
			stackOrder
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
			seasonId: createLeagueForm.league.seasonId.trim(),
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
		createLeagueForm.league.seasonId = selectedSeasonId;
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
			stackOrder: createLeagueForm.leagues.length + 1,
			seasonId: selectedSeasonId
		};
		createLeagueDraftActive = true;
		createLeagueStep = 2;
	}

	function cancelCreateLeagueDraft(): void {
		createLeagueEditingIndex = null;
		createLeagueSlugTouched = false;
		createLeagueDraftActive = false;
		createLeagueForm.league = createEmptyLeague();
		createLeagueForm.league.seasonId = selectedSeasonId;
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
					defaultLeagueSlug(
						sourceLeague.name,
						getLeagueOfferingById(createLeagueForm.offeringId)?.name || ''
					);
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
		const baseName = source.name.trim() || wizardEntryUnitTitleSingular();
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
		if (createLeagueForm.leagues.length === 0) {
			createLeagueCopiedFromExisting = false;
		}
		createLeagueEditingIndex = adjustEditingIndexOnRemove(createLeagueEditingIndex, index);
		if (wasEditingRemoved) {
			cancelCreateLeagueDraft();
			return;
		}
	}

	function copyFromExistingLeagueTemplate(template: LeagueTemplate): void {
		clearCreateLeagueApiErrors();
		createLeagueEditingIndex = null;
		createLeagueForm.league = buildDraftFromTemplate(template);
		createLeagueSlugTouched = false;
		createLeagueCopiedFromExisting = true;
		createLeagueDraftActive = true;
		createLeagueStep = 2;
	}

	function getCreateLeagueStepClientErrors(
		values: LeagueWizardFormState,
		step: LeagueWizardStep
	): Record<string, string> {
		if (step === 1) {
			return values.offeringId.trim()
				? {}
				: {
						offeringId: 'Select an offering.'
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
			errors['offeringId'] = 'Select an offering.';
		}
		if (values.leagues.length === 0) {
			errors['leagues'] = `Add at least one ${wizardEntryUnitSingular()}.`;
		} else {
			values.leagues.forEach((league, index) => {
				Object.assign(errors, getLeagueFieldErrors(league, `leagues.${index}`));
			});
			Object.assign(errors, getLeagueCollectionScopeErrors(values.leagues));
			Object.assign(
				errors,
				getExistingOfferingLeagueScopeErrors(
					values.offeringId,
					values.leagues,
					'leagues',
					createLeagueMode === 'edit' ? editingLeagueId : null
				)
			);
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
		createSuccessMessage = '';
		const submittedOfferingId = createLeagueForm.offeringId;
		const submittedLeagues = createLeagueForm.leagues.map((league) => ({ ...league }));

		const payload = {
			offeringId: submittedOfferingId,
			leagues: submittedLeagues.map(mapLeagueForRequest)
		};

		try {
			if (createLeagueMode === 'edit') {
				const leagueId = editingLeagueId?.trim() ?? '';
				const submittedLeague = submittedLeagues[0];
				if (!leagueId || !submittedLeague) {
					createLeagueFormError = `Unable to update ${wizardEntryUnitSingular()} right now.`;
					return;
				}

				const response = await fetch('/api/intramural-sports/leagues', {
					method: 'PATCH',
					headers: {
						'content-type': 'application/json'
					},
					body: JSON.stringify({
						leagueId,
						offeringId: submittedOfferingId,
						league: mapLeagueForRequest(submittedLeague)
					})
				});

				let body: UpdateLeagueApiResponse | null = null;
				try {
					body = (await response.json()) as UpdateLeagueApiResponse;
				} catch {
					body = null;
				}

				if (!response.ok || !body?.success || !body?.data?.leagueId) {
					createLeagueServerFieldErrors = toServerFieldErrorMap(body?.fieldErrors);
					const combinedErrors = {
						...getCreateLeagueSubmitErrors(createLeagueForm),
						...createLeagueServerFieldErrors
					};
					createLeagueStep = firstInvalidCreateLeagueStep(combinedErrors);
					createLeagueFormError =
						body?.error || `Unable to update ${wizardEntryUnitSingular()} right now.`;
					return;
				}

				searchQuery = '';
				createSuccessMessage = `${wizardEntryUnitTitleSingular()} updated successfully.`;
				await invalidateAll();
				const rowOfferingSlug = editingLeagueOfferingSlug;
				closeCreateLeagueWizard();
				if (rowOfferingSlug) {
					await tick();
					await scrollToLeagueRow(rowOfferingSlug, body.data.leagueId);
				}
				return;
			}

			const response = await fetch('/api/intramural-sports/leagues', {
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

			activities = [...body.data.activities, ...activities];
			const stackOrderByLeagueId = new Map(
				body.data.activities
					.filter((activity) => activity.leagueId)
					.map((activity) => [activity.leagueId as string, activity.stackOrder ?? null])
			);
			const createdTemplates = body.data.leagueIds
				.map((leagueId, index) => {
					const sourceLeague = submittedLeagues[index];
					if (!sourceLeague) return null;
					return mapDraftLeagueToTemplate(
						leagueId,
						submittedOfferingId,
						sourceLeague,
						stackOrderByLeagueId.get(leagueId) ?? sourceLeague.stackOrder ?? null
					);
				})
				.filter((league): league is LeagueTemplate => Boolean(league));
			if (createdTemplates.length > 0) {
				const merged = new Map(leagueTemplates.map((league) => [league.id, league] as const));
				for (const league of createdTemplates) {
					merged.set(league.id, league);
				}
				leagueTemplates = Array.from(merged.values());
			}
			searchQuery = '';
			const createdCount = body.data.leagueIds.length;
			createSuccessMessage = `${createdCount} ${pluralize(
				createdCount,
				wizardEntryUnitSingular(),
				wizardEntryUnitPlural()
			)} created successfully.`;
			closeCreateLeagueWizard();
		} catch {
			createLeagueFormError = `Unable to save ${wizardEntryUnitPlural()} right now.`;
		} finally {
			createLeagueSubmitting = false;
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

	function normalizeSearch(value: string): string {
		return value.toLowerCase().replace(/[^a-z0-9]/g, '');
	}

	function searchTokens(value: string): string[] {
		return value
			.toLowerCase()
			.split(/[\s/|,()_-]+/)
			.map((part) => normalizeSearch(part))
			.filter((part) => part.length > 0);
	}

	function maxSearchDistance(tokenLength: number): number {
		if (tokenLength <= 4) return 1;
		if (tokenLength <= 8) return 2;
		return 3;
	}

	function isWithinLevenshteinDistance(
		source: string,
		target: string,
		maxDistance: number
	): boolean {
		if (source === target) return true;
		if (Math.abs(source.length - target.length) > maxDistance) return false;

		const previousRow = Array.from({ length: target.length + 1 }, (_, index) => index);
		const currentRow = new Array<number>(target.length + 1).fill(0);

		for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
			currentRow[0] = sourceIndex;
			let minRowValue = currentRow[0];

			for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
				const substitutionCost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;
				const insertCost = currentRow[targetIndex - 1] + 1;
				const deleteCost = previousRow[targetIndex] + 1;
				const replaceCost = previousRow[targetIndex - 1] + substitutionCost;
				const nextCost = Math.min(insertCost, deleteCost, replaceCost);
				currentRow[targetIndex] = nextCost;
				if (nextCost < minRowValue) minRowValue = nextCost;
			}

			if (minRowValue > maxDistance) return false;
			for (let index = 0; index <= target.length; index += 1) {
				previousRow[index] = currentRow[index];
			}
		}

		return previousRow[target.length] <= maxDistance;
	}

	function tokenMatchesFuzzy(queryToken: string, candidateToken: string): boolean {
		if (candidateToken.includes(queryToken)) return true;
		if (queryToken.length < 3 || candidateToken.length < 3) return false;

		const maxDistance = Math.min(
			maxSearchDistance(queryToken.length),
			maxSearchDistance(candidateToken.length)
		);
		return isWithinLevenshteinDistance(queryToken, candidateToken, maxDistance);
	}

	function tokenMatchStrength(queryToken: string, candidateToken: string): number {
		if (candidateToken === queryToken) return 4;
		if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) return 3;
		if (tokenMatchesFuzzy(queryToken, candidateToken)) return 2;
		return 0;
	}

	const SEARCH_MONTH_LOOKUP: Record<string, number> = {
		jan: 1,
		january: 1,
		feb: 2,
		february: 2,
		mar: 3,
		march: 3,
		apr: 4,
		april: 4,
		may: 5,
		jun: 6,
		june: 6,
		jul: 7,
		july: 7,
		aug: 8,
		august: 8,
		sep: 9,
		sept: 9,
		september: 9,
		oct: 10,
		october: 10,
		nov: 11,
		november: 11,
		dec: 12,
		december: 12
	};
	const SEARCH_MONTH_PATTERN =
		'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

	interface DateSearchQuery {
		month: number;
		day: number;
		year: number | null;
		matchedText: string;
	}

	function normalizeSearchYear(yearValue: number): number {
		if (yearValue >= 100) return yearValue;
		return 2000 + yearValue;
	}

	function parseDateSearchQuery(queryValue: string): DateSearchQuery | null {
		const trimmed = queryValue.trim();
		if (!trimmed) return null;

		const isoDateMatch = trimmed.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
		if (isoDateMatch) {
			const year = Number(isoDateMatch[1]);
			const month = Number(isoDateMatch[2]);
			const day = Number(isoDateMatch[3]);
			if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
				return {
					month,
					day,
					year,
					matchedText: isoDateMatch[0]
				};
			}
		}

		const slashDateMatch = trimmed.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
		if (slashDateMatch) {
			const month = Number(slashDateMatch[1]);
			const day = Number(slashDateMatch[2]);
			const year = slashDateMatch[3] ? normalizeSearchYear(Number(slashDateMatch[3])) : null;
			if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
				return {
					month,
					day,
					year,
					matchedText: slashDateMatch[0]
				};
			}
		}

		const monthDayRegex = new RegExp(
			`\\b(${SEARCH_MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{2,4}))?\\b`,
			'i'
		);
		const monthDayMatch = trimmed.match(monthDayRegex);
		if (monthDayMatch) {
			const monthToken = monthDayMatch[1]?.toLowerCase() ?? '';
			const month = SEARCH_MONTH_LOOKUP[monthToken] ?? null;
			const day = Number(monthDayMatch[2]);
			const year = monthDayMatch[3] ? normalizeSearchYear(Number(monthDayMatch[3])) : null;
			if (month && day >= 1 && day <= 31) {
				return {
					month,
					day,
					year,
					matchedText: monthDayMatch[0]
				};
			}
		}

		const dayMonthRegex = new RegExp(
			`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${SEARCH_MONTH_PATTERN})\\.?((?:,?\\s+(\\d{2,4})))?\\b`,
			'i'
		);
		const dayMonthMatch = trimmed.match(dayMonthRegex);
		if (dayMonthMatch) {
			const day = Number(dayMonthMatch[1]);
			const monthToken = dayMonthMatch[2]?.toLowerCase() ?? '';
			const month = SEARCH_MONTH_LOOKUP[monthToken] ?? null;
			const year = dayMonthMatch[4] ? normalizeSearchYear(Number(dayMonthMatch[4])) : null;
			if (month && day >= 1 && day <= 31) {
				return {
					month,
					day,
					year,
					matchedText: dayMonthMatch[0]
				};
			}
		}

		return null;
	}

	function extractDatePartsFromValue(
		value: string | null | undefined
	): { year: number; month: number; day: number } | null {
		if (!value) return null;
		const leadingDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (leadingDateMatch) {
			return {
				year: Number(leadingDateMatch[1]),
				month: Number(leadingDateMatch[2]),
				day: Number(leadingDateMatch[3])
			};
		}

		const parsed = parseDate(value);
		if (!parsed) return null;
		return {
			year: parsed.getFullYear(),
			month: parsed.getMonth() + 1,
			day: parsed.getDate()
		};
	}

	function dateValueMatchesQuery(
		dateValue: string | null | undefined,
		dateQuery: DateSearchQuery
	): boolean {
		const dateParts = extractDatePartsFromValue(dateValue);
		if (!dateParts) return false;
		if (dateParts.month !== dateQuery.month || dateParts.day !== dateQuery.day) return false;
		if (dateQuery.year !== null && dateParts.year !== dateQuery.year) return false;
		return true;
	}

	function evaluateTextSearchMatch(
		queryValue: string,
		searchParts: Array<string | null | undefined>
	): { matched: boolean; score: number } {
		const normalizedQuery = normalizeSearch(queryValue);
		if (!normalizedQuery) return { matched: true, score: 0 };

		const normalizedParts = searchParts
			.map((part) => normalizeSearch(part ?? ''))
			.filter((part) => part.length > 0);
		if (normalizedParts.length === 0) return { matched: false, score: 0 };

		let directMatchScore = 0;
		for (const part of normalizedParts) {
			if (part === normalizedQuery) {
				directMatchScore = Math.max(directMatchScore, 3);
				continue;
			}
			if (part.includes(normalizedQuery)) {
				directMatchScore = Math.max(directMatchScore, 2);
				continue;
			}
			if (normalizedQuery.length >= 3 && part.length >= 3) {
				const maxDistance = Math.min(
					maxSearchDistance(normalizedQuery.length),
					maxSearchDistance(part.length)
				);
				if (isWithinLevenshteinDistance(normalizedQuery, part, maxDistance)) {
					directMatchScore = Math.max(directMatchScore, 1);
				}
			}
		}

		const queryTokens = searchTokens(queryValue);
		const candidateTokens = searchParts.flatMap((part) => searchTokens(part ?? ''));
		if (queryTokens.length === 0 || candidateTokens.length === 0) {
			return directMatchScore > 0
				? {
						matched: true,
						score: directMatchScore === 3 ? 10000 : directMatchScore === 2 ? 8000 : 6500
					}
				: { matched: false, score: 0 };
		}

		const tokenStrengths = queryTokens.map((queryToken) => {
			let strength = 0;
			for (const candidateToken of candidateTokens) {
				const nextStrength = tokenMatchStrength(queryToken, candidateToken);
				if (nextStrength > strength) strength = nextStrength;
				if (strength === 4) break;
			}
			return strength;
		});

		const matchedTokenCount = tokenStrengths.filter((strength) => strength > 0).length;
		const exactTokenCount = tokenStrengths.filter((strength) => strength === 4).length;
		const containsTokenCount = tokenStrengths.filter((strength) => strength === 3).length;
		const fuzzyTokenCount = tokenStrengths.filter((strength) => strength === 2).length;
		const missingTokenCount = queryTokens.length - matchedTokenCount;
		const isOffByOneWord = queryTokens.length >= 2 && missingTokenCount === 1;
		const fullyMatched = missingTokenCount === 0;
		const matched = directMatchScore > 0 || fullyMatched || isOffByOneWord;

		if (!matched) return { matched: false, score: 0 };

		let score = 0;
		if (directMatchScore === 3) score += 10000;
		else if (directMatchScore === 2) score += 8000;
		else if (directMatchScore === 1) score += 6500;
		score += exactTokenCount * 320;
		score += containsTokenCount * 220;
		score += fuzzyTokenCount * 140;
		score += Math.round((matchedTokenCount / Math.max(queryTokens.length, 1)) * 120);
		if (isOffByOneWord) score -= 280;

		return { matched: true, score };
	}

	function evaluateSearchMatch(
		queryValue: string,
		searchParts: Array<string | null | undefined>,
		dateValues: Array<string | null | undefined> = []
	): { matched: boolean; score: number } {
		const dateQuery = parseDateSearchQuery(queryValue);
		if (!dateQuery) {
			return evaluateTextSearchMatch(queryValue, searchParts);
		}

		const hasDateMatch = dateValues.some((dateValue) =>
			dateValueMatchesQuery(dateValue, dateQuery)
		);
		if (!hasDateMatch) return { matched: false, score: 0 };

		const remainingQuery = queryValue
			.replace(dateQuery.matchedText, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		if (!normalizeSearch(remainingQuery)) {
			return {
				matched: true,
				score: 12000 + (dateQuery.year !== null ? 240 : 0)
			};
		}

		const textMatch = evaluateTextSearchMatch(remainingQuery, searchParts);
		if (!textMatch.matched) return { matched: false, score: 0 };
		return {
			matched: true,
			score: 12000 + (dateQuery.year !== null ? 240 : 0) + textMatch.score
		};
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
			minute: '2-digit',
			hour12: true
		});
	}

	function formatDeadlineDate(value: string | null): string {
		const parsed = parseDate(value);
		if (!parsed) return 'TBD';
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

	function formatSeasonBoundaryText(
		value: string | null,
		futureLabel: string,
		pastLabel: string
	): string {
		const parsed = parseDate(value);
		if (!parsed) return `${futureLabel} TBD`;
		const label = parsed.getTime() <= Date.now() ? pastLabel : futureLabel;
		return `${label} ${formatDate(value)}`;
	}

	function formatReviewDate(value: string | null, withTime = false): string {
		const parsed = parseDate(value);
		if (!parsed) return 'TBD';
		if (withTime) {
			return parsed.toLocaleString('en-US', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
		}
		return parsed.toLocaleDateString('en-US', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function formatReviewRange(start: string | null, end: string | null, withTime = false): string {
		const startLabel = formatReviewDate(start, withTime);
		const endLabel = formatReviewDate(end, withTime);
		return `${startLabel} - ${endLabel}`;
	}

	function normalizeGender(value: string | null): string | null {
		if (!value) return null;
		const normalized = value.trim().toLowerCase();
		if (normalized === 'male' || normalized === 'mens' || normalized === 'men') return 'Male';
		if (normalized === 'female' || normalized === 'womens' || normalized === 'women')
			return 'Female';
		if (
			normalized === 'mixed' ||
			normalized === 'coed' ||
			normalized === 'co-ed' ||
			normalized === 'corec' ||
			normalized === 'co-rec' ||
			normalized === 'unified'
		)
			return 'Mixed';
		if (normalized === 'open') return 'Open';
		return toTitleCase(value);
	}

	function buildCategoryLabel(activity: Activity): string {
		const leagueName = activity.leagueName?.trim();
		if (leagueName) return leagueName;
		const gender = normalizeGender(activity.gender ?? null);
		if (gender) return gender;
		return 'Untitled League';
	}

	function getSeasonMeta(activity: Activity): {
		key: string;
		label: string;
	} {
		const resolvedSeasonId = resolveActivitySeasonId(activity);
		const resolvedSeason = getSeasonById(resolvedSeasonId);
		if (resolvedSeason) {
			return {
				key: resolvedSeason.id,
				label: resolvedSeason.name
			};
		}

		const fallbackLabel = activity.seasonLabel?.trim() || activity.season?.trim() || 'Unscheduled';
		const fallbackSlug = slugifyFinal(fallbackLabel) || 'unscheduled';

		return {
			key: `season-${fallbackSlug}`,
			label: fallbackLabel
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
		const joinDeadline =
			seasonStart && regEnd
				? seasonStart.getTime() >= regEnd.getTime()
					? activity.seasonStart
					: activity.registrationEnd
				: (activity.seasonStart ?? activity.registrationEnd ?? null);

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

	function offeringGroupKey(
		offeringName: string,
		offeringType: 'league' | 'tournament',
		offeringSlug: string,
		splitByOfferingType: boolean
	): string {
		const normalizedSlug = slugifyFinal(offeringSlug);
		if (normalizedSlug) {
			return splitByOfferingType ? `${normalizedSlug}::${offeringType}` : normalizedSlug;
		}
		return splitByOfferingType ? `${offeringName}::${offeringType}` : offeringName;
	}

	function offeringCardSlug(offeringName: string, slugHint = ''): string {
		return slugifyFinal(slugHint) || slugifyFinal(offeringName) || 'offering';
	}

	function createEmptyOfferingGroup(input: {
		offeringId?: string | null;
		offeringName: string;
		offeringType: 'league' | 'tournament';
		offeringSlugHint?: string;
	}): OfferingGroup {
		return {
			offeringId: input.offeringId ?? null,
			offeringName: input.offeringName,
			offeringSlug: offeringCardSlug(input.offeringName, input.offeringSlugHint ?? ''),
			offeringType: input.offeringType,
			divisionCount: 0,
			openCount: 0,
			waitlistedCount: 0,
			closedCount: 0,
			leagues: []
		};
	}

	function mostRecentOfferingEndMs(offering: OfferingGroup): number {
		return offering.leagues.reduce((latestEndMs, league) => {
			const endMs = getEffectiveOfferingEndMs({
				seasonEnd: league.seasonEndDate,
				hasPostseason: league.hasPostseason,
				postseasonEnd: league.postseasonEndDate
			});
			return Math.max(latestEndMs, endMs);
		}, Number.NEGATIVE_INFINITY);
	}

	function sortConcludedOfferings(a: OfferingGroup, b: OfferingGroup): number {
		const endDiff = mostRecentOfferingEndMs(b) - mostRecentOfferingEndMs(a);
		if (endDiff !== 0) return endDiff;
		return sortOfferingsByName(a, b);
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

	function offeringTableColumnsFor(group: OfferingGroup): DataTableColumn[] {
		const columns: DataTableColumn[] = [
			{
				key: 'league',
				label: columnHeaderFor(group, 'league'),
				width: canEditLeagueRows ? '23%' : '24%',
				rowHeader: true
			},
			{
				key: 'status',
				label: 'Status',
				width: '12%'
			},
			{
				key: 'registration',
				label: columnHeaderFor(group, 'registration'),
				width: '22%',
				cellVerticalAlignment: 'top'
			},
			{
				key: 'join-team',
				label: 'Join Team Deadline',
				width: canEditLeagueRows ? '19%' : '20%',
				cellVerticalAlignment: 'top'
			},
			{
				key: 'range',
				label: columnHeaderFor(group, 'range'),
				width: canEditLeagueRows ? '20%' : '22%',
				cellVerticalAlignment: 'top'
			}
		];

		if (canEditLeagueRows) {
			columns.push(createDataTableRowActionColumn());
		}

		return columns;
	}

	function leagueRowHighlightClass(offeringSlug: string, leagueId: string): string {
		return highlightedLeagueRowId === getLeagueRowId(offeringSlug, leagueId)
			? 'league-row-highlight'
			: '';
	}

	function offeringArticleHighlightClass(offeringSlug: string): string {
		return highlightedOfferingArticleId === getOfferingArticleId(offeringSlug)
			? 'offering-article-highlight'
			: '';
	}

	function entryLabelFor(group: OfferingGroup): 'league' | 'group' {
		return group.offeringType === 'tournament' ? 'group' : 'league';
	}

	function entryTitleFor(group: OfferingGroup): 'League' | 'Group' {
		return group.offeringType === 'tournament' ? 'Group' : 'League';
	}

	function leagueRowActionOptions(group: OfferingGroup): DropdownOption[] {
		return [
			{
				value: 'edit-entry',
				label: `Edit ${entryTitleFor(group)}`
			}
		];
	}

	function handleLeagueRowAction(
		value: string,
		offering: OfferingGroup,
		league: LeagueOffering
	): void {
		if (value !== 'edit-entry') return;
		openEditLeagueWizard(offering, league);
	}

	function buildBoards(
		source: Activity[],
		splitByOfferingType = false,
		offeringSeeds: LeagueOfferingOption[] = []
	): SeasonBoard[] {
		const now = new Date();
		const seasonMap = new Map<
			string,
			{
				key: string;
				label: string;
				offerings: Map<string, OfferingGroup>;
			}
		>();

		for (const offeringSeed of offeringSeeds) {
			if (!offeringSeed.seasonId) continue;
			const season = getSeasonById(offeringSeed.seasonId);
			if (!season) continue;
			if (!seasonMap.has(season.id)) {
				seasonMap.set(season.id, {
					key: season.id,
					label: season.name,
					offerings: new Map<string, OfferingGroup>()
				});
			}

			const bucket = seasonMap.get(season.id);
			if (!bucket) continue;
			const offeringName = offeringSeed.name?.trim() || 'General Recreation';
			const offeringKey = offeringGroupKey(
				offeringName,
				offeringSeed.type,
				offeringSeed.slug,
				splitByOfferingType
			);
			if (!bucket.offerings.has(offeringKey)) {
				bucket.offerings.set(
					offeringKey,
					createEmptyOfferingGroup({
						offeringId: offeringSeed.id,
						offeringName,
						offeringType: offeringSeed.type,
						offeringSlugHint: offeringSeed.slug
					})
				);
			}
		}

		for (const activity of source) {
			const season = getSeasonMeta(activity);
			if (!seasonMap.has(season.key)) {
				seasonMap.set(season.key, {
					...season,
					offerings: new Map<string, OfferingGroup>()
				});
			}

			const bucket = seasonMap.get(season.key);
			if (!bucket) continue;

			const offeringName = activity.offeringName?.trim() || 'General Recreation';
			const offeringKey = offeringGroupKey(
				offeringName,
				activity.offeringType,
				activity.offeringSlug ?? '',
				splitByOfferingType
			);
			if (!bucket.offerings.has(offeringKey)) {
				bucket.offerings.set(
					offeringKey,
					createEmptyOfferingGroup({
						offeringId: activity.offeringId ?? null,
						offeringName,
						offeringType: activity.offeringType,
						offeringSlugHint: activity.offeringSlug ?? ''
					})
				);
			}

			const offeringGroup = bucket.offerings.get(offeringKey);
			if (!offeringGroup) continue;
			if (!offeringGroup.offeringId && activity.offeringId) {
				offeringGroup.offeringId = activity.offeringId;
			}

			const registrationWindow = getRegistrationWindowInfo(activity, now);
			const status = getOfferingStatus(activity, registrationWindow.windowState);
			const joinTeam = getJoinTeamInfo(activity);
			const categoryLabel = buildCategoryLabel(activity);
			const seasonConcluded = isOfferingTimelineConcluded(
				{
					seasonEnd: activity.seasonEnd ?? null,
					hasPostseason: activity.hasPostseason ?? false,
					postseasonEnd: activity.postseasonEnd ?? null
				},
				now
			);
			const leagueOffering: LeagueOffering = {
				id: activity.id,
				leagueSlug: activity.leagueSlug ?? null,
				leagueName: activity.leagueName,
				stackOrder: activity.stackOrder ?? Number.MAX_SAFE_INTEGER,
				categoryLabel,
				divisionCount: activity.divisionCount ?? 0,
				status,
				statusLabel:
					seasonConcluded
						? 'Concluded'
						: registrationWindow.windowState === 'upcoming'
						? 'Upcoming'
						: status === 'open'
							? 'Open'
							: status === 'waitlisted'
								? 'Waitlist'
								: 'Closed',
				teamRegistrationOpenText: registrationWindow.openText,
				teamRegistrationCloseText: registrationWindow.closeText,
				teamRegistrationOpenDate: activity.registrationStart ?? null,
				teamRegistrationDate: registrationWindow.anchorDate,
				teamRegistrationCloseDate: registrationWindow.closeDate,
				joinTeamText: joinTeam.text,
				joinTeamDate: joinTeam.date,
				seasonRangeText: formatRange(activity.seasonStart, activity.seasonEnd),
				seasonStartDate: activity.seasonStart ?? null,
				seasonEndDate: activity.seasonEnd ?? null,
				hasPostseason: activity.hasPostseason ?? false,
				postseasonEndDate: activity.postseasonEnd ?? null,
				seasonConcluded
			};

			offeringGroup.leagues.push(leagueOffering);
			offeringGroup.divisionCount += activity.divisionCount ?? 0;
			if (status === 'open') offeringGroup.openCount += 1;
			if (status === 'waitlisted') offeringGroup.waitlistedCount += 1;
			if (status === 'closed') offeringGroup.closedCount += 1;
		}

		const boards = Array.from(seasonMap.values())
			.map((bucket) => {
				const offerings = Array.from(bucket.offerings.values())
					.map((offering) => ({
						...offering,
						leagues: offering.leagues.sort((a, b) => {
							if (a.stackOrder !== b.stackOrder) return a.stackOrder - b.stackOrder;
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
					offerings,
					totalOfferings: offerings.length,
					totalLeagues,
					totalDivisions,
					openCount,
					waitlistedCount,
					closedCount
				} satisfies SeasonBoard;
			})
			.sort((a, b) => {
				if (selectedSeason?.id) {
					if (a.key === selectedSeason.id) return -1;
					if (b.key === selectedSeason.id) return 1;
				}
				return a.label.localeCompare(b.label);
			});

		return boards;
	}

	const showTournaments = $derived.by(() => offeringView === 'tournaments');
	const showAllOfferings = $derived.by(() => offeringView === 'all');
	const selectedSeason = $derived.by(
		() => seasons.find((season) => season.id === selectedSeasonId) ?? null
	);
	const existingCurrentSeason = $derived.by(
		() => seasons.find((season) => season.isCurrent) ?? null
	);
	const createSeasonCurrentTransitionRequired = $derived.by(
		() => createSeasonForm.isCurrent && existingCurrentSeason !== null
	);
	const createSeasonWillBeCurrent = $derived.by(() => {
		if (!createSeasonForm.isCurrent) return false;
		if (!existingCurrentSeason) return true;
		return createSeasonReplaceExistingCurrent;
	});
	const createSeasonWillDeactivateExistingCurrent = $derived.by(
		() =>
			createSeasonCurrentTransitionRequired &&
			createSeasonReplaceExistingCurrent &&
			createSeasonDeactivateExistingCurrent &&
			Boolean(existingCurrentSeason?.isActive)
	);
	const createSeasonCopyStepAvailable = $derived.by(() => seasons.length > 0);
	const createSeasonVisibleSteps = $derived.by((): SeasonWizardStep[] => {
		const steps: SeasonWizardStep[] = [1];
		if (createSeasonCopyStepAvailable) steps.push(2);
		if (createSeasonCurrentTransitionRequired) steps.push(3);
		steps.push(4);
		return steps;
	});
	const createSeasonWizardStepCount = $derived.by(() => createSeasonVisibleSteps.length);
	const createSeasonDisplayStep = $derived.by(() => {
		const currentStepIndex = createSeasonVisibleSteps.indexOf(createSeasonStep);
		return currentStepIndex >= 0 ? currentStepIndex + 1 : 1;
	});
	const createSeasonCopySourceActivities = $derived.by(() =>
		activities.filter((activity: Activity) => {
			if (!createSeasonCopy.sourceSeasonId) return false;
			if (activity.seasonId === createSeasonCopy.sourceSeasonId) return true;
			const resolvedActivitySeasonId = resolveActivitySeasonId(activity);
			return resolvedActivitySeasonId === createSeasonCopy.sourceSeasonId;
		})
	);
	const createSeasonCopySourceSeason = $derived.by(
		() => seasons.find((season) => season.id === createSeasonCopy.sourceSeasonId) ?? null
	);
	const createSeasonCopyIncludesLeagues = $derived.by(
		() =>
			createSeasonCopy.scope === 'offerings-leagues' || createSeasonCopy.scope === 'offerings-all'
	);
	const createSeasonCopyIncludesTournaments = $derived.by(
		() => createSeasonCopy.scope === 'offerings-all'
	);
	const createSeasonCopyOfferingsButtonLabel = $derived.by(() =>
		createSeasonCopyIncludesLeagues ? 'Offerings' : 'Only offerings'
	);
	const createSeasonCopyDivisionsToggleLabel = $derived.by(() =>
		createSeasonCopyIncludesTournaments ? 'Include divisions/groups' : 'Include divisions'
	);
	const createSeasonCopyPreview = $derived.by((): SeasonCopyPreview => {
		const sourceActivities = createSeasonCopySourceActivities;
		const scopedActivities =
			createSeasonCopy.scope === 'offerings-leagues'
				? sourceActivities.filter((activity) => activity.offeringType !== 'tournament')
				: sourceActivities;

		const offeringIds = new Set(
			scopedActivities
				.map((activity) => activity.offeringId)
				.filter((offeringId): offeringId is string => Boolean(offeringId))
		);

		if (createSeasonCopy.scope === 'offerings-only') {
			return {
				offeringCount: offeringIds.size,
				leagueCount: 0,
				tournamentGroupCount: 0,
				divisionCount: 0
			};
		}

		const leagueCount = scopedActivities.filter(
			(activity) => activity.offeringType !== 'tournament'
		).length;
		const tournamentGroupCount = scopedActivities.filter(
			(activity) => activity.offeringType === 'tournament'
		).length;
		const divisionCount = createSeasonCopy.includeDivisions
			? scopedActivities.reduce((sum, activity) => sum + (activity.divisionCount ?? 0), 0)
			: 0;

		return {
			offeringCount: offeringIds.size,
			leagueCount,
			tournamentGroupCount,
			divisionCount
		};
	});
	const seasonHistory = $derived.by(() => [...seasons].sort(compareSeasonHistoryOrder));
	const activeSeasonHistory = $derived.by(() => seasonHistory.filter((season) => season.isActive));
	const offeringViewDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: 'leagues', label: 'Leagues' },
		{ value: 'tournaments', label: 'Tournaments' },
		{ value: 'all', label: 'All' }
	]);
	const seasonHistoryDropdownOptions = $derived.by(() =>
		activeSeasonHistory.map((season) => ({
			value: season.id,
			label: season.name,
			statusLabel: seasonStatusLabelForHistory(season)
		}))
	);
	const seasonCopySourceDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: '', label: 'Select season...' },
		...seasonHistory.map((season) => ({
			value: season.id,
			label: season.name,
			statusLabel: seasonStatusLabelForHistory(season)
		}))
	]);
	const seasonDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: '', label: 'Select season...' },
		...seasonHistory.map((season) => ({
			value: season.id,
			label: season.name,
			statusLabel: seasonStatusLabelForHistory(season)
		}))
	]);
	const createOfferingSeasonDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: '', label: 'Select season...' },
		...seasons
			.filter((season) => season.isActive)
			.map((season) => ({
				value: season.id,
				label: season.name,
				statusLabel: seasonStatusLabelForHistory(season)
			}))
	]);
	const createOfferingLeagueSeasonDropdownOptions = $derived.by<DropdownOption[]>(() => {
		const offeringSeason = seasons.find((season) => season.id === createForm.offering.seasonId);
		if (!offeringSeason) return createOfferingSeasonDropdownOptions;
		return [
			{
				value: offeringSeason.id,
				label: offeringSeason.name,
				statusLabel: seasonStatusLabelForHistory(offeringSeason)
			}
		];
	});
	const previousOfferingLinkChoices = $derived.by(() =>
		buildPreviousOfferingLinkChoices({
			offerings: leagueOfferingOptions.map((offering) => ({
				id: offering.id,
				name: offering.name,
				slug: offering.slug,
				seasonId: offering.seasonId,
				seasonName: offering.seasonName,
				seriesId: offering.seriesId,
				isActive: offering.isActive
			})),
			seasons: seasons.map((season) => ({
				id: season.id,
				name: season.name,
				startDate: season.startDate
			})),
			selectedSeasonId: createForm.offering.seasonId,
			offeringName: createForm.offering.name,
			offeringSlug: createForm.offering.slug
		})
	);
	const offeringLinkDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: '', label: 'Do not link' },
		...previousOfferingLinkChoices.map((offering) => ({
			value: offering.id,
			label:
				offering.seasonCount > 1
					? `${offering.name} (${offering.seasonCount} previous seasons)`
					: `${offering.name} (${offering.seasonName ?? 'Previous season'})`
		}))
	]);
	const selectedLinkedOffering = $derived.by(
		() =>
			previousOfferingLinkChoices.find(
				(offering) => offering.id === createForm.offering.linkedOfferingId.trim()
			) ?? null
	);
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
	const bulkBooleanDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: 'unchanged', label: 'Leave unchanged' },
		{ value: 'true', label: 'Yes' },
		{ value: 'false', label: 'No' }
	]);
	const bulkGenderDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: 'unchanged', label: 'Leave unchanged' },
		...leagueGenderDropdownOptions.filter((option) => option.value.length > 0)
	]);
	const bulkSkillLevelDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: 'unchanged', label: 'Leave unchanged' },
		...leagueSkillLevelDropdownOptions.filter((option) => option.value.length > 0)
	]);
	const offeringTypeDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: 'league', label: 'League' },
		{ value: 'tournament', label: 'Tournament' }
	]);
	const offeringTypeLabel = $derived.by(() => {
		if (showTournaments) return 'Tournaments';
		if (showAllOfferings) return 'Offerings';
		return 'Leagues';
	});

	const seasonScopedActivities = $derived.by(() =>
		activities.filter((activity: Activity) => {
			if (!selectedSeasonId) return false;
			if (activity.seasonId === selectedSeasonId) return true;
			const resolvedActivitySeasonId = resolveActivitySeasonId(activity);
			return resolvedActivitySeasonId === selectedSeasonId;
		})
	);

	const leagueActivities = $derived.by(() =>
		seasonScopedActivities.filter(
			(activity: Activity) => activity.isActive && activity.offeringType !== 'tournament'
		)
	);

	const tournamentActivities = $derived.by(() =>
		seasonScopedActivities.filter(
			(activity: Activity) => activity.isActive && activity.offeringType === 'tournament'
		)
	);

	$effect(() => {
		const linkedOfferingId = createForm.offering.linkedOfferingId.trim();
		if (!linkedOfferingId) return;
		const stillAvailable = previousOfferingLinkChoices.some(
			(offering) => offering.id === linkedOfferingId
		);
		if (!stillAvailable) {
			createForm.offering.linkedOfferingId = '';
		}
	});

	function offeringOptionsForSeasonView(
		filter: 'league' | 'tournament' | 'all'
	): LeagueOfferingOption[] {
		if (!selectedSeasonId) return [];
		return leagueOfferingOptions
			.filter((offering: LeagueOfferingOption) => {
				if (!offering.isActive) return false;
				if (offering.seasonId !== selectedSeasonId) return false;
				if (filter !== 'all' && offering.type !== filter) return false;
				return true;
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	const seasonBoards = $derived.by(() => {
		if (showTournaments) {
			return buildBoards(tournamentActivities, false, offeringOptionsForSeasonView('tournament'));
		}
		if (showAllOfferings) {
			return buildBoards(
				[...leagueActivities, ...tournamentActivities],
				true,
				offeringOptionsForSeasonView('all')
			);
		}
		return buildBoards(leagueActivities, false, offeringOptionsForSeasonView('league'));
	});

	$effect(() => {
		offeringView;
	});

	$effect(() => {
		if (offeringViewHydrated || typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		const fromUrl = url.searchParams.get('view');
		const normalizedUrlView = normalizeOfferingViewAlias(fromUrl);
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
		if (createLeagueRequestHydrated || typeof window === 'undefined') return;
		if (!seasonSelectionHydrated || !offeringViewHydrated) return;
		const request = readCreateLeagueRequestFromUrl();
		if (!request) {
			createLeagueRequestHydrated = true;
			return;
		}

		const requestedOffering = getLeagueOfferingById(request.offeringId);
		if (!requestedOffering?.id) {
			clearCreateLeagueRequestFromUrl();
			createLeagueRequestHydrated = true;
			return;
		}

		if (
			requestedOffering.seasonId &&
			seasons.some((season) => season.id === requestedOffering.seasonId) &&
			selectedSeasonId !== requestedOffering.seasonId
		) {
			selectedSeasonId = requestedOffering.seasonId;
			return;
		}

		if (openCreateLeagueWizardForOffering(requestedOffering.id)) {
			clearCreateLeagueRequestFromUrl();
		}
		createLeagueRequestHydrated = true;
	});

	$effect(() => {
		if (!offeringViewHydrated || typeof window === 'undefined') return;
		writeStoredOfferingView(offeringView);
		const url = new URL(window.location.href);
		const currentView = normalizeOfferingViewAlias(url.searchParams.get('view'));
		const hasViewParam = url.searchParams.has('view');
		const currentSeason = url.searchParams.get('season') ?? '';
		const selectedSeason = getSeasonById(selectedSeasonId);
		const targetSeason =
			selectedSeason && !selectedSeason.isCurrent ? seasonUrlSlug(selectedSeason) : '';
		let urlChanged = false;
		if (offeringView === 'all') {
			if (hasViewParam) {
				url.searchParams.delete('view');
				urlChanged = true;
			}
		} else if (currentView !== offeringView) {
			url.searchParams.set('view', offeringView);
			urlChanged = true;
		}
		if (targetSeason.length > 0) {
			if (currentSeason !== targetSeason) {
				url.searchParams.set('season', targetSeason);
				urlChanged = true;
			}
		} else if (currentSeason.length > 0) {
			url.searchParams.delete('season');
			urlChanged = true;
		}
		if (!urlChanged) return;
		try {
			// Firefox can throw quota errors when cloning large existing history.state objects.
			replaceState(`${url.pathname}${url.search}${url.hash}`, {});
		} catch {
			// Ignore history state errors in restrictive browser modes.
		}
	});

	const currentSeasonBoard = $derived.by(() => {
		if (seasonBoards.length === 0) return null;
		return seasonBoards[0] ?? null;
	});
	const activeSeasonBoard = $derived.by(() => currentSeasonBoard);
	const badgeOfferingCount = $derived.by(() => {
		if (!activeSeasonBoard) return 0;
		return new Set(activeSeasonBoard.offerings.map((offering) => offering.offeringName)).size;
	});
	const badgeLeagueOrGroupCount = $derived.by(() => {
		if (!activeSeasonBoard) return 0;
		return activeSeasonBoard.totalLeagues;
	});
	const badgeLeagueOrGroupLabel = $derived.by(() => {
		if (showTournaments) return pluralize(badgeLeagueOrGroupCount, 'group', 'groups');
		if (showAllOfferings)
			return pluralize(badgeLeagueOrGroupCount, 'league/group', 'leagues/groups');
		return pluralize(badgeLeagueOrGroupCount, 'league', 'leagues');
	});

	const visibleOfferings = $derived.by(() => {
		if (!activeSeasonBoard) return [];
		const queryText = searchQuery.trim();
		const query = normalizeSearch(queryText);
		if (!query) {
			return activeSeasonBoard.offerings
				.map((offering) => ({
					...offering,
					...computeStatusCounts(offering.leagues)
				}))
				.sort(sortOfferingsByName);
		}

		return activeSeasonBoard.offerings
			.map((offering) => {
				const offeringMatch = evaluateSearchMatch(queryText, [offering.offeringName]);
				if (offeringMatch.matched) {
					return {
						...offering,
						leagues: offering.leagues,
						searchScore: offeringMatch.score,
						...computeStatusCounts(offering.leagues)
					};
				}

				const matchedLeagues = offering.leagues
					.map((league, leagueIndex) => {
						const leagueMatch = evaluateSearchMatch(
							queryText,
							[
								offering.offeringName,
								league.categoryLabel,
								league.leagueName,
								league.teamRegistrationOpenText,
								league.teamRegistrationCloseText,
								league.joinTeamText
							],
							[
								league.teamRegistrationOpenDate,
								league.teamRegistrationDate,
								league.teamRegistrationCloseDate,
								league.joinTeamDate,
								league.seasonStartDate,
								league.seasonEndDate
							]
						);
						if (!leagueMatch.matched) return null;
						return {
							league,
							leagueIndex,
							score: leagueMatch.score
						};
					})
					.filter(
						(entry): entry is { league: LeagueOffering; leagueIndex: number; score: number } =>
							Boolean(entry)
					)
					.sort((a, b) => {
						if (a.score !== b.score) return b.score - a.score;
						return a.leagueIndex - b.leagueIndex;
					});

				if (matchedLeagues.length === 0) return null;
				const leagues = matchedLeagues.map((entry) => entry.league);
				const topLeagueScore = matchedLeagues[0]?.score ?? 0;
				return {
					...offering,
					leagues,
					searchScore: topLeagueScore,
					...computeStatusCounts(leagues)
				};
			})
			.filter(
				(
					offering
				): offering is OfferingGroup & {
					searchScore: number;
				} => Boolean(offering)
			)
			.sort((a, b) => {
				if (a.searchScore !== b.searchScore) return b.searchScore - a.searchScore;
				return sortOfferingsByName(a, b);
			})
			.map(({ searchScore: _searchScore, ...offering }) => offering);
	});

	const offeringTimelineLeagueSources = $derived.by<OfferingTimelineLeagueSource[]>(() => {
		if (!activeSeasonBoard) return [];

		return activeSeasonBoard.offerings.flatMap((offering) =>
			offering.leagues.map((league) => ({
				leagueId: league.id,
				leagueName: league.leagueName,
				categoryLabel: league.categoryLabel,
				offeringName: offering.offeringName,
				offeringSlug: offering.offeringSlug,
				registrationDeadlineDate: league.teamRegistrationCloseDate,
				registrationDeadlineLabel: league.teamRegistrationCloseText,
				joinTeamDate: league.joinTeamDate,
				joinTeamLabel: league.joinTeamText,
				seasonStartDate: league.seasonStartDate,
				seasonStartLabel: formatSeasonBoundaryText(league.seasonStartDate, 'Starts', 'Started'),
				seasonEndDate: league.seasonEndDate,
				seasonEndLabel: formatSeasonBoundaryText(league.seasonEndDate, 'Ends', 'Ended')
			}))
		);
	});
	const offeringTimelineGroups = $derived.by(() =>
		buildOfferingTimelineGroups(offeringTimelineLeagueSources, new Date())
	);
	const initialTimelineGroup = $derived.by(() => findInitialTimelineGroup(offeringTimelineGroups));
	const offeringTimelineDisplayGroups = $derived.by<OfferingTimelineDisplayGroup[]>(() =>
		offeringTimelineGroups.map((group) => {
			const buckets = new Map<string, OfferingTimelineOfferingBucket>();

			for (const event of group.events) {
				const key = `${event.offeringSlug}::${event.offeringName}`;
				if (!buckets.has(key)) {
					buckets.set(key, {
						key,
						offeringName: event.offeringName,
						offeringSlug: event.offeringSlug,
						events: []
					});
				}

				buckets.get(key)?.events.push({
					id: event.id,
					type: event.type,
					date: event.date,
					label: event.label,
					leagueId: event.leagueId,
					categoryLabel: event.categoryLabel,
					offeringName: event.offeringName,
					offeringSlug: event.offeringSlug,
					isPast: event.isPast
				});
			}

			return {
				id: group.id,
				date: group.date,
				ms: group.ms,
				isPast: group.isPast,
				offeringBuckets: Array.from(buckets.values())
			};
		})
	);
	const offeringTimelineSignature = $derived.by(() =>
		offeringTimelineGroups
			.map((group) => `${group.id}:${group.events.map((event) => event.id).join(',')}`)
			.join('|')
	);

	$effect(() => {
		const container = timelineContainerElement;
		const signature = offeringTimelineSignature;
		const initialGroupId = initialTimelineGroup?.id ?? '';

		if (!container) return;
		if (signature === lastTimelineAutoScrollSignature) return;

		lastTimelineAutoScrollSignature = signature;

		void tick().then(() => {
			const activeContainer = timelineContainerElement;
			if (!activeContainer) return;

			if (!initialGroupId) {
				activeContainer.scrollTo({ top: 0, behavior: 'auto' });
				return;
			}

			const target = document.getElementById(initialGroupId);
			if (!target) {
				activeContainer.scrollTo({ top: 0, behavior: 'auto' });
				return;
			}

			const targetTop =
				target.getBoundingClientRect().top -
				activeContainer.getBoundingClientRect().top +
				activeContainer.scrollTop;
			activeContainer.scrollTo({ top: targetTop, behavior: 'auto' });
		});
	});

	const nonConcludedOfferings = $derived.by(() =>
		visibleOfferings.filter((offering) => !isOfferingConcluded(offering))
	);
	const concludedOfferings = $derived.by(() =>
		visibleOfferings
			.filter((offering) => isOfferingConcluded(offering))
			.slice()
			.sort(sortConcludedOfferings)
	);
	const selectedSeasonIsHistorical = $derived.by(() =>
		selectedSeason ? seasonStatusLabelForHistory(selectedSeason) === 'PAST' : false
	);
	const renderedOfferings = $derived.by(() =>
		selectedSeasonIsHistorical ? concludedOfferings : nonConcludedOfferings
	);
	function offeringIdsForCurrentSeasonView(filter: 'league' | 'tournament' | 'all'): Set<string> {
		const sourceActivities =
			filter === 'tournament'
				? tournamentActivities
				: filter === 'league'
					? leagueActivities
					: [...leagueActivities, ...tournamentActivities];
		const ids = new Set(
			sourceActivities
				.map((activity: Activity) => activity.offeringId)
				.filter((offeringId): offeringId is string => Boolean(offeringId))
		);
		for (const offering of offeringOptionsForSeasonView(filter)) {
			ids.add(offering.id);
		}
		return ids;
	}
	const addEntryOptionCount = $derived.by(() => {
		const filter =
			offeringView === 'tournaments' ? 'tournament' : offeringView === 'leagues' ? 'league' : 'all';
		return offeringIdsForCurrentSeasonView(filter).size;
	});
	const addActionDropdownOptions = $derived.by<DropdownOption[]>(() => {
		if (!canManageOfferings) return [];
		const options: DropdownOption[] = [{ value: 'add-offering', label: 'Add Offering' }];
		options.push({
			value: 'add-entry',
			label: addEntryActionLabel(),
			disabled: addEntryOptionCount <= 0,
			disabledTooltip:
				addEntryOptionCount <= 0
					? 'Add an offering that matches this view to enable this action.'
					: undefined
		});
		options.push({ value: 'add-season', label: 'Add Season', separatorBefore: true });
		return options;
	});
	const createLeagueOfferingOptions = $derived.by(() =>
		leagueOfferingOptions.filter((offering: LeagueOfferingOption) => {
			if (!selectedSeasonId) return false;
			if (createLeagueOfferingFilter !== 'all' && offering.type !== createLeagueOfferingFilter) {
				return false;
			}
			if (offering.seasonId) {
				return offering.seasonId === selectedSeasonId;
			}
			return offeringIdsForCurrentSeasonView(createLeagueOfferingFilter).has(offering.id);
		})
	);
	const createLeagueOfferingDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: '', label: 'Select an offering...' },
		...createLeagueOfferingOptions.map((offeringOption: LeagueOfferingOption) => ({
			value: offeringOption.id,
			label: offeringOption.name
		}))
	]);
	const selectedLeagueWizardOffering = $derived.by(() =>
		getLeagueOfferingById(createLeagueForm.offeringId)
	);
	const selectedOfferingLeagueTemplates = $derived.by(() =>
		leagueTemplates
			.filter(
				(league: LeagueTemplate) =>
					league.offeringId === createLeagueForm.offeringId && league.seasonId === selectedSeasonId
			)
			.sort((a: LeagueTemplate, b: LeagueTemplate) => {
				const orderDiff =
					(a.stackOrder ?? Number.MAX_SAFE_INTEGER) - (b.stackOrder ?? Number.MAX_SAFE_INTEGER);
				if (orderDiff !== 0) return orderDiff;
				return a.name.localeCompare(b.name);
			})
	);
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
	const canGoNextCreateLeagueStep = $derived.by(
		() =>
			createLeagueStep < 4 &&
			Object.keys(clientCreateLeagueFieldErrors).length === 0 &&
			!createLeagueSubmitting
	);
	const canSubmitCreateLeague = $derived.by(
		() =>
			createLeagueStep === 4 &&
			Object.keys(getCreateLeagueSubmitErrors(createLeagueForm)).length === 0 &&
			Object.keys(createLeagueServerFieldErrors).length === 0 &&
			!createLeagueDraftActive &&
			!createLeagueSubmitting
	);
	const createLeagueStepProgress = $derived.by(() => Math.round((createLeagueStep / 4) * 100));
	const clientCreateSeasonFieldErrors = $derived.by(() =>
		getSeasonStepClientErrors(createSeasonForm, createSeasonCopy, createSeasonStep)
	);
	const rawCreateSeasonFieldErrors = $derived.by(() => ({
		...clientCreateSeasonFieldErrors,
		...createSeasonServerFieldErrors
	}));
	const createSeasonFieldErrors = $derived.by(() => {
		const visibleErrors: Record<string, string> = {};
		for (const [key, value] of Object.entries(rawCreateSeasonFieldErrors)) {
			if (!isRequiredFieldMessage(value)) {
				visibleErrors[key] = value;
			}
		}
		return visibleErrors;
	});
	const canGoNextCreateSeasonStep = $derived.by(() => {
		const currentStepIndex = createSeasonVisibleSteps.indexOf(createSeasonStep);
		return (
			currentStepIndex >= 0 &&
			currentStepIndex < createSeasonVisibleSteps.length - 1 &&
			Object.keys(clientCreateSeasonFieldErrors).length === 0 &&
			!createSeasonSubmitting
		);
	});
	const nextCreateSeasonLabel = $derived.by(() => {
		const currentStepIndex = createSeasonVisibleSteps.indexOf(createSeasonStep);
		if (currentStepIndex < 0 || currentStepIndex >= createSeasonVisibleSteps.length - 1) {
			return 'Next';
		}
		return createSeasonVisibleSteps[currentStepIndex + 1] === 4 ? 'Review' : 'Next';
	});
	const canSubmitCreateSeason = $derived.by(
		() =>
			createSeasonStep === 4 &&
			Object.keys({
				...getSeasonFieldErrors(createSeasonForm),
				...getSeasonCopyFieldErrors(createSeasonCopy),
				...getSeasonTransitionFieldErrors()
			}).length === 0 &&
			Object.keys(createSeasonServerFieldErrors).length === 0 &&
			!createSeasonSubmitting
	);
	const createSeasonStepProgress = $derived.by(() =>
		Math.round((createSeasonDisplayStep / createSeasonWizardStepCount) * 100)
	);
	const clientCreateFieldErrors = $derived.by(() =>
		getCurrentStepClientErrors(createForm, createStep)
	);
	const rawCreateFieldErrors = $derived.by(() => ({
		...clientCreateFieldErrors,
		...serverFieldErrors
	}));
	const createFieldErrors = $derived.by(() => {
		const visibleErrors: Record<string, string> = {};
		for (const [key, value] of Object.entries(rawCreateFieldErrors)) {
			if (!isRequiredFieldMessage(value)) {
				visibleErrors[key] = value;
			}
		}
		return visibleErrors;
	});
	const currentEditingOfferingTemplate = $derived.by(
		() =>
			offeringTemplates.find((offering: OfferingTemplate) => offering.id === editingOfferingId) ??
			null
	);
	const editOfferingClientErrors = $derived.by(() =>
		getOfferingFieldErrors(editOfferingForm, editingOfferingId)
	);
	const editOfferingFieldErrors = $derived.by(() => {
		const nextErrors: Record<string, string> = { ...editOfferingServerFieldErrors };
		if (!editOfferingValidationVisible) {
			return nextErrors;
		}
		return {
			...editOfferingClientErrors,
			...nextErrors
		};
	});
	const bulkEditableLeagues = $derived.by(() => getBulkEditableLeaguesForCurrentOffering());
	const bulkEditSelectedLeagueTemplates = $derived.by(() => getBulkEditSelectedLeagueTemplates());
	const bulkEditLeaguesFieldErrors = $derived.by(() => getBulkEditLeaguesFieldErrors());
	const canGoNextBulkEditLeaguesStep = $derived.by(() => {
		if (bulkEditLeaguesSubmitting) return false;
		if (bulkEditLeaguesStep === 1) {
			return bulkEditLeagueSelectedIds.length > 0;
		}
		if (bulkEditLeaguesStep === 2) {
			return (
				hasBulkEditLeaguesFieldChanges(bulkEditLeaguesForm) &&
				Object.keys(bulkEditLeaguesFieldErrors).every((key) => key === 'selectedLeagueIds')
			);
		}
		return false;
	});
	const canSubmitBulkEditLeagues = $derived.by(
		() =>
			bulkEditLeaguesStep === 3 &&
			hasUnsavedBulkEditLeaguesChanges() &&
			Object.keys(bulkEditLeaguesFieldErrors).every((key) => key === 'selectedLeagueIds') &&
			!bulkEditLeaguesSubmitting
	);
	const canGoNextStep = $derived.by(
		() => createStep < 6 && Object.keys(clientCreateFieldErrors).length === 0 && !createSubmitting
	);
	const canSubmitCreate = $derived.by(
		() =>
			createStep === 6 &&
			Object.keys(getSubmitClientErrors(createForm)).length === 0 &&
			Object.keys(serverFieldErrors).length === 0 &&
			!createSubmitting
	);
	const canSubmitEditOffering = $derived.by(
		() => hasUnsavedEditOfferingChanges() && !editOfferingSubmitting
	);
	const shouldShowCreateOfferingLinkStep = $derived.by(() =>
		shouldShowOfferingLinkStep(
			previousOfferingLinkChoices.length,
			createForm.offering.linkedOfferingId
		)
	);
	const createVisibleSteps = $derived.by<WizardStep[]>(() =>
		getCreateOfferingVisibleSteps(shouldShowCreateOfferingLinkStep)
	);
	const createStepDisplay = $derived.by(() => {
		const currentStepIndex = createVisibleSteps.indexOf(createStep);
		return currentStepIndex >= 0 ? currentStepIndex + 1 : 1;
	});
	const createStepProgress = $derived.by(() =>
		Math.round((createStepDisplay / createVisibleSteps.length) * 100)
	);

	$effect(() => {
		if (createVisibleSteps.includes(createStep)) return;
		createStep = createStep === 2 ? 3 : (createVisibleSteps[createVisibleSteps.length - 1] ?? 1);
	});

	function nextCreateStep(): void {
		clearCreateApiErrors();
		if (createStep === 6 || createSubmitting) return;
		const stepErrors = getCurrentStepClientErrors(createForm, createStep);
		if (Object.keys(stepErrors).length > 0) {
			createStep = firstInvalidStep(stepErrors);
			return;
		}

		if (createStep === 4) {
			createStep = leagueDraftActive ? 5 : 6;
			return;
		}

		if (createStep === 5) {
			if (!leagueDraftActive) {
				createStep = 4;
				return;
			}
			if (!addOrUpdateDraftLeague()) return;
			createStep = 4;
			return;
		}

		const currentStepIndex = createVisibleSteps.indexOf(createStep);
		if (currentStepIndex < 0 || currentStepIndex >= createVisibleSteps.length - 1) return;
		createStep = createVisibleSteps[currentStepIndex + 1];
	}

	function nextCreateSeasonStep(): void {
		clearCreateSeasonApiErrors();
		if (createSeasonSubmitting) return;
		const stepErrors = getSeasonStepClientErrors(
			createSeasonForm,
			createSeasonCopy,
			createSeasonStep
		);
		if (Object.keys(stepErrors).length > 0) {
			createSeasonStep = firstInvalidCreateSeasonStep(stepErrors);
			return;
		}

		const currentStepIndex = createSeasonVisibleSteps.indexOf(createSeasonStep);
		if (currentStepIndex < 0 || currentStepIndex >= createSeasonVisibleSteps.length - 1) return;
		createSeasonStep = createSeasonVisibleSteps[currentStepIndex + 1];
	}

	function previousCreateSeasonStep(): void {
		clearCreateSeasonApiErrors();
		const currentStepIndex = createSeasonVisibleSteps.indexOf(createSeasonStep);
		if (currentStepIndex <= 0) return;
		createSeasonStep = createSeasonVisibleSteps[currentStepIndex - 1];
	}

	$effect(() => {
		if (createSeasonVisibleSteps.includes(createSeasonStep)) return;
		createSeasonStep = createSeasonVisibleSteps[createSeasonVisibleSteps.length - 1] ?? 1;
	});

	function previousCreateStep(): void {
		clearCreateApiErrors();
		if (createStep === 1) return;

		if (createStep === 6) {
			createStep = leagueDraftActive ? 5 : 4;
			return;
		}

		const currentStepIndex = createVisibleSteps.indexOf(createStep);
		if (currentStepIndex <= 0) return;
		createStep = createVisibleSteps[currentStepIndex - 1];
	}

	function handleCreateBackAction(): void {
		if (leagueDraftActive && (createStep === 4 || createStep === 5)) {
			cancelLeagueDraft();
			createStep = 4;
			return;
		}
		previousCreateStep();
	}

	function statusClass(status: OfferingStatus, statusLabel: LeagueOffering['statusLabel']): string {
		if (statusLabel === 'Upcoming') return 'badge-primary-outlined';
		if (status === 'open') return 'badge-primary';
		if (status === 'waitlisted') return 'badge-primary-outlined';
		return 'badge-secondary-outlined';
	}

	function statusTooltipText(
		status: OfferingStatus,
		statusLabel: LeagueOffering['statusLabel']
	): string {
		if (statusLabel === 'Upcoming') return 'Team registration has not opened yet';
		if (statusLabel === 'Concluded') return 'This season has concluded';
		if (status === 'open') return 'Team registration is currently open';
		if (status === 'waitlisted') return 'Teams may register on the waitlist';
		return 'Team registration is now closed';
	}
</script>

<PageTitle pageTitle={pageLabel} />

<svelte:head>
	<meta
		name="description"
		content="View intramural offerings by season with leagues, registration status, and deadlines."
	/>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="dashboard-page-shell">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 py-2 lg:flex-row lg:items-center lg:justify-between">
				<div class="flex items-center gap-3">
					<div
						class="bg-primary text-white border-2 border-primary-700 w-11 h-11 lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
						aria-hidden="true"
					>
						<IconBallAmericanFootball class="w-7 h-7 lg:w-8 lg:h-8" />
					</div>
					<h1
						class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
					>
						{pageLabel}
					</h1>
				</div>
				<DashboardSearchLauncher />
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6">
		{#if seasonBoards.length === 0}
			<div class="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)] gap-6">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="p-4 border-b border-neutral-950 bg-neutral-600/66 space-y-3">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">
									{selectedSeason?.name ?? 'Season'}
								</h2>
								<ListboxDropdown
									options={offeringViewDropdownOptions}
									value={offeringView}
									ariaLabel="Offering type"
									buttonClass={COMPACT_DROPDOWN_BUTTON_CLASS}
									on:change={(event) => {
										handleOfferingViewChange(event.detail.value);
									}}
								/>
								{#if seasons.length > 0}
									{#if canManageOfferings}
										<ListboxDropdown
											options={seasonHistoryDropdownOptions}
											value={selectedSeasonId}
											ariaLabel="Season history"
											buttonClass={HISTORY_BUTTON_CLASS}
											listClass={HISTORY_DROPDOWN_LIST_CLASS}
											emptyText="No seasons configured."
											footerActionLabel="Add New Season"
											footerActionAriaLabel="Add new season"
											footerActionClass={HISTORY_DROPDOWN_FOOTER_ACTION_CLASS}
											footerSecondaryActionAriaLabel="Manage seasons"
											footerSecondaryActionClass={HISTORY_DROPDOWN_FOOTER_ICON_ACTION_CLASS}
											on:change={(event) => {
												handleSeasonHistoryChange(event.detail.value);
											}}
											on:footerAction={openCreateSeasonWizard}
											on:footerSecondaryAction={openManageSeasonWizard}
										>
											{#snippet trigger()}
												<IconHistory class={HEADER_ICON_CLASS} />
											{/snippet}
											{#snippet footerSecondaryAction()}
												<IconPencil class={HEADER_ICON_CLASS} />
											{/snippet}
										</ListboxDropdown>
									{:else}
										<ListboxDropdown
											options={seasonHistoryDropdownOptions}
											value={selectedSeasonId}
											ariaLabel="Season history"
											buttonClass={HISTORY_BUTTON_CLASS}
											listClass={HISTORY_DROPDOWN_LIST_CLASS}
											emptyText="No seasons configured."
											on:change={(event) => {
												handleSeasonHistoryChange(event.detail.value);
											}}
										>
											{#snippet trigger()}
												<IconHistory class={HEADER_ICON_CLASS} />
											{/snippet}
										</ListboxDropdown>
									{/if}
								{/if}
							</div>
							<div class="flex items-center gap-2 text-xs text-neutral-950 font-sans">
								<span class={HEADER_COUNT_BADGE_CLASS}>
									{badgeOfferingCount}
									{pluralize(badgeOfferingCount, 'offering', 'offerings')}
								</span>
								<span class={HEADER_COUNT_BADGE_CLASS}>
									{badgeLeagueOrGroupCount}
									{badgeLeagueOrGroupLabel}
								</span>
								{#if canManageOfferings}
									{#if seasons.length > 0}
										<SplitAddAction
											options={addActionDropdownOptions}
											buttonClass={HEADER_SPLIT_ADD_BUTTON_CLASS}
											menuButtonClass={HEADER_SPLIT_ADD_MENU_BUTTON_CLASS}
											on:click={openCreateWizard}
											on:action={(event) => {
												handleAddActionDropdown(event.detail.value);
											}}
										/>
									{:else}
										<button
											type="button"
											class="button-secondary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer"
											onclick={openCreateSeasonWizard}
										>
											Add Season
										</button>
									{/if}
								{/if}
							</div>
						</div>
						<SearchInput
							id="tournament-search-empty"
							label="Search offerings and deadlines"
							value={searchQuery}
							disabled
							placeholder={`Search offering, ${showTournaments ? 'group' : showAllOfferings ? 'league/group' : 'league'}, or deadline`}
							autocomplete="off"
							wrapperClass="relative"
							iconClass="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950"
							inputClass="input-neutral pl-10 pr-10 py-1 text-sm disabled:cursor-not-allowed"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer"
							clearIconClass="w-4 h-4"
							clearAriaLabel="Clear search"
							on:input={(event) => {
								searchQuery = event.detail.value;
							}}
						/>
					</div>

					<div class="p-4 space-y-4 min-h-136">
						<div class="border border-neutral-950 bg-white p-4 space-y-2">
							<h3 class="dashboard-section-title text-neutral-950">
								{#if seasons.length === 0}
									No seasons yet
								{:else}
									No offerings yet
								{/if}
							</h3>
							<p class="text-sm text-neutral-950 font-sans">
								{#if seasons.length === 0}
									Create a season to start managing offerings, leagues, and groups.
								{:else}
									Add or enable offerings to populate this board.
								{/if}
							</p>
						</div>

						{#each [0, 1] as _, skeletonOfferingIndex}
							<article class="border border-neutral-950 bg-white p-4 space-y-3" aria-hidden="true">
								<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
									<div class="space-y-2">
										<div
											class={`h-7 ${skeletonOfferingIndex === 0 ? 'w-44' : 'w-36'} bg-neutral-100`}
										></div>
										<div class="h-3 w-28 bg-neutral-100"></div>
									</div>
									<div class="flex flex-wrap items-center gap-1">
										<div class="h-5 w-16 bg-neutral-100"></div>
										<div class="h-5 w-16 bg-neutral-100"></div>
										<div class="h-5 w-16 bg-neutral-100"></div>
									</div>
								</div>

								<div class="border border-neutral-950 bg-white overflow-x-auto scrollbar-thin">
									<table class="w-full table-fixed border-collapse">
										<colgroup>
											<col class="w-[24%]" />
											<col class="w-[12%]" />
											<col class="w-[22%]" />
											<col class="w-[20%]" />
											<col class="w-[22%]" />
										</colgroup>
										<thead>
											<tr class="border-b border-neutral-950 bg-neutral">
												<th scope="col" class="px-2 py-1 text-left">
													<div class="h-3 w-20 bg-neutral-100"></div>
												</th>
												<th scope="col" class="px-2 py-1 text-left">
													<div class="h-3 w-12 bg-neutral-100"></div>
												</th>
												<th scope="col" class="px-2 py-1 text-left">
													<div class="h-3 w-24 bg-neutral-100"></div>
												</th>
												<th scope="col" class="px-2 py-1 text-left">
													<div class="h-3 w-24 bg-neutral-100"></div>
												</th>
												<th scope="col" class="px-2 py-1 text-left">
													<div class="h-3 w-20 bg-neutral-100"></div>
												</th>
											</tr>
										</thead>
										<tbody>
											{#each [0, 1, 2, 3] as _, leagueIndex}
												<tr
													class={`align-middle ${leagueIndex < 3 ? 'border-b border-neutral-950' : ''} ${leagueIndex % 2 === 0 ? 'bg-neutral-25' : 'bg-neutral-05'}`}
												>
													<th scope="row" class="px-2 py-1 text-left">
														<div class="flex items-center gap-2">
															<div
																class="w-9 h-9 border border-neutral-950 bg-neutral-100 flex items-center justify-center shrink-0"
																aria-hidden="true"
															>
																<div class="w-4 h-4 bg-neutral-300"></div>
															</div>
															<div class="h-4 w-32 bg-neutral-100"></div>
														</div>
													</th>
													<td class="px-2 py-1">
														<div class="h-5 w-16 bg-neutral-100"></div>
													</td>
													<td class="px-2 py-1">
														<div class="space-y-1">
															<div class="h-3 w-28 bg-neutral-100"></div>
															<div class="h-3 w-24 bg-neutral-100"></div>
														</div>
													</td>
													<td class="px-2 py-1">
														<div class="h-3 w-24 bg-neutral-100"></div>
													</td>
													<td class="px-2 py-1">
														<div class="h-3 w-32 bg-neutral-100"></div>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</article>
						{/each}
					</div>
				</section>

				<aside class="w-full min-w-0 space-y-6">
					<section class="border-2 border-neutral-950 bg-neutral">
						<div
							class="p-4 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between"
						>
							<h2 class="dashboard-section-title text-neutral-950">Season Timeline</h2>
							<IconCalendar class="w-5 h-5 text-secondary-700" />
						</div>
						<div class="h-[32rem] overflow-y-auto p-4" aria-hidden="true">
							<div class="space-y-5">
								{#each [0, 1, 2] as _, timelineIndex}
									<div class="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-3">
										<div class="relative min-h-4 pt-[0.125rem]">
											<div
												class="absolute bottom-0 left-[calc(50%+1px)] top-[0.125rem] z-0 w-px -translate-x-1/2 bg-neutral-950"
											></div>
											<div
												class="absolute left-[calc(50%+2px)] top-[0.125rem] z-10 h-3 w-3 -translate-x-1/2 border border-primary-900 bg-primary-500"
											></div>
										</div>
										<div class="space-y-2">
											<div
												class={`h-3 ${timelineIndex === 0 ? 'w-28' : timelineIndex === 1 ? 'w-32' : 'w-24'} bg-neutral-100`}
											></div>
											<div class="space-y-2">
												<div class="border border-neutral-950 bg-white p-2.5">
													<div class="flex items-center gap-2">
														<div class="h-7 w-7 bg-neutral-100 border border-neutral-950"></div>
														<div class="min-w-0 flex-1 space-y-1">
															<div class="h-3 w-24 bg-neutral-100"></div>
															<div class="h-3 w-40 bg-neutral-100"></div>
														</div>
													</div>
												</div>
												{#if timelineIndex !== 2}
													<div class="border border-neutral-950 bg-white p-2.5">
														<div class="flex items-center gap-2">
															<div class="h-7 w-7 bg-neutral-100 border border-neutral-950"></div>
															<div class="min-w-0 flex-1 space-y-1">
																<div class="h-3 w-20 bg-neutral-100"></div>
																<div class="h-3 w-36 bg-neutral-100"></div>
															</div>
														</div>
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</section>

					<section class="border-2 border-neutral-950 bg-neutral">
						<div class="p-4 border-b border-neutral-950 bg-neutral-600/66">
							<h2 class="dashboard-section-title text-neutral-950">Advertising Spot</h2>
						</div>
						<div class="p-3" aria-hidden="true">
							<div class="border-2 border-dashed border-secondary-400 bg-white px-4 py-5 space-y-4">
								<div class="space-y-2">
									<div class="h-3 w-32 bg-neutral-100"></div>
									<div class="h-6 w-4/5 bg-neutral-100"></div>
									<div class="h-3 w-full bg-neutral-100"></div>
									<div class="h-3 w-5/6 bg-neutral-100"></div>
								</div>
								<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
									<div class="border border-neutral-950 bg-neutral-25 px-3 py-2 space-y-2">
										<div class="h-3 w-14 bg-neutral-100"></div>
										<div class="h-3 w-24 bg-neutral-100"></div>
									</div>
									<div class="border border-neutral-950 bg-neutral-25 px-3 py-2 space-y-2">
										<div class="h-3 w-14 bg-neutral-100"></div>
										<div class="h-3 w-20 bg-neutral-100"></div>
									</div>
								</div>
								<div class="border-t border-neutral-950 pt-3">
									<div class="h-3 w-3/4 bg-neutral-100"></div>
								</div>
							</div>
						</div>
					</section>
				</aside>
			</div>
		{:else}
			<div class="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)] gap-6">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="p-4 border-b border-neutral-950 bg-neutral-600/66 space-y-3">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">
									{selectedSeason?.name ?? activeSeasonBoard?.label ?? 'Season'}
								</h2>
								<ListboxDropdown
									options={offeringViewDropdownOptions}
									value={offeringView}
									ariaLabel="Offering type"
									buttonClass={COMPACT_DROPDOWN_BUTTON_CLASS}
									on:change={(event) => {
										handleOfferingViewChange(event.detail.value);
									}}
								/>
								{#if canManageOfferings}
									<ListboxDropdown
										options={seasonHistoryDropdownOptions}
										value={selectedSeasonId}
										ariaLabel="Season history"
										buttonClass={HISTORY_BUTTON_CLASS}
										listClass={HISTORY_DROPDOWN_LIST_CLASS}
										emptyText="No seasons configured."
										footerActionLabel="Add New Season"
										footerActionAriaLabel="Add new season"
										footerActionClass={HISTORY_DROPDOWN_FOOTER_ACTION_CLASS}
										footerSecondaryActionAriaLabel="Manage seasons"
										footerSecondaryActionClass={HISTORY_DROPDOWN_FOOTER_ICON_ACTION_CLASS}
										on:change={(event) => {
											handleSeasonHistoryChange(event.detail.value);
										}}
										on:footerAction={openCreateSeasonWizard}
										on:footerSecondaryAction={openManageSeasonWizard}
									>
										{#snippet trigger()}
											<IconHistory class={HEADER_ICON_CLASS} />
										{/snippet}
										{#snippet footerSecondaryAction()}
											<IconPencil class={HEADER_ICON_CLASS} />
										{/snippet}
									</ListboxDropdown>
								{:else}
									<ListboxDropdown
										options={seasonHistoryDropdownOptions}
										value={selectedSeasonId}
										ariaLabel="Season history"
										buttonClass={HISTORY_BUTTON_CLASS}
										listClass={HISTORY_DROPDOWN_LIST_CLASS}
										emptyText="No seasons configured."
										on:change={(event) => {
											handleSeasonHistoryChange(event.detail.value);
										}}
									>
										{#snippet trigger()}
											<IconHistory class={HEADER_ICON_CLASS} />
										{/snippet}
									</ListboxDropdown>
								{/if}
							</div>
							<div class="flex items-center gap-2 text-xs text-neutral-950 font-sans">
								<span class={HEADER_COUNT_BADGE_CLASS}>
									{badgeOfferingCount}
									{pluralize(badgeOfferingCount, 'offering', 'offerings')}
								</span>
								<span class={HEADER_COUNT_BADGE_CLASS}>
									{badgeLeagueOrGroupCount}
									{badgeLeagueOrGroupLabel}
								</span>
								{#if canManageOfferings}
									{#if seasons.length > 0}
										<SplitAddAction
											options={addActionDropdownOptions}
											buttonClass={HEADER_SPLIT_ADD_BUTTON_CLASS}
											menuButtonClass={HEADER_SPLIT_ADD_MENU_BUTTON_CLASS}
											on:click={openCreateWizard}
											on:action={(event) => {
												handleAddActionDropdown(event.detail.value);
											}}
										/>
									{:else}
										<button
											type="button"
											class="button-secondary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer"
											onclick={openCreateSeasonWizard}
										>
											Add Season
										</button>
									{/if}
								{/if}
							</div>
						</div>
						<SearchInput
							id="tournament-search"
							label="Search offerings and deadlines"
							value={searchQuery}
							placeholder={`Search offering, ${showTournaments ? 'group' : showAllOfferings ? 'league/group' : 'league'}, or deadline`}
							autocomplete="off"
							wrapperClass="relative"
							iconClass="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950"
							inputClass="input-neutral pl-10 pr-10 py-1 text-sm disabled:cursor-not-allowed"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer"
							clearIconClass="w-4 h-4"
							clearAriaLabel="Clear search"
							on:input={(event) => {
								searchQuery = event.detail.value;
							}}
						/>
					</div>

					{#if visibleOfferings.length === 0}
						<div class="p-4 space-y-4 min-h-[34rem]">
							<div class="border border-warning-300 bg-warning-50 p-3">
								<p class="text-sm text-neutral-950 font-sans">
									{#if searchQuery.trim().length > 0}
										No {offeringTypeLabel.toLowerCase()} match "{searchQuery.trim()}" for this
										season.
									{:else}
										No {offeringTypeLabel.toLowerCase()} match this search for this season.
									{/if}
								</p>
							</div>

							{#each [0, 1] as _, skeletonOfferingIndex}
								<article
									class="border border-neutral-950 bg-white p-4 space-y-3"
									aria-hidden="true"
								>
									<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
										<div class="space-y-2">
											<div
												class={`h-7 ${skeletonOfferingIndex === 0 ? 'w-44' : 'w-36'} bg-neutral-100`}
											></div>
											<div class="h-3 w-28 bg-neutral-100"></div>
										</div>
										<div class="flex flex-wrap items-center gap-1">
											<div class="h-5 w-16 bg-neutral-100"></div>
											<div class="h-5 w-16 bg-neutral-100"></div>
											<div class="h-5 w-16 bg-neutral-100"></div>
										</div>
									</div>

									<div class="border border-neutral-950 bg-white overflow-x-auto scrollbar-thin">
										<table class="w-full table-fixed border-collapse">
											<colgroup>
												<col class="w-[24%]" />
												<col class="w-[12%]" />
												<col class="w-[22%]" />
												<col class="w-[20%]" />
												<col class="w-[22%]" />
											</colgroup>
											<thead>
												<tr class="border-b border-neutral-950 bg-neutral">
													<th scope="col" class="px-2 py-1 text-left">
														<div class="h-3 w-20 bg-neutral-100"></div>
													</th>
													<th scope="col" class="px-2 py-1 text-left">
														<div class="h-3 w-12 bg-neutral-100"></div>
													</th>
													<th scope="col" class="px-2 py-1 text-left">
														<div class="h-3 w-24 bg-neutral-100"></div>
													</th>
													<th scope="col" class="px-2 py-1 text-left">
														<div class="h-3 w-24 bg-neutral-100"></div>
													</th>
													<th scope="col" class="px-2 py-1 text-left">
														<div class="h-3 w-20 bg-neutral-100"></div>
													</th>
												</tr>
											</thead>
											<tbody>
												{#each [0, 1, 2, 3] as _, leagueIndex}
													<tr
														class={`align-middle ${leagueIndex < 3 ? 'border-b border-neutral-950' : ''} ${leagueIndex % 2 === 0 ? 'bg-neutral-25' : 'bg-neutral-05'}`}
													>
														<th scope="row" class="px-2 py-1 text-left">
															<div class="flex items-center gap-2">
																<div
																	class="w-9 h-9 border border-neutral-950 bg-neutral-100 flex items-center justify-center shrink-0"
																	aria-hidden="true"
																>
																	<div class="w-4 h-4 bg-neutral-300"></div>
																</div>
																<div class="h-4 w-32 bg-neutral-100"></div>
															</div>
														</th>
														<td class="px-2 py-1">
															<div class="h-5 w-16 bg-neutral-100"></div>
														</td>
														<td class="px-2 py-1">
															<div class="space-y-1">
																<div class="h-3 w-28 bg-neutral-100"></div>
																<div class="h-3 w-24 bg-neutral-100"></div>
															</div>
														</td>
														<td class="px-2 py-1">
															<div class="h-3 w-24 bg-neutral-100"></div>
														</td>
														<td class="px-2 py-1">
															<div class="h-3 w-32 bg-neutral-100"></div>
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								</article>
							{/each}
						</div>
					{:else}
						{#snippet offeringArticle(offering: OfferingGroup, concluded: boolean)}
							<article
								id={getOfferingArticleId(offering.offeringSlug)}
								class={`p-4 space-y-3 ${offeringArticleHighlightClass(offering.offeringSlug)}`}
							>
								<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
									<div>
										<div class="flex items-center gap-2">
											{#if selectedSeason?.slug && offering.offeringSlug}
												<a
													href={`/dashboard/offerings/${selectedSeason.slug}/${offering.offeringSlug}`}
													class="text-2xl font-bold font-serif text-neutral-950 hover:underline"
												>
													{offering.offeringName}
												</a>
											{:else}
												<h3 class="text-2xl font-bold font-serif text-neutral-950">
													{offering.offeringName}
												</h3>
											{/if}
											{#if showAllOfferings}
												<span
													class="badge-neutral-outlined text-[10px] uppercase tracking-wide px-1.5 py-0 self-center"
												>
													{offering.offeringType === 'tournament' ? 'Tournament' : 'League'}
												</span>
											{/if}
										</div>
									</div>
									<div class="flex flex-wrap items-center gap-1">
										{#if concluded}
											<span class="badge-secondary text-xs uppercase tracking-wide">
												Concluded
											</span>
										{:else}
											<span class="badge-primary text-xs uppercase tracking-wide"
												>{offering.openCount} Open</span
											>
											<span class="badge-primary-outlined text-xs uppercase tracking-wide">
												{offering.waitlistedCount} Waitlist
											</span>
											<span class="badge-secondary-outlined text-xs uppercase tracking-wide">
												{offering.closedCount} Closed
											</span>
										{/if}
										{#if canEditOfferingSettings && offering.offeringId}
											<ListboxDropdown
												options={offeringActionOptions(offering)}
												value=""
												mode="action"
												align="right"
												ariaLabel={`${offering.offeringName} actions`}
												buttonClass="inline-flex h-7 w-7 items-center justify-center p-0 cursor-pointer text-neutral-950 hover:text-secondary-900"
												listClass="w-44"
												on:action={(event) => {
													handleOfferingAction(event.detail.value, offering);
												}}
											>
												{#snippet trigger()}<IconDots class="h-4 w-4" />{/snippet}
											</ListboxDropdown>
										{/if}
									</div>
								</div>

								<div class="offering-table-highlight-surface">
									<DataTable
										columns={offeringTableColumnsFor(offering)}
										rows={offering.leagues}
										caption={`${offering.offeringName} ${entryLabelFor(offering)} table`}
										rowId={(league) => getLeagueRowId(offering.offeringSlug, league.id)}
										rowClass={(league) =>
											[
												leagueRowHighlightClass(offering.offeringSlug, league.id),
												canEditLeagueRows ? 'group/row' : ''
											]
												.filter(Boolean)
												.join(' ')}
									>
										{#snippet emptyBody()}
											<tr class="bg-neutral-25">
												<td
													colspan={offeringTableColumnsFor(offering).length}
													class="px-4 py-10 text-center text-sm italic text-neutral-700"
												>
													{#if canManageOfferings}
														No {entryLabelFor(offering) === 'group' ? 'groups' : 'leagues'} exist for
														this offering yet. You need to add
														{entryLabelFor(offering) === 'group' ? 'groups' : 'leagues'} before people
														can join them.
														{#if offering.offeringId}
															<button
																type="button"
																class="ml-1 inline font-semibold not-italic text-secondary-900 underline underline-offset-2 cursor-pointer"
																onclick={() => {
																	void openCreateLeagueWizardForOffering(offering.offeringId ?? '');
																}}
															>
																Add {entryLabelFor(offering) === 'group' ? 'groups' : 'leagues'}
															</button>
														{/if}
													{:else}
														{entryLabelFor(offering) === 'group' ? 'Groups are' : 'Leagues are'} coming
														soon for this offering.
													{/if}
												</td>
											</tr>
										{/snippet}

										{#snippet cell(league, column)}
											{#if column.key === 'league'}
												{@const OfferingIcon = offeringIconFor(offering.offeringName)}
												<DataTableLinkedLabel
													label={league.categoryLabel}
													href={selectedSeason?.slug && offering.offeringSlug && league.leagueSlug
														? `/dashboard/offerings/${selectedSeason.slug}/${offering.offeringSlug}/${league.leagueSlug}`
														: null}
													icon={OfferingIcon}
												/>
											{:else if column.key === 'status'}
												<HoverTooltip
													text={statusTooltipText(league.status, league.statusLabel)}
													wrapperClass="inline-block"
												>
													<span
														class={`${statusClass(league.status, league.statusLabel)} text-xs uppercase tracking-wide`}
													>
														{league.statusLabel}
													</span>
												</HoverTooltip>
											{:else if column.key === 'registration'}
												<p class="text-xs leading-snug text-neutral-950 font-sans">
													<DateHoverText
														display={league.teamRegistrationOpenText}
														value={league.teamRegistrationOpenDate}
														includeTime
														wrapperClass="inline"
													/>
												</p>
												<p class="mt-1 text-xs leading-snug text-neutral-950 font-sans">
													<DateHoverText
														display={league.teamRegistrationCloseText}
														value={league.teamRegistrationCloseDate}
														includeTime
														wrapperClass="inline"
													/>
												</p>
											{:else if column.key === 'join-team'}
												<p class="text-xs leading-snug text-neutral-950 font-sans">
													<DateHoverText
														display={league.joinTeamText}
														value={league.joinTeamDate}
														includeTime
														wrapperClass="inline"
													/>
												</p>
											{:else if column.key === 'range'}
												<p class="text-xs leading-snug text-neutral-950 font-sans">
													<DateHoverText
														display={formatSeasonBoundaryText(
															league.seasonStartDate,
															'Starts',
															'Started'
														)}
														value={league.seasonStartDate}
														wrapperClass="inline"
													/>
												</p>
												<p class="mt-1 text-xs leading-snug text-neutral-950 font-sans">
													<DateHoverText
														display={formatSeasonBoundaryText(
															league.seasonEndDate,
															'Ends',
															'Ended'
														)}
														value={league.seasonEndDate}
														wrapperClass="inline"
													/>
												</p>
											{:else if column.key === 'manage'}
												{#if canEditLeagueRows}
													<DataTableRowActions
														options={leagueRowActionOptions(offering)}
														ariaLabel={`Actions for ${league.categoryLabel}`}
														on:action={(event) => {
															handleLeagueRowAction(event.detail.value, offering, league);
														}}
													/>
												{/if}
											{/if}
										{/snippet}
									</DataTable>
								</div>
							</article>
						{/snippet}

						<div class="divide-y divide-neutral-950">
							{#each renderedOfferings as offering}
								{@render offeringArticle(offering, selectedSeasonIsHistorical)}
							{/each}
						</div>

						{#if !selectedSeasonIsHistorical && concludedOfferings.length > 0}
							<section class="border-t border-neutral-950">
								<div class="divide-y divide-neutral-950">
									{#each concludedOfferings as offering}
										{@render offeringArticle(offering, true)}
									{/each}
								</div>
							</section>
						{/if}
					{/if}
				</section>

				<aside class="w-full min-w-0 space-y-6">
					<section class="border-2 border-neutral-950 bg-neutral">
						<div
							class="p-4 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between"
						>
							<h2 class="dashboard-section-title text-neutral-950">Season Timeline</h2>
							<IconCalendar class="w-5 h-5 text-secondary-700" />
						</div>
						{#if offeringTimelineDisplayGroups.length === 0}
							<div class="p-4">
								<p class="text-sm text-neutral-950 font-sans">No timeline events available.</p>
							</div>
						{:else}
							<div
								bind:this={timelineContainerElement}
								class="h-[32rem] overflow-y-auto p-4 scrollbar-thin"
							>
								<div class="relative">
									<div
										class="pointer-events-none absolute bottom-0 left-[calc(0.5rem+1px)] top-[0.125rem] z-0 w-px bg-neutral-950"
									></div>
									<div class="space-y-4">
										{#each offeringTimelineDisplayGroups as group, groupIndex}
											<div
												id={group.id}
												class="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-3"
											>
												<div class="relative min-h-4 pt-[0.125rem]">
													<div
														class={`absolute left-[calc(50%+2px)] top-[0.125rem] z-10 h-3 w-3 -translate-x-1/2 border border-primary-900 ${group.isPast ? 'bg-primary-100' : 'bg-primary-500'}`}
													></div>
												</div>
												<div class={`space-y-1.5 ${group.isPast ? 'opacity-50' : ''}`}>
													<p
														class="text-xs font-bold uppercase tracking-[0.16em] text-neutral-950 font-sans"
													>
														<DateHoverText
															display={formatDeadlineDate(group.date)}
															value={group.date}
															includeTime
															wrapperClass="inline"
														/>
														<span
															class="ml-1 normal-case font-medium tracking-normal text-neutral-700"
														>
															{formatTimelineRelativeDayLabel(group.date)}
														</span>
													</p>
													<div
														class="border border-neutral-950 bg-white divide-y divide-neutral-950"
													>
														{#each group.offeringBuckets as offeringBucket}
															<div class="px-2.5 py-2">
																<button
																	type="button"
																	class="text-[11px] font-bold uppercase tracking-[0.14em] text-secondary-700 hover:underline focus-visible:underline focus-visible:outline-none cursor-pointer"
																	onclick={() => {
																		void scrollToOfferingArticle(offeringBucket.offeringSlug);
																	}}
																>
																	{offeringBucket.offeringName}
																</button>
																<div class="mt-1 space-y-0.5">
																	{#each offeringBucket.events as event}
																		{@const OfferingIcon = offeringIconFor(event.offeringName)}
																		<button
																			type="button"
																			class="group flex w-full items-start justify-between gap-3 px-0.5 py-1 text-left transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
																			onclick={() => {
																				void scrollToLeagueRow(event.offeringSlug, event.leagueId);
																			}}
																		>
																			<span class="min-w-0 flex items-start gap-1.5">
																				<span
																					class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center bg-primary text-white"
																					aria-hidden="true"
																				>
																					<OfferingIcon class="h-2.5 w-2.5" />
																				</span>
																				<span
																					class="text-sm font-bold text-neutral-950 font-sans group-hover:underline group-focus-visible:underline"
																				>
																					{event.categoryLabel}
																				</span>
																			</span>
																			<span
																				class="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-700 font-sans"
																			>
																				{getTimelineEventCompactLabel(event.type, event.isPast)}
																			</span>
																		</button>
																	{/each}
																</div>
															</div>
														{/each}
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</section>

					<section class="border-2 border-neutral-950 bg-neutral">
						<div class="p-4 border-b border-neutral-950 bg-neutral-600/66">
							<h2 class="dashboard-section-title text-neutral-950">Advertising Spot</h2>
						</div>
						<div class="p-3">
							<div class="border-2 border-dashed border-secondary-400 bg-white px-4 py-5 space-y-4">
								<div class="space-y-1">
									<p class="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-700">
										Reserved Placement
									</p>
									<h3 class="text-lg font-bold font-serif text-neutral-950">
										Future Sponsor or Promo Module
									</h3>
									<p class="text-sm font-sans text-neutral-950">
										This area is reserved for paid placements, featured campaigns, or house ads.
									</p>
								</div>

								<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
									<div class="border border-neutral-950 bg-neutral-25 px-3 py-2">
										<p class="text-[10px] font-bold uppercase tracking-wide text-secondary-700">
											Format
										</p>
										<p class="mt-1 text-sm font-sans text-neutral-950">
											Sidebar card / creative unit
										</p>
									</div>
									<div class="border border-neutral-950 bg-neutral-25 px-3 py-2">
										<p class="text-[10px] font-bold uppercase tracking-wide text-secondary-700">
											Status
										</p>
										<p class="mt-1 text-sm font-sans text-neutral-950">Placeholder only</p>
									</div>
								</div>

								<div class="border-t border-neutral-950 pt-3">
									<p class="text-xs font-sans uppercase tracking-wide text-secondary-800">
										TODO: wire campaign content, artwork, CTA, and tracking.
									</p>
								</div>
							</div>
						</div>
					</section>
				</aside>
			</div>
		{/if}
	</div>
</div>

<CreateSeasonWizard
	open={isCreateSeasonModalOpen}
	step={createSeasonDisplayStep}
	stepCount={createSeasonWizardStepCount}
	stepTitle={seasonWizardStepTitle(createSeasonStep)}
	stepProgress={createSeasonStepProgress}
	formError={createSeasonFormError}
	unsavedConfirmOpen={createSeasonWizardUnsavedConfirmOpen}
	onRequestClose={requestCloseCreateSeasonWizard}
	onSubmit={() => {
		void submitCreateSeasonWizard();
	}}
	onInput={clearCreateSeasonApiErrors}
	onUnsavedConfirm={confirmDiscardCreateSeasonWizard}
	onUnsavedCancel={cancelDiscardCreateSeasonWizard}
>
	{#if createSeasonStep === 1}
		<div class="space-y-4">
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div>
					<label for="season-name" class="block text-sm font-sans text-neutral-950 mb-1">
						Name <span class="text-error-700">*</span>
					</label>
					<input
						id="season-name"
						type="text"
						data-wizard-autofocus
						class="input-secondary"
						value={createSeasonForm.name}
						placeholder={DEFAULT_ACADEMIC_SEASON_PLACEHOLDER}
						oninput={(event) => {
							const value = (event.currentTarget as HTMLInputElement).value;
							createSeasonForm.name = value;
							if (!seasonSlugTouched) {
								createSeasonForm.slug = slugifyFinal(value);
							}
							applyCreateSeasonDateInferenceFromName(value);
						}}
						autocomplete="off"
					/>
					{#if createSeasonFieldErrors['season.name']}
						<p class="text-xs text-error-700 mt-1">{createSeasonFieldErrors['season.name']}</p>
					{/if}
				</div>
				<div>
					<div class="mb-1 flex h-5 items-center gap-1.5 leading-none">
						<label for="season-slug" class="text-sm leading-5 font-sans text-neutral-950">
							Slug <span class="text-error-700">*</span>
						</label>
						<InfoPopover
							buttonAriaLabel="Season slug help"
							buttonVariant="label-inline"
							align="left"
							panelWidthClass="w-80"
						>
							<div class="space-y-2">
								<p>A slug is the URL-friendly identifier used in links and lookups.</p>
								<p>Leave the default slug if you are unsure.</p>
							</div>
						</InfoPopover>
					</div>
					<div class="relative">
						<input
							id="season-slug"
							type="text"
							class="input-secondary pr-10"
							value={createSeasonForm.slug}
							placeholder={DEFAULT_ACADEMIC_SEASON_PLACEHOLDER}
							oninput={(event) => {
								seasonSlugTouched = true;
								createSeasonForm.slug = applyLiveSlugInput(event.currentTarget as HTMLInputElement);
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
								aria-label="Revert season slug to default"
								onclick={() => {
									seasonSlugTouched = false;
									createSeasonForm.slug = slugifyFinal(createSeasonForm.name);
								}}
							>
								<IconRestore class="h-4 w-4" />
							</button>
						</HoverTooltip>
					</div>
					{#if createSeasonFieldErrors['season.slug']}
						<p class="text-xs text-error-700 mt-1">{createSeasonFieldErrors['season.slug']}</p>
					{/if}
				</div>
				<div>
					<label for="season-start-date" class="block text-sm font-sans text-neutral-950 mb-1">
						Start Date <span class="text-error-700">*</span>
					</label>
					<div class="relative">
						<input
							id="season-start-date"
							type="date"
							class="input-secondary pr-9 no-native-date-picker"
							bind:this={createSeasonStartDateInput}
							value={createSeasonForm.startDate}
							oninput={(event) => {
								const nextStartDate = (event.currentTarget as HTMLInputElement).value;
								createSeasonStartDateTouched = true;
								createSeasonForm.startDate = nextStartDate;
								syncCreateSeasonEndDateFromStart(nextStartDate);
							}}
							onchange={(event) => {
								const nextStartDate = (event.currentTarget as HTMLInputElement).value;
								createSeasonStartDateTouched = true;
								createSeasonForm.startDate = nextStartDate;
								syncCreateSeasonEndDateFromStart(nextStartDate);
							}}
						/>
						<button
							type="button"
							tabindex="-1"
							class="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-900 hover:text-secondary-700 cursor-pointer"
							aria-label="Open start date picker"
							onclick={() => {
								openDatePicker(createSeasonStartDateInput);
							}}
						>
							<IconCalendar class="w-4 h-4" />
						</button>
					</div>
					{#if createSeasonFieldErrors['season.startDate']}
						<p class="text-xs text-error-700 mt-1">{createSeasonFieldErrors['season.startDate']}</p>
					{/if}
				</div>
				<div>
					<label for="season-end-date" class="block text-sm font-sans text-neutral-950 mb-1">
						End Date
					</label>
					<div class="relative">
						<input
							id="season-end-date"
							type="date"
							class="input-secondary pr-9 no-native-date-picker"
							bind:this={createSeasonEndDateInput}
							value={createSeasonForm.endDate}
							oninput={(event) => {
								createSeasonEndDateTouched = true;
								createSeasonForm.endDate = (event.currentTarget as HTMLInputElement).value;
							}}
							onchange={(event) => {
								createSeasonEndDateTouched = true;
								createSeasonForm.endDate = (event.currentTarget as HTMLInputElement).value;
							}}
						/>
						<button
							type="button"
							tabindex="-1"
							class="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-900 hover:text-secondary-700 cursor-pointer"
							aria-label="Open end date picker"
							onclick={() => {
								openDatePicker(createSeasonEndDateInput);
							}}
						>
							<IconCalendar class="w-4 h-4" />
						</button>
					</div>
					{#if createSeasonFieldErrors['season.endDate']}
						<p class="text-xs text-error-700 mt-1">{createSeasonFieldErrors['season.endDate']}</p>
					{/if}
				</div>
			</div>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div class="border border-neutral-950 bg-white p-3">
					<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
						<input
							type="checkbox"
							class="toggle-secondary"
							bind:checked={createSeasonForm.isCurrent}
							onkeydown={focusCreateSeasonEndDateOnReverseTab}
							onchange={() => {
								if (!createSeasonForm.isCurrent) {
									createSeasonReplaceExistingCurrent = true;
									createSeasonDeactivateExistingCurrent = false;
								}
							}}
						/>
						Set as current season
					</label>
				</div>
				<div class="border border-neutral-950 bg-white p-3">
					<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
						<input
							type="checkbox"
							class="toggle-secondary"
							bind:checked={createSeasonForm.isActive}
						/>
						Active
					</label>
				</div>
			</div>
		</div>
	{/if}

	{#if createSeasonStep === 2 && createSeasonCopyStepAvailable}
		<div class="space-y-4">
			<div class="border-2 border-neutral-950 bg-white p-4 space-y-4">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-[11px] uppercase tracking-wide font-bold text-secondary-900">Optional</p>
						<h3 class="text-lg font-bold font-serif text-neutral-950">Copy Content</h3>
					</div>
					<InfoPopover buttonAriaLabel="Copy content help">
						<p>
							Copy pulls offerings and optionally leagues, tournaments, and divisions/groups from
							one season into this new season.
						</p>
					</InfoPopover>
				</div>

				<fieldset class="space-y-2">
					<legend class="text-sm font-semibold text-neutral-950">Season setup mode</legend>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
						<label
							class={`flex items-start gap-2 border p-3 cursor-pointer text-sm text-neutral-950 min-w-0 ${
								!createSeasonCopy.enabled
									? 'border-secondary-600 bg-secondary-50'
									: 'border-secondary-300 bg-white'
							}`}
						>
							<input
								type="radio"
								class="radio-secondary mt-0.5"
								name="season-copy-enabled"
								checked={!createSeasonCopy.enabled}
								onchange={() => {
									createSeasonCopy.enabled = false;
									createSeasonCopy.includeDivisions = false;
								}}
								data-wizard-autofocus
							/>
							<span class="min-w-0">
								<span class="block font-semibold">Blank season</span>
								<span class="block text-xs text-neutral-900">Create with no copied content.</span>
							</span>
						</label>
						<label
							class={`flex items-start gap-2 border p-3 text-sm text-neutral-950 min-w-0 ${
								createSeasonCopy.enabled
									? 'border-secondary-600 bg-secondary-50'
									: 'border-secondary-300 bg-white'
							} ${seasonHistory.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
						>
							<input
								type="radio"
								class="radio-secondary mt-0.5"
								name="season-copy-enabled"
								checked={createSeasonCopy.enabled}
								disabled={seasonHistory.length === 0}
								onchange={() => {
									if (seasonHistory.length === 0) return;
									createSeasonCopy.enabled = true;
								}}
							/>
							<span class="min-w-0">
								<span class="block font-semibold">Copy existing setup</span>
								<span class="block text-xs text-neutral-900">Choose what to carry over.</span>
							</span>
						</label>
					</div>
				</fieldset>

				{#if seasonHistory.length === 0}
					<p class="text-xs text-neutral-900">No existing seasons are available to copy yet.</p>
				{/if}

				{#if createSeasonCopy.enabled}
					<div class="border border-neutral-950 bg-neutral p-3 space-y-3">
						<div>
							<p class="block text-sm font-sans text-neutral-950 mb-1">
								Source Season <span class="text-error-700">*</span>
							</p>
							<ListboxDropdown
								options={seasonCopySourceDropdownOptions}
								value={createSeasonCopy.sourceSeasonId}
								ariaLabel="Source season"
								buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
								on:change={(event) => {
									createSeasonCopy.sourceSeasonId = event.detail.value;
									clearCreateSeasonApiErrors();
								}}
							/>
							{#if createSeasonFieldErrors['copyOptions.sourceSeasonId']}
								<p class="text-xs text-error-700 mt-1">
									{createSeasonFieldErrors['copyOptions.sourceSeasonId']}
								</p>
							{/if}
						</div>

						<fieldset class="space-y-2">
							<legend class="text-sm font-semibold text-neutral-950">Copy scope</legend>
							<div
								class="grid grid-cols-1 sm:grid-cols-3 gap-2"
								role="radiogroup"
								aria-label="Copy scope"
							>
								<button
									type="button"
									role="radio"
									aria-checked={createSeasonCopy.scope === 'offerings-only'}
									class="border border-secondary-600 bg-secondary-50 text-neutral-950 px-3 py-2 text-sm font-semibold text-left cursor-pointer flex items-center justify-start"
									onclick={() => {
										createSeasonCopy.scope = 'offerings-only';
										createSeasonCopy.includeDivisions = false;
									}}
								>
									<span class="flex items-center gap-2 w-full">
										<span
											class="h-5 w-5 border-2 border-secondary-600 bg-white rounded-full flex items-center justify-center shrink-0"
										>
											{#if createSeasonCopy.scope === 'offerings-only'}
												<span class="h-2.5 w-2.5 rounded-full bg-secondary-700"></span>
											{/if}
										</span>
										<span>{createSeasonCopyOfferingsButtonLabel}</span>
									</span>
								</button>
								<button
									type="button"
									role="radio"
									aria-checked={createSeasonCopy.scope === 'offerings-leagues'}
									class={`border px-3 py-2 text-sm font-semibold text-left cursor-pointer flex items-center justify-start ${
										createSeasonCopy.scope === 'offerings-leagues' ||
										createSeasonCopy.scope === 'offerings-all'
											? 'border-secondary-600 bg-secondary-50 text-neutral-950'
											: 'border-secondary-300 bg-white text-neutral-950 hover:bg-neutral-100'
									}`}
									onclick={() => {
										createSeasonCopy.scope = 'offerings-leagues';
									}}
								>
									<span class="flex items-center gap-2 w-full">
										<span
											class="h-5 w-5 border-2 border-secondary-600 bg-white rounded-full flex items-center justify-center shrink-0"
										>
											{#if createSeasonCopy.scope === 'offerings-leagues'}
												<span class="h-2.5 w-2.5 rounded-full bg-secondary-700"></span>
											{/if}
										</span>
										<span>+ leagues</span>
									</span>
								</button>
								<button
									type="button"
									role="radio"
									aria-checked={createSeasonCopy.scope === 'offerings-all'}
									class={`border px-3 py-2 text-sm font-semibold text-left cursor-pointer flex items-center justify-start ${
										createSeasonCopy.scope === 'offerings-all'
											? 'border-secondary-600 bg-secondary-50 text-neutral-950'
											: 'border-secondary-300 bg-white text-neutral-950 hover:bg-neutral-100'
									}`}
									onclick={() => {
										createSeasonCopy.scope = 'offerings-all';
									}}
								>
									<span class="flex items-center gap-2 w-full">
										<span
											class="h-5 w-5 border-2 border-secondary-600 bg-white rounded-full flex items-center justify-center shrink-0"
										>
											{#if createSeasonCopy.scope === 'offerings-all'}
												<span class="h-2.5 w-2.5 rounded-full bg-secondary-700"></span>
											{/if}
										</span>
										<span>+ tournaments</span>
									</span>
								</button>
							</div>
						</fieldset>

						<div class="border border-neutral-950 bg-white p-2.5">
							<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
								<input
									type="checkbox"
									class="toggle-secondary"
									bind:checked={createSeasonCopy.includeDivisions}
									disabled={createSeasonCopy.scope === 'offerings-only'}
								/>
								{createSeasonCopyDivisionsToggleLabel}
							</label>
							{#if createSeasonFieldErrors['copyOptions.includeDivisions']}
								<p class="text-xs text-error-700 mt-1">
									{createSeasonFieldErrors['copyOptions.includeDivisions']}
								</p>
							{/if}
						</div>

						<div class="border border-neutral-950 bg-white p-3 space-y-2">
							<p class="text-[11px] uppercase tracking-wide font-bold text-secondary-900">
								Copy Preview
							</p>
							{#if createSeasonCopySourceSeason}
								<p class="text-sm font-semibold text-neutral-950 break-words">
									{createSeasonCopySourceSeason.name}
								</p>
							{/if}
							<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-neutral-950">
								<div class="border border-neutral-950 bg-neutral p-2">
									<p class="text-[11px] uppercase tracking-wide font-bold">Offerings</p>
									<p class="text-lg font-bold font-serif">
										{createSeasonCopyPreview.offeringCount}
									</p>
								</div>
								<div class="border border-neutral-950 bg-neutral p-2">
									<p class="text-[11px] uppercase tracking-wide font-bold">
										{createSeasonCopyIncludesTournaments ? 'Leagues/Groups' : 'Leagues'}
									</p>
									<p class="text-lg font-bold font-serif">
										{createSeasonCopyPreview.leagueCount +
											createSeasonCopyPreview.tournamentGroupCount}
									</p>
								</div>
								<div class="border border-neutral-950 bg-neutral p-2">
									<p class="text-[11px] uppercase tracking-wide font-bold">
										{createSeasonCopyIncludesTournaments ? 'Divisions/Groups' : 'Divisions'}
									</p>
									<p class="text-lg font-bold font-serif">
										{createSeasonCopy.includeDivisions ? createSeasonCopyPreview.divisionCount : 0}
									</p>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if createSeasonStep === 3}
		<div class="space-y-4">
			{#if createSeasonCurrentTransitionRequired && existingCurrentSeason}
				<div class="border-2 border-neutral-950 bg-white p-4 space-y-4">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-[11px] uppercase tracking-wide font-bold text-secondary-900">
								Action Required
							</p>
							<h3 class="text-lg font-bold font-serif text-neutral-950">
								Current Season Transition
							</h3>
						</div>
						<InfoPopover buttonAriaLabel="Why this step is required">
							<p>
								Only one season can be current. To make this new season current, mark "{existingCurrentSeason.name}"
								as not current here.
							</p>
						</InfoPopover>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div
							class={`bg-neutral p-3 space-y-1 ${
								!createSeasonReplaceExistingCurrent
									? 'border-2 border-primary-500'
									: 'border border-neutral-950'
							}`}
						>
							<p class="text-[11px] uppercase tracking-wide font-bold text-secondary-900">
								Current Season
							</p>
							<p class="text-sm font-semibold text-neutral-950">{existingCurrentSeason.name}</p>
							<p class="text-xs text-neutral-900">
								<DateHoverText
									display={formatReviewRange(
										existingCurrentSeason.startDate,
										existingCurrentSeason.endDate
									)}
									value={existingCurrentSeason.startDate}
									endValue={existingCurrentSeason.endDate}
								/>
							</p>
						</div>
						<div
							class={`bg-white p-3 space-y-1 ${
								createSeasonReplaceExistingCurrent
									? 'border-2 border-primary-500'
									: 'border border-neutral-950'
							}`}
						>
							<p class="text-[11px] uppercase tracking-wide font-bold text-secondary-900">
								New Season
							</p>
							<p class="text-sm font-semibold text-neutral-950">
								{createSeasonForm.name || 'New Season'}
							</p>
							<p class="text-xs text-neutral-900">
								<DateHoverText
									display={formatReviewRange(
										createSeasonForm.startDate,
										createSeasonForm.endDate || null
									)}
									value={createSeasonForm.startDate}
									endValue={createSeasonForm.endDate || null}
								/>
							</p>
						</div>
					</div>

					<fieldset class="space-y-2">
						<legend class="text-sm font-semibold text-neutral-950">Choose current season</legend>
						<label
							class={`flex items-start gap-2 border p-3 cursor-pointer text-sm text-neutral-950 ${
								createSeasonReplaceExistingCurrent
									? 'border-secondary-600 bg-secondary-50'
									: 'border-secondary-300 bg-white'
							}`}
						>
							<input
								type="radio"
								class="radio-secondary mt-0.5"
								name="season-current-transition"
								checked={createSeasonReplaceExistingCurrent}
								onchange={() => {
									createSeasonReplaceExistingCurrent = true;
								}}
								data-wizard-autofocus
							/>
							<span
								>Set "{existingCurrentSeason.name}" to not current, and make this new season
								current.</span
							>
						</label>
						<label
							class={`flex items-start gap-2 border p-3 cursor-pointer text-sm text-neutral-950 ${
								!createSeasonReplaceExistingCurrent
									? 'border-secondary-600 bg-secondary-50'
									: 'border-secondary-300 bg-white'
							}`}
						>
							<input
								type="radio"
								class="radio-secondary mt-0.5"
								name="season-current-transition"
								checked={!createSeasonReplaceExistingCurrent}
								onchange={() => {
									createSeasonReplaceExistingCurrent = false;
									createSeasonDeactivateExistingCurrent = false;
								}}
							/>
							<span
								>Keep "{existingCurrentSeason.name}" as current (new season stays non-current).</span
							>
						</label>
					</fieldset>
					{#if createSeasonFieldErrors['season.transition']}
						<p class="text-xs text-error-700">{createSeasonFieldErrors['season.transition']}</p>
					{/if}

					{#if createSeasonReplaceExistingCurrent}
						{#if existingCurrentSeason.isActive}
							<div class="border border-neutral-950 bg-neutral p-3">
								<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
									<input
										type="checkbox"
										class="toggle-secondary"
										bind:checked={createSeasonDeactivateExistingCurrent}
									/>
									Also mark "{existingCurrentSeason.name}" as inactive
								</label>
							</div>
						{:else}
							<p class="text-xs text-neutral-900">
								"{existingCurrentSeason.name}" is already inactive.
							</p>
						{/if}
					{/if}
				</div>
			{:else}
				<div class="border-2 border-neutral-950 bg-white p-4">
					<p class="text-sm leading-5 text-neutral-950">
						No current-season transition is needed for this season.
					</p>
				</div>
			{/if}
		</div>
	{/if}

	{#if createSeasonStep === 4}
		<div class="space-y-4">
			<div class="border-2 border-neutral-950 bg-white p-4 space-y-2">
				<h3 class="text-lg font-bold font-serif text-neutral-950">Season</h3>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Name:</span>
					{createSeasonForm.name || 'TBD'}
					<span class="ml-3 font-semibold">Slug:</span>
					{slugifyFinal(createSeasonForm.slug) || 'TBD'}
				</p>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Date Range:</span>
					<DateHoverText
						display={formatReviewRange(
							createSeasonForm.startDate,
							createSeasonForm.endDate || null
						)}
						value={createSeasonForm.startDate}
						endValue={createSeasonForm.endDate || null}
						textClass="ml-1"
					/>
				</p>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Status:</span>
					{createSeasonForm.isActive ? 'Active' : 'Inactive'}
					<span class="ml-3 font-semibold">Current:</span>
					{createSeasonWillBeCurrent ? 'Yes' : 'No'}
				</p>
			</div>

			{#if createSeasonCopy.enabled && createSeasonCopySourceSeason}
				<div class="border-2 border-neutral-950 bg-white p-4 space-y-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Copy Plan</h3>
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Source:</span>
						{createSeasonCopySourceSeason.name}
					</p>
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Scope:</span>
						{seasonCopyScopeLabel(createSeasonCopy.scope)}
					</p>
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Include divisions/groups:</span>
						{createSeasonCopy.scope === 'offerings-only'
							? 'No'
							: createSeasonCopy.includeDivisions
								? 'Yes'
								: 'No'}
					</p>
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Estimated copy:</span>
						{createSeasonCopyPreview.offeringCount}
						{pluralize(createSeasonCopyPreview.offeringCount, 'offering', 'offerings')},
						{createSeasonCopyPreview.leagueCount + createSeasonCopyPreview.tournamentGroupCount}
						{pluralize(
							createSeasonCopyPreview.leagueCount + createSeasonCopyPreview.tournamentGroupCount,
							'league/group',
							'leagues/groups'
						)}
						{createSeasonCopy.scope === 'offerings-only' || !createSeasonCopy.includeDivisions
							? ''
							: `, ${createSeasonCopyPreview.divisionCount} ${pluralize(createSeasonCopyPreview.divisionCount, 'division/group', 'divisions/groups')}`}
					</p>
				</div>
			{/if}

			{#if createSeasonCurrentTransitionRequired && existingCurrentSeason}
				<div class="border-2 border-neutral-950 bg-white p-4 space-y-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Current Season Transition</h3>
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">{existingCurrentSeason.name}</span>
						{createSeasonReplaceExistingCurrent
							? ' will no longer be current.'
							: ' will remain current.'}
					</p>
					{#if createSeasonReplaceExistingCurrent}
						<p class="text-sm leading-5 text-neutral-950">
							<span class="font-semibold">Set inactive:</span>
							{createSeasonWillDeactivateExistingCurrent ? 'Yes' : 'No'}
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		<WizardStepFooter
			step={createSeasonStep}
			lastStep={4}
			showBack={createSeasonStep > 1}
			canGoNext={canGoNextCreateSeasonStep}
			canSubmit={canSubmitCreateSeason}
			nextLabel={nextCreateSeasonLabel}
			submitLabel="Create Season"
			submittingLabel="Creating..."
			isSubmitting={createSeasonSubmitting}
			on:back={previousCreateSeasonStep}
			on:next={nextCreateSeasonStep}
		/>
	{/snippet}
</CreateSeasonWizard>

<ManageSeasonWizard
	open={isManageSeasonModalOpen}
	seasons={seasonHistory}
	{selectedSeasonId}
	on:close={closeManageSeasonWizard}
	on:saved={(event) => {
		void handleManageSeasonSaved(event);
	}}
	on:duplicate={handleManageSeasonDuplicate}
/>

<EditOfferingWizard
	open={isEditOfferingModalOpen}
	title={editOfferingForm.name.trim()
		? `Edit ${editOfferingForm.name.trim()} Offering`
		: 'Edit Offering'}
	formError={editOfferingFormError}
	unsavedConfirmOpen={editOfferingWizardUnsavedConfirmOpen}
	onRequestClose={requestCloseEditOfferingWizard}
	onSubmit={() => {
		void submitEditOfferingWizard();
	}}
	onInput={clearEditOfferingApiErrors}
	onUnsavedConfirm={confirmDiscardEditOfferingWizard}
	onUnsavedCancel={cancelDiscardEditOfferingWizard}
>
	<div class="space-y-4">
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div>
				<label for="edit-offering-name" class="mb-1 block text-sm font-sans text-neutral-950">
					Name <span class="text-error-700">*</span>
				</label>
				<input
					id="edit-offering-name"
					type="text"
					class="input-secondary"
					value={editOfferingForm.name}
					placeholder="Basketball"
					data-wizard-autofocus
					oninput={(event) => {
						const value = (event.currentTarget as HTMLInputElement).value;
						editOfferingForm.name = value;
						if (!offeringSlugTouched) {
							editOfferingForm.slug = slugifyFinal(value);
						}
						clearEditOfferingApiErrors();
					}}
					autocomplete="off"
				/>
				{#if editOfferingFieldErrors['offering.name']}
					<p class="mt-1 text-xs text-error-700">{editOfferingFieldErrors['offering.name']}</p>
				{/if}
			</div>

			<div>
				<div class="mb-1 flex h-5 items-center gap-1.5 leading-none">
					<label for="edit-offering-slug" class="text-sm leading-5 font-sans text-neutral-950">
						Slug <span class="text-error-700">*</span>
					</label>
					<InfoPopover
						buttonAriaLabel="Offering slug help"
						buttonVariant="label-inline"
						align="left"
						panelWidthClass="w-80"
					>
						<div class="space-y-2">
							<p>A slug is the URL-friendly identifier used in links and lookups.</p>
							<p>Leave the default slug if you are unsure.</p>
						</div>
					</InfoPopover>
				</div>
				<div class="relative">
					<input
						id="edit-offering-slug"
						type="text"
						class="input-secondary pr-10"
						value={editOfferingForm.slug}
						placeholder="basketball"
						oninput={(event) => {
							offeringSlugTouched = true;
							editOfferingForm.slug = applyLiveSlugInput(event.currentTarget as HTMLInputElement);
							clearEditOfferingApiErrors();
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
							aria-label="Revert offering slug to default"
							onclick={() => {
								offeringSlugTouched = false;
								editOfferingForm.slug = slugifyFinal(editOfferingForm.name);
								clearEditOfferingApiErrors();
							}}
						>
							<IconRestore class="h-4 w-4" />
						</button>
					</HoverTooltip>
				</div>
				{#if editOfferingFieldErrors['offering.slug']}
					<p class="mt-1 text-xs text-error-700">{editOfferingFieldErrors['offering.slug']}</p>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div>
				<label for="edit-offering-sport" class="mb-1 block text-sm font-sans text-neutral-950">
					Sport
				</label>
				<input
					id="edit-offering-sport"
					type="text"
					class="input-secondary"
					bind:value={editOfferingForm.sport}
					placeholder="Basketball (optional)"
					autocomplete="off"
					oninput={clearEditOfferingApiErrors}
				/>
				{#if editOfferingFieldErrors['offering.sport']}
					<p class="mt-1 text-xs text-error-700">{editOfferingFieldErrors['offering.sport']}</p>
				{/if}
			</div>

			<div>
				<label
					for="edit-offering-min-players"
					class="mb-1 block text-sm font-sans text-neutral-950"
				>
					Min Roster Players
				</label>
				<input
					id="edit-offering-min-players"
					type="number"
					class="input-secondary"
					min="1"
					step="1"
					value={editOfferingForm.minPlayers > 0 ? String(editOfferingForm.minPlayers) : ''}
					oninput={(event) => {
						const parsed = Number.parseInt((event.currentTarget as HTMLInputElement).value, 10);
						editOfferingForm.minPlayers = Number.isNaN(parsed) ? 0 : parsed;
						clearEditOfferingApiErrors();
					}}
				/>
				{#if editOfferingFieldErrors['offering.minPlayers']}
					<p class="mt-1 text-xs text-error-700">
						{editOfferingFieldErrors['offering.minPlayers']}
					</p>
				{/if}
			</div>

			<div>
				<label
					for="edit-offering-max-players"
					class="mb-1 block text-sm font-sans text-neutral-950"
				>
					Max Roster Players
				</label>
				<input
					id="edit-offering-max-players"
					type="number"
					class="input-secondary"
					min="1"
					step="1"
					value={editOfferingForm.maxPlayers > 0 ? String(editOfferingForm.maxPlayers) : ''}
					oninput={(event) => {
						const parsed = Number.parseInt((event.currentTarget as HTMLInputElement).value, 10);
						editOfferingForm.maxPlayers = Number.isNaN(parsed) ? 0 : parsed;
						clearEditOfferingApiErrors();
					}}
				/>
				{#if editOfferingFieldErrors['offering.maxPlayers']}
					<p class="mt-1 text-xs text-error-700">
						{editOfferingFieldErrors['offering.maxPlayers']}
					</p>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div>
				<label for="edit-offering-image-url" class="mb-1 block text-sm font-sans text-neutral-950">
					Image URL
				</label>
				<input
					id="edit-offering-image-url"
					type="url"
					class="input-secondary"
					bind:value={editOfferingForm.imageUrl}
					placeholder="https://example.com/offering-image.jpg"
					autocomplete="off"
					oninput={clearEditOfferingApiErrors}
				/>
				{#if editOfferingFieldErrors['offering.imageUrl']}
					<p class="mt-1 text-xs text-error-700">
						{editOfferingFieldErrors['offering.imageUrl']}
					</p>
				{/if}
			</div>

			<div>
				<label
					for="edit-offering-rulebook-url"
					class="mb-1 block text-sm font-sans text-neutral-950"
				>
					Rulebook URL
				</label>
				<input
					id="edit-offering-rulebook-url"
					type="url"
					class="input-secondary"
					bind:value={editOfferingForm.rulebookUrl}
					placeholder="https://example.com/rules"
					autocomplete="off"
					oninput={clearEditOfferingApiErrors}
				/>
				{#if editOfferingFieldErrors['offering.rulebookUrl']}
					<p class="mt-1 text-xs text-error-700">
						{editOfferingFieldErrors['offering.rulebookUrl']}
					</p>
				{/if}
			</div>
		</div>

		<div>
			<label for="edit-offering-description" class="mb-1 block text-sm font-sans text-neutral-950">
				Description
			</label>
			<textarea
				id="edit-offering-description"
				class="textarea-secondary min-h-28"
				bind:value={editOfferingForm.description}
				placeholder="Describe this offering."
				oninput={clearEditOfferingApiErrors}
			></textarea>
			{#if editOfferingFieldErrors['offering.description']}
				<p class="mt-1 text-xs text-error-700">
					{editOfferingFieldErrors['offering.description']}
				</p>
			{/if}
		</div>

		<div class="border border-neutral-950 bg-white p-3">
			<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
				<input
					type="checkbox"
					class="toggle-secondary"
					bind:checked={editOfferingForm.isActive}
					onchange={clearEditOfferingApiErrors}
				/>
				Active
			</label>
		</div>
	</div>

	{#snippet footer()}
		<div class="flex justify-end border-t border-neutral-950 pt-2">
			<div class="flex items-center gap-2 justify-end">
				<button
					type="button"
					class="button-secondary-outlined cursor-pointer"
					onclick={requestCloseEditOfferingWizard}
				>
					Close
				</button>
				<button
					type="submit"
					class="button-secondary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={!canSubmitEditOffering}
				>
					{editOfferingSubmitting ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		</div>
	{/snippet}
</EditOfferingWizard>

<BulkEditLeaguesWizard
	open={isBulkEditLeaguesModalOpen}
	title={bulkEditingOfferingName
		? `Bulk Edit ${bulkEditingOfferingName} ${bulkEditingEntryLabelPlural}`
		: 'Bulk Edit Leagues'}
	step={bulkEditLeaguesStep}
	stepTitle={bulkLeagueStepTitle(bulkEditLeaguesStep)}
	stepProgress={bulkLeagueStepProgress(bulkEditLeaguesStep)}
	formError={bulkEditLeaguesFormError}
	unsavedConfirmOpen={bulkEditLeaguesUnsavedConfirmOpen}
	canGoNext={canGoNextBulkEditLeaguesStep}
	canSubmit={canSubmitBulkEditLeagues}
	isSubmitting={bulkEditLeaguesSubmitting}
	nextLabel={bulkEditLeaguesStep === 1 ? 'Next: Shared Updates' : 'Review Changes'}
	submitLabel="Save Bulk Changes"
	submittingLabel="Saving..."
	onRequestClose={requestCloseBulkEditLeaguesWizard}
	onSubmit={() => {
		void submitBulkEditLeaguesWizard();
	}}
	onInput={clearBulkEditLeaguesApiErrors}
	onNext={nextBulkEditLeaguesStep}
	onBack={previousBulkEditLeaguesStep}
	onUnsavedConfirm={confirmDiscardBulkEditLeaguesWizard}
	onUnsavedCancel={cancelDiscardBulkEditLeaguesWizard}
>
	{#if bulkEditLeaguesStep === 1}
		<div class="space-y-4">
			<div class="border border-neutral-950 bg-white p-4">
				<p class="font-sans text-sm leading-6 text-neutral-950">
					Choose which {bulkEditingEntryLabelPlural.toLowerCase()} should receive the shared updates.
					All visible {bulkEditingEntryLabelPlural.toLowerCase()} start selected by default.
				</p>
			</div>

			<div class="flex flex-wrap items-center justify-between gap-2 border border-neutral-950 bg-neutral-25 p-3">
				<p class="text-xs font-bold uppercase tracking-wide text-neutral-950">
					{bulkEditLeagueSelectedIds.length} of {bulkEditableLeagues.length} selected
				</p>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="button-secondary-outlined cursor-pointer"
						onclick={selectAllBulkEditLeagues}
					>
						Select All
					</button>
					<button
						type="button"
						class="button-secondary-outlined cursor-pointer"
						onclick={clearBulkEditLeagueSelection}
					>
						Clear All
					</button>
				</div>
			</div>

			{#if bulkEditLeaguesFieldErrors.selectedLeagueIds}
				<p class="text-xs text-error-700">{bulkEditLeaguesFieldErrors.selectedLeagueIds}</p>
			{/if}

			<div class="divide-y divide-neutral-950 border border-neutral-950 bg-white">
				{#each bulkEditableLeagues as league, index}
					<label class="flex cursor-pointer items-start gap-3 p-3 hover:bg-neutral-25">
						<input
							type="checkbox"
							class="checkbox-secondary mt-1"
							checked={bulkEditLeagueSelectedIds.includes(league.id)}
							data-wizard-autofocus={index === 0 ? true : undefined}
							onchange={() => {
								toggleBulkEditLeagueSelection(league.id);
							}}
						/>
						<div class="min-w-0">
							<p class="font-sans text-sm font-bold text-neutral-950">{league.name}</p>
							<p class="mt-1 text-xs text-neutral-700">
								{league.gender ? toTitleCase(league.gender) : 'Unspecified'} ·
								{league.skillLevel ? toTitleCase(league.skillLevel) : 'All levels'}
							</p>
						</div>
					</label>
				{/each}
			</div>
		</div>
	{:else if bulkEditLeaguesStep === 2}
		<div class="space-y-5">
			<div class="border border-neutral-950 bg-white p-4">
				<p class="font-sans text-sm leading-6 text-neutral-950">
					Leave any field blank or set to <span class="font-semibold">Leave unchanged</span>
					to keep the existing value on each selected {bulkEditingEntryLabelPlural.toLowerCase()}.
				</p>
			</div>

			{#if bulkEditLeaguesFieldErrors.changes}
				<p class="text-xs text-error-700">{bulkEditLeaguesFieldErrors.changes}</p>
			{/if}

			<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
				<section class="space-y-4 border border-neutral-950 bg-white p-4">
					<div>
						<h3 class="font-serif text-lg font-bold text-neutral-950">Shared Details</h3>
						<p class="mt-1 text-xs text-neutral-700">
							These updates apply to every selected {bulkEditingEntryLabelPlural.toLowerCase()}.
						</p>
					</div>

					<div>
						<label class="mb-1 block text-sm font-sans text-neutral-950" for="bulk-league-description">
							Description
						</label>
						<textarea
							id="bulk-league-description"
							class="textarea-secondary min-h-24"
							bind:value={bulkEditLeaguesForm.description}
							placeholder="Leave blank to keep each current description."
							oninput={clearBulkEditLeaguesApiErrors}
						></textarea>
					</div>

					<div>
						<label class="mb-1 block text-sm font-sans text-neutral-950" for="bulk-league-image-url">
							Image URL
						</label>
						<input
							id="bulk-league-image-url"
							type="url"
							class="input-secondary"
							bind:value={bulkEditLeaguesForm.imageUrl}
							placeholder="Leave blank to keep each current image URL."
							oninput={clearBulkEditLeaguesApiErrors}
						/>
						{#if bulkEditLeaguesFieldErrors.imageUrl}
							<p class="mt-1 text-xs text-error-700">{bulkEditLeaguesFieldErrors.imageUrl}</p>
						{/if}
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<p class="mb-1 block text-sm font-sans text-neutral-950">Gender</p>
							<ListboxDropdown
								options={bulkGenderDropdownOptions}
								value={bulkEditLeaguesForm.gender}
								ariaLabel="Bulk edit gender"
								buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
								on:change={(event) => {
									bulkEditLeaguesForm.gender = event.detail.value as BulkLeagueGenderChoice;
									clearBulkEditLeaguesApiErrors();
								}}
							/>
						</div>

						<div>
							<p class="mb-1 block text-sm font-sans text-neutral-950">Skill Level</p>
							<ListboxDropdown
								options={bulkSkillLevelDropdownOptions}
								value={bulkEditLeaguesForm.skillLevel}
								ariaLabel="Bulk edit skill level"
								buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
								on:change={(event) => {
									bulkEditLeaguesForm.skillLevel = event.detail.value as BulkLeagueSkillLevelChoice;
									clearBulkEditLeaguesApiErrors();
								}}
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<p class="mb-1 block text-sm font-sans text-neutral-950">Active</p>
							<ListboxDropdown
								options={bulkBooleanDropdownOptions}
								value={bulkEditLeaguesForm.isActive}
								ariaLabel="Bulk edit active state"
								buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
								on:change={(event) => {
									bulkEditLeaguesForm.isActive = event.detail.value as BulkBooleanChoice;
									clearBulkEditLeaguesApiErrors();
								}}
							/>
						</div>

						<div>
							<p class="mb-1 block text-sm font-sans text-neutral-950">Locked</p>
							<ListboxDropdown
								options={bulkBooleanDropdownOptions}
								value={bulkEditLeaguesForm.isLocked}
								ariaLabel="Bulk edit locked state"
								buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
								on:change={(event) => {
									bulkEditLeaguesForm.isLocked = event.detail.value as BulkBooleanChoice;
									clearBulkEditLeaguesApiErrors();
								}}
							/>
						</div>
					</div>
				</section>

				<section class="space-y-4 border border-neutral-950 bg-white p-4">
					<div>
						<h3 class="font-serif text-lg font-bold text-neutral-950">Schedule and Extras</h3>
						<p class="mt-1 text-xs text-neutral-700">
							Only the fields you fill in here will be overwritten.
						</p>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label class="mb-1 block text-sm font-sans text-neutral-950" for="bulk-reg-start">
								Registration Start
							</label>
							<input
								id="bulk-reg-start"
								type="datetime-local"
								class="input-secondary"
								bind:value={bulkEditLeaguesForm.regStartDate}
								oninput={clearBulkEditLeaguesApiErrors}
							/>
							{#if bulkEditLeaguesFieldErrors.regStartDate}
								<p class="mt-1 text-xs text-error-700">{bulkEditLeaguesFieldErrors.regStartDate}</p>
							{/if}
						</div>

						<div>
							<label class="mb-1 block text-sm font-sans text-neutral-950" for="bulk-reg-end">
								Registration End
							</label>
							<input
								id="bulk-reg-end"
								type="datetime-local"
								class="input-secondary"
								bind:value={bulkEditLeaguesForm.regEndDate}
								oninput={clearBulkEditLeaguesApiErrors}
							/>
							{#if bulkEditLeaguesFieldErrors.regEndDate}
								<p class="mt-1 text-xs text-error-700">{bulkEditLeaguesFieldErrors.regEndDate}</p>
							{/if}
						</div>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label class="mb-1 block text-sm font-sans text-neutral-950" for="bulk-season-start">
								Season Start
							</label>
							<input
								id="bulk-season-start"
								type="date"
								class="input-secondary"
								bind:value={bulkEditLeaguesForm.seasonStartDate}
								oninput={clearBulkEditLeaguesApiErrors}
							/>
							{#if bulkEditLeaguesFieldErrors.seasonStartDate}
								<p class="mt-1 text-xs text-error-700">
									{bulkEditLeaguesFieldErrors.seasonStartDate}
								</p>
							{/if}
						</div>

						<div>
							<label class="mb-1 block text-sm font-sans text-neutral-950" for="bulk-season-end">
								Season End
							</label>
							<input
								id="bulk-season-end"
								type="date"
								class="input-secondary"
								bind:value={bulkEditLeaguesForm.seasonEndDate}
								oninput={clearBulkEditLeaguesApiErrors}
							/>
							{#if bulkEditLeaguesFieldErrors.seasonEndDate}
								<p class="mt-1 text-xs text-error-700">{bulkEditLeaguesFieldErrors.seasonEndDate}</p>
							{/if}
						</div>
					</div>

					{#if bulkEditLeaguesFieldErrors.scheduleRange}
						<p class="text-xs text-error-700">{bulkEditLeaguesFieldErrors.scheduleRange}</p>
					{/if}

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-3 border border-neutral-950 bg-neutral-25 p-3">
							<p class="text-sm font-semibold text-neutral-950">Preseason</p>
							<div>
								<p class="mb-1 block text-sm font-sans text-neutral-950">Enabled</p>
								<ListboxDropdown
									options={bulkBooleanDropdownOptions}
									value={bulkEditLeaguesForm.hasPreseason}
									ariaLabel="Bulk edit preseason enabled"
									buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
									on:change={(event) => {
										bulkEditLeaguesForm.hasPreseason = event.detail.value as BulkBooleanChoice;
										clearBulkEditLeaguesApiErrors();
									}}
								/>
								{#if bulkEditLeaguesFieldErrors.hasPreseason}
									<p class="mt-1 text-xs text-error-700">{bulkEditLeaguesFieldErrors.hasPreseason}</p>
								{/if}
							</div>
							<div>
								<label class="mb-1 block text-sm font-sans text-neutral-950" for="bulk-preseason-start">
									Start Date
								</label>
								<input
									id="bulk-preseason-start"
									type="date"
									class="input-secondary"
									bind:value={bulkEditLeaguesForm.preseasonStartDate}
									oninput={clearBulkEditLeaguesApiErrors}
								/>
								{#if bulkEditLeaguesFieldErrors.preseasonStartDate}
									<p class="mt-1 text-xs text-error-700">
										{bulkEditLeaguesFieldErrors.preseasonStartDate}
									</p>
								{/if}
							</div>
							<div>
								<label class="mb-1 block text-sm font-sans text-neutral-950" for="bulk-preseason-end">
									End Date
								</label>
								<input
									id="bulk-preseason-end"
									type="date"
									class="input-secondary"
									bind:value={bulkEditLeaguesForm.preseasonEndDate}
									oninput={clearBulkEditLeaguesApiErrors}
								/>
								{#if bulkEditLeaguesFieldErrors.preseasonEndDate}
									<p class="mt-1 text-xs text-error-700">
										{bulkEditLeaguesFieldErrors.preseasonEndDate}
									</p>
								{/if}
							</div>
						</div>

						<div class="space-y-3 border border-neutral-950 bg-neutral-25 p-3">
							<p class="text-sm font-semibold text-neutral-950">Postseason</p>
							<div>
								<p class="mb-1 block text-sm font-sans text-neutral-950">Enabled</p>
								<ListboxDropdown
									options={bulkBooleanDropdownOptions}
									value={bulkEditLeaguesForm.hasPostseason}
									ariaLabel="Bulk edit postseason enabled"
									buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
									on:change={(event) => {
										bulkEditLeaguesForm.hasPostseason = event.detail.value as BulkBooleanChoice;
										clearBulkEditLeaguesApiErrors();
									}}
								/>
								{#if bulkEditLeaguesFieldErrors.hasPostseason}
									<p class="mt-1 text-xs text-error-700">{bulkEditLeaguesFieldErrors.hasPostseason}</p>
								{/if}
							</div>
							<div>
								<label class="mb-1 block text-sm font-sans text-neutral-950" for="bulk-postseason-start">
									Start Date
								</label>
								<input
									id="bulk-postseason-start"
									type="date"
									class="input-secondary"
									bind:value={bulkEditLeaguesForm.postseasonStartDate}
									oninput={clearBulkEditLeaguesApiErrors}
								/>
								{#if bulkEditLeaguesFieldErrors.postseasonStartDate}
									<p class="mt-1 text-xs text-error-700">
										{bulkEditLeaguesFieldErrors.postseasonStartDate}
									</p>
								{/if}
							</div>
							<div>
								<label class="mb-1 block text-sm font-sans text-neutral-950" for="bulk-postseason-end">
									End Date
								</label>
								<input
									id="bulk-postseason-end"
									type="date"
									class="input-secondary"
									bind:value={bulkEditLeaguesForm.postseasonEndDate}
									oninput={clearBulkEditLeaguesApiErrors}
								/>
								{#if bulkEditLeaguesFieldErrors.postseasonEndDate}
									<p class="mt-1 text-xs text-error-700">
										{bulkEditLeaguesFieldErrors.postseasonEndDate}
									</p>
								{/if}
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	{:else}
		<div class="space-y-4">
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
				<section class="space-y-3 border border-neutral-950 bg-white p-4">
					<h3 class="font-serif text-lg font-bold text-neutral-950">Selected {bulkEditingEntryLabelPlural}</h3>
					<p class="text-xs text-neutral-700">
						{bulkEditSelectedLeagueTemplates.length} {bulkEditingEntryLabelPlural.toLowerCase()} will be updated.
					</p>
					<div class="divide-y divide-neutral-950 border border-neutral-950 bg-neutral-25">
						{#each bulkEditSelectedLeagueTemplates as league}
							<div class="p-3">
								<p class="font-sans text-sm font-bold text-neutral-950">{league.name}</p>
								<p class="mt-1 text-xs text-neutral-700">
									{league.gender ? toTitleCase(league.gender) : 'Unspecified'} ·
									{league.skillLevel ? toTitleCase(league.skillLevel) : 'All levels'}
								</p>
							</div>
						{/each}
					</div>
				</section>

				<section class="space-y-3 border border-neutral-950 bg-white p-4">
					<h3 class="font-serif text-lg font-bold text-neutral-950">Changes to Apply</h3>
					{#if bulkEditChangeSummary().length === 0}
						<p class="text-sm text-neutral-950">No shared changes were selected.</p>
					{:else}
						<ul class="space-y-2">
							{#each bulkEditChangeSummary() as line}
								<li class="border border-neutral-950 bg-neutral-25 px-3 py-2 text-sm text-neutral-950">
									{line}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>
		</div>
	{/if}
</BulkEditLeaguesWizard>

<CreateLeagueWizard
	open={isCreateLeagueModalOpen}
	step={createLeagueStep}
	stepTitle={createLeagueStepTitle(createLeagueStep)}
	stepProgress={createLeagueStepProgress}
	formError={createLeagueFormError}
	title={`${createLeagueMode === 'edit' ? 'Edit' : 'New'} ${wizardEntryUnitTitleSingular()}`}
	unsavedConfirmOpen={createLeagueWizardUnsavedConfirmOpen}
	formClass={`p-4 space-y-5 flex-1 min-h-0 ${
		createLeagueStep === 2 && !createLeagueDraftActive ? 'overflow-hidden' : 'overflow-y-auto'
	}`}
	saveShortcutEnabled={createLeagueMode === 'edit'}
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
			{#if createLeagueOfferingOptions.length === 0}
				<div class="border-2 border-neutral-950 bg-white p-4 space-y-3">
					<p class="text-sm leading-5 text-neutral-950">
						Create an offering that matches this view before adding {wizardEntryUnitPlural()}.
					</p>
					<button
						type="button"
						class="button-primary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer w-fit"
						onclick={() => {
							closeCreateLeagueWizard();
							openCreateWizard();
						}}
					>
						Add Offering
					</button>
				</div>
			{:else}
				<div>
					<p class="block text-sm font-sans text-neutral-950 mb-1">
						{wizardEntryUnitTitleSingular()} Offering <span class="text-error-700">*</span>
					</p>
					<ListboxDropdown
						options={createLeagueOfferingDropdownOptions}
						value={createLeagueForm.offeringId}
						ariaLabel={`${wizardEntryUnitTitleSingular()} offering`}
						buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
						autoFocus
						on:change={(event) => {
							handleCreateLeagueOfferingChange(event.detail.value);
						}}
					/>
					{#if createLeagueFieldErrors['offeringId']}
						<p class="text-xs text-error-700 mt-1">{createLeagueFieldErrors['offeringId']}</p>
					{/if}
				</div>

				{#if selectedLeagueWizardOffering}
					<div class="border border-neutral-950 bg-white p-3 text-sm text-neutral-950 space-y-2">
						<div class="flex items-center justify-between gap-2">
							<p>
								<span class="font-semibold">Type:</span>
								{selectedLeagueWizardOffering.type === 'tournament' ? 'Tournament' : 'League'}
							</p>
							<p>
								<span class="font-semibold">Status:</span>
								{selectedLeagueWizardOffering.isActive ? 'Active' : 'Inactive'}
							</p>
						</div>
						{#if selectedOfferingLeagueTemplates.length === 0}
							<p class="text-xs text-neutral-900">
								No existing {wizardEntryUnitPlural()} for this offering yet.
							</p>
						{:else}
							<div class="border border-secondary-200 bg-neutral p-2 space-y-2">
								<p class="text-xs font-semibold uppercase tracking-wide text-neutral-950">
									Copy Existing {wizardEntryUnitTitleSingular()}
								</p>
								<div
									class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400"
								>
									{#each selectedOfferingLeagueTemplates as existingLeague}
										<HoverTooltip text={`Duplicate ${wizardEntryUnitSingular()} settings`}>
											<button
												type="button"
												class="h-14 w-full border border-secondary-300 bg-white px-2 py-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left cursor-pointer hover:bg-neutral-200 active:bg-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
												aria-label={`Duplicate ${existingLeague.name}`}
												onclick={() => {
													copyFromExistingLeagueTemplate(existingLeague);
												}}
											>
												<span class="min-w-0">
													<span class="block text-sm font-semibold text-neutral-950 truncate">
														{existingLeague.name}
													</span>
													<span class="block text-xs text-neutral-900 truncate">
														{getSeasonLabel(existingLeague.seasonId)}
													</span>
												</span>
												<IconCopy class="w-4 h-4 shrink-0" />
											</button>
										</HoverTooltip>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	{#if createLeagueStep === 2}
		<div class="space-y-4">
			{#if selectedLeagueWizardOffering}
				<div class="border border-neutral-950 bg-white p-3 text-sm text-neutral-950">
					Adding to
					<span class="font-semibold">{selectedLeagueWizardOffering.name}</span>
				</div>
			{/if}
			{#if !createLeagueDraftActive}
				<div class="space-y-2">
					{#if createLeagueFieldErrors['leagues']}
						<p class="text-xs text-error-700">{createLeagueFieldErrors['leagues']}</p>
					{/if}
					<WizardDraftCollection
						title={wizardEntryType() === 'tournament' ? 'Tournament Groups' : 'Leagues'}
						itemSingular={wizardEntryUnitSingular()}
						itemPlural={wizardEntryUnitPlural()}
						items={createLeagueForm.leagues}
						draftActive={createLeagueDraftActive}
						emptyMessage={`No ${wizardEntryUnitPlural()} added yet. Use the plus button to add one, or continue without ${wizardEntryUnitPlural()}.`}
						onAdd={startAddingCreateLeagueDraft}
						onEdit={startEditingCreateLeague}
						onCopy={duplicateCreateLeague}
						onMoveUp={(index) => moveCreateLeague(index, 'up')}
						onMoveDown={(index) => moveCreateLeague(index, 'down')}
						onRemove={removeCreateLeague}
						getItemName={(item) => (item as WizardLeagueInput).name}
						getItemSlug={(item) => (item as WizardLeagueInput).slug}
						listClass="space-y-2 max-h-[52vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400 scrollbar-corner-secondary-500 hover:scrollbar-thumb-secondary-700 active:scrollbar-thumb-secondary-700 scrollbar-hover:scrollbar-thumb-secondary-800 scrollbar-active:scrollbar-thumb-secondary-700"
					>
						{#snippet itemBody(item)}
							{@const league = item as WizardLeagueInput}
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-950">
								<p><span class="font-semibold">Season:</span> {getSeasonLabel(league.seasonId)}</p>
								<p>
									<span class="font-semibold">Gender:</span>
									{normalizeGender(league.gender) ?? 'Unspecified'}
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
									<DateHoverText
										display={formatReviewRange(league.regStartDate, league.regEndDate, true)}
										value={league.regStartDate}
										endValue={league.regEndDate}
										includeTime
										textClass="ml-1"
									/>
								</p>
								<p class="sm:col-span-2">
									<span class="font-semibold">Season Dates:</span>
									<DateHoverText
										display={formatReviewRange(league.seasonStartDate, league.seasonEndDate)}
										value={league.seasonStartDate}
										endValue={league.seasonEndDate}
										textClass="ml-1"
									/>
								</p>
								{#if league.hasPreseason}
									<p class="sm:col-span-2">
										<span class="font-semibold">Preseason:</span>
										<DateHoverText
											display={formatReviewRange(
												league.preseasonStartDate,
												league.preseasonEndDate
											)}
											value={league.preseasonStartDate}
											endValue={league.preseasonEndDate}
											textClass="ml-1"
										/>
									</p>
								{/if}
								{#if league.hasPostseason}
									<p class="sm:col-span-2">
										<span class="font-semibold">Postseason:</span>
										<DateHoverText
											display={formatReviewRange(
												league.postseasonStartDate,
												league.postseasonEndDate
											)}
											value={league.postseasonStartDate}
											endValue={league.postseasonEndDate}
											textClass="ml-1"
										/>
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
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div>
						<label for="league-wizard-name" class="block text-sm font-sans text-neutral-950 mb-1"
							>Name <span class="text-error-700">*</span></label
						>
						<input
							id="league-wizard-name"
							type="text"
							class="input-secondary"
							value={createLeagueForm.league.name}
							placeholder={defaultLeagueNamePlaceholder(wizardEntryType() === 'tournament')}
							oninput={(event) => {
								const value = (event.currentTarget as HTMLInputElement).value;
								createLeagueForm.league.name = value;
								if (!createLeagueSlugTouched) {
									const offeringName = selectedLeagueWizardOffering?.name ?? '';
									createLeagueForm.league.slug = defaultLeagueSlug(value, offeringName);
									createLeagueForm.league.isSlugManual = false;
								}
							}}
							autocomplete="off"
						/>
						{#if createLeagueFieldErrors['league.name']}
							<p class="text-xs text-error-700 mt-1">{createLeagueFieldErrors['league.name']}</p>
						{/if}
					</div>

					<div>
						<div class="mb-1 flex h-5 items-center gap-1.5 leading-none">
							<label for="league-wizard-slug" class="text-sm leading-5 font-sans text-neutral-950"
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
									isTournament: wizardEntryType() === 'tournament'
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
										const offeringName = selectedLeagueWizardOffering?.name ?? '';
										createLeagueSlugTouched = false;
										createLeagueForm.league.isSlugManual = false;
										createLeagueForm.league.slug = defaultLeagueSlug(
											createLeagueForm.league.name,
											offeringName
										);
									}}
								>
									<IconRestore class="h-4 w-4" />
								</button>
							</HoverTooltip>
						</div>
						{#if createLeagueFieldErrors['league.slug']}
							<p class="text-xs text-error-700 mt-1">{createLeagueFieldErrors['league.slug']}</p>
						{/if}
					</div>

					<div>
						<p class="block text-sm font-sans text-neutral-950 mb-1">
							Season <span class="text-error-700">*</span>
						</p>
						<ListboxDropdown
							options={seasonDropdownOptions}
							value={createLeagueForm.league.seasonId}
							ariaLabel="League wizard season"
							buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
							on:change={(event) => {
								createLeagueForm.league.seasonId = event.detail.value;
								clearCreateLeagueApiErrors();
							}}
						/>
						{#if createLeagueFieldErrors['league.seasonId']}
							<p class="text-xs text-error-700 mt-1">
								{createLeagueFieldErrors['league.seasonId']}
							</p>
						{/if}
					</div>

					<div>
						<p class="block text-sm font-sans text-neutral-950 mb-1">Gender</p>
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
						<p class="block text-sm font-sans text-neutral-950 mb-1">Skill Level</p>
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
							class="block text-sm font-sans text-neutral-950 mb-1">Description</label
						>
						<textarea
							id="league-wizard-description"
							class="textarea-secondary min-h-28"
							bind:value={createLeagueForm.league.description}
							placeholder={`Describe this ${wizardEntryUnitSingular()}.`}
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
						No {wizardEntryUnitSingular()} draft is open. Go back to {createLeagueStepTitle(2)}
						and click the plus button to add one.
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div>
						<label
							for="league-wizard-reg-start"
							class="block text-sm font-sans text-neutral-950 mb-1"
							>{wizardEntryType() === 'tournament'
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
							<p class="text-xs text-error-700 mt-1">
								{createLeagueFieldErrors['league.regStartDate']}
							</p>
						{/if}
					</div>
					<div>
						<label for="league-wizard-reg-end" class="block text-sm font-sans text-neutral-950 mb-1"
							>{wizardEntryType() === 'tournament'
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
							<p class="text-xs text-error-700 mt-1">
								{createLeagueFieldErrors['league.regEndDate']}
							</p>
						{/if}
					</div>
					<div>
						<label
							for="league-wizard-season-start"
							class="block text-sm font-sans text-neutral-950 mb-1"
							>Season Start Date <span class="text-error-700">*</span></label
						>
						<input
							id="league-wizard-season-start"
							type="date"
							class="input-secondary"
							bind:value={createLeagueForm.league.seasonStartDate}
						/>
						{#if createLeagueFieldErrors['league.seasonStartDate']}
							<p class="text-xs text-error-700 mt-1">
								{createLeagueFieldErrors['league.seasonStartDate']}
							</p>
						{/if}
					</div>
					<div>
						<label
							for="league-wizard-season-end"
							class="block text-sm font-sans text-neutral-950 mb-1"
							>Season End Date <span class="text-error-700">*</span></label
						>
						<input
							id="league-wizard-season-end"
							type="date"
							class="input-secondary"
							bind:value={createLeagueForm.league.seasonEndDate}
						/>
						{#if createLeagueFieldErrors['league.seasonEndDate']}
							<p class="text-xs text-error-700 mt-1">
								{createLeagueFieldErrors['league.seasonEndDate']}
							</p>
						{/if}
					</div>
				</div>

				{#if createLeagueFieldErrors['league.scheduleRange']}
					<p class="text-xs text-error-700">
						{createLeagueFieldErrors['league.scheduleRange']}
					</p>
				{/if}

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div class="border border-neutral-950 bg-white p-3 space-y-3">
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
										class="block text-sm font-sans text-neutral-950 mb-1">Preseason Start</label
									>
									<input
										id="league-wizard-preseason-start"
										type="date"
										class="input-secondary"
										bind:value={createLeagueForm.league.preseasonStartDate}
									/>
									{#if createLeagueFieldErrors['league.preseasonStartDate']}
										<p class="text-xs text-error-700 mt-1">
											{createLeagueFieldErrors['league.preseasonStartDate']}
										</p>
									{/if}
								</div>
								<div>
									<label
										for="league-wizard-preseason-end"
										class="block text-sm font-sans text-neutral-950 mb-1">Preseason End</label
									>
									<input
										id="league-wizard-preseason-end"
										type="date"
										class="input-secondary"
										bind:value={createLeagueForm.league.preseasonEndDate}
									/>
									{#if createLeagueFieldErrors['league.preseasonEndDate']}
										<p class="text-xs text-error-700 mt-1">
											{createLeagueFieldErrors['league.preseasonEndDate']}
										</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>

					<div class="border border-neutral-950 bg-white p-3 space-y-3">
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
										class="block text-sm font-sans text-neutral-950 mb-1">Postseason Start</label
									>
									<input
										id="league-wizard-postseason-start"
										type="date"
										class="input-secondary"
										bind:value={createLeagueForm.league.postseasonStartDate}
									/>
									{#if createLeagueFieldErrors['league.postseasonStartDate']}
										<p class="text-xs text-error-700 mt-1">
											{createLeagueFieldErrors['league.postseasonStartDate']}
										</p>
									{/if}
								</div>
								<div>
									<label
										for="league-wizard-postseason-end"
										class="block text-sm font-sans text-neutral-950 mb-1">Postseason End</label
									>
									<input
										id="league-wizard-postseason-end"
										type="date"
										class="input-secondary"
										bind:value={createLeagueForm.league.postseasonEndDate}
									/>
									{#if createLeagueFieldErrors['league.postseasonEndDate']}
										<p class="text-xs text-error-700 mt-1">
											{createLeagueFieldErrors['league.postseasonEndDate']}
										</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
					<label for="league-wizard-image-url" class="block text-sm font-sans text-neutral-950 mb-1"
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
						<p class="text-xs text-error-700 mt-1">
							{createLeagueFieldErrors['league.imageUrl']}
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if createLeagueStep === 4}
		<div class="space-y-4">
			<div class="border-2 border-neutral-950 bg-white p-4 space-y-2">
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Offering</h3>
					{#if !createLeagueCopiedFromExisting}
						<HoverTooltip text="Edit offering">
							<button
								type="button"
								class="button-secondary-outlined p-1.5 cursor-pointer"
								aria-label="Edit offering"
								onclick={startEditingCreateLeagueOffering}
							>
								<IconPencil class="w-4 h-4" />
							</button>
						</HoverTooltip>
					{/if}
				</div>
				{#if selectedLeagueWizardOffering}
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Name:</span>
						{selectedLeagueWizardOffering.name}
					</p>
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Type:</span>
						{selectedLeagueWizardOffering.type === 'tournament' ? 'Tournament' : 'League'}
						<span class="ml-3 font-semibold">Status:</span>
						{selectedLeagueWizardOffering.isActive ? 'Active' : 'Inactive'}
					</p>
				{:else}
					<p class="text-sm leading-5 text-neutral-950">No offering selected.</p>
				{/if}
			</div>

			<div class="border-2 border-neutral-950 bg-white p-4 space-y-3">
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">
						{wizardEntryUnitTitlePlural()}
					</h3>
					<HoverTooltip text={`Edit ${wizardEntryUnitPlural()}`}>
						<button
							type="button"
							class="button-secondary-outlined p-1.5 cursor-pointer"
							aria-label={`Edit ${wizardEntryUnitPlural()}`}
							onclick={startEditingCreateLeagues}
						>
							<IconPencil class="w-4 h-4" />
						</button>
					</HoverTooltip>
				</div>
				{#if createLeagueFieldErrors['leagues']}
					<p class="text-xs text-error-700">{createLeagueFieldErrors['leagues']}</p>
				{/if}
				{#if createLeagueForm.leagues.length === 0}
					<p class="text-sm text-neutral-950 font-sans">
						No {wizardEntryUnitPlural()} will be created.
					</p>
				{:else}
					<div
						class="space-y-3 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400"
					>
						{#each createLeagueForm.leagues as league}
							<div class="border border-neutral-950 bg-neutral p-3 space-y-2">
								<div>
									<p class="text-sm font-semibold text-neutral-950">
										{league.name.trim() || `Untitled ${wizardEntryUnitTitleSingular()}`}
									</p>
									<p class="text-xs text-neutral-900">Slug: {league.slug || 'TBD'}</p>
								</div>
								<div
									class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-950"
								>
									<p>
										<span class="font-semibold">Season:</span>
										{getSeasonLabel(league.seasonId)}
									</p>
									<p>
										<span class="font-semibold">Gender:</span>
										{normalizeGender(league.gender) ?? 'Unspecified'}
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
										<DateHoverText
											display={formatReviewRange(league.regStartDate, league.regEndDate, true)}
											value={league.regStartDate}
											endValue={league.regEndDate}
											includeTime
											textClass="ml-1"
										/>
									</p>
									<p class="sm:col-span-2">
										<span class="font-semibold">Season Dates:</span>
										<DateHoverText
											display={formatReviewRange(league.seasonStartDate, league.seasonEndDate)}
											value={league.seasonStartDate}
											endValue={league.seasonEndDate}
											textClass="ml-1"
										/>
									</p>
									{#if league.hasPreseason}
										<p class="sm:col-span-2">
											<span class="font-semibold">Preseason:</span>
											<DateHoverText
												display={formatReviewRange(
													league.preseasonStartDate,
													league.preseasonEndDate
												)}
												value={league.preseasonStartDate}
												endValue={league.preseasonEndDate}
												textClass="ml-1"
											/>
										</p>
									{/if}
									{#if league.hasPostseason}
										<p class="sm:col-span-2">
											<span class="font-semibold">Postseason:</span>
											<DateHoverText
												display={formatReviewRange(
													league.postseasonStartDate,
													league.postseasonEndDate
												)}
												value={league.postseasonStartDate}
												endValue={league.postseasonEndDate}
												textClass="ml-1"
											/>
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
			showBack={createLeagueStep > 1 && !(createLeagueMode === 'edit' && createLeagueStep === 2)}
			canGoNext={canGoNextCreateLeagueStep}
			canSubmit={canSubmitCreateLeague}
			nextLabel={createLeagueStep === 2 && !createLeagueDraftActive
				? createLeagueForm.leagues.length === 0
					? 'Skip to Review'
					: 'Review'
				: createLeagueStep === 3 && createLeagueDraftActive
					? createLeagueEditingIndex === null
						? `Add ${wizardEntryUnitTitleSingular()}`
						: `Update ${wizardEntryUnitTitleSingular()}`
					: 'Next'}
			submitLabel={createLeagueMode === 'edit' ? 'Save Changes' : 'Create'}
			submittingLabel={createLeagueMode === 'edit' ? 'Saving...' : 'Creating...'}
			isSubmitting={createLeagueSubmitting}
			on:back={handleCreateLeagueBackAction}
			on:next={nextCreateLeagueStep}
		/>
	{/snippet}
</CreateLeagueWizard>

<CreateOfferingWizard
	open={isCreateModalOpen}
	step={createStepDisplay}
	stepCount={createVisibleSteps.length}
	stepTitle={wizardStepTitle(createStep)}
	stepProgress={createStepProgress}
	formError={createFormError}
	unsavedConfirmOpen={createWizardUnsavedConfirmOpen}
	onRequestClose={requestCloseCreateWizard}
	onSubmit={() => {
		void submitCreateWizard();
	}}
	onInput={clearCreateApiErrors}
	onUnsavedConfirm={confirmDiscardCreateWizard}
	onUnsavedCancel={cancelDiscardCreateWizard}
>
	{#if createStep === 1}
		<div class="space-y-4">
			<div>
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div>
						<label for="offering-name" class="block text-sm font-sans text-neutral-950 mb-1"
							>Name <span class="text-error-700">*</span></label
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
									createForm.offering.slug = slugifyFinal(value);
								}
							}}
							autocomplete="off"
						/>
						{#if createFieldErrors['offering.name']}
							<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.name']}</p>
						{/if}
					</div>

					<div>
						<div class="mb-1 flex h-5 items-center gap-1.5 leading-none">
							<label for="offering-slug" class="text-sm leading-5 font-sans text-neutral-950"
								>Slug <span class="text-error-700">*</span></label
							>
							<InfoPopover
								buttonAriaLabel="Offering slug help"
								buttonVariant="label-inline"
								align="left"
								panelWidthClass="w-80"
							>
								<div class="space-y-2">
									<p>A slug is the URL-friendly identifier used in links and lookups.</p>
									<p>Leave the default slug if you are unsure.</p>
								</div>
							</InfoPopover>
						</div>
						<div class="relative">
							<input
								id="offering-slug"
								type="text"
								class="input-secondary pr-10"
								value={createForm.offering.slug}
								placeholder="basketball"
								oninput={(event) => {
									offeringSlugTouched = true;
									createForm.offering.slug = applyLiveSlugInput(
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
									aria-label="Revert offering slug to default"
									onclick={() => {
										offeringSlugTouched = false;
										createForm.offering.slug = slugifyFinal(createForm.offering.name);
									}}
								>
									<IconRestore class="h-4 w-4" />
								</button>
							</HoverTooltip>
						</div>
						{#if createFieldErrors['offering.slug']}
							<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.slug']}</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<div>
					<p class="block text-sm font-sans text-neutral-950 mb-1">
						Season <span class="text-error-700">*</span>
					</p>
					<ListboxDropdown
						options={createOfferingSeasonDropdownOptions}
						value={createForm.offering.seasonId}
						ariaLabel="Offering season"
						buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
						on:change={(event) => {
							const nextSeasonId = event.detail.value;
							createForm.offering.seasonId = nextSeasonId;
							createForm.league.seasonId = nextSeasonId;
							if (createForm.leagues.length > 0) {
								createForm.leagues = createForm.leagues.map((league) => ({
									...league,
									seasonId: nextSeasonId
								}));
							}
							clearCreateApiErrors();
						}}
					/>
					{#if createFieldErrors['offering.seasonId']}
						<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.seasonId']}</p>
					{/if}
				</div>

				<div>
					<p class="block text-sm font-sans text-neutral-950 mb-1">
						Type <span class="text-error-700">*</span>
					</p>
					<ListboxDropdown
						options={offeringTypeDropdownOptions}
						value={createForm.offering.type}
						ariaLabel="Offering type"
						buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
						on:change={(event) => {
							createForm.offering.type = event.detail.value as 'league' | 'tournament';
							clearCreateApiErrors();
						}}
					/>
					{#if createFieldErrors['offering.type']}
						<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.type']}</p>
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
						placeholder="Basketball (optional)"
						autocomplete="off"
					/>
					{#if createFieldErrors['offering.sport']}
						<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.sport']}</p>
					{/if}
				</div>
			</div>

			<div>
				<label for="offering-description" class="block text-sm font-sans text-neutral-950 mb-1"
					>Description</label
				>
				<textarea
					id="offering-description"
					class="textarea-secondary min-h-28"
					bind:value={createForm.offering.description}
					placeholder="Describe this offering."
				></textarea>
				{#if createFieldErrors['offering.description']}
					<p class="text-xs text-error-700 mt-1">
						{createFieldErrors['offering.description']}
					</p>
				{/if}
			</div>
		</div>
	{/if}

	{#if createStep === 2}
		<div class="space-y-4">
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div>
					<p class="block text-sm font-sans text-neutral-950 mb-1">Link to Previous Offering</p>
					<ListboxDropdown
						options={offeringLinkDropdownOptions}
						value={createForm.offering.linkedOfferingId}
						ariaLabel="Link offering with a previous offering"
						buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
						on:change={(event) => {
							createForm.offering.linkedOfferingId = event.detail.value;
							clearCreateApiErrors();
						}}
					/>
					<p class="mt-1 text-xs text-neutral-900">
						Optional. Use this when the same offering already existed in a previous season and
						should stay connected as one cross-season offering.
					</p>
					{#if createFieldErrors['offering.linkedOfferingId']}
						<p class="text-xs text-error-700 mt-1">
							{createFieldErrors['offering.linkedOfferingId']}
						</p>
					{/if}
				</div>

				<div class="border border-neutral-950 bg-neutral p-3">
					{#if selectedLinkedOffering}
						<p class="text-sm font-semibold text-neutral-950">Selected previous offering</p>
						<p class="mt-1 text-sm text-neutral-950">
							{selectedLinkedOffering.name}
						</p>
						<p class="mt-1 text-xs text-neutral-900">
							Previously used in {selectedLinkedOffering.seasonNames.join(', ')}.
						</p>
					{:else}
						<p class="text-sm font-semibold text-neutral-950">Matching previous offerings found</p>
						<p class="mt-1 text-xs text-neutral-900">
							Pick one if this offering should extend an existing offering history from earlier
							seasons.
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if createStep === 3}
		<div class="space-y-4">
			<div class="grid grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] gap-5">
				<div class="space-y-4 max-w-60">
					<div>
						<label for="offering-min-players" class="block text-sm font-sans text-neutral-950 mb-1"
							>Min Roster Players</label
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
								const parsed = Number.parseInt((event.currentTarget as HTMLInputElement).value, 10);
								createForm.offering.minPlayers = Number.isNaN(parsed) ? 0 : parsed;
							}}
						/>
						{#if createFieldErrors['offering.minPlayers']}
							<p class="text-xs text-error-700 mt-1">
								{createFieldErrors['offering.minPlayers']}
							</p>
						{/if}
					</div>

					<div>
						<label for="offering-max-players" class="block text-sm font-sans text-neutral-950 mb-1"
							>Max Roster Players</label
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
								const parsed = Number.parseInt((event.currentTarget as HTMLInputElement).value, 10);
								createForm.offering.maxPlayers = Number.isNaN(parsed) ? 0 : parsed;
							}}
						/>
						{#if createFieldErrors['offering.maxPlayers']}
							<p class="text-xs text-error-700 mt-1">
								{createFieldErrors['offering.maxPlayers']}
							</p>
						{/if}
					</div>
				</div>

				<div class="space-y-4 max-w-3xl">
					<div>
						<label for="offering-image-url" class="block text-sm font-sans text-neutral-950 mb-1"
							>Image URL</label
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
							<p class="text-xs text-error-700 mt-1">
								{createFieldErrors['offering.imageUrl']}
							</p>
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
							<p class="text-xs text-error-700 mt-1">
								{createFieldErrors['offering.rulebookUrl']}
							</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="border border-neutral-950 bg-white p-3">
				<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
					<input
						type="checkbox"
						class="toggle-secondary"
						bind:checked={createForm.offering.isActive}
					/>
					Active
				</label>
			</div>
		</div>
	{/if}

	{#if createStep === 4}
		<div class="space-y-4">
			{#if !leagueDraftActive}
				<WizardDraftCollection
					title={isTournamentWizard() ? 'Tournament Groups' : 'Leagues'}
					itemSingular={wizardUnitSingular()}
					itemPlural={wizardUnitPlural()}
					items={createForm.leagues}
					draftActive={leagueDraftActive}
					emptyMessage={`No ${wizardUnitPlural()} added yet. Use the plus button to add one, or continue without ${wizardUnitPlural()}.`}
					onAdd={startAddingLeague}
					onEdit={startEditingLeague}
					onCopy={duplicateLeague}
					onMoveUp={(index) => moveLeague(index, 'up')}
					onMoveDown={(index) => moveLeague(index, 'down')}
					onRemove={removeLeague}
					getItemName={(item) => (item as WizardLeagueInput).name}
					getItemSlug={(item) => (item as WizardLeagueInput).slug}
				>
					{#snippet itemBody(item)}
						{@const league = item as WizardLeagueInput}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-950">
							<p><span class="font-semibold">Season:</span> {getSeasonLabel(league.seasonId)}</p>
							<p>
								<span class="font-semibold">Gender:</span>
								{normalizeGender(league.gender) ?? 'Unspecified'}
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
								<DateHoverText
									display={formatReviewRange(league.regStartDate, league.regEndDate, true)}
									value={league.regStartDate}
									endValue={league.regEndDate}
									includeTime
									textClass="ml-1"
								/>
							</p>
							<p class="sm:col-span-2">
								<span class="font-semibold">Season Dates:</span>
								<DateHoverText
									display={formatReviewRange(league.seasonStartDate, league.seasonEndDate)}
									value={league.seasonStartDate}
									endValue={league.seasonEndDate}
									textClass="ml-1"
								/>
							</p>
							{#if league.hasPreseason}
								<p class="sm:col-span-2">
									<span class="font-semibold">Preseason:</span>
									<DateHoverText
										display={formatReviewRange(league.preseasonStartDate, league.preseasonEndDate)}
										value={league.preseasonStartDate}
										endValue={league.preseasonEndDate}
										textClass="ml-1"
									/>
								</p>
							{/if}
							{#if league.hasPostseason}
								<p class="sm:col-span-2">
									<span class="font-semibold">Postseason:</span>
									<DateHoverText
										display={formatReviewRange(
											league.postseasonStartDate,
											league.postseasonEndDate
										)}
										value={league.postseasonStartDate}
										endValue={league.postseasonEndDate}
										textClass="ml-1"
									/>
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
			{:else}
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div>
						<label for="league-name" class="block text-sm font-sans text-neutral-950 mb-1"
							>Name <span class="text-error-700">*</span></label
						>
						<input
							id="league-name"
							type="text"
							class="input-secondary"
							value={createForm.league.name}
							placeholder={defaultLeagueNamePlaceholder(isTournamentWizard())}
							oninput={(event) => {
								const value = (event.currentTarget as HTMLInputElement).value;
								createForm.league.name = value;
								if (!leagueSlugTouched) {
									createForm.league.slug = defaultLeagueSlug(value, createForm.offering.name);
									createForm.league.isSlugManual = false;
								}
							}}
							autocomplete="off"
						/>
						{#if createFieldErrors['league.name']}
							<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.name']}</p>
						{/if}
					</div>

					<div>
						<div class="mb-1 flex h-5 items-center gap-1.5 leading-none">
							<label for="league-slug" class="text-sm leading-5 font-sans text-neutral-950"
								>Slug <span class="text-error-700">*</span></label
							>
							<InfoPopover
								buttonAriaLabel="League or group slug help"
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
								id="league-slug"
								type="text"
								class="input-secondary pr-10"
								value={createForm.league.slug}
								placeholder={defaultLeagueSlugPlaceholder({
									leagueName: createForm.league.name,
									offeringName: createForm.offering.name,
									isTournament: isTournamentWizard()
								})}
								oninput={(event) => {
									leagueSlugTouched = true;
									createForm.league.isSlugManual = true;
									createForm.league.slug = applyLiveSlugInput(
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
										leagueSlugTouched = false;
										createForm.league.isSlugManual = false;
										createForm.league.slug = defaultLeagueSlug(
											createForm.league.name,
											createForm.offering.name
										);
									}}
								>
									<IconRestore class="h-4 w-4" />
								</button>
							</HoverTooltip>
						</div>
						{#if createFieldErrors['league.slug']}
							<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.slug']}</p>
						{/if}
					</div>

					<div>
						<p class="block text-sm font-sans text-neutral-950 mb-1">
							Season <span class="text-error-700">*</span>
						</p>
						<ListboxDropdown
							options={createOfferingLeagueSeasonDropdownOptions}
							value={createForm.league.seasonId}
							ariaLabel="League season"
							buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
							disabled={Boolean(createForm.offering.seasonId)}
							on:change={(event) => {
								createForm.league.seasonId = event.detail.value;
								clearCreateApiErrors();
							}}
						/>
						{#if createFieldErrors['league.seasonId']}
							<p class="text-xs text-error-700 mt-1">{createFieldErrors['league.seasonId']}</p>
						{/if}
					</div>

					<div>
						<p class="block text-sm font-sans text-neutral-950 mb-1">Gender</p>
						<ListboxDropdown
							options={leagueGenderDropdownOptions}
							value={createForm.league.gender}
							ariaLabel="League gender"
							buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
							on:change={(event) => {
								createForm.league.gender = event.detail.value as LeagueGender;
								clearCreateApiErrors();
							}}
						/>
					</div>

					<div>
						<p class="block text-sm font-sans text-neutral-950 mb-1">Skill Level</p>
						<ListboxDropdown
							options={leagueSkillLevelDropdownOptions}
							value={createForm.league.skillLevel}
							ariaLabel="League skill level"
							buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
							on:change={(event) => {
								createForm.league.skillLevel = event.detail.value as LeagueSkillLevel;
								clearCreateApiErrors();
							}}
						/>
					</div>

					<div class="lg:col-span-2">
						<label for="league-description" class="block text-sm font-sans text-neutral-950 mb-1"
							>Description</label
						>
						<textarea
							id="league-description"
							class="textarea-secondary min-h-28"
							bind:value={createForm.league.description}
							placeholder={`Describe this ${wizardUnitSingular()}.`}
						></textarea>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if createStep === 5}
		<div class="space-y-4">
			{#if !leagueDraftActive}
				<div class="border border-neutral-950 bg-white p-4">
					<p class="text-sm leading-5 font-sans text-neutral-950">
						No {wizardUnitSingular()} draft is open. Go back to {wizardStepTitle(4)} and click the plus
						button to add one.
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div>
						<label for="league-reg-start" class="block text-sm font-sans text-neutral-950 mb-1"
							>{isTournamentWizard() ? 'Tournament Registration Opens' : 'Team Registration Opens'}
							<span class="text-error-700">*</span></label
						>
						<input
							id="league-reg-start"
							type="datetime-local"
							class="input-secondary"
							bind:value={createForm.league.regStartDate}
							onfocus={() => {
								if (!createForm.league.regStartDate.trim()) {
									createForm.league.regStartDate = defaultDateTimeValue('start');
								}
							}}
						/>
						{#if createFieldErrors['league.regStartDate']}
							<p class="text-xs text-error-700 mt-1">
								{createFieldErrors['league.regStartDate']}
							</p>
						{/if}
					</div>
					<div>
						<label for="league-reg-end" class="block text-sm font-sans text-neutral-950 mb-1"
							>{isTournamentWizard()
								? 'Tournament Registration Deadline'
								: 'Team Registration Deadline'}
							<span class="text-error-700">*</span></label
						>
						<input
							id="league-reg-end"
							type="datetime-local"
							class="input-secondary"
							bind:value={createForm.league.regEndDate}
							onfocus={() => {
								if (!createForm.league.regEndDate.trim()) {
									createForm.league.regEndDate = defaultDateTimeValue('end');
								}
							}}
						/>
						{#if createFieldErrors['league.regEndDate']}
							<p class="text-xs text-error-700 mt-1">
								{createFieldErrors['league.regEndDate']}
							</p>
						{/if}
					</div>
					<div>
						<label for="league-season-start" class="block text-sm font-sans text-neutral-950 mb-1"
							>Season Start Date <span class="text-error-700">*</span></label
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
							>Season End Date <span class="text-error-700">*</span></label
						>
						<input
							id="league-season-end"
							type="date"
							class="input-secondary"
							bind:value={createForm.league.seasonEndDate}
						/>
						{#if createFieldErrors['league.seasonEndDate']}
							<p class="text-xs text-error-700 mt-1">
								{createFieldErrors['league.seasonEndDate']}
							</p>
						{/if}
					</div>
				</div>

				{#if createFieldErrors['league.scheduleRange']}
					<p class="text-xs text-error-700">{createFieldErrors['league.scheduleRange']}</p>
				{/if}

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div class="border border-neutral-950 bg-white p-3 space-y-3">
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
							Has Preseason
						</label>
						{#if createForm.league.hasPreseason}
							<div class="space-y-3">
								<div>
									<label
										for="league-preseason-start"
										class="block text-sm font-sans text-neutral-950 mb-1">Preseason Start</label
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
										class="block text-sm font-sans text-neutral-950 mb-1">Preseason End</label
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

					<div class="border border-neutral-950 bg-white p-3 space-y-3">
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
							Has Postseason
						</label>
						{#if createForm.league.hasPostseason}
							<div class="space-y-3">
								<div>
									<label
										for="league-postseason-start"
										class="block text-sm font-sans text-neutral-950 mb-1">Postseason Start</label
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
										class="block text-sm font-sans text-neutral-950 mb-1">Postseason End</label
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
					<div class="border border-neutral-950 bg-white p-3">
						<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
							<input
								type="checkbox"
								class="toggle-secondary"
								bind:checked={createForm.league.isActive}
							/>
							Active
						</label>
					</div>
					<div class="border border-neutral-950 bg-white p-3">
						<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
							<input
								type="checkbox"
								class="toggle-secondary"
								bind:checked={createForm.league.isLocked}
							/>
							Locked
						</label>
					</div>
				</div>

				<div>
					<label for="league-image-url" class="block text-sm font-sans text-neutral-950 mb-1"
						>Image URL</label
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
			{/if}
		</div>
	{/if}

	{#if createStep === 6}
		<div class="space-y-4">
			<div class="border-2 border-neutral-950 bg-white p-4 space-y-2">
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Offering</h3>
					<HoverTooltip text="Edit offering">
						<button
							type="button"
							class="button-secondary-outlined p-1.5 cursor-pointer"
							aria-label="Edit offering"
							onclick={startEditingOffering}
						>
							<IconPencil class="w-4 h-4" />
						</button>
					</HoverTooltip>
				</div>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Name:</span>
					{createForm.offering.name}
					<span class="ml-3 font-semibold">Slug:</span>
					{slugifyFinal(createForm.offering.slug)}
				</p>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Season:</span>
					{getSeasonLabel(createForm.offering.seasonId)}
				</p>
				{#if selectedLinkedOffering}
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Previous Offering Link:</span>
						{selectedLinkedOffering.name} ({selectedLinkedOffering.seasonNames.join(', ')})
					</p>
				{/if}
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Sport:</span>
					{createForm.offering.sport.trim() || 'Not specified'}
					<span class="ml-3 font-semibold">Type:</span>
					{createForm.offering.type === 'tournament' ? 'Tournament' : 'League'}
				</p>
				{#if createForm.offering.description.trim()}
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Description:</span>
						{createForm.offering.description.trim()}
					</p>
				{/if}
				{#if createForm.offering.minPlayers > 0 || createForm.offering.maxPlayers > 0}
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Roster Players:</span>
						{createForm.offering.minPlayers > 0 ? createForm.offering.minPlayers : 'N/A'} -
						{createForm.offering.maxPlayers > 0 ? createForm.offering.maxPlayers : 'N/A'}
					</p>
				{/if}
			</div>

			<div class="border-2 border-neutral-950 bg-white p-4 space-y-3">
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">
						{wizardUnitTitlePlural()}
					</h3>
					<HoverTooltip text={`Edit ${wizardUnitPlural()}`}>
						<button
							type="button"
							class="button-secondary-outlined p-1.5 cursor-pointer"
							aria-label={`Edit ${wizardUnitPlural()}`}
							onclick={startEditingLeagues}
						>
							<IconPencil class="w-4 h-4" />
						</button>
					</HoverTooltip>
				</div>

				{#if createFieldErrors['leagues']}
					<p class="text-xs text-error-700">{createFieldErrors['leagues']}</p>
				{/if}

				{#if createForm.leagues.length === 0}
					<p class="text-sm text-neutral-950 font-sans">
						No {wizardUnitPlural()} will be created.
					</p>
				{:else}
					<div
						class="space-y-3 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400 scrollbar-corner-secondary-500 hover:scrollbar-thumb-secondary-700 active:scrollbar-thumb-secondary-700 scrollbar-hover:scrollbar-thumb-secondary-800 scrollbar-active:scrollbar-thumb-secondary-700"
					>
						{#each createForm.leagues as league}
							<div class="border border-neutral-950 bg-neutral p-3 space-y-2">
								<div>
									<div>
										<p class="text-sm font-semibold text-neutral-950">
											{league.name.trim() || 'Untitled League'}
										</p>
										<p class="text-xs text-neutral-900">Slug: {league.slug || 'TBD'}</p>
									</div>
								</div>
								<div
									class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-950"
								>
									<p>
										<span class="font-semibold">Season:</span>
										{getSeasonLabel(league.seasonId)}
									</p>
									<p>
										<span class="font-semibold">Gender:</span>
										{normalizeGender(league.gender) ?? 'Unspecified'}
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
										<DateHoverText
											display={formatReviewRange(league.regStartDate, league.regEndDate, true)}
											value={league.regStartDate}
											endValue={league.regEndDate}
											includeTime
											textClass="ml-1"
										/>
									</p>
									<p class="sm:col-span-2">
										<span class="font-semibold">Season Dates:</span>
										<DateHoverText
											display={formatReviewRange(league.seasonStartDate, league.seasonEndDate)}
											value={league.seasonStartDate}
											endValue={league.seasonEndDate}
											textClass="ml-1"
										/>
									</p>
									{#if league.hasPreseason}
										<p class="sm:col-span-2">
											<span class="font-semibold">Preseason:</span>
											<DateHoverText
												display={formatReviewRange(
													league.preseasonStartDate,
													league.preseasonEndDate
												)}
												value={league.preseasonStartDate}
												endValue={league.preseasonEndDate}
												textClass="ml-1"
											/>
										</p>
									{/if}
									{#if league.hasPostseason}
										<p class="sm:col-span-2">
											<span class="font-semibold">Postseason:</span>
											<DateHoverText
												display={formatReviewRange(
													league.postseasonStartDate,
													league.postseasonEndDate
												)}
												value={league.postseasonStartDate}
												endValue={league.postseasonEndDate}
												textClass="ml-1"
											/>
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
			step={createStepDisplay}
			lastStep={createVisibleSteps.length}
			showBack={createStep > 1}
			canGoNext={canGoNextStep}
			canSubmit={canSubmitCreate}
			nextLabel={createStep === 4 && !leagueDraftActive
				? createForm.leagues.length === 0
					? 'Skip to Review'
					: 'Review'
				: createStep === 5 && leagueDraftActive
					? leagueEditingIndex === null
						? `Add ${wizardUnitTitleSingular()}`
						: `Update ${wizardUnitTitleSingular()}`
					: 'Next'}
			submitLabel="Create"
			submittingLabel="Creating..."
			isSubmitting={createSubmitting}
			on:back={handleCreateBackAction}
			on:next={nextCreateStep}
		/>
	{/snippet}
</CreateOfferingWizard>

<style>
	:global(tr.league-row-highlight > th),
	:global(tr.league-row-highlight > td) {
		animation: league-row-highlight-fade 3s linear;
	}

	:global(article.offering-article-highlight .offering-table-highlight-surface tbody tr > th),
	:global(article.offering-article-highlight .offering-table-highlight-surface tbody tr > td) {
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
