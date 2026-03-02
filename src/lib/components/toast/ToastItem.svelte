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
		forceMobileLayout?: boolean;
		animateEntry?: boolean;
		enterOffsetX?: number;
		enterOffsetY?: number;
	}

	let {
		item,
		index,
		preview = false,
		forceMobileLayout = false,
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

		return forceMobileLayout
			? `inline-flex items-center justify-center border px-1.5 py-0.5 text-[8px] leading-none font-bold uppercase tracking-wide transition-colors duration-150 cursor-pointer ${toneClass}`
			: `inline-flex items-center justify-center border px-1.5 py-0.5 text-[8px] leading-none font-bold uppercase tracking-wide transition-colors duration-150 cursor-pointer sm:px-2.5 sm:py-1 sm:text-[10px] ${toneClass}`;
	}

	let remainingMs = $state(0);
	let paused = $state(false);
	let actionLoadingId = $state('');
	let actionDismissClosing = $state(false);
	let startedAt = 0;
	let activeDurationMs = 0;
	let frameHandle: number | null = null;
	let clockToken = 0;
	let ToastIcon = $derived(iconByVariant[item.variant]);
	const ACTION_DISMISS_EXIT_MS = 160;
	const duplicateCountLabel = $derived(
		item.duplicateCount > 1 ? `(${item.duplicateCount}x)` : ''
	);
	const contentPaddingClass = $derived.by(() => {
		if (forceMobileLayout) {
			return item.showProgress && item.duration !== null
				? 'px-2.5 pt-2.5 pb-3.5'
				: 'px-2.5 pt-2.5 pb-2.5';
		}

		return item.showProgress && item.duration !== null
			? 'px-2.5 pt-2.5 pb-3.5 sm:px-4 sm:pt-3.5 sm:pb-5'
			: 'px-2.5 pt-2.5 pb-2.5 sm:px-4 sm:pt-3.5 sm:pb-3.5';
	});
	const rowGapClass = $derived(forceMobileLayout ? 'gap-2' : 'gap-2 sm:gap-3');
	const iconWrapClass = $derived(
		forceMobileLayout
			? 'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center border-2'
			: 'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center border-2 sm:h-9 sm:w-9'
	);
	const iconClass = $derived(
		forceMobileLayout
			? `h-3.5 w-3.5 ${item.variant === 'loading' ? 'animate-spin' : ''}`
			: `h-3.5 w-3.5 sm:h-5 sm:w-5 ${item.variant === 'loading' ? 'animate-spin' : ''}`
	);
	const bodyPaddingClass = $derived(
		forceMobileLayout
			? item.dismissible
				? 'min-w-0 flex-1 pr-4'
				: 'min-w-0 flex-1'
			: item.dismissible
				? 'min-w-0 flex-1 pr-4 sm:pr-6'
				: 'min-w-0 flex-1'
	);
	const bodySpacingClass = $derived(forceMobileLayout ? 'space-y-0.5' : 'space-y-0.5 sm:space-y-1');
	const titleClass = $derived(
		forceMobileLayout
			? `font-serif text-[0.62rem] font-bold uppercase tracking-[0.11em] ${titleClassByVariant[item.variant]}`
			: `font-serif text-[0.62rem] font-bold uppercase tracking-[0.11em] sm:text-[0.72rem] sm:tracking-[0.14em] ${titleClassByVariant[item.variant]}`
	);
	const duplicateLabelClass = $derived(
		forceMobileLayout
			? `font-serif text-[0.58rem] font-bold tracking-[0.08em] opacity-90 ${titleClassByVariant[item.variant]}`
			: `font-serif text-[0.58rem] font-bold tracking-[0.08em] opacity-90 sm:text-[0.68rem] sm:tracking-[0.12em] ${titleClassByVariant[item.variant]}`
	);
	const descriptionClass = $derived(
		forceMobileLayout
			? `text-xs leading-[1.125rem] font-sans ${descriptionClassByVariant[item.variant]}`
			: `text-xs leading-[1.125rem] font-sans sm:text-sm sm:leading-5 ${descriptionClassByVariant[item.variant]}`
	);
	const dismissButtonClass = $derived(
		forceMobileLayout
			? `absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center bg-transparent transition-opacity duration-150 ${closeButtonClassByVariant[item.variant]} ${
					preview ? 'cursor-default opacity-55' : 'cursor-pointer opacity-85 hover:opacity-100'
				}`
			: `absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center bg-transparent transition-opacity duration-150 sm:right-2 sm:top-2 sm:h-5 sm:w-5 ${closeButtonClassByVariant[item.variant]} ${
					preview ? 'cursor-default opacity-55' : 'cursor-pointer opacity-85 hover:opacity-100'
				}`
	);
	const dismissIconClass = $derived(forceMobileLayout ? 'h-3 w-3' : 'h-3 w-3 sm:h-4 sm:w-4');
	const actionsWrapClass = $derived(
		forceMobileLayout
			? 'mt-2 flex flex-wrap justify-end gap-1.5 pr-3'
			: 'mt-2 flex flex-wrap justify-end gap-1.5 pr-3 sm:mt-3 sm:gap-2 sm:pr-5'
	);
	const actionLoadingIconClass = $derived(
		forceMobileLayout ? 'h-2 w-2 animate-spin' : 'h-2 w-2 animate-spin sm:h-3 sm:w-3'
	);
	const progressClass = $derived(
		forceMobileLayout
			? `absolute bottom-0 left-0 h-1 transition-[width] duration-75 ease-linear ${progressClassByVariant[item.variant]}`
			: `absolute bottom-0 left-0 h-1 transition-[width] duration-75 ease-linear sm:h-1.5 ${progressClassByVariant[item.variant]}`
	);

	const progressWidth = $derived.by(() => {
		if (item.duration === null || item.duration <= 0) {
			return 100;
		}
		return Math.max(0, Math.min(100, (remainingMs / item.duration) * 100));
	});

	function clearClock(): void {
		clockToken += 1;
		if (frameHandle !== null) {
			cancelAnimationFrame(frameHandle);
			frameHandle = null;
		}
	}

	function scheduleFrame(callback: FrameRequestCallback): void {
		frameHandle = requestAnimationFrame(callback);
	}

	function startClock(duration: number): void {
		clearClock();
		activeDurationMs = duration;
		startedAt = Date.now();
		remainingMs = duration;
		const token = clockToken;
		const tick = () => {
			if (token !== clockToken || paused) {
				return;
			}

			const nextRemaining = Math.max(0, activeDurationMs - (Date.now() - startedAt));
			remainingMs = nextRemaining;
			if (nextRemaining === 0) {
				clearClock();
				toast.dismiss(item.id);
				return;
			}

			scheduleFrame(tick);
		};

		scheduleFrame(tick);
	}

	function startPreviewLoop(duration: number): void {
		clearClock();
		startedAt = Date.now();
		remainingMs = duration;
		const token = clockToken;
		const tick = () => {
			if (token !== clockToken) {
				return;
			}

			const elapsedInCycle = (Date.now() - startedAt) % duration;
			remainingMs = elapsedInCycle === 0 ? duration : duration - elapsedInCycle;

			scheduleFrame(tick);
		};

		scheduleFrame(tick);
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

	function handleFocusIn(): void {
		pauseClock();
	}

	function handleFocusOut(event: FocusEvent): void {
		const nextTarget = event.relatedTarget;
		if (nextTarget instanceof Node && event.currentTarget instanceof HTMLElement) {
			if (event.currentTarget.contains(nextTarget)) {
				return;
			}
		}

		resumeClock();
	}
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
	onfocusin={handleFocusIn}
	onfocusout={handleFocusOut}
	in:fly={
		!preview && animateEntry
			? { x: enterOffsetX, y: enterOffsetY, duration: 260, easing: cubicOut }
			: undefined
	}
	out:scale={!preview ? { duration: 160, easing: cubicOut, start: 1, opacity: 0.2 } : undefined}
>
	<div class={contentPaddingClass}>
		<div class={`flex items-start ${rowGapClass}`}>
			<div class={`${iconWrapClass} ${iconWrapClassByVariant[item.variant]}`}>
				<ToastIcon class={iconClass} />
			</div>
			<div class={bodyPaddingClass}>
				<div class={bodySpacingClass}>
					{#if item.title}
						<div class="flex items-baseline gap-2">
							<p class={titleClass}>{item.title}</p>
							{#if item.duplicateCount > 1}
								<span class={duplicateLabelClass}>{duplicateCountLabel}</span>
							{/if}
						</div>
					{/if}
					<p class={descriptionClass}>{item.description}</p>
				</div>
			</div>

			{#if item.dismissible}
				<button
					type="button"
					class={dismissButtonClass}
					aria-label={preview ? 'Preview dismiss button' : 'Dismiss notification'}
					disabled={preview}
					onclick={() => {
						if (!preview) {
							toast.dismiss(item.id);
						}
					}}
				>
					<IconX class={dismissIconClass} />
				</button>
			{/if}
		</div>

		{#if item.actions.length > 0}
			<div class={actionsWrapClass}>
				{#each item.actions as action}
					<button
						type="button"
						class={`${getActionClasses(item.variant, action)} disabled:cursor-wait disabled:opacity-65`}
						disabled={actionLoadingId.length > 0}
						onclick={() => void runAction(action)}
					>
						{#if actionLoadingId === (action.id ?? action.label)}
							<span class="inline-flex items-center gap-1">
								<IconLoader2 class={actionLoadingIconClass} />
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
		<div class={progressClass} style={`width:${progressWidth}%;`}></div>
	{/if}
</article>
