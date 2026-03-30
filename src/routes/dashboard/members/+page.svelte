<script lang="ts">
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import {
		IconChevronLeft,
		IconChevronRight,
		IconChevronsLeft,
		IconChevronsRight,
		IconUsers
	} from '@tabler/icons-svelte';
	import DashboardMegaSearchLauncher from '$lib/components/dashboard/DashboardMegaSearchLauncher.svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import DataTableRowActions from '$lib/components/data-table/DataTableRowActions.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { createDataTableRowActionColumn, type DataTableColumn } from '$lib/components/data-table.js';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import {
		buildMemberRoleFilterOptions,
		getResetMemberFilterState
	} from '$lib/members/filter-controls.js';
	import { parseMemberPageInput, resolveClosestMemberPage } from '$lib/members/pagination.js';
	import {
		clearMemberSelectionFromHref,
		syncMembersUrlIfReady
	} from '$lib/members/url-state.js';
	import type {
		CreateMemberResponse,
		MemberAssignableRole,
		MemberDetail,
		MemberListResponse,
		MemberListRow,
		MemberRole,
		MemberSex,
		MemberSortKey,
		SortDirection
	} from '$lib/members/types.js';
	import { toast } from '$lib/toasts';
	import type { PageData } from './$types';
	import MemberAddWizard, { type MemberAddFormState } from './_components/MemberAddWizard.svelte';
	import MemberCredentialsModal from './_components/MemberCredentialsModal.svelte';
	import MemberDetailModal from './_components/MemberDetailModal.svelte';
	import MemberEditModal, { type MemberEditFormState } from './_components/MemberEditModal.svelte';
	import MemberRemoveModal from './_components/MemberRemoveModal.svelte';
	import MemberRoleModal from './_components/MemberRoleModal.svelte';

	type MemberAction = 'view' | 'edit' | 'permissions' | 'remove';
	type FilterSectionId = 'sex' | 'role';

	interface FilterSectionConfig {
		id: FilterSectionId;
		title: string;
		value: string;
		ariaLabel: string;
		options: Array<{ value: string; label: string }>;
	}

	interface MemberCredentialsState {
		email: string;
		memberName: string;
		temporaryPassword: string;
	}

	const createEmptyMembersPayload = () => ({
		rows: [] as MemberListRow[],
		page: 1,
		pageSize: 50,
		totalCount: 0,
		hasNextPage: false,
		hasPreviousPage: false,
		sort: 'lastName' as MemberSortKey,
		dir: 'asc' as SortDirection,
		query: '',
		sexFilter: null as MemberSex | null,
		roleFilter: null as MemberRole | null
	});

	let { data } = $props<{ data: PageData }>();
	const serverMembers = $derived.by(() => data.members ?? createEmptyMembersPayload());
	const serverError = $derived.by(() => data.error ?? '');
	const serverMemberId = $derived.by(() => data.memberId ?? null);

	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).memberManagement
	);
	const canManageRoles = $derived.by(
		() => data.capabilities?.canManageRoles ?? data.permissions?.CHANGE_MEMBER_ROLE === true
	);
	const canRemoveMembers = $derived.by(
		() => data.capabilities?.canRemoveMembers ?? data.permissions?.REMOVE_MEMBER === true
	);
	const memberAssignableRoleOptions = $derived.by(() => data.memberAssignableRoleOptions ?? []);

	const ROLE_LABELS: Record<MemberRole, string> = {
		participant: 'Participant',
		manager: 'Manager',
		admin: 'Admin',
		dev: 'Developer'
	};
	const SEX_LABELS: Record<MemberSex, string> = {
		M: 'Male',
		F: 'Female'
	};
	const sexFilterOptions = [
		{ value: '', label: 'All Sexes' },
		{ value: 'M', label: 'Male' },
		{ value: 'F', label: 'Female' }
	] satisfies Array<{ value: '' | MemberSex; label: string }>;
	const includeDeveloperRoleFilter = $derived.by(
		() =>
			data.permissions?.ACCESS_DEV_TOOLS === true ||
			memberAssignableRoleOptions.some((option) => option.value === 'dev')
	);
	const roleFilterOptions = $derived.by(() =>
		buildMemberRoleFilterOptions(includeDeveloperRoleFilter)
	);
	let members = $state<MemberListRow[]>([]);
	let searchQuery = $state('');
	let sexFilter = $state<MemberSex | ''>('');
	let roleFilter = $state<MemberRole | ''>('');
	let sortKey = $state<MemberSortKey>('lastName');
	let sortDir = $state<SortDirection>('asc');
	let currentPage = $state(1);
	let pageSize = $state(50);
	let totalCount = $state(0);
	let hasNextPage = $state(false);
	let hasPreviousPage = $state(false);
	let membersLoading = $state(false);
	let pageError = $state('');
	let pageSuccess = $state('');
	let selectedMemberId = $state<string | null>(null);
	let selectedMember = $state<MemberDetail | null>(null);
	let memberDetailLoading = $state(false);
	let memberDetailError = $state('');
	let viewOpen = $state(false);
	let editOpen = $state(false);
	let roleOpen = $state(false);
	let removeOpen = $state(false);
	let addOpen = $state(false);
	let addSubmitting = $state(false);
	let addError = $state('');
	let addFieldErrors = $state<Record<string, string>>({});
	let addForm = $state<MemberAddFormState>({
		email: '',
		role: 'participant',
		firstName: '',
		lastName: '',
		studentId: '',
		sex: ''
	});
	let credentialsModalOpen = $state(false);
	let createdCredentials = $state<MemberCredentialsState | null>(null);
	let editForm = $state<MemberEditFormState>({
		email: '',
		firstName: '',
		lastName: '',
		studentId: '',
		sex: ''
	});
	let editSubmitting = $state(false);
	let editError = $state('');
	let editFieldErrors = $state<Record<string, string>>({});
	let roleValue = $state<MemberAssignableRole>('participant');
	let roleSubmitting = $state(false);
	let roleError = $state('');
	let removeSubmitting = $state(false);
	let removeError = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	let fetchAbortController: AbortController | null = null;
	let urlSyncReady = $state(false);
	let fetchCounter = 0;
	let lastPageFeedbackToast = $state('');
	let handledDeepLinkedMemberId = $state<string | null>(null);
	let hydratedServerSignature = $state('');
	let pageInputValue = $state('1');
	const detailCache = new Map<string, MemberDetail>();

	const activeSearch = $derived.by(() => searchQuery.trim());
	const searchReady = $derived.by(() => activeSearch.length >= 2);
	const totalPages = $derived.by(() => Math.max(1, Math.ceil(totalCount / pageSize)));
	const visibleRangeStart = $derived.by(() =>
		totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
	);
	const visibleRangeEnd = $derived.by(() =>
		totalCount === 0 ? 0 : visibleRangeStart + members.length - 1
	);
	const activeFilterCount = $derived.by(() => (sexFilter ? 1 : 0) + (roleFilter ? 1 : 0));
	const filterSections = $derived.by<FilterSectionConfig[]>(() => [
		{
			id: 'sex',
			title: 'Sex',
			value: sexFilter,
			ariaLabel: 'Filter members by sex',
			options: sexFilterOptions
		},
		{
			id: 'role',
			title: 'Role',
			value: roleFilter,
			ariaLabel: 'Filter members by role',
			options: roleFilterOptions
		}
	]);
	const activeFilterBadges = $derived.by(() => {
		const badges: string[] = [];
		if (sexFilter) badges.push(`Sex: ${SEX_LABELS[sexFilter]}`);
		if (roleFilter) badges.push(`Role: ${ROLE_LABELS[roleFilter]}`);
		return badges;
	});
	const memberTableColumns = $derived.by<DataTableColumn<MemberListRow>[]>(() => [
		{
			key: 'member',
			label: 'Member',
			width: '21%',
			rowHeader: true,
			sortValue: (row) => row.fullName
		},
		{
			key: 'studentId',
			label: 'Student ID',
			width: '15%',
			copyText: (row) => row.studentId,
			sortValue: (row) => row.studentId ?? ''
		},
		{
			key: 'email',
			label: 'Email',
			width: '24%',
			copyText: (row) => row.email,
			sortValue: (row) => row.email ?? ''
		},
		{
			key: 'lastLoginAt',
			label: 'Last Login',
			width: '18%',
			sortValue: (row) => row.lastLoginAt ?? ''
		},
		{
			key: 'sex',
			label: 'Sex',
			width: '8%',
			headerTextAlignment: 'center',
			cellTextAlignment: 'center',
			sortValue: (row) => row.sex ?? ''
		},
		{
			key: 'role',
			label: 'Role',
			width: '11%',
			sortValue: (row) => ROLE_LABELS[row.role]
		},
		{
			...createDataTableRowActionColumn({
				key: 'actions'
			})
		}
	]);

	function normalize(value: string | null | undefined): string {
		return value?.trim() ?? '';
	}

	function roleToneClass(role: MemberRole): string {
		if (role === 'admin') return 'badge-primary-outlined';
		if (role === 'manager') return 'badge-secondary-outlined';
		if (role === 'dev') return 'badge-secondary';
		return 'badge-neutral-outlined';
	}

	function formatMemberLastLogin(value: string | null): string {
		if (!value) return '';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return '';
		const date = new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(parsed);
		const time = new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		})
			.format(parsed)
			.replace(/\s([AP]M)$/i, '$1');
		return `${date}, ${time}`;
	}

	function applyMemberPayload(payload: NonNullable<MemberListResponse['data']>): void {
		members = payload.rows;
		pageSize = payload.pageSize;
		totalCount = payload.totalCount;
		currentPage = payload.page;
		hasNextPage = payload.hasNextPage;
		hasPreviousPage = payload.hasPreviousPage;
	}

	function resetMemberResults(): void {
		members = [];
		pageSize = 50;
		totalCount = 0;
		currentPage = 1;
		hasNextPage = false;
		hasPreviousPage = false;
	}

	function handleFilterChange(filterId: FilterSectionId, value: string): void {
		if (filterId === 'sex') sexFilter = value as MemberSex | '';
		else roleFilter = value as MemberRole | '';
		currentPage = 1;
	}

	function resolveAssignableRoleValue(role: MemberRole): MemberAssignableRole {
		return memberAssignableRoleOptions.some((option) => option.value === role)
			? (role as MemberAssignableRole)
			: 'participant';
	}

	function changePage(nextPage: number): void {
		const boundedPage = resolveClosestMemberPage(nextPage, totalPages);
		if (boundedPage === currentPage || membersLoading || !searchReady) return;
		currentPage = boundedPage;
	}

	function commitPageInput(): void {
		const resolvedPage = parseMemberPageInput(pageInputValue, currentPage, totalPages);
		pageInputValue = String(resolvedPage);
		changePage(resolvedPage);
	}

	function handlePageInput(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const digitsOnly = input.value.replace(/\D/g, '');
		if (!digitsOnly) {
			pageInputValue = '';
			return;
		}
		pageInputValue = String(Math.max(1, Number.parseInt(digitsOnly, 10)));
	}

	function handlePageInputKeydown(event: KeyboardEvent): void {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			commitPageInput();
			return;
		}
		if (['e', 'E', '+', '-', '.'].includes(event.key)) {
			event.preventDefault();
			return;
		}
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			setTimeout(() => {
				pageInputValue = input.value;
				commitPageInput();
			}, 0);
		}
	}

	function resetFilters(): void {
		const resetState = getResetMemberFilterState(searchQuery);
		searchQuery = resetState.searchQuery;
		sexFilter = resetState.sexFilter;
		roleFilter = resetState.roleFilter;
		sortKey = resetState.sortKey;
		sortDir = resetState.sortDir;
		currentPage = resetState.currentPage;
		resetMemberResults();
	}

	function syncUrl(): void {
		if (typeof window === 'undefined') return;
		syncMembersUrlIfReady({
			href: window.location.href,
			ready: urlSyncReady,
			replace: (href) => {
				replaceState(href, {});
			},
			state: { searchQuery, sexFilter, roleFilter, sortKey, sortDir, currentPage }
		});
	}

	async function fetchMembers(): Promise<void> {
		if (typeof window === 'undefined') return;
		if (!searchReady) {
			fetchAbortController?.abort();
			membersLoading = false;
			pageError = '';
			resetMemberResults();
			return;
		}

		fetchAbortController?.abort();
		fetchAbortController = new AbortController();
		const requestId = ++fetchCounter;
		const url = new URL('/api/members', window.location.origin);
		url.searchParams.set('q', activeSearch);
		url.searchParams.set('sort', sortKey);
		url.searchParams.set('dir', sortDir);
		url.searchParams.set('page', String(currentPage));
		if (sexFilter) url.searchParams.set('sex', sexFilter);
		if (roleFilter) url.searchParams.set('role', roleFilter);

		membersLoading = true;
		pageError = '';

		try {
			const response = await fetch(url, { signal: fetchAbortController.signal });
			const payload = (await response.json()) as MemberListResponse;
			if (requestId !== fetchCounter) return;
			if (!response.ok || !payload.success || !payload.data) {
				resetMemberResults();
				pageError = payload.error ?? 'Unable to load members right now.';
				return;
			}
			applyMemberPayload(payload.data);
		} catch (error) {
			if ((error as Error).name === 'AbortError') return;
			resetMemberResults();
			pageError = 'Unable to load members right now.';
		} finally {
			if (requestId === fetchCounter) membersLoading = false;
		}
	}

	async function loadMember(membershipId: string, force = false): Promise<MemberDetail | null> {
		const cached = detailCache.get(membershipId);
		if (cached && !force) {
			selectedMember = cached;
			return cached;
		}

		memberDetailLoading = true;
		memberDetailError = '';

		try {
			const response = await fetch(`/api/members/${membershipId}`);
			const payload = (await response.json()) as {
				success: boolean;
				data?: { member: MemberDetail };
				error?: string;
			};
			if (!response.ok || !payload.success || !payload.data) {
				memberDetailError = payload.error ?? 'Unable to load member details.';
				return null;
			}

			detailCache.set(membershipId, payload.data.member);
			selectedMember = payload.data.member;
			return payload.data.member;
		} catch {
			memberDetailError = 'Unable to load member details.';
			return null;
		} finally {
			memberDetailLoading = false;
		}
	}

	function patchMember(member: MemberDetail): void {
		detailCache.set(member.membershipId, member);
		selectedMember = member;
		members = members.map((row) => (row.membershipId === member.membershipId ? member : row));
	}

	function syncFromServerPayload(): void {
		applyMemberPayload(serverMembers);
		searchQuery = serverMembers.query;
		sexFilter = serverMembers.sexFilter ?? '';
		roleFilter = serverMembers.roleFilter ?? '';
		sortKey = serverMembers.sort;
		sortDir = serverMembers.dir;
		pageError = serverError;
		selectedMemberId = serverMemberId;
	}

	function actionOptions(row: MemberListRow) {
		return [
			{ value: 'view', label: 'View' },
			{ value: 'edit', label: 'Edit' },
			{
				value: 'permissions',
				label: 'Permissions',
				disabled: !canManageRoles || row.role === 'dev',
				disabledTooltip: !canManageRoles
					? 'Only administrators and developers can change roles.'
					: 'Developer memberships remain manual-only.'
			},
			{
				value: 'remove',
				label: 'Remove',
				disabled: !canRemoveMembers,
				disabledTooltip: 'Only administrators and developers can remove members.'
			}
		];
	}

	function resetAddWizard(): void {
		addError = '';
		addFieldErrors = {};
		addForm = {
			email: '',
			role: 'participant',
			firstName: '',
			lastName: '',
			studentId: '',
			sex: ''
		};
	}

	function closeAddMember(): void {
		addOpen = false;
		resetAddWizard();
	}

	function closeCredentialsModal(): void {
		createdCredentials = null;
		credentialsModalOpen = false;
	}

	function closeViewMemberDetails(): void {
		viewOpen = false;
		if (typeof window === 'undefined') return;
		const nextHref = clearMemberSelectionFromHref(window.location.href);
		replaceState(nextHref, {});
	}

	async function openModal(kind: MemberAction, row: MemberListRow): Promise<void> {
		selectedMemberId = row.membershipId;
		const detail = await loadMember(row.membershipId);
		if (!detail) return;
		if (kind === 'view') {
			viewOpen = true;
			return;
		}
		if (kind === 'edit') {
			editForm = {
				email: normalize(detail.email),
				firstName: normalize(detail.firstName),
				lastName: normalize(detail.lastName),
				studentId: normalize(detail.studentId),
				sex: detail.sex ?? ''
			};
			editOpen = true;
			return;
		}
		if (kind === 'permissions') {
			roleValue = resolveAssignableRoleValue(detail.role);
			roleOpen = true;
			return;
		}
		removeOpen = true;
	}

	async function refreshMembersAfterMutation(): Promise<void> {
		if (searchReady) await fetchMembers();
		else resetMemberResults();
	}

	async function submitAdd(): Promise<void> {
		addSubmitting = true;
		addError = '';
		addFieldErrors = {};

		try {
			const response = await fetch('/api/members', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					email: addForm.email,
					role: addForm.role,
					firstName: addForm.firstName,
					lastName: addForm.lastName,
					studentId: addForm.studentId,
					sex: addForm.sex
				})
			});
			const payload = (await response.json()) as CreateMemberResponse;
			if (!response.ok || !payload.success || !payload.data) {
				addError = payload.error ?? 'Unable to add this member right now.';
				addFieldErrors = Object.fromEntries(
					Object.entries(payload.fieldErrors ?? {}).map(([key, value]) => [key, value[0] ?? ''])
				);
				return;
			}

			closeAddMember();
			pageSuccess = payload.data.createdNewUser
				? 'Member account created with temporary credentials.'
				: payload.data.reactivatedMembership
					? 'Membership reactivated.'
					: 'Existing account added to this organization.';

			if (payload.data.createdNewUser && payload.data.temporaryPassword) {
				createdCredentials = {
					email: payload.data.member.email ?? addForm.email,
					memberName: payload.data.member.fullName,
					temporaryPassword: payload.data.temporaryPassword
				};
				credentialsModalOpen = true;
			}

			await refreshMembersAfterMutation();
		} catch {
			addError = 'Unable to add this member right now.';
		} finally {
			addSubmitting = false;
		}
	}

	async function submitEdit(): Promise<void> {
		if (!selectedMemberId) return;
		editSubmitting = true;
		editError = '';
		editFieldErrors = {};

		try {
			const response = await fetch(`/api/members/${selectedMemberId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'edit-profile',
					email: editForm.email,
					firstName: editForm.firstName || null,
					lastName: editForm.lastName || null,
					studentId: editForm.studentId || null,
					sex: editForm.sex || null
				})
			});
			const payload = (await response.json()) as {
				success: boolean;
				data?: { member: MemberDetail };
				error?: string;
				fieldErrors?: Record<string, string[]>;
			};
			if (!response.ok || !payload.success || !payload.data) {
				editError = payload.error ?? 'Unable to save member changes.';
				editFieldErrors = Object.fromEntries(
					Object.entries(payload.fieldErrors ?? {}).map(([key, value]) => [key, value[0] ?? ''])
				);
				return;
			}

			patchMember(payload.data.member);
			editOpen = false;
			pageSuccess = 'Member updated.';
		} catch {
			editError = 'Unable to save member changes.';
		} finally {
			editSubmitting = false;
		}
	}

	async function submitRole(): Promise<void> {
		if (!selectedMemberId) return;
		roleSubmitting = true;
		roleError = '';

		try {
			const response = await fetch(`/api/members/${selectedMemberId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'set-role', role: roleValue })
			});
			const payload = (await response.json()) as {
				success: boolean;
				data?: { member: MemberDetail; authMode?: Record<string, unknown> };
				error?: string;
			};
			if (!response.ok || !payload.success || !payload.data) {
				roleError = payload.error ?? 'Unable to change member role.';
				return;
			}

			patchMember(payload.data.member);
			roleOpen = false;
			pageSuccess = 'Member role updated.';
			if (payload.data.authMode) {
				await invalidateAll();
				await goto('/dashboard');
			}
		} catch {
			roleError = 'Unable to change member role.';
		} finally {
			roleSubmitting = false;
		}
	}

	async function submitRemove(): Promise<void> {
		if (!selectedMemberId) return;
		removeSubmitting = true;
		removeError = '';

		try {
			const response = await fetch(`/api/members/${selectedMemberId}`, { method: 'DELETE' });
			const payload = (await response.json()) as {
				success: boolean;
				data?: { activeClientId?: string | null };
				error?: string;
			};
			if (!response.ok || !payload.success) {
				removeError = payload.error ?? 'Unable to remove this member right now.';
				return;
			}

			detailCache.delete(selectedMemberId);
			removeOpen = false;
			pageSuccess = 'Member removed.';
			if (payload.data?.activeClientId) {
				await invalidateAll();
				await goto('/dashboard');
				return;
			}
			await refreshMembersAfterMutation();
		} catch {
			removeError = 'Unable to remove this member right now.';
		} finally {
			removeSubmitting = false;
		}
	}

	$effect(() => {
		if (includeDeveloperRoleFilter || roleFilter !== 'dev') return;
		roleFilter = '';
		currentPage = 1;
	});

	$effect(() => {
		const nextSignature = JSON.stringify({
			rows: serverMembers.rows.map((row) => row.membershipId),
			page: serverMembers.page,
			pageSize: serverMembers.pageSize,
			totalCount: serverMembers.totalCount,
			hasNextPage: serverMembers.hasNextPage,
			hasPreviousPage: serverMembers.hasPreviousPage,
			sort: serverMembers.sort,
			dir: serverMembers.dir,
			query: serverMembers.query,
			sexFilter: serverMembers.sexFilter,
			roleFilter: serverMembers.roleFilter,
			error: serverError,
			memberId: serverMemberId
		});
		if (nextSignature === hydratedServerSignature) return;
		hydratedServerSignature = nextSignature;
		syncFromServerPayload();
	});

	$effect(() => {
		const feedback = pageError.trim() || pageSuccess.trim();
		if (!feedback) {
			lastPageFeedbackToast = '';
			return;
		}
		const variant = pageError.trim() ? 'error' : 'success';
		const signature = `${variant}:${feedback}`;
		if (signature === lastPageFeedbackToast) return;
		lastPageFeedbackToast = signature;
		toast[variant](feedback, {
			id: 'members-page-feedback',
			title: 'Member management'
		});
	});

	$effect(() => {
		const deepLinkedMemberId = serverMemberId;
		if (!deepLinkedMemberId || handledDeepLinkedMemberId === deepLinkedMemberId) return;
		handledDeepLinkedMemberId = deepLinkedMemberId;
		selectedMemberId = deepLinkedMemberId;
		void loadMember(deepLinkedMemberId).then((detail) => {
			if (!detail) return;
			viewOpen = true;
		});
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		if (!urlSyncReady) return;
		syncUrl();
		if (searchTimer) clearTimeout(searchTimer);
		if (!searchReady) {
			fetchAbortController?.abort();
			membersLoading = false;
			pageError = '';
			resetMemberResults();
			return;
		}
		searchTimer = setTimeout(() => {
			void fetchMembers();
		}, 250);
		return () => {
			if (searchTimer) clearTimeout(searchTimer);
		};
	});

	$effect(() => {
		pageInputValue = String(currentPage);
	});

	onMount(() => {
		urlSyncReady = true;
	});

	onDestroy(() => {
		if (searchTimer) clearTimeout(searchTimer);
		fetchAbortController?.abort();
	});
</script>

<PageTitle pageTitle={pageLabel} />

<svelte:head>
	<meta
		name="description"
		content="Search, filter, and manage organization members in one workspace."
	/>
</svelte:head>

<div class="w-full space-y-4">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 py-2 lg:flex-row lg:items-center lg:justify-between">
				<div class="flex items-center gap-3">
					<div
						class="bg-primary text-white border-2 border-primary-700 flex h-[2.75rem] w-[2.75rem] items-center justify-center lg:h-[3.4rem] lg:w-[3.4rem]"
						aria-hidden="true"
					>
						<IconUsers class="h-7 w-7 lg:h-8 lg:w-8" />
					</div>
					<h1
						class="text-5xl leading-[0.9] font-bold font-serif tracking-[0.01em] text-neutral-950 lg:text-6xl"
					>
						{pageLabel}
					</h1>
				</div>
				<DashboardMegaSearchLauncher />
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6">
		<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
			<section class="min-w-0 space-y-2">
				{#if activeFilterCount > 0}
					<div class="flex flex-wrap items-center gap-2">
						{#each activeFilterBadges as badge (badge)}
							<span class="badge-neutral-outlined text-xs uppercase tracking-wide">
								{badge}
							</span>
						{/each}
					</div>
				{/if}

				<div class="space-y-2">
					<div class="section-shell overflow-hidden p-0">
						<div class="overflow-x-auto">
							<DataTable
								columns={memberTableColumns}
								rows={members}
								caption="Members table"
								defaultSort={{ columnKey: 'member', direction: 'asc' }}
								rowId={(row) => `member-row-${row.membershipId}`}
								rowClass={(row) =>
									[
										'group group/row',
										row.membershipId === selectedMemberId ? 'bg-primary-100/60' : ''
									]
										.filter(Boolean)
										.join(' ')}
							>
								{#snippet emptyBody()}
									<tr class="bg-neutral-25">
										<td
											colspan={memberTableColumns.length}
											class="px-4 py-10 text-center text-sm text-neutral-950"
										>
											{#if membersLoading || !searchReady}
												<div class="mx-auto flex max-w-sm flex-col items-center gap-3" aria-hidden="true">
													<div class="h-6 w-44 bg-neutral-100"></div>
													<div class="h-3 w-28 bg-neutral-100"></div>
													<div class="flex flex-wrap items-center justify-center gap-1">
														<div class="h-5 w-16 bg-neutral-100"></div>
														<div class="h-5 w-16 bg-neutral-100"></div>
														<div class="h-5 w-16 bg-neutral-100"></div>
													</div>
												</div>
											{:else if pageError}
												<div class="space-y-2">
													<p class="font-semibold">Unable to load members.</p>
													<p>{pageError}</p>
												</div>
											{:else}
												<div class="space-y-2">
													<p class="font-semibold">No members matched this search.</p>
													<p>Try a different name, email, student ID, or adjust the filters.</p>
												</div>
											{/if}
										</td>
									</tr>
								{/snippet}

								{#snippet cell(row, column)}
									{#if column.key === 'member'}
										<button
											type="button"
											class="min-w-0 py-1 text-left cursor-pointer focus-visible:outline-none"
											onclick={() => void openModal('view', row)}
										>
											<span
												class="text-sm font-bold text-neutral-950 group-hover:underline group-focus-within:underline"
											>
												{row.fullName}
											</span>
										</button>
									{:else if column.key === 'studentId'}
										<span class="py-1 text-sm font-semibold uppercase tracking-[0.08em] text-neutral-700">
											{row.studentId ?? '--'}
										</span>
								{:else if column.key === 'email'}
									<span class="break-all py-1 text-sm text-neutral-950">{row.email ?? '--'}</span>
								{:else if column.key === 'lastLoginAt'}
									{@const lastLoginDisplay = formatMemberLastLogin(row.lastLoginAt)}
									{#if lastLoginDisplay}
										<DateHoverText
											display={lastLoginDisplay}
											value={row.lastLoginAt}
											includeTime
											wrapperClass="inline"
											textClass="py-1 text-sm font-semibold text-neutral-950"
										/>
									{:else}
										<span class="py-1 text-sm text-neutral-700">Never</span>
									{/if}
								{:else if column.key === 'sex'}
									<span class="py-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-950">
										{row.sex ?? '--'}
									</span>
								{:else if column.key === 'role'}
									<span class={`${roleToneClass(row.role)} px-2 py-0.5 text-xs uppercase tracking-wide`}>
										{ROLE_LABELS[row.role]}
									</span>
									{:else if column.key === 'actions'}
										<DataTableRowActions
											options={actionOptions(row)}
											ariaLabel={`Actions for ${row.fullName}`}
											listClass="w-44"
											on:action={(event) => void openModal(event.detail.value as MemberAction, row)}
										/>
									{/if}
								{/snippet}
							</DataTable>
						</div>
					</div>

					<div
						class="flex flex-col gap-3 pt-1 lg:flex-row lg:items-center lg:justify-between"
					>
						<div class="flex flex-wrap items-center gap-2 text-sm text-neutral-950">
							<button
								type="button"
								class="pagination-button h-8 min-w-8 px-1.5"
								aria-label="Go to first page"
								disabled={!searchReady || totalCount === 0 || !hasPreviousPage || membersLoading || currentPage <= 1}
								onclick={() => changePage(1)}
							>
								<IconChevronsLeft class="h-4 w-4" />
							</button>
							<button
								type="button"
								class="pagination-button h-8 min-w-8 px-1.5"
								aria-label="Go to previous page"
								disabled={!searchReady || totalCount === 0 || !hasPreviousPage || membersLoading || currentPage <= 1}
								onclick={() => changePage(currentPage - 1)}
							>
								<IconChevronLeft class="h-4 w-4" />
							</button>
							<label class="font-semibold text-neutral-700" for="members-page-input">Page</label>
							<input
								id="members-page-input"
								type="number"
								min="1"
								step="1"
								class="input-neutral no-native-number-spinner h-8 w-10 px-2 py-0 text-center font-semibold tabular-nums"
								value={pageInputValue}
								disabled={!searchReady || totalCount === 0 || membersLoading}
								aria-label="Current page number"
								onfocus={(event) => event.currentTarget.select()}
								oninput={handlePageInput}
								onblur={commitPageInput}
								onkeydown={handlePageInputKeydown}
							/>
							<span class="font-semibold text-neutral-700">of {totalPages}</span>
							<button
								type="button"
								class="pagination-button h-8 min-w-8 px-1.5"
								aria-label="Go to next page"
								disabled={!searchReady || totalCount === 0 || !hasNextPage || membersLoading || currentPage >= totalPages}
								onclick={() => changePage(currentPage + 1)}
							>
								<IconChevronRight class="h-4 w-4" />
							</button>
							<button
								type="button"
								class="pagination-button h-8 min-w-8 px-1.5"
								aria-label="Go to last page"
								disabled={!searchReady || totalCount === 0 || !hasNextPage || membersLoading || currentPage >= totalPages}
								onclick={() => changePage(totalPages)}
							>
								<IconChevronsRight class="h-4 w-4" />
							</button>
						</div>
						<p class="text-sm font-semibold text-neutral-950 lg:text-right">
							{#if membersLoading}
								Refreshing rows...
							{:else if totalCount === 0}
								No results
							{:else}
								Rows {visibleRangeStart} - {visibleRangeEnd} of {totalCount}
							{/if}
						</p>
					</div>
				</div>
			</section>

			<aside class="w-full min-w-0 2xl:sticky 2xl:top-4">
				<section class="border-2 border-neutral-950 bg-neutral">
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
						<h2 class="dashboard-section-title text-neutral-950">Filters</h2>
					</div>

					<div class="space-y-4 p-4">
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Search</p>
							<SearchInput
								id="member-search"
								label="Search members"
								value={searchQuery}
								type="search"
								placeholder="Search by name, email, or student ID"
								inputClass="input-neutral min-h-10 pl-10 pr-10 py-2 text-sm disabled:cursor-not-allowed"
								clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer"
								on:input={(event) => {
									searchQuery = event.detail.value;
									currentPage = 1;
								}}
							/>
						</div>

						<div class="space-y-4">
							{#each filterSections as section (section.id)}
								<section class="space-y-2">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										{section.title}
									</p>
									<ListboxDropdown
										options={section.options}
										value={section.value}
										ariaLabel={section.ariaLabel}
										buttonClass="button-neutral-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2"
										on:change={(event) => handleFilterChange(section.id, event.detail.value)}
									/>
								</section>
							{/each}
						</div>

						<button
							type="button"
							class="button-neutral-outlined inline-flex w-full cursor-pointer items-center justify-center gap-2"
							onclick={resetFilters}
						>
							Reset Filters
						</button>
					</div>
				</section>
			</aside>
		</div>
	</div>
</div>

<MemberAddWizard
	open={addOpen}
	form={addForm}
	roleOptions={memberAssignableRoleOptions}
	submitting={addSubmitting}
	error={addError}
	fieldErrors={addFieldErrors}
	onClose={closeAddMember}
	onSubmit={() => void submitAdd()}
/>
<MemberCredentialsModal
	open={credentialsModalOpen}
	email={createdCredentials?.email ?? ''}
	memberName={createdCredentials?.memberName ?? 'New member'}
	temporaryPassword={createdCredentials?.temporaryPassword ?? ''}
	onClose={closeCredentialsModal}
/>
<MemberDetailModal
	open={viewOpen}
	member={selectedMember}
	loading={memberDetailLoading}
	error={memberDetailError}
	onClose={closeViewMemberDetails}
/>
<MemberEditModal
	open={editOpen}
	form={editForm}
	submitting={editSubmitting}
	error={editError}
	fieldErrors={editFieldErrors}
	onClose={() => (editOpen = false)}
	onSubmit={() => void submitEdit()}
/>
<MemberRoleModal
	open={roleOpen}
	memberName={selectedMember?.fullName ?? 'this member'}
	{roleValue}
	roleOptions={memberAssignableRoleOptions}
	submitting={roleSubmitting}
	error={roleError}
	onClose={() => (roleOpen = false)}
	onSubmit={() => void submitRole()}
	on:roleChange={(event) => (roleValue = event.detail.value)}
/>
<MemberRemoveModal
	open={removeOpen}
	memberName={selectedMember?.fullName ?? 'this member'}
	submitting={removeSubmitting}
	error={removeError}
	onClose={() => (removeOpen = false)}
	onSubmit={() => void submitRemove()}
/>
