<script lang="ts">
	import { tick } from 'svelte';
	import { WizardModal } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';

	type AuthRole = 'participant' | 'manager' | 'admin' | 'dev';

	interface Props {
		open: boolean;
		formError: string;
		submitting: boolean;
		effectiveRole: AuthRole;
		allowedRoles: AuthRole[];
		onRequestClose: () => void;
		onSelectRole: (role: AuthRole | null) => void;
	}

	let {
		open,
		formError,
		submitting,
		effectiveRole,
		allowedRoles,
		onRequestClose,
		onSelectRole
	}: Props = $props();

	const roleLabel: Record<AuthRole, string> = {
		participant: 'Participant',
		manager: 'Manager',
		admin: 'Admin',
		dev: 'Dev'
	};
	const roleQuickKey: Record<AuthRole, string> = {
		participant: 'P',
		manager: 'M',
		admin: 'A',
		dev: 'D'
	};
	const activeRole = $derived.by(() => effectiveRole);
	const roleOptions = $derived.by(() =>
		allowedRoles.map((role) => ({
			role,
			title: roleLabel[role],
			description: `Switch to ${roleLabel[role]} view permissions.`,
			quickKey: roleQuickKey[role]
		}))
	);
	const quickKeyInstruction = $derived.by(() => {
		const quickKeys = roleOptions
			.map((option) => option.quickKey)
			.filter((quickKey): quickKey is string => Boolean(quickKey));
		if (quickKeys.length === 0) {
			return 'Use Up/Down arrows, Shift, or Enter.';
		}
		if (quickKeys.length === 1) {
			return `Use Up/Down arrows, Shift, Enter, or quick key ${quickKeys[0]}.`;
		}
		if (quickKeys.length === 2) {
			return `Use Up/Down arrows, Shift, Enter, or quick keys ${quickKeys[0]} and ${quickKeys[1]}.`;
		}
		const leadingKeys = quickKeys.slice(0, -1).join(', ');
		const lastKey = quickKeys[quickKeys.length - 1];
		return `Use Up/Down arrows, Shift, Enter, or quick keys ${leadingKeys}, and ${lastKey}.`;
	});
	let highlightedIndex = $state(0);
	let lastToastSignature = $state('');

	function moveHighlight(direction: 1 | -1): void {
		if (roleOptions.length === 0) {
			return;
		}
		const nextIndex = (highlightedIndex + direction + roleOptions.length) % roleOptions.length;
		highlightedIndex = nextIndex;
		void tick().then(() => {
			const optionButton = document.querySelector<HTMLButtonElement>(
				`[data-view-role-option-index="${nextIndex}"]`
			);
			optionButton?.focus();
		});
	}

	function submitHighlightedOption(): void {
		if (submitting || roleOptions.length === 0) {
			return;
		}
		const option = roleOptions[highlightedIndex];
		if (!option) {
			return;
		}
		onSelectRole(option.role);
	}

	$effect(() => {
		const message = formError.trim();
		if (!message) {
			lastToastSignature = '';
			return;
		}

		const signature = `${open ? 'open' : 'closed'}:${message}`;
		if (signature === lastToastSignature) {
			return;
		}

		lastToastSignature = signature;
		toast.error(message, {
			id: 'view-role-error',
			title: 'Role switch'
		});
	});

	$effect(() => {
		if (!open) {
			highlightedIndex = 0;
			return;
		}

		if (roleOptions.length === 0) {
			highlightedIndex = 0;
			return;
		}

		const activeIndex = roleOptions.findIndex((option) => option.role === activeRole);
		highlightedIndex = activeIndex >= 0 ? activeIndex : 0;

		void tick().then(() => {
			const optionButton = document.querySelector<HTMLButtonElement>(
				`[data-view-role-option-index="${highlightedIndex}"]`
			);
			optionButton?.focus();
		});
	});

	$effect(() => {
		if (!open || typeof window === 'undefined') {
			return;
		}

		const handleWindowKeydown = (event: KeyboardEvent): void => {
			if (submitting) {
				return;
			}
			if (event.altKey || event.ctrlKey || event.metaKey) {
				return;
			}

			if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
				event.preventDefault();
				moveHighlight(1);
				return;
			}
			if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
				event.preventDefault();
				moveHighlight(-1);
				return;
			}
			if (event.key === 'Enter') {
				event.preventDefault();
				submitHighlightedOption();
				return;
			}

			const quickKey = event.key.toUpperCase();
			if (!['P', 'M', 'A', 'D'].includes(quickKey)) {
				return;
			}

			const matchingOption = roleOptions.find((option) => option.quickKey === quickKey);
			if (!matchingOption) {
				return;
			}

			event.preventDefault();
			onSelectRole(matchingOption.role);
		};

		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});
</script>

<WizardModal
	{open}
	title="Switch View Role"
	step={1}
	stepCount={1}
	stepTitle="Role View"
	progressPercent={100}
	closeAriaLabel="Close switch role wizard"
	maxWidthClass="max-w-lg"
	formClass="p-4 space-y-4"
	on:requestClose={onRequestClose}
>
	<div class="space-y-4">
		<div class="border border-neutral-950 bg-white p-2.5">
			<p class="text-xs text-neutral-950 font-sans">
				Current view: <span class="font-semibold">{roleLabel[effectiveRole]}</span>
			</p>
			<p class="text-[11px] text-neutral-900 font-sans mt-1">
				{quickKeyInstruction}
			</p>
		</div>
		<div class="grid grid-cols-1 gap-2">
			{#each roleOptions as option, optionIndex}
				<button
					type="button"
					data-view-role-option-index={optionIndex}
					tabindex={highlightedIndex === optionIndex ? 0 : -1}
					onfocus={() => {
						highlightedIndex = optionIndex;
					}}
					class={`group relative border p-2.5 pr-14 text-left cursor-pointer focus-visible:outline-none focus-visible:border-primary-700 disabled:cursor-wait disabled:opacity-70 ${
						highlightedIndex === optionIndex || activeRole === option.role
							? 'border-primary-500 bg-primary-100 text-primary-900'
							: 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'
					}`}
					disabled={submitting}
					onclick={() => onSelectRole(option.role)}
				>
					<div class="flex items-center gap-2">
						<p class="font-semibold">{option.title}</p>
						{#if activeRole === option.role}
							<span class="text-[10px] uppercase tracking-wide font-bold">Current</span>
						{/if}
					</div>
					<p class="text-xs mt-0.5">{option.description}</p>
					{#if option.quickKey}
						<span
							class="pointer-events-none absolute right-2.5 top-1/2 inline-flex min-w-6 h-6 -translate-y-1/2 items-center justify-center rounded-sm border border-secondary-500 bg-neutral-200 px-1.5 text-[11px] font-mono font-bold text-neutral-950 shadow-[inset_0_-1px_0_rgba(0,0,0,0.14)] transition-transform duration-150 ease-out group-hover:-translate-y-[55%] group-focus-visible:-translate-y-[55%]"
						>
							{option.quickKey}
						</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</WizardModal>

