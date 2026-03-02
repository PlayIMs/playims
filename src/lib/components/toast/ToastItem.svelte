<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly, scale } from 'svelte/transition';
	import {
		IconAlertCircle,
		IconAlertTriangle,
		IconChecks,
		IconInfoCircle,
		IconLoader2,
		IconX
	} from '@tabler/icons-svelte';
	import {
		toast,
		type ToastAction,
		type ToastActionStyle,
		type ToastRecord,
		type ToastVariant
	} from '$lib/toasts';

	interface Props {
		item: ToastRecord;
		index: number;
		preview?: boolean;
		animateEntry?: boolean;
		enterOffsetX?: number;
		enterOffsetY?: number;
	}

	let {
		item,
		index,
		preview = false,
		animateEntry = true,
		enterOffsetX = 0,
		enterOffsetY = -18
	}: Props = $props();

	const iconByVariant: Record<ToastVariant, typeof IconAlertCircle> = {
		success: IconChecks,
		error: IconAlertCircle,
		info: IconInfoCircle,
		warning: IconAlertTriangle,
		loading: IconLoader2
	};

	const frameClassByVariant: Record<ToastVariant, string> = {
		success:
			'border-[var(--color-success-500)] bg-[color-mix(in_srgb,var(--color-success-50)_82%,white_18%)] shadow-[0_18px_40px_rgba(15,23,42,0.14),0_6px_16px_rgba(15,23,42,0.08)]',
		error:
			'border-error-600 bg-[color-mix(in_srgb,var(--color-error-50)_84%,white_16%)] shadow-[0_18px_40px_rgba(15,23,42,0.14),0_6px_16px_rgba(15,23,42,0.08)]',
		info: 'border-neutral-800 bg-[color-mix(in_srgb,var(--color-neutral-50)_88%,white_12%)] shadow-[0_18px_40px_rgba(15,23,42,0.14),0_6px_16px_rgba(15,23,42,0.08)]',
		warning:
			'border-warning-400 bg-[color-mix(in_srgb,var(--color-warning-50)_84%,white_16%)] shadow-[0_18px_40px_rgba(15,23,42,0.14),0_6px_16px_rgba(15,23,42,0.08)]',
		loading:
			'border-secondary-500 bg-[color-mix(in_srgb,var(--color-secondary-50)_84%,white_16%)] shadow-[0_18px_40px_rgba(15,23,42,0.14),0_6px_16px_rgba(15,23,42,0.08)]'
	};

	const progressClassByVariant: Record<ToastVariant, string> = {
		success: 'bg-[var(--color-success-300)]',
		error: 'bg-error-300',
		info: 'bg-neutral-500',
		warning: 'bg-warning-300',
		loading: 'bg-secondary-300'
	};

	const iconWrapClassByVariant: Record<ToastVariant, string> = {
		success: 'border-[var(--color-success-600)] bg-[var(--color-success-500)] text-white',
		error: 'border-error-700 bg-error-600 text-white',
		info: 'border-neutral-700 bg-neutral-700 text-white',
		warning: 'border-warning-500 bg-warning-400 text-warning-950',
		loading: 'border-secondary-700 bg-secondary text-white'
	};

	const closeButtonClassByVariant: Record<ToastVariant, string> = {
		success: 'text-[var(--color-success-800)]',
		error: 'text-error-800',
		info: 'text-neutral-800',
		warning: 'text-warning-800',
		loading: 'text-secondary-800'
	};

	const titleClassByVariant: Record<ToastVariant, string> = {
		success: 'text-[var(--color-success-800)]',
		error: 'text-error-800',
		info: 'text-neutral-900',
		warning: 'text-warning-800',
		loading: 'text-secondary-800'
	};

	const descriptionClassByVariant: Record<ToastVariant, string> = {
		success: 'text-[var(--color-success-950)]',
		error: 'text-error-950',
		info: 'text-neutral-950',
		warning: 'text-warning-950',
		loading: 'text-secondary-950'
	};

	const toastActionClassByVariant: Record<ToastVariant, Record<ToastActionStyle, string>> = {
		success: {
			solid:
				'border-[var(--color-success-600)] bg-[var(--color-success-600)] text-white hover:bg-[var(--color-success-700)] hover:border-[var(--color-success-700)]',
			outline:
				'border-[var(--color-success-600)] bg-transparent text-[var(--color-success-900)] hover:bg-[var(--color-success-100)]'
		},
		error: {
			solid: 'border-error-700 bg-error-700 text-white hover:border-error-800 hover:bg-error-800',
			outline: 'border-error-700 bg-transparent text-error-900 hover:bg-error-100'
		},
		info: {
			solid:
				'border-neutral-900 bg-neutral-900 text-white hover:border-neutral-950 hover:bg-neutral-950',
			outline: 'border-neutral-900 bg-transparent text-neutral-950 hover:bg-neutral-100'
		},
		warning: {
			solid:
				'border-warning-500 bg-warning-500 text-warning-950 hover:border-warning-600 hover:bg-warning-600',
			outline: 'border-warning-600 bg-transparent text-warning-900 hover:bg-warning-100'
		},
		loading: {
			solid:
				'border-secondary-700 bg-secondary-700 text-white hover:border-secondary-800 hover:bg-secondary-800',
			outline: 'border-secondary-700 bg-transparent text-secondary-900 hover:bg-secondary-100'
		}
	};

	function getActionClasses(toastVariant: ToastVariant, action: ToastAction): string {
		const style = action.style ?? 'outline';
		const toneClass = toastActionClassByVariant[toastVariant][style];

		return `inline-flex items-center justify-center border px-2.5 py-1 text-[10px] leading-none font-bold uppercase tracking-wide transition-colors duration-150 cursor-pointer ${toneClass}`;
	}

	let remainingMs = $state(0);
	let paused = $state(false);
	let actionLoadingId = $state('');
	let actionDismissClosing = $state(false);
	let startedAt = 0;
	let activeDurationMs = 0;
	let intervalHandle: ReturnType<typeof setInterval> | null = null;
	let ToastIcon = $derived(iconByVariant[item.variant]);
	const ACTION_DISMISS_EXIT_MS = 160;
	const TIMER_TICK_MS = 40;
	const duplicateCountLabel = $derived(
		item.duplicateCount > 1 ? `(${item.duplicateCount}x)` : ''
	);

	const progressWidth = $derived.by(() => {
		if (item.duration === null || item.duration <= 0) {
			return 100;
		}
		return Math.max(0, Math.min(100, (remainingMs / item.duration) * 100));
	});

	function clearClock(): void {
		if (intervalHandle) {
			clearInterval(intervalHandle);
			intervalHandle = null;
		}
	}

	function startClock(duration: number): void {
		clearClock();
		activeDurationMs = duration;
		startedAt = Date.now();
		remainingMs = duration;
		intervalHandle = setInterval(() => {
			const nextRemaining = Math.max(0, activeDurationMs - (Date.now() - startedAt));
			remainingMs = nextRemaining;
			if (nextRemaining === 0) {
				clearClock();
				toast.dismiss(item.id);
			}
		}, TIMER_TICK_MS);
	}

	function startPreviewLoop(duration: number): void {
		clearClock();
		startedAt = Date.now();
		remainingMs = duration;
		intervalHandle = setInterval(() => {
			const elapsedInCycle = (Date.now() - startedAt) % duration;
			remainingMs = elapsedInCycle === 0 ? duration : duration - elapsedInCycle;
		}, TIMER_TICK_MS);
	}

	function pauseClock(): void {
		if (preview || item.duration === null || paused) {
			return;
		}
		paused = true;
		remainingMs = Math.max(0, activeDurationMs - (Date.now() - startedAt));
		clearClock();
	}

	function resumeClock(): void {
		if (preview || item.duration === null || !paused) {
			return;
		}
		paused = false;
		startClock(remainingMs);
	}

	async function dismissAfterActionExit(): Promise<void> {
		if (preview || actionDismissClosing) {
			return;
		}

		clearClock();
		actionDismissClosing = true;
		await new Promise((resolve) => {
			setTimeout(resolve, ACTION_DISMISS_EXIT_MS);
		});
		toast.dismiss(item.id);
	}

	async function runAction(action: ToastAction): Promise<void> {
		if (preview || actionDismissClosing) {
			return;
		}

		if (!action.onClick || actionLoadingId) {
			if (action.dismissOnClick !== false) {
				await dismissAfterActionExit();
			}
			return;
		}

		actionLoadingId = action.id ?? action.label;
		try {
			await action.onClick();
			if (action.dismissOnClick !== false) {
				await dismissAfterActionExit();
			}
		} finally {
			actionLoadingId = '';
		}
	}

	$effect(() => {
		item.updatedAt;

		if (preview) {
			if (item.duration === null) {
				clearClock();
				return;
			}

			startPreviewLoop(item.duration);
			return () => {
				clearClock();
			};
		}

		if (item.duration === null) {
			clearClock();
			return;
		}

		paused = false;
		startClock(item.duration);
		return () => {
			clearClock();
		};
	});
</script>

<article
	class={`relative overflow-hidden border-2 transition-[opacity,transform] duration-160 ease-out ${
		preview ? 'pointer-events-none' : 'pointer-events-auto'
	} ${actionDismissClosing ? 'translate-y-1 scale-[0.98] opacity-0' : 'translate-y-0 scale-100 opacity-100'} ${frameClassByVariant[item.variant]}`}
	role={item.important ? 'alert' : 'status'}
	aria-live={item.important ? 'assertive' : 'polite'}
	aria-atomic="true"
	style={`z-index:${100 - index};`}
	onmouseenter={pauseClock}
	onmouseleave={resumeClock}
	onfocusin={pauseClock}
	onfocusout={resumeClock}
	in:fly={
		!preview && animateEntry
			? { x: enterOffsetX, y: enterOffsetY, duration: 260, easing: cubicOut }
			: undefined
	}
	out:scale={!preview ? { duration: 160, easing: cubicOut, start: 1, opacity: 0.2 } : undefined}
>
	<div
		class={`px-4 pt-3.5 ${
			item.showProgress && item.duration !== null ? 'pb-5' : 'pb-3.5'
		}`}
	>
		<div class="flex items-start gap-3">
			<div
				class={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center border-2 ${iconWrapClassByVariant[item.variant]}`}
			>
				<ToastIcon class={`h-5 w-5 ${item.variant === 'loading' ? 'animate-spin' : ''}`} />
			</div>
			<div class={`min-w-0 flex-1 ${item.dismissible ? 'pr-6' : ''}`}>
				<div class="space-y-1">
					{#if item.title}
						<div class="flex items-baseline gap-2">
							<p
								class={`font-serif text-[0.72rem] font-bold uppercase tracking-[0.14em] ${titleClassByVariant[item.variant]}`}
							>
								{item.title}
							</p>
							{#if item.duplicateCount > 1}
								<span
									class={`font-serif text-[0.68rem] font-bold tracking-[0.12em] opacity-90 ${titleClassByVariant[item.variant]}`}
								>
									{duplicateCountLabel}
								</span>
							{/if}
						</div>
					{/if}
					<p class={`text-sm leading-5 font-sans ${descriptionClassByVariant[item.variant]}`}>
						{item.description}
					</p>
				</div>
			</div>

			{#if item.dismissible}
				<button
					type="button"
					class={`absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center bg-transparent transition-opacity duration-150 ${closeButtonClassByVariant[item.variant]} ${
						preview ? 'cursor-default opacity-55' : 'cursor-pointer opacity-85 hover:opacity-100'
					}`}
					aria-label={preview ? 'Preview dismiss button' : 'Dismiss notification'}
					disabled={preview}
					onclick={() => {
						if (!preview) {
							toast.dismiss(item.id);
						}
					}}
				>
					<IconX class="h-4 w-4" />
				</button>
			{/if}
		</div>

		{#if item.actions.length > 0}
			<div class="mt-3 flex flex-wrap justify-end gap-2">
				{#each item.actions as action}
					<button
						type="button"
						class={`${getActionClasses(item.variant, action)} disabled:cursor-wait disabled:opacity-65`}
						disabled={actionLoadingId.length > 0}
						onclick={() => void runAction(action)}
					>
						{#if actionLoadingId === (action.id ?? action.label)}
							<span class="inline-flex items-center gap-1">
								<IconLoader2 class="h-3 w-3 animate-spin" />
								Working
							</span>
						{:else}
							{action.label}
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if item.showProgress && item.duration !== null}
		<div
			class={`absolute bottom-0 left-0 h-1.5 transition-[width] duration-75 ease-linear ${progressClassByVariant[item.variant]}`}
			style={`width:${progressWidth}%;`}
		></div>
	{/if}
</article>
