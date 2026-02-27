<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import {
		IconAlertTriangle,
		IconBallFootball,
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

	const canEditNavigation = $derived.by(() => data.canEditNavigation === true);
	const maxLabelLength = $derived.by(() => data.maxLabelLength ?? 25);
	const orderedNavItems = $derived.by(() => orderDashboardNavigationItems(order));
	const hasUnsavedChanges = $derived.by(
		() =>
			JSON.stringify(labels) !== JSON.stringify(initialLabels) ||
			JSON.stringify(order) !== JSON.stringify(initialOrder)
	);
	const labelsJson = $derived.by(() => JSON.stringify(labels));
	const orderJson = $derived.by(() => JSON.stringify(order));
	const orderOnlyJson = $derived.by(() => JSON.stringify(order));
	const hasAnyFeedback = $derived.by(() => saveError.length > 0 || saveSuccess.length > 0);

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
		offerings: IconBallFootball,
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

<svelte:head>
	<title>{labels.settings}: Modules - PlayIMs</title>
	<meta
		name="description"
		content="Configure organization-level modules by renaming and reordering sidebar tabs."
	/>
</svelte:head>

<div class="w-full space-y-4">
	<section class="border-2 border-secondary-300 bg-neutral p-3 lg:p-4 space-y-3">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h2 class="text-2xl font-bold font-serif text-neutral-950">Modules</h2>
				<p class="text-xs text-neutral-950 mt-1">
					Rename tabs and adjust order for this organization.
				</p>
			</div>
			{#if orderSaveSubmitting}
				<span class="text-[10px] uppercase tracking-wide text-primary-800 font-bold"
					>Saving order...</span
				>
			{/if}
		</div>

		{#if !canEditNavigation}
			<div class="bg-secondary-100 border-2 border-secondary-500 text-neutral-950 p-4">
				<div class="flex items-start gap-3">
					<IconAlertTriangle class="w-6 h-6 text-secondary-700 shrink-0 mt-0.5" />
					<p class="font-sans text-sm">
						You are currently in read-only mode. Switch to an organization role with manager or
						admin permissions to edit settings.
					</p>
				</div>
			</div>
		{/if}

		{#if hasAnyFeedback}
			{#if saveError}
				<p
					class="text-sm border-2 border-secondary-500 bg-secondary-100 text-secondary-900 px-3 py-2"
				>
					{saveError}
				</p>
			{/if}
			{#if saveSuccess}
				<p class="text-sm border-2 border-primary-500 bg-primary-100 text-primary-900 px-3 py-2">
					{saveSuccess}
				</p>
			{/if}
		{/if}

		<div class="space-y-2.5">
			{#each orderedNavItems as item, index (item.key)}
				{@const RowIcon = navIconByKey[item.key]}
				<div class="border-2 border-secondary-300 bg-white p-2">
					<div class="flex flex-wrap items-start gap-2 lg:flex-nowrap">
						<div class="min-w-0 flex-1">
							<label
								for={`label-${item.key}`}
								class="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-950"
								>{item.defaultLabel}</label
							>

							<div class="relative">
								<span
									class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-950"
									aria-hidden="true"
								>
									<RowIcon class="h-3.5 w-3.5" />
								</span>
								<input
									id={`label-${item.key}`}
									class={`input-secondary h-10 pl-8 pr-10 text-sm ${fieldErrors[item.key] ? 'border-error-700 focus:border-error-700' : ''}`}
									type="text"
									value={labels[item.key]}
									maxlength={maxLabelLength}
									disabled={!canEditNavigation || saveSubmitting || orderSaveSubmitting}
									oninput={(event) =>
										updateLabel(item.key, (event.currentTarget as HTMLInputElement).value)}
								/>
								{#if isLabelModifiedFromDefault(item.key)}
									<HoverTooltip
										text="Revert to default"
										wrapperClass="absolute right-2 top-1/2 inline-flex shrink-0 z-10"
									>
										<button
											type="button"
											tabindex="-1"
											class="-translate-y-1/2 inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none disabled:cursor-not-allowed disabled:text-secondary-400"
											aria-label={`Revert ${item.defaultLabel} label to default`}
											onclick={() => resetLabel(item.key)}
											disabled={!canEditNavigation || saveSubmitting || orderSaveSubmitting}
										>
											<IconRestore class="h-4 w-4" />
										</button>
									</HoverTooltip>
								{/if}
							</div>
						</div>

						<div class="inline-flex items-center gap-1 shrink-0">
							<HoverTooltip text="Move up">
								<button
									type="button"
									class="button-secondary-outlined h-10 w-10 p-0 inline-flex items-center justify-center cursor-pointer"
									aria-label={`Move ${labels[item.key]} up`}
									onclick={() => moveItemUp(index)}
									disabled={!canEditNavigation ||
										saveSubmitting ||
										orderSaveSubmitting ||
										index === 0}
								>
									<IconChevronUp class="h-4 w-4" />
								</button>
							</HoverTooltip>
							<HoverTooltip text="Move down">
								<button
									type="button"
									class="button-secondary-outlined h-10 w-10 p-0 inline-flex items-center justify-center cursor-pointer"
									aria-label={`Move ${labels[item.key]} down`}
									onclick={() => moveItemDown(index)}
									disabled={!canEditNavigation ||
										saveSubmitting ||
										orderSaveSubmitting ||
										index === orderedNavItems.length - 1}
								>
									<IconChevronDown class="h-4 w-4" />
								</button>
							</HoverTooltip>
							<HoverTooltip
								text={saveSubmitting && saveTabKeySubmitting === item.key ? 'Saving' : 'Save label'}
							>
								<button
									type="button"
									class={`h-10 w-10 p-0 inline-flex items-center justify-center cursor-pointer ${
										isRowDirty(item.key) &&
										canEditNavigation &&
										!saveSubmitting &&
										!orderSaveSubmitting
											? 'button-primary'
											: 'button-secondary-outlined'
									}`}
									aria-label={`Save ${item.defaultLabel} label`}
									onclick={() => requestSaveRow(item.key)}
									disabled={!canEditNavigation ||
										saveSubmitting ||
										orderSaveSubmitting ||
										!isRowDirty(item.key)}
								>
									<IconDeviceFloppy
										class={`h-4 w-4 ${saveSubmitting && saveTabKeySubmitting === item.key ? 'animate-pulse' : ''}`}
									/>
								</button>
							</HoverTooltip>
						</div>
					</div>
					{#if fieldErrors[item.key]}
						<p class="mt-1 text-xs text-error-700">{fieldErrors[item.key]}</p>
					{/if}
				</div>
			{/each}
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
	</section>
</div>
