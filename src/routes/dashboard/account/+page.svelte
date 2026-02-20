<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconAt from '@tabler/icons-svelte/icons/at';
	import IconBolt from '@tabler/icons-svelte/icons/bolt';
	import IconCalendar from '@tabler/icons-svelte/icons/calendar';
	import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down';
	import IconChevronUp from '@tabler/icons-svelte/icons/chevron-up';
	import IconCheck from '@tabler/icons-svelte/icons/check';
	import IconClock from '@tabler/icons-svelte/icons/clock';
	import IconCopy from '@tabler/icons-svelte/icons/copy';
	import IconDeviceLaptop from '@tabler/icons-svelte/icons/device-laptop';
	import IconEye from '@tabler/icons-svelte/icons/eye';
	import IconEyeOff from '@tabler/icons-svelte/icons/eye-off';
	import IconId from '@tabler/icons-svelte/icons/id';
	import IconKey from '@tabler/icons-svelte/icons/key';
	import IconLock from '@tabler/icons-svelte/icons/lock';
	import IconLogout from '@tabler/icons-svelte/icons/logout';
	import IconPlus from '@tabler/icons-svelte/icons/plus';
	import IconShieldCheck from '@tabler/icons-svelte/icons/shield-check';
	import IconSparkles from '@tabler/icons-svelte/icons/sparkles';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import IconUser from '@tabler/icons-svelte/icons/user';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { onMount } from 'svelte';
	import CreateOrganizationWizard from './_wizards/CreateOrganizationWizard.svelte';
	import { WizardStepFooter, applyLiveSlugInput, slugifyFinal } from '$lib/components/wizard';

	type ActiveSessionData = {
		id: string;
		userAgent: string | null;
		ipAddress: string | null;
		locationCity: string | null;
		locationStation: string | null;
		lastSeenAt: string;
		createdAt: string;
		expiresAt: string;
		isCurrent: boolean;
	};

	type OrganizationMembership = {
		clientId: string;
		clientName: string;
		clientSlug: string | null;
		role: string;
		isDefault: boolean;
		isCurrent: boolean;
	};

	type CreateOrganizationStep = 1 | 2 | 3 | 4;

	type CreateOrganizationForm = {
		organizationName: string;
		organizationSlug: string;
		selfJoinEnabled: boolean;
		membershipRole: 'admin' | 'manager';
		switchToOrganization: boolean;
		setDefaultOrganization: boolean;
		metadata: string;
	};

	type AccountData = {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
		cellPhone: string;
		role: string;
		status: string;
		createdAt: string | null;
		updatedAt: string | null;
		emailVerifiedAt: string | null;
		firstLoginAt: string | null;
		lastLoginAt: string | null;
		lastActiveAt: string | null;
		sessionCount: number;
		currentSessionExpiresAt: string | null;
		activeSessionCount: number;
		activeSessions: ActiveSessionData[];
		profileCompletionPercent: number;
		accountAgeDays: number | null;
	};

	type FormState = {
		action?: string;
		error?: string;
		success?: string;
		fieldErrors?: Record<string, string>;
	};

	let { data, form } = $props<{
		data: {
			error?: string;
			account: AccountData | null;
			organizations: OrganizationMembership[];
		};
		form?: FormState;
	}>();

	const countryCodeOptions = [
		'+1',
		'+7',
		'+20',
		'+27',
		'+30',
		'+31',
		'+32',
		'+33',
		'+34',
		'+39',
		'+40',
		'+41',
		'+43',
		'+44',
		'+45',
		'+46',
		'+47',
		'+48',
		'+49',
		'+52',
		'+54',
		'+55',
		'+56',
		'+57',
		'+58',
		'+60',
		'+61',
		'+62',
		'+63',
		'+64',
		'+65',
		'+66',
		'+81',
		'+82',
		'+84',
		'+86',
		'+90',
		'+91',
		'+92',
		'+93',
		'+94',
		'+95',
		'+98',
		'+212',
		'+213',
		'+216',
		'+218',
		'+220',
		'+221',
		'+222',
		'+223',
		'+224',
		'+225',
		'+226',
		'+227',
		'+228',
		'+229',
		'+230',
		'+231',
		'+232',
		'+233',
		'+234',
		'+235',
		'+236',
		'+237',
		'+238',
		'+239',
		'+240',
		'+241',
		'+242',
		'+243',
		'+244',
		'+248',
		'+249',
		'+250',
		'+251',
		'+252',
		'+253',
		'+254',
		'+255',
		'+256',
		'+257',
		'+258',
		'+260',
		'+261',
		'+262',
		'+263',
		'+264',
		'+265',
		'+266',
		'+267',
		'+268',
		'+269',
		'+350',
		'+351',
		'+352',
		'+353',
		'+354',
		'+355',
		'+356',
		'+357',
		'+358',
		'+359',
		'+370',
		'+371',
		'+372',
		'+373',
		'+374',
		'+375',
		'+376',
		'+377',
		'+380',
		'+381',
		'+382',
		'+385',
		'+386',
		'+387',
		'+389',
		'+420',
		'+421',
		'+423',
		'+500',
		'+501',
		'+502',
		'+503',
		'+504',
		'+505',
		'+506',
		'+507',
		'+508',
		'+509',
		'+590',
		'+591',
		'+592',
		'+593',
		'+594',
		'+595',
		'+596',
		'+597',
		'+598',
		'+599',
		'+670',
		'+672',
		'+673',
		'+674',
		'+675',
		'+676',
		'+677',
		'+678',
		'+679',
		'+680',
		'+681',
		'+682',
		'+683',
		'+685',
		'+686',
		'+687',
		'+688',
		'+689',
		'+690',
		'+691',
		'+692',
		'+850',
		'+852',
		'+853',
		'+855',
		'+856',
		'+880',
		'+886',
		'+960',
		'+961',
		'+962',
		'+963',
		'+964',
		'+965',
		'+966',
		'+967',
		'+968',
		'+970',
		'+971',
		'+972',
		'+973',
		'+974',
		'+975',
		'+976',
		'+977',
		'+992',
		'+993',
		'+994',
		'+995',
		'+996',
		'+998'
	] as const;

	const cellPhoneMaskRegex = /^\(\d{3}\)\s\d{3}-\d{4}$/;

	let account = $derived(data.account);
	let organizations = $derived(data.organizations ?? []);
	let actionName = $derived(form?.action ?? '');
	let actionError = $derived(form?.error ?? '');
	let actionSuccess = $derived(form?.success ?? '');
	let pageError = $derived(data.error ?? '');

	let firstName = $state('');
	let lastName = $state('');
	let cellPhoneCountryCode = $state('+1');
	let cellPhone = $state('');

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let archivePassword = $state('');
	let archiveConfirmation = $state('');

	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);
	let showArchivePassword = $state(false);
	let copiedUserId = $state(false);
	let cellPhoneTouched = $state(false);
	let createOrganizationOpen = $state(false);
	let createOrganizationUnsavedConfirmOpen = $state(false);
	let createOrganizationSubmitting = $state(false);
	let createOrganizationSlugTouched = $state(false);
	let createOrganizationSubmissionCount = $state(0);
	let createOrganizationStep = $state<CreateOrganizationStep>(1);
	let createOrganizationSubmitForm = $state<HTMLFormElement | null>(null);
	let switchOrganizationForm = $state<HTMLFormElement | null>(null);
	let organizationSwitchClientId = $state('');
	let createOrganizationClientError = $state('');
	let createOrganizationFieldErrors = $state<Record<string, string>>({});
	let accountSnapshotCollapsed = $state(false);
	let accountSnapshotStorageHydrated = $state(false);

	const ACCOUNT_SNAPSHOT_COLLAPSED_STORAGE_KEY = 'playims:account-snapshot-collapsed';

	const CREATE_ORGANIZATION_STEP_TITLES: Record<CreateOrganizationStep, string> = {
		1: 'Organization Basics',
		2: 'Access Settings',
		3: 'Defaults',
		4: 'Review'
	};

	const createEmptyOrganizationForm = (): CreateOrganizationForm => ({
		organizationName: '',
		organizationSlug: '',
		selfJoinEnabled: false,
		membershipRole: 'manager',
		switchToOrganization: true,
		setDefaultOrganization: true,
		metadata: ''
	});

	const cloneOrganizationForm = (value: CreateOrganizationForm): CreateOrganizationForm => ({
		organizationName: value.organizationName,
		organizationSlug: value.organizationSlug,
		selfJoinEnabled: value.selfJoinEnabled,
		membershipRole: value.membershipRole,
		switchToOrganization: value.switchToOrganization,
		setDefaultOrganization: value.setDefaultOrganization,
		metadata: value.metadata
	});

	const normalizeOrganizationForm = (value: CreateOrganizationForm): CreateOrganizationForm => ({
		organizationName: value.organizationName.trim(),
		organizationSlug: slugifyFinal(value.organizationSlug),
		selfJoinEnabled: value.selfJoinEnabled,
		membershipRole: value.membershipRole,
		switchToOrganization: value.switchToOrganization,
		setDefaultOrganization: value.setDefaultOrganization,
		metadata: value.metadata.trim()
	});

	let createOrganizationForm = $state<CreateOrganizationForm>(createEmptyOrganizationForm());
	let createOrganizationInitialForm = $state<CreateOrganizationForm>(createEmptyOrganizationForm());

	const formatCellPhoneMaskFromDigits = (value: string) => {
		const digits = value.replace(/\D/g, '').slice(0, 10);
		if (digits.length === 0) return '';
		if (digits.length <= 3) return `(${digits}`;
		if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
		return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
	};

	const splitStoredCellPhone = (value: string | null | undefined) => {
		if (!value) {
			return {
				countryCode: '+1',
				nationalDigits: ''
			};
		}

		const trimmed = value.trim();
		const digits = trimmed.replace(/\D/g, '');
		if (digits.length === 10) {
			return {
				countryCode: '+1',
				nationalDigits: digits
			};
		}

		const sortedCodes = [...countryCodeOptions].sort((a, b) => b.length - a.length);
		for (const code of sortedCodes) {
			const codeDigits = code.slice(1);
			if (!digits.startsWith(codeDigits)) {
				continue;
			}

			const rest = digits.slice(codeDigits.length);
			if (rest.length === 10) {
				return {
					countryCode: code,
					nationalDigits: rest
				};
			}
		}

		return {
			countryCode: '+1',
			nationalDigits: digits.slice(-10)
		};
	};

	$effect(() => {
		if (!account) {
			return;
		}

		const parsedCellPhone = splitStoredCellPhone(account.cellPhone ?? '');
		firstName = account.firstName ?? '';
		lastName = account.lastName ?? '';
		cellPhoneCountryCode = parsedCellPhone.countryCode;
		cellPhone = formatCellPhoneMaskFromDigits(parsedCellPhone.nationalDigits);

		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		archivePassword = '';
		archiveConfirmation = '';
		cellPhoneTouched = false;
	});

	let fullName = $derived.by(() => {
		if (!account) return '';
		const composed = `${firstName.trim()} ${lastName.trim()}`.trim();
		return composed.length > 0 ? composed : account.email;
	});

	let initials = $derived.by(() => {
		const source = fullName.trim();
		if (!source) return 'PI';
		const parts = source.split(/\s+/).filter(Boolean);
		if (parts.length === 1) {
			return parts[0].slice(0, 2).toUpperCase();
		}
		return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
	});

	let profileDirty = $derived.by(() => {
		if (!account) return false;
		const normalizedCellPhone = `${cellPhoneCountryCode}${cellPhone.replace(/\D/g, '')}`;
		const existingCellPhone = (account.cellPhone ?? '').trim();
		const cellPhoneChanged =
			(cellPhone.replace(/\D/g, '').length === 0 && existingCellPhone.length > 0) ||
			(cellPhone.replace(/\D/g, '').length > 0 && normalizedCellPhone !== existingCellPhone);
		return (
			firstName.trim() !== (account.firstName ?? '').trim() ||
			lastName.trim() !== (account.lastName ?? '').trim() ||
			cellPhoneChanged
		);
	});

	let cellPhoneIsValid = $derived.by(
		() => cellPhone.replace(/\D/g, '').length === 0 || cellPhoneMaskRegex.test(cellPhone)
	);
	let showCellPhoneError = $derived.by(() => cellPhoneTouched && !cellPhoneIsValid);
	let profileCanSubmit = $derived.by(() => profileDirty && cellPhoneIsValid);

	let passwordCanSubmit = $derived.by(
		() =>
			currentPassword.length >= 8 &&
			newPassword.length >= 8 &&
			confirmPassword.length >= 8 &&
			newPassword === confirmPassword &&
			newPassword !== currentPassword
	);

	let archiveCanSubmit = $derived.by(
		() => archivePassword.length >= 8 && archiveConfirmation.trim().toUpperCase() === 'ARCHIVE'
	);

	const formatDateTime = (value: string | null | undefined) => {
		if (!value) {
			return 'Not available';
		}

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			return 'Not available';
		}

		return parsed.toLocaleString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	};

	const formatSessionDateTime = (value: string | null | undefined) => {
		if (!value) {
			return 'Not available';
		}

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			return 'Not available';
		}

		return parsed.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	};

	const getDeviceLabel = (userAgent: string | null | undefined) => {
		const ua = (userAgent ?? '').toLowerCase();
		if (!ua) return 'Unknown device';
		if (ua.includes('iphone')) return 'iPhone';
		if (ua.includes('ipad')) return 'iPad';
		if (ua.includes('android')) return 'Android device';
		if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac';
		if (ua.includes('windows')) return 'Windows PC';
		if (ua.includes('linux')) return 'Linux device';
		return 'Device';
	};

	const getBrowserLabel = (userAgent: string | null | undefined) => {
		const ua = (userAgent ?? '').toLowerCase();
		if (!ua) return 'Unknown browser';
		if (ua.includes('edg/')) return 'Microsoft Edge';
		if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
		if (ua.includes('firefox/')) return 'Firefox';
		if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
		if (ua.includes('chrome/')) return 'Chrome';
		return 'Browser';
	};

	const formatIpAddress = (value: string | null | undefined) => {
		const trimmed = value?.trim() ?? '';
		if (!trimmed) {
			return 'Unknown IP';
		}

		const normalized = trimmed.toLowerCase();
		if (
			normalized === 'localhost' ||
			normalized.startsWith('localhost:') ||
			normalized === '127.0.0.1' ||
			normalized.startsWith('127.0.0.1:') ||
			normalized === '::1' ||
			normalized === '[::1]' ||
			normalized === '::ffff:127.0.0.1'
		) {
			return 'localhost';
		}

		return trimmed;
	};

	const formatSessionLocation = (
		locationCity: string | null | undefined,
		locationStation: string | null | undefined
	) => {
		const city = locationCity?.trim() ?? '';
		const station = locationStation?.trim() ?? '';

		if (city && station) {
			return `${city} (${station})`;
		}

		if (city) {
			return city;
		}

		if (station) {
			return station;
		}

		return 'Unknown location';
	};

	const toSortableTimestamp = (value: string | null | undefined) => {
		const timestamp = Date.parse(value ?? '');
		return Number.isFinite(timestamp) ? timestamp : 0;
	};

	let orderedActiveSessions = $derived.by(() => {
		if (!account || account.activeSessions.length === 0) {
			return [];
		}

		const sortedCurrent: ActiveSessionData[] = account.activeSessions
			.filter((session: ActiveSessionData) => session.isCurrent)
			.toSorted(
				(a: ActiveSessionData, b: ActiveSessionData) =>
					toSortableTimestamp(b.lastSeenAt) - toSortableTimestamp(a.lastSeenAt)
			);

		const sortedNonCurrent: ActiveSessionData[] = account.activeSessions
			.filter((session: ActiveSessionData) => !session.isCurrent)
			.toSorted(
				(a: ActiveSessionData, b: ActiveSessionData) =>
					toSortableTimestamp(b.lastSeenAt) - toSortableTimestamp(a.lastSeenAt)
			);

		return [...sortedCurrent, ...sortedNonCurrent];
	});

	let createOrganizationDirty = $derived.by(
		() =>
			JSON.stringify(normalizeOrganizationForm(createOrganizationForm)) !==
			JSON.stringify(normalizeOrganizationForm(createOrganizationInitialForm))
	);
	let createOrganizationStepTitle = $derived(
		CREATE_ORGANIZATION_STEP_TITLES[createOrganizationStep]
	);
	let createOrganizationStepProgress = $derived(Math.round((createOrganizationStep / 4) * 100));
	let createOrganizationActionError = $derived.by(() =>
		createOrganizationOpen &&
		createOrganizationSubmissionCount > 0 &&
		actionName === 'createOrganization'
			? actionError
			: ''
	);
	let createOrganizationFormError = $derived.by(
		() => createOrganizationClientError || createOrganizationActionError || ''
	);
	let createOrganizationCanSubmit = $derived.by(() => !createOrganizationSubmitting);
	let createOrganizationCanGoNext = $derived.by(() => !createOrganizationSubmitting);
	let currentOrganizationId = $derived.by(
		() =>
			organizations.find((organization: OrganizationMembership) => organization.isCurrent)
				?.clientId ?? ''
	);
	let currentOrganizationRole = $derived.by(
		() =>
			organizations.find((organization: OrganizationMembership) => organization.isCurrent)?.role ??
			''
	);
	let organizationDropdownOptions = $derived.by(() =>
		organizations.map((organization: OrganizationMembership) => {
			const statusParts: string[] = [];
			if (organization.isCurrent) {
				statusParts.push('CURRENT');
			}
			if (organization.isDefault) {
				statusParts.push('DEFAULT');
			}

			return {
				value: organization.clientId,
				label: organization.clientSlug
					? `${organization.clientName} (/${organization.clientSlug})`
					: organization.clientName,
				statusLabel: statusParts.length > 0 ? statusParts.join(' / ') : undefined
			};
		})
	);

	function readStoredAccountSnapshotCollapsed(): boolean | null {
		if (typeof window === 'undefined') {
			return null;
		}

		try {
			const value = window.localStorage.getItem(ACCOUNT_SNAPSHOT_COLLAPSED_STORAGE_KEY);
			if (value === '1') return true;
			if (value === '0') return false;
			return null;
		} catch {
			return null;
		}
	}

	function writeStoredAccountSnapshotCollapsed(value: boolean): void {
		if (typeof window === 'undefined') {
			return;
		}

		try {
			window.localStorage.setItem(ACCOUNT_SNAPSHOT_COLLAPSED_STORAGE_KEY, value ? '1' : '0');
		} catch {
			// Ignore storage failures; collapse state will still work for the current session.
		}
	}

	onMount(() => {
		const storedValue = readStoredAccountSnapshotCollapsed();
		if (storedValue !== null) {
			accountSnapshotCollapsed = storedValue;
		}
		accountSnapshotStorageHydrated = true;
	});

	$effect(() => {
		if (!accountSnapshotStorageHydrated) {
			return;
		}

		writeStoredAccountSnapshotCollapsed(accountSnapshotCollapsed);
	});

	async function copyUserId() {
		if (!account?.id || typeof navigator === 'undefined' || !navigator.clipboard) {
			return;
		}

		try {
			await navigator.clipboard.writeText(account.id);
			copiedUserId = true;
			setTimeout(() => {
				copiedUserId = false;
			}, 1400);
		} catch {
			copiedUserId = false;
		}
	}

	function handleCellPhoneInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement | null;
		if (!target) {
			return;
		}

		cellPhone = formatCellPhoneMaskFromDigits(target.value);
	}

	function handleOrganizationChange(clientId: string) {
		if (!clientId || clientId === currentOrganizationId || !switchOrganizationForm) {
			return;
		}

		organizationSwitchClientId = clientId;
		switchOrganizationForm.requestSubmit();
	}

	function resetCreateOrganizationWizard() {
		createOrganizationStep = 1;
		createOrganizationSubmitting = false;
		createOrganizationSlugTouched = false;
		createOrganizationSubmissionCount = 0;
		createOrganizationUnsavedConfirmOpen = false;
		createOrganizationClientError = '';
		createOrganizationFieldErrors = {};
		createOrganizationForm = createEmptyOrganizationForm();
		createOrganizationInitialForm = cloneOrganizationForm(createOrganizationForm);
	}

	function openCreateOrganizationWizard() {
		resetCreateOrganizationWizard();
		createOrganizationOpen = true;
	}

	function closeCreateOrganizationWizard() {
		createOrganizationOpen = false;
		createOrganizationUnsavedConfirmOpen = false;
	}

	function requestCloseCreateOrganizationWizard() {
		if (createOrganizationSubmitting) {
			return;
		}

		if (createOrganizationDirty) {
			createOrganizationUnsavedConfirmOpen = true;
			return;
		}

		closeCreateOrganizationWizard();
		resetCreateOrganizationWizard();
	}

	function confirmDiscardCreateOrganizationWizard() {
		closeCreateOrganizationWizard();
		resetCreateOrganizationWizard();
	}

	function cancelDiscardCreateOrganizationWizard() {
		createOrganizationUnsavedConfirmOpen = false;
	}

	function getCreateOrganizationStepErrors(
		values: CreateOrganizationForm,
		step: CreateOrganizationStep
	): Record<string, string> {
		const errors: Record<string, string> = {};

		if (step === 1 || step === 4) {
			if (values.organizationName.trim().length < 2) {
				errors['organizationName'] = 'Organization name must be at least 2 characters.';
			}
			const normalizedSlug = slugifyFinal(values.organizationSlug);
			if (!normalizedSlug) {
				errors['organizationSlug'] = 'Organization slug is required.';
			} else if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
				errors['organizationSlug'] =
					'Organization slug can only include letters, numbers, and dashes.';
			} else if (normalizedSlug.length < 2) {
				errors['organizationSlug'] = 'Organization slug must be at least 2 characters.';
			}
		}

		if (step === 3 || step === 4) {
			if (values.metadata.trim().length > 4000) {
				errors['metadata'] = 'Metadata cannot exceed 4000 characters.';
			}
		}

		return errors;
	}

	function validateCreateOrganizationStep(step: CreateOrganizationStep): boolean {
		const stepErrors = getCreateOrganizationStepErrors(createOrganizationForm, step);
		createOrganizationFieldErrors = stepErrors;
		return Object.keys(stepErrors).length === 0;
	}

	function goToCreateOrganizationNextStep() {
		createOrganizationClientError = '';
		if (!validateCreateOrganizationStep(createOrganizationStep)) {
			return;
		}

		if (createOrganizationStep < 4) {
			createOrganizationStep = (createOrganizationStep + 1) as CreateOrganizationStep;
		}
	}

	function goToCreateOrganizationPreviousStep() {
		createOrganizationClientError = '';
		createOrganizationFieldErrors = {};
		if (createOrganizationStep > 1) {
			createOrganizationStep = (createOrganizationStep - 1) as CreateOrganizationStep;
		}
	}

	function submitCreateOrganizationWizard() {
		createOrganizationClientError = '';
		const reviewErrors = getCreateOrganizationStepErrors(createOrganizationForm, 4);
		createOrganizationFieldErrors = reviewErrors;
		if (Object.keys(reviewErrors).length > 0) {
			createOrganizationStep =
				reviewErrors['organizationName'] || reviewErrors['organizationSlug'] ? 1 : 3;
			return;
		}

		if (!createOrganizationSubmitForm) {
			createOrganizationClientError = 'Unable to submit organization form right now.';
			return;
		}

		createOrganizationSubmitting = true;
		createOrganizationSubmissionCount += 1;
		createOrganizationSubmitForm.requestSubmit();
	}

	const enhanceCreateOrganizationSubmit = () => {
		const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
		const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;

		return async ({
			result,
			update
		}: {
			result: ActionResult;
			update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'redirect' || result.type === 'error') {
				createOrganizationSubmitting = false;
				await applyAction(result);
				return;
			}

			await update({ reset: false });
			createOrganizationSubmitting = false;

			if (typeof window !== 'undefined') {
				requestAnimationFrame(() => {
					window.scrollTo(scrollX, scrollY);
				});
			}

			if (result.type === 'success') {
				const payload = result.data as FormState | undefined;
				if (payload?.action === 'createOrganization' && payload.success) {
					closeCreateOrganizationWizard();
					resetCreateOrganizationWizard();
				}
			}
		};
	};

	const enhanceNoJump = () => {
		const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
		const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;

		return async ({
			result,
			update
		}: {
			result: ActionResult;
			update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'redirect' || result.type === 'error') {
				await applyAction(result);
				return;
			}

			await update({ reset: false });
			if (typeof window !== 'undefined') {
				requestAnimationFrame(() => {
					window.scrollTo(scrollX, scrollY);
				});
			}
		};
	};
</script>

<svelte:head>
	<title>Account - PlayIMs</title>
	<meta
		name="description"
		content="Manage your PlayIMs account profile, security settings, and account lifecycle."
	/>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
	<header class="border-2 border-secondary-300 bg-neutral p-5 relative overflow-hidden">
		<div class="absolute inset-0 pointer-events-none" aria-hidden="true">
			<div
				class="absolute top-0 left-0 w-full h-full bg-[linear-gradient(120deg,var(--color-primary-100)_0%,transparent_40%,var(--color-accent-100)_100%)] opacity-45"
			></div>
		</div>
		<div class="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
			<div class="flex items-start gap-4">
				<div
					class="w-[3.8rem] h-[3.8rem] bg-primary text-white border-2 border-primary-700 flex items-center justify-center text-3xl tracking-wider text-center font-bold font-serif"
				>
					{initials}
				</div>
				<div>
					<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
						Account
					</h1>
					<p class="text-sm text-neutral-950 mt-2">
						Keep your profile sharp, secure your credentials, and control account access.
					</p>
				</div>
			</div>
			<div
				class="border border-secondary-300 bg-white/85 px-3 py-2 text-xs text-neutral-950 max-w-xs flex items-start gap-2"
			>
				<IconSparkles class="w-4 h-4 mt-0.5 shrink-0 text-accent-700" />
				<span>Changes save instantly on submit. Email changes are intentionally disabled.</span>
			</div>
		</div>
	</header>

	{#if pageError}
		<section class="border-2 border-accent-500 bg-accent-100 p-4 text-neutral-950">
			<div class="flex items-start gap-3">
				<IconAlertTriangle class="w-6 h-6 text-accent-800 shrink-0" />
				<p>{pageError}</p>
			</div>
		</section>
	{/if}

	{#if !account}
		<section class="border-2 border-secondary-300 bg-neutral p-6">
			<p class="text-neutral-950">Account details are unavailable right now.</p>
		</section>
	{:else}
		<section class="grid grid-cols-1 lg:grid-cols-4 gap-4">
			<div class="border-2 border-primary-500 bg-neutral p-4 lg:col-span-2">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-xs uppercase tracking-wide text-primary-700 font-bold">
							Profile Progress
						</p>
						<p class="text-3xl font-bold font-serif text-primary-700">
							{account.profileCompletionPercent}%
						</p>
					</div>
					<div class="bg-primary text-white px-3 py-2 text-xs uppercase tracking-wide font-bold">
						{account.status}
					</div>
				</div>
				<div class="mt-3 border border-primary-300 bg-primary-100 h-3">
					<div
						class="h-full bg-primary-500 transition-[width] duration-300"
						style={`width: ${Math.max(0, Math.min(100, account.profileCompletionPercent))}%`}
					></div>
				</div>
			</div>
			<div class="border-2 border-secondary-300 bg-neutral p-4">
				<p class="text-xs uppercase tracking-wide text-neutral-950 font-bold">Active Sessions</p>
				<p class="text-3xl font-bold font-serif text-neutral-950">{account.activeSessionCount}</p>
			</div>
			<div class="border-2 border-secondary-300 bg-neutral p-4">
				<p class="text-xs uppercase tracking-wide text-neutral-950 font-bold">Account Age</p>
				<p class="text-3xl font-bold font-serif text-neutral-950">
					{account.accountAgeDays ?? 0}
				</p>
				<p class="text-xs text-neutral-950">days</p>
			</div>
		</section>

		<div class="grid grid-cols-1 2xl:grid-cols-[1.75fr_1fr] gap-6">
			<div class="space-y-6">
				<section class="border-2 border-secondary-300 bg-neutral">
					<div
						class="p-4 border-b border-secondary-300 bg-neutral-600/66 flex items-center justify-between gap-4"
					>
						<div class="flex items-center gap-3">
							<div class="bg-secondary text-white p-2">
								<IconUser class="w-5 h-5" />
							</div>
							<div>
								<h2 class="text-xl font-bold font-serif text-neutral-950">Profile Essentials</h2>
								<p class="text-xs text-neutral-950">Update your core account identity fields.</p>
							</div>
						</div>
						{#if profileDirty}
							<span class="text-xs uppercase tracking-wide text-accent-800 font-bold"
								>Unsaved edits</span
							>
						{/if}
					</div>

					<div class="p-4 space-y-4">
						{#if actionName === 'updateProfile' && actionError}
							<p class="text-sm border border-accent-500 bg-accent-100 text-accent-900 px-3 py-2">
								{actionError}
							</p>
						{/if}
						{#if actionName === 'updateProfile' && actionSuccess}
							<p
								class="text-sm border border-primary-500 bg-primary-100 text-primary-900 px-3 py-2"
							>
								{actionSuccess}
							</p>
						{/if}

						<form
							method="POST"
							action="?/updateProfile"
							class="space-y-4"
							use:enhance={enhanceNoJump}
						>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<label class="block">
									<span
										class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
										>First name</span
									>
									<input
										class="input-secondary"
										type="text"
										name="firstName"
										maxlength="80"
										autocomplete="off"
										bind:value={firstName}
									/>
								</label>
								<label class="block">
									<span
										class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
										>Last name</span
									>
									<input
										class="input-secondary"
										type="text"
										name="lastName"
										maxlength="80"
										autocomplete="off"
										bind:value={lastName}
									/>
								</label>
							</div>

							<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
								<label class="block">
									<span
										class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
									>
										Email (locked)
									</span>
									<div class="relative flex-1">
										<input
											class="input-secondary opacity-80 pr-10"
											type="email"
											value={account.email}
											disabled
											readonly
										/>
										<IconLock
											class="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-secondary-700"
										/>
									</div>
									<p class="text-xs text-neutral-950 mt-1">
										Email updates are disabled during this phase of account settings.
									</p>
								</label>

								<label class="block">
									<span
										class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
										>Cell phone</span
									>
									<div class="flex">
										<select
											class="select-secondary custom-select w-24 shrink-0"
											name="cellPhoneCountryCode"
											bind:value={cellPhoneCountryCode}
										>
											{#each countryCodeOptions as code}
												<option value={code}>{code}</option>
											{/each}
										</select>
										<input
											class={`input-secondary border-l-0 flex-1 ${
												showCellPhoneError ? 'border-red-600 focus:border-red-700' : ''
											}`}
											type="tel"
											name="cellPhone"
											placeholder="(555) 555-5555"
											inputmode="numeric"
											autocomplete="off"
											aria-invalid={showCellPhoneError}
											bind:value={cellPhone}
											oninput={handleCellPhoneInput}
											onblur={() => {
												cellPhoneTouched = true;
											}}
										/>
									</div>
									{#if showCellPhoneError}
										<p class="mt-1 text-xs text-red-700">
											Enter a valid phone number as (###) ###-####.
										</p>
									{:else}
										<p class="mt-1 text-xs text-neutral-950">
											Format: (###) ###-####, with country code selected at left.
										</p>
									{/if}
								</label>
							</div>

							<div class="flex items-center justify-end gap-3">
								<button
									type="submit"
									class="button-secondary px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={!profileCanSubmit}
								>
									Save Profile
								</button>
							</div>
						</form>
					</div>
				</section>

				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300 bg-neutral-600/66">
						<h2 class="text-xl font-bold font-serif text-neutral-950">Password and Access</h2>
						<p class="text-xs text-neutral-950 mt-1">
							Changing your password signs out your other active sessions for safety.
						</p>
					</div>

					<div class="p-4 space-y-4">
						{#if actionName === 'changePassword' && actionError}
							<p class="text-sm border border-accent-500 bg-accent-100 text-accent-900 px-3 py-2">
								{actionError}
							</p>
						{/if}
						{#if actionName === 'changePassword' && actionSuccess}
							<p
								class="text-sm border border-primary-500 bg-primary-100 text-primary-900 px-3 py-2"
							>
								{actionSuccess}
							</p>
						{/if}

						<form
							method="POST"
							action="?/changePassword"
							class="space-y-4"
							use:enhance={enhanceNoJump}
						>
							<label class="block">
								<span class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1">
									Current password
								</span>
								<div class="relative">
									<input
										class="input-secondary pr-10"
										type={showCurrentPassword ? 'text' : 'password'}
										name="currentPassword"
										autocomplete="off"
										bind:value={currentPassword}
										required
									/>
									<button
										type="button"
										class="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-800 hover:text-secondary-950 cursor-pointer"
										aria-label={showCurrentPassword
											? 'Hide current password'
											: 'Show current password'}
										onclick={() => {
											showCurrentPassword = !showCurrentPassword;
										}}
									>
										{#if showCurrentPassword}
											<IconEye class="w-5 h-5" />
										{:else}
											<IconEyeOff class="w-5 h-5" />
										{/if}
									</button>
								</div>
							</label>

							<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
								<label class="block">
									<span
										class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
									>
										New password
									</span>
									<div class="relative">
										<input
											class="input-secondary pr-10"
											type={showNewPassword ? 'text' : 'password'}
											name="newPassword"
											autocomplete="off"
											bind:value={newPassword}
											required
										/>
										<button
											type="button"
											class="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-800 hover:text-secondary-950 cursor-pointer"
											aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
											onclick={() => {
												showNewPassword = !showNewPassword;
											}}
										>
											{#if showNewPassword}
												<IconEye class="w-5 h-5" />
											{:else}
												<IconEyeOff class="w-5 h-5" />
											{/if}
										</button>
									</div>
								</label>

								<label class="block">
									<span
										class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
									>
										Confirm password
									</span>
									<div class="relative">
										<input
											class="input-secondary pr-10"
											type={showConfirmPassword ? 'text' : 'password'}
											name="confirmPassword"
											autocomplete="off"
											bind:value={confirmPassword}
											required
										/>
										<button
											type="button"
											class="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-800 hover:text-secondary-950 cursor-pointer"
											aria-label={showConfirmPassword
												? 'Hide confirmation password'
												: 'Show confirmation password'}
											onclick={() => {
												showConfirmPassword = !showConfirmPassword;
											}}
										>
											{#if showConfirmPassword}
												<IconEye class="w-5 h-5" />
											{:else}
												<IconEyeOff class="w-5 h-5" />
											{/if}
										</button>
									</div>
								</label>
							</div>

							<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
								<div
									class={`border px-2 py-2 ${newPassword.length >= 8 ? 'border-primary-500 bg-primary-100 text-primary-900' : 'border-secondary-300 bg-secondary-50 text-neutral-950'}`}
								>
									8+ characters
								</div>
								<div
									class={`border px-2 py-2 ${newPassword !== currentPassword && newPassword.length > 0 ? 'border-primary-500 bg-primary-100 text-primary-900' : 'border-secondary-300 bg-secondary-50 text-neutral-950'}`}
								>
									Not reused
								</div>
								<div
									class={`border px-2 py-2 ${newPassword === confirmPassword && confirmPassword.length > 0 ? 'border-primary-500 bg-primary-100 text-primary-900' : 'border-secondary-300 bg-secondary-50 text-neutral-950'}`}
								>
									Matches confirm
								</div>
							</div>

							<div class="flex justify-end">
								<button
									type="submit"
									class="button-secondary px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={!passwordCanSubmit}
								>
									Update Password
								</button>
							</div>
						</form>
					</div>
				</section>

				<section class="border-2 border-error-700 bg-error-100">
					<div class="p-4 border-b border-accent-500 bg-error-700">
						<h2 class="text-xl font-bold font-serif text-error-950">Danger Zone</h2>
						<p class="text-xs text-error-950 mt-1">
							Archive account keeps your row in the database and immediately revokes all sessions.
						</p>
					</div>
					<div class="p-4 space-y-4">
						{#if actionName === 'archiveAccount' && actionError}
							<p class="text-sm border border-error-700 bg-error-200 text-error-950 px-3 py-2">
								{actionError}
							</p>
						{/if}

						<form
							method="POST"
							action="?/archiveAccount"
							class="space-y-4"
							use:enhance={enhanceNoJump}
						>
							<label class="block">
								<span class="block text-xs uppercase tracking-wide text-error-950 font-bold mb-1">
									Type ARCHIVE
								</span>
								<input
									class="input-error"
									type="text"
									name="confirmation"
									autocomplete="off"
									bind:value={archiveConfirmation}
									required
								/>
							</label>

							<label class="block">
								<span class="block text-xs uppercase tracking-wide text-error-950 font-bold mb-1">
									Current password
								</span>
								<div class="relative">
									<input
										class="input-error pr-10"
										type={showArchivePassword ? 'text' : 'password'}
										name="currentPassword"
										autocomplete="off"
										bind:value={archivePassword}
										required
									/>
									<button
										type="button"
										class="absolute right-3 top-1/2 -translate-y-1/2 text-error-950 hover:text-error-950 cursor-pointer"
										aria-label={showArchivePassword
											? 'Hide archive password'
											: 'Show archive password'}
										onclick={() => {
											showArchivePassword = !showArchivePassword;
										}}
									>
										{#if showArchivePassword}
											<IconEye class="w-5 h-5" />
										{:else}
											<IconEyeOff class="w-5 h-5" />
										{/if}
									</button>
								</div>
							</label>

							<div class="border border-error-700 bg-white px-3 py-2 text-xs text-error-950">
								Archiving deactivates this account but preserves historical data in the database.
							</div>

							<div class="flex justify-end">
								<button
									type="submit"
									class="button-error px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={!archiveCanSubmit}
								>
									Archive Account
								</button>
							</div>
						</form>
					</div>
				</section>
			</div>

			<aside class="space-y-6">
				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300 bg-neutral-600/66">
						<h2 class="text-xl font-bold font-serif text-neutral-950">Organizations</h2>
						<p class="text-xs text-neutral-950 mt-1">
							Switch your active workspace without leaving account settings.
						</p>
					</div>
					<div class="p-4 space-y-3">
						{#if actionName === 'switchOrganization' && actionError}
							<p class="text-sm border border-accent-500 bg-accent-100 text-accent-900 px-3 py-2">
								{actionError}
							</p>
						{/if}
						{#if actionName === 'switchOrganization' && actionSuccess}
							<p
								class="text-sm border border-primary-500 bg-primary-100 text-primary-900 px-3 py-2"
							>
								{actionSuccess}
							</p>
						{/if}

						{#if organizations.length === 0}
							<p class="text-sm text-neutral-950">No active organization memberships found.</p>
						{:else}
							<ListboxDropdown
								options={organizationDropdownOptions}
								value={currentOrganizationId}
								ariaLabel="Active organization"
								placeholder="Select organization"
								emptyText="No active organization memberships found."
								buttonClass="button-secondary-outlined w-full px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide cursor-pointer justify-between"
								listClass="mt-1 w-80 max-w-[calc(100vw-2rem)] border-2 border-secondary-300 bg-white z-20"
								optionClass="w-full text-left px-3 py-2 text-xs text-neutral-950 cursor-pointer"
								activeOptionClass="bg-neutral-300 text-neutral-950"
								selectedOptionClass="bg-primary text-white font-semibold"
								footerActionClass="button-secondary-outlined w-full px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer inline-flex items-center justify-center gap-1"
								footerActionAriaLabel="Create new organization"
								noteText={currentOrganizationRole
									? `Current role: ${currentOrganizationRole}`
									: undefined}
								on:change={(event) => {
									handleOrganizationChange(event.detail.value);
								}}
								on:footerAction={openCreateOrganizationWizard}
							>
								{#snippet footerAction()}
									<IconPlus class="w-4 h-4" />
									New
								{/snippet}
							</ListboxDropdown>

							<form
								class="hidden"
								method="POST"
								action="?/switchOrganization"
								use:enhance={enhanceNoJump}
								bind:this={switchOrganizationForm}
							>
								<input type="hidden" name="clientId" value={organizationSwitchClientId} />
							</form>
						{/if}
					</div>
				</section>

				<section class="border-2 border-secondary-300 bg-neutral">
					<div
						class="p-4 border-b border-secondary-300 bg-neutral-600/66 flex items-center justify-between gap-3"
					>
						<h2 class="text-xl font-bold font-serif text-neutral-950">Account Snapshot</h2>
						<button
							type="button"
							class="button-secondary-outlined px-2 py-1 text-[11px] font-bold uppercase tracking-wide inline-flex items-center gap-1 cursor-pointer"
							aria-controls="account-snapshot-panel"
							aria-expanded={!accountSnapshotCollapsed}
							onclick={() => {
								accountSnapshotCollapsed = !accountSnapshotCollapsed;
							}}
						>
							{accountSnapshotCollapsed ? 'Expand' : 'Collapse'}
							{#if accountSnapshotCollapsed}
								<IconChevronDown class="w-4 h-4" />
							{:else}
								<IconChevronUp class="w-4 h-4" />
							{/if}
						</button>
					</div>
					{#if !accountSnapshotCollapsed}
						<div id="account-snapshot-panel" class="p-4 space-y-3 text-sm">
							<div class="border border-secondary-300 bg-white p-3 flex items-start gap-3">
								<IconCalendar class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div>
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
										Member since
									</p>
									<p class="text-neutral-950">{formatDateTime(account.createdAt)}</p>
								</div>
							</div>

							<div class="border border-secondary-300 bg-white p-3 flex items-start gap-3">
								<IconClock class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div>
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
										Last active
									</p>
									<p class="text-neutral-950">{formatSessionDateTime(account.lastActiveAt)}</p>
								</div>
							</div>

							<div class="border border-secondary-300 bg-white p-3 flex items-start gap-3">
								<IconBolt class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div>
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
										Current session
									</p>
									<p class="text-neutral-950">
										Expires {formatSessionDateTime(account.currentSessionExpiresAt)}
									</p>
								</div>
							</div>

							<div class="border border-secondary-300 bg-white p-3 flex items-start gap-3">
								<IconAt class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div>
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
										Email status
									</p>
									<p class="text-neutral-950">
										{account.emailVerifiedAt ? 'Verified' : 'Not verified yet'}
									</p>
								</div>
							</div>

							<div class="border border-secondary-300 bg-white p-3 flex items-start gap-3">
								<IconShieldCheck class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div>
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">Role</p>
									<p class="text-neutral-950">{account.role}</p>
								</div>
							</div>

							<div class="border border-secondary-300 bg-white p-3 flex items-start gap-3">
								<IconId class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div class="min-w-0">
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
										Account ID
									</p>
									<button
										type="button"
										class="mt-0.5 inline-flex max-w-full items-start gap-1 text-left text-xs text-neutral-950 hover:underline cursor-pointer"
										onclick={copyUserId}
										aria-label="Copy account ID"
									>
										<span class="break-all">{account.id}</span>
										<IconCopy class="w-3.5 h-3.5 shrink-0 mt-0.5" />
									</button>
									{#if copiedUserId}
										<p class="text-[10px] uppercase tracking-wide font-bold text-primary-800 mt-1">
											Copied
										</p>
									{/if}
								</div>
							</div>
						</div>
					{/if}
				</section>

				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300 bg-neutral-600/66">
						<h2 class="text-xl font-bold font-serif text-neutral-950">Session Controls</h2>
					</div>
					<div class="p-4 space-y-3">
						{#if actionName === 'signOutSession' && actionError}
							<p class="text-sm border border-accent-500 bg-accent-100 text-accent-900 px-3 py-2">
								{actionError}
							</p>
						{/if}
						{#if actionName === 'signOutSession' && actionSuccess}
							<p
								class="text-sm border border-primary-500 bg-primary-100 text-primary-900 px-3 py-2"
							>
								{actionSuccess}
							</p>
						{/if}

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
							<form method="POST" action="?/signOut" use:enhance={enhanceNoJump}>
								<button
									type="submit"
									class="button-primary w-full px-4 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"
								>
									<IconLogout class="w-4 h-4" />
									Sign Out
								</button>
							</form>

							<form method="POST" action="?/signOutEverywhere" use:enhance={enhanceNoJump}>
								<button
									type="submit"
									class="button-secondary-outlined w-full px-4 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"
								>
									<IconDeviceLaptop class="w-4 h-4" />
									Sign Out Everywhere
								</button>
							</form>
						</div>

						<div class="border border-secondary-300 bg-white p-3 space-y-2">
							<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
								Logged-in Devices
							</p>
							{#if orderedActiveSessions.length === 0}
								<p class="text-xs text-neutral-950">No active sessions found.</p>
							{:else}
								<div class="space-y-2">
									{#each orderedActiveSessions as session (session.id)}
										<div class="border border-secondary-300 bg-neutral p-2 text-xs">
											<div class="flex items-center justify-between gap-2">
												<div class="flex items-center gap-2">
													<IconDeviceLaptop class="w-4 h-4 text-secondary-700" />
													<span class="font-bold text-neutral-950">
														{getDeviceLabel(session.userAgent)} - {getBrowserLabel(
															session.userAgent
														)}
													</span>
													{#if session.isCurrent}
														<span
															class="border border-primary-500 bg-primary-100 text-primary-900 px-2 py-0.5 text-[10px] uppercase tracking-wide font-bold"
														>
															Current
														</span>
													{/if}
												</div>
												<form method="POST" action="?/signOutSession" use:enhance={enhanceNoJump}>
													<input type="hidden" name="sessionId" value={session.id} />
													<button
														type="submit"
														class="text-[10px] uppercase tracking-wide font-bold text-secondary-800 hover:text-secondary-950 hover:underline cursor-pointer"
														title="Sign out this session"
													>
														Sign out
													</button>
												</form>
											</div>
											<p class="mt-1 text-neutral-950">IP: {formatIpAddress(session.ipAddress)}</p>
											<p class="text-neutral-950">
												Location: {formatSessionLocation(
													session.locationCity,
													session.locationStation
												)}
											</p>
											<p class="text-neutral-950">
												Last active: {formatSessionDateTime(session.lastSeenAt)}
											</p>
											<p class="text-neutral-950">
												Expires: {formatSessionDateTime(session.expiresAt)}
											</p>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</section>

				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300 bg-neutral-600/66">
						<h2 class="text-xl font-bold font-serif text-neutral-950">Activity Highlights</h2>
					</div>
					<div class="p-4 space-y-2 text-sm">
						<div class="border border-secondary-300 bg-white px-3 py-2 flex items-center gap-2">
							<IconCheck class="w-4 h-4 text-primary-700" />
							<span>Sessions started: <strong>{account.sessionCount}</strong></span>
						</div>
						<div class="border border-secondary-300 bg-white px-3 py-2 flex items-center gap-2">
							<IconKey class="w-4 h-4 text-primary-700" />
							<span>First login: <strong>{formatDateTime(account.firstLoginAt)}</strong></span>
						</div>
						<div class="border border-secondary-300 bg-white px-3 py-2 flex items-center gap-2">
							<IconTrash class="w-4 h-4 text-primary-700" />
							<span>Last account update: <strong>{formatDateTime(account.updatedAt)}</strong></span>
						</div>
						<div class="border border-secondary-300 bg-white px-3 py-2 flex items-center gap-2">
							<IconAlertTriangle class="w-4 h-4 text-primary-700" />
							<span>Last login: <strong>{formatDateTime(account.lastLoginAt)}</strong></span>
						</div>
					</div>
				</section>
			</aside>
		</div>

		<form
			class="hidden"
			method="POST"
			action="?/createOrganization"
			use:enhance={enhanceCreateOrganizationSubmit}
			bind:this={createOrganizationSubmitForm}
		>
			<input
				type="hidden"
				name="organizationName"
				value={createOrganizationForm.organizationName}
			/>
			<input
				type="hidden"
				name="organizationSlug"
				value={createOrganizationForm.organizationSlug}
			/>
			<input
				type="hidden"
				name="selfJoinEnabled"
				value={createOrganizationForm.selfJoinEnabled ? '1' : '0'}
			/>
			<input type="hidden" name="membershipRole" value={createOrganizationForm.membershipRole} />
			<input
				type="hidden"
				name="switchToOrganization"
				value={createOrganizationForm.switchToOrganization ? '1' : '0'}
			/>
			<input
				type="hidden"
				name="setDefaultOrganization"
				value={createOrganizationForm.setDefaultOrganization ? '1' : '0'}
			/>
			<input type="hidden" name="metadata" value={createOrganizationForm.metadata} />
		</form>

		<CreateOrganizationWizard
			open={createOrganizationOpen}
			step={createOrganizationStep}
			stepTitle={createOrganizationStepTitle}
			stepProgress={createOrganizationStepProgress}
			formError={createOrganizationFormError}
			unsavedConfirmOpen={createOrganizationUnsavedConfirmOpen}
			onRequestClose={requestCloseCreateOrganizationWizard}
			onSubmit={submitCreateOrganizationWizard}
			onInput={() => {
				createOrganizationClientError = '';
			}}
			onUnsavedConfirm={confirmDiscardCreateOrganizationWizard}
			onUnsavedCancel={cancelDiscardCreateOrganizationWizard}
		>
			{#if createOrganizationStep === 1}
				<div class="space-y-4">
					<div class="border border-secondary-300 bg-white p-3">
						<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
							Action Required
						</p>
						<p class="text-sm text-neutral-950 mt-1">Set the organization name and URL slug.</p>
					</div>
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div>
							<label
								for="organization-wizard-name"
								class="block text-sm font-sans text-neutral-950 mb-1"
							>
								Organization Name <span class="text-error-700">*</span>
							</label>
							<input
								id="organization-wizard-name"
								type="text"
								class="input-secondary"
								placeholder="PlayIMs Campus"
								value={createOrganizationForm.organizationName}
								data-wizard-autofocus
								oninput={(event) => {
									const value = (event.currentTarget as HTMLInputElement).value;
									createOrganizationForm.organizationName = value;
									if (!createOrganizationSlugTouched) {
										createOrganizationForm.organizationSlug = slugifyFinal(value);
									}
								}}
								autocomplete="off"
							/>
							{#if createOrganizationFieldErrors['organizationName']}
								<p class="text-xs text-error-700 mt-1">
									{createOrganizationFieldErrors['organizationName']}
								</p>
							{/if}
						</div>
						<div>
							<label
								for="organization-wizard-slug"
								class="block text-sm font-sans text-neutral-950 mb-1"
							>
								Organization Slug <span class="text-error-700">*</span>
							</label>
							<input
								id="organization-wizard-slug"
								type="text"
								class="input-secondary"
								placeholder="playims-campus"
								value={createOrganizationForm.organizationSlug}
								oninput={(event) => {
									createOrganizationSlugTouched = true;
									createOrganizationForm.organizationSlug = applyLiveSlugInput(
										event.currentTarget as HTMLInputElement
									);
								}}
								autocomplete="off"
							/>
							<p class="text-xs font-sans text-neutral-950 mt-1">
								Used for the join page URL: `/your-slug`
							</p>
							{#if createOrganizationFieldErrors['organizationSlug']}
								<p class="text-xs text-error-700 mt-1">
									{createOrganizationFieldErrors['organizationSlug']}
								</p>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			{#if createOrganizationStep === 2}
				<div class="space-y-4">
					<div class="border border-secondary-300 bg-white p-3">
						<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
							Access Settings
						</p>
						<p class="text-sm text-neutral-950 mt-1">
							Define your membership role and decide if this org should allow self-join.
						</p>
					</div>
					<div class="space-y-3">
						<p class="text-sm font-semibold text-neutral-950">Your role in this organization</p>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<button
								type="button"
								class={`border p-3 text-left cursor-pointer ${createOrganizationForm.membershipRole === 'manager' ? 'border-primary-500 bg-primary-100 text-primary-900' : 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'}`}
								onclick={() => {
									createOrganizationForm.membershipRole = 'manager';
								}}
							>
								<p class="font-semibold">Manager</p>
								<p class="text-xs mt-1">Can manage operations and dashboard settings.</p>
							</button>
							<button
								type="button"
								class={`border p-3 text-left cursor-pointer ${createOrganizationForm.membershipRole === 'admin' ? 'border-primary-500 bg-primary-100 text-primary-900' : 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'}`}
								onclick={() => {
									createOrganizationForm.membershipRole = 'admin';
								}}
							>
								<p class="font-semibold">Admin</p>
								<p class="text-xs mt-1">Full administrative control for this organization.</p>
							</button>
						</div>
					</div>
					<div class="border border-secondary-300 bg-white p-3">
						<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
							<input
								type="checkbox"
								class="toggle-secondary"
								checked={createOrganizationForm.selfJoinEnabled}
								onchange={(event) => {
									createOrganizationForm.selfJoinEnabled = (
										event.currentTarget as HTMLInputElement
									).checked;
								}}
							/>
							Allow open self-join for `/<span class="font-semibold"
								>{slugifyFinal(createOrganizationForm.organizationSlug) ||
									'organization-slug'}</span
							>`
						</label>
					</div>
				</div>
			{/if}

			{#if createOrganizationStep === 3}
				<div class="space-y-4">
					<div class="border border-secondary-300 bg-white p-3">
						<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">Defaults</p>
						<p class="text-sm text-neutral-950 mt-1">
							Choose how this new organization should apply to your account right away.
						</p>
					</div>
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div class="border border-secondary-300 bg-white p-3">
							<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
								<input
									type="checkbox"
									class="toggle-secondary"
									checked={createOrganizationForm.switchToOrganization}
									onchange={(event) => {
										createOrganizationForm.switchToOrganization = (
											event.currentTarget as HTMLInputElement
										).checked;
									}}
								/>
								Switch to this organization after create
							</label>
						</div>
						<div class="border border-secondary-300 bg-white p-3">
							<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
								<input
									type="checkbox"
									class="toggle-secondary"
									checked={createOrganizationForm.setDefaultOrganization}
									onchange={(event) => {
										createOrganizationForm.setDefaultOrganization = (
											event.currentTarget as HTMLInputElement
										).checked;
									}}
								/>
								Set as my default organization
							</label>
						</div>
					</div>
					<div>
						<label
							for="organization-wizard-metadata"
							class="block text-sm font-sans text-neutral-950 mb-1"
						>
							Metadata (optional)
						</label>
						<textarea
							id="organization-wizard-metadata"
							class="textarea-secondary min-h-28"
							placeholder="Optional JSON or notes for this organization."
							bind:value={createOrganizationForm.metadata}
						></textarea>
						<p class="text-xs text-neutral-950 mt-1">
							{createOrganizationForm.metadata.length}/4000
						</p>
						{#if createOrganizationFieldErrors['metadata']}
							<p class="text-xs text-error-700 mt-1">{createOrganizationFieldErrors['metadata']}</p>
						{/if}
					</div>
				</div>
			{/if}

			{#if createOrganizationStep === 4}
				<div class="space-y-4">
					<div class="border-2 border-secondary-300 bg-white p-4 space-y-2">
						<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">Organization</p>
						<p class="text-sm text-neutral-950">
							<span class="font-semibold">Name:</span>
							{createOrganizationForm.organizationName.trim() || 'TBD'}
						</p>
						<p class="text-sm text-neutral-950">
							<span class="font-semibold">Slug:</span>
							{slugifyFinal(createOrganizationForm.organizationSlug) || 'TBD'}
						</p>
						<p class="text-sm text-neutral-950">
							<span class="font-semibold">Self-join:</span>
							{createOrganizationForm.selfJoinEnabled ? 'Enabled' : 'Disabled'}
						</p>
					</div>
					<div class="border-2 border-secondary-300 bg-white p-4 space-y-2">
						<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">Membership</p>
						<p class="text-sm text-neutral-950">
							<span class="font-semibold">Role:</span>
							{createOrganizationForm.membershipRole}
						</p>
						<p class="text-sm text-neutral-950">
							<span class="font-semibold">Switch after create:</span>
							{createOrganizationForm.switchToOrganization ? 'Yes' : 'No'}
						</p>
						<p class="text-sm text-neutral-950">
							<span class="font-semibold">Set default:</span>
							{createOrganizationForm.setDefaultOrganization ? 'Yes' : 'No'}
						</p>
						{#if createOrganizationForm.metadata.trim()}
							<p class="text-sm text-neutral-950">
								<span class="font-semibold">Metadata:</span>
								{createOrganizationForm.metadata.trim()}
							</p>
						{/if}
					</div>
				</div>
			{/if}

			{#snippet footer()}
				<WizardStepFooter
					step={createOrganizationStep}
					lastStep={4}
					showBack={createOrganizationStep > 1}
					canGoNext={createOrganizationCanGoNext}
					canSubmit={createOrganizationCanSubmit}
					nextLabel="Next"
					submitLabel="Create Organization"
					submittingLabel="Creating..."
					isSubmitting={createOrganizationSubmitting}
					on:back={goToCreateOrganizationPreviousStep}
					on:next={goToCreateOrganizationNextStep}
				/>
			{/snippet}
		</CreateOrganizationWizard>
	{/if}
</div>
