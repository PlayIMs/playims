<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import {
		IconPlus,
		IconPencil,
		IconArchive,
		IconRestore,
		IconCheck,
		IconTrash,
		IconAlertCircle,
		IconSearch,
		IconMapPin,
		IconSquare,
		IconTransfer,
		IconMapPinPlus
	} from '@tabler/icons-svelte';

	let { data, form }: PageProps = $props();

	let showArchivedFacilities = $state(false);
	let showArchivedAreas = $state(false);
	let facilitySearch = $state('');
	let areaSearch = $state('');

	let isCreateFacilityOpen = $state(false);
	let isCreateAreaOpen = $state(false);
	let editingAreaId = $state<string | null>(null);
	let showNewFacilityAddress = $state(false);
	let newFacilityAddressLine1 = $state('');
	let newFacilityAddressLine2 = $state('');
	let newFacilityCity = $state('');
	let newFacilityState = $state('');
	let newFacilityPostalCode = $state('');
	let newFacilityCountry = $state('');
	let newFacilityTimezone = $state('');
	let newFacilitySlug = $state('');
	let newFacilityName = $state('');
	let newAreaSlug = $state('');
	let newAreaName = $state('');
	let slugTouched = $state(false);
	let areaSlugTouched = $state(false);

	// Facility details draft (for dirty detection + stable inputs).
	let facilityDraft = $state({
		name: '',
		slug: '',
		addressLine1: '',
		addressLine2: '',
		city: '',
		state: '',
		postalCode: '',
		country: '',
		timezone: '',
		notes: ''
	});
	let facilityBase = $state({
		name: '',
		slug: '',
		addressLine1: '',
		addressLine2: '',
		city: '',
		state: '',
		postalCode: '',
		country: '',
		timezone: '',
		notes: ''
	});
	let facilitySaveState = $state<'idle' | 'saving' | 'updated'>('idle');
	let facilityUpdatedTimer: ReturnType<typeof setTimeout> | null = null;

	// Confirm modal (archive/restore/delete).
	type ConfirmIntent =
		| { kind: 'facility-archive' | 'facility-restore'; facilityId: string }
		| { kind: 'area-archive' | 'area-restore'; facilityAreaId: string }
		| { kind: 'facility-delete'; facilityId: string; slug: string }
		| { kind: 'area-delete'; facilityAreaId: string; slug: string };

	let confirmOpen = $state(false);
	let confirmIntent = $state<ConfirmIntent | null>(null);
	let confirmSlugInput = $state('');
	let deleteConfirmSlug = $state('');
	let deleteConfirmAreaSlug = $state('');
	let archiveFacilityForm = $state<HTMLFormElement | null>(null);
	let deleteFacilityForm = $state<HTMLFormElement | null>(null);

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
		// Try to set a reasonable line 1 from the suggestion label.
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

	// Live slug: allow a trailing dash while typing (but never allow leading dash or double-dash).
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
				// No leading dash
				if (out.length === 0) {
					next = '';
				} else if (out.endsWith('-')) {
					// No double dash
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

	const currentClientId = $derived(data.clientId || '');

	const facilities = $derived.by(() => {
		const query = facilitySearch.trim().toLowerCase();
		return data.facilities
			.filter((f) => (showArchivedFacilities ? true : f.isActive !== 0))
			.filter((f) =>
				!query
					? true
					: (f.name || '').toLowerCase().includes(query) ||
						(f.slug || '').toLowerCase().includes(query)
			)
			.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
	});

	const selectedFacilityId = $derived(data.facilityId || (facilities[0]?.id ?? null));
	const selectedFacility = $derived.by(
		() => data.facilities.find((f) => f.id === selectedFacilityId) || null
	);

	$effect(() => {
		if (!selectedFacility) return;
		const nextDraft = {
			name: selectedFacility.name || '',
			slug: selectedFacility.slug || '',
			addressLine1: selectedFacility.addressLine1 || '',
			addressLine2: selectedFacility.addressLine2 || '',
			city: selectedFacility.city || '',
			state: selectedFacility.state || '',
			postalCode: selectedFacility.postalCode || '',
			country: selectedFacility.country || '',
			timezone: selectedFacility.timezone || '',
			notes: selectedFacility.notes || ''
		};
		facilityDraft = nextDraft;
		facilityBase = nextDraft;
		facilitySaveState = 'idle';
		if (facilityUpdatedTimer) {
			clearTimeout(facilityUpdatedTimer);
			facilityUpdatedTimer = null;
		}
	});

	const facilityIsDirty = $derived.by(() => {
		if (!selectedFacility) return false;
		const a = facilityDraft;
		const b = facilityBase;
		return (
			a.name !== b.name ||
			a.slug !== b.slug ||
			a.addressLine1 !== b.addressLine1 ||
			a.addressLine2 !== b.addressLine2 ||
			a.city !== b.city ||
			a.state !== b.state ||
			a.postalCode !== b.postalCode ||
			a.country !== b.country ||
			a.timezone !== b.timezone ||
			a.notes !== b.notes
		);
	});

	function openConfirm(intent: ConfirmIntent) {
		confirmIntent = intent;
		confirmSlugInput = '';
		confirmOpen = true;
	}
	function closeConfirm() {
		confirmOpen = false;
		confirmIntent = null;
		confirmSlugInput = '';
	}

	const allAreasForSelected = $derived.by(() => {
		const query = areaSearch.trim().toLowerCase();
		return data.facilityAreas
			.filter((a) => a.facilityId === selectedFacilityId)
			.filter((a) => (showArchivedAreas ? true : a.isActive !== 0))
			.filter((a) =>
				!query
					? true
					: (a.name || '').toLowerCase().includes(query) ||
						(a.slug || '').toLowerCase().includes(query)
			)
			.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
	});

	function openCreateFacility() {
		newFacilityName = '';
		newFacilitySlug = '';
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
	function openCreateArea() {
		if (!selectedFacilityId) return;
		newAreaName = '';
		newAreaSlug = '';
		areaSlugTouched = false;
		isCreateAreaOpen = true;
	}
	function closeCreateArea() {
		isCreateAreaOpen = false;
	}
</script>

<div class="p-8">
	<header class="flex flex-col gap-2 mb-6">
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<h2 class="text-4xl font-bold font-serif text-neutral-950">Facilities</h2>
			</div>
			<div class="flex items-center gap-3">
				<button
					class="button-secondary flex items-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
					type="button"
					onclick={openCreateFacility}
					disabled={!currentClientId}
				>
					<IconPlus class="w-5 h-5" />
					<span>New Facility</span>
				</button>
			</div>
		</div>
		<p class="text-neutral-950 font-sans max-w-3xl">
			Create facilities and manage their areas (fields/courts). Archive items to hide them from
			day-to-day scheduling without deleting history.
		</p>

		{#if form?.message}
			<div class="border-2 border-error-300 bg-error-50 p-4 flex items-start gap-3">
				<IconAlertCircle class="w-5 h-5 text-error-700 mt-0.5" />
				<p class="text-error-800 font-sans">{form.message}</p>
			</div>
		{/if}

		<!-- Client is resolved server-side (no selector shown) -->
	</header>

	<div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
		<!-- Left: Facilities list -->
		<section class="xl:col-span-4 bg-neutral-400 border-4 border-secondary">
			<div class="p-5 border-b border-secondary flex items-center justify-between gap-3">
				<h3 class="text-2xl font-bold font-serif text-neutral-950">Facility List</h3>
				<label class="flex items-center gap-2 text-sm font-sans text-neutral-950">
					<input type="checkbox" bind:checked={showArchivedFacilities} class="checkbox-secondary" />
					Show archived
				</label>
			</div>

			<div class="p-5 border-b border-secondary">
				<div class="relative">
					<IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950" />
					<label for="facility-search" class="sr-only">Search facilities</label>
					<input
						id="facility-search"
						type="text"
						bind:value={facilitySearch}
						placeholder="Search facilities..."
						class="w-full input-secondary pl-10"
					/>
				</div>
			</div>

			<div class="p-2">
				{#if facilities.length === 0}
					<div class="p-6 text-center">
						<p class="text-neutral-950 font-sans mb-4">No facilities yet.</p>
						<button
							class="button-accent inline-flex items-center gap-2"
							type="button"
							onclick={openCreateFacility}
						>
							<IconPlus class="w-5 h-5" />
							Create your first facility
						</button>
					</div>
				{:else}
					<ul class="space-y-2" aria-label="Facilities">
						{#each facilities as facility}
							<li>
								<a
									href={`/dashboard/facilities?facilityId=${encodeURIComponent(facility.id)}`}
									class="block w-full border border-secondary p-4 bg-white hover:bg-secondary-25 {facility.id ===
									selectedFacilityId
										? 'bg-secondary-25'
										: ''}"
									aria-current={facility.id === selectedFacilityId ? 'page' : undefined}
								>
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0">
											<p class="font-serif font-bold text-neutral-950 truncate">
												{facility.name || '(Unnamed facility)'}
											</p>
										</div>
										{#if facility.isActive === 0}
											<span class="badge-secondary text-xs">ARCHIVED</span>
										{/if}
									</div>
									<!-- Do not display address in lists -->
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>

		<!-- Right: Selected facility details + areas -->
		<section class="xl:col-span-8 space-y-6">
			{#if !selectedFacility}
				<div class="bg-secondary-50 border border-secondary p-8 text-center">
					<p class="text-neutral-950 font-sans">Select a facility to view details.</p>
				</div>
			{:else}
				<!-- Facility details -->
				<div class="bg-neutral-400 border-4 border-secondary">
					<div class="p-5 border-b border-secondary flex items-center justify-between gap-3">
						<h3 class="text-2xl font-bold font-serif text-neutral-950">Facility Details</h3>
						<form
							method="POST"
							action="?/setFacilityArchived"
							use:enhance
							bind:this={archiveFacilityForm}
							class="flex items-center gap-2"
						>
							<input type="hidden" name="facilityId" value={selectedFacility.id} />
							<input
								type="hidden"
								name="isActive"
								value={selectedFacility.isActive === 0 ? '1' : '0'}
							/>
							<button
								type="button"
								class="button-secondary-outlined p-2! flex items-center gap-2 min-w-[9rem] justify-center"
								onclick={() =>
									openConfirm(
										selectedFacility.isActive === 0
											? { kind: 'facility-restore', facilityId: selectedFacility.id }
											: { kind: 'facility-archive', facilityId: selectedFacility.id }
									)}
								aria-label={selectedFacility.isActive === 0
									? 'Restore facility'
									: 'Archive facility'}
							>
								{#if selectedFacility.isActive === 0}
									<IconRestore class="w-5 h-5 text-secondary-700" />
									<span class="font-sans font-bold text-secondary-900">Restore</span>
								{:else}
									<IconArchive class="w-5 h-5 text-accent-600" />
									<span class="font-sans font-bold text-secondary-900">Archive</span>
								{/if}
							</button>
						</form>

						{#if selectedFacility.isActive === 0}
							<form
								method="POST"
								action="?/deleteFacility"
								use:enhance={() => {
									return async ({ result, update }) => {
										await update();
										if (result.type === 'success' || result.type === 'redirect') closeConfirm();
									};
								}}
								bind:this={deleteFacilityForm}
							>
								<input type="hidden" name="facilityId" value={selectedFacility.id} />
								<input type="hidden" name="confirmSlug" value={deleteConfirmSlug} />
								<button
									type="button"
									class="button-secondary-outlined p-2!"
									onclick={() =>
										openConfirm({
											kind: 'facility-delete',
											facilityId: selectedFacility.id,
											slug: selectedFacility.slug || ''
										})}
									aria-label="Delete facility"
								>
									<IconTrash class="w-5 h-5 text-accent-600" />
								</button>
							</form>
						{/if}
					</div>

					<form
						method="POST"
						action="?/updateFacility"
						use:enhance={() => {
							facilitySaveState = 'saving';
							return async ({ update, result }) => {
								await update({ reset: false });
								if (result.type === 'success') {
									facilitySaveState = 'updated';
									facilityBase = { ...facilityDraft };
									if (facilityUpdatedTimer) clearTimeout(facilityUpdatedTimer);
									facilityUpdatedTimer = setTimeout(() => {
										facilitySaveState = 'idle';
									}, 1500);
								} else {
									facilitySaveState = 'idle';
								}
							};
						}}
						class="p-5 space-y-5"
					>
						{#if form?.action === 'updateFacility' && form?.message}
							<div class="border-2 border-error-300 bg-error-50 p-3 flex items-start gap-3">
								<IconAlertCircle class="w-5 h-5 text-error-700 mt-0.5" />
								<p class="text-error-800 font-sans">{form.message}</p>
							</div>
						{/if}
						<input type="hidden" name="facilityId" value={selectedFacility.id} />

						<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
							<div>
								<label for="facility-name" class="block text-sm font-sans text-neutral-950 mb-1"
									>Name</label
								>
								<input
									id="facility-name"
									name="name"
									type="text"
									bind:value={facilityDraft.name}
									class="w-full input-secondary bg-white"
								/>
							</div>
							<div>
								<label for="facility-slug" class="block text-sm font-sans text-neutral-950 mb-1"
									>Slug</label
								>
								<input
									id="facility-slug"
									name="slug"
									type="text"
									oninput={(e) => {
										const el = e.currentTarget as HTMLInputElement;
										facilityDraft.slug = applyLiveSlugInput(el);
									}}
									bind:value={facilityDraft.slug}
									class="w-full input-secondary bg-white"
								/>
								<p class="text-xs font-sans text-neutral-950 mt-1">
									Used in URLs. Example: <span class="font-mono">campus-rec-fields</span>
								</p>
							</div>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
							<div>
								<label for="facility-address1" class="block text-sm font-sans text-neutral-950 mb-1"
									>Address line 1</label
								>
								<input
									id="facility-address1"
									name="addressLine1"
									type="text"
									bind:value={facilityDraft.addressLine1}
									class="w-full input-secondary bg-white"
								/>
							</div>
							<div>
								<label for="facility-address2" class="block text-sm font-sans text-neutral-950 mb-1"
									>Address line 2</label
								>
								<input
									id="facility-address2"
									name="addressLine2"
									type="text"
									bind:value={facilityDraft.addressLine2}
									class="w-full input-secondary bg-white"
								/>
							</div>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-4 gap-5">
							<div class="md:col-span-2">
								<label for="facility-city" class="block text-sm font-sans text-neutral-950 mb-1"
									>City</label
								>
								<input
									id="facility-city"
									name="city"
									type="text"
									bind:value={facilityDraft.city}
									class="w-full input-secondary bg-white"
								/>
							</div>
							<div>
								<label for="facility-state" class="block text-sm font-sans text-neutral-950 mb-1"
									>State</label
								>
								<input
									id="facility-state"
									name="state"
									type="text"
									bind:value={facilityDraft.state}
									class="w-full input-secondary bg-white"
								/>
							</div>
							<div>
								<label for="facility-postal" class="block text-sm font-sans text-neutral-950 mb-1"
									>Postal code</label
								>
								<input
									id="facility-postal"
									name="postalCode"
									type="text"
									bind:value={facilityDraft.postalCode}
									class="w-full input-secondary bg-white"
								/>
							</div>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
							<div>
								<label for="facility-country" class="block text-sm font-sans text-neutral-950 mb-1"
									>Country</label
								>
								<input
									id="facility-country"
									name="country"
									type="text"
									bind:value={facilityDraft.country}
									class="w-full input-secondary bg-white"
								/>
							</div>
							<div>
								<label for="facility-timezone" class="block text-sm font-sans text-neutral-950 mb-1"
									>Timezone</label
								>
								<input
									id="facility-timezone"
									name="timezone"
									type="text"
									placeholder="America/New_York"
									bind:value={facilityDraft.timezone}
									class="w-full input-secondary bg-white"
									list="timezone-options"
								/>
							</div>
						</div>

						<div>
							<label for="facility-notes" class="block text-sm font-sans text-neutral-950 mb-1"
								>Notes</label
							>
							<textarea
								id="facility-notes"
								name="notes"
								rows="3"
								class="w-full textarea-secondary bg-white"
								bind:value={facilityDraft.notes}
							></textarea>
						</div>

						<div class="flex items-center justify-end gap-3 pt-2">
							<button
								type="submit"
								class="button-accent flex items-center gap-2 justify-center min-w-[11rem]"
								disabled={!facilityIsDirty || facilitySaveState === 'saving'}
							>
								{#if facilitySaveState === 'updated'}
									<IconCheck class="w-5 h-5" />
									<span>Updated</span>
								{:else if facilitySaveState === 'saving'}
									<IconPencil class="w-5 h-5" />
									<span>Saving…</span>
								{:else}
									<IconPencil class="w-5 h-5" />
									<span>Save Changes</span>
								{/if}
							</button>
						</div>
					</form>
				</div>

				<!-- Areas -->
				<div class="bg-neutral-400 border-4 border-secondary">
					<div
						class="p-5 border-b border-secondary flex flex-col md:flex-row md:items-center md:justify-between gap-4"
					>
						<div class="flex items-center gap-3">
							<IconSquare class="w-6 h-6 text-neutral-950" />
							<h3 class="text-2xl font-bold font-serif text-neutral-950">Areas</h3>
						</div>
						<div class="flex flex-wrap items-center gap-3">
							<label class="flex items-center gap-2 text-sm font-sans text-neutral-950">
								<input
									type="checkbox"
									bind:checked={showArchivedAreas}
									class="checkbox-secondary"
								/>
								Show archived
							</label>
							<button
								class="button-secondary flex items-center gap-2"
								type="button"
								onclick={openCreateArea}
							>
								<IconPlus class="w-5 h-5" />
								<span>New Area</span>
							</button>
						</div>
					</div>

					<div class="p-5 border-b border-secondary">
						<div class="relative">
							<IconSearch
								class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950"
							/>
							<label for="area-search" class="sr-only">Search areas</label>
							<input
								id="area-search"
								type="text"
								bind:value={areaSearch}
								placeholder="Search areas..."
								class="w-full input-secondary pl-10"
							/>
						</div>
					</div>

					<div class="p-5">
						{#if allAreasForSelected.length === 0}
							<p class="text-neutral-950 font-sans text-center py-8">
								No areas for this facility yet.
							</p>
						{:else}
							<ul class="space-y-3" aria-label="Facility areas">
								{#each allAreasForSelected as area}
									<li class="border border-secondary p-4 bg-white">
										<div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
											<div class="min-w-0">
												<p class="font-serif font-bold text-neutral-950 truncate">
													{area.name || '(Unnamed area)'}
												</p>
												<!-- Do not display slug in lists -->
												{#if area.isActive === 0}
													<p class="text-xs font-sans text-neutral-950 mt-2">
														<span class="badge-secondary text-xs">ARCHIVED</span>
													</p>
												{/if}
											</div>

											<div class="flex flex-wrap items-center gap-2">
												<button
													type="button"
													class="button-secondary-outlined p-2!"
													onclick={() =>
														(editingAreaId = editingAreaId === area.id ? null : area.id)}
													aria-label={editingAreaId === area.id ? 'Close edit area' : 'Edit area'}
												>
													<IconPencil class="w-5 h-5 text-secondary-700" />
												</button>

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
														class="button-secondary-outlined p-2!"
														aria-label={area.isActive === 0 ? 'Restore area' : 'Archive area'}
														onclick={() =>
															openConfirm(
																area.isActive === 0
																	? { kind: 'area-restore', facilityAreaId: area.id }
																	: { kind: 'area-archive', facilityAreaId: area.id }
															)}
													>
														{#if area.isActive === 0}
															<IconRestore class="w-5 h-5 text-secondary-700" />
														{:else}
															<IconArchive class="w-5 h-5 text-accent-600" />
														{/if}
													</button>
												</form>

												{#if area.isActive === 0}
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
														<input type="hidden" name="confirmSlug" value={deleteConfirmAreaSlug} />
														<button
															type="button"
															class="button-secondary-outlined p-2!"
															onclick={() =>
																openConfirm({
																	kind: 'area-delete',
																	facilityAreaId: area.id,
																	slug: area.slug || ''
																})}
															aria-label="Delete area"
														>
															<IconTrash class="w-5 h-5 text-accent-600" />
														</button>
													</form>
												{/if}
											</div>
										</div>

										{#if editingAreaId === area.id}
											<div class="mt-4 pt-4 border-t border-secondary">
												<div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
													<form
														method="POST"
														action="?/updateFacilityArea"
														use:enhance={() => {
															return async ({ update }) => {
																await update({ reset: false });
															};
														}}
														class="lg:col-span-8 space-y-4"
													>
														{#if form?.action === 'updateFacilityArea' && form?.message}
															<div
																class="border-2 border-error-300 bg-error-50 p-3 flex items-start gap-3"
															>
																<IconAlertCircle class="w-5 h-5 text-error-700 mt-0.5" />
																<p class="text-error-800 font-sans">{form.message}</p>
															</div>
														{/if}
														<input type="hidden" name="facilityAreaId" value={area.id} />

														<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
															<div>
																<label
																	for={`area-name-${area.id}`}
																	class="block text-sm font-sans text-neutral-950 mb-1">Name</label
																>
																<input
																	id={`area-name-${area.id}`}
																	name="name"
																	type="text"
																	value={area.name || ''}
																	class="w-full input-secondary"
																/>
															</div>
															<div>
																<label
																	for={`area-slug-${area.id}`}
																	class="block text-sm font-sans text-neutral-950 mb-1">Slug</label
																>
																<input
																	id={`area-slug-${area.id}`}
																	name="slug"
																	type="text"
																	value={area.slug || ''}
																	oninput={(e) => {
																		const el = e.currentTarget as HTMLInputElement;
																		el.value = applyLiveSlugInput(el);
																	}}
																	class="w-full input-secondary"
																/>
															</div>
														</div>

														<div class="flex items-center justify-end gap-3">
															<button type="submit" class="button-accent flex items-center gap-2">
																<IconPencil class="w-5 h-5" />
																<span>Save area</span>
															</button>
														</div>
													</form>

													<div class="lg:col-span-4 border border-secondary p-4 bg-white">
														<div class="flex items-center gap-2 mb-3">
															<IconTransfer class="w-5 h-5 text-neutral-950" />
															<p class="font-serif font-bold text-neutral-950">Transfer area</p>
														</div>
														<form
															method="POST"
															action="?/moveFacilityArea"
															use:enhance
															class="space-y-3"
														>
															<input type="hidden" name="facilityAreaId" value={area.id} />
															<label
																for={`area-move-${area.id}`}
																class="block text-sm font-sans text-neutral-950"
																>Move to facility</label
															>
															<select
																id={`area-move-${area.id}`}
																name="facilityId"
																class="w-full select-secondary"
															>
																{#each data.facilities.filter((f) => f.isActive !== 0) as f}
																	<option value={f.id} selected={f.id === area.facilityId}>
																		{f.name || f.slug || f.id}
																	</option>
																{/each}
															</select>
															<button
																type="submit"
																class="button-secondary-outlined w-full flex items-center justify-center gap-2"
															>
																<IconTransfer class="w-5 h-5" />
																<span>Transfer</span>
															</button>
															<p class="text-xs font-sans text-neutral-950">
																Transfers keep the same area record (IDs/history).
															</p>
														</form>
													</div>
												</div>
											</div>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{/if}
		</section>
	</div>
</div>

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
			onkeydown={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div class="p-5 border-b border-secondary flex items-center justify-between gap-3">
				<h3 class="text-2xl font-bold font-serif text-neutral-950">New Facility</h3>
				<button
					class="button-secondary"
					type="button"
					onclick={closeCreateFacility}
					aria-label="Close modal">Close</button
				>
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
						<p class="text-error-800 font-sans">{form.message}</p>
					</div>
				{/if}
				<!-- clientId resolved server-side -->

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
							bind:value={newFacilityName}
							oninput={(e) => {
								const el = e.currentTarget as HTMLInputElement;
								newFacilityName = el.value;
								if (!slugTouched) newFacilitySlug = slugifyFinal(el.value);
							}}
							class="w-full input-secondary"
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
							placeholder="campus-rec-fields"
							bind:value={newFacilitySlug}
							oninput={(e) => {
								slugTouched = true;
								const el = e.currentTarget as HTMLInputElement;
								newFacilitySlug = applyLiveSlugInput(el);
							}}
							class="w-full input-secondary"
						/>
						<p class="text-xs font-sans text-neutral-950 mt-1">
							Auto-formats to lowercase with dashes.
						</p>
					</div>
				</div>

				<div class="flex items-center justify-between border border-secondary p-4 bg-white">
					<div class="min-w-0">
						<p class="font-serif font-bold text-neutral-950">Address (optional)</p>
						<p class="text-sm font-sans text-neutral-950">
							Add a location now, or leave it blank and fill it in later.
						</p>
					</div>
					<button
						type="button"
						class="button-secondary flex items-center gap-2"
						onclick={() => (showNewFacilityAddress = !showNewFacilityAddress)}
						aria-label="Toggle address fields"
					>
						<IconMapPinPlus class="w-5 h-5" />
						<span>{showNewFacilityAddress ? 'Hide address' : 'Add address'}</span>
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
									autocomplete="street-address"
									bind:value={newFacilityAddressLine1}
									oninput={(e) => {
										const el = e.currentTarget as HTMLInputElement;
										scheduleAddressLookup(el.value);
									}}
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
														class="w-full text-left px-3 py-2 hover:bg-secondary-50 font-sans text-sm text-neutral-950"
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
								autocomplete="address-line2"
								bind:value={newFacilityAddressLine2}
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
								autocomplete="address-level2"
								bind:value={newFacilityCity}
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
								autocomplete="address-level1"
								bind:value={newFacilityState}
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
								autocomplete="postal-code"
								bind:value={newFacilityPostalCode}
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
								autocomplete="country-name"
								bind:value={newFacilityCountry}
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
							/>
						</div>
					</div>
				{/if}

				<div class="flex items-center justify-end gap-3">
					<button type="button" class="button-secondary" onclick={closeCreateFacility}
						>Cancel</button
					>
					<button type="submit" class="button-accent flex items-center gap-2">
						<IconPlus class="w-5 h-5" />
						<span>Create facility</span>
					</button>
				</div>
			</form>
		</div>
	</div>
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
			onkeydown={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div class="p-5 border-b border-secondary flex items-center justify-between gap-3">
				<h3 class="text-2xl font-bold font-serif text-neutral-950">
					{#if confirmIntent.kind === 'facility-delete' || confirmIntent.kind === 'area-delete'}
						Delete permanently?
					{:else if confirmIntent.kind === 'facility-archive' || confirmIntent.kind === 'area-archive'}
						Archive?
					{:else}
						Restore?
					{/if}
				</h3>
				<button class="button-secondary" type="button" onclick={closeConfirm}>Close</button>
			</div>

			<div class="p-5 space-y-4">
				{#if confirmIntent.kind === 'facility-delete'}
					<p class="font-sans text-neutral-950">
						This will <span class="font-bold">permanently delete</span> the facility. This action cannot
						be undone.
					</p>
					<p class="font-sans text-neutral-950">
						Type the facility slug to confirm: <span class="font-mono font-bold"
							>{confirmIntent.slug}</span
						>
					</p>
					<input
						class="w-full input-secondary bg-white"
						type="text"
						placeholder="Type slug to confirm…"
						bind:value={confirmSlugInput}
					/>
				{:else if confirmIntent.kind === 'area-delete'}
					<p class="font-sans text-neutral-950">
						This will <span class="font-bold">permanently delete</span> the area. This action cannot be
						undone.
					</p>
					<p class="font-sans text-neutral-950">
						Type the area slug to confirm: <span class="font-mono font-bold"
							>{confirmIntent.slug}</span
						>
					</p>
					<input
						class="w-full input-secondary bg-white"
						type="text"
						placeholder="Type slug to confirm…"
						bind:value={confirmSlugInput}
					/>
				{:else if confirmIntent.kind === 'facility-archive' || confirmIntent.kind === 'area-archive'}
					<p class="font-sans text-neutral-950">
						Archiving hides it from day-to-day use. You can restore it later.
					</p>
				{:else}
					<p class="font-sans text-neutral-950">This will make it active again.</p>
				{/if}

				<div class="flex items-center justify-end gap-3 pt-2">
					<button type="button" class="button-secondary" onclick={closeConfirm}>Cancel</button>
					<button
						type="button"
						class="button-accent flex items-center gap-2 min-w-[10rem] justify-center"
						disabled={(confirmIntent.kind === 'facility-delete' &&
							slugifyFinal(confirmSlugInput) !== slugifyFinal(confirmIntent.slug)) ||
							(confirmIntent.kind === 'area-delete' &&
								slugifyFinal(confirmSlugInput) !== slugifyFinal(confirmIntent.slug))}
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

							if (confirmIntent.kind === 'area-archive' || confirmIntent.kind === 'area-restore') {
								const formEl = document.getElementById(
									`area-archive-form-${confirmIntent.facilityAreaId}`
								) as HTMLFormElement | null;
								formEl?.requestSubmit();
								closeConfirm();
								return;
							}

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
						{#if confirmIntent.kind === 'facility-delete' || confirmIntent.kind === 'area-delete'}
							<IconTrash class="w-5 h-5" />
							<span>Delete</span>
						{:else if confirmIntent.kind === 'facility-archive' || confirmIntent.kind === 'area-archive'}
							<IconArchive class="w-5 h-5" />
							<span>Archive</span>
						{:else}
							<IconRestore class="w-5 h-5" />
							<span>Restore</span>
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Create Area Modal -->
{#if isCreateAreaOpen}
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
			onkeydown={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div class="p-5 border-b border-secondary flex items-center justify-between gap-3">
				<h3 class="text-2xl font-bold font-serif text-neutral-950">New Area</h3>
				<button
					class="button-secondary"
					type="button"
					onclick={closeCreateArea}
					aria-label="Close modal">Close</button
				>
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
						<p class="text-error-800 font-sans">{form.message}</p>
					</div>
				{/if}
				<!-- clientId resolved server-side -->
				<input type="hidden" name="facilityId" value={selectedFacilityId || ''} />

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
								if (!areaSlugTouched) newAreaSlug = slugifyFinal(el.value);
							}}
							class="w-full input-secondary"
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
							bind:value={newAreaSlug}
							oninput={(e) => {
								areaSlugTouched = true;
								const el = e.currentTarget as HTMLInputElement;
								newAreaSlug = applyLiveSlugInput(el);
							}}
							class="w-full input-secondary"
						/>
						<p class="text-xs font-sans text-neutral-950 mt-1">
							Auto-formats to lowercase with dashes.
						</p>
					</div>
				</div>

				<div class="flex items-center justify-end gap-3">
					<button type="button" class="button-secondary" onclick={closeCreateArea}>Cancel</button>
					<button type="submit" class="button-accent flex items-center gap-2">
						<IconPlus class="w-5 h-5" />
						<span>Create Area</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
