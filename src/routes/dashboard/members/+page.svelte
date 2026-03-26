<script lang="ts">
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import {
		IconChevronDown,
		IconChevronLeft,
		IconChevronRight,
		IconChevronUp,
		IconCopy,
		IconDotsVertical,
		IconPlus,
		IconRefresh,
		IconUsers,
		IconX
	} from '@tabler/icons-svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import DashboardMegaSearchLauncher from '$lib/components/dashboard/DashboardMegaSearchLauncher.svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import { toast } from '$lib/toasts';
	import { syncMembersUrlIfReady } from '$lib/members/url-state.js';
	import type {
		CreateMemberResponse,
		MemberAssignableRole,
		MemberDetail,
		MemberListResponse,
		MemberListRow,
		MemberRole,
		MemberSex,
		MemberSortKey,
		PendingInviteListResponse,
		PendingInviteRow,
		SortDirection
	} from '$lib/members/types.js';
	import type { PageData } from './$types';
	import MemberAddWizard, { type MemberAddFormState } from './_components/MemberAddWizard.svelte';
	import MemberDetailModal from './_components/MemberDetailModal.svelte';
	import MemberEditModal, { type MemberEditFormState } from './_components/MemberEditModal.svelte';
	import MemberRoleModal from './_components/MemberRoleModal.svelte';
	import MemberRemoveModal from './_components/MemberRemoveModal.svelte';

	let { data } = $props<{ data: PageData }>();

	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).memberManagement
	);
	const canAddMembers = $derived.by(() => data.permissions?.ADD_MEMBER === true);
	const canManageRoles = $derived.by(() => data.permissions?.CHANGE_MEMBER_ROLE === true);
	const canRemoveMembers = $derived.by(() => data.permissions?.REMOVE_MEMBER === true);
	const memberAssignableRoleOptions = $derived.by(() => data.memberAssignableRoleOptions ?? []);
	const sexFilterOptions = [
		{ value: '', label: 'All Genders' },
		{ value: 'M', label: 'Male' },
		{ value: 'F', label: 'Female' }
	] satisfies Array<{ value: '' | MemberSex; label: string }>;
	const roleFilterOptions = [
		{ value: '', label: 'All Roles' },
		{ value: 'participant', label: 'Participant' },
		{ value: 'manager', label: 'Manager' },
		{ value: 'admin', label: 'Admin' },
		{ value: 'dev', label: 'Developer' }
	] satisfies Array<{ value: '' | MemberRole; label: string }>;

	let members = $state<MemberListRow[]>([]);
	let pendingInvites = $state<PendingInviteRow[]>([]);
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
	let pageError = $state('');
	let pageSuccess = $state('');
	let latestInviteUrl = $state('');
	let membersLoading = $state(false);
	let invitesLoading = $state(false);
	let selectedMemberId = $state<string | null>(null);
	let selectedMember = $state<MemberDetail | null>(null);
	let memberDetailLoading = $state(false);
	let memberDetailError = $state('');
	let viewOpen = $state(false);
	let editOpen = $state(false);
	let roleOpen = $state(false);
	let removeOpen = $state(false);
	let addOpen = $state(false);
	let addStep = $state<1 | 2>(1);
	let addSubmitting = $state(false);
	let addError = $state('');
	let addFieldErrors = $state<Record<string, string>>({});
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
	let addForm = $state<MemberAddFormState>({
		mode: 'invite',
		email: '',
		role: 'participant',
		firstName: '',
		lastName: '',
		studentId: '',
		sex: ''
	});
	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	let fetchAbortController: AbortController | null = null;
	let urlSyncReady = $state(false);
	let fetchCounter = 0;
	const cache = new Map<string, { expiresAt: number; payload: MemberListResponse['data'] }>();
	const detailCache = new Map<string, MemberDetail>();
	let lastPageFeedbackToast = $state('');
	let handledDeepLinkedMemberId = $state<string | null>(null);

	const activeSearch = $derived.by(() => searchQuery.trim());
	const totalPages = $derived.by(() => Math.max(1, Math.ceil(totalCount / pageSize)));
	const visibleRangeStart = $derived.by(() =>
		totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
	);
	const visibleRangeEnd = $derived.by(() =>
		totalCount === 0 ? 0 : visibleRangeStart + members.length - 1
	);
	function normalize(value: string | null | undefined): string {
		return value?.trim() ?? '';
	}

	function effectiveQuery(value: string): string {
		const trimmed = value.trim();
		return trimmed.length >= 2 ? trimmed : '';
	}

	function cacheKey(
		query: string,
		sex: MemberSex | '',
		role: MemberRole | '',
		sort: MemberSortKey,
		dir: SortDirection,
		page: number
	): string {
		return `${query}|${sex}|${role}|${sort}|${dir}|${page}`;
	}

	function isSortedBy(column: MemberSortKey): boolean {
		return sortKey === column;
	}

	function ariaSort(column: MemberSortKey): 'ascending' | 'descending' | 'none' {
		if (!isSortedBy(column)) return 'none';
		return sortDir === 'asc' ? 'ascending' : 'descending';
	}

	function roleToneClass(role: MemberListRow['role'] | PendingInviteRow['role']): string {
		if (role === 'admin') return 'badge-primary-outlined';
		if (role === 'manager') return 'badge-secondary-outlined';
		return 'badge-neutral-outlined';
	}

	function resolveAssignableRoleValue(role: MemberRole): MemberAssignableRole {
		return memberAssignableRoleOptions.some(
			(option: { value: MemberAssignableRole; label: string }) => option.value === role
		)
			? (role as MemberAssignableRole)
			: 'participant';
	}

	function buildPaginationItems(page: number, pageCount: number): Array<number | 'ellipsis'> {
		if (pageCount <= 7) {
			return Array.from({ length: pageCount }, (_, index) => index + 1);
		}

		if (page <= 4) {
			return [1, 2, 3, 4, 5, 'ellipsis', pageCount];
		}

		if (page >= pageCount - 3) {
			return [1, 'ellipsis', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
		}

		return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', pageCount];
	}

	function changePage(nextPage: number): void {
		const boundedPage = Math.max(1, Math.min(nextPage, totalPages));
		if (boundedPage === currentPage || membersLoading) return;
		currentPage = boundedPage;
	}

	function resetFilters(): void {
		searchQuery = '';
		sexFilter = '';
		roleFilter = '';
		sortKey = 'lastName';
		sortDir = 'asc';
		currentPage = 1;
	}

	function syncUrl(): void {
		if (typeof window === 'undefined') return;
		syncMembersUrlIfReady({
			href: window.location.href,
			ready: urlSyncReady,
			replace: (href) => {
				replaceState(href, {});
			},
			state: {
				searchQuery,
				sexFilter,
				roleFilter,
				sortKey,
				sortDir,
				currentPage
			}
		});
	}

	async function fetchMembers(force = false): Promise<void> {
		const query = effectiveQuery(searchQuery);
		const key = cacheKey(query, sexFilter, roleFilter, sortKey, sortDir, currentPage);
		const cached = cache.get(key);
		if (!force && cached && cached.expiresAt > Date.now()) {
			if (cached.payload) {
				members = cached.payload.rows;
				pageSize = cached.payload.pageSize;
				totalCount = cached.payload.totalCount;
				currentPage = cached.payload.page;
				hasNextPage = cached.payload.hasNextPage;
				hasPreviousPage = cached.payload.hasPreviousPage;
			}
			return;
		}

		fetchAbortController?.abort();
		fetchAbortController = new AbortController();
		const requestId = ++fetchCounter;
		membersLoading = true;
		const url = new URL('/api/members', window.location.origin);
		if (query) url.searchParams.set('q', query);
		if (sexFilter) url.searchParams.set('sex', sexFilter);
		if (roleFilter) url.searchParams.set('role', roleFilter);
		url.searchParams.set('sort', sortKey);
		url.searchParams.set('dir', sortDir);
		url.searchParams.set('page', String(currentPage));

		try {
			const response = await fetch(url, { signal: fetchAbortController.signal });
			const payload = (await response.json()) as MemberListResponse;
			if (requestId !== fetchCounter) return;
			if (!response.ok || !payload.success || !payload.data) {
				pageError = payload.error ?? 'Unable to load members right now.';
				return;
			}
			const resolvedKey = cacheKey(
				payload.data.query,
				payload.data.sexFilter ?? '',
				payload.data.roleFilter ?? '',
				payload.data.sort,
				payload.data.dir,
				payload.data.page
			);
			cache.set(resolvedKey, { expiresAt: Date.now() + 60_000, payload: payload.data });
			members = payload.data.rows;
			pageSize = payload.data.pageSize;
			totalCount = payload.data.totalCount;
			currentPage = payload.data.page;
			hasNextPage = payload.data.hasNextPage;
			hasPreviousPage = payload.data.hasPreviousPage;
			pageError = '';
		} catch (error) {
			if ((error as Error).name !== 'AbortError') {
				pageError = 'Unable to load members right now.';
			}
		} finally {
			if (requestId === fetchCounter) membersLoading = false;
		}
	}

	async function refreshInvites(): Promise<void> {
		invitesLoading = true;
		try {
			const response = await fetch('/api/member-invites');
			const payload = (await response.json()) as PendingInviteListResponse;
			if (!response.ok || !payload.success || !payload.data) {
				pageError = payload.error ?? 'Unable to load pending invites.';
				return;
			}
			pendingInvites = payload.data.rows;
		} catch {
			pageError = 'Unable to load pending invites.';
		} finally {
			invitesLoading = false;
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
					: 'Dev memberships remain manual-only.'
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
		addStep = 1;
		addError = '';
		addFieldErrors = {};
		addForm = {
			mode: 'invite',
			email: '',
			role: 'participant',
			firstName: '',
			lastName: '',
			studentId: '',
			sex: ''
		};
	}

	function openAddMember(): void {
		resetAddWizard();
		addOpen = true;
	}

	function closeAddMember(): void {
		addOpen = false;
		resetAddWizard();
	}

	async function openModal(kind: 'view' | 'edit' | 'permissions' | 'remove', row: MemberListRow) {
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

	async function submitAdd(): Promise<void> {
		addSubmitting = true;
		addError = '';
		addFieldErrors = {};
		try {
			const response = await fetch('/api/members', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					mode: addForm.mode,
					email: addForm.email,
					role: addForm.role,
					firstName: addForm.firstName || null,
					lastName: addForm.lastName || null,
					studentId: addForm.studentId || null,
					sex: addForm.sex || null
				})
			});
			const payload = (await response.json()) as CreateMemberResponse;
			if (!response.ok || !payload.success || !payload.data) {
				addError = payload.error ?? 'Unable to add member right now.';
				addFieldErrors = Object.fromEntries(
					Object.entries(payload.fieldErrors ?? {}).map(([key, value]) => [key, value[0] ?? ''])
				);
				return;
			}
			addOpen = false;
			if (payload.data.invite?.inviteUrl) latestInviteUrl = payload.data.invite.inviteUrl;
			pageSuccess = payload.data.member
				? payload.data.reactivatedMembership
					? 'Membership reactivated.'
					: 'Existing user added to this organization.'
				: 'Invite created.';
			await Promise.all([fetchMembers(true), refreshInvites()]);
		} catch {
			addError = 'Unable to add member right now.';
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
				data?: { removedMembershipId?: string; activeClientId?: string | null };
				error?: string;
			};
			if (!response.ok || !payload.success) {
				removeError = payload.error ?? 'Unable to remove member right now.';
				return;
			}
			members = members.filter((row) => row.membershipId !== selectedMemberId);
			detailCache.delete(selectedMemberId);
			removeOpen = false;
			pageSuccess = 'Member removed.';
			if (payload.data?.activeClientId) {
				await invalidateAll();
				await goto('/dashboard');
			}
		} catch {
			removeError = 'Unable to remove member right now.';
		} finally {
			removeSubmitting = false;
		}
	}

	async function handleInviteAction(invite: PendingInviteRow, action: 'regenerate' | 'revoke') {
		try {
			const response = await fetch(`/api/member-invites/${invite.inviteId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action })
			});
			const payload = (await response.json()) as {
				success: boolean;
				data?: { invite?: PendingInviteRow; inviteUrl?: string };
				error?: string;
			};
			if (!response.ok || !payload.success) {
				pageError = payload.error ?? 'Unable to update invite right now.';
				return;
			}
			if (action === 'revoke') {
				pendingInvites = pendingInvites.filter((row) => row.inviteId !== invite.inviteId);
				pageSuccess = 'Invite revoked.';
				return;
			}
			if (payload.data?.invite) {
				pendingInvites = pendingInvites.map((row) =>
					row.inviteId === invite.inviteId ? payload.data!.invite! : row
				);
				latestInviteUrl = payload.data.inviteUrl ?? latestInviteUrl;
				pageSuccess = 'Invite regenerated.';
			}
		} catch {
			pageError = 'Unable to update invite right now.';
		}
	}

	function updateSort(nextSort: MemberSortKey): void {
		if (sortKey === nextSort) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = nextSort;
			sortDir = 'asc';
		}
		currentPage = 1;
	}

	$effect(() => {
		const feedback = pageError.trim() || pageSuccess.trim();
		if (!feedback) {
			lastPageFeedbackToast = '';
			return;
		}

		const variant = pageError.trim() ? 'error' : 'success';
		const signature = `${variant}:${feedback}`;
		if (signature === lastPageFeedbackToast) {
			return;
		}

		lastPageFeedbackToast = signature;
		toast[variant](feedback, {
			id: 'members-page-feedback',
			title: pageLabel
		});
	});

	$effect(() => {
		members = data.members.rows ?? [];
		pendingInvites = data.pendingInvites ?? [];
		searchQuery = data.members.query ?? '';
		sexFilter = data.members.sexFilter ?? '';
		roleFilter = data.members.roleFilter ?? '';
		sortKey = data.members.sort ?? 'lastName';
		sortDir = data.members.dir ?? 'asc';
		currentPage = data.members.page ?? 1;
		pageSize = data.members.pageSize ?? 50;
		totalCount = data.members.totalCount ?? 0;
		hasNextPage = data.members.hasNextPage ?? false;
		hasPreviousPage = data.members.hasPreviousPage ?? false;
		pageError = data.error ?? '';

		cache.set(
			cacheKey(
				effectiveQuery(data.members.query ?? ''),
				data.members.sexFilter ?? '',
				data.members.roleFilter ?? '',
				data.members.sort ?? 'lastName',
				data.members.dir ?? 'asc',
				data.members.page ?? 1
			),
			{
				expiresAt: Date.now() + 60_000,
				payload: data.members
			}
		);
	});

	$effect(() => {
		const deepLinkedMemberId = data.memberId?.trim() ?? '';
		if (!deepLinkedMemberId || handledDeepLinkedMemberId === deepLinkedMemberId) {
			return;
		}

		handledDeepLinkedMemberId = deepLinkedMemberId;
		selectedMemberId = deepLinkedMemberId;
		void loadMember(deepLinkedMemberId).then((detail) => {
			if (!detail) return;
			viewOpen = true;
		});
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		syncUrl();
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(
			() => {
				void fetchMembers();
			},
			activeSearch.length >= 2 ? 250 : 0
		);
		return () => {
			if (searchTimer) clearTimeout(searchTimer);
		};
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
		content="Manage active organization members and pending member invites."
	/>
</svelte:head>

<div class="w-full space-y-4">
	<section class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 py-2 lg:flex-row lg:items-center lg:justify-between">
				<div class="flex items-center gap-3">
					<div
						class="bg-primary text-white border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
						aria-hidden="true"
					>
						<IconUsers class="w-7 h-7 lg:w-8 lg:h-8" />
					</div>
					<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
						{pageLabel}
					</h1>
				</div>
				<DashboardMegaSearchLauncher />
			</div>
		</div>

		<div class="px-4 lg:px-6 space-y-6">
			{#if canAddMembers}
				<div class="flex justify-end">
					<button
						type="button"
						class="button-primary inline-flex items-center gap-2 cursor-pointer"
						onclick={openAddMember}
					>
						<IconPlus class="w-5 h-5" />
						<span>Add Member</span>
					</button>
				</div>
			{/if}
			{#if latestInviteUrl}
				<div class="section-card space-y-2 px-3 py-3 text-sm text-neutral-950">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<p class="font-semibold">Latest invite link</p>
						<button
							type="button"
							class="button-secondary-outlined inline-flex w-full items-center justify-center gap-2 cursor-pointer sm:w-auto"
							onclick={() => navigator.clipboard?.writeText(latestInviteUrl)}
						>
							<IconCopy class="h-4 w-4" />
							Copy Invite Link
						</button>
					</div>
					<p class="break-all text-xs leading-5">{latestInviteUrl}</p>
				</div>
			{/if}

			<div class="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
				<aside class="section-shell space-y-4 p-4">
					<div class="space-y-1">
						<p class="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-950">
							Filters
						</p>
						<p class="text-sm text-neutral-950">
							Use gender and role filters to narrow the member list.
						</p>
					</div>

					<div class="space-y-3">
						<div class="space-y-1">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Gender</p>
							<ListboxDropdown
								options={sexFilterOptions}
								value={sexFilter}
								ariaLabel="Filter members by gender"
								buttonClass="button-secondary-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2"
								on:change={(event) => {
									sexFilter = event.detail.value as MemberSex | '';
									currentPage = 1;
								}}
							/>
						</div>
						<div class="space-y-1">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Role</p>
							<ListboxDropdown
								options={roleFilterOptions}
								value={roleFilter}
								ariaLabel="Filter members by role"
								buttonClass="button-secondary-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2"
								on:change={(event) => {
									roleFilter = event.detail.value as MemberRole | '';
									currentPage = 1;
								}}
							/>
						</div>
					</div>

					<button
						type="button"
						class="button-secondary-outlined inline-flex w-full items-center justify-center gap-2 cursor-pointer"
						disabled={membersLoading}
						onclick={resetFilters}
					>
						Reset Filters
					</button>
				</aside>

				<div class="min-w-0 space-y-4">
					<div class="section-card p-4">
						<SearchInput
							id="member-search"
							label="Search members"
							value={searchQuery}
							placeholder="Search first name, last name, email, or student ID"
							on:input={(event) => {
								searchQuery = event.detail.value;
								currentPage = 1;
							}}
						/>
					</div>

					<div class="section-card hidden overflow-x-auto lg:block">
						<table class="min-w-full border-collapse">
							<thead
								class="border-b border-neutral-950 bg-neutral text-left text-xs uppercase tracking-wide text-neutral-950"
							>
								<tr>
									<th aria-sort={ariaSort('studentId')} class="px-3 py-2">
										<button
											type="button"
											class="inline-flex items-center gap-1.5 font-bold whitespace-nowrap cursor-pointer"
											onclick={() => updateSort('studentId')}
										>
											<span>Student ID</span>
											{#if isSortedBy('studentId')}
												{#if sortDir === 'asc'}
													<IconChevronUp class="h-4 w-4" />
												{:else}
													<IconChevronDown class="h-4 w-4" />
												{/if}
											{/if}
										</button>
									</th>
									<th aria-sort={ariaSort('firstName')} class="px-3 py-2">
										<button
											type="button"
											class="inline-flex items-center gap-1.5 font-bold whitespace-nowrap cursor-pointer"
											onclick={() => updateSort('firstName')}
										>
											<span>First Name</span>
											{#if isSortedBy('firstName')}
												{#if sortDir === 'asc'}
													<IconChevronUp class="h-4 w-4" />
												{:else}
													<IconChevronDown class="h-4 w-4" />
												{/if}
											{/if}
										</button>
									</th>
									<th aria-sort={ariaSort('lastName')} class="px-3 py-2">
										<button
											type="button"
											class="inline-flex items-center gap-1.5 font-bold whitespace-nowrap cursor-pointer"
											onclick={() => updateSort('lastName')}
										>
											<span>Last Name</span>
											{#if isSortedBy('lastName')}
												{#if sortDir === 'asc'}
													<IconChevronUp class="h-4 w-4" />
												{:else}
													<IconChevronDown class="h-4 w-4" />
												{/if}
											{/if}
										</button>
									</th>
									<th aria-sort={ariaSort('email')} class="px-3 py-2">
										<button
											type="button"
											class="inline-flex items-center gap-1.5 font-bold whitespace-nowrap cursor-pointer"
											onclick={() => updateSort('email')}
										>
											<span>Email</span>
											{#if isSortedBy('email')}
												{#if sortDir === 'asc'}
													<IconChevronUp class="h-4 w-4" />
												{:else}
													<IconChevronDown class="h-4 w-4" />
												{/if}
											{/if}
										</button>
									</th>
									<th aria-sort={ariaSort('sex')} class="px-3 py-2">
										<button
											type="button"
											class="inline-flex items-center gap-1.5 font-bold whitespace-nowrap cursor-pointer"
											onclick={() => updateSort('sex')}
										>
											<span>Sex</span>
											{#if isSortedBy('sex')}
												{#if sortDir === 'asc'}
													<IconChevronUp class="h-4 w-4" />
												{:else}
													<IconChevronDown class="h-4 w-4" />
												{/if}
											{/if}
										</button>
									</th>
									<th aria-sort={ariaSort('role')} class="px-3 py-2">
										<button
											type="button"
											class="inline-flex items-center gap-1.5 font-bold whitespace-nowrap cursor-pointer"
											onclick={() => updateSort('role')}
										>
											<span>Role</span>
											{#if isSortedBy('role')}
												{#if sortDir === 'asc'}
													<IconChevronUp class="h-4 w-4" />
												{:else}
													<IconChevronDown class="h-4 w-4" />
												{/if}
											{/if}
										</button>
									</th>
									<th class="px-3 py-2 text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#if members.length === 0}
									<tr>
										<td colspan="7" class="px-3 py-8 text-center text-sm text-neutral-950">
											No members match the current search.
										</td>
									</tr>
								{:else}
									{#each members as row (row.membershipId)}
										<tr
											class={`border-b border-neutral-200 text-sm text-neutral-950 ${
												row.membershipId === selectedMemberId ? 'bg-primary-50' : ''
											}`}
										>
											<td class="px-3 py-3">{row.studentId ?? '--'}</td>
											<td class="px-3 py-3">{row.firstName ?? '--'}</td>
											<td class="px-3 py-3 font-semibold">{row.lastName ?? '--'}</td>
											<td class="px-3 py-3">{row.email ?? '--'}</td>
											<td class="px-3 py-3">{row.sex ?? '--'}</td>
											<td class="px-3 py-3">
												<span class={roleToneClass(row.role)}>{row.role}</span>
											</td>
											<td class="px-3 py-3 text-right">
												<ListboxDropdown
													options={actionOptions(row)}
													value=""
													mode="action"
													align="right"
													ariaLabel={`Actions for ${row.fullName}`}
													buttonClass="button-secondary-outlined dashboard-icon-button cursor-pointer"
													listClass="w-44"
													on:action={(event) =>
														void openModal(
															event.detail.value as 'view' | 'edit' | 'permissions' | 'remove',
															row
														)}
												>
													{#snippet trigger()}<IconDotsVertical class="h-4 w-4" />{/snippet}
												</ListboxDropdown>
											</td>
										</tr>
									{/each}
								{/if}
							</tbody>
						</table>
					</div>

					<div class="grid gap-3 lg:hidden">
						{#if members.length === 0}
							<div class="section-card px-4 py-8 text-center text-sm text-neutral-950">
								No members match the current search.
							</div>
						{:else}
							{#each members as row (row.membershipId)}
								<div
									class={`section-card overflow-hidden ${
										row.membershipId === selectedMemberId ? 'bg-primary-50' : 'bg-white'
									}`}
								>
									<div
										class="flex items-start justify-between gap-3 border-b border-neutral-200 bg-neutral px-4 py-3"
									>
										<div class="min-w-0 space-y-1">
											<div class="flex flex-wrap items-center gap-2">
												<span class="badge-neutral-outlined">
													ID {row.studentId ?? '--'}
												</span>
												<span class={roleToneClass(row.role)}>
													{row.role}
												</span>
											</div>
											<p class="break-words text-base font-semibold text-neutral-950">
												{row.fullName}
											</p>
										</div>
										<ListboxDropdown
											options={actionOptions(row)}
											value=""
											mode="action"
											align="right"
											ariaLabel={`Actions for ${row.fullName}`}
											buttonClass="button-secondary-outlined dashboard-icon-button cursor-pointer"
											listClass="w-44"
											on:action={(event) =>
												void openModal(
													event.detail.value as 'view' | 'edit' | 'permissions' | 'remove',
													row
												)}
										>
											{#snippet trigger()}<IconDotsVertical class="h-4 w-4" />{/snippet}
										</ListboxDropdown>
									</div>
									<div class="space-y-4 px-4 py-4">
										<div class="grid grid-cols-2 gap-3 text-sm text-neutral-950">
											<div class="space-y-1 border border-neutral-200 bg-neutral-50 px-3 py-2">
												<p class="text-[11px] font-bold uppercase tracking-wide">First Name</p>
												<p>{row.firstName ?? '--'}</p>
											</div>
											<div class="space-y-1 border border-neutral-200 bg-neutral-50 px-3 py-2">
												<p class="text-[11px] font-bold uppercase tracking-wide">Last Name</p>
												<p>{row.lastName ?? '--'}</p>
											</div>
										</div>
										<div class="space-y-1">
											<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
												Email
											</p>
											<p class="break-all text-sm leading-5 text-neutral-950">
												{row.email ?? '--'}
											</p>
										</div>
										<div class="grid grid-cols-2 gap-3 text-sm text-neutral-950">
											<div class="space-y-1 border border-neutral-200 bg-neutral-50 px-3 py-2">
												<p class="text-[11px] font-bold uppercase tracking-wide">Sex</p>
												<p>{row.sex ?? '--'}</p>
											</div>
											<div class="space-y-1 border border-neutral-200 bg-neutral-50 px-3 py-2">
												<p class="text-[11px] font-bold uppercase tracking-wide">Role</p>
												<span class={roleToneClass(row.role)}>{row.role}</span>
											</div>
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>

					<div
						class="flex flex-col gap-3 border-t border-neutral-950 pt-3 lg:flex-row lg:items-center lg:justify-between"
					>
						<p class="text-sm text-neutral-950">
							Showing {visibleRangeStart} to {visibleRangeEnd} of {totalCount} members
						</p>
						<div class="flex flex-wrap items-center justify-end gap-1.5">
							<button
								type="button"
								class="pagination-button gap-1"
								disabled={!hasPreviousPage || membersLoading || currentPage <= 1}
								onclick={() => changePage(currentPage - 1)}
							>
								<IconChevronLeft class="h-4 w-4" />
								Previous
							</button>
							{#each buildPaginationItems(currentPage, totalPages) as pageItem, index (`${pageItem}-${index}`)}
								{#if pageItem === 'ellipsis'}
									<span
										class="inline-flex h-9 min-w-9 items-center justify-center px-2 text-sm text-neutral-950"
									>
										...
									</span>
								{:else}
									<button
										type="button"
										class={`pagination-button ${pageItem === currentPage ? 'pagination-button-active' : ''}`}
										disabled={membersLoading}
										onclick={() => changePage(pageItem)}
									>
										{pageItem}
									</button>
								{/if}
							{/each}
							<button
								type="button"
								class="pagination-button gap-1"
								disabled={!hasNextPage || membersLoading || currentPage >= totalPages}
								onclick={() => changePage(currentPage + 1)}
							>
								Next
								<IconChevronRight class="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="section-shell space-y-3 p-4">
		<div class="flex items-center gap-2">
			<h3 class="text-xl font-bold font-serif text-neutral-950">Pending Invites</h3>
			<InfoPopover buttonVariant="label-inline" buttonAriaLabel="Pending invite help">
				<div class="space-y-2">
					<p>Invites remain pending until accepted, revoked, or expired.</p>
					<p>Regenerating an invite invalidates the prior link.</p>
				</div>
			</InfoPopover>
			{#if invitesLoading}<span
					class="text-xs font-semibold uppercase tracking-wide text-neutral-950">Refreshing...</span
				>{/if}
		</div>
		{#if pendingInvites.length === 0}
			<div class="border-2 border-neutral-950 bg-white p-4 text-sm text-neutral-950">
				No pending member invites right now.
			</div>
		{:else}
			<div class="space-y-3">
				{#each pendingInvites as invite (invite.inviteId)}
					<div class="section-card space-y-3 p-4">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div class="min-w-0">
								<p class="break-all font-semibold text-neutral-950">{invite.email}</p>
								<div class="mt-2 flex flex-wrap gap-2">
									<span class="badge-secondary-outlined">
										{invite.mode === 'preprovision' ? 'Pre-Provision' : 'Invite'}
									</span>
									<span class={roleToneClass(invite.role)}>
										{invite.role}
									</span>
								</div>
							</div>
							<div class="flex flex-col gap-2 sm:flex-row">
								<HoverTooltip text="Regenerate invite link">
									<button
										type="button"
										class="button-secondary-outlined inline-flex w-full items-center justify-center gap-2 cursor-pointer sm:w-auto"
										disabled={!canAddMembers}
										onclick={() => handleInviteAction(invite, 'regenerate')}
									>
										<IconRefresh class="h-4 w-4" />
										Regenerate
									</button>
								</HoverTooltip>
								<HoverTooltip text="Revoke invite">
									<button
										type="button"
										class="button-secondary-outlined inline-flex w-full items-center justify-center gap-2 cursor-pointer sm:w-auto"
										disabled={!canAddMembers}
										onclick={() => handleInviteAction(invite, 'revoke')}
									>
										<IconX class="h-4 w-4" />
										Revoke
									</button>
								</HoverTooltip>
							</div>
						</div>
						<div class="grid gap-3 text-sm text-neutral-950 sm:grid-cols-2 lg:grid-cols-4">
							<div class="space-y-1">
								<p class="text-[11px] font-bold uppercase tracking-wide">Name</p>
								<p class="break-words">
									{[invite.firstName, invite.lastName].filter(Boolean).join(' ') || '--'}
								</p>
							</div>
							<div class="space-y-1">
								<p class="text-[11px] font-bold uppercase tracking-wide">Student ID</p>
								<p class="break-words">{invite.studentId ?? '--'}</p>
							</div>
							<div class="space-y-1">
								<p class="text-[11px] font-bold uppercase tracking-wide">Sex</p>
								<p>{invite.sex ?? '--'}</p>
							</div>
							<div class="space-y-1">
								<p class="text-[11px] font-bold uppercase tracking-wide">Expires</p>
								<p class="break-words leading-5">
									<DateHoverText
										display={new Date(invite.expiresAt).toLocaleString()}
										value={invite.expiresAt}
										includeTime
									/>
								</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<MemberAddWizard
	open={addOpen}
	step={addStep}
	form={addForm}
	roleOptions={memberAssignableRoleOptions}
	submitting={addSubmitting}
	error={addError}
	fieldErrors={addFieldErrors}
	onClose={closeAddMember}
	onBack={() => (addStep = 1)}
	onNext={() => (addStep = 2)}
	onSubmit={() => {
		if (addStep === 1) addStep = 2;
		else void submitAdd();
	}}
/>
<MemberDetailModal
	open={viewOpen}
	member={selectedMember}
	loading={memberDetailLoading}
	error={memberDetailError}
	onClose={() => (viewOpen = false)}
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
