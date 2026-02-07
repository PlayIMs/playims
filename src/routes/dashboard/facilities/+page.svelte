<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import IconPlus from '@tabler/icons-svelte/icons/plus';
	import IconPencil from '@tabler/icons-svelte/icons/pencil';
	import IconArchive from '@tabler/icons-svelte/icons/archive';
	import IconRestore from '@tabler/icons-svelte/icons/restore';
	import IconCheck from '@tabler/icons-svelte/icons/check';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import IconAlertCircle from '@tabler/icons-svelte/icons/alert-circle';
	import IconSearch from '@tabler/icons-svelte/icons/search';
	import IconMapPin from '@tabler/icons-svelte/icons/map-pin';
	import IconSquare from '@tabler/icons-svelte/icons/square';
	import IconTransfer from '@tabler/icons-svelte/icons/transfer';
	import IconMapPinPlus from '@tabler/icons-svelte/icons/map-pin-plus';
	import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right';
	import IconExternalLink from '@tabler/icons-svelte/icons/external-link';
	import IconBuilding from '@tabler/icons-svelte/icons/building';

	let { data, form }: PageProps = $props();

	// Typed form data for accessing custom fields
	const formData = $derived(form as unknown as Record<string, unknown> | null);

	let viewArchiveMode = $state(false);
	let facilitySearch = $state('');
	let areaSearch = $state('');

	let isCreateFacilityOpen = $state(false);
	let isCreateAreaOpen = $state(false);
	let editingFacilityId = $state<string | null>(null);
	let editingAreaId = $state<string | null>(null);
	let expandedFacilityIds = $state<Set<string>>(new Set());
	let showNewFacilityAddress = $state(false);
	let newFacilityAddressLine1 = $state('');
	let newFacilityAddressLine2 = $state('');
	let newFacilityCity = $state('');
	let newFacilityState = $state('');
	let newFacilityPostalCode = $state('');
	let newFacilityCountry = $state('');
	let newFacilityTimezone = $state('');
	let newFacilityNotes = $state('');
	let newFacilitySlug = $state('');
	let newFacilityName = $state('');
	let newAreaCode = $state('');
	let newAreaName = $state('');
	let slugTouched = $state(false);
	let areaSlugTouched = $state(false);
	let creatingAreaForFacilityId = $state<string | null>(null);

	// Facility edit drafts
	let facilityDrafts = $state<
		Record<
			string,
			{
				name: string;
				slug: string;
				addressLine1: string;
				addressLine2: string;
				city: string;
				state: string;
				postalCode: string;
				country: string;
				timezone: string;
				description: string;
				_addressExpanded?: boolean;
			}
		>
	>({});

	// Area edit drafts
	let areaDrafts = $state<
		Record<string, { name: string; slug: string; _addressExpanded?: boolean }>
	>({});

	// Confirm modal (archive/restore/delete).
	type ConfirmIntent =
		| { kind: 'facility-archive' | 'facility-restore'; facilityId: string }
		| { kind: 'area-archive' | 'area-restore'; facilityAreaId: string }
		| { kind: 'facility-delete'; facilityId: string; slug: string; name?: string }
		| { kind: 'area-delete'; facilityAreaId: string; slug: string; name?: string };

	let confirmOpen = $state(false);
	let confirmIntent = $state<ConfirmIntent | null>(null);
	let confirmSlugInput = $state('');
	let deleteConfirmSlug = $state('');
	let deleteConfirmAreaSlug = $state('');
	let archiveFacilityForm = $state<HTMLFormElement | null>(null);
	let deleteFacilityForm = $state<HTMLFormElement | null>(null);
	let archiveAreaFormId = $state<string | null>(null);

	// Basic address autocomplete (fills city/state/postal/country).
	let addressQuery = $state('');
	let addressSuggestions = $state<
		Array<{ label: string; city: string; state: string; postalCode: string; country: string }>
	>([]);
	let isAddressLoading = $state(false);
	let addressTimer: ReturnType<typeof setTimeout> | null = null;

	async function fetchAddressSuggestions(q: string) {
		const query = q.trim();
		if (query.length < 4) {
			addressSuggestions = [];
			return;
		}
		isAddressLoading = true;
		try {
			const res = await fetch(`/api/address-suggest?q=${encodeURIComponent(query)}`);
			const body = await res.json();
			addressSuggestions = Array.isArray(body?.data) ? body.data : [];
		} catch {
			addressSuggestions = [];
		} finally {
			isAddressLoading = false;
		}
	}

	function scheduleAddressLookup(value: string) {
		addressQuery = value;
		if (addressTimer) clearTimeout(addressTimer);
		addressTimer = setTimeout(() => void fetchAddressSuggestions(value), 250);
	}

	function applyAddressSuggestion(s: {
		label: string;
		city: string;
		state: string;
		postalCode: string;
		country: string;
	}) {
		newFacilityAddressLine1 = (s.label.split(',')[0] || addressQuery).trim();
		newFacilityCity = s.city || newFacilityCity;
		newFacilityState = s.state || newFacilityState;
		newFacilityPostalCode = s.postalCode || newFacilityPostalCode;
		newFacilityCountry = s.country || newFacilityCountry;
		addressSuggestions = [];
	}

	function autofocus(node: HTMLElement) {
		if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) node.focus();
		return {};
	}

	function slugifyFinal(input: string) {
		return input
			.toLowerCase()
			.trim()
			.replace(/['"]/g, '')
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function slugifyLiveWithCursor(input: string, cursorIndex: number) {
		let out = '';
		let outCursor = 0;

		for (let i = 0; i < input.length; i++) {
			const ch = input[i] ?? '';
			const beforeCursor = i < cursorIndex;

			let next = '';
			if (/[A-Za-z0-9]/.test(ch)) next = ch.toLowerCase();
			else if (ch === ' ') next = '-';
			else if (ch === '-') next = '-';
			else next = '';

			if (next === '-') {
				if (out.length === 0) {
					next = '';
				} else if (out.endsWith('-')) {
					next = '';
				}
			}

			if (next) {
				out += next;
				if (beforeCursor) outCursor += next.length;
			}
		}

		return { value: out, cursor: outCursor };
	}

	function applyLiveSlugInput(el: HTMLInputElement) {
		const cursor = el.selectionStart ?? el.value.length;
		const { value, cursor: nextCursor } = slugifyLiveWithCursor(el.value, cursor);
		el.value = value;
		el.setSelectionRange(nextCursor, nextCursor);
		return value;
	}

	// Submit a form action via fetch (avoids nested form issues)
	async function submitAction(action: string, formDataObj: Record<string, string>) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(formDataObj)) {
			fd.append(k, v);
		}
		try {
			const res = await fetch(`?/${action}`, {
				method: 'POST',
				body: fd
			});
			if (res.ok || res.redirected) {
				// Reload to reflect changes
				window.location.reload();
			}
		} catch (e) {
			console.error('Action failed:', e);
		}
	}

	const currentClientId = $derived(data.clientId || '');

	// Compute matched area IDs based on facility search - use $effect to update state
	let matchedAreaIds = $state<Set<string>>(new Set());

	$effect(() => {
		const query = facilitySearch.trim().toLowerCase();
		if (!query) {
			matchedAreaIds = new Set();
		} else {
			// Find matching areas
			const matchingAreas = data.facilityAreas.filter(
				(a) =>
					(a.name || '').toLowerCase().includes(query) ||
					(a.slug || '').toLowerCase().includes(query)
			);
			matchedAreaIds = new Set(matchingAreas.map((a) => a.id));
		}
	});

	// Get facilities based on view mode (normal or archive)
	const facilities = $derived.by(() => {
		const query = facilitySearch.trim().toLowerCase();
		let filtered = data.facilities;

		if (viewArchiveMode) {
			// In archive mode, show only archived facilities OR facilities with archived areas
			filtered = filtered.filter((f) => {
				const isArchived = f.isActive === 0;
				const hasArchivedAreas = data.facilityAreas.some(
					(a) => a.facilityId === f.id && a.isActive === 0
				);
				return isArchived || hasArchivedAreas;
			});
		} else {
			// Normal mode: show active facilities (but they may have archived areas that we'll filter out)
			filtered = filtered.filter((f) => f.isActive !== 0);
		}

		if (!query) {
			return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
		}

		// Get facility IDs that have matching areas (use the reactive matchedAreaIds)
		const facilityIdsWithMatchingAreas = new Set(
			data.facilityAreas.filter((a) => matchedAreaIds.has(a.id)).map((a) => a.facilityId)
		);

		return filtered
			.filter(
				(f) =>
					(f.name || '').toLowerCase().includes(query) ||
					(f.slug || '').toLowerCase().includes(query) ||
					(f.description || '').toLowerCase().includes(query) ||
					facilityIdsWithMatchingAreas.has(f.id)
			)
			.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
	});

	function getAreasForFacility(facilityId: string, facilityIsArchived: boolean) {
		const query = areaSearch.trim().toLowerCase();
		const facilityQuery = facilitySearch.trim().toLowerCase();
		return data.facilityAreas
			.filter((a) => a.facilityId === facilityId)
			.filter((a) => {
				if (viewArchiveMode) {
					// In archive mode, show only archived areas
					return a.isActive === 0;
				}
				// Normal mode: show active areas
				return a.isActive !== 0;
			})
			.filter((a) => {
				if (!query && !facilityQuery) return true;
				// If searching facilities by area, show matching areas
				if (facilityQuery && matchedAreaIds.has(a.id)) return true;
				// Normal area search
				if (!query) return true;
				return (
					(a.name || '').toLowerCase().includes(query) ||
					(a.slug || '').toLowerCase().includes(query)
				);
			})
			.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
	}

	function getActiveAreaCount(facilityId: string) {
		return data.facilityAreas.filter((a) => a.facilityId === facilityId && a.isActive !== 0).length;
	}

	function getGoogleMapsUrl(facility: (typeof data.facilities)[0]) {
		const parts = [
			facility.addressLine1,
			facility.city,
			facility.state,
			facility.postalCode,
			facility.country
		].filter(Boolean);
		if (parts.length === 0) return null;
		return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
	}

	function toggleFacilityExpanded(facilityId: string) {
		const next = new Set(expandedFacilityIds);
		if (next.has(facilityId)) {
			next.delete(facilityId);
		} else {
			next.add(facilityId);
		}
		expandedFacilityIds = next;
	}

	function startEditingFacility(facility: (typeof data.facilities)[0]) {
		editingFacilityId = facility.id;
		facilityDrafts[facility.id] = {
			name: facility.name || '',
			slug: facility.slug || '',
			addressLine1: facility.addressLine1 || '',
			addressLine2: facility.addressLine2 || '',
			city: facility.city || '',
			state: facility.state || '',
			postalCode: facility.postalCode || '',
			country: facility.country || '',
			timezone: facility.timezone || '',
			description: facility.description || '',
			_addressExpanded: !!(
				facility.addressLine1 ||
				facility.addressLine2 ||
				facility.city ||
				facility.state ||
				facility.postalCode ||
				facility.country
			)
		};
	}

	function stopEditingFacility() {
		editingFacilityId = null;
	}

	function startEditingArea(area: (typeof data.facilityAreas)[0]) {
		editingAreaId = area.id;
		areaDrafts[area.id] = {
			name: area.name || '',
			slug: area.slug || ''
		};
	}

	function stopEditingArea() {
		editingAreaId = null;
	}

	function openConfirm(intent: ConfirmIntent) {
		confirmIntent = intent;
		confirmSlugInput = '';
		confirmOpen = true;
	}

	function closeConfirm() {
		confirmOpen = false;
		confirmIntent = null;
	}

	function openCreateFacility() {
		newFacilityName = '';
		newFacilitySlug = '';
		newFacilityNotes = '';
		slugTouched = false;
		showNewFacilityAddress = false;
		newFacilityAddressLine1 = '';
		newFacilityAddressLine2 = '';
		newFacilityCity = '';
		newFacilityState = '';
		newFacilityPostalCode = '';
		newFacilityCountry = '';
		newFacilityTimezone = '';
		addressQuery = '';
		addressSuggestions = [];
		isCreateFacilityOpen = true;
	}

	function closeCreateFacility() {
		isCreateFacilityOpen = false;
	}

	function openCreateArea(facilityId: string) {
		creatingAreaForFacilityId = facilityId;
		newAreaName = '';
		newAreaCode = '';
		areaSlugTouched = false;
		isCreateAreaOpen = true;
	}

	function closeCreateArea() {
		isCreateAreaOpen = false;
		creatingAreaForFacilityId = null;
	}

	function submitAreaArchive(facilityAreaId: string) {
		const formEl = document.getElementById(
			`area-archive-form-${facilityAreaId}`
		) as HTMLFormElement | null;
		formEl?.requestSubmit();
	}

	// Handle escape key for modals
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (confirmOpen) {
				closeConfirm();
			} else if (isCreateAreaOpen) {
				closeCreateArea();
			} else if (isCreateFacilityOpen) {
				closeCreateFacility();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Facilities - PlayIMs</title>
	<meta
		name="description"
		content="Manage sports facilities and venue areas. Create, edit, and organize your league's locations."
	/>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="p-8">
	<header class="border-2 border-secondary-300 bg-neutral p-5 mb-6 flex flex-col gap-4">
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<div
					class="bg-primary text-white w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
					aria-hidden="true"
				>
					<IconBuilding class="w-7 h-7 lg:w-8 lg:h-8" />
				</div>
				<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
					Facilities
				</h1>
			</div>
			<div class="flex items-center gap-3">
				<button
					class="button-secondary flex items-center gap-2 disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
					type="button"
					onclick={openCreateFacility}
					disabled={!currentClientId}
				>
					<IconPlus class="w-5 h-5" />
					<span>New Facility</span>
				</button>
			</div>
		</div>
		{#if form?.message}
			<div class="border-2 border-error-300 bg-error-50 p-4 flex items-start gap-3">
				<IconAlertCircle class="w-5 h-5 text-error-700 mt-0.5" />
				<div class="flex-1">
					<p class="text-error-800 font-sans">{form.message}</p>
					{#if formData?.duplicateType === 'archived'}
						<div class="flex items-center gap-2 mt-2">
							{#if formData?.archivedFacilityId}
								<form method="POST" action="?/setFacilityArchived" use:enhance class="inline">
									<input type="hidden" name="facilityId" value={formData?.archivedFacilityId} />
									<input type="hidden" name="isActive" value="1" />
									<button type="submit" class="button-secondary text-sm flex items-center gap-1">
										<IconRestore class="w-4 h-4" />
										Restore
									</button>
								</form>
								<button
									type="button"
									class="button-secondary-outlined text-sm flex items-center gap-1 border-error-500 text-error-700"
									onclick={() => {
										if (formData?.archivedFacilityId) {
											const archivedFacility = data.facilities.find(
												(f) => f.id === formData?.archivedFacilityId
											);
											if (archivedFacility) {
												openConfirm({
													kind: 'facility-delete',
													facilityId: archivedFacility.id,
													slug: archivedFacility.slug || ''
												});
											}
										}
									}}
								>
									<IconTrash class="w-4 h-4" />
									Delete
								</button>
							{:else if formData?.archivedAreaId && formData?.archivedAreaFacilityId}
								{@const archivedArea = data.facilityAreas.find(
									(a) => a.id === formData?.archivedAreaId
								)}
								<form method="POST" action="?/setFacilityAreaArchived" use:enhance class="inline">
									<input type="hidden" name="facilityAreaId" value={formData?.archivedAreaId} />
									<input type="hidden" name="isActive" value="1" />
									<button type="submit" class="button-secondary text-sm flex items-center gap-1">
										<IconRestore class="w-4 h-4" />
										Restore
									</button>
								</form>
								<button
									type="button"
									class="button-secondary-outlined text-sm flex items-center gap-1 border-error-500 text-error-700"
									onclick={() => {
										if (formData?.archivedAreaId && archivedArea) {
											openConfirm({
												kind: 'area-delete',
												facilityAreaId: archivedArea.id,
												slug: archivedArea.slug || ''
											});
										}
									}}
								>
									<IconTrash class="w-4 h-4" />
									Delete
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</header>

	<!-- Filters -->
	<div
		class="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-neutral-400 border border-secondary"
	>
		<div class="relative flex-1 min-w-[200px] max-w-md">
			<IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950" />
			<label for="facility-search" class="sr-only">Search facilities and areas</label>
			<input
				id="facility-search"
				type="text"
				bind:value={facilitySearch}
				placeholder="Search facilities and areas..."
				class="w-full input-secondary pl-10"
				autocomplete="off"
				data-lpignore="true"
			/>
		</div>
		<button
			class="button-secondary-outlined {viewArchiveMode ? 'bg-secondary-100' : ''} cursor-pointer"
			type="button"
			onclick={() => (viewArchiveMode = !viewArchiveMode)}
		>
			{viewArchiveMode ? 'View Active' : 'View Archive'}
		</button>
	</div>

	<!-- Facilities List -->
	<div class="space-y-4">
		{#if facilities.length === 0}
			<div class="p-8 text-center bg-neutral-400 border border-secondary">
				<p class="text-neutral-950 font-sans mb-4">
					{viewArchiveMode ? 'No archived facilities found.' : 'No facilities yet.'}
				</p>
				{#if !viewArchiveMode}
					<button
						class="button-accent inline-flex items-center gap-2 cursor-pointer"
						type="button"
						onclick={openCreateFacility}
					>
						<IconPlus class="w-5 h-5" />
						Create your first facility
					</button>
				{/if}
			</div>
		{:else}
			{#each facilities as facility (facility.id)}
				{@const isExpanded = expandedFacilityIds.has(facility.id)}
				{@const isEditing = editingFacilityId === facility.id}
				{@const facilityAreas = getAreasForFacility(facility.id, facility.isActive === 0)}
				{@const activeAreaCount = getActiveAreaCount(facility.id)}
				{@const isArchived = facility.isActive === 0}
				{@const isPartiallyArchived = !isArchived && viewArchiveMode}
				<div class="bg-neutral-400 border-2 border-secondary">
					<!-- Facility Header -->
					<div class="p-4 {isExpanded ? 'border-b border-secondary' : ''}">
						{#if isEditing}
							{@const editingAddressExpanded =
								facilityDrafts[facility.id]?._addressExpanded ?? false}
							<!-- Inline Facility Edit Form -->
							<form
								method="POST"
								action="?/updateFacility"
								use:enhance={() => {
									return async ({ update, result }) => {
										await update({ reset: false });
										if (
											result.type === 'success' ||
											(result.type === 'failure' &&
												(result.data as { noChange?: boolean })?.noChange)
										) {
											stopEditingFacility();
										}
									};
								}}
								class="space-y-4"
							>
								<input type="hidden" name="facilityId" value={facility.id} />
								{#if form?.action === 'updateFacility' && form?.message}
									<div class="border-2 border-error-300 bg-error-50 p-3 flex items-start gap-3">
										<IconAlertCircle class="w-5 h-5 text-error-700 mt-0.5" />
										<div class="flex-1">
											<p class="text-error-800 font-sans">{form.message}</p>
											{#if formData?.duplicateType === 'archived' && formData?.archivedFacilityId}
												<div class="flex items-center gap-2 mt-2">
													<button
														type="button"
														class="button-secondary text-sm flex items-center gap-1"
														onclick={() =>
															submitAction('setFacilityArchived', {
																facilityId: String(formData?.archivedFacilityId),
																isActive: '1'
															})}
													>
														<IconRestore class="w-4 h-4" />
														Restore
													</button>
													<button
														type="button"
														class="button-secondary-outlined text-sm flex items-center gap-1 border-error-500 text-error-700"
														onclick={() => {
															if (formData?.archivedFacilityId) {
																const archivedFacility = data.facilities.find(
																	(f) => f.id === formData.archivedFacilityId
																);
																if (archivedFacility) {
																	openConfirm({
																		kind: 'facility-delete',
																		facilityId: archivedFacility.id,
																		slug: archivedFacility.slug || '',
																		name: archivedFacility.name || ''
																	});
																}
															}
														}}
													>
														<IconTrash class="w-4 h-4" />
														Delete
													</button>
												</div>
											{/if}
										</div>
									</div>
								{/if}
								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label class="block text-sm font-sans text-neutral-950 mb-1"
											>Name
											<input
												type="text"
												name="name"
												bind:value={facilityDrafts[facility.id].name}
												class="w-full input-secondary bg-white mt-1"
												autocomplete="off"
											/>
										</label>
									</div>
									<div>
										<label class="block text-sm font-sans text-neutral-950 mb-1"
											>Slug
											<input
												type="text"
												name="slug"
												value={facilityDrafts[facility.id].slug}
												oninput={(e) => {
													const el = e.currentTarget as HTMLInputElement;
													facilityDrafts[facility.id].slug = applyLiveSlugInput(el);
												}}
												class="w-full input-secondary bg-white mt-1"
												autocomplete="off"
											/>
										</label>
									</div>
								</div>
								<div>
									<label class="block text-sm font-sans text-neutral-950 mb-1"
										>Description (optional)
										<textarea
											name="description"
											bind:value={facilityDrafts[facility.id].description}
											rows="2"
											class="w-full input-secondary bg-white mt-1 resize-none"
											autocomplete="off"
										></textarea>
									</label>
								</div>
								<!-- Address Toggle Button -->
								<div class="flex items-center justify-between border border-secondary p-3 bg-white">
									<span class="text-sm font-sans text-neutral-950">Address</span>
									<button
										type="button"
										class="button-secondary text-sm flex items-center gap-2 cursor-pointer"
										onclick={() => {
											facilityDrafts[facility.id] = {
												...facilityDrafts[facility.id],
												_addressExpanded: !editingAddressExpanded
											};
										}}
									>
										<IconMapPinPlus class="w-4 h-4" />
										{editingAddressExpanded ? 'Hide address' : 'Edit address'}
									</button>
								</div>
								{#if editingAddressExpanded}
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<label class="block text-sm font-sans text-neutral-950 mb-1"
											>Address line 1
											<input
												type="text"
												name="addressLine1"
												bind:value={facilityDrafts[facility.id].addressLine1}
												placeholder="Street address"
												class="w-full input-secondary bg-white mt-1"
												autocomplete="off"
											/>
										</label>
										<label class="block text-sm font-sans text-neutral-950 mb-1"
											>Address line 2
											<input
												type="text"
												name="addressLine2"
												bind:value={facilityDrafts[facility.id].addressLine2}
												class="w-full input-secondary bg-white mt-1"
												autocomplete="off"
											/>
										</label>
									</div>
									<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
										<label class="block text-sm font-sans text-neutral-950 mb-1"
											>City
											<input
												type="text"
												name="city"
												bind:value={facilityDrafts[facility.id].city}
												class="w-full input-secondary bg-white mt-1"
												autocomplete="off"
											/>
										</label>
										<label class="block text-sm font-sans text-neutral-950 mb-1"
											>State
											<input
												type="text"
												name="state"
												bind:value={facilityDrafts[facility.id].state}
												class="w-full input-secondary bg-white mt-1"
												autocomplete="off"
											/>
										</label>
										<label class="block text-sm font-sans text-neutral-950 mb-1"
											>ZIP
											<input
												type="text"
												name="postalCode"
												bind:value={facilityDrafts[facility.id].postalCode}
												class="w-full input-secondary bg-white mt-1"
												autocomplete="off"
											/>
										</label>
										<label class="block text-sm font-sans text-neutral-950 mb-1"
											>Country
											<input
												type="text"
												name="country"
												bind:value={facilityDrafts[facility.id].country}
												class="w-full input-secondary bg-white mt-1"
												autocomplete="off"
											/>
										</label>
									</div>
								{/if}
								<div class="flex items-center gap-2">
									<button
										type="submit"
										class="button-accent flex items-center gap-2 cursor-pointer"
									>
										<IconCheck class="w-4 h-4" />
										<span>Save</span>
									</button>
									<button
										type="button"
										class="button-secondary cursor-pointer"
										onclick={stopEditingFacility}
									>
										Cancel
									</button>
								</div>
							</form>
						{:else}
							<!-- Facility Display -->
							<div class="flex items-center justify-between gap-4">
								<button
									type="button"
									class="flex items-center gap-3 flex-1 text-left cursor-pointer"
									onclick={() => toggleFacilityExpanded(facility.id)}
									aria-expanded={isExpanded}
								>
									<div
										class="transition-transform duration-300 ease-in-out {isExpanded
											? 'rotate-90'
											: 'rotate-0'}"
									>
										<IconChevronRight class="w-5 h-5 text-neutral-950 shrink-0" />
									</div>
									<div class="min-w-0">
										<div class="flex items-center gap-2">
											<p class="font-serif font-bold text-neutral-950 truncate text-lg">
												{facility.name || '(Unnamed facility)'}
											</p>
											{#if isArchived}
												<span class="badge-secondary text-xs shrink-0">ARCHIVED</span>
											{:else if isPartiallyArchived}
												<span class="badge-accent text-xs shrink-0">HAS ARCHIVED AREAS</span>
											{/if}
										</div>
										<div class="flex items-center gap-3 text-sm font-sans text-neutral-700">
											{#if facility.addressLine1 || facility.city}
												{@const mapsUrl = getGoogleMapsUrl(facility)}
												{#if mapsUrl}
													<a
														href={mapsUrl}
														target="_blank"
														rel="noopener noreferrer"
														class="hover:underline cursor-pointer flex items-center gap-1"
														onclick={(e) => e.stopPropagation()}
													>
														<IconMapPin class="w-3 h-3" />
														{[facility.addressLine1, facility.city, facility.state]
															.filter(Boolean)
															.join(', ')}
														<IconExternalLink class="w-3 h-3" />
													</a>
												{:else}
													<span>
														<IconMapPin class="w-3 h-3 inline mr-1" />
														{[facility.addressLine1, facility.city, facility.state]
															.filter(Boolean)
															.join(', ')}
													</span>
												{/if}
											{/if}
											<div class="flex items-center gap-1 text-neutral-600">
												<IconSquare class="w-3 h-3" />
												<span>{activeAreaCount} area{activeAreaCount === 1 ? '' : 's'}</span>
											</div>
										</div>
									</div>
								</button>
								{#if !isPartiallyArchived}
									<div class="flex items-center gap-2 shrink-0">
										{#if !isArchived}
											<button
												type="button"
												class="button-secondary-outlined p-2! cursor-pointer"
												onclick={() => startEditingFacility(facility)}
												aria-label="Edit facility"
											>
												<IconPencil class="w-4 h-4 text-secondary-700" />
											</button>
										{/if}
										<form method="POST" action="?/setFacilityArchived" use:enhance>
											<input type="hidden" name="facilityId" value={facility.id} />
											<input
												type="hidden"
												name="isActive"
												value={facility.isActive === 0 ? '1' : '0'}
											/>
											<button
												type="button"
												class="button-secondary-outlined p-2! cursor-pointer"
												aria-label={facility.isActive === 0
													? 'Restore facility'
													: 'Archive facility'}
												onclick={() =>
													openConfirm(
														facility.isActive === 0
															? { kind: 'facility-restore', facilityId: facility.id }
															: { kind: 'facility-archive', facilityId: facility.id }
													)}
											>
												{#if facility.isActive === 0}
													<IconRestore class="w-4 h-4 text-secondary-700" />
												{:else}
													<IconArchive class="w-4 h-4 text-accent-600" />
												{/if}
											</button>
										</form>
										{#if facility.isActive === 0}
											<form
												method="POST"
												action="?/deleteFacility"
												use:enhance={() => {
													return async ({ result, update }) => {
														await update();
														if (result.type === 'success' || result.type === 'redirect')
															closeConfirm();
													};
												}}
												bind:this={deleteFacilityForm}
											>
												<input type="hidden" name="facilityId" value={facility.id} />
												<input type="hidden" name="confirmSlug" value={deleteConfirmSlug} />
												<button
													type="button"
													class="button-secondary-outlined p-2! cursor-pointer"
													onclick={() =>
														openConfirm({
															kind: 'facility-delete',
															facilityId: facility.id,
															slug: facility.slug || ''
														})}
													aria-label="Delete facility"
												>
													<IconTrash class="w-4 h-4 text-accent-600" />
												</button>
											</form>
										{/if}
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Areas Section (Expanded) -->
					{#if isExpanded}
						<div class="border-t border-secondary bg-white">
							<!-- Areas Header -->
							<div
								class="p-3 border-b border-secondary bg-neutral-100 flex items-center justify-between gap-3"
							>
								<span class="font-sans font-semibold text-neutral-950 text-sm">
									Areas ({facilityAreas.length})
								</span>
								{#if !isArchived && !isPartiallyArchived}
									<button
										class="button-secondary text-sm flex items-center gap-1 cursor-pointer"
										type="button"
										onclick={() => openCreateArea(facility.id)}
									>
										<IconPlus class="w-4 h-4" />
										<span>Add Area</span>
									</button>
								{/if}
							</div>

							<!-- Areas List -->
							{#if facilityAreas.length === 0}
								<div class="p-4 text-center">
									<p class="text-sm font-sans text-neutral-700">
										{viewArchiveMode
											? 'No archived areas for this facility.'
											: 'No areas for this facility yet.'}
										{#if !viewArchiveMode && !isArchived && !isPartiallyArchived}
											<button
												type="button"
												class="text-primary-600 hover:underline ml-1 cursor-pointer"
												onclick={() => openCreateArea(facility.id)}
											>
												Create one now
											</button>
										{/if}
									</p>
								</div>
							{:else}
								<ul class="divide-y divide-secondary-200">
									{#each facilityAreas as area (area.id)}
										{@const isEditingArea = editingAreaId === area.id}
										{@const isAreaArchived = area.isActive === 0}
										{@const isMatchedArea = matchedAreaIds.has(area.id)}
										<li class="p-3 {isMatchedArea ? 'bg-secondary-50' : ''}">
											{#if isEditingArea}
												<!-- Inline Area Edit Form -->
												{@const editingAreaAddressExpanded =
													areaDrafts[area.id]?._addressExpanded ?? false}
												<form
													method="POST"
													action="?/updateFacilityArea"
													use:enhance={() => {
														return async ({ update, result }) => {
															await update({ reset: false });
															if (
																result.type === 'success' ||
																(result.type === 'failure' &&
																	(result.data as { noChange?: boolean })?.noChange)
															) {
																stopEditingArea();
															}
														};
													}}
													class="space-y-3"
												>
													<input type="hidden" name="facilityAreaId" value={area.id} />
													{#if form?.action === 'updateFacilityArea' && form?.message}
														<div
															class="border-2 border-error-300 bg-error-50 p-3 flex items-start gap-3"
														>
															<IconAlertCircle class="w-5 h-5 text-error-700 mt-0.5" />
															<div class="flex-1">
																<p class="text-error-800 font-sans">{form.message}</p>
																{#if formData?.duplicateType === 'archived' && formData?.archivedAreaId}
																	{@const archivedArea = data.facilityAreas.find(
																		(a) => a.id === formData.archivedAreaId
																	)}
																	<div class="flex items-center gap-2 mt-2">
																		<button
																			type="button"
																			class="button-secondary text-sm flex items-center gap-1"
																			onclick={() =>
																				submitAction('setFacilityAreaArchived', {
																					facilityAreaId: String(formData?.archivedAreaId),
																					isActive: '1'
																				})}
																		>
																			<IconRestore class="w-4 h-4" />
																			Restore
																		</button>
																		<button
																			type="button"
																			class="button-secondary-outlined text-sm flex items-center gap-1 border-error-500 text-error-700"
																			onclick={() => {
																				if (formData?.archivedAreaId && archivedArea) {
																					openConfirm({
																						kind: 'area-delete',
																						facilityAreaId: archivedArea.id,
																						slug: archivedArea.slug || ''
																					});
																				}
																			}}
																		>
																			<IconTrash class="w-4 h-4" />
																			Delete
																		</button>
																	</div>
																{/if}
															</div>
														</div>
													{/if}
													<div class="flex-1 grid grid-cols-2 gap-3">
														<input
															type="text"
															name="name"
															bind:value={areaDrafts[area.id].name}
															placeholder="Area name"
															class="w-full input-secondary text-sm"
															autocomplete="off"
														/>
														<input
															type="text"
															name="slug"
															value={areaDrafts[area.id].slug}
															oninput={(e) => {
																const el = e.currentTarget as HTMLInputElement;
																areaDrafts[area.id].slug = applyLiveSlugInput(el);
															}}
															placeholder="slug"
															class="w-full input-secondary text-sm"
															autocomplete="off"
														/>
													</div>
													<div>
														<label class="block text-xs font-sans text-neutral-950 mb-1"
															>Notes (optional)
															<textarea
																rows="2"
																class="w-full input-secondary text-sm resize-none"
																autocomplete="off"
															></textarea>
														</label>
													</div>
													<div class="flex items-center gap-2 shrink-0">
														<button
															type="submit"
															class="button-secondary-outlined p-2! cursor-pointer"
															aria-label="Save"
														>
															<IconCheck class="w-4 h-4 text-secondary-700" />
														</button>
														<button
															type="button"
															class="button-secondary-outlined p-2! cursor-pointer"
															onclick={stopEditingArea}
															aria-label="Cancel"
														>
															<IconTrash class="w-4 h-4 text-accent-600" />
														</button>
													</div>
												</form>
											{:else}
												<!-- Area Display -->
												<div class="flex items-center justify-between gap-3">
													<div class="flex items-center gap-2 min-w-0">
														<span class="font-sans text-neutral-950 truncate">
															{area.name || '(Unnamed area)'}
														</span>
														{#if isAreaArchived}
															<span class="badge-secondary text-xs shrink-0">ARCHIVED</span>
														{/if}
													</div>
													<div class="flex items-center gap-2 shrink-0">
														{#if !isAreaArchived && !isArchived && !isPartiallyArchived}
															<button
																type="button"
																class="button-secondary-outlined p-2! cursor-pointer"
																onclick={() => startEditingArea(area)}
																aria-label="Edit area"
															>
																<IconPencil class="w-4 h-4 text-secondary-700" />
															</button>
														{/if}
														{#if !isArchived && !isPartiallyArchived}
															<form
																method="POST"
																action="?/setFacilityAreaArchived"
																use:enhance
																id={`area-archive-form-${area.id}`}
															>
																<input type="hidden" name="facilityAreaId" value={area.id} />
																<input
																	type="hidden"
																	name="isActive"
																	value={area.isActive === 0 ? '1' : '0'}
																/>
																<button
																	type="button"
																	class="button-secondary-outlined p-2! cursor-pointer"
																	aria-label={area.isActive === 0 ? 'Restore area' : 'Archive area'}
																	onclick={() =>
																		openConfirm(
																			area.isActive === 0
																				? { kind: 'area-restore', facilityAreaId: area.id }
																				: { kind: 'area-archive', facilityAreaId: area.id }
																		)}
																>
																	{#if area.isActive === 0}
																		<IconRestore class="w-4 h-4 text-secondary-700" />
																	{:else}
																		<IconArchive class="w-4 h-4 text-accent-600" />
																	{/if}
																</button>
															</form>
														{/if}
														{#if isAreaArchived}
															<!-- Archived areas show restore and delete on the right -->
															<form
																method="POST"
																action="?/setFacilityAreaArchived"
																use:enhance
																class="inline"
															>
																<input type="hidden" name="facilityAreaId" value={area.id} />
																<input type="hidden" name="isActive" value="1" />
																<button
																	type="button"
																	class="button-secondary-outlined p-2! cursor-pointer"
																	aria-label="Restore area"
																	onclick={() =>
																		openConfirm({ kind: 'area-restore', facilityAreaId: area.id })}
																>
																	<IconRestore class="w-4 h-4 text-secondary-700" />
																</button>
															</form>
															<form
																method="POST"
																action="?/deleteFacilityArea"
																use:enhance={() => {
																	return async ({ result, update }) => {
																		await update();
																		if (result.type === 'success' || result.type === 'redirect')
																			closeConfirm();
																	};
																}}
																id={`area-delete-form-${area.id}`}
															>
																<input type="hidden" name="facilityAreaId" value={area.id} />
																<input
																	type="hidden"
																	name="confirmSlug"
																	value={deleteConfirmAreaSlug}
																/>
																<button
																	type="button"
																	class="button-secondary-outlined p-2! cursor-pointer"
																	onclick={() =>
																		openConfirm({
																			kind: 'area-delete',
																			facilityAreaId: area.id,
																			slug: area.slug || ''
																		})}
																	aria-label="Delete area"
																>
																	<IconTrash class="w-4 h-4 text-accent-600" />
																</button>
															</form>
														{/if}
													</div>
												</div>
											{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>

<!-- Hidden archive form for edit mode -->
{#if archiveAreaFormId}
	<form
		method="POST"
		action="?/setFacilityAreaArchived"
		use:enhance
		id={`area-archive-form-${archiveAreaFormId}`}
		class="hidden"
	>
		<input type="hidden" name="facilityAreaId" value={archiveAreaFormId} />
		<input type="hidden" name="isActive" value="0" />
	</form>
{/if}

<datalist id="timezone-options">
	<option value="America/New_York"></option>
	<option value="America/Chicago"></option>
	<option value="America/Denver"></option>
	<option value="America/Los_Angeles"></option>
	<option value="America/Phoenix"></option>
	<option value="America/Anchorage"></option>
	<option value="Pacific/Honolulu"></option>
	<option value="UTC"></option>
</datalist>

<!-- Create Facility Modal -->
{#if isCreateFacilityOpen}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-6"
		onclick={closeCreateFacility}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeCreateFacility();
		}}
		role="button"
		tabindex="0"
		aria-label="Close modal"
	>
		<div
			class="w-full max-w-3xl bg-neutral-400 border-4 border-secondary"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div class="p-5 border-b border-secondary">
				<h3 class="text-2xl font-bold font-serif text-neutral-950">New Facility</h3>
			</div>
			<form
				method="POST"
				action="?/createFacility"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'redirect' || result.type === 'success') closeCreateFacility();
						await update();
					};
				}}
				class="p-5 space-y-5"
			>
				{#if form?.action === 'createFacility' && form?.message}
					<div class="border-2 border-error-300 bg-error-50 p-3 flex items-start gap-3">
						<IconAlertCircle class="w-5 h-5 text-error-700 mt-0.5" />
						<div class="flex-1">
							<p class="text-error-800 font-sans">{form.message}</p>
							{#if formData?.duplicateType === 'archived' && formData?.archivedFacilityId}
								<div class="flex items-center gap-2 mt-2">
									<button
										type="button"
										class="button-secondary text-sm flex items-center gap-1"
										onclick={() =>
											submitAction('setFacilityArchived', {
												facilityId: String(formData?.archivedFacilityId),
												isActive: '1'
											})}
									>
										<IconRestore class="w-4 h-4" />
										Restore
									</button>
									<button
										type="button"
										class="button-secondary-outlined text-sm flex items-center gap-1 border-error-500 text-error-700"
										onclick={() => {
											if (formData?.archivedFacilityId) {
												const archivedFacility = data.facilities.find(
													(f) => f.id === formData.archivedFacilityId
												);
												if (archivedFacility) {
													openConfirm({
														kind: 'facility-delete',
														facilityId: archivedFacility.id,
														slug: archivedFacility.slug || ''
													});
												}
											}
										}}
									>
										<IconTrash class="w-4 h-4" />
										Delete
									</button>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
					<div>
						<label for="new-facility-name" class="block text-sm font-sans text-neutral-950 mb-1"
							>Name</label
						>
						<input
							id="new-facility-name"
							name="name"
							type="text"
							use:autofocus
							placeholder="Intramural Fields"
							bind:value={newFacilityName}
							oninput={(e) => {
								const el = e.currentTarget as HTMLInputElement;
								newFacilityName = el.value;
								if (!slugTouched) newFacilitySlug = slugifyFinal(el.value);
							}}
							class="w-full input-secondary"
							autocomplete="off"
						/>
					</div>
					<div>
						<label for="new-facility-slug" class="block text-sm font-sans text-neutral-950 mb-1"
							>Slug</label
						>
						<input
							id="new-facility-slug"
							name="slug"
							type="text"
							placeholder="intramural-fields"
							bind:value={newFacilitySlug}
							oninput={(e) => {
								slugTouched = true;
								const el = e.currentTarget as HTMLInputElement;
								newFacilitySlug = applyLiveSlugInput(el);
							}}
							class="w-full input-secondary"
							autocomplete="off"
						/>
						<p class="text-xs font-sans text-neutral-950 mt-1">
							Auto-formats to lowercase with dashes.
						</p>
					</div>
				</div>

				<div>
					<label
						for="new-facility-description"
						class="block text-sm font-sans text-neutral-950 mb-1">Description (optional)</label
					>
					<textarea
						id="new-facility-description"
						name="description"
						bind:value={newFacilityNotes}
						rows="2"
						class="w-full input-secondary resize-none"
						autocomplete="off"
					></textarea>
				</div>

				<div class="flex items-center justify-between border border-secondary p-3 bg-white">
					<span class="text-sm font-sans text-neutral-950">Address (optional)</span>
					<button
						type="button"
						class="button-secondary text-sm flex items-center gap-2 cursor-pointer"
						onclick={() => (showNewFacilityAddress = !showNewFacilityAddress)}
					>
						<IconMapPinPlus class="w-4 h-4" />
						{showNewFacilityAddress ? 'Hide address' : 'Add address'}
					</button>
				</div>

				{#if showNewFacilityAddress}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<div>
							<label
								for="new-facility-address1"
								class="block text-sm font-sans text-neutral-950 mb-1">Address line 1</label
							>
							<div class="relative">
								<input
									id="new-facility-address1"
									name="addressLine1"
									type="text"
									class="w-full input-secondary"
									bind:value={newFacilityAddressLine1}
									oninput={(e) => {
										const el = e.currentTarget as HTMLInputElement;
										scheduleAddressLookup(el.value);
									}}
									autocomplete="off"
								/>

								{#if isAddressLoading}
									<div class="absolute right-2 top-2 text-xs font-sans text-secondary-700">
										Looking up…
									</div>
								{/if}

								{#if addressSuggestions.length > 0}
									<div class="absolute z-10 mt-1 w-full border-2 border-secondary-300 bg-white">
										<ul
											class="max-h-56 overflow-auto"
											role="listbox"
											aria-label="Address suggestions"
										>
											{#each addressSuggestions as s (s.label)}
												<li class="border-b border-secondary-200 last:border-b-0">
													<button
														type="button"
														class="w-full text-left px-3 py-2 hover:bg-secondary-50 font-sans text-sm text-neutral-950 cursor-pointer"
														onclick={() => applyAddressSuggestion(s)}
													>
														{s.label}
													</button>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						</div>
						<div>
							<label
								for="new-facility-address2"
								class="block text-sm font-sans text-neutral-950 mb-1">Address line 2</label
							>
							<input
								id="new-facility-address2"
								name="addressLine2"
								type="text"
								class="w-full input-secondary"
								bind:value={newFacilityAddressLine2}
								autocomplete="off"
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-4 gap-5">
						<div class="md:col-span-2">
							<label for="new-facility-city" class="block text-sm font-sans text-neutral-950 mb-1"
								>City</label
							>
							<input
								id="new-facility-city"
								name="city"
								type="text"
								class="w-full input-secondary"
								bind:value={newFacilityCity}
								autocomplete="off"
							/>
						</div>
						<div>
							<label for="new-facility-state" class="block text-sm font-sans text-neutral-950 mb-1"
								>State</label
							>
							<input
								id="new-facility-state"
								name="state"
								type="text"
								class="w-full input-secondary"
								bind:value={newFacilityState}
								autocomplete="off"
							/>
						</div>
						<div>
							<label for="new-facility-postal" class="block text-sm font-sans text-neutral-950 mb-1"
								>Postal code</label
							>
							<input
								id="new-facility-postal"
								name="postalCode"
								type="text"
								class="w-full input-secondary"
								bind:value={newFacilityPostalCode}
								autocomplete="off"
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<div>
							<label
								for="new-facility-country"
								class="block text-sm font-sans text-neutral-950 mb-1">Country</label
							>
							<input
								id="new-facility-country"
								name="country"
								type="text"
								class="w-full input-secondary"
								bind:value={newFacilityCountry}
								autocomplete="off"
							/>
						</div>
						<div>
							<label
								for="new-facility-timezone"
								class="block text-sm font-sans text-neutral-950 mb-1">Timezone</label
							>
							<input
								id="new-facility-timezone"
								name="timezone"
								type="text"
								placeholder="America/New_York"
								class="w-full input-secondary"
								list="timezone-options"
								bind:value={newFacilityTimezone}
								autocomplete="off"
							/>
						</div>
					</div>
				{/if}

				<div class="flex items-center justify-end gap-3">
					<button
						type="button"
						class="button-secondary cursor-pointer"
						onclick={closeCreateFacility}>Cancel</button
					>
					<button type="submit" class="button-accent flex items-center gap-2 cursor-pointer">
						<IconPlus class="w-5 h-5" />
						<span>Create facility</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Create Area Modal -->
{#if isCreateAreaOpen && creatingAreaForFacilityId}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-6"
		onclick={closeCreateArea}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeCreateArea();
		}}
		role="button"
		tabindex="0"
		aria-label="Close modal"
	>
		<div
			class="w-full max-w-2xl bg-neutral-400 border-4 border-secondary"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div class="p-5 border-b border-secondary">
				<h3 class="text-2xl font-bold font-serif text-neutral-950">New Area</h3>
			</div>
			<form
				method="POST"
				action="?/createFacilityArea"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'redirect' || result.type === 'success') closeCreateArea();
						await update();
					};
				}}
				class="p-5 space-y-5"
			>
				{#if form?.action === 'createFacilityArea' && form?.message}
					<div class="border-2 border-error-300 bg-error-50 p-3 flex items-start gap-3">
						<IconAlertCircle class="w-5 h-5 text-error-700 mt-0.5" />
						<div class="flex-1">
							<p class="text-error-800 font-sans">{form.message}</p>
							{#if formData?.duplicateType === 'archived' && formData?.archivedAreaId}
								{@const archivedArea = data.facilityAreas.find(
									(a) => a.id === formData.archivedAreaId
								)}
								<div class="flex items-center gap-2 mt-2">
									<button
										type="button"
										class="button-secondary text-sm flex items-center gap-1"
										onclick={() =>
											submitAction('setFacilityAreaArchived', {
												facilityAreaId: String(formData?.archivedAreaId),
												isActive: '1'
											})}
									>
										<IconRestore class="w-4 h-4" />
										Restore
									</button>
									<button
										type="button"
										class="button-secondary-outlined text-sm flex items-center gap-1 border-error-500 text-error-700"
										onclick={() => {
											if (formData?.archivedAreaId && archivedArea) {
												openConfirm({
													kind: 'area-delete',
													facilityAreaId: archivedArea.id,
													slug: archivedArea.slug || ''
												});
											}
										}}
									>
										<IconTrash class="w-4 h-4" />
										Delete
									</button>
								</div>
							{/if}
						</div>
					</div>
				{/if}
				<input type="hidden" name="facilityId" value={creatingAreaForFacilityId} />

				<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
					<div>
						<label for="new-area-name" class="block text-sm font-sans text-neutral-950 mb-1"
							>Name</label
						>
						<input
							id="new-area-name"
							name="name"
							type="text"
							use:autofocus
							placeholder="Field 1"
							bind:value={newAreaName}
							oninput={(e) => {
								const el = e.currentTarget as HTMLInputElement;
								newAreaName = el.value;
								if (!areaSlugTouched) newAreaCode = slugifyFinal(el.value);
							}}
							class="w-full input-secondary"
							autocomplete="off"
						/>
					</div>
					<div>
						<label for="new-area-slug" class="block text-sm font-sans text-neutral-950 mb-1"
							>Slug</label
						>
						<input
							id="new-area-slug"
							name="slug"
							type="text"
							placeholder="field-1"
							bind:value={newAreaCode}
							oninput={(e) => {
								areaSlugTouched = true;
								const el = e.currentTarget as HTMLInputElement;
								newAreaCode = applyLiveSlugInput(el);
							}}
							class="w-full input-secondary"
							autocomplete="off"
						/>
						<p class="text-xs font-sans text-neutral-950 mt-1">
							Auto-formats to lowercase with dashes.
						</p>
					</div>
				</div>

				<div class="flex items-center justify-end gap-3">
					<button type="button" class="button-secondary cursor-pointer" onclick={closeCreateArea}
						>Cancel</button
					>
					<button type="submit" class="button-accent flex items-center gap-2 cursor-pointer">
						<IconPlus class="w-5 h-5" />
						<span>Create Area</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Confirmation Modal -->
{#if confirmOpen && confirmIntent}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-6"
		onclick={closeConfirm}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeConfirm();
		}}
		role="button"
		tabindex="0"
		aria-label="Close confirmation modal"
	>
		<div
			class="w-full max-w-xl bg-neutral-400 border-4 border-secondary"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			{#if confirmIntent.kind === 'facility-delete' || confirmIntent.kind === 'area-delete'}
				<!-- Delete Modal -->
				<div class="p-5 border-b border-secondary">
					<h3 class="text-2xl font-bold font-serif text-neutral-950">Delete permanently?</h3>
				</div>
				<div class="p-5 space-y-4">
					{#if confirmIntent.kind === 'facility-delete'}
						<p class="font-sans text-neutral-950">
							This will <span class="font-bold text-error-500">permanently delete</span> the
							facility. This action <span class="font-bold text-error-500">cannot</span>
							be undone.
						</p>
						<p class="font-sans text-neutral-950">
							Type the facility slug to confirm: <span class="font-mono font-bold"
								>{confirmIntent.slug || confirmIntent.name}</span
							>
						</p>
					{:else}
						<p class="font-sans text-neutral-950">
							This will <span class="font-bold text-error-500">permanently delete</span> the area.
							This action <span class="font-bold text-error-500">cannot</span> be undone.
						</p>
						<p class="font-sans text-neutral-950">
							Type the area slug to confirm: <span class="font-mono font-bold"
								>{confirmIntent.slug}</span
							>
						</p>
					{/if}
					<input
						class="w-full input-secondary bg-white"
						type="text"
						placeholder="Type slug to confirm…"
						bind:value={confirmSlugInput}
						autocomplete="off"
					/>
					<div class="flex items-center justify-end gap-3 pt-2">
						<button type="button" class="button-secondary cursor-pointer" onclick={closeConfirm}
							>Cancel</button
						>
						<button
							type="button"
							class="button-secondary-outlined border-error-500 text-error-700 hover:bg-error-50 flex items-center gap-2 min-w-[10rem] justify-center cursor-pointer"
							disabled={slugifyFinal(confirmSlugInput) !== slugifyFinal(confirmIntent.slug)}
							onclick={() => {
								if (!confirmIntent) return;
								if (confirmIntent.kind === 'facility-delete') {
									deleteConfirmSlug = confirmSlugInput;
									deleteFacilityForm?.requestSubmit();
									return;
								}
								if (confirmIntent.kind === 'area-delete') {
									deleteConfirmAreaSlug = confirmSlugInput;
									const formEl = document.getElementById(
										`area-delete-form-${confirmIntent.facilityAreaId}`
									) as HTMLFormElement | null;
									formEl?.requestSubmit();
								}
							}}
						>
							<IconTrash class="w-5 h-5" />
							<span>Delete</span>
						</button>
					</div>
				</div>
			{:else}
				<!-- Archive/Restore Modal -->
				<div class="p-5 border-b border-secondary">
					<h3 class="text-2xl font-bold font-serif text-neutral-950">
						{#if confirmIntent.kind === 'facility-archive' || confirmIntent.kind === 'area-archive'}
							Archive?
						{:else}
							Restore?
						{/if}
					</h3>
				</div>
				<div class="p-5 space-y-4">
					{#if confirmIntent.kind === 'facility-archive' || confirmIntent.kind === 'area-archive'}
						<p class="font-sans text-neutral-950">
							Archiving hides it from day-to-day use. You can restore it later.
						</p>
					{:else}
						<p class="font-sans text-neutral-950">This will make it active again.</p>
					{/if}
					<div class="flex items-center justify-end gap-3 pt-2">
						<button type="button" class="button-secondary cursor-pointer" onclick={closeConfirm}
							>Cancel</button
						>
						<button
							type="button"
							class="button-primary-outlined flex items-center gap-2 min-w-[10rem] justify-center cursor-pointer"
							onclick={() => {
								if (!confirmIntent) return;

								if (
									confirmIntent.kind === 'facility-archive' ||
									confirmIntent.kind === 'facility-restore'
								) {
									archiveFacilityForm?.requestSubmit();
									closeConfirm();
									return;
								}

								if (
									confirmIntent.kind === 'area-archive' ||
									confirmIntent.kind === 'area-restore'
								) {
									submitAreaArchive(confirmIntent.facilityAreaId);
									closeConfirm();
									return;
								}
							}}
						>
							{#if confirmIntent.kind === 'facility-archive' || confirmIntent.kind === 'area-archive'}
								<IconArchive class="w-5 h-5" />
								<span>Archive</span>
							{:else}
								<IconRestore class="w-5 h-5" />
								<span>Restore</span>
							{/if}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
