<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import SplitAddAction from '$lib/components/dashboard/SplitAddAction.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import DataTableRowActions from '$lib/components/data-table/DataTableRowActions.svelte';
	import {
		createDataTableRowActionColumn,
		type DataTableColumn,
		type DataTableRowActionOption
	} from '$lib/components/data-table.js';
	import CreateFacilityWizard from './_wizards/CreateFacilityWizard.svelte';
	import EditFacilityWizard from './_wizards/EditFacilityWizard.svelte';
	import FacilityAreaWizard from './_wizards/FacilityAreaWizard.svelte';
	import {
		adjustEditingIndexOnReorder,
		createWizardDirtyState,
		isRequiredFieldMessage,
		moveCollectionItemByOffset,
		pickFieldErrors,
		removeCollectionItem,
		slugifyFinal,
		toServerFieldErrorMap
	} from '$lib/components/wizard';
	import {
		IconArchive,
		IconBuilding,
		IconDots,
		IconExternalLink,
		IconMapPin,
		IconPlus,
		IconRestore,
		IconSquare,
		IconTrash
	} from '@tabler/icons-svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import { toast } from '$lib/toasts';
	import { generateUuidV4 } from '$lib/utils/uuid.js';
	import {
		getVisibleAreasForFacility,
		getVisibleFacilities,
		resolveSelectedFacilityId
	} from './facilities-page-state.js';

	let { data, form }: PageProps = $props();
	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).facilities
	);
	const formData = $derived(form as unknown as Record<string, unknown> | null);

	type FacilityRecord = PageProps['data']['facilities'][number];
	type FacilityAreaRecord = PageProps['data']['facilityAreas'][number];
	type FacilityCreateStep = 1 | 2 | 3 | 4 | 5;

	interface FacilityDisplayRecord {
		id: string;
		name: string | null | undefined;
		slug: string | null | undefined;
		description?: string | null;
		isActive: number | null | undefined;
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		postalCode?: string | null;
		country?: string | null;
		timezone?: string | null;
		capacity?: number | null;
	}

	interface FacilityAreaDisplayRecord {
		id: string;
		facilityId: string | null | undefined;
		name: string | null | undefined;
		slug: string | null | undefined;
		description?: string | null;
		isActive: number | null | undefined;
		capacity?: number | null;
	}

	interface FacilityAreaDraft {
		draftId: string;
		name: string;
		slug: string;
		description: string;
		isSlugManual: boolean;
		isActive: boolean;
		capacity: number;
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
			isActive: boolean;
			capacity: number;
		};
		areaDraft: FacilityAreaDraft;
		areas: FacilityAreaDraft[];
	}

	interface EditFacilityForm {
		id: string;
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
		capacity: string;
	}

	interface FacilityAreaWizardForm {
		id: string;
		facilityId: string;
		name: string;
		slug: string;
		description: string;
		capacity: string;
	}

	interface DropdownOption {
		value: string;
		label: string;
		disabled?: boolean;
		separatorBefore?: boolean;
		tooltip?: string;
		disabledTooltip?: string;
	}

	interface CreateFacilityApiResponse {
		success: boolean;
		data?: {
			facility: FacilityRecord;
			facilityAreas: FacilityAreaRecord[];
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
		duplicateType?: 'archived';
		archivedFacilityId?: string;
		archivedAreaId?: string;
		archivedAreaFacilityId?: string;
	}

	type ConfirmIntent =
		| { kind: 'facility-archive' | 'facility-restore'; facilityId: string }
		| { kind: 'area-archive' | 'area-restore'; facilityAreaId: string }
		| { kind: 'facility-delete'; facilityId: string; slug: string; name?: string }
		| { kind: 'area-delete'; facilityAreaId: string; slug: string; name?: string };

	const FACILITY_CREATE_STEP_TITLES: Record<FacilityCreateStep, string> = {
		1: 'Facility Basics',
		2: 'Facility Setup',
		3: 'Facility Areas',
		4: 'Facility Area Setup',
		5: 'Review & Create'
	};
	const WORKSPACE_OPTIONS: DropdownOption[] = [
		{ value: 'active', label: 'Active' },
		{ value: 'archive', label: 'Archive' }
	];
	const COMPACT_DROPDOWN_BUTTON_CLASS =
		'button-neutral-outlined w-auto h-[1.875rem] min-w-36 px-3 py-1 text-sm font-semibold cursor-pointer inline-flex items-center justify-between gap-2';
	const HEADER_COUNT_BADGE_CLASS =
		'badge-neutral-outlined h-[1.875rem] bg-transparent px-2.5 font-normal normal-case tracking-normal';
	const HEADER_SPLIT_ADD_BUTTON_CLASS =
		'button-primary-outlined h-[1.875rem] px-2 text-xs font-bold uppercase tracking-wide cursor-pointer';
	const HEADER_SPLIT_ADD_MENU_BUTTON_CLASS =
		'button-primary-outlined -ml-[2px] h-[1.875rem] px-1 cursor-pointer';

	let viewArchiveMode = $state(false);
	let facilitySearch = $state('');
	let facilitiesData = $state<FacilityRecord[]>([]);
	let facilityAreasData = $state<FacilityAreaRecord[]>([]);
	let selectedFacilityId = $state<string | null>(null);
	let highlightedAreaId = $state<string | null>(null);
	let handledDeepLinkedAreaId = $state<string | null>(null);
	let handledDeepLinkedFacilityId = $state<string | null>(null);

	let isCreateFacilityOpen = $state(false);
	let createFacilityStep = $state<FacilityCreateStep>(1);
	let createFacilitySubmitting = $state(false);
	let createFacilityFormError = $state('');
	let createFacilitySuccessMessage = $state('');
	let createFacilityUnsavedConfirmOpen = $state(false);
	let facilitySlugTouched = $state(false);
	let wizardAreaSlugTouched = $state(false);
	let areaDraftActive = $state(false);
	let areaEditingIndex = $state<number | null>(null);
	let createFacilityServerFieldErrors = $state<Record<string, string>>({});
	let createFacilityConflictMeta = $state<{
		duplicateType?: 'archived';
		archivedFacilityId?: string;
		archivedAreaId?: string;
		archivedAreaFacilityId?: string;
	}>({});

	let isEditFacilityOpen = $state(false);
	let editFacilitySubmitting = $state(false);
	let editFacilityUnsavedConfirmOpen = $state(false);
	let editFacilitySlugTouched = $state(false);
	let editFacilityFormError = $state('');
	let editFacilityForm = $state<EditFacilityForm>({
		id: '',
		name: '',
		slug: '',
		description: '',
		addressLine1: '',
		addressLine2: '',
		city: '',
		state: '',
		postalCode: '',
		country: '',
		timezone: '',
		capacity: ''
	});

	let isAreaWizardOpen = $state(false);
	let areaWizardMode = $state<'create' | 'edit'>('create');
	let areaWizardSubmitting = $state(false);
	let areaWizardUnsavedConfirmOpen = $state(false);
	let areaWizardSlugTouched = $state(false);
	let areaWizardFormError = $state('');
	let areaWizardForm = $state<FacilityAreaWizardForm>({
		id: '',
		facilityId: '',
		name: '',
		slug: '',
		description: '',
		capacity: ''
	});

	let confirmOpen = $state(false);
	let confirmIntent = $state<ConfirmIntent | null>(null);
	let confirmSlugInput = $state('');
	let lastFacilityFeedbackToast = $state('');
	let lastFacilitySuccessToast = $state('');

	const createFacilityDirtyState = createWizardDirtyState<FacilityWizardForm>();
	const editFacilityDirtyState = createWizardDirtyState<EditFacilityForm>();
	const areaWizardDirtyState = createWizardDirtyState<FacilityAreaWizardForm>();

	function createAreaDraftId(): string {
		return generateUuidV4();
	}

	function createEmptyAreaDraft(): FacilityAreaDraft {
		return {
			draftId: createAreaDraftId(),
			name: '',
			slug: '',
			description: '',
			isSlugManual: false,
			isActive: true,
			capacity: 0
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
				timezone: '',
				isActive: true,
				capacity: 0
			},
			areaDraft: createEmptyAreaDraft(),
			areas: []
		};
	}

	let createFacilityForm = $state<FacilityWizardForm>(createEmptyFacilityWizardForm());

	function normalizeOptionalText(value: string): string | null {
		const normalized = value.trim();
		return normalized.length > 0 ? normalized : null;
	}

	function normalizeCapacityForRequest(value: number): number | null {
		return Number.isInteger(value) && value >= 1 ? value : null;
	}

	function normalizeName(value: string | null | undefined): string {
		return (value ?? '').trim().toLowerCase();
	}

	function parseCapacityInput(value: string): number | null | 'invalid' {
		const trimmed = value.trim();
		if (!trimmed) return null;
		const parsed = Number(trimmed);
		if (!Number.isInteger(parsed) || parsed < 1) return 'invalid';
		return parsed;
	}

	function workspaceLabel(): string {
		return viewArchiveMode ? 'Archive' : 'Facilities';
	}

	function createStepTitle(step: FacilityCreateStep): string {
		return FACILITY_CREATE_STEP_TITLES[step];
	}

	function clearCreateFacilityApiErrors(): void {
		if (createFacilityFormError) createFacilityFormError = '';
		if (Object.keys(createFacilityServerFieldErrors).length > 0)
			createFacilityServerFieldErrors = {};
		if (createFacilityConflictMeta.duplicateType) createFacilityConflictMeta = {};
	}

	function resetCreateFacilityWizard(): void {
		createFacilityStep = 1;
		createFacilitySubmitting = false;
		createFacilityFormError = '';
		createFacilityServerFieldErrors = {};
		createFacilityConflictMeta = {};
		createFacilityUnsavedConfirmOpen = false;
		facilitySlugTouched = false;
		wizardAreaSlugTouched = false;
		areaDraftActive = false;
		areaEditingIndex = null;
		createFacilityForm = createEmptyFacilityWizardForm();
		createFacilityDirtyState.clearBaseline();
	}

	function openCreateFacility(): void {
		resetCreateFacilityWizard();
		createFacilityDirtyState.captureBaseline(createFacilityForm);
		isCreateFacilityOpen = true;
	}

	function closeCreateFacility(): void {
		isCreateFacilityOpen = false;
		createFacilityUnsavedConfirmOpen = false;
		resetCreateFacilityWizard();
	}

	function hasUnsavedCreateFacilityChanges(): boolean {
		return createFacilityDirtyState.isDirty(createFacilityForm);
	}

	function requestCloseCreateFacilityWizard(): void {
		if (!isCreateFacilityOpen || createFacilitySubmitting) return;
		if (!hasUnsavedCreateFacilityChanges()) {
			closeCreateFacility();
			return;
		}
		createFacilityUnsavedConfirmOpen = true;
	}

	function confirmDiscardCreateFacilityWizard(): void {
		createFacilityUnsavedConfirmOpen = false;
		closeCreateFacility();
	}

	function cancelDiscardCreateFacilityWizard(): void {
		createFacilityUnsavedConfirmOpen = false;
	}

	function startAreaDraft(): void {
		clearCreateFacilityApiErrors();
		areaDraftActive = true;
		areaEditingIndex = null;
		wizardAreaSlugTouched = false;
		createFacilityForm.areaDraft = createEmptyAreaDraft();
		createFacilityStep = 4;
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
		clearCreateFacilityApiErrors();
		areaDraftActive = true;
		areaEditingIndex = index;
		wizardAreaSlugTouched = area.isSlugManual;
		createFacilityForm.areaDraft = {
			...area,
			draftId: area.draftId || createAreaDraftId()
		};
		createFacilityStep = 4;
	}

	function duplicateWizardArea(index: number): void {
		const source = createFacilityForm.areas[index];
		if (!source) return;
		const normalizedSlug = slugifyFinal(source.slug);
		const baseSlug = normalizedSlug || 'area';
		const baseName = source.name.trim() || 'Area';
		let candidateSlug = `${baseSlug}-copy`;
		let candidateName = `${baseName} Copy`;
		let counter = 2;
		const existingNames = new Set(
			createFacilityForm.areas.map((area) => area.name.trim().toLowerCase())
		);
		const existingSlugs = new Set(createFacilityForm.areas.map((area) => slugifyFinal(area.slug)));
		while (existingSlugs.has(candidateSlug) || existingNames.has(candidateName.toLowerCase())) {
			candidateSlug = `${baseSlug}-copy-${counter}`;
			candidateName = `${baseName} Copy ${counter}`;
			counter += 1;
		}
		const nextAreas = [...createFacilityForm.areas];
		nextAreas.splice(index + 1, 0, {
			...source,
			draftId: createAreaDraftId(),
			slug: candidateSlug,
			name: candidateName,
			isSlugManual: false
		});
		createFacilityForm.areas = nextAreas;
		if (areaEditingIndex !== null && areaEditingIndex > index) areaEditingIndex += 1;
	}

	function removeWizardArea(index: number): void {
		createFacilityForm.areas = removeCollectionItem(createFacilityForm.areas, index);
	}

	function moveWizardArea(index: number, direction: -1 | 1): void {
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= createFacilityForm.areas.length) return;
		createFacilityForm.areas = moveCollectionItemByOffset(
			createFacilityForm.areas,
			index,
			direction
		);
		areaEditingIndex = adjustEditingIndexOnReorder(areaEditingIndex, index, targetIndex);
	}

	function getFacilityFieldErrors(
		values: FacilityWizardForm['facility'] | EditFacilityForm,
		excludeFacilityId: string | null = null
	): Record<string, string> {
		const errors: Record<string, string> = {};
		const name = values.name.trim();
		const slug = slugifyFinal(values.slug);
		const rawCapacity = 'capacity' in values ? values.capacity : '';

		if (!name) errors.name = 'Facility name is required.';
		if (!slug) errors.slug = 'Facility slug is required.';

		const parsedCapacity =
			typeof rawCapacity === 'string'
				? parseCapacityInput(rawCapacity)
				: rawCapacity > 0
					? rawCapacity
					: null;
		if (parsedCapacity === 'invalid') {
			errors.capacity = 'Capacity must be a whole number of at least 1.';
		}

		const duplicate = facilitiesData.find((facility) => {
			if (excludeFacilityId && facility.id === excludeFacilityId) return false;
			const matchesName = name && normalizeName(facility.name) === normalizeName(name);
			const matchesSlug = slug && slugifyFinal(facility.slug ?? '') === slug;
			return matchesName || matchesSlug;
		});
		if (duplicate) {
			if (!errors.name && name && normalizeName(duplicate.name) === normalizeName(name)) {
				errors.name = 'Facility name must be unique.';
			}
			if (!errors.slug && slug && slugifyFinal(duplicate.slug ?? '') === slug) {
				errors.slug = 'Facility slug must be unique.';
			}
		}

		return errors;
	}

	function getAreaFieldErrors(
		values: FacilityAreaDraft | FacilityAreaWizardForm,
		facilityId: string,
		excludeAreaId: string | null = null,
		existingAreas: FacilityAreaDraft[] | FacilityAreaRecord[] = facilityAreasData
	): Record<string, string> {
		const errors: Record<string, string> = {};
		const name = values.name.trim();
		const slug = slugifyFinal(values.slug);
		const rawCapacity = 'capacity' in values ? values.capacity : '';
		const parsedCapacity =
			typeof rawCapacity === 'string'
				? parseCapacityInput(rawCapacity)
				: rawCapacity > 0
					? rawCapacity
					: null;

		if (!name) errors.name = 'Area name is required.';
		if (!slug) errors.slug = 'Area slug is required.';
		if (parsedCapacity === 'invalid')
			errors.capacity = 'Capacity must be a whole number of at least 1.';
		if (!facilityId) errors.facilityId = 'Choose a facility first.';
		if (!facilityId || facilityId === 'new-facility') return errors;

		const duplicate = existingAreas.find((area) => {
			const areaId = 'id' in area ? area.id : null;
			const areaFacilityId = 'facilityId' in area ? (area.facilityId ?? '') : facilityId;
			if (excludeAreaId && areaId === excludeAreaId) return false;
			if (areaFacilityId !== facilityId) return false;
			const matchesName = name && normalizeName(area.name) === normalizeName(name);
			const matchesSlug = slug && slugifyFinal(area.slug ?? '') === slug;
			return matchesName || matchesSlug;
		});

		if (duplicate) {
			if (!errors.name && name && normalizeName(duplicate.name) === normalizeName(name)) {
				errors.name = 'Area name must be unique for this facility.';
			}
			if (!errors.slug && slug && slugifyFinal(duplicate.slug ?? '') === slug) {
				errors.slug = 'Area slug must be unique for this facility.';
			}
		}

		return errors;
	}

	function getCurrentStepClientErrors(
		values: FacilityWizardForm,
		step: FacilityCreateStep
	): Record<string, string> {
		if (step === 1) {
			const errors = getFacilityFieldErrors(values.facility);
			return pickFieldErrors({ 'facility.name': errors.name, 'facility.slug': errors.slug }, [
				'facility.name',
				'facility.slug'
			]);
		}
		if (step === 2) {
			const errors = getFacilityFieldErrors(values.facility);
			return pickFieldErrors({ 'facility.capacity': errors.capacity }, ['facility.capacity']);
		}
		if (step === 3) return {};
		if (step === 4) {
			if (!areaDraftActive) return {};
			const errors = getAreaFieldErrors(
				values.areaDraft,
				'new-facility',
				areaEditingIndex === null ? null : (values.areas[areaEditingIndex]?.draftId ?? null),
				values.areas
			);
			return pickFieldErrors(
				{
					'areaDraft.name': errors.name,
					'areaDraft.slug': errors.slug,
					'areaDraft.capacity': errors.capacity
				},
				['areaDraft.name', 'areaDraft.slug', 'areaDraft.capacity']
			);
		}
		return getSubmitClientErrors(values);
	}

	function getSubmitClientErrors(values: FacilityWizardForm): Record<string, string> {
		const errors: Record<string, string> = {};
		const facilityErrors = getFacilityFieldErrors(values.facility);
		if (facilityErrors.name) errors['facility.name'] = facilityErrors.name;
		if (facilityErrors.slug) errors['facility.slug'] = facilityErrors.slug;
		if (facilityErrors.capacity) errors['facility.capacity'] = facilityErrors.capacity;

		values.areas.forEach((area, index) => {
			const areaErrors = getAreaFieldErrors(area, 'new-facility', area.draftId, values.areas);
			if (areaErrors.name) errors[`areas.${index}.name`] = areaErrors.name;
			if (areaErrors.slug) errors[`areas.${index}.slug`] = areaErrors.slug;
			if (areaErrors.capacity) errors[`areas.${index}.capacity`] = areaErrors.capacity;
		});

		return errors;
	}

	function firstInvalidStep(errors: Record<string, string>): FacilityCreateStep {
		const keys = Object.keys(errors);
		if (keys.some((key) => ['facility.name', 'facility.slug'].includes(key))) return 1;
		if (keys.some((key) => key === 'facility.capacity')) return 2;
		if (keys.some((key) => key.startsWith('areaDraft.'))) return 4;
		if (keys.some((key) => key.startsWith('areas.'))) return 3;
		return 5;
	}

	function addOrUpdateDraftArea(): boolean {
		const draftErrors = getCurrentStepClientErrors(createFacilityForm, 4);
		if (Object.keys(draftErrors).length > 0) {
			createFacilityStep = firstInvalidStep(draftErrors);
			return false;
		}

		const normalizedDraft: FacilityAreaDraft = {
			...createFacilityForm.areaDraft,
			name: createFacilityForm.areaDraft.name.trim(),
			slug: slugifyFinal(createFacilityForm.areaDraft.slug),
			description: createFacilityForm.areaDraft.description.trim(),
			isSlugManual: areaDraftActive,
			capacity: Number.isInteger(createFacilityForm.areaDraft.capacity)
				? createFacilityForm.areaDraft.capacity
				: 0
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
		clearCreateFacilityApiErrors();
		if (createFacilityStep === 5 || createFacilitySubmitting) return;
		const stepErrors = getCurrentStepClientErrors(createFacilityForm, createFacilityStep);
		if (Object.keys(stepErrors).length > 0) {
			createFacilityStep = firstInvalidStep(stepErrors);
			return;
		}
		if (createFacilityStep === 3) {
			createFacilityStep = areaDraftActive ? 4 : 5;
			return;
		}
		if (createFacilityStep === 4) {
			if (!areaDraftActive) {
				createFacilityStep = 3;
				return;
			}
			if (!addOrUpdateDraftArea()) return;
			createFacilityStep = 3;
			return;
		}
		createFacilityStep = (createFacilityStep + 1) as FacilityCreateStep;
	}

	function previousCreateFacilityStep(): void {
		clearCreateFacilityApiErrors();
		if (createFacilityStep === 1) return;
		if (createFacilityStep === 5) {
			createFacilityStep = areaDraftActive ? 4 : 3;
			return;
		}
		createFacilityStep = (createFacilityStep - 1) as FacilityCreateStep;
	}

	function handleCreateFacilityBackAction(): void {
		if (areaDraftActive && (createFacilityStep === 3 || createFacilityStep === 4)) {
			cancelAreaDraft();
			createFacilityStep = 3;
			return;
		}
		previousCreateFacilityStep();
	}

	function startEditingFacilityDraft(): void {
		clearCreateFacilityApiErrors();
		createFacilityStep = 1;
	}

	function startEditingAreasDraft(): void {
		clearCreateFacilityApiErrors();
		createFacilityStep = 3;
	}

	const clientCreateFacilityFieldErrors = $derived.by(() =>
		getCurrentStepClientErrors(createFacilityForm, createFacilityStep)
	);
	const rawCreateFacilityFieldErrors = $derived.by(() => ({
		...clientCreateFacilityFieldErrors,
		...createFacilityServerFieldErrors
	}));
	const createFacilityFieldErrors = $derived.by(() => {
		const visibleErrors: Record<string, string> = {};
		for (const [key, value] of Object.entries(rawCreateFacilityFieldErrors)) {
			if (!isRequiredFieldMessage(value)) visibleErrors[key] = value;
		}
		return visibleErrors;
	});
	const canGoNextCreateFacilityStep = $derived.by(
		() =>
			createFacilityStep < 5 &&
			Object.keys(clientCreateFacilityFieldErrors).length === 0 &&
			!createFacilitySubmitting
	);
	const canSubmitCreateFacility = $derived.by(
		() =>
			createFacilityStep === 5 &&
			Object.keys(getSubmitClientErrors(createFacilityForm)).length === 0 &&
			Object.keys(createFacilityServerFieldErrors).length === 0 &&
			!createFacilitySubmitting
	);
	const createFacilityStepProgress = $derived.by(() => Math.round((createFacilityStep / 5) * 100));

	async function submitCreateFacilityWizard(): Promise<void> {
		const clientErrors = getSubmitClientErrors(createFacilityForm);
		if (Object.keys(clientErrors).length > 0) {
			createFacilityStep = firstInvalidStep(clientErrors);
			return;
		}

		createFacilitySubmitting = true;
		createFacilityFormError = '';
		createFacilityServerFieldErrors = {};
		createFacilityConflictMeta = {};

		const payload = {
			facility: {
				name: createFacilityForm.facility.name.trim(),
				slug: slugifyFinal(createFacilityForm.facility.slug),
				description: normalizeOptionalText(createFacilityForm.facility.description),
				addressLine1: normalizeOptionalText(createFacilityForm.facility.addressLine1),
				addressLine2: normalizeOptionalText(createFacilityForm.facility.addressLine2),
				city: normalizeOptionalText(createFacilityForm.facility.city),
				state: normalizeOptionalText(createFacilityForm.facility.state),
				postalCode: normalizeOptionalText(createFacilityForm.facility.postalCode),
				country: normalizeOptionalText(createFacilityForm.facility.country),
				timezone: normalizeOptionalText(createFacilityForm.facility.timezone),
				isActive: createFacilityForm.facility.isActive,
				capacity: normalizeCapacityForRequest(createFacilityForm.facility.capacity)
			},
			areas: createFacilityForm.areas.map((area) => ({
				name: area.name.trim(),
				slug: slugifyFinal(area.slug),
				description: normalizeOptionalText(area.description),
				isActive: area.isActive,
				capacity: normalizeCapacityForRequest(area.capacity)
			}))
		};

		try {
			const response = await fetch('/api/facilities', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});

			let body: CreateFacilityApiResponse | null = null;
			try {
				body = (await response.json()) as CreateFacilityApiResponse;
			} catch {
				body = null;
			}

			if (!response.ok || !body?.success || !body.data) {
				createFacilityServerFieldErrors = toServerFieldErrorMap(body?.fieldErrors);
				createFacilityConflictMeta = {
					duplicateType: body?.duplicateType,
					archivedFacilityId: body?.archivedFacilityId,
					archivedAreaId: body?.archivedAreaId,
					archivedAreaFacilityId: body?.archivedAreaFacilityId
				};
				const combinedErrors = {
					...getSubmitClientErrors(createFacilityForm),
					...createFacilityServerFieldErrors
				};
				createFacilityStep = firstInvalidStep(combinedErrors);
				createFacilityFormError = body?.error || 'Unable to save facility right now.';
				return;
			}

			facilitiesData = [body.data.facility, ...facilitiesData];
			facilityAreasData = [...body.data.facilityAreas, ...facilityAreasData];
			selectedFacilityId = body.data.facility.id;
			createFacilitySuccessMessage =
				body.data.facilityAreas.length > 0
					? `Facility and ${body.data.facilityAreas.length} ${body.data.facilityAreas.length === 1 ? 'area' : 'areas'} created successfully.`
					: 'Facility created successfully.';
			closeCreateFacility();
		} catch {
			createFacilityFormError = 'Unable to save facility right now.';
		} finally {
			createFacilitySubmitting = false;
		}
	}

	function createEmptyEditFacilityForm(): EditFacilityForm {
		return {
			id: '',
			name: '',
			slug: '',
			description: '',
			addressLine1: '',
			addressLine2: '',
			city: '',
			state: '',
			postalCode: '',
			country: '',
			timezone: '',
			capacity: ''
		};
	}

	function clearEditFacilityErrors(): void {
		editFacilityFormError = '';
	}

	function openEditFacilityWizard(facility: FacilityDisplayRecord): void {
		selectedFacilityId = facility.id;
		editFacilityForm = {
			id: facility.id,
			name: facility.name ?? '',
			slug: facility.slug ?? '',
			description: facility.description ?? '',
			addressLine1: facility.addressLine1 ?? '',
			addressLine2: facility.addressLine2 ?? '',
			city: facility.city ?? '',
			state: facility.state ?? '',
			postalCode: facility.postalCode ?? '',
			country: facility.country ?? '',
			timezone: facility.timezone ?? '',
			capacity:
				typeof facility.capacity === 'number' && Number.isInteger(facility.capacity)
					? String(facility.capacity)
					: ''
		};
		editFacilitySlugTouched = false;
		editFacilityFormError = '';
		editFacilitySubmitting = false;
		editFacilityUnsavedConfirmOpen = false;
		editFacilityDirtyState.captureBaseline(editFacilityForm);
		isEditFacilityOpen = true;
	}

	function closeEditFacilityWizard(): void {
		isEditFacilityOpen = false;
		editFacilitySubmitting = false;
		editFacilityUnsavedConfirmOpen = false;
		editFacilitySlugTouched = false;
		editFacilityFormError = '';
		editFacilityForm = createEmptyEditFacilityForm();
		editFacilityDirtyState.clearBaseline();
	}

	function requestCloseEditFacilityWizard(): void {
		if (!isEditFacilityOpen || editFacilitySubmitting) return;
		if (!editFacilityDirtyState.isDirty(editFacilityForm)) {
			closeEditFacilityWizard();
			return;
		}
		editFacilityUnsavedConfirmOpen = true;
	}

	function confirmDiscardEditFacilityWizard(): void {
		editFacilityUnsavedConfirmOpen = false;
		closeEditFacilityWizard();
	}

	function cancelDiscardEditFacilityWizard(): void {
		editFacilityUnsavedConfirmOpen = false;
	}

	const editFacilityFieldErrors = $derived.by(() =>
		isEditFacilityOpen ? getFacilityFieldErrors(editFacilityForm, editFacilityForm.id) : {}
	);
	const canSubmitEditFacility = $derived.by(
		() => Object.keys(editFacilityFieldErrors).length === 0 && !editFacilitySubmitting
	);

	function submitEditFacilityWizard(): void {
		if (!isEditFacilityOpen || editFacilitySubmitting) return;
		clearEditFacilityErrors();
		if (Object.keys(editFacilityFieldErrors).length > 0) return;
		editFacilitySubmitting = true;
		(
			document.getElementById('edit-facility-action-form') as HTMLFormElement | null
		)?.requestSubmit();
	}

	function createEmptyAreaWizardForm(): FacilityAreaWizardForm {
		return {
			id: '',
			facilityId: '',
			name: '',
			slug: '',
			description: '',
			capacity: ''
		};
	}

	function firstActiveFacilityId(preferredFacilityId: string | null = null): string {
		const activeFacilities = facilitiesData.filter((facility) => facility.isActive !== 0);
		if (
			preferredFacilityId &&
			activeFacilities.some((facility) => facility.id === preferredFacilityId)
		) {
			return preferredFacilityId;
		}
		return activeFacilities[0]?.id ?? '';
	}

	function clearAreaWizardErrors(): void {
		areaWizardFormError = '';
	}

	function openCreateAreaWizard(preferredFacilityId: string | null = null): void {
		const facilityId = firstActiveFacilityId(preferredFacilityId ?? selectedFacilityId);
		if (!facilityId) return;
		selectedFacilityId = facilityId;
		areaWizardMode = 'create';
		areaWizardForm = {
			id: '',
			facilityId,
			name: '',
			slug: '',
			description: '',
			capacity: ''
		};
		areaWizardSlugTouched = false;
		areaWizardFormError = '';
		areaWizardSubmitting = false;
		areaWizardUnsavedConfirmOpen = false;
		areaWizardDirtyState.captureBaseline(areaWizardForm);
		isAreaWizardOpen = true;
	}

	function openEditAreaWizard(area: FacilityAreaDisplayRecord): void {
		const facilityId = area.facilityId ?? '';
		if (facilityId) selectedFacilityId = facilityId;
		areaWizardMode = 'edit';
		areaWizardForm = {
			id: area.id,
			facilityId,
			name: area.name ?? '',
			slug: area.slug ?? '',
			description: area.description ?? '',
			capacity:
				typeof area.capacity === 'number' && Number.isInteger(area.capacity)
					? String(area.capacity)
					: ''
		};
		areaWizardSlugTouched = false;
		areaWizardFormError = '';
		areaWizardSubmitting = false;
		areaWizardUnsavedConfirmOpen = false;
		areaWizardDirtyState.captureBaseline(areaWizardForm);
		isAreaWizardOpen = true;
	}

	function closeAreaWizard(): void {
		isAreaWizardOpen = false;
		areaWizardMode = 'create';
		areaWizardSubmitting = false;
		areaWizardUnsavedConfirmOpen = false;
		areaWizardSlugTouched = false;
		areaWizardFormError = '';
		areaWizardForm = createEmptyAreaWizardForm();
		areaWizardDirtyState.clearBaseline();
	}

	function requestCloseAreaWizard(): void {
		if (!isAreaWizardOpen || areaWizardSubmitting) return;
		if (!areaWizardDirtyState.isDirty(areaWizardForm)) {
			closeAreaWizard();
			return;
		}
		areaWizardUnsavedConfirmOpen = true;
	}

	function confirmDiscardAreaWizard(): void {
		areaWizardUnsavedConfirmOpen = false;
		closeAreaWizard();
	}

	function cancelDiscardAreaWizard(): void {
		areaWizardUnsavedConfirmOpen = false;
	}

	const areaWizardFieldErrors = $derived.by(() =>
		isAreaWizardOpen
			? getAreaFieldErrors(
					areaWizardForm,
					areaWizardForm.facilityId,
					areaWizardMode === 'edit' ? areaWizardForm.id : null
				)
			: {}
	);
	const canSubmitAreaWizard = $derived.by(
		() => Object.keys(areaWizardFieldErrors).length === 0 && !areaWizardSubmitting
	);
	const areaWizardSelectedFacilityName = $derived.by(
		() =>
			facilitiesData.find((facility) => facility.id === areaWizardForm.facilityId)?.name ??
			'Unknown facility'
	);

	function submitAreaWizard(): void {
		if (!isAreaWizardOpen || areaWizardSubmitting) return;
		clearAreaWizardErrors();
		if (Object.keys(areaWizardFieldErrors).length > 0) return;
		areaWizardSubmitting = true;
		const formId =
			areaWizardMode === 'create' ? 'create-area-action-form' : 'edit-area-action-form';
		(document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
	}

	function getFormDataString(key: string): string | null {
		const value = formData?.[key];
		return typeof value === 'string' && value.trim().length > 0 ? value : null;
	}

	function facilityFeedbackTitle(action: string): string {
		if (action === 'createFacilityArea') return 'Create area';
		if (action === 'updateFacilityArea') return 'Update area';
		if (action === 'updateFacility') return 'Update facility';
		return pageLabel;
	}

	async function submitAction(action: string, formDataObj: Record<string, string>): Promise<void> {
		const fd = new FormData();
		for (const [key, value] of Object.entries(formDataObj)) fd.append(key, value);
		try {
			const res = await fetch(`?/${action}`, { method: 'POST', body: fd });
			if (res.ok || res.redirected) window.location.reload();
		} catch (error) {
			console.error('Action failed:', error);
		}
	}

	function openConfirm(intent: ConfirmIntent): void {
		confirmIntent = intent;
		confirmSlugInput = '';
		confirmOpen = true;
	}

	function closeConfirm(): void {
		confirmOpen = false;
		confirmIntent = null;
		confirmSlugInput = '';
	}

	$effect(() => {
		facilitiesData = [...data.facilities];
		facilityAreasData = [...data.facilityAreas];
	});

	$effect(() => {
		const deepLinkedFacilityId = data.facilityId?.trim() ?? '';
		if (!deepLinkedFacilityId || handledDeepLinkedFacilityId === deepLinkedFacilityId) return;
		handledDeepLinkedFacilityId = deepLinkedFacilityId;
		selectedFacilityId = deepLinkedFacilityId;
		void tick().then(() => {
			document.getElementById(`facility-${deepLinkedFacilityId}`)?.scrollIntoView({
				block: 'center',
				behavior: 'smooth'
			});
		});
	});

	$effect(() => {
		const deepLinkedAreaId = data.areaId?.trim() ?? '';
		if (!deepLinkedAreaId || handledDeepLinkedAreaId === deepLinkedAreaId) return;
		handledDeepLinkedAreaId = deepLinkedAreaId;
		highlightedAreaId = deepLinkedAreaId;
		if (data.facilityId) selectedFacilityId = data.facilityId;
		void tick().then(() => {
			document.getElementById(`facility-area-${deepLinkedAreaId}`)?.scrollIntoView({
				block: 'center',
				behavior: 'smooth'
			});
		});
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

	const currentClientId = $derived(data.clientId || '');
	const canManageFacilities = $derived.by(() => Boolean(currentClientId));
	const totalFacilityCount = $derived.by(() => facilitiesData.length);
	const totalFacilityAreaCount = $derived.by(() => facilityAreasData.length);
	const activeFacilityCount = $derived.by(
		() => facilitiesData.filter((facility) => facility.isActive !== 0).length
	);
	const archivedFacilityCount = $derived.by(
		() => facilitiesData.filter((facility) => facility.isActive === 0).length
	);
	const activeFacilityAreaCount = $derived.by(
		() => facilityAreasData.filter((area) => area.isActive !== 0).length
	);
	const archivedFacilityAreaCount = $derived.by(
		() => facilityAreasData.filter((area) => area.isActive === 0).length
	);
	const todayFacilityUsage = $derived.by(() => data.todayFacilityUsage);
	const todayFacilityUsageGroups = $derived.by(() => data.todayFacilityUsage?.groups ?? []);
	const todayFacilityUsageDateLabel = $derived.by(() => {
		const parsed = new Date(data.generatedAt ?? Date.now());
		if (Number.isNaN(parsed.getTime())) return 'Today';
		return parsed.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	});
	const facilities = $derived.by(() =>
		getVisibleFacilities(facilitiesData, facilityAreasData, {
			viewArchiveMode,
			facilitySearch
		})
	);
	const visibleAreaCount = $derived.by(() =>
		facilities.reduce((total, facility) => total + getAreasForFacility(facility.id).length, 0)
	);
	const selectedFacility = $derived.by(
		() => facilities.find((facility) => facility.id === selectedFacilityId) ?? null
	);
	const activeFacilityOptions = $derived.by<DropdownOption[]>(() =>
		facilitiesData
			.filter((facility) => facility.isActive !== 0)
			.slice()
			.sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''))
			.map((facility) => ({ value: facility.id, label: facility.name ?? 'Untitled facility' }))
	);
	const addActionDropdownOptions = $derived.by<DropdownOption[]>(() => [
		{ value: 'add-facility', label: 'Add Facility' },
		{
			value: 'add-area',
			label: 'Add Area',
			disabled: activeFacilityOptions.length === 0,
			disabledTooltip:
				activeFacilityOptions.length === 0
					? 'Create an active facility before adding areas.'
					: undefined
		}
	]);
	const facilityAreaTableColumns = $derived.by<DataTableColumn<FacilityAreaDisplayRecord>[]>(() => {
		const columns: DataTableColumn<FacilityAreaDisplayRecord>[] = [
			{
				key: 'details',
				label: 'Details',
				width: canManageFacilities ? '34%' : '38%',
				rowHeader: true,
				cellVerticalAlignment: 'top'
			},
			{
				key: 'address',
				label: 'Address',
				width: canManageFacilities ? '30%' : '34%',
				cellVerticalAlignment: 'top'
			},
			{ key: 'capacity', label: 'Capacity', width: '10%' },
			{ key: 'status', label: 'Status', width: '12%' }
		];
		if (canManageFacilities) columns.push(createDataTableRowActionColumn());
		return columns;
	});

	$effect(() => {
		const nextSelectedFacilityId = resolveSelectedFacilityId({
			visibleFacilities: facilities,
			currentSelectedFacilityId: selectedFacilityId,
			preferredFacilityId: data.facilityId ?? null
		});
		if (selectedFacilityId === nextSelectedFacilityId) return;
		selectedFacilityId = nextSelectedFacilityId;
	});

	$effect(() => {
		const message = (form?.message ?? '').trim();
		const action = form?.action ?? '';
		if (!message || !action) {
			lastFacilityFeedbackToast = '';
			return;
		}
		const duplicateType = getFormDataString('duplicateType') ?? 'none';
		const archivedFacilityId = getFormDataString('archivedFacilityId');
		const archivedAreaId = getFormDataString('archivedAreaId');
		const signature = `${action}:${message}:${duplicateType}:${archivedFacilityId ?? 'none'}:${archivedAreaId ?? 'none'}`;
		if (signature === lastFacilityFeedbackToast) return;

		lastFacilityFeedbackToast = signature;
		const actions = [];
		if (duplicateType === 'archived' && archivedFacilityId) {
			actions.push(
				{
					label: 'Restore',
					style: 'solid' as const,
					onClick: () =>
						submitAction('setFacilityArchived', {
							facilityId: archivedFacilityId,
							isActive: '1'
						})
				},
				{
					label: 'Delete',
					style: 'outline' as const,
					onClick: () =>
						openConfirm({
							kind: 'facility-delete',
							facilityId: archivedFacilityId,
							slug:
								facilitiesData.find((facility) => facility.id === archivedFacilityId)?.slug || ''
						})
				}
			);
		}

		if (duplicateType === 'archived' && archivedAreaId) {
			actions.push(
				{
					label: 'Restore area',
					style: 'solid' as const,
					onClick: () =>
						submitAction('setFacilityAreaArchived', {
							facilityAreaId: archivedAreaId,
							isActive: '1'
						})
				},
				{
					label: 'Delete area',
					style: 'outline' as const,
					onClick: () =>
						openConfirm({
							kind: 'area-delete',
							facilityAreaId: archivedAreaId,
							slug: facilityAreasData.find((area) => area.id === archivedAreaId)?.slug || ''
						})
				}
			);
		}

		toast.error(message, {
			id: `facilities-feedback:${action}`,
			title: facilityFeedbackTitle(action),
			duration: actions.length > 0 ? 9000 : 7200,
			actions
		});
	});

	$effect(() => {
		const message = createFacilitySuccessMessage.trim();
		if (!message) {
			lastFacilitySuccessToast = '';
			return;
		}
		if (message === lastFacilitySuccessToast) return;
		lastFacilitySuccessToast = message;
		toast.success(message, { id: 'facility-create-success', title: pageLabel });
	});

	function getAreasForFacility(facilityId: string) {
		return getVisibleAreasForFacility(facilityAreasData, facilityId, {
			viewArchiveMode,
			facilitySearch,
			areaSearch: ''
		});
	}

	function getAreaCount(facilityId: string, mode: 'all' | 'active' | 'archived' = 'all'): number {
		return facilityAreasData.filter((area) => {
			if (area.facilityId !== facilityId) return false;
			if (mode === 'active') return area.isActive !== 0;
			if (mode === 'archived') return area.isActive === 0;
			return true;
		}).length;
	}

	function getFacilityAddressSummary(facility: FacilityDisplayRecord): string {
		return [
			facility.addressLine1,
			facility.addressLine2,
			facility.city,
			facility.state,
			facility.postalCode,
			facility.country
		]
			.filter(Boolean)
			.join(', ');
	}

	function getGoogleMapsUrl(facility: FacilityDisplayRecord): string | null {
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

	function facilityUsageStatusClass(status: string): string {
		if (status === 'in_progress') return 'badge-primary text-xs uppercase tracking-wide';
		if (status === 'completed') return 'badge-secondary text-xs uppercase tracking-wide';
		if (status === 'scheduled') return 'badge-neutral-outlined text-xs uppercase tracking-wide';
		return 'badge-secondary-outlined text-xs uppercase tracking-wide';
	}

	function facilityArticleClass(facilityId: string): string {
		return selectedFacilityId === facilityId ? 'bg-primary-50/35' : '';
	}

	function handleAddActionDropdown(value: string): void {
		if (value === 'add-area') {
			openCreateAreaWizard(selectedFacilityId);
			return;
		}
		openCreateFacility();
	}

	function facilityActionOptions(facility: FacilityDisplayRecord): DropdownOption[] {
		if (facility.isActive === 0) {
			return [
				{ value: 'restore-facility', label: 'Restore Facility' },
				{ value: 'delete-facility', label: 'Delete Facility', separatorBefore: true }
			];
		}
		return [
			{ value: 'edit-facility', label: 'Edit Facility' },
			{ value: 'add-area', label: 'Add Area' },
			{ value: 'archive-facility', label: 'Archive Facility', separatorBefore: true }
		];
	}

	function handleFacilityAction(action: string, facility: FacilityDisplayRecord): void {
		selectedFacilityId = facility.id;
		if (action === 'edit-facility') return openEditFacilityWizard(facility);
		if (action === 'add-area') return openCreateAreaWizard(facility.id);
		if (action === 'archive-facility')
			return openConfirm({ kind: 'facility-archive', facilityId: facility.id });
		if (action === 'restore-facility')
			return openConfirm({ kind: 'facility-restore', facilityId: facility.id });
		if (action === 'delete-facility') {
			openConfirm({ kind: 'facility-delete', facilityId: facility.id, slug: facility.slug ?? '' });
		}
	}

	function areaRowActionOptions(area: FacilityAreaDisplayRecord): DataTableRowActionOption[] {
		if (area.isActive === 0) {
			return [
				{ value: 'restore-area', label: 'Restore Area' },
				{ value: 'delete-area', label: 'Delete Area', separatorBefore: true }
			];
		}
		return [
			{ value: 'edit-area', label: 'Edit Area' },
			{ value: 'archive-area', label: 'Archive Area', separatorBefore: true }
		];
	}

	function handleAreaRowAction(action: string, area: FacilityAreaDisplayRecord): void {
		if (area.facilityId) selectedFacilityId = area.facilityId;
		if (action === 'edit-area') return openEditAreaWizard(area);
		if (action === 'archive-area')
			return openConfirm({ kind: 'area-archive', facilityAreaId: area.id });
		if (action === 'restore-area')
			return openConfirm({ kind: 'area-restore', facilityAreaId: area.id });
		if (action === 'delete-area') {
			openConfirm({ kind: 'area-delete', facilityAreaId: area.id, slug: area.slug ?? '' });
		}
	}

	const editFacilityEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			editFacilitySubmitting = false;
			if (result.type === 'success') {
				editFacilityFormError = '';
				await update({ reset: false });
				await invalidateAll();
				closeEditFacilityWizard();
				return;
			}
			if (result.type === 'failure') {
				editFacilityFormError =
					((result.data as { message?: string })?.message ?? '').trim() ||
					'Unable to save facility right now.';
				await update({ reset: false });
				return;
			}
			if (result.type === 'redirect') return update();
			editFacilityFormError = 'Unable to save facility right now.';
		};
	};

	const createAreaEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			areaWizardSubmitting = false;
			if (result.type === 'success' || result.type === 'redirect') {
				areaWizardFormError = '';
				await update({ reset: false });
				closeAreaWizard();
				return;
			}
			if (result.type === 'failure') {
				areaWizardFormError =
					((result.data as { message?: string })?.message ?? '').trim() ||
					'Unable to save area right now.';
				await update({ reset: false });
				return;
			}
			areaWizardFormError = 'Unable to save area right now.';
		};
	};

	const editAreaEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			areaWizardSubmitting = false;
			if (result.type === 'success') {
				areaWizardFormError = '';
				await update({ reset: false });
				await invalidateAll();
				closeAreaWizard();
				return;
			}
			if (result.type === 'failure') {
				areaWizardFormError =
					((result.data as { message?: string })?.message ?? '').trim() ||
					'Unable to save area right now.';
				await update({ reset: false });
				return;
			}
			if (result.type === 'redirect') return update();
			areaWizardFormError = 'Unable to save area right now.';
		};
	};
</script>

<PageTitle pageTitle={pageLabel} />

<svelte:head>
	<meta
		name="description"
		content="Manage sports facilities and venue areas. Create, edit, and organize your league's locations."
	/>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="dashboard-page-shell">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 py-2 lg:flex-row lg:items-center lg:justify-between">
				<div class="flex items-center gap-3">
					<div
						class="bg-primary text-white border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
						aria-hidden="true"
					>
						<IconBuilding class="w-7 h-7 lg:w-8 lg:h-8" />
					</div>
					<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
						{pageLabel}
					</h1>
				</div>
				<DashboardSearchLauncher />
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6">
		<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
			<div class="min-w-0 space-y-4">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="p-4 border-b border-neutral-950 bg-neutral-600/66 space-y-3">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">{workspaceLabel()}</h2>
								<ListboxDropdown
									options={WORKSPACE_OPTIONS}
									value={viewArchiveMode ? 'archive' : 'active'}
									ariaLabel="Facility workspace"
									buttonClass={COMPACT_DROPDOWN_BUTTON_CLASS}
									on:change={(event) => {
										viewArchiveMode = event.detail.value === 'archive';
									}}
								/>
							</div>

							<div class="flex items-center gap-2 text-xs text-neutral-950 font-sans">
								<span class={HEADER_COUNT_BADGE_CLASS}>
									{facilities.length}
									{facilities.length === 1 ? ' facility' : ' facilities'}
								</span>
								<span class={HEADER_COUNT_BADGE_CLASS}>
									{visibleAreaCount}
									{visibleAreaCount === 1 ? ' area' : ' areas'}
								</span>
								{#if canManageFacilities}
									<SplitAddAction
										label="+ ADD"
										options={addActionDropdownOptions}
										buttonClass={HEADER_SPLIT_ADD_BUTTON_CLASS}
										menuButtonClass={HEADER_SPLIT_ADD_MENU_BUTTON_CLASS}
										on:click={openCreateFacility}
										on:action={(event) => {
											handleAddActionDropdown(event.detail.value);
										}}
									/>
								{/if}
							</div>
						</div>

						<SearchInput
							id="facility-board-search"
							label="Search facilities and areas"
							value={facilitySearch}
							placeholder="Search facility, area, or location"
							autocomplete="off"
							wrapperClass="relative"
							iconClass="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950"
							inputClass="input-neutral pl-10 pr-10 py-1 text-sm disabled:cursor-not-allowed"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer"
							clearIconClass="w-4 h-4"
							clearAriaLabel="Clear facilities search"
							on:input={(event) => {
								facilitySearch = event.detail.value;
							}}
						/>
					</div>

					{#if facilities.length === 0}
						<div class="p-4 space-y-4 min-h-[34rem]">
							<div class="border border-warning-300 bg-warning-50 p-3">
								<p class="text-sm text-neutral-950 font-sans">
									{#if facilitySearch.trim().length > 0}
										No facilities or areas match "{facilitySearch.trim()}" in this workspace.
									{:else if viewArchiveMode}
										No archived facilities are available yet.
									{:else}
										No facilities exist yet.
									{/if}
								</p>
							</div>

							{#if !viewArchiveMode && canManageFacilities}
								<button
									type="button"
									class="button-primary inline-flex items-center gap-2 cursor-pointer"
									onclick={openCreateFacility}
								>
									<IconPlus class="h-4 w-4" />
									<span>Create your first facility</span>
								</button>
							{/if}
						</div>
					{:else}
						<div class="divide-y divide-neutral-950">
							{#each facilities as facility (facility.id)}
								{@const visibleAreas = getAreasForFacility(facility.id)}
								{@const activeAreas = getAreaCount(facility.id, 'active')}
								{@const archivedAreas = getAreaCount(facility.id, 'archived')}
								{@const mapsUrl = getGoogleMapsUrl(facility)}
								<article
									id={`facility-${facility.id}`}
									class={`p-4 space-y-3 ${facilityArticleClass(facility.id)}`}
								>
									<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
										<div class="space-y-2">
											<div class="flex items-center gap-2">
												<h3 class="text-2xl font-bold font-serif text-neutral-950">
													{facility.name || '(Unnamed facility)'}
												</h3>
												{#if facility.isActive === 0}
													<span class="badge-secondary text-xs uppercase tracking-wide"
														>Archived</span
													>
												{:else}
													<span
														class="badge-neutral-outlined text-[10px] uppercase tracking-wide px-1.5 py-0 self-center"
													>
														Facility
													</span>
												{/if}
											</div>

											<div class="flex flex-wrap items-center gap-3 text-sm text-neutral-950">
												{#if mapsUrl}
													<a
														href={mapsUrl}
														target="_blank"
														rel="noopener noreferrer"
														class="inline-flex items-center gap-1 hover:underline"
													>
														<IconMapPin class="h-3 w-3" />
														<span>{getFacilityAddressSummary(facility)}</span>
														<IconExternalLink class="h-3 w-3" />
													</a>
												{:else if getFacilityAddressSummary(facility)}
													<span class="inline-flex items-center gap-1">
														<IconMapPin class="h-3 w-3" />
														<span>{getFacilityAddressSummary(facility)}</span>
													</span>
												{/if}
												{#if typeof facility.capacity === 'number' && facility.capacity > 0}
													<span class="inline-flex items-center gap-1">
														<IconSquare class="h-3 w-3" />
														<span>Capacity {facility.capacity}</span>
													</span>
												{/if}
											</div>

											{#if facility.description}
												<p class="text-sm leading-6 text-neutral-950">{facility.description}</p>
											{/if}
										</div>

										<div class="flex flex-wrap items-center gap-1">
											<span class="badge-primary text-xs uppercase tracking-wide"
												>{activeAreas} Active</span
											>
											<span class="badge-secondary-outlined text-xs uppercase tracking-wide"
												>{archivedAreas} Archived</span
											>
											{#if canManageFacilities}
												<ListboxDropdown
													options={facilityActionOptions(facility)}
													value=""
													mode="action"
													align="right"
													ariaLabel={`${facility.name || 'Facility'} actions`}
													buttonClass="inline-flex h-7 w-7 items-center justify-center p-0 cursor-pointer text-neutral-950 hover:text-secondary-900"
													listClass="w-44"
													on:action={(event) => {
														handleFacilityAction(event.detail.value, facility);
													}}
												>
													{#snippet trigger()}<IconDots class="h-4 w-4" />{/snippet}
												</ListboxDropdown>
											{/if}
										</div>
									</div>

									<div class="offering-table-highlight-surface">
										<DataTable
											columns={facilityAreaTableColumns}
											rows={visibleAreas}
											caption={`${facility.name || 'Facility'} area table`}
											rowId={(area) => `facility-area-${area.id}`}
											rowClass={(area) =>
												[
													highlightedAreaId === area.id ? 'league-row-highlight' : '',
													canManageFacilities ? 'group/row' : ''
												]
													.filter(Boolean)
													.join(' ')}
										>
											{#snippet emptyBody()}
												<tr class="bg-neutral-25">
													<td
														colspan={facilityAreaTableColumns.length}
														class="px-4 py-10 text-center text-sm italic text-neutral-700"
													>
														{#if canManageFacilities && facility.isActive !== 0 && !viewArchiveMode}
															No areas exist for this facility yet.
															<button
																type="button"
																class="ml-1 inline font-semibold not-italic text-secondary-900 underline underline-offset-2 cursor-pointer"
																onclick={() => {
																	openCreateAreaWizard(facility.id);
																}}
															>
																Add Area
															</button>
														{:else}
															No areas match this workspace right now.
														{/if}
													</td>
												</tr>
											{/snippet}

											{#snippet cell(area, column)}
												{#if column.key === 'details'}
													<div class="space-y-1">
														<p class="font-semibold text-neutral-950">
															{area.name || '(Unnamed area)'}
														</p>
														{#if area.description}
															<p class="text-xs leading-snug text-neutral-950 font-sans">
																{area.description}
															</p>
														{:else}
															<p class="text-xs leading-snug text-neutral-700 italic font-sans">
																No notes added yet.
															</p>
														{/if}
													</div>
												{:else if column.key === 'address'}
													{@const facilityAddress = getFacilityAddressSummary(facility)}
													{#if mapsUrl && facilityAddress}
														<a
															href={mapsUrl}
															target="_blank"
															rel="noopener noreferrer"
															class="inline-flex items-start gap-1 text-xs leading-snug text-neutral-950 hover:underline"
														>
															<IconMapPin class="mt-0.5 h-3 w-3 shrink-0" />
															<span>{facilityAddress}</span>
															<IconExternalLink class="mt-0.5 h-3 w-3 shrink-0" />
														</a>
													{:else if facilityAddress}
														<p class="text-xs leading-snug text-neutral-950 font-sans">
															{facilityAddress}
														</p>
													{:else}
														<p class="text-xs leading-snug text-neutral-700 italic font-sans">
															No address added yet.
														</p>
													{/if}
												{:else if column.key === 'capacity'}
													<p class="text-xs leading-snug text-neutral-950 font-sans">
														{typeof area.capacity === 'number' && area.capacity > 0
															? area.capacity
															: '-'}
													</p>
												{:else if column.key === 'status'}
													{#if area.isActive === 0}
														<span class="badge-secondary text-xs uppercase tracking-wide"
															>Archived</span
														>
													{:else}
														<span class="badge-primary-outlined text-xs uppercase tracking-wide"
															>Active</span
														>
													{/if}
												{:else if column.key === 'manage'}
													{#if canManageFacilities}
														<DataTableRowActions
															options={areaRowActionOptions(area)}
															ariaLabel={`Actions for ${area.name || 'area'}`}
															on:action={(event) => {
																handleAreaRowAction(event.detail.value, area);
															}}
														/>
													{/if}
												{/if}
											{/snippet}
										</DataTable>
									</div>
								</article>
							{/each}
						</div>
					{/if}
				</section>
			</div>

			<aside class="w-full min-w-0 space-y-3 2xl:sticky 2xl:top-4">
				<section class="border-2 border-neutral-950 bg-neutral">
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
						<h2 class="dashboard-section-title text-neutral-950">Facility Summary</h2>
					</div>

					<div class="grid grid-cols-2 gap-3 p-4">
						<div class="border border-neutral-950 bg-white p-3">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
								Facilities
							</p>
							<p class="mt-1 text-3xl font-bold font-serif leading-none text-neutral-950">
								{totalFacilityCount}
							</p>
							<p class="mt-2 text-xs text-neutral-950 font-sans">
								{activeFacilityCount} active
								{#if archivedFacilityCount > 0}
									<span class="text-neutral-700"> | {archivedFacilityCount} archived</span>
								{/if}
							</p>
						</div>

						<div class="border border-neutral-950 bg-white p-3">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Areas</p>
							<p class="mt-1 text-3xl font-bold font-serif leading-none text-neutral-950">
								{totalFacilityAreaCount}
							</p>
							<p class="mt-2 text-xs text-neutral-950 font-sans">
								{activeFacilityAreaCount} active
								{#if archivedFacilityAreaCount > 0}
									<span class="text-neutral-700"> | {archivedFacilityAreaCount} archived</span>
								{/if}
							</p>
						</div>

						<div class="border border-neutral-950 bg-white p-3">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
								In Use Today
							</p>
							<p class="mt-1 text-3xl font-bold font-serif leading-none text-neutral-950">
								{todayFacilityUsage.facilitiesInUseCount}
							</p>
							<p class="mt-2 text-xs text-neutral-950 font-sans">
								{todayFacilityUsage.eventsTodayCount}
								{todayFacilityUsage.eventsTodayCount === 1 ? ' event' : ' events'}
							</p>
						</div>

						<div class="border border-neutral-950 bg-white p-3">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
								Areas Booked
							</p>
							<p class="mt-1 text-3xl font-bold font-serif leading-none text-neutral-950">
								{todayFacilityUsage.areasInUseCount}
							</p>
							<p class="mt-2 text-xs text-neutral-950 font-sans">
								Across {todayFacilityUsage.facilitiesInUseCount}
								{todayFacilityUsage.facilitiesInUseCount === 1 ? ' facility' : ' facilities'}
							</p>
						</div>
					</div>
				</section>

				<section class="border-2 border-neutral-950 bg-neutral">
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4 space-y-1">
						<h2 class="dashboard-section-title text-neutral-950">Today At Facilities</h2>
						<p class="text-sm text-neutral-950 font-sans">{todayFacilityUsageDateLabel}</p>
					</div>

					<div class="space-y-3 p-4">
						{#if todayFacilityUsageGroups.length === 0}
							<div class="border border-neutral-950 bg-white p-4 space-y-2">
								<p class="text-sm font-semibold text-neutral-950">
									No facilities are scheduled for use today.
								</p>
								<p class="text-sm text-neutral-950 font-sans">
									New events assigned to a facility or area will show up here automatically.
								</p>
							</div>
						{:else}
							<div class="border border-neutral-950 bg-white p-3">
								<p class="text-sm text-neutral-950 font-sans">
									{todayFacilityUsage.eventsTodayCount}
									{todayFacilityUsage.eventsTodayCount === 1 ? ' event is' : ' events are'} on the calendar
									across {todayFacilityUsage.facilitiesInUseCount}
									{todayFacilityUsage.facilitiesInUseCount === 1 ? ' facility' : ' facilities'}.
								</p>
							</div>

							<div class="max-h-[36rem] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
								{#each todayFacilityUsageGroups as group (group.facilityId)}
									<article class="border border-neutral-950 bg-white p-3 space-y-3">
										<div class="flex flex-wrap items-start justify-between gap-3">
											<div class="space-y-1">
												<h3 class="text-lg font-bold font-serif leading-none text-neutral-950">
													{group.facilityName}
												</h3>
												<p class="text-xs uppercase tracking-wide text-neutral-700">
													{group.eventCount}
													{group.eventCount === 1 ? ' event' : ' events'} today
												</p>
											</div>
											<span class="badge-primary-outlined text-xs uppercase tracking-wide">
												{group.areasInUseCount}
												{group.areasInUseCount === 1 ? ' area' : ' areas'}
											</span>
										</div>

										<div class="space-y-2">
											{#each group.entries as entry (entry.eventId)}
												<div class="border border-neutral-950 bg-neutral-25 p-2.5 space-y-1.5">
													<div class="flex flex-wrap items-center gap-2">
														<span class="text-xs font-semibold tabular-nums text-neutral-950">
															{entry.startTimeLabel}
														</span>
														<span class="badge-neutral-outlined text-xs uppercase tracking-wide">
															{entry.facilityAreaName}
														</span>
														<span class={facilityUsageStatusClass(entry.status)}>
															{entry.statusLabel}
														</span>
													</div>
													<p class="text-sm font-semibold leading-snug text-neutral-950">
														{entry.reasonLabel}
													</p>
													{#if entry.contextLabel}
														<p class="text-xs leading-snug text-neutral-950 font-sans">
															{entry.contextLabel}
														</p>
													{/if}
												</div>
											{/each}
										</div>
									</article>
								{/each}
							</div>
						{/if}
					</div>
				</section>
			</aside>
		</div>
	</div>
</div>

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

{#if isEditFacilityOpen}
	<form
		id="edit-facility-action-form"
		method="POST"
		action="?/updateFacility"
		use:enhance={editFacilityEnhance}
		class="hidden"
	>
		<input type="hidden" name="facilityId" value={editFacilityForm.id} />
		<input type="hidden" name="name" value={editFacilityForm.name.trim()} />
		<input type="hidden" name="slug" value={slugifyFinal(editFacilityForm.slug)} />
		<input type="hidden" name="description" value={editFacilityForm.description.trim()} />
		<input type="hidden" name="addressLine1" value={editFacilityForm.addressLine1.trim()} />
		<input type="hidden" name="addressLine2" value={editFacilityForm.addressLine2.trim()} />
		<input type="hidden" name="city" value={editFacilityForm.city.trim()} />
		<input type="hidden" name="state" value={editFacilityForm.state.trim()} />
		<input type="hidden" name="postalCode" value={editFacilityForm.postalCode.trim()} />
		<input type="hidden" name="country" value={editFacilityForm.country.trim()} />
		<input type="hidden" name="timezone" value={editFacilityForm.timezone.trim()} />
		<input type="hidden" name="capacity" value={editFacilityForm.capacity.trim()} />
	</form>
{/if}

{#if isAreaWizardOpen && areaWizardMode === 'create'}
	<form
		id="create-area-action-form"
		method="POST"
		action="?/createFacilityArea"
		use:enhance={createAreaEnhance}
		class="hidden"
	>
		<input type="hidden" name="facilityId" value={areaWizardForm.facilityId} />
		<input type="hidden" name="name" value={areaWizardForm.name.trim()} />
		<input type="hidden" name="slug" value={slugifyFinal(areaWizardForm.slug)} />
		<input type="hidden" name="description" value={areaWizardForm.description.trim()} />
		<input type="hidden" name="capacity" value={areaWizardForm.capacity.trim()} />
	</form>
{/if}

{#if isAreaWizardOpen && areaWizardMode === 'edit'}
	<form
		id="edit-area-action-form"
		method="POST"
		action="?/updateFacilityArea"
		use:enhance={editAreaEnhance}
		class="hidden"
	>
		<input type="hidden" name="facilityAreaId" value={areaWizardForm.id} />
		<input type="hidden" name="name" value={areaWizardForm.name.trim()} />
		<input type="hidden" name="slug" value={slugifyFinal(areaWizardForm.slug)} />
		<input type="hidden" name="description" value={areaWizardForm.description.trim()} />
		<input type="hidden" name="capacity" value={areaWizardForm.capacity.trim()} />
	</form>
{/if}

<CreateFacilityWizard
	open={isCreateFacilityOpen}
	step={createFacilityStep}
	formError={createFacilityFormError}
	fieldErrors={createFacilityFieldErrors}
	conflictMeta={createFacilityConflictMeta}
	form={createFacilityForm}
	{facilitySlugTouched}
	{wizardAreaSlugTouched}
	{areaDraftActive}
	{areaEditingIndex}
	stepProgress={createFacilityStepProgress}
	canGoNext={canGoNextCreateFacilityStep}
	canSubmit={canSubmitCreateFacility}
	submitting={createFacilitySubmitting}
	unsavedConfirmOpen={createFacilityUnsavedConfirmOpen}
	stepTitle={createStepTitle}
	onFacilitySlugTouchedChange={(value) => {
		facilitySlugTouched = value;
	}}
	onWizardAreaSlugTouchedChange={(value) => {
		wizardAreaSlugTouched = value;
	}}
	onRequestClose={requestCloseCreateFacilityWizard}
	onSubmit={submitCreateFacilityWizard}
	onInput={clearCreateFacilityApiErrors}
	onNext={nextCreateFacilityStep}
	onBack={handleCreateFacilityBackAction}
	onUnsavedConfirm={confirmDiscardCreateFacilityWizard}
	onUnsavedCancel={cancelDiscardCreateFacilityWizard}
	onStartAreaDraft={startAreaDraft}
	onStartEditArea={startEditingWizardArea}
	onDuplicateArea={duplicateWizardArea}
	onRemoveArea={removeWizardArea}
	onMoveArea={moveWizardArea}
	onStartEditFacility={startEditingFacilityDraft}
	onStartEditAreas={startEditingAreasDraft}
	onSubmitAction={submitAction}
	onOpenArchivedFacilityDelete={(facilityId) => {
		openConfirm({
			kind: 'facility-delete',
			facilityId,
			slug: facilitiesData.find((facility) => facility.id === facilityId)?.slug || ''
		});
	}}
	onOpenArchivedAreaDelete={(facilityAreaId) => {
		openConfirm({
			kind: 'area-delete',
			facilityAreaId,
			slug: facilityAreasData.find((area) => area.id === facilityAreaId)?.slug || ''
		});
	}}
/>

<EditFacilityWizard
	open={isEditFacilityOpen}
	form={editFacilityForm}
	formError={editFacilityFormError}
	fieldErrors={editFacilityFieldErrors}
	canSubmit={canSubmitEditFacility}
	submitting={editFacilitySubmitting}
	slugTouched={editFacilitySlugTouched}
	unsavedConfirmOpen={editFacilityUnsavedConfirmOpen}
	onSlugTouchedChange={(value) => {
		editFacilitySlugTouched = value;
	}}
	onRequestClose={requestCloseEditFacilityWizard}
	onSubmit={submitEditFacilityWizard}
	onInput={clearEditFacilityErrors}
	onUnsavedConfirm={confirmDiscardEditFacilityWizard}
	onUnsavedCancel={cancelDiscardEditFacilityWizard}
/>

<FacilityAreaWizard
	open={isAreaWizardOpen}
	mode={areaWizardMode}
	form={areaWizardForm}
	formError={areaWizardFormError}
	fieldErrors={areaWizardFieldErrors}
	canSubmit={canSubmitAreaWizard}
	submitting={areaWizardSubmitting}
	slugTouched={areaWizardSlugTouched}
	unsavedConfirmOpen={areaWizardUnsavedConfirmOpen}
	facilityOptions={activeFacilityOptions}
	selectedFacilityName={areaWizardSelectedFacilityName}
	onSlugTouchedChange={(value: boolean) => {
		areaWizardSlugTouched = value;
	}}
	onRequestClose={requestCloseAreaWizard}
	onSubmit={submitAreaWizard}
	onInput={clearAreaWizardErrors}
	onUnsavedConfirm={confirmDiscardAreaWizard}
	onUnsavedCancel={cancelDiscardAreaWizard}
/>

{#if confirmOpen && confirmIntent}
	<ModalShell
		open={confirmOpen && Boolean(confirmIntent)}
		closeAriaLabel="Close confirmation modal"
		backdropClass="bg-black/50"
		alignmentClass="items-start"
		paddingClass="p-6"
		on:requestClose={closeConfirm}
	>
		{#if confirmIntent.kind === 'facility-delete' || confirmIntent.kind === 'area-delete'}
			<div class="border-b border-neutral-950 bg-neutral-600/66 p-5">
				<h3 class="text-2xl font-bold font-serif text-neutral-950">Delete permanently?</h3>
			</div>
			<div class="p-5 space-y-4">
				{#if confirmIntent.kind === 'facility-delete'}
					<p class="font-sans text-neutral-950">
						This will <span class="font-bold text-error-700">permanently delete</span> the facility.
						This action <span class="font-bold text-error-700">cannot</span> be undone.
					</p>
					<p class="font-sans text-neutral-950">
						Type the facility slug to confirm: <span class="font-mono font-bold"
							>{confirmIntent.slug || confirmIntent.name}</span
						>
					</p>
				{:else}
					<p class="font-sans text-neutral-950">
						This will <span class="font-bold text-error-700">permanently delete</span> the area.
						This action <span class="font-bold text-error-700">cannot</span> be undone.
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
					placeholder="Type slug to confirm..."
					bind:value={confirmSlugInput}
					autocomplete="off"
				/>

				<div class="flex items-center justify-end gap-3 pt-2">
					<button type="button" class="button-secondary cursor-pointer" onclick={closeConfirm}
						>Cancel</button
					>
					<button
						type="button"
						class="button-secondary-outlined border-error-700 text-error-700 hover:bg-error-50 flex items-center gap-2 min-w-[10rem] justify-center cursor-pointer"
						disabled={slugifyFinal(confirmSlugInput) !== slugifyFinal(confirmIntent.slug)}
						onclick={async () => {
							if (!confirmIntent) return;
							if (confirmIntent.kind === 'facility-delete') {
								await submitAction('deleteFacility', {
									facilityId: confirmIntent.facilityId,
									confirmSlug: confirmSlugInput
								});
								return;
							}
							if (confirmIntent.kind === 'area-delete') {
								await submitAction('deleteFacilityArea', {
									facilityAreaId: confirmIntent.facilityAreaId,
									confirmSlug: confirmSlugInput
								});
							}
						}}
					>
						<IconTrash class="w-5 h-5" />
						<span>Delete</span>
					</button>
				</div>
			</div>
		{:else}
			<div class="border-b border-neutral-950 bg-neutral-600/66 p-5">
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
					<button
						type="button"
						class="button-secondary-outlined cursor-pointer"
						onclick={closeConfirm}>Cancel</button
					>
					<button
						type="button"
						class="button-primary flex items-center gap-2 min-w-[10rem] justify-center cursor-pointer"
						onclick={async () => {
							if (!confirmIntent) return;
							if (
								confirmIntent.kind === 'facility-archive' ||
								confirmIntent.kind === 'facility-restore'
							) {
								await submitAction('setFacilityArchived', {
									facilityId: confirmIntent.facilityId,
									isActive: confirmIntent.kind === 'facility-restore' ? '1' : '0'
								});
								return;
							}
							if (confirmIntent.kind === 'area-archive' || confirmIntent.kind === 'area-restore') {
								await submitAction('setFacilityAreaArchived', {
									facilityAreaId: confirmIntent.facilityAreaId,
									isActive: confirmIntent.kind === 'area-restore' ? '1' : '0'
								});
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
	</ModalShell>
{/if}
