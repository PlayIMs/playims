<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import {
		IconAlertTriangle,
		IconAt,
		IconBolt,
		IconCalendar,
		IconChevronDown,
		IconChevronUp,
		IconCheck,
		IconClock,
		IconCopy,
		IconDeviceLaptop,
		IconEye,
		IconEyeOff,
		IconId,
		IconKey,
		IconLock,
		IconLogout,
		IconShieldCheck,
		IconTrash,
		IconUser
	} from '@tabler/icons-svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import {
		defaultPhoneCountryIso2ByDialCode,
		phoneCountries,
		phoneCountryByIso2,
		phoneCountryDialValues
	} from '$lib/utils/phone-country-codes';
	import { onDestroy, onMount, tick } from 'svelte';
	import { toast } from '$lib/toasts';

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

	type AccountData = {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
		cellPhone: string;
		role: string;
		baseRole: string;
		isViewingAsRole: boolean;
		viewAsRole: string | null;
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
		};
		form?: FormState;
	}>();

	const cellPhoneCountryDropdownOptions = phoneCountries.map((country) => ({
		value: country.iso2,
		label: `${country.iso2.toUpperCase()} ${country.countryName} (${country.dialCodePlus})`,
		leadingVisualClass: country.flagIconClass,
		leadingVisualAriaLabel: `${country.countryName} flag`,
		searchText: `${country.countryName} ${country.dialCodePlus} ${country.iso2.toUpperCase()}`
	}));

	const cellPhoneMaskRegex = /^\(\d{3}\)\s\d{3}-\d{4}$/;

	let account = $derived(data.account);
	let actionName = $derived(form?.action ?? '');
	let actionError = $derived(form?.error ?? '');
	let actionSuccess = $derived(form?.success ?? '');
	let pageError = $derived(data.error ?? '');

	let firstName = $state('');
	let lastName = $state('');
	let cellPhoneCountryIso2 = $state('us');
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
	let profileEssentialsCollapsed = $state(false);
	let passwordAccessCollapsed = $state(false);
	let dangerZoneCollapsed = $state(false);
	let accountSnapshotCollapsed = $state(false);
	let sessionControlsCollapsed = $state(false);
	let activityHighlightsCollapsed = $state(false);
	let collapseStorageHydrated = $state(false);
	let copyUserIdResetTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastPageErrorToast = $state('');
	let lastActionToast = $state('');

	type CollapsedSectionStorage = {
		profileEssentialsCollapsed?: boolean;
		passwordAccessCollapsed?: boolean;
		dangerZoneCollapsed?: boolean;
		accountSnapshotCollapsed?: boolean;
		sessionControlsCollapsed?: boolean;
		activityHighlightsCollapsed?: boolean;
	};

	const ACCOUNT_SECTION_COLLAPSE_STORAGE_KEY = 'playims:account-section-collapsed';
	const ACCOUNT_SNAPSHOT_COLLAPSED_STORAGE_KEY = 'playims:account-snapshot-collapsed';

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
				countryIso2: 'us',
				countryCode: '+1',
				nationalDigits: ''
			};
		}

		const trimmed = value.trim();
		const digits = trimmed.replace(/\D/g, '');
		if (digits.length === 10) {
			return {
				countryIso2: 'us',
				countryCode: '+1',
				nationalDigits: digits
			};
		}

		const sortedCodes = [...phoneCountryDialValues].sort((a, b) => b.length - a.length);
		for (const code of sortedCodes) {
			const codeDigits = code.slice(1);
			if (!digits.startsWith(codeDigits)) {
				continue;
			}

			const rest = digits.slice(codeDigits.length);
			if (rest.length === 10) {
				return {
					countryIso2: defaultPhoneCountryIso2ByDialCode.get(code) ?? 'us',
					countryCode: code,
					nationalDigits: rest
				};
			}
		}

		return {
			countryIso2: 'us',
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
		cellPhoneCountryIso2 = parsedCellPhone.countryIso2;
		cellPhoneCountryCode = parsedCellPhone.countryCode;
		cellPhone = formatCellPhoneMaskFromDigits(parsedCellPhone.nationalDigits);

		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		archivePassword = '';
		archiveConfirmation = '';
		cellPhoneTouched = false;
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
	let selectedCellPhoneCountry = $derived.by(
		() => phoneCountryByIso2.get(cellPhoneCountryIso2) ?? null
	);
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

	const formatAccountAgeCompact = (value: number | null | undefined) => {
		if (value === null || value === undefined || !Number.isFinite(value)) {
			return 'n/a';
		}

		const totalDays = Math.max(0, Math.floor(value));
		if (totalDays > 365) {
			const years = Math.floor(totalDays / 365);
			const days = totalDays % 365;
			return `${years}y${days}d`;
		}

		return `${totalDays}d`;
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

	function readStoredCollapsedSections(): CollapsedSectionStorage | null {
		if (typeof window === 'undefined') {
			return null;
		}

		try {
			const value = window.localStorage.getItem(ACCOUNT_SECTION_COLLAPSE_STORAGE_KEY);
			if (!value) {
				return null;
			}

			const parsed = JSON.parse(value) as unknown;
			if (!parsed || typeof parsed !== 'object') {
				return null;
			}

			const normalized: CollapsedSectionStorage = {};
			if ('profileEssentialsCollapsed' in parsed) {
				normalized.profileEssentialsCollapsed =
					typeof (parsed as CollapsedSectionStorage).profileEssentialsCollapsed === 'boolean'
						? (parsed as CollapsedSectionStorage).profileEssentialsCollapsed
						: undefined;
			}
			if ('passwordAccessCollapsed' in parsed) {
				normalized.passwordAccessCollapsed =
					typeof (parsed as CollapsedSectionStorage).passwordAccessCollapsed === 'boolean'
						? (parsed as CollapsedSectionStorage).passwordAccessCollapsed
						: undefined;
			}
			if ('dangerZoneCollapsed' in parsed) {
				normalized.dangerZoneCollapsed =
					typeof (parsed as CollapsedSectionStorage).dangerZoneCollapsed === 'boolean'
						? (parsed as CollapsedSectionStorage).dangerZoneCollapsed
						: undefined;
			}
			if ('accountSnapshotCollapsed' in parsed) {
				normalized.accountSnapshotCollapsed =
					typeof (parsed as CollapsedSectionStorage).accountSnapshotCollapsed === 'boolean'
						? (parsed as CollapsedSectionStorage).accountSnapshotCollapsed
						: undefined;
			}
			if ('sessionControlsCollapsed' in parsed) {
				normalized.sessionControlsCollapsed =
					typeof (parsed as CollapsedSectionStorage).sessionControlsCollapsed === 'boolean'
						? (parsed as CollapsedSectionStorage).sessionControlsCollapsed
						: undefined;
			}
			if ('activityHighlightsCollapsed' in parsed) {
				normalized.activityHighlightsCollapsed =
					typeof (parsed as CollapsedSectionStorage).activityHighlightsCollapsed === 'boolean'
						? (parsed as CollapsedSectionStorage).activityHighlightsCollapsed
						: undefined;
			}

			return normalized;
		} catch {
			return null;
		}
	}

	function readStoredAccountSnapshotCollapsedLegacy(): boolean | null {
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

	function writeStoredCollapsedSections(value: CollapsedSectionStorage): void {
		if (typeof window === 'undefined') {
			return;
		}

		try {
			window.localStorage.setItem(ACCOUNT_SECTION_COLLAPSE_STORAGE_KEY, JSON.stringify(value));
		} catch {
			// Ignore storage failures; collapse state will still work for the current session.
		}
	}

	onMount(() => {
		const storedCollapsedSections = readStoredCollapsedSections();
		if (storedCollapsedSections) {
			if (typeof storedCollapsedSections.profileEssentialsCollapsed === 'boolean') {
				profileEssentialsCollapsed = storedCollapsedSections.profileEssentialsCollapsed;
			}
			if (typeof storedCollapsedSections.passwordAccessCollapsed === 'boolean') {
				passwordAccessCollapsed = storedCollapsedSections.passwordAccessCollapsed;
			}
			if (typeof storedCollapsedSections.dangerZoneCollapsed === 'boolean') {
				dangerZoneCollapsed = storedCollapsedSections.dangerZoneCollapsed;
			}
			if (typeof storedCollapsedSections.accountSnapshotCollapsed === 'boolean') {
				accountSnapshotCollapsed = storedCollapsedSections.accountSnapshotCollapsed;
			}
			if (typeof storedCollapsedSections.sessionControlsCollapsed === 'boolean') {
				sessionControlsCollapsed = storedCollapsedSections.sessionControlsCollapsed;
			}
			if (typeof storedCollapsedSections.activityHighlightsCollapsed === 'boolean') {
				activityHighlightsCollapsed = storedCollapsedSections.activityHighlightsCollapsed;
			}
		} else {
			// Backward compatibility for prior single-state snapshot persistence.
			const legacySnapshotState = readStoredAccountSnapshotCollapsedLegacy();
			if (legacySnapshotState !== null) {
				accountSnapshotCollapsed = legacySnapshotState;
			}
		}

		collapseStorageHydrated = true;
	});

	onDestroy(() => {
		if (copyUserIdResetTimeout) {
			clearTimeout(copyUserIdResetTimeout);
			copyUserIdResetTimeout = null;
		}
	});

	$effect(() => {
		if (!collapseStorageHydrated) {
			return;
		}

		writeStoredCollapsedSections({
			profileEssentialsCollapsed,
			passwordAccessCollapsed,
			dangerZoneCollapsed,
			accountSnapshotCollapsed,
			sessionControlsCollapsed,
			activityHighlightsCollapsed
		});
	});

	async function copyUserId() {
		if (!account?.id || typeof navigator === 'undefined' || !navigator.clipboard) {
			return;
		}

		try {
			await navigator.clipboard.writeText(account.id);
			if (copyUserIdResetTimeout) {
				clearTimeout(copyUserIdResetTimeout);
				copyUserIdResetTimeout = null;
			}
			copiedUserId = false;
			await tick();
			copiedUserId = true;
			copyUserIdResetTimeout = setTimeout(() => {
				copiedUserId = false;
				copyUserIdResetTimeout = null;
			}, 60);
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

	$effect(() => {
		const message = pageError.trim();
		if (!message) {
			lastPageErrorToast = '';
			return;
		}

		if (message === lastPageErrorToast) {
			return;
		}

		lastPageErrorToast = message;
		toast.error(message, {
			id: 'account-page-error',
			title: 'Account',
			duration: null,
			showProgress: false
		});
	});

	$effect(() => {
		const feedback = actionError.trim() || actionSuccess.trim();
		if (!feedback || !actionName) {
			lastActionToast = '';
			return;
		}

		const variant = actionError.trim() ? 'error' : 'success';
		const signature = `${actionName}:${variant}:${feedback}`;
		if (signature === lastActionToast) {
			return;
		}

		lastActionToast = signature;
		toast[variant](feedback, {
			id: `account-action:${actionName}`,
			title: 'Account'
		});
	});
</script>

<PageTitle pageTitle="Account" />

<svelte:head>
	<meta
		name="description"
		content="Manage your PlayIMs account profile, security settings, and account lifecycle."
	/>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="w-full space-y-4">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex items-center gap-3 py-2 lg:py-3">
				<div
					class="bg-primary text-white border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
					aria-hidden="true"
				>
					<IconUser class="w-7 h-7 lg:w-8 lg:h-8" />
				</div>
				<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
					Account
				</h1>
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6 space-y-6">
		{#if !account}
			<section class="border-2 border-neutral-950 bg-neutral p-6">
				<p class="text-neutral-950">Account details are unavailable right now.</p>
			</section>
		{:else}
			<div class="grid grid-cols-1 2xl:grid-cols-[1.75fr_1fr] gap-6">
				<div class="space-y-6">
				<section class="border-2 border-neutral-950 bg-neutral">
					<div
						class="p-4 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between gap-4"
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
						<div class="flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
							<div class="text-right min-w-0">
								<p class="text-[10px] uppercase tracking-wide text-primary-800 font-bold">
									Profile {Math.max(0, Math.min(100, account.profileCompletionPercent))}%
								</p>
								<div class="mt-1 ml-auto border border-primary-300 bg-primary-100 h-1.5 w-24">
									<div
										class="h-full bg-primary-500 transition-[width] duration-300"
										style={`width: ${Math.max(0, Math.min(100, account.profileCompletionPercent))}%`}
									></div>
								</div>
							</div>
							{#if profileDirty}
								<span class="text-xs uppercase tracking-wide text-secondary-800 font-bold"
									>Unsaved edits</span
								>
							{/if}
							<button
								type="button"
								class="inline-flex h-7 w-7 items-center justify-center text-secondary-900 hover:text-secondary-950 cursor-pointer"
								aria-controls="profile-essentials-panel"
								aria-expanded={!profileEssentialsCollapsed}
								onclick={() => {
									profileEssentialsCollapsed = !profileEssentialsCollapsed;
								}}
							>
								{#if profileEssentialsCollapsed}
									<IconChevronDown class="w-4 h-4" />
								{:else}
									<IconChevronUp class="w-4 h-4" />
								{/if}
							</button>
						</div>
					</div>

					{#if !profileEssentialsCollapsed}
						<div id="profile-essentials-panel" class="p-4 space-y-4">
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
										<div
											class={`phone-input-group flex items-stretch ${showCellPhoneError ? 'phone-input-group-error' : ''}`}
										>
											<input
												type="hidden"
												name="cellPhoneCountryCode"
												value={cellPhoneCountryCode}
											/>
											<ListboxDropdown
												options={cellPhoneCountryDropdownOptions}
												value={cellPhoneCountryIso2}
												ariaLabel="Cell phone country code"
												panelWidthMode="parent"
												maxPanelHeight={320}
												searchEnabled
												searchPlaceholder="Search country"
												searchAriaLabel="Search countries"
												searchEmptyText="No countries match your search."
												buttonClass="phone-country-trigger relative z-10 w-16 h-11 border-2 border-secondary-300 border-r-0 bg-white px-1.5 py-2 text-sm text-neutral-950 cursor-pointer inline-flex items-center justify-center gap-1 focus-visible:outline-none"
												listClass="mt-1 border-2 border-neutral-950 bg-white z-20"
												optionClass="w-full text-left px-3 py-2 text-sm text-neutral-950 cursor-pointer"
												activeOptionClass="bg-neutral-300 text-neutral-950"
												selectedOptionClass="bg-primary text-white font-semibold"
												on:change={(event) => {
													const nextIso2 = event.detail.value;
													const nextCountry = phoneCountryByIso2.get(nextIso2);
													cellPhoneCountryIso2 = nextIso2;
													cellPhoneCountryCode = nextCountry?.dialCodePlus ?? '+1';
												}}
											>
												{#snippet trigger(open)}
													<span class="pointer-events-none inline-flex items-center gap-1.5">
														{#if selectedCellPhoneCountry?.flagIconClass}
															<span
																class={`${selectedCellPhoneCountry.flagIconClass} country-flag-icon shrink-0`}
																aria-hidden="true"
															></span>
														{:else}
															<span class="text-xs font-semibold leading-none text-neutral-950">
																{selectedCellPhoneCountry?.iso2?.toUpperCase() ?? 'US'}
															</span>
														{/if}
														{#if open}
															<IconChevronUp class="h-3.5 w-3.5 shrink-0 text-neutral-900" />
														{:else}
															<IconChevronDown class="h-3.5 w-3.5 shrink-0 text-neutral-900" />
														{/if}
													</span>
													<span class="sr-only">
														{selectedCellPhoneCountry
															? `${selectedCellPhoneCountry.countryName} ${selectedCellPhoneCountry.dialCodePlus}`
															: 'Select country'}
													</span>
												{/snippet}
											</ListboxDropdown>
											<input
												class={`phone-number-field relative z-0 input-secondary min-h-11 flex-1 ${
													showCellPhoneError
														? 'border-l-0 border-red-600 focus:border-red-700'
														: 'border-l-0'
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
					{/if}
				</section>

				<section class="border-2 border-neutral-950 bg-neutral">
					<div
						class="p-4 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between gap-3"
					>
						<div>
							<h2 class="text-xl font-bold font-serif text-neutral-950">Password and Access</h2>
							<p class="text-xs text-neutral-950 mt-1">
								Changing your password signs out your other active sessions for safety.
							</p>
						</div>
						<button
							type="button"
							class="inline-flex h-7 w-7 items-center justify-center text-secondary-900 hover:text-secondary-950 cursor-pointer"
							aria-controls="password-access-panel"
							aria-expanded={!passwordAccessCollapsed}
							onclick={() => {
								passwordAccessCollapsed = !passwordAccessCollapsed;
							}}
						>
							{#if passwordAccessCollapsed}
								<IconChevronDown class="w-4 h-4" />
							{:else}
								<IconChevronUp class="w-4 h-4" />
							{/if}
						</button>
					</div>

					{#if !passwordAccessCollapsed}
						<div id="password-access-panel" class="p-4 space-y-4">
							<form
								method="POST"
								action="?/changePassword"
								class="space-y-4"
								use:enhance={enhanceNoJump}
							>
								<label class="block">
									<span
										class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
									>
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
											tabindex="-1"
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
												tabindex="-1"
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
												tabindex="-1"
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
					{/if}
				</section>

				<section class="border-2 border-error-700 bg-error-100">
					<div
						class="p-4 border-b border-secondary-500 bg-error-700 flex items-center justify-between gap-3"
					>
						<div>
							<h2 class="text-xl font-bold font-serif text-error-950">Danger Zone</h2>
							<p class="text-xs text-error-950 mt-1">
								Archive account keeps your row in the database and immediately revokes all sessions.
							</p>
						</div>
						<button
							type="button"
							class="inline-flex h-7 w-7 items-center justify-center text-error-950 hover:text-error-950 cursor-pointer"
							aria-controls="danger-zone-panel"
							aria-expanded={!dangerZoneCollapsed}
							onclick={() => {
								dangerZoneCollapsed = !dangerZoneCollapsed;
							}}
						>
							{#if dangerZoneCollapsed}
								<IconChevronDown class="w-4 h-4" />
							{:else}
								<IconChevronUp class="w-4 h-4" />
							{/if}
						</button>
					</div>
					{#if !dangerZoneCollapsed}
						<div id="danger-zone-panel" class="p-4 space-y-4">
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
											tabindex="-1"
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
					{/if}
				</section>
			</div>

			<aside class="space-y-6">
				<section class="border-2 border-neutral-950 bg-neutral">
					<div
						class="p-4 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between gap-3"
					>
						<h2 class="text-xl font-bold font-serif text-neutral-950">Account Snapshot</h2>
						<button
							type="button"
							class="inline-flex h-7 w-7 items-center justify-center text-secondary-900 hover:text-secondary-950 cursor-pointer"
							aria-controls="account-snapshot-panel"
							aria-expanded={!accountSnapshotCollapsed}
							onclick={() => {
								accountSnapshotCollapsed = !accountSnapshotCollapsed;
							}}
						>
							{#if accountSnapshotCollapsed}
								<IconChevronDown class="w-4 h-4" />
							{:else}
								<IconChevronUp class="w-4 h-4" />
							{/if}
						</button>
					</div>
					{#if !accountSnapshotCollapsed}
						<div id="account-snapshot-panel" class="p-4 space-y-3 text-sm">
							<div class="border border-neutral-950 bg-white p-3 flex items-start gap-3">
								<IconCalendar class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div>
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
										Member since
									</p>
									<p class="text-neutral-950">
										<DateHoverText
											display={formatDateTime(account.createdAt)}
											value={account.createdAt}
											includeTime
										/>
									</p>
								</div>
							</div>

							<div class="border border-neutral-950 bg-white p-3 flex items-start gap-3">
								<IconCalendar class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div>
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
										Account age
									</p>
									<p class="text-neutral-950">{formatAccountAgeCompact(account.accountAgeDays)}</p>
								</div>
							</div>

							<div class="border border-neutral-950 bg-white p-3 flex items-start gap-3">
								<IconClock class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div>
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
										Last active
									</p>
									<p class="text-neutral-950">
										<DateHoverText
											display={formatSessionDateTime(account.lastActiveAt)}
											value={account.lastActiveAt}
											includeTime
										/>
									</p>
								</div>
							</div>

							<div class="border border-neutral-950 bg-white p-3 flex items-start gap-3">
								<IconBolt class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div>
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
										Current session
									</p>
									<p class="text-neutral-950">
										Expires
										<DateHoverText
											display={formatSessionDateTime(account.currentSessionExpiresAt)}
											value={account.currentSessionExpiresAt}
											includeTime
											textClass="ml-1"
										/>
									</p>
								</div>
							</div>

							<div class="border border-neutral-950 bg-white p-3 flex items-start gap-3">
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

							<div class="border border-neutral-950 bg-white p-3 flex items-start gap-3">
								<IconShieldCheck class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
								<div>
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">Role</p>
									<p class="text-neutral-950">
										{#if account.isViewingAsRole}
											{account.role} (view mode)
										{:else}
											{account.role}
										{/if}
									</p>
									{#if account.isViewingAsRole}
										<p class="text-xs text-neutral-950 mt-0.5">
											Organization role: {account.baseRole}
										</p>
									{/if}
								</div>
							</div>

							<div class="border border-neutral-950 bg-white p-3 flex items-start gap-3">
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
										<IconCopy
											class={`w-3.5 h-3.5 shrink-0 mt-0.5 ${copiedUserId ? 'text-green-500 transition-none' : 'text-neutral-950/70 transition-colors duration-[2000ms] ease-out'}`}
										/>
									</button>
								</div>
							</div>
						</div>
					{/if}
				</section>

				<section class="border-2 border-neutral-950 bg-neutral">
					<div
						class="p-4 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between gap-3"
					>
						<h2 class="text-xl font-bold font-serif text-neutral-950">Session Controls</h2>
						<button
							type="button"
							class="inline-flex h-7 w-7 items-center justify-center text-secondary-900 hover:text-secondary-950 cursor-pointer"
							aria-controls="session-controls-panel"
							aria-expanded={!sessionControlsCollapsed}
							onclick={() => {
								sessionControlsCollapsed = !sessionControlsCollapsed;
							}}
						>
							{#if sessionControlsCollapsed}
								<IconChevronDown class="w-4 h-4" />
							{:else}
								<IconChevronUp class="w-4 h-4" />
							{/if}
						</button>
					</div>
					{#if !sessionControlsCollapsed}
						<div id="session-controls-panel" class="p-4 space-y-3">
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

							<div class="border border-neutral-950 bg-white p-3 space-y-2">
								<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
									Logged-in Devices
								</p>
								{#if orderedActiveSessions.length === 0}
									<p class="text-xs text-neutral-950">No active sessions found.</p>
								{:else}
									<div class="space-y-2">
										{#each orderedActiveSessions as session (session.id)}
											<div class="border border-neutral-950 bg-neutral p-2 text-xs">
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
														<HoverTooltip text="Sign out this session">
															<button
																type="submit"
																class="text-[10px] uppercase tracking-wide font-bold text-secondary-800 hover:text-secondary-950 hover:underline cursor-pointer"
															>
																Sign out
															</button>
														</HoverTooltip>
													</form>
												</div>
												<p class="mt-1 text-neutral-950">
													IP: {formatIpAddress(session.ipAddress)}
												</p>
												<p class="text-neutral-950">
													Location: {formatSessionLocation(
														session.locationCity,
														session.locationStation
													)}
												</p>
												<p class="text-neutral-950">
													Last active:
													<DateHoverText
														display={formatSessionDateTime(session.lastSeenAt)}
														value={session.lastSeenAt}
														includeTime
														textClass="ml-1"
													/>
												</p>
												<p class="text-neutral-950">
													Expires:
													<DateHoverText
														display={formatSessionDateTime(session.expiresAt)}
														value={session.expiresAt}
														includeTime
														textClass="ml-1"
													/>
												</p>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</section>

				<section class="border-2 border-neutral-950 bg-neutral">
					<div
						class="p-4 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between gap-3"
					>
						<h2 class="text-xl font-bold font-serif text-neutral-950">Activity Highlights</h2>
						<button
							type="button"
							class="inline-flex h-7 w-7 items-center justify-center text-secondary-900 hover:text-secondary-950 cursor-pointer"
							aria-controls="activity-highlights-panel"
							aria-expanded={!activityHighlightsCollapsed}
							onclick={() => {
								activityHighlightsCollapsed = !activityHighlightsCollapsed;
							}}
						>
							{#if activityHighlightsCollapsed}
								<IconChevronDown class="w-4 h-4" />
							{:else}
								<IconChevronUp class="w-4 h-4" />
							{/if}
						</button>
					</div>
					{#if !activityHighlightsCollapsed}
						<div id="activity-highlights-panel" class="p-4 space-y-2 text-sm">
							<div class="border border-neutral-950 bg-white px-3 py-2 flex items-center gap-2">
								<IconCheck class="w-4 h-4 text-primary-700" />
								<span>Sessions started: <strong>{account.sessionCount}</strong></span>
							</div>
							<div class="border border-neutral-950 bg-white px-3 py-2 flex items-center gap-2">
								<IconKey class="w-4 h-4 text-primary-700" />
								<span
									>First login:
									<strong>
										<DateHoverText
											display={formatDateTime(account.firstLoginAt)}
											value={account.firstLoginAt}
											includeTime
										/>
									</strong></span
								>
							</div>
							<div class="border border-neutral-950 bg-white px-3 py-2 flex items-center gap-2">
								<IconTrash class="w-4 h-4 text-primary-700" />
								<span
									>Last account update:
									<strong>
										<DateHoverText
											display={formatDateTime(account.updatedAt)}
											value={account.updatedAt}
											includeTime
										/>
									</strong></span
								>
							</div>
							<div class="border border-neutral-950 bg-white px-3 py-2 flex items-center gap-2">
								<IconAlertTriangle class="w-4 h-4 text-primary-700" />
								<span
									>Last login:
									<strong>
										<DateHoverText
											display={formatDateTime(account.lastLoginAt)}
											value={account.lastLoginAt}
											includeTime
										/>
									</strong></span
								>
							</div>
						</div>
					{/if}
				</section>
			</aside>
		</div>

	{/if}
</div>
</div>

