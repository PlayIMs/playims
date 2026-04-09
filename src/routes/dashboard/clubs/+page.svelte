<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { IconCalendar, IconHistory, IconRestore, IconTarget } from '@tabler/icons-svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import SplitAddAction from '$lib/components/dashboard/SplitAddAction.svelte';
	import DataTableLinkedLabel from '$lib/components/data-table/DataTableLinkedLabel.svelte';
	import type { DataTableColumn } from '$lib/components/data-table.js';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import {
		applyLiveSlugInput,
		createWizardDirtyState,
		pickFieldErrors,
		slugifyFinal,
		toServerFieldErrorMap,
		WizardStepFooter
	} from '$lib/components/wizard';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import { toast } from '$lib/toasts';
	import {
		getCurrentAcademicSeasonLabel,
		inferAcademicSeasonRangeFromName,
		resolveAcademicSeasonEndDate
	} from '$lib/utils/academic-season.js';
	import CreateClubLeagueWizard from './_wizards/CreateClubLeagueWizard.svelte';
	import CreateClubSeasonWizard from './_wizards/CreateClubSeasonWizard.svelte';
	import CreateClubSportWizard from './_wizards/CreateClubSportWizard.svelte';
	import {
		createEmptyClubLeagueWizardForm,
		createEmptyClubSeasonWizardCopy,
		createEmptyClubSeasonWizardForm,
		createEmptyClubSportWizardForm,
		firstInvalidClubLeagueWizardStep,
		firstInvalidClubSeasonWizardStep,
		firstInvalidClubSportWizardStep,
		getClubLeagueWizardStepErrors,
		getClubSeasonWizardStepErrors,
		getClubSportWizardStepErrors,
		type ClubLeagueWizardForm,
		type ClubLeagueWizardStep,
		type ClubSeasonWizardCopyForm,
		type ClubSeasonWizardForm,
		type ClubSeasonWizardStep,
		type ClubSportWizardForm,
		type ClubSportWizardStep
	} from './club-wizard-validation.js';
	import {
		compareClubSeasonHistoryOrder,
		resolveDefaultClubSeasonId,
		seasonStatusLabelForHistory
	} from './season-history.js';
	import type { PageData } from './$types';

	type Activity = PageData['activities'][number];
	type Season = PageData['seasons'][number];

	interface ClubBoardLeagueRow {
		id: string;
		name: string;
		slug: string;
		seasonSlug: string;
		clubSlug: string;
		teamCount: number;
		isLocked: boolean;
		statusLabel: string;
		statusClass: string;
	}

	interface ClubBoard {
		id: string;
		name: string;
		slug: string;
		sportLabel: string;
		totalLeagues: number;
		totalTeams: number;
		lockedLeagueCount: number;
		leagueRows: ClubBoardLeagueRow[];
	}

	interface SeasonBoard {
		id: string;
		name: string;
		slug: string;
		isCurrent: boolean;
		totalClubs: number;
		totalLeagues: number;
		totalTeams: number;
		lockedLeagueCount: number;
		clubs: ClubBoard[];
	}

	interface DropdownOption {
		value: string;
		label: string;
	}

	interface SeasonCopyPreview {
		clubCount: number;
		leagueCount: number;
		teamCount: number;
	}

	const FORM_DROPDOWN_BUTTON_CLASS =
		'w-full border-2 border-secondary-400 bg-white px-4 py-2 text-base leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)] disabled:cursor-not-allowed disabled:opacity-60';
	const HISTORY_BUTTON_CLASS =
		'button-neutral-outlined h-[1.875rem] w-[1.875rem] px-0 cursor-pointer inline-flex items-center justify-center text-neutral-950';
	const HISTORY_DROPDOWN_LIST_CLASS = 'w-64';
	const HISTORY_DROPDOWN_FOOTER_ACTION_CLASS =
		'w-full button-neutral-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer justify-center';
	const HEADER_ICON_CLASS = 'h-4 w-4 shrink-0 text-neutral-950';
	const HEADER_COUNT_BADGE_CLASS =
		'badge-neutral-outlined h-[1.875rem] bg-transparent px-2.5 font-normal normal-case tracking-normal';
	const HEADER_SPLIT_ADD_BUTTON_CLASS =
		'button-primary-outlined h-[1.875rem] px-2 text-xs font-bold uppercase tracking-wide cursor-pointer';
	const HEADER_SPLIT_ADD_MENU_BUTTON_CLASS =
		'button-primary-outlined -ml-[2px] h-[1.875rem] px-1 cursor-pointer';
	const DEFAULT_ACADEMIC_SEASON_PLACEHOLDER = getCurrentAcademicSeasonLabel();
	const CREATE_SEASON_STEP_TITLES: Record<ClubSeasonWizardStep, string> = {
		1: 'Season Details',
		2: 'Copy Setup',
		3: 'Review & Create'
	};
	const CREATE_CLUB_STEP_TITLES: Record<ClubSportWizardStep, string> = {
		1: 'Club Basics',
		2: 'Review & Create'
	};
	const CREATE_LEAGUE_STEP_TITLES: Record<ClubLeagueWizardStep, string> = {
		1: 'League Basics',
		2: 'Review & Create'
	};

	let { data } = $props<{ data: PageData }>();

	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).clubSports
	);

	let searchQuery = $state('');
	let selectedSeasonId = $state('');

	let isCreateSeasonModalOpen = $state(false);
	let createSeasonWizardUnsavedConfirmOpen = $state(false);
	let createSeasonStep = $state<ClubSeasonWizardStep>(1);
	let createSeasonSubmitting = $state(false);
	let createSeasonFormError = $state('');
	let createSeasonServerFieldErrors = $state<Record<string, string>>({});
	let seasonSlugTouched = $state(false);
	let createSeasonStartDateTouched = $state(false);
	let createSeasonEndDateTouched = $state(false);
	let createSeasonValidatedSteps = $state<ClubSeasonWizardStep[]>([]);
	let createSeasonForm = $state<ClubSeasonWizardForm>(createEmptyClubSeasonWizardForm(false));
	let createSeasonCopy = $state<ClubSeasonWizardCopyForm>(createEmptyClubSeasonWizardCopy(''));

	let isCreateClubModalOpen = $state(false);
	let createClubWizardUnsavedConfirmOpen = $state(false);
	let createClubStep = $state<ClubSportWizardStep>(1);
	let createClubSubmitting = $state(false);
	let createClubFormError = $state('');
	let createClubServerFieldErrors = $state<Record<string, string>>({});
	let clubSlugTouched = $state(false);
	let createClubValidatedSteps = $state<ClubSportWizardStep[]>([]);
	let createClubForm = $state<ClubSportWizardForm>(createEmptyClubSportWizardForm(''));

	let isCreateLeagueModalOpen = $state(false);
	let createLeagueWizardUnsavedConfirmOpen = $state(false);
	let createLeagueStep = $state<ClubLeagueWizardStep>(1);
	let createLeagueSubmitting = $state(false);
	let createLeagueFormError = $state('');
	let createLeagueServerFieldErrors = $state<Record<string, string>>({});
	let leagueSlugTouched = $state(false);
	let createLeagueValidatedSteps = $state<ClubLeagueWizardStep[]>([]);
	let createLeagueForm = $state<ClubLeagueWizardForm>(createEmptyClubLeagueWizardForm(''));

	const createSeasonWizardDirtyState = createWizardDirtyState<{
		form: ClubSeasonWizardForm;
		copy: ClubSeasonWizardCopyForm;
	}>();
	const createClubWizardDirtyState = createWizardDirtyState<ClubSportWizardForm>();
	const createLeagueWizardDirtyState = createWizardDirtyState<ClubLeagueWizardForm>();

	const seasonDropdownOptions = $derived.by<DropdownOption[]>(() =>
		data.seasons.map((season: Season) => ({
			value: season.id,
			label: season.name
		}))
	);

	const availableClubs = $derived.by<DropdownOption[]>(() => {
		const byId = new Map<string, DropdownOption>();
		for (const activity of data.activities) {
			if (selectedSeasonId && activity.seasonId !== selectedSeasonId) continue;
			if (!activity.clubId || byId.has(activity.clubId)) continue;
			byId.set(activity.clubId, {
				value: activity.clubId,
				label: activity.clubName
			});
		}
		return Array.from(byId.values()).sort((left, right) => left.label.localeCompare(right.label));
	});

	$effect(() => {
		selectedSeasonId = resolveDefaultClubSeasonId(
			activeSeasonHistory,
			data.currentSeasonId,
			selectedSeasonId
		);
	});

	$effect(() => {
		const defaultSeasonId =
			selectedSeasonId || data.currentSeasonId || seasonDropdownOptions[0]?.value || '';
		if (!createClubForm.clubSeasonId && defaultSeasonId) {
			createClubForm.clubSeasonId = defaultSeasonId;
		}
		const hasSelectedLeagueClub = availableClubs.some(
			(club) => club.value === createLeagueForm.clubId
		);
		if ((!createLeagueForm.clubId || !hasSelectedLeagueClub) && availableClubs[0]?.value) {
			createLeagueForm.clubId = availableClubs[0].value;
		}
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const hasUnsavedCreateSeasonChanges =
			isCreateSeasonModalOpen && hasUnsavedCreateSeasonWizardChanges();
		const hasUnsavedCreateClubChanges =
			isCreateClubModalOpen && hasUnsavedCreateClubWizardChanges();
		const hasUnsavedCreateLeagueChanges =
			isCreateLeagueModalOpen && hasUnsavedCreateLeagueWizardChanges();
		if (
			!hasUnsavedCreateSeasonChanges &&
			!hasUnsavedCreateClubChanges &&
			!hasUnsavedCreateLeagueChanges
		) {
			return;
		}

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	function boardStatus(activity: Activity): { label: string; className: string } {
		if (activity.isLocked) {
			return {
				label: 'Locked',
				className: 'badge-primary-outlined text-xs uppercase tracking-wide'
			};
		}
		if (activity.isActive) {
			return {
				label: 'Active',
				className: 'badge-secondary-outlined px-2 py-0.5 text-xs'
			};
		}
		return {
			label: 'Inactive',
			className: 'badge-secondary-outlined px-2 py-0.5 text-xs'
		};
	}

	function addValidatedSeasonStep(step: ClubSeasonWizardStep): void {
		if (!createSeasonValidatedSteps.includes(step)) {
			createSeasonValidatedSteps = [...createSeasonValidatedSteps, step];
		}
	}

	function addValidatedClubStep(step: ClubSportWizardStep): void {
		if (!createClubValidatedSteps.includes(step)) {
			createClubValidatedSteps = [...createClubValidatedSteps, step];
		}
	}

	function addValidatedLeagueStep(step: ClubLeagueWizardStep): void {
		if (!createLeagueValidatedSteps.includes(step)) {
			createLeagueValidatedSteps = [...createLeagueValidatedSteps, step];
		}
	}

	function seasonStepFieldKeys(step: ClubSeasonWizardStep): string[] {
		if (step === 1) return ['season.name', 'season.slug', 'season.startDate', 'season.endDate'];
		if (step === 2) {
			return [
				'copy.sourceSeasonIds',
				'copy.includeClubs',
				'copy.includeLeagues',
				'copy.includeTeams',
				'copy.includeRosters'
			];
		}
		return [
			'season.name',
			'season.slug',
			'season.startDate',
			'season.endDate',
			'copy.sourceSeasonIds',
			'copy.includeClubs',
			'copy.includeLeagues',
			'copy.includeTeams',
			'copy.includeRosters'
		];
	}

	function clubStepFieldKeys(_step: ClubSportWizardStep): string[] {
		return ['club.clubSeasonId', 'club.name', 'club.slug'];
	}

	function leagueStepFieldKeys(_step: ClubLeagueWizardStep): string[] {
		return ['league.clubId', 'league.name', 'league.slug'];
	}

	function pluralize(value: number, singular: string, plural: string): string {
		return value === 1 ? singular : plural;
	}

	function handleSeasonHistoryChange(value: string): void {
		if (!value || value === selectedSeasonId) return;
		selectedSeasonId = value;
	}

	const seasonHistory = $derived.by(() => [...data.seasons].sort(compareClubSeasonHistoryOrder));
	const activeSeasonHistory = $derived.by(() =>
		seasonHistory.filter((season: Season) => season.isActive)
	);
	const seasonHistoryDropdownOptions = $derived.by(() =>
		activeSeasonHistory.map((season: Season) => ({
			value: season.id,
			label: season.name,
			statusLabel: seasonStatusLabelForHistory(season)
		}))
	);
	const selectedSeason = $derived.by(
		() => seasonHistory.find((season: Season) => season.id === selectedSeasonId) ?? null
	);
	const seasonBoards = $derived.by<SeasonBoard[]>(() => {
		const seasonBoards = new Map<string, SeasonBoard>();

		for (const season of seasonHistory) {
			seasonBoards.set(season.id, {
				id: season.id,
				name: season.name,
				slug: season.slug,
				isCurrent: season.isCurrent,
				totalClubs: 0,
				totalLeagues: 0,
				totalTeams: 0,
				lockedLeagueCount: 0,
				clubs: []
			});
		}

		for (const activity of data.activities) {
			const seasonBoard = seasonBoards.get(activity.seasonId);
			if (!seasonBoard) continue;

			let clubBoard = seasonBoard.clubs.find((club) => club.id === activity.clubId);
			if (!clubBoard) {
				clubBoard = {
					id: activity.clubId,
					name: activity.clubName,
					slug: activity.clubSlug,
					sportLabel: 'Club sport',
					totalLeagues: 0,
					totalTeams: 0,
					lockedLeagueCount: 0,
					leagueRows: []
				};
				seasonBoard.clubs.push(clubBoard);
			}

			const status = boardStatus(activity);
			clubBoard.leagueRows.push({
				id: activity.leagueId,
				name: activity.leagueName,
				slug: activity.leagueSlug,
				seasonSlug: activity.seasonSlug,
				clubSlug: activity.clubSlug,
				teamCount: activity.teamCount,
				isLocked: activity.isLocked,
				statusLabel: status.label,
				statusClass: status.className
			});
			clubBoard.totalLeagues += 1;
			clubBoard.totalTeams += activity.teamCount;
			clubBoard.lockedLeagueCount += activity.isLocked ? 1 : 0;
			seasonBoard.totalLeagues += 1;
			seasonBoard.totalTeams += activity.teamCount;
			seasonBoard.lockedLeagueCount += activity.isLocked ? 1 : 0;
		}

		const resolvedBoards = Array.from(seasonBoards.values()).map((seasonBoard) => ({
			...seasonBoard,
			clubs: seasonBoard.clubs
				.map((club) => ({
					...club,
					leagueRows: [...club.leagueRows].sort((left, right) =>
						left.name.localeCompare(right.name)
					)
				}))
				.sort((left, right) => left.name.localeCompare(right.name)),
			totalClubs: seasonBoard.clubs.length
		}));

		return resolvedBoards;
	});
	const selectedSeasonBoard = $derived.by(
		() => seasonBoards.find((seasonBoard) => seasonBoard.id === selectedSeasonId) ?? null
	);
	const visibleClubBoards = $derived.by<ClubBoard[]>(() => {
		if (!selectedSeasonBoard) return [];
		const normalizedQuery = searchQuery.trim().toLowerCase();
		if (!normalizedQuery) return selectedSeasonBoard.clubs;

		return selectedSeasonBoard.clubs
			.flatMap((club) => {
				const clubMatches = `${selectedSeasonBoard.name} ${club.name} ${club.sportLabel}`
					.toLowerCase()
					.includes(normalizedQuery);
				if (clubMatches) return [club];

				const filteredLeagueRows = club.leagueRows.filter((leagueRow) =>
					`${club.name} ${leagueRow.name}`.toLowerCase().includes(normalizedQuery)
				);
				if (filteredLeagueRows.length === 0) return [];

				return [
					{
						...club,
						leagueRows: filteredLeagueRows,
						totalLeagues: filteredLeagueRows.length,
						totalTeams: filteredLeagueRows.reduce(
							(total, leagueRow) => total + leagueRow.teamCount,
							0
						),
						lockedLeagueCount: filteredLeagueRows.filter((leagueRow) => leagueRow.isLocked).length
					}
				];
			})
			.sort((left, right) => left.name.localeCompare(right.name));
	});
	const badgeClubCount = $derived.by(() => selectedSeasonBoard?.totalClubs ?? 0);
	const badgeLeagueCount = $derived.by(() => selectedSeasonBoard?.totalLeagues ?? 0);
	const badgeTeamCount = $derived.by(() => selectedSeasonBoard?.totalTeams ?? 0);

	const seasonSummary = $derived.by(() =>
		data.seasons
			.map((season: Season) => {
				const clubs = new Set(
					data.activities
						.filter((activity: Activity) => activity.seasonId === season.id && activity.clubId)
						.map((activity: Activity) => activity.clubId)
				);
				const activities = data.activities.filter(
					(activity: Activity) => activity.seasonId === season.id
				);
				return {
					...season,
					clubCount: clubs.size,
					leagueCount: activities.length,
					teamCount: activities.reduce(
						(total: number, activity: Activity) => total + activity.teamCount,
						0
					)
				};
			})
			.sort(compareClubSeasonHistoryOrder)
	);

	const overallSummary = $derived.by(() => {
		const clubIds = new Set(data.activities.map((activity: Activity) => activity.clubId));
		return {
			clubCount: clubIds.size,
			leagueCount: data.activities.length,
			teamCount: data.activities.reduce(
				(total: number, activity: Activity) => total + activity.teamCount,
				0
			),
			currentSeasonName:
				data.seasons.find((season: Season) => season.id === data.currentSeasonId)?.name ??
				data.seasons[0]?.name ??
				'No current season'
		};
	});

	const boardTableColumns = $derived.by<DataTableColumn<ClubBoardLeagueRow>[]>(() => [
		{
			key: 'league',
			label: 'League',
			width: '56%',
			rowHeader: true
		},
		{
			key: 'teams',
			label: 'Teams',
			width: '20%',
			cellTextAlignment: 'center'
		},
		{
			key: 'status',
			label: 'Status',
			width: '24%',
			cellTextAlignment: 'center'
		}
	]);

	const addActionOptions = [
		{ value: 'season', label: 'Add Season' },
		{ value: 'club', label: 'Add Club' },
		{ value: 'league', label: 'Add League' }
	];

	const createSeasonSourceSeasonId = $derived.by(() => createSeasonCopy.sourceSeasonIds[0] ?? '');
	const createSeasonCopySource = $derived.by(
		() => data.seasons.find((season: Season) => season.id === createSeasonSourceSeasonId) ?? null
	);
	const createSeasonCopyPreview = $derived.by<SeasonCopyPreview>(() => {
		if (!createSeasonSourceSeasonId) {
			return { clubCount: 0, leagueCount: 0, teamCount: 0 };
		}
		const sourceActivities = data.activities.filter(
			(activity: Activity) => activity.seasonId === createSeasonSourceSeasonId
		);
		return {
			clubCount: new Set(sourceActivities.map((activity: Activity) => activity.clubId)).size,
			leagueCount: sourceActivities.length,
			teamCount: sourceActivities.reduce(
				(total: number, activity: Activity) => total + activity.teamCount,
				0
			)
		};
	});

	const createSeasonFieldErrors = $derived.by(() => {
		const clientErrors = createSeasonValidatedSteps.includes(createSeasonStep)
			? getClubSeasonWizardStepErrors(
					createSeasonForm,
					createSeasonCopy,
					data.seasons,
					createSeasonStep
				)
			: {};
		const serverErrors = pickFieldErrors(
			createSeasonServerFieldErrors,
			seasonStepFieldKeys(createSeasonStep)
		);
		return { ...clientErrors, ...serverErrors };
	});

	const createClubFieldErrors = $derived.by(() => {
		const clientErrors = createClubValidatedSteps.includes(createClubStep)
			? getClubSportWizardStepErrors(createClubForm, data.activities, createClubStep)
			: {};
		const serverErrors = pickFieldErrors(
			createClubServerFieldErrors,
			clubStepFieldKeys(createClubStep)
		);
		return { ...clientErrors, ...serverErrors };
	});

	const createLeagueFieldErrors = $derived.by(() => {
		const clientErrors = createLeagueValidatedSteps.includes(createLeagueStep)
			? getClubLeagueWizardStepErrors(createLeagueForm, data.activities, createLeagueStep)
			: {};
		const serverErrors = pickFieldErrors(
			createLeagueServerFieldErrors,
			leagueStepFieldKeys(createLeagueStep)
		);
		return { ...clientErrors, ...serverErrors };
	});

	const createSeasonStepProgress = $derived.by(() => Math.round((createSeasonStep / 3) * 100));
	const createClubStepProgress = $derived.by(() => Math.round((createClubStep / 2) * 100));
	const createLeagueStepProgress = $derived.by(() => Math.round((createLeagueStep / 2) * 100));
	const createClubSeasonLabel = $derived.by(
		() =>
			data.seasons.find((season: Season) => season.id === createClubForm.clubSeasonId)?.name ??
			'No season selected'
	);
	const createLeagueClubLabel = $derived.by(
		() =>
			availableClubs.find((club) => club.value === createLeagueForm.clubId)?.label ??
			'No club selected'
	);

	function resetCreateSeasonWizard(): void {
		createSeasonStep = 1;
		createSeasonSubmitting = false;
		createSeasonFormError = '';
		createSeasonServerFieldErrors = {};
		createSeasonWizardUnsavedConfirmOpen = false;
		seasonSlugTouched = false;
		createSeasonStartDateTouched = false;
		createSeasonEndDateTouched = false;
		createSeasonValidatedSteps = [];
		createSeasonForm = createEmptyClubSeasonWizardForm(data.seasons.length === 0);
		createSeasonCopy = createEmptyClubSeasonWizardCopy(
			selectedSeasonId || data.currentSeasonId || data.seasons[0]?.id || ''
		);
		createSeasonWizardDirtyState.clearBaseline();
	}

	function resetCreateClubWizard(): void {
		createClubStep = 1;
		createClubSubmitting = false;
		createClubFormError = '';
		createClubServerFieldErrors = {};
		createClubWizardUnsavedConfirmOpen = false;
		clubSlugTouched = false;
		createClubValidatedSteps = [];
		createClubForm = createEmptyClubSportWizardForm(
			selectedSeasonId || data.currentSeasonId || data.seasons[0]?.id || ''
		);
		createClubWizardDirtyState.clearBaseline();
	}

	function resetCreateLeagueWizard(): void {
		createLeagueStep = 1;
		createLeagueSubmitting = false;
		createLeagueFormError = '';
		createLeagueServerFieldErrors = {};
		createLeagueWizardUnsavedConfirmOpen = false;
		leagueSlugTouched = false;
		createLeagueValidatedSteps = [];
		createLeagueForm = createEmptyClubLeagueWizardForm(availableClubs[0]?.value ?? '');
		createLeagueWizardDirtyState.clearBaseline();
	}

	function openCreateSeasonWizard(): void {
		resetCreateSeasonWizard();
		createSeasonWizardDirtyState.captureBaseline({
			form: createSeasonForm,
			copy: createSeasonCopy
		});
		isCreateSeasonModalOpen = true;
	}

	function applyCreateClubSeasonDateInferenceFromName(nextName: string): void {
		const inferredRange = inferAcademicSeasonRangeFromName(nextName);
		if (!inferredRange) return;

		if (!createSeasonStartDateTouched) {
			createSeasonForm.startDate = inferredRange.startDate;
		}
		if (!createSeasonEndDateTouched) {
			createSeasonForm.endDate = inferredRange.endDate;
		}
	}

	function syncCreateClubSeasonEndDateFromStart(nextStartDate: string): void {
		if (createSeasonEndDateTouched) return;
		createSeasonForm.endDate = resolveAcademicSeasonEndDate(createSeasonForm.name, nextStartDate);
	}

	function openCreateClubWizard(): void {
		resetCreateClubWizard();
		createClubWizardDirtyState.captureBaseline(createClubForm);
		isCreateClubModalOpen = true;
	}

	function openCreateLeagueWizard(): void {
		resetCreateLeagueWizard();
		createLeagueWizardDirtyState.captureBaseline(createLeagueForm);
		isCreateLeagueModalOpen = true;
	}

	function closeCreateSeasonWizard(): void {
		isCreateSeasonModalOpen = false;
		createSeasonWizardUnsavedConfirmOpen = false;
		resetCreateSeasonWizard();
	}

	function closeCreateClubWizard(): void {
		isCreateClubModalOpen = false;
		createClubWizardUnsavedConfirmOpen = false;
		resetCreateClubWizard();
	}

	function closeCreateLeagueWizard(): void {
		isCreateLeagueModalOpen = false;
		createLeagueWizardUnsavedConfirmOpen = false;
		resetCreateLeagueWizard();
	}

	function hasUnsavedCreateSeasonWizardChanges(): boolean {
		return createSeasonWizardDirtyState.isDirty({
			form: createSeasonForm,
			copy: createSeasonCopy
		});
	}

	function hasUnsavedCreateClubWizardChanges(): boolean {
		return createClubWizardDirtyState.isDirty(createClubForm);
	}

	function hasUnsavedCreateLeagueWizardChanges(): boolean {
		return createLeagueWizardDirtyState.isDirty(createLeagueForm);
	}

	function requestCloseCreateSeasonWizard(): void {
		if (!isCreateSeasonModalOpen || createSeasonSubmitting) return;
		if (!hasUnsavedCreateSeasonWizardChanges()) {
			closeCreateSeasonWizard();
			return;
		}
		createSeasonWizardUnsavedConfirmOpen = true;
	}

	function requestCloseCreateClubWizard(): void {
		if (!isCreateClubModalOpen || createClubSubmitting) return;
		if (!hasUnsavedCreateClubWizardChanges()) {
			closeCreateClubWizard();
			return;
		}
		createClubWizardUnsavedConfirmOpen = true;
	}

	function requestCloseCreateLeagueWizard(): void {
		if (!isCreateLeagueModalOpen || createLeagueSubmitting) return;
		if (!hasUnsavedCreateLeagueWizardChanges()) {
			closeCreateLeagueWizard();
			return;
		}
		createLeagueWizardUnsavedConfirmOpen = true;
	}

	function confirmDiscardCreateSeasonWizard(): void {
		createSeasonWizardUnsavedConfirmOpen = false;
		closeCreateSeasonWizard();
	}

	function cancelDiscardCreateSeasonWizard(): void {
		createSeasonWizardUnsavedConfirmOpen = false;
	}

	function confirmDiscardCreateClubWizard(): void {
		createClubWizardUnsavedConfirmOpen = false;
		closeCreateClubWizard();
	}

	function cancelDiscardCreateClubWizard(): void {
		createClubWizardUnsavedConfirmOpen = false;
	}

	function confirmDiscardCreateLeagueWizard(): void {
		createLeagueWizardUnsavedConfirmOpen = false;
		closeCreateLeagueWizard();
	}

	function cancelDiscardCreateLeagueWizard(): void {
		createLeagueWizardUnsavedConfirmOpen = false;
	}

	function clearCreateSeasonApiErrors(): void {
		if (Object.keys(createSeasonServerFieldErrors).length > 0) {
			createSeasonServerFieldErrors = {};
		}
		if (createSeasonFormError) {
			createSeasonFormError = '';
		}
	}

	function clearCreateClubApiErrors(): void {
		if (Object.keys(createClubServerFieldErrors).length > 0) {
			createClubServerFieldErrors = {};
		}
		if (createClubFormError) {
			createClubFormError = '';
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

	function nextCreateSeasonStep(): void {
		addValidatedSeasonStep(createSeasonStep);
		clearCreateSeasonApiErrors();
		const errors = getClubSeasonWizardStepErrors(
			createSeasonForm,
			createSeasonCopy,
			data.seasons,
			createSeasonStep
		);
		if (Object.keys(errors).length > 0 || createSeasonStep >= 3) {
			return;
		}
		createSeasonStep = (createSeasonStep + 1) as ClubSeasonWizardStep;
	}

	function previousCreateSeasonStep(): void {
		if (createSeasonStep > 1) {
			createSeasonStep = (createSeasonStep - 1) as ClubSeasonWizardStep;
		}
	}

	function nextCreateClubStep(): void {
		addValidatedClubStep(createClubStep);
		clearCreateClubApiErrors();
		const errors = getClubSportWizardStepErrors(createClubForm, data.activities, createClubStep);
		if (Object.keys(errors).length > 0 || createClubStep >= 2) {
			return;
		}
		createClubStep = 2;
	}

	function previousCreateClubStep(): void {
		if (createClubStep > 1) {
			createClubStep = 1;
		}
	}

	function nextCreateLeagueStep(): void {
		addValidatedLeagueStep(createLeagueStep);
		clearCreateLeagueApiErrors();
		const errors = getClubLeagueWizardStepErrors(
			createLeagueForm,
			data.activities,
			createLeagueStep
		);
		if (Object.keys(errors).length > 0 || createLeagueStep >= 2) {
			return;
		}
		createLeagueStep = 2;
	}

	function previousCreateLeagueStep(): void {
		if (createLeagueStep > 1) {
			createLeagueStep = 1;
		}
	}

	function handleCopyClubsToggle(checked: boolean): void {
		createSeasonCopy.includeClubs = checked;
		if (!checked) {
			createSeasonCopy.includeLeagues = false;
			createSeasonCopy.includeTeams = false;
			createSeasonCopy.includeOfficers = false;
			createSeasonCopy.includeRosters = false;
			createSeasonCopy.includeSchedules = false;
		}
	}

	function handleCopyLeaguesToggle(checked: boolean): void {
		createSeasonCopy.includeLeagues = checked;
		if (!checked) {
			createSeasonCopy.includeTeams = false;
			createSeasonCopy.includeRosters = false;
			createSeasonCopy.includeSchedules = false;
		}
	}

	function handleCopyTeamsToggle(checked: boolean): void {
		createSeasonCopy.includeTeams = checked;
		if (!checked) {
			createSeasonCopy.includeRosters = false;
		}
	}

	async function submitCreateSeasonWizard(): Promise<void> {
		if (createSeasonSubmitting) return;
		addValidatedSeasonStep(createSeasonStep);
		clearCreateSeasonApiErrors();

		const clientErrors = getClubSeasonWizardStepErrors(
			createSeasonForm,
			createSeasonCopy,
			data.seasons,
			3
		);
		if (Object.keys(clientErrors).length > 0) {
			createSeasonStep = firstInvalidClubSeasonWizardStep(clientErrors);
			return;
		}

		createSeasonSubmitting = true;
		try {
			const response = await fetch('/api/club-sports/seasons', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					season: {
						...createSeasonForm,
						slug: slugifyFinal(createSeasonForm.slug || createSeasonForm.name),
						isActive: true
					},
					copy: {
						enabled: createSeasonCopy.enabled,
						sourceSeasonIds: createSeasonCopy.enabled ? createSeasonCopy.sourceSeasonIds : [],
						includeClubs: createSeasonCopy.includeClubs,
						includeLeagues: createSeasonCopy.includeLeagues,
						includeTeams: createSeasonCopy.includeTeams,
						includeOfficers: createSeasonCopy.includeOfficers,
						includeRosters: createSeasonCopy.includeRosters,
						includeSchedules: createSeasonCopy.includeSchedules
					}
				})
			});
			const payload = await response.json();
			if (!response.ok || !payload.success) {
				createSeasonServerFieldErrors = toServerFieldErrorMap(payload.fieldErrors);
				if (Object.keys(createSeasonServerFieldErrors).length > 0) {
					createSeasonStep = firstInvalidClubSeasonWizardStep(createSeasonServerFieldErrors);
				}
				createSeasonFormError = payload.error ?? 'Unable to create club season.';
				return;
			}

			toast.success('Club season created.', {
				title: pageLabel
			});
			closeCreateSeasonWizard();
			await invalidateAll();
		} catch {
			createSeasonFormError = 'Unable to create club season.';
		} finally {
			createSeasonSubmitting = false;
		}
	}

	async function submitCreateClubWizard(): Promise<void> {
		if (createClubSubmitting) return;
		addValidatedClubStep(createClubStep);
		clearCreateClubApiErrors();

		const clientErrors = getClubSportWizardStepErrors(createClubForm, data.activities, 2);
		if (Object.keys(clientErrors).length > 0) {
			createClubStep = firstInvalidClubSportWizardStep(clientErrors);
			return;
		}

		createClubSubmitting = true;
		try {
			const response = await fetch('/api/club-sports/clubs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					club: {
						clubSeasonId: createClubForm.clubSeasonId,
						name: createClubForm.name,
						slug: slugifyFinal(createClubForm.slug || createClubForm.name),
						sport: createClubForm.sport.trim() || null,
						description: null,
						imageUrl: null,
						isActive: true
					},
					leagues: []
				})
			});
			const payload = await response.json();
			if (!response.ok || !payload.success) {
				createClubServerFieldErrors = toServerFieldErrorMap(payload.fieldErrors);
				if (Object.keys(createClubServerFieldErrors).length > 0) {
					createClubStep = firstInvalidClubSportWizardStep(createClubServerFieldErrors);
				}
				createClubFormError = payload.error ?? 'Unable to create club sport.';
				return;
			}

			toast.success('Club sport created.', {
				title: pageLabel
			});
			closeCreateClubWizard();
			await invalidateAll();
		} catch {
			createClubFormError = 'Unable to create club sport.';
		} finally {
			createClubSubmitting = false;
		}
	}

	function toCreateLeagueFieldErrors(fieldErrors: unknown): Record<string, string> {
		const serverErrors = toServerFieldErrorMap(
			fieldErrors as Record<string, string[] | undefined> | undefined
		);
		const remappedErrors: Record<string, string> = {};
		for (const [key, value] of Object.entries(serverErrors)) {
			if (key === 'clubId') {
				remappedErrors['league.clubId'] = value;
				continue;
			}
			if (key === 'leagues.0.name') {
				remappedErrors['league.name'] = value;
				continue;
			}
			if (key === 'leagues.0.slug') {
				remappedErrors['league.slug'] = value;
				continue;
			}
			remappedErrors[key] = value;
		}
		return remappedErrors;
	}

	async function submitCreateLeagueWizard(): Promise<void> {
		if (createLeagueSubmitting) return;
		addValidatedLeagueStep(createLeagueStep);
		clearCreateLeagueApiErrors();

		const clientErrors = getClubLeagueWizardStepErrors(createLeagueForm, data.activities, 2);
		if (Object.keys(clientErrors).length > 0) {
			createLeagueStep = firstInvalidClubLeagueWizardStep(clientErrors);
			return;
		}

		createLeagueSubmitting = true;
		try {
			const response = await fetch('/api/club-sports/leagues', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					clubId: createLeagueForm.clubId,
					leagues: [
						{
							name: createLeagueForm.name,
							slug: slugifyFinal(createLeagueForm.slug || createLeagueForm.name),
							stackOrder: 1,
							description: null,
							gender: createLeagueForm.gender || null,
							regStartDate: null,
							regEndDate: null,
							seasonStartDate: null,
							seasonEndDate: null,
							isActive: true,
							isLocked: false,
							imageUrl: null
						}
					]
				})
			});
			const payload = await response.json();
			if (!response.ok || !payload.success) {
				createLeagueServerFieldErrors = toCreateLeagueFieldErrors(payload.fieldErrors);
				if (Object.keys(createLeagueServerFieldErrors).length > 0) {
					createLeagueStep = firstInvalidClubLeagueWizardStep(createLeagueServerFieldErrors);
				}
				createLeagueFormError = payload.error ?? 'Unable to create club league.';
				return;
			}
			toast.success('Club league created.', {
				title: pageLabel
			});
			closeCreateLeagueWizard();
			await invalidateAll();
		} catch {
			createLeagueFormError = 'Unable to create club league.';
		} finally {
			createLeagueSubmitting = false;
		}
	}
</script>

<PageTitle pageTitle={pageLabel} />

<div class="dashboard-page-shell">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 py-2 lg:flex-row lg:items-start lg:justify-between">
				<div class="flex items-center gap-3">
					<div
						class="bg-primary text-primary-foreground border-2 border-primary-700 flex h-[2.75rem] w-[2.75rem] items-center justify-center lg:h-[3.4rem] lg:w-[3.4rem]"
						aria-hidden="true"
					>
						<IconCalendar class="h-7 w-7 lg:h-8 lg:w-8" />
					</div>
					<h1
						class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
					>
						{pageLabel}
					</h1>
				</div>
				<DashboardSearchLauncher wrapperClass="lg:pt-1" />
			</div>
		</div>
	</header>

	<div class="space-y-4 px-4 lg:px-6">
		{#if data.error}
			<div class="border-2 border-warning-300 bg-warning-50 p-4 text-sm text-neutral-950">
				{data.error}
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
			<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
				<div class="space-y-3 border-b border-neutral-950 bg-neutral-600/66 p-4">
					<div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-2xl font-bold font-serif text-neutral-950">
								{selectedSeason?.name ?? 'Club Seasons'}
							</h2>
							{#if seasonHistoryDropdownOptions.length > 0}
								<ListboxDropdown
									options={seasonHistoryDropdownOptions}
									value={selectedSeasonId}
									ariaLabel="Club season history"
									buttonClass={HISTORY_BUTTON_CLASS}
									listClass={HISTORY_DROPDOWN_LIST_CLASS}
									emptyText="No club seasons configured."
									footerActionLabel="Add New Season"
									footerActionAriaLabel="Add new club season"
									footerActionClass={HISTORY_DROPDOWN_FOOTER_ACTION_CLASS}
									on:change={(event) => {
										handleSeasonHistoryChange(event.detail.value);
									}}
									on:footerAction={openCreateSeasonWizard}
								>
									{#snippet trigger()}
										<IconHistory class={HEADER_ICON_CLASS} />
									{/snippet}
								</ListboxDropdown>
							{/if}
						</div>
						<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
							<span class={HEADER_COUNT_BADGE_CLASS}>
								{badgeClubCount}
								{pluralize(badgeClubCount, 'club', 'clubs')}
							</span>
							<span class={HEADER_COUNT_BADGE_CLASS}>
								{badgeLeagueCount}
								{pluralize(badgeLeagueCount, 'league', 'leagues')}
							</span>
							<span class={HEADER_COUNT_BADGE_CLASS}>
								{badgeTeamCount}
								{pluralize(badgeTeamCount, 'team', 'teams')}
							</span>
							<SplitAddAction
								options={addActionOptions}
								buttonClass={HEADER_SPLIT_ADD_BUTTON_CLASS}
								menuButtonClass={HEADER_SPLIT_ADD_MENU_BUTTON_CLASS}
								on:click={() => {
									openCreateClubWizard();
								}}
								on:action={(event) => {
									if (event.detail.value === 'season') {
										openCreateSeasonWizard();
										return;
									}
									if (event.detail.value === 'league') {
										openCreateLeagueWizard();
										return;
									}
									openCreateClubWizard();
								}}
							/>
						</div>
					</div>
					<SearchInput
						id="club-sports-search"
						label="Search club sports"
						value={searchQuery}
						placeholder="Search club sport or league"
						autocomplete="off"
						wrapperClass="relative"
						iconClass="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-950"
						inputClass="input-neutral py-1 pl-10 pr-10 text-sm disabled:cursor-not-allowed"
						clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-700 hover:text-neutral-950"
						clearIconClass="h-4 w-4"
						clearAriaLabel="Clear club sports search"
						on:input={(event) => {
							searchQuery = event.detail.value;
						}}
					/>
				</div>

				<div class="min-h-[34rem]">
					{#if !selectedSeasonBoard}
						<div class="p-4">
							<DataTable columns={boardTableColumns} rows={[]} caption="Club sports board">
								{#snippet emptyBody()}
									<tr class="bg-neutral-25">
										<td
											colspan={boardTableColumns.length}
											class="px-4 py-10 text-center text-sm italic text-neutral-700"
										>
											No club seasons have been added yet. Use the add actions to create your first
											season.
										</td>
									</tr>
								{/snippet}

								{#snippet cell(_row, _column)}{/snippet}
							</DataTable>
						</div>
					{:else if visibleClubBoards.length === 0}
						<div class="p-4">
							<DataTable columns={boardTableColumns} rows={[]} caption="Club sports board">
								{#snippet emptyBody()}
									<tr class="bg-neutral-25">
										<td
											colspan={boardTableColumns.length}
											class="px-4 py-10 text-center text-sm italic text-neutral-700"
										>
											{#if searchQuery.trim()}
												No club sports match "{searchQuery.trim()}" in {selectedSeasonBoard.name}.
											{:else}
												No club sports have been added to {selectedSeasonBoard.name} yet.
											{/if}
										</td>
									</tr>
								{/snippet}

								{#snippet cell(_row, _column)}{/snippet}
							</DataTable>
						</div>
					{:else}
						<div class="space-y-3 p-4">
							{#each visibleClubBoards as clubBoard}
								<article class="space-y-3 border border-neutral-950 bg-white p-3">
									<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
										<div class="min-w-0">
											<a
												href={`/dashboard/clubs/${selectedSeasonBoard.slug}/${clubBoard.slug}`}
												class="text-2xl font-bold font-serif text-neutral-950 hover:underline"
											>
												{clubBoard.name}
											</a>
											<p
												class="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-800"
											>
												{clubBoard.sportLabel}
											</p>
										</div>
										<div class="flex flex-wrap items-center gap-1">
											<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
												{clubBoard.totalLeagues} leagues
											</span>
											<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
												{clubBoard.totalTeams} teams
											</span>
											{#if clubBoard.lockedLeagueCount > 0}
												<span class="badge-primary-outlined text-xs uppercase tracking-wide">
													{clubBoard.lockedLeagueCount} locked
												</span>
											{/if}
										</div>
									</div>

									<DataTable
										columns={boardTableColumns}
										rows={clubBoard.leagueRows}
										caption={`${clubBoard.name} leagues table`}
										defaultSort={{ columnKey: 'league', direction: 'asc' }}
									>
										{#snippet emptyBody()}
											<tr class="bg-neutral-25">
												<td
													colspan={boardTableColumns.length}
													class="px-4 py-8 text-center text-sm italic text-neutral-700"
												>
													No leagues have been added to this club yet.
												</td>
											</tr>
										{/snippet}

										{#snippet cell(row, column)}
											{@const leagueRow = row as ClubBoardLeagueRow}
											{#if column.key === 'league'}
												<DataTableLinkedLabel
													label={leagueRow.name}
													href={`/dashboard/clubs/${leagueRow.seasonSlug}/${leagueRow.clubSlug}/${leagueRow.slug}`}
													icon={IconTarget}
												/>
											{:else if column.key === 'teams'}
												<p class="text-sm font-semibold text-neutral-950">
													{leagueRow.teamCount}
												</p>
											{:else if column.key === 'status'}
												<span class={leagueRow.statusClass}>{leagueRow.statusLabel}</span>
											{/if}
										{/snippet}
									</DataTable>
								</article>
							{/each}
						</div>
					{/if}
				</div>
			</section>

			<aside class="w-full min-w-0 space-y-4">
				<DashboardSidebarPanel title="Season Snapshot">
					{#snippet content()}
						<div class="space-y-3 text-sm text-neutral-950">
							<div class="border border-neutral-950 bg-white p-3">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
									Active board
								</p>
								<p class="mt-1 font-semibold">
									{selectedSeasonBoard?.name ?? overallSummary.currentSeasonName}
								</p>
								<p class="mt-1 text-xs text-neutral-700">
									{badgeClubCount} clubs across {badgeLeagueCount} leagues
								</p>
							</div>
							<div class="space-y-2">
								{#each seasonSummary as season}
									<div class="border border-neutral-950 bg-white p-3">
										<div class="flex items-start justify-between gap-3">
											<div class="min-w-0">
												<p class="font-semibold text-neutral-950">{season.name}</p>
												<p class="mt-1 text-xs text-neutral-700">
													{season.leagueCount} leagues and {season.teamCount} teams
												</p>
											</div>
											<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
												{season.clubCount} clubs
											</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/snippet}
				</DashboardSidebarPanel>
			</aside>
		</div>
	</div>
</div>

<CreateClubLeagueWizard
	open={isCreateLeagueModalOpen}
	step={createLeagueStep}
	stepCount={2}
	stepTitle={CREATE_LEAGUE_STEP_TITLES[createLeagueStep]}
	stepProgress={createLeagueStepProgress}
	formError={createLeagueFormError}
	unsavedConfirmOpen={createLeagueWizardUnsavedConfirmOpen}
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
			{#if availableClubs.length === 0}
				<div class="border border-neutral-950 bg-white p-3 text-sm text-neutral-950">
					Add a club sport to {selectedSeason?.name ?? 'the selected season'} before creating a league.
				</div>
			{/if}

			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div class="lg:col-span-2">
					<div class="mb-1 flex min-h-6 items-center gap-1.5">
						<label class="text-sm leading-6 font-sans text-neutral-950" for="club-league-club">
							Club sport <span class="text-error-700">*</span>
						</label>
						<InfoPopover
							buttonAriaLabel="Club sport selection help"
							buttonVariant="label-inline"
							align="left"
							panelWidthClass="w-80"
						>
							<div class="space-y-2">
								<p>Leagues belong to one club sport within the selected club season.</p>
								<p>Examples include Men's, Women's, or Mixed leagues for the same club.</p>
							</div>
						</InfoPopover>
					</div>
					<ListboxDropdown
						options={availableClubs}
						value={createLeagueForm.clubId}
						ariaLabel="Select a club sport"
						buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
						disabled={availableClubs.length === 0}
						on:change={(event) => {
							createLeagueForm.clubId = event.detail.value;
						}}
					/>
					{#if createLeagueFieldErrors['league.clubId']}
						<p class="mt-1 text-xs text-error-700">{createLeagueFieldErrors['league.clubId']}</p>
					{/if}
				</div>

				<div>
					<label for="club-league-name" class="mb-1 block text-sm font-sans text-neutral-950">
						League name <span class="text-error-700">*</span>
					</label>
					<input
						id="club-league-name"
						type="text"
						data-wizard-autofocus
						class="input-secondary"
						value={createLeagueForm.name}
						placeholder="Men's League"
						autocomplete="off"
						oninput={(event) => {
							const value = (event.currentTarget as HTMLInputElement).value;
							createLeagueForm.name = value;
							if (!leagueSlugTouched) {
								createLeagueForm.slug = slugifyFinal(value);
							}
						}}
					/>
					{#if createLeagueFieldErrors['league.name']}
						<p class="mt-1 text-xs text-error-700">{createLeagueFieldErrors['league.name']}</p>
					{/if}
				</div>

				<div>
					<div class="mb-1 flex min-h-6 items-center gap-1.5">
						<label for="club-league-slug" class="text-sm leading-6 font-sans text-neutral-950">
							League slug <span class="text-error-700">*</span>
						</label>
						<InfoPopover
							buttonAriaLabel="Club league slug help"
							buttonVariant="label-inline"
							align="left"
							panelWidthClass="w-80"
						>
							<div class="space-y-2">
								<p>The slug keeps the league URL readable and unique within its club sport.</p>
								<p>Leave the default unless you need a custom path.</p>
							</div>
						</InfoPopover>
					</div>
					<div class="relative">
						<input
							id="club-league-slug"
							type="text"
							class="input-secondary pr-10"
							value={createLeagueForm.slug}
							placeholder="mens-league"
							autocomplete="off"
							oninput={(event) => {
								leagueSlugTouched = true;
								createLeagueForm.slug = applyLiveSlugInput(event.currentTarget as HTMLInputElement);
							}}
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
									createLeagueForm.slug = slugifyFinal(createLeagueForm.name);
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

				<div class="lg:col-span-2">
					<label for="club-league-gender" class="mb-1 block text-sm font-sans text-neutral-950">
						League label
					</label>
					<input
						id="club-league-gender"
						type="text"
						class="input-secondary"
						value={createLeagueForm.gender}
						placeholder="Men's, Women's, or Mixed"
						autocomplete="off"
						oninput={(event) => {
							createLeagueForm.gender = (event.currentTarget as HTMLInputElement).value;
						}}
					/>
				</div>
			</div>
		</div>
	{:else}
		<div class="space-y-4">
			<div class="border border-neutral-950 bg-white p-4">
				<h3 class="text-lg font-bold font-serif text-neutral-950">Review league</h3>
				<div class="mt-3 grid grid-cols-1 gap-3 text-sm text-neutral-950 md:grid-cols-2">
					<div>
						<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-700">Club sport</p>
						<p class="mt-1 font-semibold">{createLeagueClubLabel}</p>
					</div>
					<div>
						<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-700">
							League name
						</p>
						<p class="mt-1 font-semibold">{createLeagueForm.name.trim() || 'Not provided'}</p>
					</div>
					<div>
						<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-700">
							League slug
						</p>
						<p class="mt-1 font-semibold">
							{slugifyFinal(createLeagueForm.slug || createLeagueForm.name) || 'Not provided'}
						</p>
					</div>
					<div>
						<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-700">
							League label
						</p>
						<p class="mt-1 font-semibold">{createLeagueForm.gender.trim() || 'No label set'}</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<WizardStepFooter
			step={createLeagueStep}
			lastStep={2}
			showBack={createLeagueStep > 1}
			canGoNext={!createLeagueSubmitting}
			canSubmit={!createLeagueSubmitting && availableClubs.length > 0}
			nextLabel="Next"
			submitLabel="Create league"
			submittingLabel="Creating..."
			isSubmitting={createLeagueSubmitting}
			on:back={previousCreateLeagueStep}
			on:next={nextCreateLeagueStep}
		/>
	{/snippet}
</CreateClubLeagueWizard>

<CreateClubSeasonWizard
	open={isCreateSeasonModalOpen}
	step={createSeasonStep}
	stepCount={3}
	stepTitle={CREATE_SEASON_STEP_TITLES[createSeasonStep]}
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
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div>
					<label for="club-season-name" class="mb-1 block text-sm font-sans text-neutral-950">
						Season name <span class="text-error-700">*</span>
					</label>
					<input
						id="club-season-name"
						type="text"
						data-wizard-autofocus
						class="input-secondary"
						value={createSeasonForm.name}
						placeholder={DEFAULT_ACADEMIC_SEASON_PLACEHOLDER}
						autocomplete="off"
						oninput={(event) => {
							const value = (event.currentTarget as HTMLInputElement).value;
							createSeasonForm.name = value;
							if (!seasonSlugTouched) {
								createSeasonForm.slug = slugifyFinal(value);
							}
							applyCreateClubSeasonDateInferenceFromName(value);
						}}
					/>
					{#if createSeasonFieldErrors['season.name']}
						<p class="mt-1 text-xs text-error-700">{createSeasonFieldErrors['season.name']}</p>
					{/if}
				</div>

				<div>
					<div class="mb-1 flex min-h-6 items-center gap-1.5">
						<label for="club-season-slug" class="text-sm leading-6 font-sans text-neutral-950">
							Season slug <span class="text-error-700">*</span>
						</label>
						<InfoPopover
							buttonAriaLabel="Club season slug help"
							buttonVariant="label-inline"
							align="left"
							panelWidthClass="w-80"
						>
							<div class="space-y-2">
								<p>The slug is the URL-friendly identifier for this club season.</p>
								<p>Leave the default unless you need a custom URL path.</p>
							</div>
						</InfoPopover>
					</div>
					<div class="relative">
						<input
							id="club-season-slug"
							type="text"
							class="input-secondary pr-10"
							value={createSeasonForm.slug}
							placeholder={DEFAULT_ACADEMIC_SEASON_PLACEHOLDER}
							autocomplete="off"
							oninput={(event) => {
								seasonSlugTouched = true;
								createSeasonForm.slug = applyLiveSlugInput(event.currentTarget as HTMLInputElement);
							}}
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
						<p class="mt-1 text-xs text-error-700">{createSeasonFieldErrors['season.slug']}</p>
					{/if}
				</div>

				<div>
					<label for="club-season-start-date" class="mb-1 block text-sm font-sans text-neutral-950">
						Start date <span class="text-error-700">*</span>
					</label>
					<DatePicker
						id="club-season-start-date"
						type="date"
						inputClass="input-secondary py-2 text-sm"
						on:input={(event) => {
							const nextStartDate = event.detail.value;
							createSeasonStartDateTouched = true;
							createSeasonForm.startDate = nextStartDate;
							syncCreateClubSeasonEndDateFromStart(nextStartDate);
						}}
						on:change={(event) => {
							const nextStartDate = event.detail.value;
							createSeasonStartDateTouched = true;
							createSeasonForm.startDate = nextStartDate;
							syncCreateClubSeasonEndDateFromStart(nextStartDate);
						}}
						bind:value={createSeasonForm.startDate}
					/>
					{#if createSeasonFieldErrors['season.startDate']}
						<p class="mt-1 text-xs text-error-700">{createSeasonFieldErrors['season.startDate']}</p>
					{/if}
				</div>

				<div>
					<label for="club-season-end-date" class="mb-1 block text-sm font-sans text-neutral-950">
						End date
					</label>
					<DatePicker
						id="club-season-end-date"
						type="date"
						inputClass="input-secondary py-2 text-sm"
						on:input={(event) => {
							createSeasonEndDateTouched = true;
							createSeasonForm.endDate = event.detail.value;
						}}
						on:change={(event) => {
							createSeasonEndDateTouched = true;
							createSeasonForm.endDate = event.detail.value;
						}}
						bind:value={createSeasonForm.endDate}
					/>
					{#if createSeasonFieldErrors['season.endDate']}
						<p class="mt-1 text-xs text-error-700">{createSeasonFieldErrors['season.endDate']}</p>
					{/if}
				</div>
			</div>

			<div class="border border-neutral-950 bg-white p-3">
				<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
					<input
						type="checkbox"
						class="toggle-secondary"
						bind:checked={createSeasonForm.isCurrent}
					/>
					Set as current club season
				</label>
			</div>
		</div>
	{/if}

	{#if createSeasonStep === 2}
		<div class="space-y-4">
			<div class="border-2 border-neutral-950 bg-white p-4 space-y-4">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-900">Optional</p>
						<h3 class="text-lg font-bold font-serif text-neutral-950">Copy prior setup</h3>
					</div>
					<InfoPopover buttonAriaLabel="Club season copy help">
						<div class="space-y-2">
							<p>
								Carry structure forward from an earlier club season when you need a faster reset.
							</p>
							<p>
								Clubs, leagues, and teams start enabled by default. Officers, rosters, and schedules
								stay off by default.
							</p>
						</div>
					</InfoPopover>
				</div>

				<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
					<label
						class={`flex items-start gap-2 border p-3 text-sm text-neutral-950 ${
							!createSeasonCopy.enabled
								? 'border-secondary-600 bg-secondary-50'
								: 'border-secondary-300 bg-white'
						}`}
					>
						<input
							type="radio"
							class="radio-secondary mt-0.5"
							name="club-season-copy-mode"
							checked={!createSeasonCopy.enabled}
							data-wizard-autofocus
							onchange={() => {
								createSeasonCopy.enabled = false;
							}}
						/>
						<span>
							<span class="block font-semibold">Blank season</span>
							<span class="block text-xs text-neutral-900">Start fresh and add clubs manually.</span
							>
						</span>
					</label>
					<label
						class={`flex items-start gap-2 border p-3 text-sm text-neutral-950 ${
							createSeasonCopy.enabled
								? 'border-secondary-600 bg-secondary-50'
								: 'border-secondary-300 bg-white'
						} ${data.seasons.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
					>
						<input
							type="radio"
							class="radio-secondary mt-0.5"
							name="club-season-copy-mode"
							checked={createSeasonCopy.enabled}
							disabled={data.seasons.length === 0}
							onchange={() => {
								if (data.seasons.length === 0) return;
								createSeasonCopy.enabled = true;
							}}
						/>
						<span>
							<span class="block font-semibold">Copy existing setup</span>
							<span class="block text-xs text-neutral-900"
								>Bring forward club structure from a prior season.</span
							>
						</span>
					</label>
				</div>

				{#if createSeasonCopy.enabled}
					<div class="space-y-3 border border-neutral-950 bg-neutral p-3">
						<div>
							<p class="mb-1 block text-sm font-sans text-neutral-950">
								Source season <span class="text-error-700">*</span>
							</p>
							<ListboxDropdown
								options={seasonDropdownOptions}
								value={createSeasonSourceSeasonId}
								ariaLabel="Select a source club season"
								buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
								disabled={seasonDropdownOptions.length === 0}
								on:change={(event) => {
									createSeasonCopy.sourceSeasonIds = event.detail.value ? [event.detail.value] : [];
									clearCreateSeasonApiErrors();
								}}
							/>
							{#if createSeasonFieldErrors['copy.sourceSeasonIds']}
								<p class="mt-1 text-xs text-error-700">
									{createSeasonFieldErrors['copy.sourceSeasonIds']}
								</p>
							{/if}
						</div>

						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<label
								class="flex items-center gap-2 border border-neutral-950 bg-white p-3 text-sm text-neutral-950"
							>
								<input
									type="checkbox"
									class="toggle-secondary"
									bind:checked={createSeasonCopy.includeClubs}
									onchange={(event) => {
										handleCopyClubsToggle((event.currentTarget as HTMLInputElement).checked);
									}}
								/>
								Copy clubs
							</label>
							<label
								class={`flex items-center gap-2 border border-neutral-950 bg-white p-3 text-sm text-neutral-950 ${!createSeasonCopy.includeClubs ? 'opacity-60' : ''}`}
							>
								<input
									type="checkbox"
									class="toggle-secondary"
									checked={createSeasonCopy.includeLeagues}
									disabled={!createSeasonCopy.includeClubs}
									onchange={(event) => {
										handleCopyLeaguesToggle((event.currentTarget as HTMLInputElement).checked);
									}}
								/>
								Copy leagues
							</label>
							<label
								class={`flex items-center gap-2 border border-neutral-950 bg-white p-3 text-sm text-neutral-950 ${!createSeasonCopy.includeLeagues ? 'opacity-60' : ''}`}
							>
								<input
									type="checkbox"
									class="toggle-secondary"
									checked={createSeasonCopy.includeTeams}
									disabled={!createSeasonCopy.includeLeagues}
									onchange={(event) => {
										handleCopyTeamsToggle((event.currentTarget as HTMLInputElement).checked);
									}}
								/>
								Copy teams
							</label>
							<label
								class={`flex items-center gap-2 border border-neutral-950 bg-white p-3 text-sm text-neutral-950 ${!createSeasonCopy.includeClubs ? 'opacity-60' : ''}`}
							>
								<input
									type="checkbox"
									class="toggle-secondary"
									bind:checked={createSeasonCopy.includeOfficers}
									disabled={!createSeasonCopy.includeClubs}
								/>
								Copy officers
							</label>
							<label
								class={`flex items-center gap-2 border border-neutral-950 bg-white p-3 text-sm text-neutral-950 ${!createSeasonCopy.includeTeams ? 'opacity-60' : ''}`}
							>
								<input
									type="checkbox"
									class="toggle-secondary"
									bind:checked={createSeasonCopy.includeRosters}
									disabled={!createSeasonCopy.includeTeams}
								/>
								Copy rosters
							</label>
							<label
								class={`flex items-center gap-2 border border-neutral-950 bg-white p-3 text-sm text-neutral-950 ${!createSeasonCopy.includeLeagues ? 'opacity-60' : ''}`}
							>
								<input
									type="checkbox"
									class="toggle-secondary"
									bind:checked={createSeasonCopy.includeSchedules}
									disabled={!createSeasonCopy.includeLeagues}
								/>
								Copy schedules
							</label>
						</div>

						{#if createSeasonFieldErrors['copy.includeClubs']}
							<p class="text-xs text-error-700">{createSeasonFieldErrors['copy.includeClubs']}</p>
						{/if}
						{#if createSeasonFieldErrors['copy.includeLeagues']}
							<p class="text-xs text-error-700">{createSeasonFieldErrors['copy.includeLeagues']}</p>
						{/if}
						{#if createSeasonFieldErrors['copy.includeTeams']}
							<p class="text-xs text-error-700">{createSeasonFieldErrors['copy.includeTeams']}</p>
						{/if}
						{#if createSeasonFieldErrors['copy.includeRosters']}
							<p class="text-xs text-error-700">{createSeasonFieldErrors['copy.includeRosters']}</p>
						{/if}

						<div class="border border-neutral-950 bg-white p-3 space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-900">
								Preview
							</p>
							{#if createSeasonCopySource}
								<p class="text-sm font-semibold text-neutral-950">{createSeasonCopySource.name}</p>
							{/if}
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 text-neutral-950">
								<div class="border border-neutral-950 bg-neutral p-2">
									<p class="text-[11px] font-bold uppercase tracking-wide">Clubs</p>
									<p class="text-lg font-bold font-serif">{createSeasonCopyPreview.clubCount}</p>
								</div>
								<div class="border border-neutral-950 bg-neutral p-2">
									<p class="text-[11px] font-bold uppercase tracking-wide">Leagues</p>
									<p class="text-lg font-bold font-serif">{createSeasonCopyPreview.leagueCount}</p>
								</div>
								<div class="border border-neutral-950 bg-neutral p-2">
									<p class="text-[11px] font-bold uppercase tracking-wide">Teams</p>
									<p class="text-lg font-bold font-serif">{createSeasonCopyPreview.teamCount}</p>
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
			<div class="border-2 border-neutral-950 bg-white p-4 space-y-2">
				<h3 class="text-lg font-bold font-serif text-neutral-950">Season</h3>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Name:</span>
					{createSeasonForm.name || 'TBD'}
				</p>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Slug:</span>
					{slugifyFinal(createSeasonForm.slug || createSeasonForm.name) || 'TBD'}
				</p>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Date range:</span>
					{createSeasonForm.startDate || 'TBD'} to {createSeasonForm.endDate || 'Open-ended'}
				</p>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Current season:</span>
					{createSeasonForm.isCurrent ? 'Yes' : 'No'}
				</p>
			</div>

			<div class="border-2 border-neutral-950 bg-white p-4 space-y-2">
				<h3 class="text-lg font-bold font-serif text-neutral-950">Copy plan</h3>
				{#if createSeasonCopy.enabled && createSeasonCopySource}
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Source:</span>
						{createSeasonCopySource.name}
					</p>
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">Included:</span>
						{[
							createSeasonCopy.includeClubs ? 'clubs' : null,
							createSeasonCopy.includeLeagues ? 'leagues' : null,
							createSeasonCopy.includeTeams ? 'teams' : null,
							createSeasonCopy.includeOfficers ? 'officers' : null,
							createSeasonCopy.includeRosters ? 'rosters' : null,
							createSeasonCopy.includeSchedules ? 'schedules' : null
						]
							.filter(Boolean)
							.join(', ') || 'nothing'}
					</p>
				{:else}
					<p class="text-sm leading-5 text-neutral-950">
						This season will start without copied content.
					</p>
				{/if}
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<WizardStepFooter
			step={createSeasonStep}
			lastStep={3}
			showBack={createSeasonStep > 1}
			canGoNext={!createSeasonSubmitting}
			canSubmit={!createSeasonSubmitting}
			nextLabel="Next"
			submitLabel="Create Season"
			submittingLabel="Creating..."
			isSubmitting={createSeasonSubmitting}
			on:back={previousCreateSeasonStep}
			on:next={nextCreateSeasonStep}
		/>
	{/snippet}
</CreateClubSeasonWizard>

<CreateClubSportWizard
	open={isCreateClubModalOpen}
	step={createClubStep}
	stepCount={2}
	stepTitle={CREATE_CLUB_STEP_TITLES[createClubStep]}
	stepProgress={createClubStepProgress}
	formError={createClubFormError}
	unsavedConfirmOpen={createClubWizardUnsavedConfirmOpen}
	onRequestClose={requestCloseCreateClubWizard}
	onSubmit={() => {
		void submitCreateClubWizard();
	}}
	onInput={clearCreateClubApiErrors}
	onUnsavedConfirm={confirmDiscardCreateClubWizard}
	onUnsavedCancel={cancelDiscardCreateClubWizard}
>
	{#if createClubStep === 1}
		<div class="space-y-4">
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div class="lg:col-span-2">
					<p class="mb-1 block text-sm font-sans text-neutral-950">
						Club season <span class="text-error-700">*</span>
					</p>
					<ListboxDropdown
						options={seasonDropdownOptions}
						value={createClubForm.clubSeasonId}
						ariaLabel="Select a club season"
						buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
						disabled={seasonDropdownOptions.length === 0}
						on:change={(event) => {
							createClubForm.clubSeasonId = event.detail.value;
							clearCreateClubApiErrors();
						}}
					/>
					{#if createClubFieldErrors['club.clubSeasonId']}
						<p class="mt-1 text-xs text-error-700">{createClubFieldErrors['club.clubSeasonId']}</p>
					{/if}
				</div>

				<div>
					<label for="club-sport-name" class="mb-1 block text-sm font-sans text-neutral-950">
						Club name <span class="text-error-700">*</span>
					</label>
					<input
						id="club-sport-name"
						type="text"
						data-wizard-autofocus
						class="input-secondary"
						value={createClubForm.name}
						placeholder="Ice Hockey"
						autocomplete="off"
						oninput={(event) => {
							const value = (event.currentTarget as HTMLInputElement).value;
							createClubForm.name = value;
							if (!clubSlugTouched) {
								createClubForm.slug = slugifyFinal(value);
							}
						}}
					/>
					{#if createClubFieldErrors['club.name']}
						<p class="mt-1 text-xs text-error-700">{createClubFieldErrors['club.name']}</p>
					{/if}
				</div>

				<div>
					<div class="mb-1 flex min-h-6 items-center gap-1.5">
						<label for="club-sport-slug" class="text-sm leading-6 font-sans text-neutral-950">
							Club slug <span class="text-error-700">*</span>
						</label>
						<InfoPopover
							buttonAriaLabel="Club sport slug help"
							buttonVariant="label-inline"
							align="left"
							panelWidthClass="w-80"
						>
							<div class="space-y-2">
								<p>The slug keeps the club sport URL stable for dashboards and direct links.</p>
								<p>Use a short, readable version of the club name.</p>
							</div>
						</InfoPopover>
					</div>
					<div class="relative">
						<input
							id="club-sport-slug"
							type="text"
							class="input-secondary pr-10"
							value={createClubForm.slug}
							placeholder="ice-hockey"
							autocomplete="off"
							oninput={(event) => {
								clubSlugTouched = true;
								createClubForm.slug = applyLiveSlugInput(event.currentTarget as HTMLInputElement);
							}}
						/>
						<HoverTooltip
							text="Revert to default"
							wrapperClass="absolute right-2 top-1/2 inline-flex shrink-0 z-10"
						>
							<button
								type="button"
								tabindex="-1"
								class="-translate-y-1/2 inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none"
								aria-label="Revert club slug to default"
								onclick={() => {
									clubSlugTouched = false;
									createClubForm.slug = slugifyFinal(createClubForm.name);
								}}
							>
								<IconRestore class="h-4 w-4" />
							</button>
						</HoverTooltip>
					</div>
					{#if createClubFieldErrors['club.slug']}
						<p class="mt-1 text-xs text-error-700">{createClubFieldErrors['club.slug']}</p>
					{/if}
				</div>

				<div class="lg:col-span-2">
					<label for="club-sport-label" class="mb-1 block text-sm font-sans text-neutral-950">
						Sport label
					</label>
					<input
						id="club-sport-label"
						type="text"
						class="input-secondary"
						value={createClubForm.sport}
						placeholder="Ice Hockey"
						autocomplete="off"
						oninput={(event) => {
							createClubForm.sport = (event.currentTarget as HTMLInputElement).value;
						}}
					/>
					<p class="mt-1 text-xs text-neutral-700">
						Leave this blank to use the club name as the visible sport label.
					</p>
				</div>
			</div>
		</div>
	{/if}

	{#if createClubStep === 2}
		<div class="space-y-4">
			<div class="border-2 border-neutral-950 bg-white p-4 space-y-2">
				<h3 class="text-lg font-bold font-serif text-neutral-950">Club sport</h3>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Season:</span>
					{createClubSeasonLabel}
				</p>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Name:</span>
					{createClubForm.name || 'TBD'}
				</p>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Slug:</span>
					{slugifyFinal(createClubForm.slug || createClubForm.name) || 'TBD'}
				</p>
				<p class="text-sm leading-5 text-neutral-950">
					<span class="font-semibold">Sport label:</span>
					{createClubForm.sport.trim() || createClubForm.name || 'Will match club name'}
				</p>
			</div>

			<div class="border border-neutral-950 bg-neutral p-3">
				<p class="text-sm leading-5 text-neutral-950">
					Leagues, teams, and officer assignments can be added after the club sport is created.
				</p>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<WizardStepFooter
			step={createClubStep}
			lastStep={2}
			showBack={createClubStep > 1}
			canGoNext={!createClubSubmitting}
			canSubmit={!createClubSubmitting}
			nextLabel="Next"
			submitLabel="Create Club Sport"
			submittingLabel="Creating..."
			isSubmitting={createClubSubmitting}
			on:back={previousCreateClubStep}
			on:next={nextCreateClubStep}
		/>
	{/snippet}
</CreateClubSportWizard>
