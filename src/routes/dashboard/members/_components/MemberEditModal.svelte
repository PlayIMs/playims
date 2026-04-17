<script lang="ts">
	import { IconChevronDown, IconChevronUp } from '@tabler/icons-svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { phoneCountries, phoneCountryByIso2 } from '$lib/utils/phone-country-codes';
	import { formatPhoneNationalFromDigits } from '$lib/utils/phone-format';
	import type { MemberSex } from '$lib/members/types.js';
	import { toast } from '$lib/toasts';

	export interface MemberEditFormState {
		email: string;
		cellPhoneCountryIso2: string;
		cellPhoneCountryCode: string;
		cellPhone: string;
		firstName: string;
		lastName: string;
		studentId: string;
		sex: MemberSex | '';
	}

	interface Props {
		open: boolean;
		form: MemberEditFormState;
		submitting?: boolean;
		error?: string;
		fieldErrors?: Record<string, string>;
		onClose: () => void;
		onSubmit: () => void;
	}

	let {
		open,
		form,
		submitting = false,
		error = '',
		fieldErrors = {},
		onClose,
		onSubmit
	}: Props = $props();
	let formElement = $state<HTMLFormElement | null>(null);
	let cellPhoneTouched = $state(false);
	const cellPhoneCountryOptions = $derived.by(() =>
		phoneCountries.map((country) => ({
			value: country.iso2,
			label: `${country.iso2.toUpperCase()} ${country.countryName} (${country.dialCodePlus})`,
			leadingVisualClass: country.flagIconClass,
			leadingVisualAriaLabel: `${country.countryName} flag`,
			searchText: `${country.countryName} ${country.dialCodePlus} ${country.iso2.toUpperCase()}`
		}))
	);
	const selectedCellPhoneCountry = $derived.by(
		() => phoneCountryByIso2.get(form.cellPhoneCountryIso2) ?? null
	);
	const cellPhoneMaskRegex = /^\(\d{3}\)\s\d{3}-\d{4}$/;
	const cellPhoneIsValid = $derived.by(
		() => form.cellPhone.replace(/\D/g, '').length === 0 || cellPhoneMaskRegex.test(form.cellPhone)
	);
	const showCellPhoneError = $derived.by(() => cellPhoneTouched && !cellPhoneIsValid);

	const sexOptions = [
		{ value: 'M', label: 'Male' },
		{ value: 'F', label: 'Female' }
	];

	let lastErrorToast = $state('');

	$effect(() => {
		const message = error.trim();
		if (!message) {
			lastErrorToast = '';
			return;
		}

		const signature = `${open ? 'open' : 'closed'}:${message}`;
		if (signature === lastErrorToast) {
			return;
		}

		lastErrorToast = signature;
		toast.error(message, {
			id: 'member-edit-error',
			title: 'Edit member'
		});
	});

	function handleCellPhoneInput(event: Event): void {
		const target = event.currentTarget as HTMLInputElement | null;
		if (!target) {
			return;
		}

		form.cellPhone = formatPhoneNationalFromDigits(target.value);
	}

	$effect(() => {
		if (!open) {
			return;
		}

		cellPhoneTouched = false;
	});
</script>

<ModalShell
	{open}
	saveShortcutEnabled
	on:requestClose={onClose}
	on:saveShortcut={() => formElement?.requestSubmit()}
>
	<div class="border-b border-neutral-950 bg-neutral-600/66 px-4 py-3">
		<h3 class="text-2xl font-bold font-serif text-neutral-950">Edit Member</h3>
	</div>
	<form
		bind:this={formElement}
		class="flex flex-1 flex-col overflow-hidden bg-neutral"
		onsubmit={(event) => {
			event.preventDefault();
			cellPhoneTouched = true;
			if (!cellPhoneIsValid) {
				return;
			}
			onSubmit();
		}}
	>
		<div class="flex-1 space-y-4 overflow-y-auto p-4">
			<div class="grid gap-4 lg:grid-cols-2">
				<div class="space-y-1">
					<label class="block text-sm font-semibold text-neutral-950" for="member-edit-first-name"
						>First Name</label
					>
					<input
						id="member-edit-first-name"
						class="input-secondary"
						type="text"
						bind:value={form.firstName}
					/>
					{#if fieldErrors.firstName}<p class="text-xs text-secondary-900">
							{fieldErrors.firstName}
						</p>{/if}
				</div>
				<div class="space-y-1">
					<label class="block text-sm font-semibold text-neutral-950" for="member-edit-last-name"
						>Last Name</label
					>
					<input
						id="member-edit-last-name"
						class="input-secondary"
						type="text"
						bind:value={form.lastName}
					/>
					{#if fieldErrors.lastName}<p class="text-xs text-secondary-900">
							{fieldErrors.lastName}
						</p>{/if}
				</div>
				<div class="space-y-1">
					<label class="block text-sm font-semibold text-neutral-950" for="member-edit-email"
						>Email</label
					>
					<input
						id="member-edit-email"
						class="input-secondary"
						type="email"
						bind:value={form.email}
					/>
					{#if fieldErrors.email}<p class="text-xs text-secondary-900">{fieldErrors.email}</p>{/if}
				</div>
				<div class="space-y-1">
					<p class="block text-sm font-semibold text-neutral-950">Phone</p>
					<div
						class={`phone-input-group flex items-stretch ${showCellPhoneError || fieldErrors.cellPhone ? 'phone-input-group-error' : ''}`}
					>
						<ListboxDropdown
							options={cellPhoneCountryOptions}
							value={form.cellPhoneCountryIso2}
							ariaLabel="Cell phone country code"
							panelWidthMode="parent"
							maxPanelHeight={320}
							searchEnabled
							searchPlaceholder="Search country"
							searchAriaLabel="Search countries"
							searchEmptyText="No countries match your search."
							buttonClass="phone-country-trigger relative z-10 h-11 min-w-[5.5rem] border-2 border-secondary-300 border-r-0 bg-white px-1.5 py-2 text-sm text-neutral-950 cursor-pointer inline-flex items-center justify-center gap-1 focus-visible:outline-none"
							on:change={(event) => {
								const nextIso2 = event.detail.value;
								const nextCountry = phoneCountryByIso2.get(nextIso2);
								form.cellPhoneCountryIso2 = nextIso2;
								form.cellPhoneCountryCode = nextCountry?.dialCodePlus ?? '+1';
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
									<span class="text-xs font-semibold leading-none text-neutral-950">
										{form.cellPhoneCountryCode}
									</span>
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
								showCellPhoneError || fieldErrors.cellPhone
									? 'border-l-0 border-red-600 focus:border-red-700'
									: 'border-l-0'
							}`}
							type="tel"
							placeholder="(555) 555-5555"
							inputmode="numeric"
							autocomplete="off"
							aria-invalid={showCellPhoneError || fieldErrors.cellPhone ? 'true' : undefined}
							bind:value={form.cellPhone}
							oninput={handleCellPhoneInput}
							onblur={() => {
								cellPhoneTouched = true;
							}}
						/>
					</div>
					{#if fieldErrors.cellPhone}
						<p class="text-xs text-secondary-900">{fieldErrors.cellPhone}</p>
					{:else if showCellPhoneError}
						<p class="text-xs text-red-700">Enter a valid phone number as (###) ###-####.</p>
					{:else}
						<p class="text-xs text-neutral-700">Phone numbers are optional.</p>
					{/if}
				</div>
				<div class="space-y-1">
					<label class="block text-sm font-semibold text-neutral-950" for="member-edit-student-id"
						>Student ID</label
					>
					<input
						id="member-edit-student-id"
						class="input-secondary"
						type="text"
						bind:value={form.studentId}
					/>
					{#if fieldErrors.studentId}<p class="text-xs text-secondary-900">
							{fieldErrors.studentId}
						</p>{/if}
				</div>
				<div class="space-y-1">
					<p class="block text-sm font-semibold text-neutral-950">Sex</p>
					<ListboxDropdown
						options={sexOptions}
						value={form.sex}
						placeholder="Select sex"
						ariaLabel="Select member sex"
						buttonClass="button-secondary-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2"
						on:change={(event) => {
							form.sex = event.detail.value as MemberSex;
						}}
					/>
					{#if fieldErrors.sex}<p class="text-xs text-secondary-900">{fieldErrors.sex}</p>{/if}
				</div>
			</div>
		</div>
		<div
			class="flex flex-col-reverse gap-2 border-t border-neutral-950 p-4 sm:flex-row sm:justify-end"
		>
			<button
				type="button"
				class="button-secondary-outlined w-full cursor-pointer sm:w-auto"
				onclick={onClose}>Cancel</button
			>
			<button
				type="submit"
				class="button-primary w-full cursor-pointer sm:w-auto"
				disabled={submitting || showCellPhoneError}
			>
				{submitting ? 'Saving...' : 'Save Changes'}
			</button>
		</div>
	</form>
</ModalShell>
