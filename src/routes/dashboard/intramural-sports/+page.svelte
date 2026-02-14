<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { onDestroy, tick } from 'svelte';
	import type { PageData } from './$types';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconBallAmericanFootball from '@tabler/icons-svelte/icons/ball-american-football';
	import IconBallBaseball from '@tabler/icons-svelte/icons/ball-baseball';
	import IconBallBasketball from '@tabler/icons-svelte/icons/ball-basketball';
	import IconBallFootball from '@tabler/icons-svelte/icons/ball-football';
	import IconBallTennis from '@tabler/icons-svelte/icons/ball-tennis';
	import IconBallVolleyball from '@tabler/icons-svelte/icons/ball-volleyball';
	import IconArrowDown from '@tabler/icons-svelte/icons/arrow-down';
	import IconArrowUp from '@tabler/icons-svelte/icons/arrow-up';
	import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down';
	import IconChevronUp from '@tabler/icons-svelte/icons/chevron-up';
	import IconCalendar from '@tabler/icons-svelte/icons/calendar';
	import IconCopy from '@tabler/icons-svelte/icons/copy';
	import IconCrosshair from '@tabler/icons-svelte/icons/crosshair';
	import IconPencil from '@tabler/icons-svelte/icons/pencil';
	import IconPlus from '@tabler/icons-svelte/icons/plus';
	import IconSearch from '@tabler/icons-svelte/icons/search';
	import IconShip from '@tabler/icons-svelte/icons/ship';
	import IconTarget from '@tabler/icons-svelte/icons/target';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import IconX from '@tabler/icons-svelte/icons/x';

	type Activity = PageData['activities'][number];
	type LeagueOfferingOption = PageData['leagueOfferingOptions'][number];
	type LeagueTemplate = PageData['leagueTemplates'][number];
	type OfferingStatus = 'open' | 'waitlisted' | 'closed';

	interface LeagueOffering {
		id: string;
		leagueName: string;
		stackOrder: number;
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
	type LeagueWizardStep = 1 | 2 | 3 | 4;
	type LeagueChoice = 'yes' | 'no';
	type LeagueGender = '' | 'male' | 'female' | 'mixed';
	type LeagueSkillLevel = '' | 'competitive' | 'intermediate' | 'recreational' | 'all';

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
		draftId: string;
		name: string;
		slug: string;
		stackOrder: number;
		isSlugManual: boolean;
		description: string;
		season: string;
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

	const TERM_ORDER: Record<string, number> = {
		spring: 0,
		summer: 1,
		fall: 2,
		winter: 3
	};
	const OFFERING_VIEW_STORAGE_KEY = 'intramural-offerings-view-mode';
	const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
	const DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
	const currentYear = new Date().getFullYear();
	const seasonPlaceholder =
		new Date().getMonth() <= 5 ? `Spring ${currentYear}` : `Fall ${currentYear}`;
	const WIZARD_STEP_TITLES: Record<WizardStep, string> = {
		1: 'Offering Basics',
		2: 'Offering Setup',
		3: 'League Options',
		4: 'League Schedule',
		5: 'Review & Create'
	};
	let { data } = $props<{ data: PageData }>();

	let activities = $state<Activity[]>([]);
	let leagueTemplates = $state<LeagueTemplate[]>([]);
	let searchQuery = $state('');
	let showConcludedSeasons = $state(false);
	let offeringView = $state<OfferingView>('all');
	let offeringViewHydrated = $state(false);
	let highlightedLeagueRowId = $state<string | null>(null);
	let highlightTimeout: ReturnType<typeof setTimeout> | null = null;
	let addActionMenuOpen = $state(false);
	let addActionMenuContainer = $state<HTMLDivElement | null>(null);
	let isCreateModalOpen = $state(false);
	let createStep = $state<WizardStep>(1);
	let createSubmitting = $state(false);
	let createFormError = $state('');
	let createSuccessMessage = $state('');
	let offeringSlugTouched = $state(false);
	let leagueSlugTouched = $state(false);
	let leagueEditingIndex = $state<number | null>(null);
	let leagueDraftActive = $state(false);
	let createModalPointerDownStartedInside = $state(false);
	let serverFieldErrors = $state<Record<string, string>>({});
	let isCreateLeagueModalOpen = $state(false);
	let createLeagueStep = $state<LeagueWizardStep>(1);
	let createLeagueSubmitting = $state(false);
	let createLeagueFormError = $state('');
	let createLeagueOfferingFilter = $state<'league' | 'tournament' | 'all'>('all');
	let createLeagueEditingIndex = $state<number | null>(null);
	let createLeagueDraftActive = $state(false);
	let createLeagueSlugTouched = $state(false);
	let createLeagueCopiedFromExisting = $state(false);
	let createLeagueModalPointerDownStartedInside = $state(false);
	let createLeagueServerFieldErrors = $state<Record<string, string>>({});
	let createLeagueForm = $state<LeagueWizardFormState>(createEmptyCreateLeagueForm());

	$effect(() => {
		if (typeof document === 'undefined') return;
		if (!isCreateModalOpen && !isCreateLeagueModalOpen) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	function padTwo(value: number): string {
		return String(value).padStart(2, '0');
	}

	function todayDateString(): string {
		const now = new Date();
		return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
	}

	function defaultDateTimeValue(type: 'start' | 'end'): string {
		return `${todayDateString()}T${type === 'start' ? '00:00' : '23:59'}`;
	}

	function defaultLeagueSlug(leagueName: string, offeringName: string): string {
		return slugifyFinal(`${leagueName} ${offeringName}`);
	}

	function createLeagueDraftId(): string {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `league-draft-${Math.random().toString(36).slice(2, 10)}`;
	}

	function createEmptyLeague(): WizardLeagueInput {
		return {
			draftId: createLeagueDraftId(),
			name: '',
			slug: '',
			stackOrder: 1,
			isSlugManual: false,
			description: '',
			season: '',
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

	function createEmptyCreateForm(): WizardFormState {
		return {
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
		if (step === 3) return isTournamentWizard() ? 'Tournament Groups' : 'League Options';
		if (step === 4) return isTournamentWizard() ? 'Tournament Schedule' : 'League Schedule';
		return WIZARD_STEP_TITLES[step];
	}

	function addEntryActionLabel(): 'Add League' | 'Add Group' | 'Add League/Group' {
		if (offeringView === 'tournaments') return 'Add Group';
		if (offeringView === 'all') return 'Add League/Group';
		return 'Add League';
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
		return 'Review & Create';
	}

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

	$effect(() => {
		leagueTemplates = [...(data.leagueTemplates ?? [])];
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

	function closeAddActionMenu(): void {
		addActionMenuOpen = false;
	}

	function toggleAddActionMenu(): void {
		addActionMenuOpen = !addActionMenuOpen;
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		if (!addActionMenuOpen) return;

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (!target) return;
			if (addActionMenuContainer?.contains(target)) return;
			closeAddActionMenu();
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeAddActionMenu();
		};

		window.addEventListener('pointerdown', handlePointerDown);
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('pointerdown', handlePointerDown);
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	function resetCreateWizard(): void {
		createStep = 1;
		createSubmitting = false;
		createFormError = '';
		offeringSlugTouched = false;
		leagueSlugTouched = false;
		leagueEditingIndex = null;
		leagueDraftActive = false;
		serverFieldErrors = {};
		createForm = createEmptyCreateForm();
	}

	function resetCreateLeagueWizard(): void {
		createLeagueStep = 1;
		createLeagueSubmitting = false;
		createLeagueFormError = '';
		createLeagueEditingIndex = null;
		createLeagueDraftActive = false;
		createLeagueSlugTouched = false;
		createLeagueCopiedFromExisting = false;
		createLeagueServerFieldErrors = {};
		createLeagueForm = createEmptyCreateLeagueForm();
	}

	function openCreateWizard(): void {
		closeAddActionMenu();
		resetCreateWizard();
		isCreateModalOpen = true;
	}

	function openCreateLeagueWizard(): void {
		closeAddActionMenu();
		resetCreateLeagueWizard();
		createLeagueOfferingFilter =
			offeringView === 'tournaments' ? 'tournament' : offeringView === 'leagues' ? 'league' : 'all';
		isCreateLeagueModalOpen = true;
	}

	function closeCreateWizard(): void {
		isCreateModalOpen = false;
		createModalPointerDownStartedInside = false;
		resetCreateWizard();
	}

	function closeCreateLeagueWizard(): void {
		isCreateLeagueModalOpen = false;
		createLeagueModalPointerDownStartedInside = false;
		resetCreateLeagueWizard();
	}

	function hasOfferingDraftData(values: WizardOfferingInput): boolean {
		return (
			values.name.trim().length > 0 ||
			values.slug.trim().length > 0 ||
			values.imageUrl.trim().length > 0 ||
			values.minPlayers > 0 ||
			values.maxPlayers > 0 ||
			values.rulebookUrl.trim().length > 0 ||
			values.sport.trim().length > 0 ||
			values.type !== 'league' ||
			values.description.trim().length > 0 ||
			!values.isActive
		);
	}

	function hasLeagueDraftData(values: WizardLeagueInput): boolean {
		return (
			values.name.trim().length > 0 ||
			values.slug.trim().length > 0 ||
			values.description.trim().length > 0 ||
			values.season.trim().length > 0 ||
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

	function hasUnsavedCreateWizardChanges(): boolean {
		return (
			hasOfferingDraftData(createForm.offering) ||
			leagueDraftActive ||
			(leagueDraftActive && hasLeagueDraftData(createForm.league)) ||
			createForm.leagues.length > 0
		);
	}

	function hasUnsavedCreateLeagueWizardChanges(): boolean {
		return (
			createLeagueForm.offeringId.trim().length > 0 ||
			createLeagueDraftActive ||
			(createLeagueDraftActive && hasLeagueDraftData(createLeagueForm.league)) ||
			createLeagueForm.leagues.length > 0
		);
	}

	function requestCloseCreateWizard(): void {
		if (!isCreateModalOpen) return;
		if (createSubmitting) return;
		if (!hasUnsavedCreateWizardChanges()) {
			closeCreateWizard();
			return;
		}

		if (typeof window !== 'undefined') {
			const confirmed = window.confirm(
				'You have unsaved changes in this wizard. Close without saving?'
			);
			if (!confirmed) return;
		}

		closeCreateWizard();
	}

	function requestCloseCreateLeagueWizard(): void {
		if (!isCreateLeagueModalOpen) return;
		if (createLeagueSubmitting) return;
		if (!hasUnsavedCreateLeagueWizardChanges()) {
			closeCreateLeagueWizard();
			return;
		}

		if (typeof window !== 'undefined') {
			const confirmed = window.confirm(
				'You have unsaved changes in this wizard. Close without saving?'
			);
			if (!confirmed) return;
		}

		closeCreateLeagueWizard();
	}

	function handleCreateModalPointerDown(event: PointerEvent): void {
		createModalPointerDownStartedInside = event.target !== event.currentTarget;
	}

	function handleCreateModalBackdropClick(event: MouseEvent): void {
		if (event.target !== event.currentTarget) return;
		if (createModalPointerDownStartedInside) {
			createModalPointerDownStartedInside = false;
			return;
		}
		requestCloseCreateWizard();
	}

	function handleCreateLeagueModalPointerDown(event: PointerEvent): void {
		createLeagueModalPointerDownStartedInside = event.target !== event.currentTarget;
	}

	function handleCreateLeagueModalBackdropClick(event: MouseEvent): void {
		if (event.target !== event.currentTarget) return;
		if (createLeagueModalPointerDownStartedInside) {
			createLeagueModalPointerDownStartedInside = false;
			return;
		}
		requestCloseCreateLeagueWizard();
	}

	function clearCreateApiErrors(): void {
		if (Object.keys(serverFieldErrors).length > 0) {
			serverFieldErrors = {};
		}
		if (createFormError) {
			createFormError = '';
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

	$effect(() => {
		if (typeof window === 'undefined') return;
		const hasUnsavedCreateOfferingChanges = isCreateModalOpen && hasUnsavedCreateWizardChanges();
		const hasUnsavedCreateLeagueChanges =
			isCreateLeagueModalOpen && hasUnsavedCreateLeagueWizardChanges();
		if (!hasUnsavedCreateOfferingChanges && !hasUnsavedCreateLeagueChanges) return;

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

	function pickFieldErrors(
		errors: Record<string, string>,
		fieldKeys: string[]
	): Record<string, string> {
		const subset: Record<string, string> = {};
		for (const key of fieldKeys) {
			if (errors[key]) subset[key] = errors[key];
		}
		return subset;
	}

	function getOfferingFieldErrors(values: WizardOfferingInput): Record<string, string> {
		const errors: Record<string, string> = {};
		const name = values.name.trim();
		const slug = slugifyFinal(values.slug);
		const sport = values.sport.trim();
		const imageUrl = values.imageUrl.trim();
		const rulebookUrl = values.rulebookUrl.trim();

		if (!name) errors['offering.name'] = 'Offering name is required.';
		if (!slug) errors['offering.slug'] = 'Offering slug is required.';
		if (!sport) errors['offering.sport'] = 'Sport is required.';
		if (!values.type) errors['offering.type'] = 'Type is required.';

		if (imageUrl && !isValidUrl(imageUrl)) {
			errors['offering.imageUrl'] = 'Enter a valid image URL.';
		}

		if (rulebookUrl && !isValidUrl(rulebookUrl)) {
			errors['offering.rulebookUrl'] = 'Enter a valid rulebook URL.';
		}

		const hasMinPlayers = values.minPlayers > 0;
		const hasMaxPlayers = values.maxPlayers > 0;

		if (hasMinPlayers && (!Number.isInteger(values.minPlayers) || values.minPlayers < 1)) {
			errors['offering.minPlayers'] = 'Min Players must be at least 1.';
		}

		if (hasMaxPlayers && (!Number.isInteger(values.maxPlayers) || values.maxPlayers < 1)) {
			errors['offering.maxPlayers'] = 'Max Players must be at least 1.';
		}

		if (hasMinPlayers && hasMaxPlayers && values.minPlayers > values.maxPlayers) {
			errors['offering.maxPlayers'] = 'Max Players must be greater than or equal to Min Players.';
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
		const leagueSeason = values.season.trim();
		const leagueImageUrl = values.imageUrl.trim();

		if (!leagueName) errors[`${prefix}.name`] = 'League name is required.';
		if (!leagueSlug) errors[`${prefix}.slug`] = 'League slug is required.';
		if (!leagueSeason) errors[`${prefix}.season`] = 'Season is required.';

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

	function getCurrentStepClientErrors(
		values: WizardFormState,
		step: WizardStep
	): Record<string, string> {
		if (step === 1) {
			return pickFieldErrors(getOfferingFieldErrors(values.offering), [
				'offering.name',
				'offering.slug',
				'offering.sport',
				'offering.type',
				'offering.description'
			]);
		}

		if (step === 2) {
			return pickFieldErrors(getOfferingFieldErrors(values.offering), [
				'offering.imageUrl',
				'offering.minPlayers',
				'offering.maxPlayers',
				'offering.rulebookUrl'
			]);
		}

		if (step === 3) {
			if (!leagueDraftActive) return {};
			return pickFieldErrors(getLeagueFieldErrors(values.league), [
				'league.name',
				'league.slug',
				'league.description',
				'league.season',
				'league.gender',
				'league.skillLevel'
			]);
		}

		if (step === 4) {
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
		}

		return errors;
	}

	function firstInvalidStep(errors: Record<string, string>): WizardStep {
		const keys = Object.keys(errors);
		if (
			keys.some((key) =>
				['offering.name', 'offering.slug', 'offering.sport', 'offering.type'].includes(key)
			)
		) {
			return 1;
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
			return 2;
		}
		if (
			keys.some((key) =>
				[
					'league.name',
					'league.slug',
					'league.description',
					'league.season',
					'league.gender',
					'league.skillLevel'
				].includes(key)
			)
		) {
			return 3;
		}
		if (keys.some((key) => key.startsWith('league.'))) {
			return 4;
		}
		return 5;
	}

	function isRequiredFieldMessage(message: string): boolean {
		const normalized = message.trim().toLowerCase();
		return normalized.endsWith(' is required.') || normalized === 'required.';
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
			season: league.season.trim(),
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
			...getCurrentStepClientErrors(createForm, 3),
			...getCurrentStepClientErrors(createForm, 4)
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
			season: createForm.league.season.trim(),
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
			stackOrder: createForm.leagues.length + 1
		};
		createForm.addLeagues = 'yes';
		leagueDraftActive = true;
		createStep = 3;
	}

	function cancelLeagueDraft(): void {
		leagueEditingIndex = null;
		leagueSlugTouched = false;
		leagueDraftActive = false;
		createForm.league = createEmptyLeague();
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
		createStep = 3;
	}

	function startEditingOffering(): void {
		clearCreateApiErrors();
		createStep = 1;
	}

	function startEditingLeagues(): void {
		clearCreateApiErrors();
		createStep = 3;
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
		const nextLeagues = [...createForm.leagues];
		nextLeagues.splice(index + 1, 0, duplicate);
		createForm.leagues = normalizeLeagueStackOrder(nextLeagues);
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

		const reordered = [...createForm.leagues];
		const current = reordered[index];
		const target = reordered[targetIndex];
		if (!current || !target) return;

		reordered[index] = target;
		reordered[targetIndex] = current;
		createForm.leagues = normalizeLeagueStackOrder(reordered);

		if (leagueEditingIndex !== null) {
			if (leagueEditingIndex === index) {
				leagueEditingIndex = targetIndex;
			} else if (leagueEditingIndex === targetIndex) {
				leagueEditingIndex = index;
			}
		}
	}

	function removeLeague(index: number): void {
		if (!createForm.leagues[index]) return;
		createForm.leagues = normalizeLeagueStackOrder(
			createForm.leagues.filter((_, leagueIndex) => leagueIndex !== index)
		);
		if (leagueEditingIndex !== null) {
			if (leagueEditingIndex === index) {
				cancelLeagueDraft();
				return;
			}
			if (leagueEditingIndex > index) {
				leagueEditingIndex -= 1;
			}
		}
		if (createForm.leagues.length === 0) {
			createForm.addLeagues = 'no';
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
				name: createForm.offering.name.trim(),
				slug: slugifyFinal(createForm.offering.slug),
				isActive: createForm.offering.isActive,
				imageUrl: normalizeOptionalUrlForRequest(createForm.offering.imageUrl),
				minPlayers: normalizePlayerCountForRequest(createForm.offering.minPlayers),
				maxPlayers: normalizePlayerCountForRequest(createForm.offering.maxPlayers),
				rulebookUrl: normalizeOptionalUrlForRequest(createForm.offering.rulebookUrl),
				sport: createForm.offering.sport.trim(),
				type: createForm.offering.type,
				description: normalizeOptionalTextForRequest(createForm.offering.description)
			},
			leagues: createForm.leagues.map(mapLeagueForRequest)
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

			activities = [...body.data.activities, ...activities];
			searchQuery = '';
			const createdLeagueCount = body.data.leagueIds.length;
			createSuccessMessage =
				createdLeagueCount > 0
					? `Offering and ${createdLeagueCount} ${pluralize(createdLeagueCount, 'league', 'leagues')} created successfully.`
					: 'Offering created successfully.';
			closeCreateWizard();
		} catch {
			createFormError = 'Unable to save offering right now.';
		} finally {
			createSubmitting = false;
		}
	}

	function getLeagueOfferingById(offeringId: string): LeagueOfferingOption | null {
		const selectedOffering = data.leagueOfferingOptions.find(
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
			season: template.season ?? '',
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
			name: league.name.trim() || 'Untitled League',
			slug: slugifyFinal(league.slug),
			description: normalizeOptionalTextForRequest(league.description),
			season: league.season.trim() || null,
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
			season: createLeagueForm.league.season.trim(),
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
					defaultLeagueSlug(sourceLeague.name, getLeagueOfferingById(createLeagueForm.offeringId)?.name || '');
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
		const existingSlugs = new Set(createLeagueForm.leagues.map((league) => slugifyFinal(league.slug)));
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
		const nextLeagues = [...createLeagueForm.leagues];
		nextLeagues.splice(index + 1, 0, duplicate);
		createLeagueForm.leagues = normalizeLeagueStackOrder(nextLeagues);
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

		const reordered = [...createLeagueForm.leagues];
		const current = reordered[index];
		const target = reordered[targetIndex];
		if (!current || !target) return;

		reordered[index] = target;
		reordered[targetIndex] = current;
		createLeagueForm.leagues = normalizeLeagueStackOrder(reordered);

		if (createLeagueEditingIndex !== null) {
			if (createLeagueEditingIndex === index) {
				createLeagueEditingIndex = targetIndex;
			} else if (createLeagueEditingIndex === targetIndex) {
				createLeagueEditingIndex = index;
			}
		}
	}

	function removeCreateLeague(index: number): void {
		if (!createLeagueForm.leagues[index]) return;
		createLeagueForm.leagues = normalizeLeagueStackOrder(
			createLeagueForm.leagues.filter((_, leagueIndex) => leagueIndex !== index)
		);
		if (createLeagueForm.leagues.length === 0) {
			createLeagueCopiedFromExisting = false;
		}
		if (createLeagueEditingIndex !== null) {
			if (createLeagueEditingIndex === index) {
				cancelCreateLeagueDraft();
				return;
			}
			if (createLeagueEditingIndex > index) {
				createLeagueEditingIndex -= 1;
			}
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
				'league.season',
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
					'league.season',
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
		if (createLeagueStep === 4 || !canGoNextCreateLeagueStep) return;

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

	function slugifyFinal(value: string): string {
		return value
			.toLowerCase()
			.trim()
			.replace(/['"]/g, '')
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function slugifyLiveWithCursor(
		input: string,
		cursorIndex: number
	): { value: string; cursor: number } {
		let output = '';
		let outputCursor = 0;

		for (let index = 0; index < input.length; index++) {
			const character = input[index] ?? '';
			const beforeCursor = index < cursorIndex;

			let next = '';
			if (/[A-Za-z0-9]/.test(character)) next = character.toLowerCase();
			else if (character === ' ' || character === '-') next = '-';

			if (next === '-') {
				if (output.length === 0) {
					next = '';
				} else if (output.endsWith('-')) {
					next = '';
				}
			}

			if (next) {
				output += next;
				if (beforeCursor) outputCursor += next.length;
			}
		}

		return { value: output, cursor: outputCursor };
	}

	function applyLiveSlugInput(element: HTMLInputElement): string {
		const cursor = element.selectionStart ?? element.value.length;
		const { value, cursor: nextCursor } = slugifyLiveWithCursor(element.value, cursor);
		element.value = value;
		element.setSelectionRange(nextCursor, nextCursor);
		return value;
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
					offeringSlug: `offering-${slugifyFinal(offeringName)}-${activity.offeringType}-${semester.key}`,
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
				stackOrder: activity.stackOrder ?? Number.MAX_SAFE_INTEGER,
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
	const addEntryOptionCount = $derived.by(() => {
		const filter =
			offeringView === 'tournaments' ? 'tournament' : offeringView === 'leagues' ? 'league' : 'all';
		return data.leagueOfferingOptions.filter((offering: LeagueOfferingOption) =>
			filter === 'all' ? true : offering.type === filter
		).length;
	});
	const createLeagueOfferingOptions = $derived.by(() =>
		data.leagueOfferingOptions.filter((offering: LeagueOfferingOption) =>
			createLeagueOfferingFilter === 'all' ? true : offering.type === createLeagueOfferingFilter
		)
	);
	const selectedLeagueWizardOffering = $derived.by(() =>
		getLeagueOfferingById(createLeagueForm.offeringId)
	);
	const selectedOfferingLeagueTemplates = $derived.by(() =>
		leagueTemplates
			.filter((league: LeagueTemplate) => league.offeringId === createLeagueForm.offeringId)
			.sort((a: LeagueTemplate, b: LeagueTemplate) => {
				const orderDiff = (a.stackOrder ?? Number.MAX_SAFE_INTEGER) - (b.stackOrder ?? Number.MAX_SAFE_INTEGER);
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
	const canGoNextStep = $derived.by(
		() => createStep < 5 && Object.keys(clientCreateFieldErrors).length === 0 && !createSubmitting
	);
	const canSubmitCreate = $derived.by(
		() =>
			createStep === 5 &&
			Object.keys(getSubmitClientErrors(createForm)).length === 0 &&
			Object.keys(serverFieldErrors).length === 0 &&
			!createSubmitting
	);
	const createStepProgress = $derived.by(() => Math.round((createStep / 5) * 100));

	function nextCreateStep(): void {
		clearCreateApiErrors();
		if (createStep === 5 || !canGoNextStep) return;

		if (createStep === 3) {
			createStep = leagueDraftActive ? 4 : 5;
			return;
		}

		if (createStep === 4) {
			if (!leagueDraftActive) {
				createStep = 3;
				return;
			}
			if (!addOrUpdateDraftLeague()) return;
			createStep = 3;
			return;
		}

		createStep = (createStep + 1) as WizardStep;
	}

	function previousCreateStep(): void {
		clearCreateApiErrors();
		if (createStep === 1) return;

		if (createStep === 5) {
			createStep = leagueDraftActive ? 4 : 3;
			return;
		}

		createStep = (createStep - 1) as WizardStep;
	}

	function handleCreateBackAction(): void {
		if (leagueDraftActive && (createStep === 3 || createStep === 4)) {
			cancelLeagueDraft();
			createStep = 3;
			return;
		}
		previousCreateStep();
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
		<div class="flex items-start gap-4">
			<div
				class="bg-primary text-white w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
				aria-hidden="true"
			>
				<IconBallFootball class="w-7 h-7 lg:w-8 lg:h-8" />
			</div>
			<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
				Intramural Sports
			</h1>
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
				<div class="mt-4">
					<div class="relative inline-flex items-stretch" bind:this={addActionMenuContainer}>
						<button
							type="button"
							class="button-primary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer"
							onclick={openCreateWizard}
						>
							+ ADD
						</button>
						<button
							type="button"
							class="button-primary-outlined -ml-[2px] px-1 py-2 cursor-pointer"
							aria-label="Open add menu"
							aria-haspopup="menu"
							aria-expanded={addActionMenuOpen}
							onclick={toggleAddActionMenu}
						>
							<IconChevronDown class="w-4 h-4" />
						</button>

						{#if addActionMenuOpen}
							<div
								class="absolute right-0 top-full mt-1 w-44 border-2 border-secondary-300 bg-white z-20"
								role="menu"
								aria-label="Create options"
							>
								<button
									type="button"
									class="w-full text-left px-3 py-2 text-sm text-neutral-950 hover:bg-neutral-100 cursor-pointer border-b border-secondary-200"
									role="menuitem"
									onclick={openCreateWizard}
								>
									Add Offering
								</button>
								<button
									type="button"
									class="w-full text-left px-3 py-2 text-sm text-neutral-950 hover:bg-neutral-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
									role="menuitem"
									onclick={openCreateLeagueWizard}
									disabled={addEntryOptionCount === 0}
								>
									{addEntryActionLabel()}
								</button>
								{#if addEntryOptionCount === 0}
									<p class="px-3 pb-2 text-xs text-neutral-900 text-left">
										No matching offerings available for this view.
									</p>
								{/if}
							</div>
						{/if}
					</div>
				</div>
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
							<div class="relative inline-flex items-stretch" bind:this={addActionMenuContainer}>
								<button
									type="button"
									class="button-primary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer"
									onclick={openCreateWizard}
								>
									+ ADD
								</button>
								<button
									type="button"
									class="button-primary-outlined -ml-[2px] px-1 py-1 cursor-pointer"
									aria-label="Open add menu"
									aria-haspopup="menu"
									aria-expanded={addActionMenuOpen}
									onclick={toggleAddActionMenu}
								>
									<IconChevronDown class="w-4 h-4" />
								</button>

								{#if addActionMenuOpen}
									<div
										class="absolute right-0 top-full mt-1 w-44 border-2 border-secondary-300 bg-white z-20"
										role="menu"
										aria-label="Create options"
									>
										<button
											type="button"
											class="w-full text-left px-3 py-2 text-sm text-neutral-950 hover:bg-neutral-100 cursor-pointer border-b border-secondary-200"
											role="menuitem"
											onclick={openCreateWizard}
										>
											Add Offering
										</button>
										<button
											type="button"
											class="w-full text-left px-3 py-2 text-sm text-neutral-950 hover:bg-neutral-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
											role="menuitem"
											onclick={openCreateLeagueWizard}
											disabled={addEntryOptionCount === 0}
										>
											{addEntryActionLabel()}
										</button>
										{#if addEntryOptionCount === 0}
											<p class="px-3 pb-2 text-xs text-neutral-900 text-left">
												No matching offerings available for this view.
											</p>
										{/if}
									</div>
								{/if}
							</div>
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

{#if isCreateLeagueModalOpen}
	<div
		class="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4 lg:p-6 overflow-hidden"
		onpointerdown={handleCreateLeagueModalPointerDown}
		onclick={handleCreateLeagueModalBackdropClick}
		onkeydown={(event) => {
			if (event.key === 'Escape') requestCloseCreateLeagueWizard();
		}}
		role="button"
		tabindex="0"
		aria-label="Close create league modal"
	>
		<div
			class="w-full max-w-4xl max-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-3rem)] border-4 border-secondary bg-neutral-400 overflow-hidden flex flex-col"
			onclick={(event) => event.stopPropagation()}
			role="presentation"
		>
			<div class="p-4 border-b border-secondary space-y-3">
				<div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<h2 class="text-3xl font-bold font-serif text-neutral-950">
							New {wizardEntryUnitTitleSingular()}
						</h2>
						<p class="text-sm font-sans text-neutral-950">
							Step {createLeagueStep} of 4: {createLeagueStepTitle(createLeagueStep)}
						</p>
					</div>
					<button
						type="button"
						class="p-1 text-neutral-950 hover:text-secondary-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500"
						aria-label="Close create league modal"
						onclick={requestCloseCreateLeagueWizard}
					>
						<IconX class="w-6 h-6" />
					</button>
				</div>
				<div class="border border-secondary-300 bg-white h-3">
					<div class="h-full bg-secondary" style={`width: ${createLeagueStepProgress}%`}></div>
				</div>
			</div>

			<form
				class={`p-4 space-y-5 flex-1 min-h-0 ${
					createLeagueStep === 2 && !createLeagueDraftActive ? 'overflow-hidden' : 'overflow-y-auto'
				}`}
				onsubmit={(event) => {
					event.preventDefault();
					void submitCreateLeagueWizard();
				}}
				oninput={clearCreateLeagueApiErrors}
			>
				{#if createLeagueFormError}
					<div class="border-2 border-error-300 bg-error-50 p-3">
						<p class="text-error-800 text-sm font-sans">{createLeagueFormError}</p>
					</div>
				{/if}

				{#if createLeagueStep === 1}
					<div class="space-y-4">
						{#if createLeagueOfferingOptions.length === 0}
							<div class="border-2 border-secondary-300 bg-white p-4 space-y-3">
								<p class="text-sm text-neutral-950">
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
								<label
									for="league-wizard-offering"
									class="block text-sm font-sans text-neutral-950 mb-1"
								>
									{wizardEntryUnitTitleSingular()} Offering <span class="text-error-700">*</span>
								</label>
								<select
									id="league-wizard-offering"
									class="select-secondary"
									value={createLeagueForm.offeringId}
									onchange={(event) => {
										const offeringId = (event.currentTarget as HTMLSelectElement).value;
										if (
											offeringId !== createLeagueForm.offeringId &&
											(createLeagueForm.leagues.length > 0 || createLeagueDraftActive)
										) {
											const confirmed =
												typeof window === 'undefined'
													? true
													: window.confirm(
															'Switching offerings clears your in-progress league/group list. Continue?'
														);
											if (!confirmed) {
												(event.currentTarget as HTMLSelectElement).value = createLeagueForm.offeringId;
												return;
											}
											createLeagueForm.leagues = [];
											cancelCreateLeagueDraft();
											createLeagueCopiedFromExisting = false;
										}

										createLeagueForm.offeringId = offeringId;
										if (!createLeagueSlugTouched) {
											const offeringName = getLeagueOfferingById(offeringId)?.name ?? '';
											createLeagueForm.league.slug = defaultLeagueSlug(
												createLeagueForm.league.name,
												offeringName
											);
										}
									}}
								>
									<option value="">Select an offering...</option>
									{#each createLeagueOfferingOptions as offeringOption}
										<option value={offeringOption.id}>{offeringOption.name}</option>
									{/each}
								</select>
								{#if createLeagueFieldErrors['offeringId']}
									<p class="text-xs text-error-700 mt-1">{createLeagueFieldErrors['offeringId']}</p>
								{/if}
							</div>

							{#if selectedLeagueWizardOffering}
								<div
									class="border border-secondary-300 bg-white p-3 text-sm text-neutral-950 space-y-2"
								>
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
												class="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400"
											>
												{#each selectedOfferingLeagueTemplates as existingLeague}
													<div class="border border-secondary-300 bg-white p-2 flex items-center justify-between gap-3">
														<div class="min-w-0">
															<p class="text-sm font-semibold text-neutral-950 truncate">
																{existingLeague.name}
															</p>
															<p class="text-xs text-neutral-900">
																{existingLeague.season || 'Unscheduled'}
															</p>
														</div>
														<button
															type="button"
															class="button-secondary-outlined p-1.5 cursor-pointer shrink-0"
															title={`Copy ${wizardEntryUnitSingular()} settings`}
															aria-label={`Copy ${existingLeague.name}`}
															onclick={() => {
																copyFromExistingLeagueTemplate(existingLeague);
															}}
														>
															<IconCopy class="w-4 h-4" />
														</button>
													</div>
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
							<div class="border border-secondary-300 bg-white p-3 text-sm text-neutral-950">
								Adding to
								<span class="font-semibold">{selectedLeagueWizardOffering.name}</span>
							</div>
						{/if}
						{#if !createLeagueDraftActive}
							<div class="border border-secondary-300 bg-white p-3 space-y-3">
								<div class="flex items-center justify-between gap-2">
									<h3 class="text-sm font-bold font-sans text-neutral-950 uppercase tracking-wide">
										{wizardEntryType() === 'tournament' ? 'Tournament Groups' : 'Leagues'}
									</h3>
									<button
										type="button"
										class="button-secondary-outlined p-1.5 cursor-pointer"
										aria-label={`Add ${wizardEntryUnitSingular()}`}
										title={`Add ${wizardEntryUnitSingular()}`}
										onclick={startAddingCreateLeagueDraft}
									>
										<IconPlus class="w-4 h-4" />
									</button>
								</div>

								{#if createLeagueFieldErrors['leagues']}
									<p class="text-xs text-error-700">{createLeagueFieldErrors['leagues']}</p>
								{/if}

								{#if createLeagueForm.leagues.length === 0 && !createLeagueDraftActive}
									<p class="text-sm text-neutral-950 font-sans">
										No {wizardEntryUnitPlural()} added yet. Use the plus button to add one, or continue
										without {wizardEntryUnitPlural()}.
									</p>
								{:else if createLeagueForm.leagues.length > 0}
									<div
										class="space-y-2 max-h-[52vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400 scrollbar-corner-secondary-500 hover:scrollbar-thumb-secondary-700 active:scrollbar-thumb-secondary-700 scrollbar-hover:scrollbar-thumb-secondary-800 scrollbar-active:scrollbar-thumb-secondary-700"
									>
										{#each createLeagueForm.leagues as league, leagueIndex (league.draftId)}
											<div
												class="border border-secondary-300 bg-neutral p-3 space-y-2"
												animate:flip={{ duration: 180, easing: cubicOut }}
											>
												<div class="flex items-start justify-between gap-3">
													<div>
														<p class="text-sm font-semibold text-neutral-950">
															{league.name.trim() || `Untitled ${wizardEntryUnitTitleSingular()}`}
														</p>
														<p class="text-xs text-neutral-900">Slug: {league.slug || 'TBD'}</p>
													</div>
													<div class="flex items-center gap-1">
														{#if createLeagueForm.leagues.length > 1}
															{#if leagueIndex > 0}
																<button
																	type="button"
																	class="button-secondary-outlined p-1.5 cursor-pointer"
																	aria-label={`Move ${wizardEntryUnitSingular()} up`}
																	title="Move up"
																	onclick={() => {
																		moveCreateLeague(leagueIndex, 'up');
																	}}
																>
																	<IconArrowUp class="w-4 h-4" />
																</button>
															{/if}
															{#if leagueIndex < createLeagueForm.leagues.length - 1}
																<button
																	type="button"
																	class="button-secondary-outlined p-1.5 cursor-pointer"
																	aria-label={`Move ${wizardEntryUnitSingular()} down`}
																	title="Move down"
																	onclick={() => {
																		moveCreateLeague(leagueIndex, 'down');
																	}}
																>
																	<IconArrowDown class="w-4 h-4" />
																</button>
															{/if}
														{/if}
														<button
															type="button"
															class="button-secondary-outlined p-1.5 cursor-pointer"
															aria-label={`Edit ${wizardEntryUnitSingular()}`}
															title="Edit"
															onclick={() => {
																startEditingCreateLeague(leagueIndex);
															}}
														>
															<IconPencil class="w-4 h-4" />
														</button>
														<button
															type="button"
															class="button-secondary-outlined p-1.5 cursor-pointer"
															aria-label={`Copy ${wizardEntryUnitSingular()}`}
															title="Copy"
															onclick={() => {
																duplicateCreateLeague(leagueIndex);
															}}
														>
															<IconCopy class="w-4 h-4" />
														</button>
														<button
															type="button"
															class="button-secondary-outlined p-1.5 cursor-pointer"
															aria-label={`Remove ${wizardEntryUnitSingular()}`}
															title="Remove"
															onclick={() => {
																removeCreateLeague(leagueIndex);
															}}
														>
															<IconTrash class="w-4 h-4 text-error-500" />
														</button>
													</div>
												</div>
												<div
													class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-950"
												>
													<p><span class="font-semibold">Season:</span> {league.season || 'TBD'}</p>
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
														{formatReviewRange(league.regStartDate, league.regEndDate, true)}
													</p>
													<p class="sm:col-span-2">
														<span class="font-semibold">Season Dates:</span>
														{formatReviewRange(league.seasonStartDate, league.seasonEndDate)}
													</p>
													{#if league.hasPreseason}
														<p class="sm:col-span-2">
															<span class="font-semibold">Preseason:</span>
															{formatReviewRange(
																league.preseasonStartDate,
																league.preseasonEndDate
															)}
														</p>
													{/if}
													{#if league.hasPostseason}
														<p class="sm:col-span-2">
															<span class="font-semibold">Postseason:</span>
															{formatReviewRange(
																league.postseasonStartDate,
																league.postseasonEndDate
															)}
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
										placeholder={wizardEntryType() === 'tournament' ? 'Pool A' : "Men's"}
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
									<label for="league-wizard-slug" class="block text-sm font-sans text-neutral-950 mb-1"
										>Slug <span class="text-error-700">*</span></label
									>
									<input
										id="league-wizard-slug"
										type="text"
										class="input-secondary"
										value={createLeagueForm.league.slug}
										placeholder={wizardEntryType() === 'tournament' ? 'pool-a' : 'mens-soccer'}
										oninput={(event) => {
											createLeagueSlugTouched = true;
											createLeagueForm.league.isSlugManual = true;
											createLeagueForm.league.slug = applyLiveSlugInput(
												event.currentTarget as HTMLInputElement
											);
										}}
										autocomplete="off"
									/>
									{#if createLeagueFieldErrors['league.slug']}
										<p class="text-xs text-error-700 mt-1">{createLeagueFieldErrors['league.slug']}</p>
									{/if}
								</div>

								<div>
									<label for="league-wizard-season" class="block text-sm font-sans text-neutral-950 mb-1"
										>Season <span class="text-error-700">*</span></label
									>
									<input
										id="league-wizard-season"
										type="text"
										class="input-secondary"
										bind:value={createLeagueForm.league.season}
										placeholder={seasonPlaceholder}
										autocomplete="off"
									/>
									{#if createLeagueFieldErrors['league.season']}
										<p class="text-xs text-error-700 mt-1">{createLeagueFieldErrors['league.season']}</p>
									{/if}
								</div>

								<div>
									<label for="league-wizard-gender" class="block text-sm font-sans text-neutral-950 mb-1"
										>Gender</label
									>
									<select
										id="league-wizard-gender"
										class="select-secondary"
										bind:value={createLeagueForm.league.gender}
									>
										<option value="">Select...</option>
										<option value="male">Male</option>
										<option value="female">Female</option>
										<option value="mixed">Mixed</option>
									</select>
								</div>

								<div>
									<label
										for="league-wizard-skill-level"
										class="block text-sm font-sans text-neutral-950 mb-1">Skill Level</label
									>
									<select
										id="league-wizard-skill-level"
										class="select-secondary"
										bind:value={createLeagueForm.league.skillLevel}
									>
										<option value="">Select...</option>
										<option value="competitive">Competitive</option>
										<option value="intermediate">Intermediate</option>
										<option value="recreational">Recreational</option>
										<option value="all">All</option>
									</select>
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
							<div class="border border-secondary-300 bg-white p-4">
								<p class="text-sm font-sans text-neutral-950">
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
									>Registration Opens <span class="text-error-700">*</span></label
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
								<label
									for="league-wizard-reg-end"
									class="block text-sm font-sans text-neutral-950 mb-1"
									>Registration Deadline <span class="text-error-700">*</span></label
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
							<div class="border border-secondary-300 bg-white p-3 space-y-3">
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

							<div class="border border-secondary-300 bg-white p-3 space-y-3">
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
												class="block text-sm font-sans text-neutral-950 mb-1"
												>Postseason Start</label
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
							<div class="border border-secondary-300 bg-white p-3">
								<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
									<input
										type="checkbox"
										class="toggle-secondary"
										bind:checked={createLeagueForm.league.isActive}
									/>
									Active
								</label>
							</div>
							<div class="border border-secondary-300 bg-white p-3">
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
							<label
								for="league-wizard-image-url"
								class="block text-sm font-sans text-neutral-950 mb-1">Image URL</label
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
						<div class="border-2 border-secondary-300 bg-white p-4 space-y-2">
							<div class="flex items-start justify-between gap-2">
								<h3 class="text-lg font-bold font-serif text-neutral-950">Offering</h3>
								{#if !createLeagueCopiedFromExisting}
									<button
										type="button"
										class="button-secondary-outlined p-1.5 cursor-pointer"
										aria-label="Edit offering"
										title="Edit offering"
										onclick={startEditingCreateLeagueOffering}
									>
										<IconPencil class="w-4 h-4" />
									</button>
								{/if}
							</div>
							{#if selectedLeagueWizardOffering}
								<p class="text-sm text-neutral-950">
									<span class="font-semibold">Name:</span>
									{selectedLeagueWizardOffering.name}
								</p>
								<p class="text-sm text-neutral-950">
									<span class="font-semibold">Type:</span>
									{selectedLeagueWizardOffering.type === 'tournament' ? 'Tournament' : 'League'}
									<span class="ml-3 font-semibold">Status:</span>
									{selectedLeagueWizardOffering.isActive ? 'Active' : 'Inactive'}
								</p>
							{:else}
								<p class="text-sm text-neutral-950">No offering selected.</p>
							{/if}
						</div>

						<div class="border-2 border-secondary-300 bg-white p-4 space-y-3">
							<div class="flex items-start justify-between gap-2">
								<h3 class="text-lg font-bold font-serif text-neutral-950">
									{wizardEntryUnitTitlePlural()}
								</h3>
								<button
									type="button"
									class="button-secondary-outlined p-1.5 cursor-pointer"
									aria-label={`Edit ${wizardEntryUnitPlural()}`}
									title={`Edit ${wizardEntryUnitPlural()}`}
									onclick={startEditingCreateLeagues}
								>
									<IconPencil class="w-4 h-4" />
								</button>
							</div>
							{#if createLeagueFieldErrors['leagues']}
								<p class="text-xs text-error-700">{createLeagueFieldErrors['leagues']}</p>
							{/if}
							{#if createLeagueForm.leagues.length === 0}
								<p class="text-sm text-neutral-950 font-sans">
									No {wizardEntryUnitPlural()} will be created.
								</p>
							{:else}
								<div class="space-y-3 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400">
									{#each createLeagueForm.leagues as league}
										<div class="border border-secondary-300 bg-neutral p-3 space-y-2">
											<div>
												<p class="text-sm font-semibold text-neutral-950">
													{league.name.trim() || `Untitled ${wizardEntryUnitTitleSingular()}`}
												</p>
												<p class="text-xs text-neutral-900">Slug: {league.slug || 'TBD'}</p>
											</div>
											<div
												class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-950"
											>
												<p><span class="font-semibold">Season:</span> {league.season || 'TBD'}</p>
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
														{formatReviewRange(
															league.postseasonStartDate,
															league.postseasonEndDate
														)}
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

				<div class="pt-2 border-t border-secondary-300 flex justify-end">
					<div class="flex items-center gap-2 justify-end">
						{#if createLeagueStep > 1}
							<button
								type="button"
								class="button-secondary-outlined cursor-pointer"
								onclick={handleCreateLeagueBackAction}
							>
								Back
							</button>
						{/if}
						{#if createLeagueStep < 4}
							<button
								type="button"
								class="button-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								onclick={nextCreateLeagueStep}
								disabled={!canGoNextCreateLeagueStep}
							>
								{#if createLeagueStep === 2 && !createLeagueDraftActive}
									{createLeagueForm.leagues.length === 0 ? 'Skip to Review' : 'Review'}
								{:else if createLeagueStep === 3 && createLeagueDraftActive}
									{createLeagueEditingIndex === null
										? `Add ${wizardEntryUnitTitleSingular()}`
										: `Update ${wizardEntryUnitTitleSingular()}`}
								{:else}
									Next
								{/if}
							</button>
						{:else}
							<button
								type="submit"
								class="button-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={!canSubmitCreateLeague}
							>
								{createLeagueSubmitting ? 'Creating...' : 'Create'}
							</button>
						{/if}
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if isCreateModalOpen}
	<div
		class="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4 lg:p-6 overflow-hidden"
		onpointerdown={handleCreateModalPointerDown}
		onclick={handleCreateModalBackdropClick}
		onkeydown={(event) => {
			if (event.key === 'Escape') requestCloseCreateWizard();
		}}
		role="button"
		tabindex="0"
		aria-label="Close create offering modal"
	>
		<div
			class="w-full max-w-5xl max-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-3rem)] border-4 border-secondary bg-neutral-400 overflow-hidden flex flex-col"
			onclick={(event) => event.stopPropagation()}
			role="presentation"
		>
			<div class="p-4 border-b border-secondary space-y-3">
				<div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<h2 class="text-3xl font-bold font-serif text-neutral-950">New Intramural Offering</h2>
						<p class="text-sm font-sans text-neutral-950">
							Step {createStep} of 5: {wizardStepTitle(createStep)}
						</p>
					</div>
					<button
						type="button"
						class="p-1 text-neutral-950 hover:text-secondary-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500"
						aria-label="Close create offering modal"
						onclick={requestCloseCreateWizard}
					>
						<IconX class="w-6 h-6" />
					</button>
				</div>
				<div class="border border-secondary-300 bg-white h-3">
					<div class="h-full bg-secondary" style={`width: ${createStepProgress}%`}></div>
				</div>
			</div>

			<form
				class="p-4 space-y-5 flex-1 min-h-0 overflow-y-auto"
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
							<label for="offering-slug" class="block text-sm font-sans text-neutral-950 mb-1"
								>Slug <span class="text-error-700">*</span></label
							>
							<input
								id="offering-slug"
								type="text"
								class="input-secondary"
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
							{#if createFieldErrors['offering.slug']}
								<p class="text-xs text-error-700 mt-1">{createFieldErrors['offering.slug']}</p>
							{/if}
						</div>

						<div>
							<label for="offering-sport" class="block text-sm font-sans text-neutral-950 mb-1"
								>Sport <span class="text-error-700">*</span></label
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
								>Type <span class="text-error-700">*</span></label
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
							<label
								for="offering-description"
								class="block text-sm font-sans text-neutral-950 mb-1">Description</label
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
						<div class="grid grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] gap-5">
							<div class="space-y-4 max-w-60">
								<div>
									<label
										for="offering-min-players"
										class="block text-sm font-sans text-neutral-950 mb-1">Min Players</label
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
										<p class="text-xs text-error-700 mt-1">
											{createFieldErrors['offering.minPlayers']}
										</p>
									{/if}
								</div>

								<div>
									<label
										for="offering-max-players"
										class="block text-sm font-sans text-neutral-950 mb-1">Max Players</label
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
										<p class="text-xs text-error-700 mt-1">
											{createFieldErrors['offering.maxPlayers']}
										</p>
									{/if}
								</div>
							</div>

							<div class="space-y-4 max-w-3xl">
								<div>
									<label
										for="offering-image-url"
										class="block text-sm font-sans text-neutral-950 mb-1">Image URL</label
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
									<label
										for="offering-rulebook-url"
										class="block text-sm font-sans text-neutral-950 mb-1">Rulebook URL</label
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

						<div class="border border-secondary-300 bg-white p-3">
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

				{#if createStep === 3}
					<div class="space-y-4">
						{#if !leagueDraftActive}
							<div class="border border-secondary-300 bg-white p-3 space-y-3">
								<div class="flex items-center justify-between gap-2">
									<h3 class="text-sm font-bold font-sans text-neutral-950 uppercase tracking-wide">
										{isTournamentWizard() ? 'Tournament Groups' : 'Leagues'}
									</h3>
									<button
										type="button"
										class="button-secondary-outlined p-1.5 cursor-pointer"
										aria-label={`Add ${wizardUnitSingular()}`}
										title={`Add ${wizardUnitSingular()}`}
										onclick={startAddingLeague}
									>
										<IconPlus class="w-4 h-4" />
									</button>
								</div>

								{#if createForm.leagues.length === 0 && !leagueDraftActive}
									<p class="text-sm text-neutral-950 font-sans">
										No {wizardUnitPlural()} added yet. Use the plus button to add one, or continue without
										{wizardUnitPlural()}.
									</p>
								{:else if createForm.leagues.length > 0}
									<div
										class="space-y-2 max-h-[61vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400 scrollbar-corner-secondary-500 hover:scrollbar-thumb-secondary-700 active:scrollbar-thumb-secondary-700 scrollbar-hover:scrollbar-thumb-secondary-800 scrollbar-active:scrollbar-thumb-secondary-700"
									>
										{#each createForm.leagues as league, leagueIndex (league.draftId)}
											<div
												class="border border-secondary-300 bg-neutral p-3 space-y-2"
												animate:flip={{ duration: 180, easing: cubicOut }}
											>
												<div class="flex items-start justify-between gap-3">
													<div>
														<p class="text-sm font-semibold text-neutral-950">
															{league.name.trim() || 'Untitled League'}
														</p>
														<p class="text-xs text-neutral-900">Slug: {league.slug || 'TBD'}</p>
													</div>
													<div class="flex items-center gap-1">
														{#if createForm.leagues.length > 1}
															{#if leagueIndex > 0}
																<button
																	type="button"
																	class="button-secondary-outlined p-1.5 cursor-pointer"
																	aria-label={`Move ${wizardUnitSingular()} up`}
																	title="Move up"
																	onclick={() => {
																		moveLeague(leagueIndex, 'up');
																	}}
																>
																	<IconArrowUp class="w-4 h-4" />
																</button>
															{/if}
															{#if leagueIndex < createForm.leagues.length - 1}
																<button
																	type="button"
																	class="button-secondary-outlined p-1.5 cursor-pointer"
																	aria-label={`Move ${wizardUnitSingular()} down`}
																	title="Move down"
																	onclick={() => {
																		moveLeague(leagueIndex, 'down');
																	}}
																>
																	<IconArrowDown class="w-4 h-4" />
																</button>
															{/if}
														{/if}
														<button
															type="button"
															class="button-secondary-outlined p-1.5 cursor-pointer"
															aria-label={`Edit ${wizardUnitSingular()}`}
															title="Edit"
															onclick={() => {
																startEditingLeague(leagueIndex);
															}}
														>
															<IconPencil class="w-4 h-4" />
														</button>
														<button
															type="button"
															class="button-secondary-outlined p-1.5 cursor-pointer"
															aria-label={`Copy ${wizardUnitSingular()}`}
															title="Copy"
															onclick={() => {
																duplicateLeague(leagueIndex);
															}}
														>
															<IconCopy class="w-4 h-4" />
														</button>
														<button
															type="button"
															class="button-secondary-outlined p-1.5 cursor-pointer"
															aria-label={`Remove ${wizardUnitSingular()}`}
															title="Remove"
															onclick={() => {
																removeLeague(leagueIndex);
															}}
														>
															<IconTrash class="w-4 h-4 text-error-500" />
														</button>
													</div>
												</div>
												<div
													class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-950"
												>
													<p><span class="font-semibold">Season:</span> {league.season || 'TBD'}</p>
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
														{formatReviewRange(league.regStartDate, league.regEndDate, true)}
													</p>
													<p class="sm:col-span-2">
														<span class="font-semibold">Season Dates:</span>
														{formatReviewRange(league.seasonStartDate, league.seasonEndDate)}
													</p>
													{#if league.hasPreseason}
														<p class="sm:col-span-2">
															<span class="font-semibold">Preseason:</span>
															{formatReviewRange(
																league.preseasonStartDate,
																league.preseasonEndDate
															)}
														</p>
													{/if}
													{#if league.hasPostseason}
														<p class="sm:col-span-2">
															<span class="font-semibold">Postseason:</span>
															{formatReviewRange(
																league.postseasonStartDate,
																league.postseasonEndDate
															)}
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
										placeholder="Men's"
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
									<label for="league-slug" class="block text-sm font-sans text-neutral-950 mb-1"
										>Slug <span class="text-error-700">*</span></label
									>
									<input
										id="league-slug"
										type="text"
										class="input-secondary"
										value={createForm.league.slug}
										placeholder="mens-soccer"
										oninput={(event) => {
											leagueSlugTouched = true;
											createForm.league.isSlugManual = true;
											createForm.league.slug = applyLiveSlugInput(
												event.currentTarget as HTMLInputElement
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
										>Season <span class="text-error-700">*</span></label
									>
									<input
										id="league-season"
										type="text"
										class="input-secondary"
										bind:value={createForm.league.season}
										placeholder={seasonPlaceholder}
										autocomplete="off"
									/>
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
										<option value="">Select...</option>
										<option value="male">Male</option>
										<option value="female">Female</option>
										<option value="mixed">Mixed</option>
									</select>
								</div>

								<div>
									<label
										for="league-skill-level"
										class="block text-sm font-sans text-neutral-950 mb-1">Skill Level</label
									>
									<select
										id="league-skill-level"
										class="select-secondary"
										bind:value={createForm.league.skillLevel}
									>
										<option value="">Select...</option>
										<option value="competitive">Competitive</option>
										<option value="intermediate">Intermediate</option>
										<option value="recreational">Recreational</option>
										<option value="all">All</option>
									</select>
								</div>

								<div class="lg:col-span-2">
									<label
										for="league-description"
										class="block text-sm font-sans text-neutral-950 mb-1">Description</label
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

				{#if createStep === 4}
					<div class="space-y-4">
						{#if !leagueDraftActive}
							<div class="border border-secondary-300 bg-white p-4">
								<p class="text-sm font-sans text-neutral-950">
									No {wizardUnitSingular()} draft is open. Go back to {wizardStepTitle(3)} and click the
									plus button to add one.
								</p>
							</div>
						{:else}
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
								<div>
									<label
										for="league-reg-start"
										class="block text-sm font-sans text-neutral-950 mb-1"
										>Registration Opens <span class="text-error-700">*</span></label
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
										>Registration Deadline <span class="text-error-700">*</span></label
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
									<label
										for="league-season-start"
										class="block text-sm font-sans text-neutral-950 mb-1"
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
									<label
										for="league-season-end"
										class="block text-sm font-sans text-neutral-950 mb-1"
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
										Has Preseason
									</label>
									{#if createForm.league.hasPreseason}
										<div class="space-y-3">
											<div>
												<label
													for="league-preseason-start"
													class="block text-sm font-sans text-neutral-950 mb-1"
													>Preseason Start</label
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
										Has Postseason
									</label>
									{#if createForm.league.hasPostseason}
										<div class="space-y-3">
											<div>
												<label
													for="league-postseason-start"
													class="block text-sm font-sans text-neutral-950 mb-1"
													>Postseason Start</label
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
													class="block text-sm font-sans text-neutral-950 mb-1"
													>Postseason End</label
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
										<input
											type="checkbox"
											class="toggle-secondary"
											bind:checked={createForm.league.isActive}
										/>
										Active
									</label>
								</div>
								<div class="border border-secondary-300 bg-white p-3">
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

				{#if createStep === 5}
					<div class="space-y-4">
						<div class="border-2 border-secondary-300 bg-white p-4 space-y-2">
							<div class="flex items-start justify-between gap-2">
								<h3 class="text-lg font-bold font-serif text-neutral-950">Offering</h3>
								<button
									type="button"
									class="button-secondary-outlined p-1.5 cursor-pointer"
									aria-label="Edit offering"
									title="Edit offering"
									onclick={startEditingOffering}
								>
									<IconPencil class="w-4 h-4" />
								</button>
							</div>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Name:</span>
								{createForm.offering.name}
								<span class="ml-3 font-semibold">Slug:</span>
								{slugifyFinal(createForm.offering.slug)}
							</p>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Sport:</span>
								{createForm.offering.sport}
								<span class="ml-3 font-semibold">Type:</span>
								{createForm.offering.type === 'tournament' ? 'Tournament' : 'League'}
							</p>
							{#if createForm.offering.description.trim()}
								<p class="text-sm text-neutral-950">
									<span class="font-semibold">Description:</span>
									{createForm.offering.description.trim()}
								</p>
							{/if}
							{#if createForm.offering.minPlayers > 0 || createForm.offering.maxPlayers > 0}
								<p class="text-sm text-neutral-950">
									<span class="font-semibold">Players:</span>
									{createForm.offering.minPlayers > 0 ? createForm.offering.minPlayers : 'N/A'} -
									{createForm.offering.maxPlayers > 0 ? createForm.offering.maxPlayers : 'N/A'}
								</p>
							{/if}
						</div>

						<div class="border-2 border-secondary-300 bg-white p-4 space-y-3">
							<div class="flex items-start justify-between gap-2">
								<h3 class="text-lg font-bold font-serif text-neutral-950">
									{wizardUnitTitlePlural()}
								</h3>
								<button
									type="button"
									class="button-secondary-outlined p-1.5 cursor-pointer"
									aria-label={`Edit ${wizardUnitPlural()}`}
									title={`Edit ${wizardUnitPlural()}`}
									onclick={startEditingLeagues}
								>
									<IconPencil class="w-4 h-4" />
								</button>
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
										<div class="border border-secondary-300 bg-neutral p-3 space-y-2">
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
												<p><span class="font-semibold">Season:</span> {league.season || 'TBD'}</p>
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
														{formatReviewRange(
															league.postseasonStartDate,
															league.postseasonEndDate
														)}
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

				<div class="pt-2 border-t border-secondary-300 flex justify-end">
					<div class="flex items-center gap-2 justify-end">
						{#if createStep > 1}
							<button
								type="button"
								class="button-secondary-outlined cursor-pointer"
								onclick={handleCreateBackAction}
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
								{#if createStep === 3 && !leagueDraftActive}
									{createForm.leagues.length === 0 ? 'Skip to Review' : 'Review'}
								{:else if createStep === 4 && leagueDraftActive}
									{leagueEditingIndex === null
										? `Add ${wizardUnitTitleSingular()}`
										: `Update ${wizardUnitTitleSingular()}`}
								{:else}
									Next
								{/if}
							</button>
						{:else}
							<button
								type="submit"
								class="button-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={!canSubmitCreate}
							>
								{createSubmitting ? 'Creating...' : 'Create'}
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
