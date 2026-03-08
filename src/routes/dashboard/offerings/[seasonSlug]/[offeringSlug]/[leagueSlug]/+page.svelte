<script lang="ts">
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import OfferingsTable from '$lib/components/OfferingsTable.svelte';
	import type { OfferingsTableColumn } from '$lib/components/offerings-table.js';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import type { ManageIntramuralLeagueResponse } from '$lib/server/intramural-offerings-validation';
	import { toast } from '$lib/toasts';
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
		IconPlus,
		IconShip,
		IconTarget,
		IconTrash
	} from '@tabler/icons-svelte';

	type DivisionSection = NonNullable<PageData['divisions']>[number];
	type PlacementValue = 'active' | 'waitlist';

	interface DropdownOption {
		value: string;
		label: string;
		description?: string;
		statusLabel?: string;
		disabled?: boolean;
		separatorBefore?: boolean;
		tooltip?: string;
		disabledTooltip?: string;
	}

	type TeamActionValue = 'move-team' | 'invite-members' | 'team-settings' | 'delete-team';

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
		dateRegistered: string | null;
		description: string | null;
	}

	interface TeamActionContext {
		id: string;
		name: string;
		currentDivisionId: string;
		currentDivisionName: string;
		currentPlacement: PlacementValue;
	}

	interface MoveTeamWizardForm {
		divisionId: string;
		placement: PlacementValue;
	}

	type ActiveTeamRow = DivisionSection['teams'][number];
	type WaitlistTeamRow = NonNullable<PageData['waitlistTeams']>[number];

	const ROW_DROPDOWN_BUTTON_CLASS =
		'w-full min-w-[10rem] border border-secondary-300 bg-white px-3 py-1.5 text-xs leading-5 font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-neutral-50 focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0';
	const ACTION_DROPDOWN_BUTTON_CLASS =
		'inline-flex h-9 w-9 items-center justify-center border-0 bg-transparent p-0 text-secondary-700 cursor-pointer opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:bg-neutral-100 hover:text-secondary-900 focus:outline-none focus-visible:bg-neutral-100 focus-visible:text-secondary-900';
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

	function toTitleCase(value: string | null | undefined): string | null {
		const normalized = value?.trim();
		if (!normalized) return null;
		return normalized
			.split(/[\s_-]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
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

	function divisionTableColumnsFor(canManage: boolean): OfferingsTableColumn[] {
		return [
			{
				key: 'team',
				label: 'Team',
				widthClass: canManage ? 'w-[32%]' : 'w-[36%]',
				rowHeader: true
			},
			{
				key: 'registration',
				label: 'Team Registration',
				widthClass: canManage ? 'w-[22%]' : 'w-[24%]',
				cellClass: 'align-top'
			},
			{
				key: 'roster',
				label: 'Roster',
				widthClass: canManage ? 'w-[14%]' : 'w-[16%]',
				cellClass: 'align-top'
			},
			{
				key: 'status',
				label: 'Status',
				widthClass: canManage ? 'w-[16%]' : 'w-[24%]',
				cellClass: 'align-top'
			},
			...(canManage
				? [
						{
							key: 'manage',
							label: '',
							widthClass: 'w-[16%]',
							cellClass: 'align-top'
						}
					]
				: [])
		];
	}

	function waitlistTableColumnsFor(canManage: boolean): OfferingsTableColumn[] {
		return [
			{
				key: 'team',
				label: 'Team',
				widthClass: canManage ? 'w-[24%]' : 'w-[28%]',
				rowHeader: true
			},
			{
				key: 'registration',
				label: 'Team Registration',
				widthClass: canManage ? 'w-[18%]' : 'w-[20%]',
				cellClass: 'align-top'
			},
			{
				key: 'preferred-division',
				label: 'Preferred Division',
				widthClass: canManage ? 'w-[18%]' : 'w-[20%]',
				cellClass: 'align-top'
			},
			{
				key: 'roster',
				label: 'Roster',
				widthClass: canManage ? 'w-[12%]' : 'w-[12%]',
				cellClass: 'align-top'
			},
			{
				key: 'status',
				label: 'Status',
				widthClass: canManage ? 'w-[16%]' : 'w-[20%]',
				cellClass: 'align-top'
			},
			...(canManage
				? [
						{
							key: 'manage',
							label: '',
							widthClass: 'w-[12%]',
							cellClass: 'align-top'
						}
					]
				: [])
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

	const divisionOptions = $derived.by<DropdownOption[]>(() =>
		data.divisions.map((division: DivisionSection) => ({
			value: division.id,
			label: division.name,
			statusLabel: `${divisionCapacityLabel(division)}${division.isLocked ? ' / Locked' : ''}`
		}))
	);

	const placementOptions = [
		{ value: 'active', label: 'Division', statusLabel: 'Counts against division capacity' },
		{ value: 'waitlist', label: 'Waitlist', statusLabel: 'Saved for later placement' }
	] satisfies DropdownOption[];

	const divisionTableColumns = $derived.by<OfferingsTableColumn[]>(() =>
		divisionTableColumnsFor(canManageLeague)
	);

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
				dateRegistered: team.dateRegistered,
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
			dateRegistered: team.dateRegistered,
			description: team.description
		}))
	]);

	let createDivisionOpen = $state(false);
	let createTeamOpen = $state(false);
	let createDivisionUnsavedConfirmOpen = $state(false);
	let createTeamUnsavedConfirmOpen = $state(false);
	let createDivisionSubmitting = $state(false);
	let createTeamSubmitting = $state(false);
	let createDivisionValidationVisible = $state(false);
	let createDivisionSlugTouched = $state(false);
	let createTeamSlugTouched = $state(false);
	let createDivisionFormError = $state('');
	let createTeamFormError = $state('');
	let createDivisionServerFieldErrors = $state<Record<string, string>>({});
	let createTeamServerFieldErrors = $state<Record<string, string>>({});
	let createDivisionForm = $state<DivisionWizardForm>(defaultDivisionForm());
	let createTeamForm = $state<TeamWizardForm>(defaultTeamForm());
	let createDivisionInitialForm = $state<DivisionWizardForm>(defaultDivisionForm());
	let createTeamInitialForm = $state<TeamWizardForm>(defaultTeamForm());
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

	function clearCreateDivisionApiErrors(): void {
		createDivisionFormError = '';
		if (Object.keys(createDivisionServerFieldErrors).length > 0) {
			createDivisionServerFieldErrors = {};
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
		createDivisionServerFieldErrors = {};
		createDivisionFormError = '';
		createDivisionUnsavedConfirmOpen = false;
	}

	function resetCreateTeamWizard(
		divisionId = data.divisions[0]?.id ?? '',
		placement: PlacementValue = 'active'
	): void {
		createTeamInitialForm = {
			...defaultTeamForm(divisionId),
			placement
		};
		createTeamForm = { ...createTeamInitialForm };
		createTeamSlugTouched = false;
		createTeamServerFieldErrors = {};
		createTeamFormError = '';
		createTeamUnsavedConfirmOpen = false;
	}

	function openCreateDivisionWizard(): void {
		resetCreateDivisionWizard();
		createDivisionOpen = true;
	}

	function openCreateTeamWizard(
		divisionId = data.divisions[0]?.id ?? '',
		placement: PlacementValue = 'active'
	): void {
		resetCreateTeamWizard(divisionId, placement);
		createTeamOpen = true;
	}

	function closeCreateDivisionWizard(): void {
		createDivisionOpen = false;
		resetCreateDivisionWizard();
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
	}

	function openMoveTeamWizard(team: TeamActionContext): void {
		moveTeamContext = team;
		resetMoveTeamWizard(team);
	}

	function closeMoveTeamWizard(): void {
		moveTeamContext = null;
		resetMoveTeamWizard(null);
	}

	function hasUnsavedCreateDivisionChanges(): boolean {
		return JSON.stringify(createDivisionForm) !== JSON.stringify(createDivisionInitialForm);
	}

	function hasUnsavedCreateTeamChanges(): boolean {
		return JSON.stringify(createTeamForm) !== JSON.stringify(createTeamInitialForm);
	}

	function hasUnsavedMoveTeamChanges(): boolean {
		return JSON.stringify(moveTeamForm) !== JSON.stringify(moveTeamInitialForm);
	}

	function hasUnsavedLeagueWizardChanges(): boolean {
		return (
			(createDivisionOpen && hasUnsavedCreateDivisionChanges()) ||
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

	function getCreateDivisionFieldErrors(values: DivisionWizardForm): Record<string, string> {
		const errors: Record<string, string> = {};
		const name = values.name.trim();
		const slug = values.slug.trim();
		const normalizedName = name.toLowerCase();
		const normalizedSlug = slug.toLowerCase();
		const maxTeams = Number(values.maxTeams);

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
				(division: DivisionSection) => division.name.trim().toLowerCase() === normalizedName
			)
		) {
			errors['name'] = 'A division with this name already exists for this league.';
		}

		if (
			slug &&
			data.divisions.some(
				(division: DivisionSection) => division.slug.trim().toLowerCase() === normalizedSlug
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

		if (!name) errors['name'] = 'Team name is required.';
		if (!slug) errors['slug'] = 'Team slug is required.';
		if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
			errors['slug'] = 'Team slug must use lowercase letters, numbers, and dashes only.';
		}
		if (!values.divisionId) {
			errors['divisionId'] = 'Select a division for this team.';
		}

		if (
			values.divisionId &&
			!data.divisions.some((division: DivisionSection) => division.id === values.divisionId)
		) {
			errors['divisionId'] = 'Select a valid division for this league.';
		}

		if (slug && allLeagueTeams.some((team) => team.slug.trim().toLowerCase() === normalizedSlug)) {
			errors['slug'] = 'A team with this slug already exists in this league.';
		}

		if (values.placement === 'active' && values.divisionId && isDivisionFull(values.divisionId)) {
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
		...(createDivisionValidationVisible ? getCreateDivisionFieldErrors(createDivisionForm) : {}),
		...createDivisionServerFieldErrors
	}));

	const createTeamFieldErrors = $derived.by(() => ({
		...getCreateTeamFieldErrors(createTeamForm),
		...createTeamServerFieldErrors
	}));

	const moveTeamFieldErrors = $derived.by(() => getMoveTeamFieldErrors(moveTeamForm));

	const canSubmitCreateDivision = $derived.by(() => !createDivisionSubmitting);

	const canSubmitCreateTeam = $derived.by(
		() =>
			Object.keys(getCreateTeamFieldErrors(createTeamForm)).length === 0 && !createTeamSubmitting
	);

	const canSubmitMoveTeam = $derived.by(
		() =>
			Boolean(moveTeamContext) &&
			Object.keys(getMoveTeamFieldErrors(moveTeamForm)).length === 0 &&
			hasUnsavedMoveTeamChanges() &&
			!moveTeamSubmitting
	);

	async function createDivision(): Promise<void> {
		createDivisionValidationVisible = true;
		const clientErrors = getCreateDivisionFieldErrors(createDivisionForm);
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

	async function createTeam(): Promise<void> {
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

	function handleTeamAction(action: TeamActionValue, team: TeamActionContext): void {
		if (action === 'move-team') {
			openMoveTeamWizard(team);
			return;
		}

		if (action === 'delete-team') {
			openRemoveTeam(team);
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
				<h1
					class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
				>
					{data.league?.name ?? 'League'}
				</h1>
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6 space-y-4">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex flex-wrap items-center gap-2">
				{#if data.offering}
					<span
						class="border border-secondary-300 bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-neutral-950"
					>
						{data.offering.name}
					</span>
				{/if}
				{#if data.season}
					<span
						class="border border-secondary-300 bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-neutral-950"
					>
						{data.season.name}
					</span>
				{/if}
				{#if data.league?.isLocked}
					<span
						class="border border-primary-700 bg-primary text-white px-2 py-1 text-xs font-bold uppercase tracking-wide"
					>
						Locked league
					</span>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
				<span class="border border-secondary-300 bg-white px-2 py-1">
					{data.summary.divisionCount} divisions
				</span>
				<span class="border border-secondary-300 bg-white px-2 py-1">
					{data.summary.activeTeamCount} active teams
				</span>
				<span class="border border-secondary-300 bg-white px-2 py-1">
					{data.summary.waitlistCount} waitlist
				</span>
			</div>
		</div>

		{#if data.error}
			<div class="border-2 border-warning-300 bg-warning-50 p-4 text-sm text-neutral-950">
				{data.error}
			</div>
		{/if}

		{#if data.league}
			<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
				<aside class="order-2 space-y-4">
					<section class="border-2 border-neutral-950 bg-white">
						<div class="border-b border-neutral-950 px-3 py-2">
							<h2 class="text-xl font-serif font-bold text-neutral-950">League Info</h2>
						</div>
						<div class="p-3">
							<div class="space-y-3 text-sm text-neutral-950">
								<div class="border-b border-secondary-200 pb-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Regular Season
									</p>
									<p class="mt-1 font-semibold">
										{formatDateRange(data.league.seasonStartDate, data.league.seasonEndDate)}
									</p>
								</div>
								<div class="border-b border-secondary-200 pb-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Team Registration
									</p>
									<p class="mt-1">
										Start:{' '}
										<DateHoverText
											display={formatDateTime(data.league.regStartDate)}
											value={data.league.regStartDate}
											includeTime
										/>
									</p>
									<p>
										End:{' '}
										<DateHoverText
											display={formatDateTime(data.league.regEndDate)}
											value={data.league.regEndDate}
											includeTime
										/>
									</p>
								</div>
								<div class="border-b border-secondary-200 pb-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										League Setup
									</p>
									<p class="mt-1">Gender: {toTitleCase(data.league.gender) ?? 'Open'}</p>
									<p>Skill: {toTitleCase(data.league.skillLevel) ?? 'All Levels'}</p>
								</div>
								<div class="border-b border-secondary-200 pb-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Players
									</p>
									<p class="mt-1">
										Min: {data.offering?.minPlayers ?? 'TBD'} / Max: {data.offering?.maxPlayers ??
											'TBD'}
									</p>
								</div>
								<div class="pb-1">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Waitlist Registration
									</p>
									<p class="mt-1">{data.summary.waitlistCount} teams waiting for placement</p>
									{#if data.offering?.rulebookUrl}
										<a
											href={data.offering.rulebookUrl}
											target="_blank"
											rel="noreferrer"
											class="mt-2 inline-flex text-sm font-semibold text-secondary-900 underline underline-offset-2"
										>
											Open rulebook
										</a>
									{/if}
								</div>
							</div>
						</div>
					</section>

					<section class="space-y-3">
						{#each data.divisions as division}
							<div class="border-2 border-neutral-950 bg-white">
								<div class="border-b border-neutral-950 px-3 py-2">
									<div class="flex items-center justify-between gap-2">
										<a
											href={divisionHref(division)}
											class="text-lg font-serif font-bold text-neutral-950 hover:underline"
										>
											{division.name}
										</a>
										<HoverTooltip
											text={division.isLocked ? 'Division is locked' : 'Division is unlocked'}
											wrapperClass="inline-flex"
										>
											<span
												class="inline-flex h-7 w-7 items-center justify-center border border-secondary-300 bg-neutral text-neutral-950"
											>
												{#if division.isLocked}
													<IconLock class="h-4 w-4" />
												{:else}
													<IconLockOpen class="h-4 w-4" />
												{/if}
											</span>
										</HoverTooltip>
									</div>
									<p class="mt-1 text-xs font-semibold text-neutral-950">
										{divisionCapacityLabel(division)}
									</p>
								</div>
								<div class="p-3">
									<table class="min-w-full text-xs text-neutral-950">
										<thead>
											<tr class="border-b border-secondary-200">
												<th class="px-1 py-1 text-left font-bold uppercase tracking-wide">Team</th>
												<th class="px-1 py-1 text-right font-bold uppercase tracking-wide">W-L-T</th
												>
												<th class="px-1 py-1 text-right font-bold uppercase tracking-wide">Pts</th>
											</tr>
										</thead>
										<tbody>
											{#if division.standings.length > 0}
												{#each division.standings.slice(0, 3) as row}
													<tr class="border-b border-secondary-100 last:border-b-0">
														<td class="px-1 py-1 font-semibold">{row.teamName}</td>
														<td class="px-1 py-1 text-right">{row.wins}-{row.losses}-{row.ties}</td>
														<td class="px-1 py-1 text-right">{row.points}</td>
													</tr>
												{/each}
											{:else}
												<tr>
													<td colspan="3" class="px-1 py-3 text-center italic text-neutral-700">
														No teams
													</td>
												</tr>
											{/if}
										</tbody>
									</table>
									<a
										href={divisionHref(division)}
										class="mt-3 inline-flex text-xs font-bold uppercase tracking-wide text-secondary-900 underline underline-offset-2"
									>
										Full standings
									</a>
								</div>
							</div>
						{/each}
					</section>

					<section class="border-2 border-neutral-950 bg-white">
						<div class="border-b border-neutral-950 bg-secondary-700/65 px-3 py-2 text-white">
							<h2 class="text-xl font-serif font-bold">League Description</h2>
						</div>
						<div class="p-5 text-center">
							<p class="text-4xl font-serif font-bold text-primary-900">
								Welcome to the {data.league.name} League!
							</p>
							<p class="mx-auto mt-4 max-w-4xl text-base leading-7 text-neutral-950">
								{data.league.description ??
									data.offering?.description ??
									'No league description has been added yet.'}
							</p>
							{#if data.offering?.rulebookUrl}
								<p class="mt-4 text-sm font-semibold text-secondary-900">
									<a
										href={data.offering.rulebookUrl}
										target="_blank"
										rel="noreferrer"
										class="underline underline-offset-2"
									>
										League Rules and Handbook
									</a>
								</p>
							{/if}
						</div>
					</section>

					<section class="border-2 border-neutral-950 bg-white">
						<div class="border-b border-neutral-950 bg-secondary-700/65 px-3 py-2 text-white">
							<div class="flex items-center justify-between gap-3">
								<h2 class="text-xl font-serif font-bold">Announcements</h2>
								<span
									class="border border-white/50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
								>
									No posts
								</span>
							</div>
						</div>
						<div class="p-4 text-center italic text-neutral-700">Nothing posted yet...</div>
					</section>

					{#if canManageLeague}
						<section class="border-2 border-neutral-950 bg-neutral">
							<div class="border-b border-neutral-950 px-4 py-3">
								<div class="flex flex-col gap-3">
									<div>
										<p class="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-950">
											League Admin
										</p>
										<h2 class="mt-1 text-2xl font-serif font-bold text-neutral-950">
											Manage Divisions and Teams
										</h2>
									</div>
									<div class="flex flex-wrap gap-2">
										<button
											type="button"
											class="button-secondary inline-flex items-center gap-2 cursor-pointer"
											onclick={openCreateDivisionWizard}
										>
											<IconPlus class="h-4 w-4" />
											<span>New Division</span>
										</button>
									</div>
								</div>
							</div>
							<div class="grid gap-3 p-4">
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Division Capacity
									</p>
									<p class="mt-2 text-sm leading-6 text-neutral-950">
										Admins can add divisions, cap them, and keep new signups on the waitlist until
										space opens.
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Team Movement
									</p>
									<p class="mt-2 text-sm leading-6 text-neutral-950">
										Use the row controls below to move teams between divisions or promote them out
										of the waitlist.
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<div class="mb-1 flex min-h-6 items-center gap-1.5">
										<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
											Admin Notes
										</p>
										<InfoPopover buttonVariant="label-inline" buttonAriaLabel="League admin help">
											<div class="space-y-2">
												<p>Locked divisions stay visible but can be kept closed to participants.</p>
												<p>Waitlisted teams do not count toward a division's active team total.</p>
											</div>
										</InfoPopover>
									</div>
									<p class="mt-2 text-sm leading-6 text-neutral-950">
										All new divisions and teams are created through the shared wizard flow for
										consistent setup and validation.
									</p>
								</div>
							</div>
						</section>
					{/if}
				</aside>

				<div class="order-1 space-y-4">
					<section class="hidden border-2 border-neutral-950 bg-white">
						<div class="border-b border-neutral-950 bg-secondary-700/65 px-3 py-2 text-white">
							<h2 class="text-xl font-serif font-bold">League Description</h2>
						</div>
						<div class="p-5 text-center">
							<p class="text-4xl font-serif font-bold text-primary-900">
								Welcome to the {data.league.name} League!
							</p>
							<p class="mx-auto mt-4 max-w-4xl text-base leading-7 text-neutral-950">
								{data.league.description ??
									data.offering?.description ??
									'No league description has been added yet.'}
							</p>
							{#if data.offering?.rulebookUrl}
								<p class="mt-4 text-sm font-semibold text-secondary-900">
									<a
										href={data.offering.rulebookUrl}
										target="_blank"
										rel="noreferrer"
										class="underline underline-offset-2"
									>
										League Rules and Handbook
									</a>
								</p>
							{/if}
						</div>
					</section>

					<section class="hidden border-2 border-neutral-950 bg-white">
						<div class="border-b border-neutral-950 bg-secondary-700/65 px-3 py-2 text-white">
							<div class="flex items-center justify-between gap-3">
								<h2 class="text-xl font-serif font-bold">Announcements</h2>
								<span
									class="border border-white/50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
								>
									No posts
								</span>
							</div>
						</div>
						<div class="p-4 text-center italic text-neutral-700">Nothing posted yet...</div>
					</section>

					{#if canManageLeague}
						<section class="hidden border-2 border-neutral-950 bg-neutral">
							<div class="border-b border-neutral-950 px-4 py-3">
								<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
									<div>
										<p class="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-950">
											League Admin
										</p>
										<h2 class="mt-1 text-2xl font-serif font-bold text-neutral-950">
											Manage Divisions and Teams
										</h2>
									</div>
									<div class="flex flex-wrap gap-2">
										<button
											type="button"
											class="button-secondary inline-flex items-center gap-2 cursor-pointer"
											onclick={openCreateDivisionWizard}
										>
											<IconPlus class="h-4 w-4" />
											<span>New Division</span>
										</button>
									</div>
								</div>
							</div>
							<div class="grid gap-3 p-4 md:grid-cols-3">
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Division Capacity
									</p>
									<p class="mt-2 text-sm leading-6 text-neutral-950">
										Admins can add divisions, cap them, and keep new signups on the waitlist until
										space opens.
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Team Movement
									</p>
									<p class="mt-2 text-sm leading-6 text-neutral-950">
										Use the row controls below to move teams between divisions or promote them out
										of the waitlist.
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<div class="mb-1 flex min-h-6 items-center gap-1.5">
										<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
											Admin Notes
										</p>
										<InfoPopover buttonVariant="label-inline" buttonAriaLabel="League admin help">
											<div class="space-y-2">
												<p>Locked divisions stay visible but can be kept closed to participants.</p>
												<p>Waitlisted teams do not count toward a division's active team total.</p>
											</div>
										</InfoPopover>
									</div>
									<p class="mt-2 text-sm leading-6 text-neutral-950">
										All new divisions and teams are created through the shared wizard flow for
										consistent setup and validation.
									</p>
								</div>
							</div>
						</section>
					{/if}

					{#each data.divisions as division}
						<section
							id={`division-${division.slug || division.id}`}
							class="border-2 border-neutral-950 bg-white scroll-mt-4"
						>
							<div
								class="border-b border-neutral-950 bg-neutral-200 px-3 py-2.5 text-neutral-950"
							>
								<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
									<div class="flex items-start gap-3">
										<span
											class="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center text-secondary-900"
										>
											{#if division.isLocked}
												<IconLock class="h-5 w-5" />
											{:else}
												<IconLockOpen class="h-5 w-5" />
											{/if}
										</span>
										<div>
											<h2
												class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl font-serif font-bold"
											>
												<span>{division.name}</span>
												<span class="text-base font-sans font-semibold text-neutral-900">
													{divisionCapacityLabel(division)}
												</span>
											</h2>
											{#if divisionMetaLine(division)}
												<p
													class="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-800"
												>
													{divisionMetaLine(division)}
												</p>
											{/if}
										</div>
									</div>
								</div>
							</div>

							<div class="space-y-4 p-4">
								{#if division.description}
									<p class="text-sm leading-6 text-neutral-950">{division.description}</p>
								{/if}

								<OfferingsTable
									columns={divisionTableColumns}
									rows={division.teams}
									caption={`${division.name} teams table`}
									rowClass={() => (canManageLeague ? 'group' : '')}
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
													<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
														<p class="text-sm font-bold text-neutral-950 font-sans">
															{activeTeam.name}
														</p>
														<span class="text-xs leading-snug text-neutral-700 font-sans">
															Captain: {captainLabel(activeTeam.captainName)}
														</span>
													</div>
													{#if activeTeam.description}
														<p class="mt-1 text-xs leading-snug text-neutral-700 font-sans">
															{activeTeam.description}
														</p>
													{/if}
												</div>
											</div>
										{:else if column.key === 'registration'}
											<p class="text-xs leading-snug text-neutral-950 font-sans">
												<DateHoverText
													display={formatDateTime(activeTeam.dateRegistered)}
													value={activeTeam.dateRegistered}
													includeTime
													wrapperClass="inline"
												/>
											</p>
										{:else if column.key === 'roster'}
											<p class="text-xs leading-snug text-neutral-950 font-sans">
												{activeTeam.rosterSize} /
												{#if hasRosterLimit()}
													{data.offering?.maxPlayers}
												{:else}
													<span aria-label="No max players">&infin;</span>
												{/if}
											</p>
										{:else if column.key === 'status'}
											<span class={`${approvalBadgeClass(true)} text-xs uppercase tracking-wide`}>
												{approvalBadgeLabel(true)}
											</span>
										{:else if column.key === 'manage' && canManageLeague}
											<div class="flex justify-end">
												<ListboxDropdown
													options={teamActionOptions({
														id: activeTeam.id,
														name: activeTeam.name,
														currentDivisionId: division.id,
														currentDivisionName: division.name,
														currentPlacement: 'active'
													})}
													value=""
													mode="action"
													align="right"
													ariaLabel={`Actions for ${activeTeam.name}`}
													buttonClass={ACTION_DROPDOWN_BUTTON_CLASS}
													listClass={ACTION_DROPDOWN_LIST_CLASS}
													optionClass={ACTION_DROPDOWN_OPTION_CLASS}
													activeOptionClass="bg-neutral-100 text-neutral-950"
													on:action={(event) =>
														handleTeamAction(event.detail.value as TeamActionValue, {
															id: activeTeam.id,
															name: activeTeam.name,
															currentDivisionId: division.id,
															currentDivisionName: division.name,
															currentPlacement: 'active'
														})}
												>
													{#snippet trigger()}<IconDots class="h-4 w-4" />{/snippet}
												</ListboxDropdown>
											</div>
										{/if}
									{/snippet}
								</OfferingsTable>
							</div>
						</section>
					{/each}

					<section class="border-2 border-neutral-950 bg-white">
						<div class="border-b border-neutral-950 bg-neutral-200 px-3 py-2.5 text-neutral-950">
							<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h2 class="text-xl font-serif font-bold">League Waitlist</h2>
									<p class="text-sm text-neutral-900">
										{data.summary.waitlistCount} team{data.summary.waitlistCount === 1 ? '' : 's'} waiting
										for placement
									</p>
								</div>
							</div>
						</div>
						<OfferingsTable
							columns={waitlistTableColumns}
							rows={data.waitlistTeams}
							caption="League waitlist table"
							rowClass={() => (canManageLeague ? 'group' : '')}
						>
							{#snippet emptyBody()}
								<tr class="bg-neutral-25">
									<td
										colspan={waitlistTableColumns.length}
										class="px-2 py-8 text-center text-sm italic text-neutral-700"
									>
										No teams are on the waitlist right now.
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
											<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
												<p class="text-sm font-bold text-neutral-950 font-sans">
													{waitlistTeam.name}
												</p>
												<span class="text-xs leading-snug text-neutral-700 font-sans">
													Captain: {captainLabel(waitlistTeam.captainName)}
												</span>
											</div>
											{#if waitlistTeam.description}
												<p class="mt-1 text-xs leading-snug text-neutral-700 font-sans">
													{waitlistTeam.description}
												</p>
											{/if}
										</div>
									</div>
								{:else if column.key === 'registration'}
									<p class="text-xs leading-snug text-neutral-950 font-sans">
										<DateHoverText
											display={formatDateTime(waitlistTeam.dateRegistered)}
											value={waitlistTeam.dateRegistered}
											includeTime
											wrapperClass="inline"
										/>
									</p>
								{:else if column.key === 'preferred-division'}
									<p class="text-xs leading-snug text-neutral-950 font-sans">
										{waitlistTeam.preferredDivisionName}
									</p>
								{:else if column.key === 'roster'}
									<p class="text-xs leading-snug text-neutral-950 font-sans">
										{waitlistTeam.rosterSize} /
										{#if hasRosterLimit()}
											{data.offering?.maxPlayers}
										{:else}
											<span aria-label="No max players">&infin;</span>
										{/if}
									</p>
								{:else if column.key === 'status'}
									<span class={`${approvalBadgeClass(false)} text-xs uppercase tracking-wide`}>
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
	onSlugTouchedChange={(value) => {
		createDivisionSlugTouched = value;
	}}
	onRequestClose={requestCloseCreateDivisionWizard}
	onSubmit={createDivision}
	onInput={clearCreateDivisionApiErrors}
	onUnsavedConfirm={closeCreateDivisionWizard}
	onUnsavedCancel={() => {
		createDivisionUnsavedConfirmOpen = false;
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
	{placementOptions}
	unsavedConfirmOpen={createTeamUnsavedConfirmOpen}
	onSlugTouchedChange={(value) => {
		createTeamSlugTouched = value;
	}}
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
