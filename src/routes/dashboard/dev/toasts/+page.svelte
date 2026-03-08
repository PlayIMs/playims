<svelte:head>
	<title>Toast Lab | PlayIMs</title>
</svelte:head>

<script lang="ts">
	import {
		IconBellRinging,
		IconBolt,
		IconChecklist,
		IconFlask,
		IconPlayerPlay,
		IconRefresh,
		IconSparkles,
		IconTrash,
		IconWand
	} from '@tabler/icons-svelte';
	import ToastItem from '$lib/components/toast/ToastItem.svelte';
	import {
		TOAST_DESKTOP_PLACEMENTS,
		TOAST_MOBILE_PLACEMENTS,
		TOAST_MOBILE_STACK_LIMIT,
		TOAST_STACK_LIMIT,
		toast,
		type ToastAction,
		type ToastActionStyle,
		type ToastDesktopPlacement,
		type ToastInput,
		type ToastMobilePlacement,
		type ToastRecord,
		type ToastVariant
	} from '$lib/toasts';

	type DurationMode = 'default' | 'custom' | 'persistent';
	type PreviewViewport = 'desktop' | 'mobile';
	type ActionBehavior =
		| 'dismiss'
		| 'success-followup'
		| 'info-followup'
		| 'warning-followup'
		| 'async-success'
		| 'async-error';
	type StressMode = 'unique' | 'collapse' | 'stack';

	interface ActionDraft {
		enabled: boolean;
		label: string;
		style: ToastActionStyle;
		dismissOnClick: boolean;
		behavior: ActionBehavior;
	}

	const PAGE_TITLE = 'Toast Lab';
	const defaultDurationByVariant: Record<ToastVariant, number | null> = {
		success: 4800,
		error: 7200,
		info: 5600,
		warning: 6400,
		loading: null
	};
	const variantOptions: ToastVariant[] = ['success', 'error', 'info', 'warning', 'loading'];
	const desktopPlacementOptions: Array<{
		value: ToastDesktopPlacement;
		label: string;
		description: string;
	}> = TOAST_DESKTOP_PLACEMENTS.map((value) => {
		const [vertical, horizontal] = value.split('-') as [string, string];
		return {
			value,
			label: `${vertical} ${horizontal}`,
			description: `${vertical} row, ${horizontal} aligned`
		};
	});
	const mobilePlacementOptions: Array<{
		value: ToastMobilePlacement;
		label: string;
		description: string;
	}> = TOAST_MOBILE_PLACEMENTS.map((value) => ({
		value,
		label: value,
		description: `${value} row, centered horizontally`
	}));
	const actionStyleOptions: ToastActionStyle[] = ['solid', 'outline'];
	const durationModes: DurationMode[] = ['default', 'custom', 'persistent'];
	const actionBehaviors: Array<{ value: ActionBehavior; label: string; description: string }> = [
		{
			value: 'dismiss',
			label: 'Dismiss only',
			description: 'Closes the toast without spawning any follow-up message.'
		},
		{
			value: 'success-followup',
			label: 'Success follow-up',
			description: 'Creates a second success toast when the action is clicked.'
		},
		{
			value: 'info-followup',
			label: 'Info follow-up',
			description: 'Creates a second informational toast.'
		},
		{
			value: 'warning-followup',
			label: 'Warning follow-up',
			description: 'Creates a warning toast for caution-style flows.'
		},
		{
			value: 'async-success',
			label: 'Async success',
			description: 'Waits briefly, then resolves with a success toast.'
		},
		{
			value: 'async-error',
			label: 'Async error',
			description: 'Waits briefly, then returns an error toast.'
		}
	];
	const stressModeOptions: Array<{ value: StressMode; label: string; description: string }> = [
		{
			value: 'unique',
			label: 'Unique',
			description: 'Every toast gets unique copy so you can inspect stack growth and queue behavior.'
		},
		{
			value: 'collapse',
			label: 'Deduplicate',
			description: 'Uses identical copy so the duplicate counter and timer reset behavior are easy to inspect.'
		},
		{
			value: 'stack',
			label: 'Force stack',
			description: 'Uses identical copy with duplicate bypass enabled so matching toasts still pile up.'
		}
	];
	const mobileStageAlignmentClassByPlacement: Record<ToastMobilePlacement, string> = {
		top: 'items-start',
		middle: 'items-center',
		bottom: 'items-end'
	};

	function createDefaultAction(
		label: string,
		style: ToastActionStyle,
		behavior: ActionBehavior
	): ActionDraft {
		return {
			enabled: false,
			label,
			style,
			dismissOnClick: true,
			behavior
		};
	}

	function wait(ms: number): Promise<void> {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	function formatMobilePreviewTime(timestamp: number): string {
		return new Intl.DateTimeFormat(undefined, {
			hour: 'numeric',
			minute: '2-digit'
		}).format(timestamp);
	}

	function parseIntegerInput(
		value: string,
		fallback: number,
		min: number,
		max: number
	): number {
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) {
			return fallback;
		}

		return Math.max(min, Math.min(max, Math.round(parsed)));
	}

	function getDurationValue(mode: DurationMode, customDurationMs: string): number | null | undefined {
		if (mode === 'default') return undefined;
		if (mode === 'persistent') return null;

		const parsed = Number(customDurationMs);
		return Number.isFinite(parsed) && parsed >= 1000 ? Math.round(parsed) : 5000;
	}

	function createActionHandler(
		draft: ActionDraft,
		index: number,
		label: string,
		followupDelayMs: number
	): ToastAction['onClick'] | undefined {
		switch (draft.behavior) {
			case 'dismiss':
				return undefined;
			case 'success-followup':
				return () => {
					toast.success(`${label} finished successfully.`, {
						title: `${PAGE_TITLE} Action ${index + 1}`
					});
				};
			case 'info-followup':
				return () => {
					toast.info(`${label} opened a secondary informational toast.`, {
						title: `${PAGE_TITLE} Action ${index + 1}`
					});
				};
			case 'warning-followup':
				return () => {
					toast.warning(`${label} raised a caution follow-up toast.`, {
						title: `${PAGE_TITLE} Action ${index + 1}`
					});
				};
			case 'async-success':
				return async () => {
					await wait(followupDelayMs);
					toast.success(`${label} completed after ${followupDelayMs}ms.`, {
						title: `${PAGE_TITLE} Action ${index + 1}`
					});
				};
			case 'async-error':
				return async () => {
					await wait(followupDelayMs);
					toast.error(`${label} failed after ${followupDelayMs}ms.`, {
						title: `${PAGE_TITLE} Action ${index + 1}`,
						duration: 6400
					});
				};
		}
	}

	let variant = $state<ToastVariant>('success');
	let placement = $state<ToastDesktopPlacement>('bottom-right');
	let mobilePlacement = $state<ToastMobilePlacement>('top');
	let title = $state('Offering saved');
	let description = $state('Your new offering is live and ready for schedule setup.');
	let previewViewport = $state<PreviewViewport>('desktop');
	let durationMode = $state<DurationMode>('default');
	let customDurationMs = $state('4800');
	let dismissible = $state(true);
	let showProgress = $state(true);
	let important = $state(false);
	let ignoreDuplicateStack = $state(false);
	let asyncDelayMs = $state('1800');
	let actionDrafts = $state<ActionDraft[]>([
		createDefaultAction('Undo', 'solid', 'success-followup'),
		createDefaultAction('Inspect', 'outline', 'info-followup')
	]);
	let stressCount = $state(String(TOAST_STACK_LIMIT + 3));
	let stressIntervalMs = $state('140');
	let stressMode = $state<StressMode>('unique');
	let stressClearFirst = $state(true);
	let stressIncludeActions = $state(false);
	let stressFinalImportant = $state(true);
	let stressRunning = $state(false);
	let mobileStageTotal = $state('1');
	let mobilePreviewNow = $state(Date.now());

	const mobileStageRequestedTotal = $derived.by(() =>
		parseIntegerInput(mobileStageTotal, TOAST_STACK_LIMIT + 1, 1, 12)
	);

	const mobileStageVisibleCount = $derived.by(() =>
		Math.min(mobileStageRequestedTotal, TOAST_MOBILE_STACK_LIMIT)
	);

	const previewActions = $derived.by(() =>
		actionDrafts
			.map((draft, index) => ({
				slot: index + 1,
				enabled: draft.enabled,
				label: draft.label.trim(),
				style: draft.style,
				dismissOnClick: draft.dismissOnClick,
				behavior: draft.behavior
			}))
			.filter((draft) => draft.enabled && draft.label.length > 0)
	);

	const previewToast = $derived.by<ToastRecord>(() => {
		const configuredDuration = getDurationValue(durationMode, customDurationMs);
		return {
			id: 'toast-lab-preview',
			variant,
			placement,
			mobilePlacement,
			title: title.trim(),
			description: description.trim() || 'Toast preview message',
			duration:
				configuredDuration === undefined ? defaultDurationByVariant[variant] : configuredDuration,
			dismissible,
			showProgress,
			important,
			actions: buildActions(),
			duplicateCount: 1,
			updatedAt: Date.now()
		};
	});

	const mobileStageVisibleToasts = $derived.by<ToastRecord[]>(() => {
		const total = mobileStageRequestedTotal;
		const visibleCount = mobileStageVisibleCount;
		const startingNumber = total - visibleCount + 1;
		const visible = Array.from({ length: visibleCount }, (_, index) => {
			const number = startingNumber + index;
			const isNewest = number === total;
			return {
				...previewToast,
				id: `mobile-stage-${number}`,
				title: previewToast.title ? `${previewToast.title} ${number}` : `Preview ${number}`,
				description: previewToast.description,
				actions: isNewest ? previewToast.actions : [],
				duplicateCount: 1,
				updatedAt: previewToast.updatedAt + number
			};
		});

		if (mobilePlacement === 'bottom') {
			return visible;
		}

		return [...visible].reverse();
	});

	const mobileStageOverflowCount = $derived.by(() =>
		Math.max(0, mobileStageRequestedTotal - TOAST_MOBILE_STACK_LIMIT)
	);

	const mobileStageOverflowAtTop = $derived.by(() => mobilePlacement !== 'bottom');
	const mobilePreviewTime = $derived.by(() => formatMobilePreviewTime(mobilePreviewNow));

	$effect(() => {
		const tick = () => {
			mobilePreviewNow = Date.now();
		};

		tick();
		const interval = setInterval(tick, 30_000);
		return () => {
			clearInterval(interval);
		};
	});

	function updateAction(
		index: number,
		patch: Partial<ActionDraft> | ((draft: ActionDraft) => ActionDraft)
	): void {
		const nextDrafts = [...actionDrafts];
		const current = nextDrafts[index];
		nextDrafts[index] =
			typeof patch === 'function'
				? patch(current)
				: {
						...current,
						...patch
					};
		actionDrafts = nextDrafts;
	}

	function buildActions(): ToastAction[] {
		const delay = Math.max(250, Number(asyncDelayMs) || 1800);
		return actionDrafts.flatMap((draft, index) => {
			const label = draft.label.trim();
			if (!draft.enabled || label.length === 0) return [];

			return [
				{
					id: `lab-toast-action-${index + 1}`,
					label,
					style: draft.style,
					dismissOnClick: draft.dismissOnClick,
					onClick: createActionHandler(draft, index, label, delay)
				}
			];
		});
	}

	function buildToastInput(
		overrides: Partial<ToastInput> = {},
		forceVariant: ToastVariant | null = null
	): ToastInput {
		const baseVariant = forceVariant ?? variant;
		return {
			variant: baseVariant,
			placement,
			mobilePlacement,
			title: title.trim() || undefined,
			description: description.trim() || 'Toast preview message',
			duration: getDurationValue(durationMode, customDurationMs),
			dismissible,
			showProgress,
			important,
			ignoreDuplicateStack,
			actions: buildActions(),
			...overrides
		};
	}

	async function runStressScenario(options?: {
		count?: number;
		intervalMs?: number;
		mode?: StressMode;
		clearFirst?: boolean;
		includeActions?: boolean;
		finalImportant?: boolean;
	}): Promise<void> {
		if (stressRunning) {
			return;
		}

		stressRunning = true;
		try {
			const count =
				options?.count ?? parseIntegerInput(stressCount, TOAST_STACK_LIMIT + 3, 1, 24);
			const intervalMs =
				options?.intervalMs ?? parseIntegerInput(stressIntervalMs, 140, 0, 5000);
			const mode = options?.mode ?? stressMode;
			const clearFirst = options?.clearFirst ?? stressClearFirst;
			const includeActions = options?.includeActions ?? stressIncludeActions;
			const finalImportant = options?.finalImportant ?? stressFinalImportant;

			if (clearFirst) {
				toast.dismissAll();
				await wait(120);
			}

			for (let index = 0; index < count; index += 1) {
				const sequence = index + 1;
				const isFinalToast = sequence === count;
				const isUnique = mode === 'unique';
				toast.show(
					buildToastInput({
						title: isUnique
							? `${title.trim() || 'Stress Test'} ${sequence}`
							: title.trim() || 'Stress Test Toast',
						description: isUnique
							? `${description.trim() || 'Toast preview message'} Wave ${sequence} of ${count}.`
							: description.trim() || 'Toast preview message',
						actions: includeActions ? buildActions() : [],
						important: finalImportant && isFinalToast ? true : important,
						ignoreDuplicateStack: mode === 'stack'
					})
				);

				if (intervalMs > 0 && sequence < count) {
					await wait(intervalMs);
				}
			}
		} finally {
			stressRunning = false;
		}
	}

	function showToast(): void {
		toast.show(buildToastInput());
	}

	function clearToasts(): void {
		toast.dismissAll();
	}

	function applyPreset(preset: 'success' | 'error' | 'warning' | 'loading'): void {
		switch (preset) {
			case 'success':
				variant = 'success';
				title = 'Facility saved';
				description = 'The facility and all area updates were saved successfully.';
				durationMode = 'default';
				customDurationMs = '4800';
				dismissible = true;
				showProgress = true;
				important = false;
				ignoreDuplicateStack = false;
				actionDrafts = [
					{
						enabled: true,
						label: 'View schedule',
						style: 'solid',
						dismissOnClick: true,
						behavior: 'info-followup'
					},
					createDefaultAction('Inspect', 'outline', 'info-followup')
				];
				break;
			case 'error':
				variant = 'error';
				title = 'Season update failed';
				description = 'The season could not be updated because another record changed first.';
				durationMode = 'persistent';
				customDurationMs = '6400';
				dismissible = true;
				showProgress = false;
				important = true;
				ignoreDuplicateStack = false;
				actionDrafts = [
					{
						enabled: true,
						label: 'Retry',
						style: 'solid',
						dismissOnClick: false,
						behavior: 'async-success'
					},
					{
						enabled: true,
						label: 'Dismiss',
						style: 'outline',
						dismissOnClick: true,
						behavior: 'dismiss'
					}
				];
				break;
			case 'warning':
				variant = 'warning';
				title = 'Archived facility found';
				description = 'A matching archived facility already exists. Restore it instead?';
				durationMode = 'persistent';
				customDurationMs = '6400';
				dismissible = true;
				showProgress = false;
				important = false;
				ignoreDuplicateStack = false;
				actionDrafts = [
					{
						enabled: true,
						label: 'Restore',
						style: 'solid',
						dismissOnClick: true,
						behavior: 'success-followup'
					},
					{
						enabled: true,
						label: 'Delete',
						style: 'outline',
						dismissOnClick: true,
						behavior: 'warning-followup'
					}
				];
				break;
			case 'loading':
				variant = 'loading';
				title = 'Publishing schedule';
				description = 'Games are being generated and assigned to facilities.';
				durationMode = 'persistent';
				customDurationMs = '5200';
				dismissible = false;
				showProgress = false;
				important = false;
				ignoreDuplicateStack = false;
				actionDrafts = [
					createDefaultAction('Cancel', 'outline', 'dismiss'),
					createDefaultAction('Inspect', 'outline', 'info-followup')
				];
				break;
		}
	}
</script>

<div class="space-y-6">
	<section class="border-2 border-neutral-950 bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div class="flex items-start gap-3">
					<div
						class="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-secondary-300 bg-secondary text-white"
					>
						<IconFlask class="h-6 w-6" />
					</div>
					<div class="space-y-2">
						<p class="text-xs font-bold uppercase tracking-[0.16em] text-secondary-700">
							Temporary Route
						</p>
						<h1 class="font-serif text-3xl leading-none text-secondary-900">Toast Lab</h1>
						<p class="max-w-3xl text-sm leading-6 text-secondary-800">
							Test every major toast behavior without pushing the rest of the UI around.
							Use this page to tune timing, titles, actions, loading flows, and persistent
							error handling before we wire additional patterns into production screens.
						</p>
					</div>
				</div>

			</div>
		</div>

		<div class="grid gap-3 border-b border-neutral-950 bg-neutral-100/70 p-4 md:grid-cols-2 xl:grid-cols-4">
			<button
				type="button"
				class="button-secondary-outlined inline-flex cursor-pointer items-center justify-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em]"
				onclick={() => applyPreset('success')}
			>
				<IconSparkles class="h-4 w-4" />
				Success Preset
			</button>
			<button
				type="button"
				class="button-secondary-outlined inline-flex cursor-pointer items-center justify-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em]"
				onclick={() => applyPreset('error')}
			>
				<IconRefresh class="h-4 w-4" />
				Error Preset
			</button>
			<button
				type="button"
				class="button-secondary-outlined inline-flex cursor-pointer items-center justify-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em]"
				onclick={() => applyPreset('warning')}
			>
				<IconBellRinging class="h-4 w-4" />
				Warning Preset
			</button>
			<button
				type="button"
				class="button-secondary-outlined inline-flex cursor-pointer items-center justify-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em]"
				onclick={() => applyPreset('loading')}
			>
				<IconBolt class="h-4 w-4" />
				Loading Preset
			</button>
		</div>

		<div class="grid gap-6 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
			<div class="space-y-6">
				<section class="border border-neutral-950 bg-white/80">
					<div class="border-b border-neutral-950 bg-secondary-50 px-4 py-3">
						<div class="flex items-center gap-2">
							<IconWand class="h-5 w-5 text-secondary-800" />
							<h2 class="font-serif text-xl text-secondary-900">Composer</h2>
						</div>
					</div>

					<div class="grid gap-4 p-4 md:grid-cols-2">
						<div class="space-y-1 md:col-span-2">
							<label class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700" for="toast-title">
								Title
							</label>
							<input
								id="toast-title"
								class="input-secondary w-full"
								bind:value={title}
								placeholder="Facility saved"
							/>
						</div>

						<div class="space-y-1 md:col-span-2">
							<label
								class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700"
								for="toast-description"
							>
								Description
							</label>
							<textarea
								id="toast-description"
								class="textarea-secondary min-h-28 w-full"
								bind:value={description}
								placeholder="Describe what happened."
							></textarea>
						</div>

						<div class="space-y-2 md:col-span-2">
							<p class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700">Variant</p>
							<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
								{#each variantOptions as option}
									<label
										class={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm font-semibold uppercase tracking-[0.08em] ${
											variant === option
												? 'border-secondary-900 bg-secondary text-white'
												: 'border-secondary-300 bg-white text-secondary-900'
										}`}
									>
										<input
											class="radio-secondary sr-only"
											type="radio"
											name="toast-variant"
											value={option}
											checked={variant === option}
											onchange={() => (variant = option)}
										/>
										<span>{option}</span>
									</label>
								{/each}
							</div>
						</div>

						<div class="space-y-2 md:col-span-2">
							<div class="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.85fr)]">
								<div class="space-y-2">
									<p class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700">
										Desktop Placement
									</p>
									<div class="grid gap-2 sm:grid-cols-3">
										{#each desktopPlacementOptions as option}
											<label
												class={`flex cursor-pointer flex-col gap-1 border px-3 py-3 text-left ${
													placement === option.value
														? 'border-secondary-900 bg-secondary text-white'
														: 'border-secondary-300 bg-white text-secondary-900'
												}`}
											>
												<input
													class="radio-secondary sr-only"
													type="radio"
													name="toast-placement"
													value={option.value}
													checked={placement === option.value}
													onchange={() => (placement = option.value)}
												/>
												<span class="text-sm font-semibold uppercase tracking-[0.08em]">
													{option.label}
												</span>
												<span
													class={`text-xs ${
														placement === option.value
															? 'text-white/85'
															: 'text-secondary-700'
													}`}
												>
													{option.description}
												</span>
											</label>
										{/each}
									</div>
								</div>

								<div class="space-y-2">
									<p class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700">
										Mobile Placement
									</p>
									<div class="space-y-2">
										{#each mobilePlacementOptions as option}
											<label
												class={`flex cursor-pointer flex-col gap-1 border px-3 py-3 text-left ${
													mobilePlacement === option.value
														? 'border-secondary-900 bg-secondary text-white'
														: 'border-secondary-300 bg-white text-secondary-900'
												}`}
											>
												<input
													class="radio-secondary sr-only"
													type="radio"
													name="toast-mobile-placement"
													value={option.value}
													checked={mobilePlacement === option.value}
													onchange={() => (mobilePlacement = option.value)}
												/>
												<span class="text-sm font-semibold uppercase tracking-[0.08em]">
													{option.label}
												</span>
												<span
													class={`text-xs ${
														mobilePlacement === option.value
															? 'text-white/85'
															: 'text-secondary-700'
													}`}
												>
													{option.description}
												</span>
											</label>
										{/each}
									</div>
								</div>
							</div>
						</div>

						<div class="space-y-2 md:col-span-2">
							<p class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700">Duration Mode</p>
							<div class="grid gap-2 sm:grid-cols-3">
								{#each durationModes as option}
									<label
										class={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm font-semibold uppercase tracking-[0.08em] ${
											durationMode === option
												? 'border-secondary-900 bg-secondary text-white'
												: 'border-secondary-300 bg-white text-secondary-900'
										}`}
									>
										<input
											class="radio-secondary sr-only"
											type="radio"
											name="toast-duration-mode"
											value={option}
											checked={durationMode === option}
											onchange={() => (durationMode = option)}
										/>
										<span>{option}</span>
									</label>
								{/each}
							</div>
						</div>

						<div class="space-y-1">
							<label
								class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700"
								for="custom-duration"
							>
								Custom Duration (ms)
							</label>
							<input
								id="custom-duration"
								type="number"
								min="1000"
								step="100"
								class="input-secondary w-full disabled:cursor-not-allowed disabled:opacity-55"
								bind:value={customDurationMs}
								disabled={durationMode !== 'custom'}
							/>
						</div>

						<div class="space-y-1">
							<label
								class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700"
								for="async-delay"
							>
								Async Delay (ms)
							</label>
							<input
								id="async-delay"
								type="number"
								min="250"
								step="250"
								class="input-secondary w-full"
								bind:value={asyncDelayMs}
							/>
							<p class="text-xs text-secondary-700">
								Used by async action buttons so you can test delayed follow-up behavior.
							</p>
						</div>

						<div class="grid gap-3 md:col-span-2 sm:grid-cols-2 xl:grid-cols-3">
							<label class="flex items-start gap-3 border border-secondary-300 bg-secondary-50 px-3 py-3">
								<input class="checkbox-secondary mt-1" type="checkbox" bind:checked={dismissible} />
								<span>
									<span class="block text-sm font-semibold text-secondary-950">Dismissible</span>
									<span class="block text-xs text-secondary-700">Show the close button.</span>
								</span>
							</label>
							<label class="flex items-start gap-3 border border-secondary-300 bg-secondary-50 px-3 py-3">
								<input class="checkbox-secondary mt-1" type="checkbox" bind:checked={showProgress} />
								<span>
									<span class="block text-sm font-semibold text-secondary-950">Progress Bar</span>
									<span class="block text-xs text-secondary-700">Show remaining time visually.</span>
								</span>
							</label>
							<label class="flex items-start gap-3 border border-secondary-300 bg-secondary-50 px-3 py-3">
								<input class="checkbox-secondary mt-1" type="checkbox" bind:checked={important} />
								<span>
									<span class="block text-sm font-semibold text-secondary-950">Important</span>
									<span class="block text-xs text-secondary-700">Uses assertive live-region behavior.</span>
								</span>
							</label>
							<label class="flex items-start gap-3 border border-secondary-300 bg-secondary-50 px-3 py-3">
								<input
									class="checkbox-secondary mt-1"
									type="checkbox"
									bind:checked={ignoreDuplicateStack}
								/>
								<span>
									<span class="block text-sm font-semibold text-secondary-950">Ignore Duplicate Stack</span>
									<span class="block text-xs text-secondary-700">Allows identical toasts to stack instead of merging.</span>
								</span>
							</label>
						</div>
					</div>
				</section>

				<section class="border border-neutral-950 bg-white/80">
					<div class="border-b border-neutral-950 bg-secondary-50 px-4 py-3">
						<div class="flex items-center gap-2">
							<IconChecklist class="h-5 w-5 text-secondary-800" />
							<h2 class="font-serif text-xl text-secondary-900">Toast Actions</h2>
						</div>
					</div>

					<div class="grid gap-4 p-4 xl:grid-cols-2">
						{#each actionDrafts as draft, index}
							<div class="space-y-3 border border-neutral-950 bg-neutral-50 p-4">
								<div class="flex items-start justify-between gap-3">
									<div>
										<p class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700">
											Action {index + 1}
										</p>
										<p class="mt-1 text-sm text-secondary-800">
											Optional button shown inside the toast.
										</p>
									</div>
									<label class="flex items-center gap-2 text-sm font-semibold text-secondary-900">
										<input
											class="checkbox-secondary"
											type="checkbox"
											checked={draft.enabled}
											onchange={() => updateAction(index, { enabled: !draft.enabled })}
										/>
										Enable
									</label>
								</div>

								<div class="space-y-1">
									<label
										class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700"
										for={`action-label-${index}`}
									>
										Label
									</label>
									<input
										id={`action-label-${index}`}
										class="input-secondary w-full"
										value={draft.label}
										oninput={(event) =>
											updateAction(index, {
												label: (event.currentTarget as HTMLInputElement).value
											})}
									/>
								</div>

								<div class="space-y-2">
									<p class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700">
										Style
									</p>
									<div class="grid gap-2 sm:grid-cols-2">
										{#each actionStyleOptions as style}
											<label
												class={`flex cursor-pointer items-center justify-center border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] ${
													draft.style === style
														? 'border-secondary-900 bg-secondary text-white'
														: 'border-secondary-300 bg-white text-secondary-900'
												}`}
											>
												<input
													class="radio-secondary sr-only"
													type="radio"
													name={`action-style-${index}`}
													value={style}
													checked={draft.style === style}
													onchange={() => updateAction(index, { style })}
												/>
												<span>{style}</span>
											</label>
										{/each}
									</div>
								</div>

								<div class="space-y-2">
									<p class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700">
										Behavior
									</p>
									<div class="space-y-2">
										{#each actionBehaviors as behavior}
											<label class="flex cursor-pointer gap-3 border border-secondary-300 bg-white px-3 py-3">
												<input
													class="radio-secondary mt-1"
													type="radio"
													name={`action-behavior-${index}`}
													value={behavior.value}
													checked={draft.behavior === behavior.value}
													onchange={() => updateAction(index, { behavior: behavior.value })}
												/>
												<span>
													<span class="block text-sm font-semibold text-secondary-950">
														{behavior.label}
													</span>
													<span class="block text-xs text-secondary-700">
														{behavior.description}
													</span>
												</span>
											</label>
										{/each}
									</div>
								</div>

								<label class="flex items-start gap-3 border border-secondary-300 bg-secondary-50 px-3 py-3">
									<input
										class="checkbox-secondary mt-1"
										type="checkbox"
										checked={draft.dismissOnClick}
										onchange={() =>
											updateAction(index, {
												dismissOnClick: !draft.dismissOnClick
											})}
									/>
									<span>
										<span class="block text-sm font-semibold text-secondary-950">
											Dismiss after click
										</span>
										<span class="block text-xs text-secondary-700">
											Turn this off if you want the original toast to stay visible.
										</span>
									</span>
								</label>
							</div>
						{/each}
					</div>
				</section>
			</div>

			<div class="space-y-6">
				<section class="border border-neutral-950 bg-white/80">
					<div class="border-b border-neutral-950 bg-secondary-50 px-4 py-3">
						<div class="flex items-center gap-2">
							<IconPlayerPlay class="h-5 w-5 text-secondary-800" />
							<h2 class="font-serif text-xl text-secondary-900">Trigger Tests</h2>
						</div>
					</div>

					<div class="flex flex-wrap gap-3 p-4">
						<button
							type="button"
							class="button-primary inline-flex cursor-pointer items-center justify-center gap-2 px-4 py-3"
							onclick={showToast}
						>
							<IconBellRinging class="h-4 w-4" />
							Demo Toast
						</button>
						<button
							type="button"
							class="button-primary-outlined inline-flex cursor-pointer items-center justify-center gap-2 px-4 py-3"
							onclick={clearToasts}
						>
							<IconTrash class="h-4 w-4" />
							Clear All Toasts
						</button>
					</div>
				</section>

				<section class="border border-neutral-950 bg-white/80">
					<div class="border-b border-neutral-950 bg-secondary-50 px-4 py-3">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<h2 class="font-serif text-xl text-secondary-900">Live Toast Preview</h2>
							<div class="inline-flex border border-secondary-300 bg-white">
								<button
									type="button"
									class={`px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
										previewViewport === 'desktop'
											? 'bg-secondary text-white'
											: 'bg-white text-secondary-900'
									}`}
									onclick={() => (previewViewport = 'desktop')}
								>
									Desktop
								</button>
								<button
									type="button"
									class={`border-l border-secondary-300 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
										previewViewport === 'mobile'
											? 'bg-secondary text-white'
											: 'bg-white text-secondary-900'
									}`}
									onclick={() => (previewViewport = 'mobile')}
								>
									Mobile
								</button>
							</div>
						</div>
					</div>

					<div class="space-y-3 p-4">
						{#if previewViewport === 'desktop'}
							<div class="border border-neutral-950 bg-neutral-100/70 p-4">
								<div class="rounded-sm border border-dashed border-neutral-950 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(245,245,244,0.9))] p-5">
									<div class="mx-auto w-full max-w-[26rem]">
										<ToastItem item={previewToast} index={0} preview={true} />
									</div>
								</div>
							</div>
						{:else}
							<div class="space-y-4">
								<div class="grid gap-3 sm:grid-cols-[auto_auto] sm:justify-end">
									<div class="border border-neutral-950 bg-white px-3 py-2 text-xs text-secondary-800">
										<span class="font-bold uppercase tracking-[0.12em] text-secondary-700">Visible:</span>
										<span class="ml-1">{mobileStageVisibleCount}</span>
									</div>
									<div class="border border-neutral-950 bg-white px-3 py-2 text-xs text-secondary-800">
										<span class="font-bold uppercase tracking-[0.12em] text-secondary-700">Queued:</span>
										<span class="ml-1">{mobileStageOverflowCount}</span>
									</div>
								</div>

								<div class="overflow-hidden border border-neutral-950 bg-[linear-gradient(180deg,rgba(20,33,61,0.06),rgba(255,255,255,0.96))] p-4">
									<div class="mx-auto w-full max-w-[18.8rem]">
										<div class="rounded-[2.45rem] bg-black p-[0.2rem] shadow-[0_22px_48px_rgba(15,23,42,0.24)]">
											<div class="relative overflow-hidden rounded-[2.25rem] bg-white">
												<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(20,33,61,0.16)_1px,transparent_1.2px)] [background-position:0_0] [background-size:8px_8px] opacity-25"></div>
												<div class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-center pt-2">
													<div class="flex h-7 w-32 items-center justify-center rounded-b-[1.1rem] bg-black">
														<div class="flex items-center gap-2">
															<div class="h-1 w-10 rounded-full bg-white/90"></div>
															<div class="h-2 w-2 rounded-full bg-white/85"></div>
														</div>
													</div>
												</div>
												<div class="relative flex h-[38rem] flex-col px-4 pb-4 pt-3">
													<div class="flex items-center justify-between px-2 pt-1 text-[0.62rem] font-bold text-neutral-950">
														<span>{mobilePreviewTime}</span>
														<div class="flex items-center gap-1.5 text-neutral-950">
															<span class="h-1.5 w-1.5 rounded-full bg-current opacity-90"></span>
															<span class="h-1.5 w-1.5 rounded-full bg-current opacity-75"></span>
															<span class="h-1.5 w-4 rounded-[2px] bg-current opacity-85"></span>
														</div>
													</div>
													<div class="mt-8 h-full overflow-hidden">
														<div class={`flex h-full ${mobileStageAlignmentClassByPlacement[mobilePlacement]}`}>
															<div class="w-full overflow-hidden">
																<div class="mx-auto flex max-w-[15rem] flex-col gap-2.5">
																	{#if mobileStageOverflowCount > 0 && mobileStageOverflowAtTop}
																		<div class="border border-neutral-950 bg-neutral-05/95 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-900 shadow-[0_10px_24px_rgba(20,33,61,0.16)] backdrop-blur">
																			{mobileStageOverflowCount} more notification{mobileStageOverflowCount === 1 ? '' : 's'}
																		</div>
																	{/if}

																	{#each mobileStageVisibleToasts as item, index (item.id)}
																		<ToastItem
																			{item}
																			{index}
																			preview={true}
																			forceMobileLayout={true}
																		/>
																	{/each}

																	{#if mobileStageOverflowCount > 0 && !mobileStageOverflowAtTop}
																		<div class="border border-neutral-950 bg-neutral-05/95 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-900 shadow-[0_10px_24px_rgba(20,33,61,0.16)] backdrop-blur">
																			{mobileStageOverflowCount} more notification{mobileStageOverflowCount === 1 ? '' : 's'}
																		</div>
																	{/if}
																</div>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>

								<div class="space-y-1">
									<label
										class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700"
										for="mobile-stage-total"
									>
										Total Mobile Toasts
									</label>
									<input
										id="mobile-stage-total"
										type="number"
										min="1"
										max="12"
										step="1"
										class="input-secondary w-full"
										bind:value={mobileStageTotal}
									/>
								</div>
							</div>
						{/if}

						<div class="border border-neutral-950 bg-white">
							<div class="border-b border-neutral-950 bg-neutral-100 px-3 py-2">
								<p class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700">
									Action Preview
								</p>
							</div>
							{#if previewActions.length > 0}
								<div class="divide-y divide-neutral-950">
									{#each previewActions as action}
										<div class="grid gap-2 px-3 py-3 text-sm text-secondary-900 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center">
											<p class="font-bold uppercase tracking-[0.12em] text-secondary-700">
												Action {action.slot}
											</p>
											<p>{action.label}</p>
											<p class="font-mono text-xs uppercase text-secondary-700">{action.style}</p>
											<p class="font-mono text-xs uppercase text-secondary-700">
												{action.behavior}
											</p>
										</div>
									{/each}
								</div>
							{:else}
								<p class="px-3 py-3 text-sm text-secondary-700">No actions enabled.</p>
							{/if}
						</div>

						<div class="grid gap-2 text-xs text-secondary-800 sm:grid-cols-2 xl:grid-cols-4">
							<div class="border border-neutral-950 bg-white px-3 py-2">
								<span class="font-bold uppercase tracking-[0.12em] text-secondary-700">Duration:</span>
								<span class="ml-1">
									{durationMode === 'default'
										? 'Shared default'
										: durationMode === 'persistent'
											? 'Persistent'
											: `${getDurationValue(durationMode, customDurationMs)}ms`}
								</span>
							</div>
							<div class="border border-neutral-950 bg-white px-3 py-2">
								<span class="font-bold uppercase tracking-[0.12em] text-secondary-700">
									Desktop:
								</span>
								<span class="ml-1 uppercase">{placement.replace('-', ' ')}</span>
							</div>
							<div class="border border-neutral-950 bg-white px-3 py-2">
								<span class="font-bold uppercase tracking-[0.12em] text-secondary-700">
									Mobile:
								</span>
								<span class="ml-1 uppercase">{mobilePlacement}</span>
							</div>
							<div class="border border-neutral-950 bg-white px-3 py-2">
								<span class="font-bold uppercase tracking-[0.12em] text-secondary-700">Importance:</span>
								<span class="ml-1">{important ? 'Assertive' : 'Polite'}</span>
							</div>
						</div>
					</div>
				</section>

				<section class="border border-neutral-950 bg-white/80">
					<div class="border-b border-neutral-950 bg-secondary-50 px-4 py-3">
						<div class="flex items-center gap-2">
							<IconBolt class="h-5 w-5 text-secondary-800" />
							<h2 class="font-serif text-xl text-secondary-900">Stack Stress Tests</h2>
						</div>
					</div>
					<div class="space-y-4 p-4">
						<p class="text-sm leading-6 text-secondary-800">
							Fire multiple live toasts through the real shared toaster to inspect stacking,
							queueing, duplicate merging, and important-toast replacement.
						</p>

						<div class="grid gap-3 sm:grid-cols-2">
							<div class="space-y-1">
								<label
									class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700"
									for="stress-count"
								>
									Toast Count
								</label>
								<input
									id="stress-count"
									type="number"
									min="1"
									max="24"
									step="1"
									class="input-secondary w-full"
									bind:value={stressCount}
								/>
							</div>
							<div class="space-y-1">
								<label
									class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700"
									for="stress-interval"
								>
									Interval (ms)
								</label>
								<input
									id="stress-interval"
									type="number"
									min="0"
									max="5000"
									step="20"
									class="input-secondary w-full"
									bind:value={stressIntervalMs}
								/>
							</div>
						</div>

						<div class="space-y-2">
							<p class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700">
								Stress Mode
							</p>
							<div class="grid gap-2 sm:grid-cols-3">
								{#each stressModeOptions as option}
									<label
										class={`flex cursor-pointer flex-col gap-1 border px-3 py-3 ${
											stressMode === option.value
												? 'border-secondary-900 bg-secondary text-white'
												: 'border-secondary-300 bg-white text-secondary-900'
										}`}
									>
										<input
											class="radio-secondary sr-only"
											type="radio"
											name="stress-mode"
											value={option.value}
											checked={stressMode === option.value}
											onchange={() => (stressMode = option.value)}
										/>
										<span class="text-sm font-semibold uppercase tracking-[0.08em]">
											{option.label}
										</span>
										<span
											class={`text-xs leading-5 ${
												stressMode === option.value ? 'text-white/85' : 'text-secondary-700'
											}`}
										>
											{option.description}
										</span>
									</label>
								{/each}
							</div>
						</div>

						<div class="grid gap-2 sm:grid-cols-3">
							<label class="flex items-start gap-3 border border-secondary-300 bg-secondary-50 px-3 py-3">
								<input class="checkbox-secondary mt-1" type="checkbox" bind:checked={stressClearFirst} />
								<span>
									<span class="block text-sm font-semibold text-secondary-950">Clear first</span>
									<span class="block text-xs text-secondary-700">Start from an empty stack.</span>
								</span>
							</label>
							<label class="flex items-start gap-3 border border-secondary-300 bg-secondary-50 px-3 py-3">
								<input
									class="checkbox-secondary mt-1"
									type="checkbox"
									bind:checked={stressIncludeActions}
								/>
								<span>
									<span class="block text-sm font-semibold text-secondary-950">Include actions</span>
									<span class="block text-xs text-secondary-700">Test taller toasts too.</span>
								</span>
							</label>
							<label class="flex items-start gap-3 border border-secondary-300 bg-secondary-50 px-3 py-3">
								<input
									class="checkbox-secondary mt-1"
									type="checkbox"
									bind:checked={stressFinalImportant}
								/>
								<span>
									<span class="block text-sm font-semibold text-secondary-950">Last one important</span>
									<span class="block text-xs text-secondary-700">Force replacement when full.</span>
								</span>
							</label>
						</div>

						<button
							type="button"
							class="button-primary inline-flex w-full cursor-pointer items-center justify-center gap-2 px-4 py-3 disabled:cursor-wait disabled:opacity-60"
							disabled={stressRunning}
							onclick={() => void runStressScenario()}
						>
							<IconBolt class="h-4 w-4" />
							{stressRunning ? 'Running...' : 'Run Stress Test'}
						</button>
					</div>
				</section>
			</div>
		</div>
	</section>
</div>

