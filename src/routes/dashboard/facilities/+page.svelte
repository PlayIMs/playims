<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import { SvelteSet } from 'svelte/reactivity';
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
	import IconMapPinPlus from '@tabler/icons-svelte/icons/map-pin-plus';
	import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right';
	import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down';
	import IconChevronUp from '@tabler/icons-svelte/icons/chevron-up';
	import IconCopy from '@tabler/icons-svelte/icons/copy';
	import IconExternalLink from '@tabler/icons-svelte/icons/external-link';
	import IconBuilding from '@tabler/icons-svelte/icons/building';
	import IconX from '@tabler/icons-svelte/icons/x';

	let { data, form }: PageProps = $props();

	// Typed form data for accessing custom fields
	const formData = $derived(form as unknown as Record<string, unknown> | null);

	type FacilityCreateStep = 1 | 2 | 3 | 4;
	type AddAreasChoice = 'yes' | 'no';

	interface FacilityAreaDraft {
		draftId: string;
		name: string;
		slug: string;
		description: string;
		isSlugManual: boolean;
	}

	interface FacilityWizardForm {
		facility: {
			name: string;
			slug: string;
			description: string;
			addressLine1: string;
			addressLine2: string;
			city: string;
			state: string;
			postalCode: string;
			country: string;
			timezone: string;
		};
		addAreas: AddAreasChoice;
		areaDraft: FacilityAreaDraft;
		areas: FacilityAreaDraft[];
	}

	const FACILITY_CREATE_STEP_TITLES: Record<FacilityCreateStep, string> = {
		1: 'Facility Basics',
		2: 'Location Details',
		3: 'Facility Areas',
		4: 'Review & Create'
	};

	let viewArchiveMode = $state(false);
	let facilitySearch = $state('');
	let areaSearch = $state('');

	let isCreateFacilityOpen = $state(false);
	let createFacilityStep = $state<FacilityCreateStep>(1);
	let createFacilitySubmitting = $state(false);
	let createFacilityFormError = $state('');
	let createFacilityModalPointerDownStartedInside = $state(false);
	let facilitySlugTouched = $state(false);
	let wizardAreaSlugTouched = $state(false);
	let areaDraftActive = $state(false);
	let areaEditingIndex = $state<number | null>(null);

	let isCreateAreaOpen = $state(false);
	let editingFacilityId = $state<string | null>(null);
	let editingAreaId = $state<string | null>(null);
	let expandedFacilityIds = new SvelteSet<string>();
	let newAreaCode = $state('');
	let newAreaName = $state('');
	let newAreaDescription = $state('');
	let areaSlugTouched = $state(false);
	let creatingAreaForFacilityId = $state<string | null>(null);

	function createAreaDraftId(): string {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `facility-area-draft-${Math.random().toString(36).slice(2, 10)}`;
	}

	function createEmptyAreaDraft(): FacilityAreaDraft {
		return {
			draftId: createAreaDraftId(),
			name: '',
			slug: '',
			description: '',
			isSlugManual: false
		};
	}

	function createEmptyFacilityWizardForm(): FacilityWizardForm {
		return {
			facility: {
				name: '',
				slug: '',
				description: '',
				addressLine1: '',
				addressLine2: '',
				city: '',
				state: '',
				postalCode: '',
				country: '',
				timezone: ''
			},
			addAreas: 'no',
			areaDraft: createEmptyAreaDraft(),
			areas: []
		};
	}

	let createFacilityForm = $state<FacilityWizardForm>(createEmptyFacilityWizardForm());

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
		Record<string, { name: string; slug: string; description: string }>
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
		createFacilityForm.facility.addressLine1 = (s.label.split(',')[0] || addressQuery).trim();
		createFacilityForm.facility.city = s.city || createFacilityForm.facility.city;
		createFacilityForm.facility.state = s.state || createFacilityForm.facility.state;
		createFacilityForm.facility.postalCode = s.postalCode || createFacilityForm.facility.postalCode;
		createFacilityForm.facility.country = s.country || createFacilityForm.facility.country;
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

			let next: string;
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

	function resetCreateFacilityWizard(): void {
		createFacilityStep = 1;
		createFacilitySubmitting = false;
		createFacilityFormError = '';
		facilitySlugTouched = false;
		wizardAreaSlugTouched = false;
		areaDraftActive = false;
		areaEditingIndex = null;
		addressQuery = '';
		addressSuggestions = [];
		createFacilityForm = createEmptyFacilityWizardForm();
	}

	function openCreateFacility() {
		resetCreateFacilityWizard();
		isCreateFacilityOpen = true;
	}

	function closeCreateFacility() {
		isCreateFacilityOpen = false;
		createFacilityModalPointerDownStartedInside = false;
		resetCreateFacilityWizard();
	}

	function hasFacilityDraftData(): boolean {
		const values = createFacilityForm.facility;
		return (
			values.name.trim().length > 0 ||
			values.slug.trim().length > 0 ||
			values.description.trim().length > 0 ||
			values.addressLine1.trim().length > 0 ||
			values.addressLine2.trim().length > 0 ||
			values.city.trim().length > 0 ||
			values.state.trim().length > 0 ||
			values.postalCode.trim().length > 0 ||
			values.country.trim().length > 0 ||
			values.timezone.trim().length > 0
		);
	}

	function hasAreaDraftData(): boolean {
		const values = createFacilityForm.areaDraft;
		return (
			values.name.trim().length > 0 ||
			values.slug.trim().length > 0 ||
			values.description.trim().length > 0
		);
	}

	function hasUnsavedCreateFacilityChanges(): boolean {
		return (
			hasFacilityDraftData() ||
			createFacilityForm.addAreas === 'yes' ||
			createFacilityForm.areas.length > 0 ||
			areaDraftActive ||
			(areaDraftActive && hasAreaDraftData())
		);
	}

	function requestCloseCreateFacilityWizard(): void {
		if (!isCreateFacilityOpen) return;
		if (createFacilitySubmitting) return;

		if (!hasUnsavedCreateFacilityChanges()) {
			closeCreateFacility();
			return;
		}

		if (typeof window !== 'undefined') {
			const confirmed = window.confirm(
				'You have unsaved changes in this wizard. Close without saving?'
			);
			if (!confirmed) return;
		}

		closeCreateFacility();
	}

	function handleCreateFacilityModalPointerDown(event: PointerEvent): void {
		createFacilityModalPointerDownStartedInside = event.target !== event.currentTarget;
	}

	function handleCreateFacilityModalBackdropClick(event: MouseEvent): void {
		if (event.target !== event.currentTarget) return;
		if (createFacilityModalPointerDownStartedInside) {
			createFacilityModalPointerDownStartedInside = false;
			return;
		}
		requestCloseCreateFacilityWizard();
	}

	function createStepTitle(step: FacilityCreateStep): string {
		return FACILITY_CREATE_STEP_TITLES[step];
	}

	function startAreaDraft(): void {
		areaDraftActive = true;
		areaEditingIndex = null;
		wizardAreaSlugTouched = false;
		createFacilityForm.areaDraft = createEmptyAreaDraft();
	}

	function cancelAreaDraft(): void {
		areaDraftActive = false;
		areaEditingIndex = null;
		wizardAreaSlugTouched = false;
		createFacilityForm.areaDraft = createEmptyAreaDraft();
	}

	function startEditingWizardArea(index: number): void {
		const area = createFacilityForm.areas[index];
		if (!area) return;

		areaDraftActive = true;
		areaEditingIndex = index;
		wizardAreaSlugTouched = area.isSlugManual;
		createFacilityForm.areaDraft = {
			...area,
			draftId: area.draftId || createAreaDraftId()
		};
	}

	function duplicateWizardArea(index: number): void {
		const source = createFacilityForm.areas[index];
		if (!source) return;

		const normalizedSlug = slugifyFinal(source.slug);
		const baseSlug = normalizedSlug || 'area';
		let candidateSlug = `${baseSlug}-copy`;
		let counter = 2;
		const existingSlugs = new Set(createFacilityForm.areas.map((area) => slugifyFinal(area.slug)));
		while (existingSlugs.has(candidateSlug)) {
			candidateSlug = `${baseSlug}-copy-${counter}`;
			counter += 1;
		}

		createFacilityForm.areas = [
			...createFacilityForm.areas,
			{
				...source,
				draftId: createAreaDraftId(),
				slug: candidateSlug,
				name: `${source.name} Copy`,
				isSlugManual: true
			}
		];
	}

	function removeWizardArea(index: number): void {
		createFacilityForm.areas = createFacilityForm.areas.filter((_, areaIndex) => areaIndex !== index);
	}

	function moveWizardArea(index: number, direction: -1 | 1): void {
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= createFacilityForm.areas.length) return;

		const reordered = [...createFacilityForm.areas];
		const [movedArea] = reordered.splice(index, 1);
		if (!movedArea) return;
		reordered.splice(targetIndex, 0, movedArea);
		createFacilityForm.areas = reordered;
	}

	function getFacilityBasicsErrors(values: FacilityWizardForm['facility']): Record<string, string> {
		const errors: Record<string, string> = {};
		const name = values.name.trim();
		const slug = slugifyFinal(values.slug);

		if (!name) errors['facility.name'] = 'Facility name is required.';
		if (!slug) errors['facility.slug'] = 'Facility slug is required.';
		return errors;
	}

	function getAreaDraftErrors(
		values: FacilityAreaDraft,
		existingAreas: FacilityAreaDraft[],
		editingIndex: number | null
	): Record<string, string> {
		const errors: Record<string, string> = {};
		const name = values.name.trim();
		const slug = slugifyFinal(values.slug);

		if (!name) errors['areaDraft.name'] = 'Area name is required.';
		if (!slug) errors['areaDraft.slug'] = 'Area slug is required.';

		const duplicateName = existingAreas.some((area, index) => {
			if (editingIndex !== null && editingIndex === index) return false;
			return area.name.trim().toLowerCase() === name.toLowerCase();
		});
		if (name && duplicateName) errors['areaDraft.name'] = 'Area name must be unique for this facility.';

		const duplicateSlug = existingAreas.some((area, index) => {
			if (editingIndex !== null && editingIndex === index) return false;
			return slugifyFinal(area.slug) === slug;
		});
		if (slug && duplicateSlug) errors['areaDraft.slug'] = 'Area slug must be unique for this facility.';

		return errors;
	}

	function getAreasStepErrors(values: FacilityWizardForm): Record<string, string> {
		const errors: Record<string, string> = {};
		if (values.addAreas !== 'yes') return errors;

		if (areaDraftActive) {
			Object.assign(
				errors,
				getAreaDraftErrors(values.areaDraft, values.areas, areaEditingIndex)
			);
		} else if (values.areas.length === 0) {
			errors['areas'] = 'Add at least one area, or select "No" for adding areas now.';
		}

		return errors;
	}

	function getCurrentCreateStepErrors(
		values: FacilityWizardForm,
		step: FacilityCreateStep
	): Record<string, string> {
		if (step === 1) return getFacilityBasicsErrors(values.facility);
		if (step === 3) return getAreasStepErrors(values);
		if (step === 4) {
			const reviewErrors: Record<string, string> = {
				...getFacilityBasicsErrors(values.facility),
				...getAreasStepErrors(values)
			};
			if (values.addAreas === 'yes' && areaDraftActive) {
				reviewErrors['areas'] = 'Finish the open area draft before creating the facility.';
			}
			return reviewErrors;
		}
		return {};
	}

	function saveWizardAreaDraft(): boolean {
		const draftErrors = getAreaDraftErrors(
			createFacilityForm.areaDraft,
			createFacilityForm.areas,
			areaEditingIndex
		);
		if (Object.keys(draftErrors).length > 0) return false;

		const normalizedDraft: FacilityAreaDraft = {
			...createFacilityForm.areaDraft,
			name: createFacilityForm.areaDraft.name.trim(),
			slug: slugifyFinal(createFacilityForm.areaDraft.slug),
			description: createFacilityForm.areaDraft.description.trim()
		};

		if (areaEditingIndex === null) {
			createFacilityForm.areas = [...createFacilityForm.areas, normalizedDraft];
		} else {
			createFacilityForm.areas = createFacilityForm.areas.map((area, index) =>
				index === areaEditingIndex ? normalizedDraft : area
			);
		}

		cancelAreaDraft();
		return true;
	}

	function nextCreateFacilityStep(): void {
		if (createFacilityStep === 4) return;
		if (Object.keys(getCurrentCreateStepErrors(createFacilityForm, createFacilityStep)).length > 0) return;

		if (createFacilityStep === 3 && areaDraftActive) {
			saveWizardAreaDraft();
			return;
		}

		createFacilityStep = (createFacilityStep + 1) as FacilityCreateStep;
	}

	function previousCreateFacilityStep(): void {
		if (createFacilityStep === 1) return;
		createFacilityStep = (createFacilityStep - 1) as FacilityCreateStep;
	}

	function handleCreateFacilityBackAction(): void {
		if (createFacilityStep === 3 && areaDraftActive) {
			cancelAreaDraft();
			return;
		}
		previousCreateFacilityStep();
	}

	const createFacilityFieldErrors = $derived.by(() =>
		getCurrentCreateStepErrors(createFacilityForm, createFacilityStep)
	);

	const canGoNextCreateFacilityStep = $derived.by(
		() =>
			createFacilityStep < 4 &&
			Object.keys(createFacilityFieldErrors).length === 0 &&
			!createFacilitySubmitting
	);

	const canSubmitCreateFacility = $derived.by(
		() =>
			createFacilityStep === 4 &&
			Object.keys(getCurrentCreateStepErrors(createFacilityForm, 4)).length === 0 &&
			!createFacilitySubmitting
	);

	const createFacilityStepProgress = $derived.by(() =>
		Math.round((createFacilityStep / 4) * 100)
	);

	const serializedWizardAreas = $derived.by(() =>
		JSON.stringify(
			createFacilityForm.areas.map((area) => ({
				name: area.name.trim(),
				slug: slugifyFinal(area.slug),
				description: area.description.trim()
			}))
		)
	);

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
	const totalFacilityCount = $derived(data.facilities.length);
	const activeFacilityCount = $derived(data.facilities.filter((facility) => facility.isActive !== 0).length);
	const archivedFacilityCount = $derived(
		data.facilities.filter((facility) => facility.isActive === 0).length
	);
	const activeFacilityAreaCount = $derived(
		data.facilityAreas.filter((facilityArea) => facilityArea.isActive !== 0).length
	);

	$effect(() => {
		if (!data.facilityId || expandedFacilityIds.has(data.facilityId)) return;
		expandedFacilityIds.add(data.facilityId);
	});

	$effect(() => {
		if (typeof document === 'undefined') return;
		if (!isCreateFacilityOpen) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		if (!isCreateFacilityOpen || !hasUnsavedCreateFacilityChanges()) return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	// Compute matched area IDs based on facility search - use $effect to update state
	let matchedAreaIds = new SvelteSet<string>();

	$effect(() => {
		const query = facilitySearch.trim().toLowerCase();
		if (!query) {
			matchedAreaIds.clear();
		} else {
			// Find matching areas
			const matchingAreas = data.facilityAreas.filter(
				(a) =>
					(a.name || '').toLowerCase().includes(query) ||
					(a.slug || '').toLowerCase().includes(query)
			);
			matchedAreaIds.clear();
			for (const area of matchingAreas) {
				matchedAreaIds.add(area.id);
			}
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

	function getAreasForFacility(facilityId: string) {
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
		if (expandedFacilityIds.has(facilityId)) {
			expandedFacilityIds.delete(facilityId);
		} else {
			expandedFacilityIds.add(facilityId);
		}
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
			slug: area.slug || '',
			description: area.description || ''
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

	function openCreateArea(facilityId: string) {
		creatingAreaForFacilityId = facilityId;
		newAreaName = '';
		newAreaCode = '';
		newAreaDescription = '';
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
				requestCloseCreateFacilityWizard();
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

<div class="p-6 lg:p-8 space-y-6">
	<header class="border-2 border-secondary-300 bg-neutral p-5 space-y-4">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="flex items-start gap-3">
				<div
					class="bg-primary text-white w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
					aria-hidden="true"
				>
					<IconBuilding class="w-7 h-7 lg:w-8 lg:h-8" />
				</div>
				<div>
					<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
						Facilities
					</h1>
					<p class="text-sm font-sans text-neutral-900 mt-1">
						Manage facility locations and the playable areas inside each site.
					</p>
				</div>
			</div>
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

	<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
		<div class="border border-secondary-300 bg-white px-4 py-3">
			<p class="text-xs uppercase tracking-wide text-neutral-900 font-sans">Facilities</p>
			<p class="text-2xl font-bold font-serif text-neutral-950">{totalFacilityCount}</p>
		</div>
		<div class="border border-secondary-300 bg-white px-4 py-3">
			<p class="text-xs uppercase tracking-wide text-neutral-900 font-sans">Active Facilities</p>
			<p class="text-2xl font-bold font-serif text-neutral-950">{activeFacilityCount}</p>
		</div>
		<div class="border border-secondary-300 bg-white px-4 py-3">
			<p class="text-xs uppercase tracking-wide text-neutral-900 font-sans">Active Areas</p>
			<p class="text-2xl font-bold font-serif text-neutral-950">{activeFacilityAreaCount}</p>
		</div>
		<div class="border border-secondary-300 bg-white px-4 py-3">
			<p class="text-xs uppercase tracking-wide text-neutral-900 font-sans">Archived Facilities</p>
			<p class="text-2xl font-bold font-serif text-neutral-950">{archivedFacilityCount}</p>
		</div>
	</div>

	<section class="border-2 border-secondary-300 bg-neutral">
		<div class="p-4 border-b border-secondary-300 bg-neutral-600/66 space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<h2 class="text-2xl font-bold font-serif text-neutral-950">
					{viewArchiveMode ? 'Archived Facilities' : 'Facility Directory'}
				</h2>
				<div class="flex items-center gap-2 text-xs text-neutral-950 font-sans">
					<span class="border border-secondary-300 px-2 py-1">
						{facilities.length}
						{facilities.length === 1 ? ' facility' : ' facilities'}
					</span>
					<button
						class="button-secondary-outlined {viewArchiveMode ? 'bg-secondary-100' : ''} cursor-pointer"
						type="button"
						onclick={() => (viewArchiveMode = !viewArchiveMode)}
					>
						{viewArchiveMode ? 'View Active' : 'View Archive'}
					</button>
				</div>
			</div>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
				<div class="relative">
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
				<div class="relative">
					<IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950" />
					<label for="area-search" class="sr-only">Filter expanded area lists</label>
					<input
						id="area-search"
						type="text"
						bind:value={areaSearch}
						placeholder="Filter areas in expanded facilities..."
						class="w-full input-secondary pl-10"
						autocomplete="off"
						data-lpignore="true"
					/>
				</div>
			</div>
		</div>

		<div class="p-4 space-y-4">
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
				{@const facilityAreas = getAreasForFacility(facility.id)}
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
													<span
														role="link"
														tabindex="0"
														class="hover:underline cursor-pointer flex items-center gap-1"
														onclick={(e) => {
															e.stopPropagation();
															window.open(mapsUrl, '_blank', 'noopener,noreferrer');
														}}
														onkeydown={(event) => {
															if (event.key === 'Enter' || event.key === ' ') {
																event.preventDefault();
																event.stopPropagation();
																window.open(mapsUrl, '_blank', 'noopener,noreferrer');
															}
														}}
													>
														<IconMapPin class="w-3 h-3" />
														{[facility.addressLine1, facility.city, facility.state]
															.filter(Boolean)
															.join(', ')}
														<IconExternalLink class="w-3 h-3" />
													</span>
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
																name="description"
																bind:value={areaDrafts[area.id].description}
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
												<div class="flex items-start justify-between gap-3">
													<div class="min-w-0">
														<span class="font-sans text-neutral-950 truncate block">
															{area.name || '(Unnamed area)'}
														</span>
														{#if area.description}
															<p class="text-xs text-neutral-900 mt-0.5 truncate">
																{area.description}
															</p>
														{/if}
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
	</section>
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
		class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 lg:p-6"
		onpointerdown={handleCreateFacilityModalPointerDown}
		onclick={handleCreateFacilityModalBackdropClick}
		onkeydown={(event) => {
			if (event.key === 'Escape') requestCloseCreateFacilityWizard();
		}}
		role="button"
		tabindex="0"
		aria-label="Close modal"
	>
		<div
			class="w-full max-w-5xl bg-neutral-400 border-4 border-secondary max-h-[95vh] overflow-hidden flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div class="p-5 border-b border-secondary space-y-2">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-xs uppercase tracking-wide font-sans text-neutral-900">Create Facility</p>
						<h3 class="text-2xl font-bold font-serif text-neutral-950">
							Step {createFacilityStep} of 4: {createStepTitle(createFacilityStep)}
						</h3>
					</div>
					<button
						type="button"
						class="button-secondary-outlined p-1.5 cursor-pointer"
						aria-label="Close create facility wizard"
						onclick={requestCloseCreateFacilityWizard}
					>
						<IconX class="w-4 h-4" />
					</button>
				</div>
				<div class="h-2 bg-secondary-200 overflow-hidden" aria-hidden="true">
					<div class="h-full bg-secondary" style={`width: ${createFacilityStepProgress}%`}></div>
				</div>
			</div>

			<form
				method="POST"
				action="?/createFacilityWithAreas"
				use:enhance={() => {
					createFacilitySubmitting = true;
					createFacilityFormError = '';
					return async ({ result, update }) => {
						await update({ reset: false });
						createFacilitySubmitting = false;
						if (result.type === 'redirect' || result.type === 'success') {
							closeCreateFacility();
							return;
						}
						if (result.type === 'failure') {
							createFacilityFormError =
								((result.data as { message?: string } | null)?.message ?? '').trim() ||
								'Could not create facility. Review the form and try again.';
						}
					};
				}}
				class="flex-1 overflow-y-auto p-5 space-y-5"
			>
				<input type="hidden" name="name" value={createFacilityForm.facility.name.trim()} />
				<input type="hidden" name="slug" value={slugifyFinal(createFacilityForm.facility.slug)} />
				<input type="hidden" name="description" value={createFacilityForm.facility.description.trim()} />
				<input type="hidden" name="addressLine1" value={createFacilityForm.facility.addressLine1.trim()} />
				<input type="hidden" name="addressLine2" value={createFacilityForm.facility.addressLine2.trim()} />
				<input type="hidden" name="city" value={createFacilityForm.facility.city.trim()} />
				<input type="hidden" name="state" value={createFacilityForm.facility.state.trim()} />
				<input type="hidden" name="postalCode" value={createFacilityForm.facility.postalCode.trim()} />
				<input type="hidden" name="country" value={createFacilityForm.facility.country.trim()} />
				<input type="hidden" name="timezone" value={createFacilityForm.facility.timezone.trim()} />
				<input type="hidden" name="areasJson" value={serializedWizardAreas} />

				{#if createFacilityFormError}
					<div class="border-2 border-error-300 bg-error-50 p-3 flex items-start gap-3">
						<IconAlertCircle class="w-5 h-5 text-error-700 mt-0.5" />
						<div class="flex-1">
							<p class="text-error-800 font-sans">{createFacilityFormError}</p>
						</div>
					</div>
				{/if}

				{#if form?.action === 'createFacilityWithAreas' && form?.message}
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
													(facility) => facility.id === formData.archivedFacilityId
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

				{#if createFacilityStep === 1}
					<div class="space-y-4">
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<div>
								<label for="wizard-facility-name" class="block text-sm font-sans text-neutral-950 mb-1"
									>Name <span class="text-error-700">*</span></label
								>
								<input
									id="wizard-facility-name"
									type="text"
									use:autofocus
									class="input-secondary"
									placeholder="Intramural Fields"
									value={createFacilityForm.facility.name}
									oninput={(event) => {
										const value = (event.currentTarget as HTMLInputElement).value;
										createFacilityForm.facility.name = value;
										if (!facilitySlugTouched) {
											createFacilityForm.facility.slug = slugifyFinal(value);
										}
									}}
									autocomplete="off"
								/>
								{#if createFacilityFieldErrors['facility.name']}
									<p class="text-xs text-error-700 mt-1">
										{createFacilityFieldErrors['facility.name']}
									</p>
								{/if}
							</div>
							<div>
								<label for="wizard-facility-slug" class="block text-sm font-sans text-neutral-950 mb-1"
									>Slug <span class="text-error-700">*</span></label
								>
								<input
									id="wizard-facility-slug"
									type="text"
									class="input-secondary"
									placeholder="intramural-fields"
									value={createFacilityForm.facility.slug}
									oninput={(event) => {
										facilitySlugTouched = true;
										createFacilityForm.facility.slug = applyLiveSlugInput(
											event.currentTarget as HTMLInputElement
										);
									}}
									autocomplete="off"
								/>
								<p class="text-xs font-sans text-neutral-950 mt-1">
									Auto-formats to lowercase with dashes.
								</p>
								{#if createFacilityFieldErrors['facility.slug']}
									<p class="text-xs text-error-700 mt-1">
										{createFacilityFieldErrors['facility.slug']}
									</p>
								{/if}
							</div>
						</div>
						<div>
							<label for="wizard-facility-description" class="block text-sm font-sans text-neutral-950 mb-1"
								>Description (optional)</label
							>
							<textarea
								id="wizard-facility-description"
								class="textarea-secondary min-h-28"
								bind:value={createFacilityForm.facility.description}
								placeholder="Add notes about this facility for staff and coordinators."
							></textarea>
						</div>
					</div>
				{/if}

				{#if createFacilityStep === 2}
					<div class="space-y-4">
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<div>
								<label
									for="wizard-facility-address-line1"
									class="block text-sm font-sans text-neutral-950 mb-1">Address line 1</label
								>
								<div class="relative">
									<input
										id="wizard-facility-address-line1"
										type="text"
										class="input-secondary"
										bind:value={createFacilityForm.facility.addressLine1}
										oninput={(event) =>
											scheduleAddressLookup((event.currentTarget as HTMLInputElement).value)}
										autocomplete="off"
									/>
									{#if isAddressLoading}
										<div class="absolute right-2 top-2 text-xs font-sans text-secondary-700">
											Looking up...
										</div>
									{/if}
									{#if addressSuggestions.length > 0}
										<div class="absolute z-10 mt-1 w-full border-2 border-secondary-300 bg-white">
											<ul
												class="max-h-56 overflow-auto"
												role="listbox"
												aria-label="Address suggestions"
											>
												{#each addressSuggestions as suggestion (suggestion.label)}
													<li class="border-b border-secondary-200 last:border-b-0">
														<button
															type="button"
															class="w-full text-left px-3 py-2 hover:bg-secondary-50 font-sans text-sm text-neutral-950 cursor-pointer"
															onclick={() => applyAddressSuggestion(suggestion)}
														>
															{suggestion.label}
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
									for="wizard-facility-address-line2"
									class="block text-sm font-sans text-neutral-950 mb-1">Address line 2</label
								>
								<input
									id="wizard-facility-address-line2"
									type="text"
									class="input-secondary"
									bind:value={createFacilityForm.facility.addressLine2}
									autocomplete="off"
								/>
							</div>
						</div>
						<div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
							<div class="lg:col-span-2">
								<label for="wizard-facility-city" class="block text-sm font-sans text-neutral-950 mb-1"
									>City</label
								>
								<input
									id="wizard-facility-city"
									type="text"
									class="input-secondary"
									bind:value={createFacilityForm.facility.city}
									autocomplete="off"
								/>
							</div>
							<div>
								<label
									for="wizard-facility-state"
									class="block text-sm font-sans text-neutral-950 mb-1">State</label
								>
								<input
									id="wizard-facility-state"
									type="text"
									class="input-secondary"
									bind:value={createFacilityForm.facility.state}
									autocomplete="off"
								/>
							</div>
							<div>
								<label
									for="wizard-facility-postal-code"
									class="block text-sm font-sans text-neutral-950 mb-1">Postal code</label
								>
								<input
									id="wizard-facility-postal-code"
									type="text"
									class="input-secondary"
									bind:value={createFacilityForm.facility.postalCode}
									autocomplete="off"
								/>
							</div>
						</div>
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<div>
								<label
									for="wizard-facility-country"
									class="block text-sm font-sans text-neutral-950 mb-1">Country</label
								>
								<input
									id="wizard-facility-country"
									type="text"
									class="input-secondary"
									bind:value={createFacilityForm.facility.country}
									autocomplete="off"
								/>
							</div>
							<div>
								<label
									for="wizard-facility-timezone"
									class="block text-sm font-sans text-neutral-950 mb-1">Timezone</label
								>
								<input
									id="wizard-facility-timezone"
									type="text"
									class="input-secondary"
									list="timezone-options"
									placeholder="America/New_York"
									bind:value={createFacilityForm.facility.timezone}
									autocomplete="off"
								/>
							</div>
						</div>
					</div>
				{/if}

				{#if createFacilityStep === 3}
					<div class="space-y-4">
						<fieldset class="border border-secondary-300 bg-white p-3 space-y-2">
							<legend class="text-sm font-semibold text-neutral-950 px-1">Add areas now?</legend>
							<label class="flex items-center gap-2 text-sm text-neutral-950 font-sans">
								<input
									type="radio"
									class="radio-secondary"
									name="wizard-add-areas"
									value="yes"
									bind:group={createFacilityForm.addAreas}
								/>
								Yes, create facility areas during setup.
							</label>
							<label class="flex items-center gap-2 text-sm text-neutral-950 font-sans">
								<input
									type="radio"
									class="radio-secondary"
									name="wizard-add-areas"
									value="no"
									bind:group={createFacilityForm.addAreas}
									onchange={() => {
										if (createFacilityForm.addAreas === 'no') cancelAreaDraft();
									}}
								/>
								No, I will add areas later.
							</label>
						</fieldset>

						{#if createFacilityForm.addAreas === 'yes'}
							<div class="border-2 border-secondary-300 bg-white">
								<div class="p-3 border-b border-secondary-300 flex items-center justify-between gap-2">
									<h4 class="text-lg font-bold font-serif text-neutral-950">Areas</h4>
									{#if !areaDraftActive}
										<button
											type="button"
											class="button-secondary-outlined p-1.5 cursor-pointer"
											aria-label="Add area draft"
											onclick={startAreaDraft}
										>
											<IconPlus class="w-4 h-4" />
										</button>
									{/if}
								</div>
								<div class="p-3 space-y-3">
									{#if createFacilityFieldErrors['areas']}
										<p class="text-xs text-error-700">{createFacilityFieldErrors['areas']}</p>
									{/if}

									{#if createFacilityForm.areas.length > 0}
										<div class="space-y-2">
											{#each createFacilityForm.areas as area, areaIndex (area.draftId)}
												<div class="border border-secondary-300 bg-neutral p-3">
													<div class="flex items-start justify-between gap-3">
														<div>
															<p class="text-sm font-semibold text-neutral-950">
																{area.name || 'Untitled Area'}
															</p>
															<p class="text-xs text-neutral-900">Slug: {area.slug || 'TBD'}</p>
															{#if area.description.trim()}
																<p class="text-xs text-neutral-950 mt-1">{area.description.trim()}</p>
															{/if}
														</div>
														<div class="flex items-center gap-1">
															<button
																type="button"
																class="button-secondary-outlined p-1.5 cursor-pointer"
																aria-label="Move area up"
																disabled={areaIndex === 0}
																onclick={() => moveWizardArea(areaIndex, -1)}
															>
																<IconChevronUp class="w-4 h-4" />
															</button>
															<button
																type="button"
																class="button-secondary-outlined p-1.5 cursor-pointer"
																aria-label="Move area down"
																disabled={areaIndex === createFacilityForm.areas.length - 1}
																onclick={() => moveWizardArea(areaIndex, 1)}
															>
																<IconChevronDown class="w-4 h-4" />
															</button>
															<button
																type="button"
																class="button-secondary-outlined p-1.5 cursor-pointer"
																aria-label="Edit area"
																onclick={() => startEditingWizardArea(areaIndex)}
															>
																<IconPencil class="w-4 h-4" />
															</button>
															<button
																type="button"
																class="button-secondary-outlined p-1.5 cursor-pointer"
																aria-label="Copy area"
																onclick={() => duplicateWizardArea(areaIndex)}
															>
																<IconCopy class="w-4 h-4" />
															</button>
															<button
																type="button"
																class="button-secondary-outlined p-1.5 cursor-pointer"
																aria-label="Remove area"
																onclick={() => removeWizardArea(areaIndex)}
															>
																<IconTrash class="w-4 h-4" />
															</button>
														</div>
													</div>
												</div>
											{/each}
										</div>
									{/if}

									{#if areaDraftActive}
										<div class="border border-secondary-300 bg-white p-3 space-y-3">
											<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
												<div>
													<label
														for="wizard-area-name"
														class="block text-sm font-sans text-neutral-950 mb-1"
														>Name <span class="text-error-700">*</span></label
													>
													<input
														id="wizard-area-name"
														type="text"
														class="input-secondary"
														value={createFacilityForm.areaDraft.name}
														placeholder="Field 1"
														oninput={(event) => {
															const value = (event.currentTarget as HTMLInputElement).value;
															createFacilityForm.areaDraft.name = value;
															if (!wizardAreaSlugTouched) {
																createFacilityForm.areaDraft.slug = slugifyFinal(value);
																createFacilityForm.areaDraft.isSlugManual = false;
															}
														}}
														autocomplete="off"
													/>
													{#if createFacilityFieldErrors['areaDraft.name']}
														<p class="text-xs text-error-700 mt-1">
															{createFacilityFieldErrors['areaDraft.name']}
														</p>
													{/if}
												</div>
												<div>
													<label
														for="wizard-area-slug"
														class="block text-sm font-sans text-neutral-950 mb-1"
														>Slug <span class="text-error-700">*</span></label
													>
													<input
														id="wizard-area-slug"
														type="text"
														class="input-secondary"
														value={createFacilityForm.areaDraft.slug}
														placeholder="field-1"
														oninput={(event) => {
															wizardAreaSlugTouched = true;
															createFacilityForm.areaDraft.isSlugManual = true;
															createFacilityForm.areaDraft.slug = applyLiveSlugInput(
																event.currentTarget as HTMLInputElement
															);
														}}
														autocomplete="off"
													/>
													{#if createFacilityFieldErrors['areaDraft.slug']}
														<p class="text-xs text-error-700 mt-1">
															{createFacilityFieldErrors['areaDraft.slug']}
														</p>
													{/if}
												</div>
											</div>
											<div>
												<label
													for="wizard-area-description"
													class="block text-sm font-sans text-neutral-950 mb-1">Description</label
												>
												<textarea
													id="wizard-area-description"
													class="textarea-secondary min-h-24"
													bind:value={createFacilityForm.areaDraft.description}
													placeholder="Optional notes about this area."
												></textarea>
											</div>
										</div>
									{:else if createFacilityForm.areas.length === 0}
										<p class="text-sm font-sans text-neutral-950">
											No areas added yet. Click the plus button to add one.
										</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if createFacilityStep === 4}
					<div class="space-y-4">
						<div class="border-2 border-secondary-300 bg-white p-4 space-y-2">
							<h4 class="text-lg font-bold font-serif text-neutral-950">Facility</h4>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Name:</span> {createFacilityForm.facility.name || 'TBD'}
							</p>
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Slug:</span>
								{slugifyFinal(createFacilityForm.facility.slug) || 'TBD'}
							</p>
							{#if createFacilityForm.facility.description.trim()}
								<p class="text-sm text-neutral-950">
									<span class="font-semibold">Description:</span>
									{createFacilityForm.facility.description.trim()}
								</p>
							{/if}
							{#if createFacilityForm.facility.addressLine1 || createFacilityForm.facility.city || createFacilityForm.facility.state || createFacilityForm.facility.postalCode || createFacilityForm.facility.country}
								<p class="text-sm text-neutral-950">
									<span class="font-semibold">Address:</span>
									{[
										createFacilityForm.facility.addressLine1,
										createFacilityForm.facility.addressLine2,
										createFacilityForm.facility.city,
										createFacilityForm.facility.state,
										createFacilityForm.facility.postalCode,
										createFacilityForm.facility.country
									]
										.filter((part) => part.trim().length > 0)
										.join(', ')}
								</p>
							{/if}
							{#if createFacilityForm.facility.timezone.trim()}
								<p class="text-sm text-neutral-950">
									<span class="font-semibold">Timezone:</span>
									{createFacilityForm.facility.timezone.trim()}
								</p>
							{/if}
						</div>
						<div class="border-2 border-secondary-300 bg-white p-4 space-y-2">
							<h4 class="text-lg font-bold font-serif text-neutral-950">Areas</h4>
							{#if createFacilityForm.addAreas === 'no'}
								<p class="text-sm text-neutral-950 font-sans">
									No areas will be created yet.
								</p>
							{:else if createFacilityForm.areas.length === 0}
								<p class="text-sm text-neutral-950 font-sans">
									No areas in the draft list.
								</p>
							{:else}
								<div class="space-y-2">
									{#each createFacilityForm.areas as area (area.draftId)}
										<div class="border border-secondary-300 bg-neutral p-3">
											<p class="text-sm font-semibold text-neutral-950">{area.name}</p>
											<p class="text-xs text-neutral-900">Slug: {slugifyFinal(area.slug)}</p>
											{#if area.description.trim()}
												<p class="text-xs text-neutral-950 mt-1">{area.description.trim()}</p>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
							{#if createFacilityFieldErrors['areas']}
								<p class="text-xs text-error-700">{createFacilityFieldErrors['areas']}</p>
							{/if}
						</div>
					</div>
				{/if}

				<div class="pt-2 border-t border-secondary-300 flex justify-end">
					<div class="flex items-center gap-2">
						{#if createFacilityStep > 1}
							<button
								type="button"
								class="button-secondary-outlined cursor-pointer"
								onclick={handleCreateFacilityBackAction}
							>
								Back
							</button>
						{/if}
						{#if createFacilityStep < 4}
							<button
								type="button"
								class="button-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								onclick={nextCreateFacilityStep}
								disabled={!canGoNextCreateFacilityStep}
							>
								{#if createFacilityStep === 3 && areaDraftActive}
									{areaEditingIndex === null ? 'Add Area' : 'Update Area'}
								{:else if createFacilityStep === 3}
									Review
								{:else}
									Next
								{/if}
							</button>
						{:else}
							<button
								type="submit"
								class="button-accent flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={!canSubmitCreateFacility}
							>
								<IconPlus class="w-5 h-5" />
								<span>{createFacilitySubmitting ? 'Creating...' : 'Create Facility'}</span>
							</button>
						{/if}
					</div>
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

				<div>
					<label for="new-area-description" class="block text-sm font-sans text-neutral-950 mb-1"
						>Description (optional)</label
					>
					<textarea
						id="new-area-description"
						name="description"
						bind:value={newAreaDescription}
						rows="2"
						class="w-full input-secondary resize-none"
						autocomplete="off"
					></textarea>
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
