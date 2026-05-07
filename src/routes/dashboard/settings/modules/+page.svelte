<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import {
		IconAlertTriangle,
		IconBallAmericanFootball,
		IconBuilding,
		IconCalendarWeek,
		IconChartBar,
		IconChevronDown,
		IconChevronUp,
		IconCreditCard,
		IconDeviceFloppy,
		IconFileText,
		IconLayoutDashboard,
		IconMessageCircle,
		IconSettings,
		IconShoppingCart,
		IconRestore,
		IconTrophy,
		IconUserCog
	} from '@tabler/icons-svelte';
	import {
		mergeDashboardNavigationConfig,
		getDefaultDashboardNavigationLabels,
		getDefaultDashboardNavigationOrder,
		mergeDashboardNavigationOrder,
		normalizeDashboardNavigationLabel,
		orderDashboardNavigationItems,
		type DashboardNavKey,
		type DashboardNavigationOrder,
		type DashboardNavigationLabels
	} from '$lib/dashboard/navigation';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import { toast } from '$lib/toasts';
	import { countDirtyNavigationLabels, getNavigationEditorRows } from './modules-page-state';
	import type { PageProps } from './$types';

	type SaveNavigationFailure = {
		action?: string;
		error?: string;
		fieldErrors?: Partial<Record<DashboardNavKey, string>>;
	};

	type SaveNavigationSuccess = {
		action?: string;
		success?: string;
		navigationLabels?: DashboardNavigationLabels;
		navigationOrder?: DashboardNavigationOrder;
	};

	type SaveNavigationOrderFailure = {
		action?: string;
		error?: string;
	};

	type SaveNavigationOrderSuccess = {
		action?: string;
		success?: string;
		navigationLabels?: DashboardNavigationLabels;
		navigationOrder?: DashboardNavigationOrder;
	};

	const NAVIGATION_LABELS_UPDATED_EVENT = 'playims:navigation-labels-updated';
	let { data }: PageProps = $props();

	const cloneLabels = (value: DashboardNavigationLabels): DashboardNavigationLabels => ({
		...value
	});
	const cloneOrder = (value: DashboardNavigationOrder): DashboardNavigationOrder => [...value];
	const resolveDataConfig = () =>
		mergeDashboardNavigationConfig({
			labels: data?.navigationLabels ?? getDefaultDashboardNavigationLabels(),
			order: data?.navigationOrder ?? getDefaultDashboardNavigationOrder()
		});
	const initialConfig = resolveDataConfig();
	const serializeNavigationConfig = (value: {
		labels: DashboardNavigationLabels;
		order: DashboardNavigationOrder;
	}): string => JSON.stringify(value);

	let labels = $state<DashboardNavigationLabels>(cloneLabels(initialConfig.labels));
	let order = $state<DashboardNavigationOrder>(cloneOrder(initialConfig.order));
	let initialLabels = $state<DashboardNavigationLabels>(cloneLabels(initialConfig.labels));
	let initialOrder = $state<DashboardNavigationOrder>(cloneOrder(initialConfig.order));
	let lastSyncedConfigSignature = $state(serializeNavigationConfig(initialConfig));
	let lastServerConfigSignature = $state(serializeNavigationConfig(initialConfig));
	let saveSubmitting = $state(false);
	let saveError = $state('');
	let saveSuccess = $state('');
	let fieldErrors = $state<Partial<Record<DashboardNavKey, string>>>({});
	let saveNavigationForm = $state<HTMLFormElement | null>(null);
	let saveTabKeySubmitting = $state<DashboardNavKey | null>(null);
	let orderSaveSubmitting = $state(false);
	let saveNavigationOrderForm = $state<HTMLFormElement | null>(null);
	let orderRollbackSnapshot = $state<DashboardNavigationOrder | null>(null);
	let lastFeedbackSignature = $state('');
	let readOnlyToastShown = $state(false);
	let moduleSearch = $state('');

	const canEditNavigation = $derived.by(() => data.canEditNavigation === true);
	const maxLabelLength = $derived.by(() => data.maxLabelLength ?? 25);
	const orderedNavItems = $derived.by(() => orderDashboardNavigationItems(order));
	const editorRows = $derived.by(() =>
		getNavigationEditorRows({
			order,
			labels,
			initialLabels,
			query: moduleSearch
		})
	);
	const dirtyLabelCount = $derived.by(() => countDirtyNavigationLabels(labels, initialLabels));
	const orderChanged = $derived.by(() => JSON.stringify(order) !== JSON.stringify(initialOrder));
	const defaultOrderChanged = $derived.by(
		() => JSON.stringify(order) !== JSON.stringify(getDefaultDashboardNavigationOrder())
	);
	const hasDefaultDifferences = $derived.by(
		() =>
			Object.entries(labels).some(
				([key, label]) => label !== getDefaultDashboardNavigationLabels()[key as DashboardNavKey]
			) || defaultOrderChanged
	);
	const hasUnsavedChanges = $derived.by(
		() =>
			JSON.stringify(labels) !== JSON.stringify(initialLabels) ||
			JSON.stringify(order) !== JSON.stringify(initialOrder)
	);
	const labelsJson = $derived.by(() => JSON.stringify(labels));
	const orderJson = $derived.by(() => JSON.stringify(order));
	const orderOnlyJson = $derived.by(() => JSON.stringify(order));
	const moduleSearchActive = $derived.by(() => moduleSearch.trim().length > 0);

	$effect(() => {
		if (!canEditNavigation) {
			if (readOnlyToastShown) {
				return;
			}

			readOnlyToastShown = true;
			toast.warning(
				'You are in read-only mode. Switch to a manager or admin role to edit module labels and order.',
				{
					id: 'settings-modules-read-only',
					title: 'Module settings',
					duration: null,
					showProgress: false
				}
			);
			return;
		}

		readOnlyToastShown = false;
	});

	$effect(() => {
		const feedback = saveError.trim() || saveSuccess.trim();
		if (!feedback) {
			lastFeedbackSignature = '';
			return;
		}

		const variant = saveError.trim() ? 'error' : 'success';
		const signature = `${variant}:${feedback}`;
		if (signature === lastFeedbackSignature) {
			return;
		}

		lastFeedbackSignature = signature;
		toast[variant](feedback, {
			id: 'settings-modules-feedback',
			title: 'Module settings'
		});
	});

	$effect(() => {
		const latest = resolveDataConfig();
		const latestSignature = serializeNavigationConfig(latest);
		if (latestSignature === lastServerConfigSignature) {
			return;
		}
		lastServerConfigSignature = latestSignature;
		if (hasUnsavedChanges || saveSubmitting || orderSaveSubmitting) {
			return;
		}

		labels = cloneLabels(latest.labels);
		order = cloneOrder(latest.order);
		initialLabels = cloneLabels(latest.labels);
		initialOrder = cloneOrder(latest.order);
		lastSyncedConfigSignature = latestSignature;
	});

	const dispatchNavigationLabelsUpdated = (
		nextLabels: DashboardNavigationLabels,
		nextOrder: DashboardNavigationOrder
	): void => {
		if (typeof window === 'undefined') {
			return;
		}

		window.dispatchEvent(
			new CustomEvent(NAVIGATION_LABELS_UPDATED_EVENT, {
				detail: {
					labels: nextLabels,
					order: nextOrder
				}
			})
		);
	};

	const updateLabel = (tabKey: DashboardNavKey, nextLabel: string): void => {
		labels = {
			...labels,
			[tabKey]: normalizeDashboardNavigationLabel(nextLabel)
		};

		if (fieldErrors[tabKey]) {
			fieldErrors = {
				...fieldErrors,
				[tabKey]: undefined
			};
		}

		saveError = '';
		saveSuccess = '';
	};

	const resetLabel = (tabKey: DashboardNavKey): void => {
		labels = {
			...labels,
			[tabKey]: getDefaultDashboardNavigationLabels()[tabKey]
		};
		fieldErrors = {
			...fieldErrors,
			[tabKey]: undefined
		};
		saveError = '';
		saveSuccess = '';
	};

	const resetUnsavedChanges = (): void => {
		labels = cloneLabels(initialLabels);
		order = cloneOrder(initialOrder);
		fieldErrors = {};
		saveError = '';
		saveSuccess = '';
		dispatchNavigationLabelsUpdated(initialLabels, initialOrder);
	};

	const resetAllToDefaults = (): void => {
		const defaultLabels = getDefaultDashboardNavigationLabels();
		const defaultOrder = getDefaultDashboardNavigationOrder();
		labels = cloneLabels(defaultLabels);
		order = cloneOrder(defaultOrder);
		fieldErrors = {};
		saveError = '';
		saveSuccess = '';
		dispatchNavigationLabelsUpdated(defaultLabels, defaultOrder);
	};

	const moveOrderItem = (fromIndex: number, toIndex: number): boolean => {
		if (fromIndex === toIndex) {
			return false;
		}

		const nextOrder = [...order];
		const [moved] = nextOrder.splice(fromIndex, 1);
		if (!moved) {
			return false;
		}
		nextOrder.splice(toIndex, 0, moved);
		order = mergeDashboardNavigationOrder(nextOrder);
		return true;
	};

	const submitOrderSave = async (): Promise<void> => {
		if (!canEditNavigation || orderSaveSubmitting) {
			return;
		}
		await tick();
		saveNavigationOrderForm?.requestSubmit();
	};

	const moveItemUp = (index: number): void => {
		if (index <= 0 || orderSaveSubmitting || !canEditNavigation) {
			return;
		}
		const previousOrder = cloneOrder(order);
		if (!moveOrderItem(index, index - 1)) {
			return;
		}

		orderRollbackSnapshot = previousOrder;
		saveError = '';
		saveSuccess = '';
		dispatchNavigationLabelsUpdated(labels, order);
		void submitOrderSave();
	};

	const moveItemDown = (index: number): void => {
		if (index >= order.length - 1 || orderSaveSubmitting || !canEditNavigation) {
			return;
		}
		const previousOrder = cloneOrder(order);
		if (!moveOrderItem(index, index + 1)) {
			return;
		}

		orderRollbackSnapshot = previousOrder;
		saveError = '';
		saveSuccess = '';
		dispatchNavigationLabelsUpdated(labels, order);
		void submitOrderSave();
	};

	const requestSaveRow = (tabKey: DashboardNavKey): void => {
		if (!canEditNavigation || saveSubmitting || orderSaveSubmitting) {
			return;
		}
		saveTabKeySubmitting = tabKey;
		saveNavigationForm?.requestSubmit();
	};

	const requestSaveAll = (): void => {
		if (!canEditNavigation || saveSubmitting || orderSaveSubmitting || !hasUnsavedChanges) {
			return;
		}
		saveTabKeySubmitting = null;
		saveNavigationForm?.requestSubmit();
	};

	const enhanceSaveNavigationOrder = () => {
		return async ({ result }: { result: ActionResult }) => {
			orderSaveSubmitting = false;

			if (result.type === 'redirect' || result.type === 'error') {
				await applyAction(result);
				return;
			}

			if (result.type === 'failure') {
				const payload = result.data as SaveNavigationOrderFailure;
				saveError = payload.error ?? 'Unable to save sidebar order.';
				saveSuccess = '';
				if (orderRollbackSnapshot) {
					order = cloneOrder(orderRollbackSnapshot);
					orderRollbackSnapshot = null;
					dispatchNavigationLabelsUpdated(labels, order);
				}
				return;
			}

			const payload = result.data as SaveNavigationOrderSuccess;
			const merged = mergeDashboardNavigationConfig({
				labels: payload.navigationLabels ?? labels,
				order: payload.navigationOrder ?? order
			});
			order = cloneOrder(merged.order);
			initialOrder = cloneOrder(merged.order);
			orderRollbackSnapshot = null;
			lastSyncedConfigSignature = serializeNavigationConfig(merged);
			saveError = '';
			saveSuccess = payload.success ?? 'Sidebar stack order updated.';
			dispatchNavigationLabelsUpdated(merged.labels, merged.order);
		};
	};

	const enhanceSaveNavigation = () => {
		return async ({ result }: { result: ActionResult }) => {
			saveSubmitting = false;
			saveTabKeySubmitting = null;

			if (result.type === 'redirect' || result.type === 'error') {
				await applyAction(result);
				return;
			}

			if (result.type === 'failure') {
				const payload = result.data as SaveNavigationFailure;
				saveError = payload.error ?? 'Unable to save navigation labels.';
				saveSuccess = '';
				fieldErrors = payload.fieldErrors ?? {};
				return;
			}

			const payload = result.data as SaveNavigationSuccess;
			const merged = mergeDashboardNavigationConfig({
				labels: payload.navigationLabels ?? labels,
				order: payload.navigationOrder ?? order
			});
			labels = cloneLabels(merged.labels);
			order = cloneOrder(merged.order);
			initialLabels = cloneLabels(merged.labels);
			initialOrder = cloneOrder(merged.order);
			lastSyncedConfigSignature = serializeNavigationConfig(merged);
			saveError = '';
			saveSuccess = payload.success ?? 'Sidebar labels updated.';
			fieldErrors = {};
			dispatchNavigationLabelsUpdated(merged.labels, merged.order);
		};
	};

	const navIconByKey = {
		dashboard: IconLayoutDashboard,
		schedule: IconCalendarWeek,
		offerings: IconBallAmericanFootball,
		clubSports: IconTrophy,
		memberManagement: IconUserCog,
		communicationCenter: IconMessageCircle,
		facilities: IconBuilding,
		equipmentCheckout: IconShoppingCart,
		payments: IconCreditCard,
		forms: IconFileText,
		reports: IconChartBar,
		settings: IconSettings
	} as const;

	const isLabelModifiedFromDefault = (tabKey: DashboardNavKey): boolean =>
		labels[tabKey] !== getDefaultDashboardNavigationLabels()[tabKey];

	const isRowDirty = (tabKey: DashboardNavKey): boolean => labels[tabKey] !== initialLabels[tabKey];
</script>

<PageTitle pageTitle={`${labels.settings}: Modules`} />

<svelte:head>
	<meta
		name="description"
		content="Configure organization-level modules by renaming and reordering sidebar tabs."
	/>
</svelte:head>

<div class="dashboard-page-shell">
	<div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
		<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
			<div
				class="flex flex-col gap-3 border-b border-neutral-950 bg-neutral-600/66 p-4 lg:flex-row lg:items-start lg:justify-between"
			>
				<div class="space-y-1">
					<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-700">
						Sidebar editor
					</p>
					<h2 class="dashboard-section-title text-neutral-950">Modules</h2>
					<p class="text-sm text-neutral-950">
						Rename dashboard tabs and tune the order people see in the sidebar.
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<span class="badge-neutral-outlined h-9 px-3 text-xs font-semibold">
						{dirtyLabelCount} label{dirtyLabelCount === 1 ? '' : 's'} changed
					</span>
					{#if orderChanged || orderSaveSubmitting}
						<span class="badge-neutral-outlined h-9 px-3 text-xs font-semibold">
							{orderSaveSubmitting ? 'Saving order' : 'Order changed'}
						</span>
					{/if}
				</div>
			</div>

			<div class="space-y-4 p-4 lg:p-5">
				{#if !canEditNavigation}
					<div class="border-2 border-warning-300 bg-warning-50 p-3">
						<div class="flex items-start gap-3">
							<IconAlertTriangle
								class="mt-0.5 h-5 w-5 shrink-0 text-warning-900"
								aria-hidden="true"
							/>
							<div class="space-y-1">
								<p class="text-sm font-semibold text-warning-950">Read-only module settings</p>
								<p class="text-sm text-warning-900">
									Switch to a manager or admin role before editing labels or order.
								</p>
							</div>
						</div>
					</div>
				{/if}

				<div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
					<div>
						<label for="module-search" class="mb-1 block text-sm font-sans text-neutral-950">
							Find a module
						</label>
						<SearchInput
							id="module-search"
							label="Find a module"
							placeholder="Search by current name, default name, or key"
							bind:value={moduleSearch}
						/>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<HoverTooltip text="Discard unsaved edits">
							<button
								type="button"
								class="button-secondary-outlined h-10 cursor-pointer"
								disabled={!hasUnsavedChanges || saveSubmitting || orderSaveSubmitting}
								onclick={resetUnsavedChanges}
							>
								Reset changes
							</button>
						</HoverTooltip>
						<HoverTooltip text="Restore default labels and order">
							<button
								type="button"
								class="button-secondary-outlined h-10 cursor-pointer"
								disabled={!canEditNavigation ||
									!hasDefaultDifferences ||
									saveSubmitting ||
									orderSaveSubmitting}
								onclick={resetAllToDefaults}
							>
								Defaults
							</button>
						</HoverTooltip>
						<HoverTooltip text="Save every changed label">
							<button
								type="button"
								class="button-primary h-10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
								disabled={!canEditNavigation ||
									!hasUnsavedChanges ||
									saveSubmitting ||
									orderSaveSubmitting}
								onclick={requestSaveAll}
							>
								<span class="inline-flex items-center gap-2">
									<IconDeviceFloppy class={`h-4 w-4 ${saveSubmitting ? 'animate-pulse' : ''}`} />
									<span
										>{saveSubmitting && saveTabKeySubmitting === null ? 'Saving' : 'Save all'}</span
									>
								</span>
							</button>
						</HoverTooltip>
					</div>
				</div>

				<div class="space-y-2.5">
					{#if editorRows.length === 0}
						<div class="border border-neutral-950 bg-white p-4">
							<p class="text-sm font-semibold text-neutral-950">No modules match that search.</p>
							<p class="mt-1 text-xs text-neutral-900">
								Clear the search to see all {orderedNavItems.length} sidebar modules.
							</p>
						</div>
					{:else}
						{#each editorRows as row (row.key)}
							{@const RowIcon = navIconByKey[row.key]}
							<div
								class={`border-2 bg-white p-3 ${
									row.isDirty ? 'border-primary-600' : 'border-neutral-950'
								}`}
							>
								<div class="flex flex-col gap-3 lg:flex-row lg:items-start">
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center border border-neutral-950 bg-neutral text-neutral-950"
										aria-hidden="true"
									>
										<RowIcon class="h-5 w-5" />
									</div>

									<div class="min-w-0 flex-1">
										<div class="mb-1 flex flex-wrap items-center gap-2">
											<label
												for={`label-${row.key}`}
												class="text-sm font-semibold text-neutral-950"
											>
												{row.defaultLabel}
											</label>
											<span class="text-xs text-neutral-900">Position {row.orderIndex + 1}</span>
											{#if row.isDirty}
												<span
													class="badge-neutral-outlined px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
												>
													Unsaved
												</span>
											{/if}
										</div>

										<div class="relative">
											<input
												id={`label-${row.key}`}
												class={`input-secondary h-10 pr-10 text-sm ${fieldErrors[row.key] ? 'border-error-700 focus:border-error-700' : ''}`}
												type="text"
												value={labels[row.key]}
												maxlength={maxLabelLength}
												disabled={!canEditNavigation || saveSubmitting || orderSaveSubmitting}
												oninput={(event) =>
													updateLabel(row.key, (event.currentTarget as HTMLInputElement).value)}
											/>
											{#if isLabelModifiedFromDefault(row.key)}
												<HoverTooltip
													text="Revert to default"
													wrapperClass="absolute right-2 top-1/2 inline-flex shrink-0 z-10"
												>
													<button
														type="button"
														tabindex="-1"
														class="-translate-y-1/2 inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none disabled:cursor-not-allowed disabled:text-secondary-400"
														aria-label={`Revert ${row.defaultLabel} label to default`}
														onclick={() => resetLabel(row.key)}
														disabled={!canEditNavigation || saveSubmitting || orderSaveSubmitting}
													>
														<IconRestore class="h-4 w-4" />
													</button>
												</HoverTooltip>
											{/if}
										</div>

										<div class="mt-1 flex flex-wrap items-center justify-between gap-2">
											<p class="text-xs text-neutral-900">Navigation key: {row.key}</p>
											<p class="text-xs text-neutral-900">
												{labels[row.key].length}/{maxLabelLength} characters
											</p>
										</div>

										{#if fieldErrors[row.key]}
											<p class="mt-1 text-xs text-error-700">{fieldErrors[row.key]}</p>
										{/if}
									</div>

									<div class="flex shrink-0 items-center gap-1">
										<HoverTooltip text="Move up">
											<button
												type="button"
												class="button-secondary-outlined h-10 w-10 p-0 inline-flex items-center justify-center cursor-pointer"
												aria-label={`Move ${labels[row.key]} up`}
												onclick={() => moveItemUp(row.orderIndex)}
												disabled={!canEditNavigation ||
													saveSubmitting ||
													orderSaveSubmitting ||
													row.orderIndex === 0}
											>
												<IconChevronUp class="h-4 w-4" />
											</button>
										</HoverTooltip>
										<HoverTooltip text="Move down">
											<button
												type="button"
												class="button-secondary-outlined h-10 w-10 p-0 inline-flex items-center justify-center cursor-pointer"
												aria-label={`Move ${labels[row.key]} down`}
												onclick={() => moveItemDown(row.orderIndex)}
												disabled={!canEditNavigation ||
													saveSubmitting ||
													orderSaveSubmitting ||
													row.orderIndex === orderedNavItems.length - 1}
											>
												<IconChevronDown class="h-4 w-4" />
											</button>
										</HoverTooltip>
										<HoverTooltip
											text={saveSubmitting && saveTabKeySubmitting === row.key
												? 'Saving'
												: 'Save label'}
										>
											<button
												type="button"
												class={`h-10 w-10 p-0 inline-flex items-center justify-center cursor-pointer ${
													isRowDirty(row.key) &&
													canEditNavigation &&
													!saveSubmitting &&
													!orderSaveSubmitting
														? 'button-primary'
														: 'button-secondary-outlined'
												}`}
												aria-label={`Save ${row.defaultLabel} label`}
												onclick={() => requestSaveRow(row.key)}
												disabled={!canEditNavigation ||
													saveSubmitting ||
													orderSaveSubmitting ||
													!isRowDirty(row.key)}
											>
												<IconDeviceFloppy
													class={`h-4 w-4 ${saveSubmitting && saveTabKeySubmitting === row.key ? 'animate-pulse' : ''}`}
												/>
											</button>
										</HoverTooltip>
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</section>

		<aside class="space-y-4">
			<section class="border-2 border-neutral-950 bg-neutral">
				<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Live Sidebar Preview</h3>
					<p class="mt-1 text-xs text-neutral-950">
						This mirrors the labels and order currently staged in this editor.
					</p>
				</div>
				<div class="space-y-2 p-3">
					{#each orderedNavItems as item, index (item.key)}
						{@const PreviewIcon = navIconByKey[item.key]}
						<div
							class={`flex items-center gap-2 border bg-white p-2 ${
								isRowDirty(item.key) ? 'border-primary-600' : 'border-neutral-950'
							}`}
						>
							<span
								class="flex h-7 w-7 shrink-0 items-center justify-center border border-secondary-300 bg-neutral text-neutral-950"
								aria-hidden="true"
							>
								<PreviewIcon class="h-4 w-4" />
							</span>
							<span class="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-950">
								{labels[item.key]}
							</span>
							<span class="text-[11px] font-bold text-secondary-700">#{index + 1}</span>
						</div>
					{/each}
				</div>
			</section>

			<section class="border-2 border-neutral-950 bg-neutral p-4 space-y-3">
				<div>
					<h3 class="text-lg font-bold font-serif text-neutral-950">Editing Notes</h3>
					<p class="mt-1 text-sm text-neutral-950">
						Order changes save immediately. Label changes stay local until you save one row or use
						Save all.
					</p>
				</div>

				<div class="grid grid-cols-2 gap-2">
					<div class="border border-neutral-950 bg-white p-3">
						<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-700">Visible</p>
						<p class="font-serif text-2xl font-bold text-neutral-950">
							{editorRows.length}
						</p>
					</div>
					<div class="border border-neutral-950 bg-white p-3">
						<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-700">Total</p>
						<p class="font-serif text-2xl font-bold text-neutral-950">
							{orderedNavItems.length}
						</p>
					</div>
				</div>

				{#if moduleSearchActive}
					<button
						type="button"
						class="button-secondary-outlined w-full cursor-pointer"
						onclick={() => {
							moduleSearch = '';
						}}
					>
						Clear search
					</button>
				{/if}
			</section>
		</aside>
	</div>

	<form
		class="hidden"
		method="POST"
		action="?/saveNavigationLabels"
		use:enhance={enhanceSaveNavigation}
		bind:this={saveNavigationForm}
		onsubmit={() => {
			saveSubmitting = true;
			saveError = '';
			saveSuccess = '';
			fieldErrors = {};
		}}
	>
		<input type="hidden" name="labelsJson" value={labelsJson} />
		<input type="hidden" name="orderJson" value={orderJson} />
	</form>

	<form
		class="hidden"
		method="POST"
		action="?/saveNavigationOrder"
		use:enhance={enhanceSaveNavigationOrder}
		bind:this={saveNavigationOrderForm}
		onsubmit={() => {
			orderSaveSubmitting = true;
			saveError = '';
			saveSuccess = '';
		}}
	>
		<input type="hidden" name="orderJson" value={orderOnlyJson} />
	</form>
</div>
