<script lang="ts">
	import {
		IconLayoutDashboard,
		IconCalendarWeek,
		IconBallAmericanFootball,
		IconTrophy,
		IconUserCog,
		IconBuilding,
		IconShoppingCart,
		IconCreditCard,
		IconFileText,
		IconChartBar,
		IconSettings,
		IconHelpCircle,
		IconHeadset,
		IconBell,
		IconBuildingCommunity,
		IconEye,
		IconUser,
		IconChevronLeft,
		IconChevronRight,
		IconMessageCircle,
		IconArrowBackUp,
		IconCode
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { flip } from 'svelte/animate';
	import { cubicInOut } from 'svelte/easing';
	import {
		DASHBOARD_NAV_KEY_SET,
		mergeDashboardNavigationConfig,
		mergeDashboardNavigationLabels,
		mergeDashboardNavigationOrder,
		orderDashboardNavigationItems,
		type DashboardNavKey,
		type DashboardNavigationOrder,
		type DashboardNavigationLabels
	} from '$lib/dashboard/navigation';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import {
		STANDALONE_DISPLAY_MODE_QUERY,
		isStandaloneDisplayMode
	} from '$lib/utils/pwa-navigation';
	import SwitchOrganizationWizard from './_wizards/SwitchOrganizationWizard.svelte';
	import ViewRoleWizard from './_wizards/ViewRoleWizard.svelte';

	type AuthRole = 'participant' | 'manager' | 'admin' | 'dev';
	type OrganizationOption = {
		clientId: string;
		clientName: string;
		clientSlug: string | null;
		role: string;
		isCurrent: boolean;
		isDefault: boolean;
	};
	type NavigatorWithStandalone = Navigator & {
		standalone?: boolean;
	};

	let { children, data } = $props();

	let isSidebarOpen = $state(true);
	let isStandalonePwa = $state(false);
	let standaloneToolbarElement = $state<HTMLDivElement | null>(null);

	const isDashboardNavKey = (value: string): value is DashboardNavKey =>
		DASHBOARD_NAV_KEY_SET.has(value as DashboardNavKey);

	const menuItemIcons = {
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

	const NAVIGATION_LABELS_UPDATED_EVENT = 'playims:navigation-labels-updated';
	let navigationLabels = $state<DashboardNavigationLabels>(mergeDashboardNavigationLabels());
	let navigationOrder = $state<DashboardNavigationOrder>(mergeDashboardNavigationOrder());
	const menuItems = $derived.by(() =>
		orderDashboardNavigationItems(navigationOrder).map((item) => ({
			...item,
			label: navigationLabels[item.key],
			icon: menuItemIcons[item.key]
		}))
	);
	const navigationEntries = $derived.by(() => {
		if (!isDeveloperRole) {
			return menuItems;
		}

		const developerItem = {
			key: 'developer',
			label: 'Developer',
			href: '/dashboard/dev',
			icon: IconCode
		};
		const settingsIndex = menuItems.findIndex((item) => item.key === 'settings');
		if (settingsIndex === -1) {
			return [...menuItems, developerItem];
		}

		return [
			...menuItems.slice(0, settingsIndex + 1),
			developerItem,
			...menuItems.slice(settingsIndex + 1)
		];
	});

	const menuWidth = $derived.by(() => (isSidebarOpen ? 'w-64 xl:w-66' : 'w-14 xl:w-16'));
	const showStandaloneTopUtilities = $derived.by(() => isStandalonePwa);
	const showSidebarFooter = $derived.by(() => !showStandaloneTopUtilities);
	const navBottomPadding = $derived.by(() => {
		if (!showSidebarFooter) {
			return 'pb-4';
		}
		return isSidebarOpen ? 'pb-52' : 'pb-72';
	});
	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}

	const activePath = $derived.by(() => $page.url.pathname);
	const activeSearch = $derived.by(() => $page.url.search);
	const isMenuItemActive = (href: string): boolean => {
		if (href === '#') {
			return false;
		}
		if (href === '/dashboard') {
			return activePath === href;
		}
		return activePath === href || activePath.startsWith(`${href}/`);
	};
	const accountHref = '/dashboard/account';
	const notificationsHref = '/dashboard/settings/notifications';
	const isAccountRoute = $derived.by(
		() => activePath === accountHref || activePath.startsWith(`${accountHref}/`)
	);
	const isNotificationsRoute = $derived.by(
		() => activePath === notificationsHref || activePath.startsWith(`${notificationsHref}/`)
	);
	const viewerName = $derived.by(() => {
		const name = data?.viewer?.name?.trim() ?? '';
		if (name.length > 0) {
			return name;
		}

		const email = data?.viewer?.email?.trim() ?? '';
		if (email.includes('@')) {
			return email.split('@')[0];
		}

		return 'My Account';
	});
	const viewerEmail = $derived.by(() => data?.viewer?.email?.trim() ?? 'No email');
	const organizations = $derived.by(() => (data?.organizations ?? []) as OrganizationOption[]);
	const currentOrganization = $derived.by(
		() => organizations.find((organization) => organization.isCurrent) ?? organizations[0] ?? null
	);
	const currentOrganizationId = $derived.by(() => currentOrganization?.clientId ?? '');
	const normalizeRole = (value: unknown): AuthRole => {
		if (typeof value !== 'string') {
			return 'participant';
		}
		const normalized = value.trim().toLowerCase();
		if (normalized === 'manager' || normalized === 'admin' || normalized === 'dev') {
			return normalized;
		}
		return 'participant';
	};
	const resolveViewTargets = (baseRole: AuthRole): AuthRole[] => {
		if (baseRole === 'dev') return ['admin', 'manager', 'participant'];
		if (baseRole === 'admin') return ['manager', 'participant'];
		if (baseRole === 'manager') return ['participant'];
		return [];
	};
	const baseRole = $derived.by(() => normalizeRole(data?.authMode?.baseRole));
	const effectiveRole = $derived.by(() => normalizeRole(data?.authMode?.effectiveRole));
	const isDeveloperRole = $derived.by(() => effectiveRole === 'dev');
	const canViewAsRole = $derived.by(() => data?.authMode?.canViewAsRole === true);
	const isViewingAsRole = $derived.by(() => data?.authMode?.isViewingAsRole === true);
	const availableViewTargets = $derived.by(() => resolveViewTargets(baseRole));
	const shellTopInset = $derived.by(() =>
		isViewingAsRole
			? 'calc(var(--pwa-top-bar-offset, 0px) + 1rem)'
			: 'var(--pwa-top-bar-offset, 0px)'
	);
	const shellHorizontalInset = $derived.by(() => (isViewingAsRole ? '1rem' : '0px'));
	// Keep the role-view frame on the viewport edge while the dashboard shell sits inside it.
	const shellBorderTopInset = $derived.by(() => 'var(--pwa-top-bar-offset, 0px)');
	const sidebarHeightStyle = $derived.by(() =>
		isViewingAsRole
			? 'calc(100dvh - var(--pwa-top-bar-offset, 0px) - 2rem)'
			: 'calc(100dvh - var(--pwa-top-bar-offset, 0px))'
	);
	const shellBorderOpacityClass = $derived.by(() =>
		isViewingAsRole ? 'opacity-100' : 'opacity-0'
	);
	const viewingModeLabel = $derived.by(() => {
		return effectiveRole.toUpperCase();
	});
	const returnModeLabel = $derived.by(() => {
		return baseRole;
	});
	const notificationCount = $derived.by(() => {
		const alerts = $page.data?.alerts;
		return Array.isArray(alerts) ? alerts.length : 0;
	});
	const utilityButtonClass =
		'flex h-10 w-10 items-center justify-center border border-primary-300 text-primary-50 transition-colors duration-150';
	const utilityButtonDisabledClass = 'cursor-not-allowed opacity-70';
	const topBarUtilityButtonClass =
		'flex h-8 w-8 items-center justify-center text-primary-25 transition-colors duration-150';
	const isViewRoleButtonDisabled = $derived.by(
		() => !canViewAsRole || isViewingAsRole || roleWizardSubmitting || organizationSwitching
	);
	const showViewRoleButton = $derived.by(() => effectiveRole !== 'participant');
	const canSwitchOrganization = $derived.by(() => organizations.length > 1);
	const isOrganizationButtonDisabled = $derived.by(
		() => !canSwitchOrganization || organizationSwitching || organizationWizardSubmitting
	);
	const viewRoleTooltipText = $derived.by(() => {
		if (organizationSwitching) {
			return 'Unavailable while switching organizations';
		}
		if (isViewingAsRole) {
			return `Currently viewing as ${viewingModeLabel}`;
		}
		if (!canViewAsRole) {
			return 'View as role unavailable';
		}
		return 'View as role';
	});
	const viewRoleShortcutKeys = $derived.by(() => (viewRoleTooltipText === 'View as role' ? ['Ctrl', 'Shift', 'R'] : []));
	const organizationTooltipText = $derived.by(() => {
		if (organizationSwitching) {
			return 'Switching organizations';
		}
		if (!canSwitchOrganization) {
			return 'No other organizations available';
		}
		return 'Switch organization';
	});
	const organizationShortcutKeys = $derived.by(() =>
		organizationTooltipText === 'Switch organization' ? ['Ctrl', 'Shift', 'O'] : []
	);
	const ORGANIZATION_SWITCHING_SESSION_KEY = 'playims:organization-switching';
	let roleWizardOpen = $state(false);
	let roleWizardSubmitting = $state(false);
	let organizationWizardOpen = $state(false);
	let organizationWizardSubmitting = $state(false);
	let organizationWizardError = $state('');
	let revertingViewMode = $state(false);
	let viewModeBadgeError = $state('');
	let organizationSwitching = $state(false);

	$effect(() => {
		const merged = mergeDashboardNavigationConfig({
			labels: data?.navigationLabels,
			order: data?.navigationOrder
		});
		navigationLabels = merged.labels;
		navigationOrder = merged.order;
	});

	const syncOrganizationSwitchingState = () => {
		if (!browser) {
			organizationSwitching = false;
			return;
		}

		try {
			organizationSwitching =
				window.sessionStorage.getItem(ORGANIZATION_SWITCHING_SESSION_KEY) === '1';
		} catch {
			organizationSwitching = false;
		}
	};

	const syncStandalonePwaState = () => {
		if (!browser) {
			isStandalonePwa = false;
			return;
		}

		const navigatorStandalone =
			typeof navigator !== 'undefined' && 'standalone' in navigator
				? Boolean((navigator as NavigatorWithStandalone).standalone)
				: false;

		isStandalonePwa = isStandaloneDisplayMode({
			matchMedia: (query) => window.matchMedia(query),
			navigatorStandalone
		});
	};

	function setOrganizationSwitchingState(isSwitching: boolean): void {
		organizationSwitching = isSwitching;
		if (!browser) {
			return;
		}

		try {
			if (isSwitching) {
				window.sessionStorage.setItem(ORGANIZATION_SWITCHING_SESSION_KEY, '1');
			} else {
				window.sessionStorage.removeItem(ORGANIZATION_SWITCHING_SESSION_KEY);
			}
		} catch {
			// Ignore storage failures; local state still gates controls.
		}

		window.dispatchEvent(
			new CustomEvent('playims:organization-switching', {
				detail: { active: isSwitching }
			})
		);
	}

	const openRoleWizard = () => {
		if (!canViewAsRole || isViewingAsRole || roleWizardSubmitting || organizationSwitching) {
			return;
		}
		organizationWizardOpen = false;
		roleWizardOpen = true;
		viewModeBadgeError = '';
	};

	const closeRoleWizard = () => {
		if (roleWizardSubmitting) {
			return;
		}
		roleWizardOpen = false;
	};

	const openOrganizationWizard = () => {
		if (!canSwitchOrganization || organizationSwitching || organizationWizardSubmitting) {
			return;
		}
		roleWizardOpen = false;
		organizationWizardOpen = true;
		organizationWizardError = '';
	};

	const closeOrganizationWizard = () => {
		if (organizationWizardSubmitting) {
			return;
		}
		organizationWizardOpen = false;
	};

	const applyViewRole = async (targetRole: AuthRole | null) => {
		if (!browser || !canViewAsRole || roleWizardSubmitting || organizationSwitching) {
			return;
		}

		roleWizardSubmitting = true;
		viewModeBadgeError = '';
		try {
			const response = await fetch('/api/auth/view-as-role', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ targetRole })
			});

			let payload: { error?: string } | null = null;
			try {
				payload = (await response.json()) as { error?: string };
			} catch {
				payload = null;
			}

			if (!response.ok) {
				viewModeBadgeError = payload?.error ?? 'Unable to update role view.';
				await invalidateAll();
				return;
			}

			roleWizardOpen = false;
			await invalidateAll();
		} catch {
			viewModeBadgeError = 'Unable to update role view.';
		} finally {
			roleWizardSubmitting = false;
		}
	};

	const exitViewMode = async () => {
		if (!browser || !isViewingAsRole || revertingViewMode || organizationSwitching) {
			return;
		}

		revertingViewMode = true;
		viewModeBadgeError = '';
		try {
			const response = await fetch('/api/auth/view-as-role', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ targetRole: null })
			});

			let payload: { error?: string } | null = null;
			try {
				payload = (await response.json()) as { error?: string };
			} catch {
				payload = null;
			}

			if (!response.ok) {
				viewModeBadgeError = payload?.error ?? 'Unable to restore role view.';
				await invalidateAll();
				return;
			}

			await invalidateAll();
		} catch {
			viewModeBadgeError = 'Unable to restore role view.';
		} finally {
			revertingViewMode = false;
		}
	};

	const switchOrganization = async (clientId: string) => {
		if (
			!browser ||
			!clientId ||
			clientId === currentOrganizationId ||
			organizationSwitching ||
			organizationWizardSubmitting
		) {
			return;
		}

		organizationWizardSubmitting = true;
		organizationWizardError = '';
		setOrganizationSwitchingState(true);
		try {
			const response = await fetch('/api/auth/switch-client', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ clientId })
			});

			let payload: { error?: string } | null = null;
			try {
				payload = (await response.json()) as { error?: string };
			} catch {
				payload = null;
			}

			if (!response.ok) {
				organizationWizardError = payload?.error ?? 'Unable to switch organizations right now.';
				return;
			}

			organizationWizardOpen = false;
			const currentUrl = `${activePath}${activeSearch}`;
			const routeProbe = await fetch(currentUrl, {
				method: 'GET',
				headers: {
					accept: 'text/html'
				}
			});

			if (!routeProbe.ok) {
				await goto('/dashboard', { invalidateAll: true });
				return;
			}

			await invalidateAll();
		} catch {
			organizationWizardError = 'Unable to switch organizations right now.';
		} finally {
			organizationWizardSubmitting = false;
			setOrganizationSwitchingState(false);
		}
	};

	$effect(() => {
		if (!browser) {
			return;
		}

		const handleNavigationLabelsUpdated = (event: Event) => {
			const customEvent = event as CustomEvent<{
				labels?: Partial<Record<DashboardNavKey, string>>;
				order?: DashboardNavigationOrder;
			}>;
			const incomingLabels = customEvent.detail?.labels;
			const incomingOrder = customEvent.detail?.order;
			if (
				(!incomingLabels || typeof incomingLabels !== 'object') &&
				!Array.isArray(incomingOrder)
			) {
				return;
			}

			const sanitized: Partial<Record<DashboardNavKey, string>> = {};
			if (incomingLabels && typeof incomingLabels === 'object') {
				for (const [rawKey, rawLabel] of Object.entries(incomingLabels)) {
					if (!isDashboardNavKey(rawKey) || typeof rawLabel !== 'string') {
						continue;
					}
					sanitized[rawKey] = rawLabel;
				}
			}

			const merged = mergeDashboardNavigationConfig({
				labels: {
					...navigationLabels,
					...sanitized
				},
				order: Array.isArray(incomingOrder) ? incomingOrder : navigationOrder
			});
			navigationLabels = merged.labels;
			navigationOrder = merged.order;
		};

		syncOrganizationSwitchingState();

		const handleOrganizationSwitchingEvent = (event: Event) => {
			const customEvent = event as CustomEvent<{ active?: boolean }>;
			if (typeof customEvent.detail?.active === 'boolean') {
				organizationSwitching = customEvent.detail.active;
				return;
			}

			syncOrganizationSwitchingState();
		};

		const handleStorageEvent = (event: StorageEvent) => {
			if (event.key && event.key !== ORGANIZATION_SWITCHING_SESSION_KEY) {
				return;
			}

			syncOrganizationSwitchingState();
		};

		window.addEventListener(
			'playims:organization-switching',
			handleOrganizationSwitchingEvent as EventListener
		);
		window.addEventListener(
			NAVIGATION_LABELS_UPDATED_EVENT,
			handleNavigationLabelsUpdated as EventListener
		);
		window.addEventListener('storage', handleStorageEvent);
		window.addEventListener('focus', syncOrganizationSwitchingState);
		return () => {
			window.removeEventListener(
				'playims:organization-switching',
				handleOrganizationSwitchingEvent as EventListener
			);
			window.removeEventListener(
				NAVIGATION_LABELS_UPDATED_EVENT,
				handleNavigationLabelsUpdated as EventListener
			);
			window.removeEventListener('storage', handleStorageEvent);
			window.removeEventListener('focus', syncOrganizationSwitchingState);
		};
	});

	onMount(() => {
		if (!browser) {
			return;
		}

		syncStandalonePwaState();
		const standaloneMediaQuery = window.matchMedia(STANDALONE_DISPLAY_MODE_QUERY);
		const legacyStandaloneMediaQuery = standaloneMediaQuery as MediaQueryList & {
			addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
			removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
		};
		const handleStandaloneModeChange = () => {
			syncStandalonePwaState();
		};

		if ('addEventListener' in standaloneMediaQuery) {
			standaloneMediaQuery.addEventListener('change', handleStandaloneModeChange);
		} else if (legacyStandaloneMediaQuery.addListener) {
			legacyStandaloneMediaQuery.addListener(handleStandaloneModeChange);
		}

		window.addEventListener('pageshow', handleStandaloneModeChange);

		return () => {
			if ('removeEventListener' in standaloneMediaQuery) {
				standaloneMediaQuery.removeEventListener('change', handleStandaloneModeChange);
			} else if (legacyStandaloneMediaQuery.removeListener) {
				legacyStandaloneMediaQuery.removeListener(handleStandaloneModeChange);
			}

			window.removeEventListener('pageshow', handleStandaloneModeChange);
		};
	});

	$effect(() => {
		if (!organizationSwitching) {
			return;
		}

		roleWizardOpen = false;
		organizationWizardOpen = false;
	});

	$effect(() => {
		if (!browser || (!canViewAsRole && !canSwitchOrganization)) {
			return;
		}

		const handleViewModeShortcut = (event: KeyboardEvent) => {
			if (!(event.ctrlKey && event.shiftKey)) {
				return;
			}
			if (organizationSwitching) {
				return;
			}

			if (event.code === 'KeyR' && canViewAsRole) {
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				if (isViewingAsRole) {
					void exitViewMode();
					return;
				}

				openRoleWizard();
				return;
			}

			if (event.code !== 'KeyO' || !canSwitchOrganization) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
			openOrganizationWizard();
		};

		window.addEventListener('keydown', handleViewModeShortcut, true);
		return () => {
			window.removeEventListener('keydown', handleViewModeShortcut, true);
		};
	});

	$effect(() => {
		if (!browser) {
			return;
		}

		const html = document.documentElement;
		const body = document.body;
		const previousHtmlOverflow = html.style.overflow;
		const previousHtmlScrollbarGutter = html.style.scrollbarGutter;
		const previousBodyOverflow = body.style.overflow;
		const previousBodyScrollbarGutter = body.style.scrollbarGutter;

		html.style.overflow = 'hidden';
		html.style.scrollbarGutter = 'auto';
		body.style.overflow = 'hidden';
		body.style.scrollbarGutter = 'auto';

		return () => {
			html.style.overflow = previousHtmlOverflow;
			html.style.scrollbarGutter = previousHtmlScrollbarGutter;
			body.style.overflow = previousBodyOverflow;
			body.style.scrollbarGutter = previousBodyScrollbarGutter;
		};
	});

	$effect(() => {
		if (!browser) {
			return;
		}

		const root = document.documentElement;
		if (!showStandaloneTopUtilities || !standaloneToolbarElement) {
			root.style.removeProperty('--dashboard-pwa-toolbar-width');
			return;
		}

		const updateToolbarWidth = () => {
			root.style.setProperty(
				'--dashboard-pwa-toolbar-width',
				`${standaloneToolbarElement?.offsetWidth ?? 0}px`
			);
		};

		updateToolbarWidth();

		const resizeObserver = new ResizeObserver(() => {
			updateToolbarWidth();
		});
		resizeObserver.observe(standaloneToolbarElement);
		window.addEventListener('resize', updateToolbarWidth);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateToolbarWidth);
			root.style.removeProperty('--dashboard-pwa-toolbar-width');
		};
	});
</script>

<div class="h-screen box-border">
	<div
		class="pointer-events-none fixed z-50 shadow-[inset_0_0_0_1rem_var(--color-secondary-500)] transition-opacity duration-220 {shellBorderOpacityClass}"
		style={`top:${shellBorderTopInset}; right:0px; bottom:0px; left:0px;`}
		aria-hidden="true"
	></div>
	{#if isViewingAsRole}
		<div
			class="fixed right-4 z-60 inline-flex h-7 items-stretch bg-secondary-300 text-white"
			style={`top: calc(var(--pwa-top-bar-offset, 0px) + 1rem);`}
		>
			<span
				class="inline-flex items-center px-2 text-[0.6rem] font-bold leading-none tracking-[0.08em] cursor-default"
			>
				VIEWING AS {viewingModeLabel}
			</span>
			<HoverTooltip
				text={`Return to ${returnModeLabel} view`}
				wrapperClass="inline-flex self-stretch"
			>
				<button
					type="button"
					class="inline-flex h-full w-7 cursor-pointer items-center justify-center bg-secondary-400 text-white transition-colors duration-150 hover:bg-secondary-600 focus-visible:bg-secondary-800 disabled:cursor-wait disabled:opacity-70"
					aria-label="Return to organization role view"
					disabled={revertingViewMode || organizationSwitching}
					onclick={exitViewMode}
				>
					<IconArrowBackUp class="w-4 h-4" />
				</button>
			</HoverTooltip>
		</div>
	{/if}
	{#if showStandaloneTopUtilities}
		<div
			bind:this={standaloneToolbarElement}
			class="fixed right-2 z-[71] flex h-11 items-center gap-1 bg-primary px-2 text-primary-25"
			style="top: env(safe-area-inset-top, 0px);"
		>
			<HoverTooltip text="Help">
				<button
					type="button"
					class="{topBarUtilityButtonClass} {utilityButtonDisabledClass}"
					aria-label="Help"
					disabled
				>
					<IconHelpCircle class="h-4.5 w-4.5" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Tech support">
				<button
					type="button"
					class="{topBarUtilityButtonClass} {utilityButtonDisabledClass}"
					aria-label="Tech support"
					disabled
				>
					<IconHeadset class="h-4.5 w-4.5" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Notifications">
				<a
					href={notificationsHref}
					class="{topBarUtilityButtonClass} relative cursor-pointer {isNotificationsRoute
						? 'bg-primary-600 text-white'
						: 'hover:bg-primary-600 hover:text-white'}"
					aria-current={isNotificationsRoute ? 'page' : undefined}
				>
					<IconBell class="h-4.5 w-4.5" />
					{#if notificationCount > 0}
						<span
							class="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center bg-secondary-500 px-1 text-[9px] font-bold leading-none text-white"
						>
							{notificationCount}
						</span>
					{/if}
				</a>
			</HoverTooltip>
			{#if showViewRoleButton}
				<HoverTooltip text={viewRoleTooltipText} shortcutKeys={viewRoleShortcutKeys}>
					<button
						type="button"
						class="{topBarUtilityButtonClass} {isViewRoleButtonDisabled
							? utilityButtonDisabledClass
							: 'cursor-pointer hover:bg-primary-600 hover:text-white'}"
						aria-label="View as role"
						disabled={isViewRoleButtonDisabled}
						onclick={openRoleWizard}
					>
						<IconEye class="h-4.5 w-4.5" />
					</button>
				</HoverTooltip>
			{/if}
			<HoverTooltip text={organizationTooltipText} shortcutKeys={organizationShortcutKeys}>
				<button
					type="button"
					class="{topBarUtilityButtonClass} {isOrganizationButtonDisabled
						? utilityButtonDisabledClass
						: 'cursor-pointer hover:bg-primary-600 hover:text-white'}"
					aria-label="Switch organization"
					disabled={isOrganizationButtonDisabled}
					onclick={openOrganizationWizard}
				>
					<IconBuildingCommunity class="h-4.5 w-4.5" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="My account" wrapperClass="block min-w-0">
				<a
					href={accountHref}
					class="flex h-8 min-w-0 max-w-52 items-center gap-2 px-2 text-primary-25 transition-colors duration-150 cursor-pointer {isAccountRoute
						? 'bg-primary-600 text-white'
						: 'hover:bg-primary-600 hover:text-white'}"
					aria-current={isAccountRoute ? 'page' : undefined}
				>
					<IconUser class="h-4.5 w-4.5 shrink-0" />
					<div class="min-w-0 leading-tight">
						<p class="truncate text-[11px] font-semibold leading-[1.05rem]">{viewerName}</p>
						<p class="truncate text-[10px] leading-[0.8rem] text-primary-100">{viewerEmail}</p>
					</div>
				</a>
			</HoverTooltip>
		</div>
	{/if}
	<div
		class="fixed overflow-auto bg-neutral-500 transition-[inset] duration-220 scrollbar scrollbar-w-0 scrollbar-thumb-secondary-500 scrollbar-track-secondary-300 scrollbar-corner-secondary-300 hover:scrollbar-thumb-secondary-500 active:scrollbar-thumb-secondary-500 scrollbar-hover:scrollbar-thumb-secondary-400 scrollbar-active:scrollbar-thumb-secondary-600"
		style={`top:${shellTopInset}; right:${shellHorizontalInset}; bottom:${shellHorizontalInset}; left:${shellHorizontalInset};`}
	>
		<div class="flex min-h-full items-start">
			<!-- Sidebar Navigation -->
			<aside
				class="bg-primary text-white relative sticky top-0 self-start flex flex-col transition-[width] duration-220 {menuWidth}"
				style={`height:${sidebarHeightStyle};`}
			>
				<!-- Logo Area -->
				<div
					class="p-4 border-b border-primary-600 flex items-center {isSidebarOpen
						? 'justify-between'
						: 'justify-center'}"
				>
					{#if isSidebarOpen}
						<h1 class="text-xl font-bold font-serif tracking-wider">Navigation</h1>
					{/if}
					<button
						onclick={toggleSidebar}
						class="p-2 hover:bg-primary-600 transition-colors duration-150 cursor-pointer"
						aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
						type="button"
					>
						{#if isSidebarOpen}
							<IconChevronLeft class="w-5 h-5" />
						{:else}
							<IconChevronRight class="w-5 h-5" />
						{/if}
					</button>
				</div>

				<!-- Menu -->
				<nav
					class="flex-1 p-2 {navBottomPadding} overflow-y-auto scrollbar-thin scrollbar-thumb-primary-700 scrollbar-track-primary-400 scrollbar-corner-primary-500 hover:scrollbar-thumb-primary-700 active:scrollbar-thumb-primary-700 scrollbar-hover:scrollbar-thumb-primary-800 scrollbar-active:scrollbar-thumb-primary-700"
					aria-label="Dashboard navigation"
				>
					<ul class="space-y-1">
						{#each navigationEntries as item (item.key)}
							<li animate:flip={{ duration: 280, easing: cubicInOut }}>
								<HoverTooltip text={isSidebarOpen ? '' : item.label} wrapperClass="block w-full">
									<a
										href={item.href}
										class="w-full whitespace-nowrap {isSidebarOpen
											? 'px-4 py-3 md:px-3 md:py-2.5 md:gap-2.5 xl:px-4 xl:py-3 xl:gap-3 flex items-center text-base md:text-sm xl:text-base'
											: 'px-2 py-3 md:px-1.5 md:py-2.5 xl:px-2 xl:py-3 flex items-center justify-center'} transition-colors duration-150 cursor-pointer {isMenuItemActive(
											item.href
										)
											? 'bg-primary-600 border-l-4 border-neutral-500 text-white'
											: 'text-primary-100 hover:bg-primary-600 hover:text-white border-l-4 border-transparent'} {item.href ===
										'#'
											? 'opacity-70 pointer-events-none'
											: ''}"
										aria-current={isMenuItemActive(item.href) ? 'page' : undefined}
									>
										<item.icon class="w-5 h-5 md:w-4 md:h-4 xl:w-5 xl:h-5 shrink-0" />
										{#if isSidebarOpen}
											<span>{item.label}</span>
										{/if}
									</a>
								</HoverTooltip>
							</li>
						{/each}
					</ul>
				</nav>

				{#if showSidebarFooter}
					<div
						class="absolute bottom-0 left-0 right-0 border-t border-primary-600 bg-primary-500 p-2"
					>
					{#if isSidebarOpen}
						<div class="space-y-2">
							<div class="flex w-full items-center justify-around gap-2">
								<HoverTooltip text="Help">
									<button
										type="button"
										class="{utilityButtonClass} {utilityButtonDisabledClass}"
										aria-label="Help"
										disabled
									>
										<IconHelpCircle class="w-5 h-5" />
									</button>
								</HoverTooltip>
								<HoverTooltip text="Tech support">
									<button
										type="button"
										class="{utilityButtonClass} {utilityButtonDisabledClass}"
										aria-label="Tech support"
										disabled
									>
										<IconHeadset class="w-5 h-5" />
									</button>
								</HoverTooltip>
								<HoverTooltip text="Notifications">
									<a
										href={notificationsHref}
										class="{utilityButtonClass} relative cursor-pointer {isNotificationsRoute
											? 'bg-primary-600 text-white'
											: 'hover:bg-primary-600 hover:text-white'}"
										aria-current={isNotificationsRoute ? 'page' : undefined}
									>
										<IconBell class="w-5 h-5" />
										{#if notificationCount > 0}
											<span
												class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center bg-secondary-500 px-1 text-[9px] font-bold leading-none text-white"
											>
												{notificationCount}
											</span>
										{/if}
									</a>
								</HoverTooltip>
								{#if showViewRoleButton}
									<HoverTooltip text={viewRoleTooltipText} shortcutKeys={viewRoleShortcutKeys}>
										<button
											type="button"
											class="{utilityButtonClass} {isViewRoleButtonDisabled
												? utilityButtonDisabledClass
												: 'cursor-pointer hover:bg-primary-600 hover:text-white'}"
											aria-label="View as role"
											disabled={isViewRoleButtonDisabled}
											onclick={openRoleWizard}
										>
											<IconEye class="w-5 h-5" />
										</button>
									</HoverTooltip>
								{/if}
								<HoverTooltip text={organizationTooltipText} shortcutKeys={organizationShortcutKeys}>
									<button
										type="button"
										class="{utilityButtonClass} {isOrganizationButtonDisabled
											? utilityButtonDisabledClass
											: 'cursor-pointer hover:bg-primary-600 hover:text-white'}"
										aria-label="Switch organization"
										disabled={isOrganizationButtonDisabled}
										onclick={openOrganizationWizard}
									>
										<IconBuildingCommunity class="w-5 h-5" />
									</button>
								</HoverTooltip>
							</div>
							<a
								href={accountHref}
								class="w-full min-w-0 px-3 py-3 flex items-center gap-3 border-l-4 transition-colors duration-150 cursor-pointer {isAccountRoute
									? 'bg-primary-600 border-neutral-500 text-white'
									: 'border-transparent text-primary-100 hover:bg-primary-600 hover:text-white'}"
								aria-current={isAccountRoute ? 'page' : undefined}
							>
								<IconUser class="w-5 h-5 shrink-0" />
								<div class="min-w-0">
									<p class="text-sm font-semibold truncate">{viewerName}</p>
									<p class="text-[11px] text-primary-100 truncate">{viewerEmail}</p>
								</div>
							</a>
						</div>
					{:else}
						<div class="flex flex-col items-center gap-2">
							<HoverTooltip text="Help">
								<button
									type="button"
									class="{utilityButtonClass} {utilityButtonDisabledClass}"
									aria-label="Help"
									disabled
								>
									<IconHelpCircle class="w-5 h-5" />
								</button>
							</HoverTooltip>
							<HoverTooltip text="Tech support">
								<button
									type="button"
									class="{utilityButtonClass} {utilityButtonDisabledClass}"
									aria-label="Tech support"
									disabled
								>
									<IconHeadset class="w-5 h-5" />
								</button>
							</HoverTooltip>
							<HoverTooltip text="Notifications">
								<a
									href={notificationsHref}
									class="{utilityButtonClass} relative cursor-pointer {isNotificationsRoute
										? 'bg-primary-600 text-white'
										: 'hover:bg-primary-600 hover:text-white'}"
									aria-current={isNotificationsRoute ? 'page' : undefined}
								>
									<IconBell class="w-5 h-5" />
									{#if notificationCount > 0}
										<span
											class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center bg-secondary-500 px-1 text-[9px] font-bold leading-none text-white"
										>
											{notificationCount}
										</span>
									{/if}
								</a>
							</HoverTooltip>
							<HoverTooltip text={viewerName}>
								<a
									href={accountHref}
									class="flex h-10 w-10 items-center justify-center border transition-colors duration-150 cursor-pointer {isAccountRoute
										? 'border-primary-100 bg-primary-600 text-white'
										: 'border-primary-300 text-primary-50 hover:bg-primary-600 hover:text-white'}"
									aria-current={isAccountRoute ? 'page' : undefined}
								>
									<IconUser class="w-5 h-5" />
								</a>
							</HoverTooltip>
						</div>
					{/if}
					</div>
				{/if}
			</aside>

			<!-- Main Content Area -->
			<main class="min-h-full flex-1 bg-neutral">
				{@render children()}
			</main>
		</div>
	</div>
	<ViewRoleWizard
		open={roleWizardOpen}
		formError={viewModeBadgeError}
		submitting={roleWizardSubmitting || organizationSwitching}
		{effectiveRole}
		allowedRoles={availableViewTargets}
		onRequestClose={closeRoleWizard}
		onSelectRole={(role) => void applyViewRole(role)}
	/>
	<SwitchOrganizationWizard
		open={organizationWizardOpen}
		formError={organizationWizardError}
		submitting={organizationWizardSubmitting || organizationSwitching}
		{organizations}
		selectedOrganizationId={currentOrganizationId}
		onRequestClose={closeOrganizationWizard}
		onSelectOrganization={(clientId) => void switchOrganization(clientId)}
	/>
</div>
