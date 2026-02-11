<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconAt from '@tabler/icons-svelte/icons/at';
	import IconBolt from '@tabler/icons-svelte/icons/bolt';
	import IconCalendar from '@tabler/icons-svelte/icons/calendar';
	import IconCheck from '@tabler/icons-svelte/icons/check';
	import IconClock from '@tabler/icons-svelte/icons/clock';
	import IconCopy from '@tabler/icons-svelte/icons/copy';
	import IconDeviceLaptop from '@tabler/icons-svelte/icons/device-laptop';
	import IconEye from '@tabler/icons-svelte/icons/eye';
	import IconEyeOff from '@tabler/icons-svelte/icons/eye-off';
	import IconId from '@tabler/icons-svelte/icons/id';
	import IconInfoCircle from '@tabler/icons-svelte/icons/info-circle';
	import IconKey from '@tabler/icons-svelte/icons/key';
	import IconLock from '@tabler/icons-svelte/icons/lock';
	import IconLogout from '@tabler/icons-svelte/icons/logout';
	import IconPhone from '@tabler/icons-svelte/icons/phone';
	import IconShieldCheck from '@tabler/icons-svelte/icons/shield-check';
	import IconSparkles from '@tabler/icons-svelte/icons/sparkles';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import IconUser from '@tabler/icons-svelte/icons/user';
	import IconWorld from '@tabler/icons-svelte/icons/world';

	type AccountData = {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
		cellPhone: string;
		avatarUrl: string;
		timezone: string;
		role: string;
		status: string;
		preferences: string;
		notes: string;
		createdAt: string | null;
		updatedAt: string | null;
		emailVerifiedAt: string | null;
		firstLoginAt: string | null;
		lastLoginAt: string | null;
		lastActiveAt: string | null;
		sessionCount: number;
		currentSessionExpiresAt: string | null;
		activeSessionCount: number;
		profileCompletionPercent: number;
		accountAgeDays: number | null;
	};

	type FormState = {
		action?: string;
		error?: string;
		success?: string;
	};

	let { data, form } = $props<{
		data: {
			error?: string;
			account: AccountData | null;
		};
		form?: FormState;
	}>();

	const timezoneSuggestions = [
		'America/New_York',
		'America/Chicago',
		'America/Denver',
		'America/Los_Angeles',
		'America/Phoenix',
		'America/Anchorage',
		'Pacific/Honolulu',
		'Europe/London'
	] as const;

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
	let actionName = $derived(form?.action ?? '');
	let actionError = $derived(form?.error ?? '');
	let actionSuccess = $derived(form?.success ?? '');
	let pageError = $derived(data.error ?? '');

	let firstName = $state('');
	let lastName = $state('');
	let cellPhoneCountryCode = $state('+1');
	let cellPhone = $state('');
	let avatarUrl = $state('');
	let timezone = $state('');
	let preferences = $state('');
	let notes = $state('');

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
		avatarUrl = account.avatarUrl ?? '';
		timezone = account.timezone ?? '';
		preferences = account.preferences ?? '';
		notes = account.notes ?? '';

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
			cellPhoneChanged ||
			avatarUrl.trim() !== (account.avatarUrl ?? '').trim() ||
			timezone.trim() !== (account.timezone ?? '').trim()
		);
	});

	let detailsDirty = $derived.by(() => {
		if (!account) return false;
		return (
			preferences.trim() !== (account.preferences ?? '').trim() ||
			notes.trim() !== (account.notes ?? '').trim()
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

	let timezonePreview = $derived.by(() => {
		const value = timezone.trim();
		if (!value) {
			return 'Using browser default timezone.';
		}

		try {
			return new Intl.DateTimeFormat('en-US', {
				timeZone: value,
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			}).format(new Date());
		} catch {
			return 'Timezone format does not look valid.';
		}
	});

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

	const formatCellPhone = (value: string | null | undefined) => {
		if (!value) {
			return 'Not set';
		}

		const parsed = splitStoredCellPhone(value);
		if (parsed.nationalDigits.length === 10) {
			return `${parsed.countryCode} (${parsed.nationalDigits.slice(0, 3)}) ${parsed.nationalDigits.slice(3, 6)}-${parsed.nationalDigits.slice(6)}`;
		}

		return value;
	};

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
						class="p-4 border-b border-secondary-300 bg-secondary-100 flex items-center justify-between gap-4"
					>
						<div class="flex items-center gap-3">
							<div class="bg-secondary text-white p-2">
								<IconUser class="w-5 h-5" />
							</div>
							<div>
								<h2 class="text-xl font-bold font-serif text-neutral-950">Profile Essentials</h2>
								<p class="text-xs text-neutral-950">
									Update your identity fields and public avatar URL.
								</p>
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

						<form method="POST" action="?/updateProfile" class="space-y-4" use:enhance={enhanceNoJump}>
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
									<span class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1">
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
									<span class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
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
											class={`input-secondary border-l-0 flex-1 ${showCellPhoneError
												? 'border-red-600 focus:border-red-700'
												: ''}`}
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

							<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
								<label class="block">
									<span
										class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
										>Avatar URL</span
									>
									<input
										class="input-secondary"
										type="url"
										name="avatarUrl"
										placeholder="https://example.com/avatar.png"
										autocomplete="off"
										bind:value={avatarUrl}
									/>
								</label>

								<label class="block">
									<span
										class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
										>Timezone</span
									>
									<input
										class="input-secondary"
										type="text"
										name="timezone"
										list="timezone-options"
										placeholder="America/New_York"
										autocomplete="off"
										bind:value={timezone}
									/>
									<datalist id="timezone-options">
										{#each timezoneSuggestions as zone}
											<option value={zone}></option>
										{/each}
									</datalist>
								</label>
							</div>

							<div
								class="border border-secondary-300 bg-secondary-50 px-3 py-2 text-xs text-neutral-950"
							>
								<div class="flex items-center gap-2">
									<IconWorld class="w-4 h-4 text-secondary-800" />
									<span>{timezonePreview}</span>
								</div>
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
					<div class="p-4 border-b border-secondary-300 bg-secondary-100">
						<h2 class="text-xl font-bold font-serif text-neutral-950">Preferences and Notes</h2>
						<p class="text-xs text-neutral-950 mt-1">
							Capture personal defaults, reminders, and private account context.
						</p>
					</div>

					<div class="p-4 space-y-4">
						{#if actionName === 'updateDetails' && actionError}
							<p class="text-sm border border-accent-500 bg-accent-100 text-accent-900 px-3 py-2">
								{actionError}
							</p>
						{/if}
						{#if actionName === 'updateDetails' && actionSuccess}
							<p
								class="text-sm border border-primary-500 bg-primary-100 text-primary-900 px-3 py-2"
							>
								{actionSuccess}
							</p>
						{/if}

						<form method="POST" action="?/updateDetails" class="space-y-4" use:enhance={enhanceNoJump}>
							<label class="block">
								<span class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1">
									Preferences
								</span>
								<textarea
									class="textarea-secondary min-h-28"
									name="preferences"
									maxlength="4000"
									bind:value={preferences}
								></textarea>
								<p class="mt-1 text-xs text-neutral-950">{preferences.length}/4000</p>
							</label>

							<label class="block">
								<span class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1">
									Private notes
								</span>
								<textarea
									class="textarea-secondary min-h-36"
									name="notes"
									maxlength="4000"
									bind:value={notes}
								></textarea>
								<p class="mt-1 text-xs text-neutral-950">{notes.length}/4000</p>
							</label>

							<div class="flex items-center justify-between gap-3">
								<div class="text-xs text-neutral-950 flex items-center gap-2">
									<IconInfoCircle class="w-4 h-4 text-secondary-700" />
									<span>Saved server-side to your account profile.</span>
								</div>
								<button
									type="submit"
									class="button-secondary px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={!detailsDirty}
								>
									Save Details
								</button>
							</div>
						</form>
					</div>
				</section>

				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300 bg-secondary-100">
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

						<form method="POST" action="?/changePassword" class="space-y-4" use:enhance={enhanceNoJump}>
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

				<section class="border-2 border-accent-500 bg-accent-100">
					<div class="p-4 border-b border-accent-500 bg-accent-200">
						<h2 class="text-xl font-bold font-serif text-accent-900">Danger Zone</h2>
						<p class="text-xs text-accent-900 mt-1">
							Archive account keeps your row in the database and immediately revokes all sessions.
						</p>
					</div>
					<div class="p-4 space-y-4">
						{#if actionName === 'archiveAccount' && actionError}
							<p class="text-sm border border-accent-700 bg-accent-200 text-accent-950 px-3 py-2">
								{actionError}
							</p>
						{/if}

						<form method="POST" action="?/archiveAccount" class="space-y-4" use:enhance={enhanceNoJump}>
							<label class="block">
								<span class="block text-xs uppercase tracking-wide text-accent-900 font-bold mb-1">
									Type ARCHIVE
								</span>
								<input
									class="input-accent"
									type="text"
									name="confirmation"
									autocomplete="off"
									bind:value={archiveConfirmation}
									required
								/>
							</label>

							<label class="block">
								<span class="block text-xs uppercase tracking-wide text-accent-900 font-bold mb-1">
									Current password
								</span>
								<div class="relative">
									<input
										class="input-accent pr-10"
										type={showArchivePassword ? 'text' : 'password'}
										name="currentPassword"
										autocomplete="off"
										bind:value={archivePassword}
										required
									/>
									<button
										type="button"
										class="absolute right-3 top-1/2 -translate-y-1/2 text-accent-900 hover:text-accent-950 cursor-pointer"
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

							<div class="border border-accent-500 bg-white px-3 py-2 text-xs text-accent-900">
								Archiving deactivates this account but preserves historical data in the database.
							</div>

							<div class="flex justify-end">
								<button
									type="submit"
									class="button-accent px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
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
					<div class="p-4 border-b border-secondary-300 bg-secondary-100">
						<h2 class="text-xl font-bold font-serif text-neutral-950">Account Snapshot</h2>
					</div>
					<div class="p-4 space-y-3 text-sm">
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
								<p class="text-neutral-950">{formatDateTime(account.lastActiveAt)}</p>
							</div>
						</div>

						<div class="border border-secondary-300 bg-white p-3 flex items-start gap-3">
							<IconBolt class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
							<div>
								<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
									Current session
								</p>
								<p class="text-neutral-950">
									Expires {formatDateTime(account.currentSessionExpiresAt)}
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
							<IconPhone class="w-5 h-5 text-secondary-700 shrink-0 mt-0.5" />
							<div>
								<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">Cell phone</p>
								<p class="text-neutral-950">{formatCellPhone(account.cellPhone)}</p>
							</div>
						</div>

						<div class="border border-secondary-300 bg-white p-3 space-y-2">
							<div class="flex items-center justify-between gap-2">
								<div class="flex items-center gap-2">
									<IconId class="w-5 h-5 text-secondary-700" />
									<p class="text-xs uppercase tracking-wide font-bold text-neutral-950">
										Account ID
									</p>
								</div>
								<button
									type="button"
									class="button-secondary-outlined px-2 py-1 text-[11px] font-bold uppercase tracking-wide flex items-center gap-1"
									onclick={copyUserId}
								>
									<IconCopy class="w-4 h-4" />
									{copiedUserId ? 'Copied' : 'Copy'}
								</button>
							</div>
							<p class="text-xs break-all text-neutral-950">{account.id}</p>
						</div>
					</div>
				</section>

				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300 bg-secondary-100">
						<h2 class="text-xl font-bold font-serif text-neutral-950">Session Controls</h2>
					</div>
					<div class="p-4 space-y-3">
						<form method="POST" action="?/signOut" use:enhance={enhanceNoJump}>
							<button
								type="submit"
								class="button-secondary w-full px-4 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"
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

						<div
							class="border border-secondary-300 bg-secondary-50 px-3 py-2 text-xs text-neutral-950"
						>
							Use "Sign Out Everywhere" if you suspect your account is open on another device.
						</div>
					</div>
				</section>

				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300 bg-secondary-100">
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
	{/if}
</div>
