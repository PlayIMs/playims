import { writable } from 'svelte/store';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'loading';
export type ToastActionStyle = 'solid' | 'outline';
export type ToastDesktopPlacement =
	| 'top-left'
	| 'top-center'
	| 'top-right'
	| 'middle-left'
	| 'middle-center'
	| 'middle-right'
	| 'bottom-left'
	| 'bottom-center'
	| 'bottom-right';
export type ToastMobilePlacement = 'top' | 'middle' | 'bottom';
export type ToastPlacement = ToastDesktopPlacement;

export const TOAST_DESKTOP_PLACEMENTS: ToastDesktopPlacement[] = [
	'top-left',
	'top-center',
	'top-right',
	'middle-left',
	'middle-center',
	'middle-right',
	'bottom-left',
	'bottom-center',
	'bottom-right'
];
export const TOAST_PLACEMENTS = TOAST_DESKTOP_PLACEMENTS;
export const TOAST_MOBILE_PLACEMENTS: ToastMobilePlacement[] = ['top', 'middle', 'bottom'];
export const TOAST_STACK_LIMIT = 6;
export const TOAST_MOBILE_STACK_LIMIT = 3;
export const DEFAULT_TOAST_DESKTOP_PLACEMENT: ToastDesktopPlacement = 'top-right';
export const DEFAULT_TOAST_MOBILE_PLACEMENT: ToastMobilePlacement = 'top';

export interface ToastAction {
	id?: string;
	label: string;
	style?: ToastActionStyle;
	dismissOnClick?: boolean;
	onClick?: () => void | Promise<void>;
}

export interface ToastInput {
	id?: string;
	variant?: ToastVariant;
	placement?: ToastDesktopPlacement;
	mobilePlacement?: ToastMobilePlacement;
	title?: string;
	description: string;
	duration?: number | null;
	dismissible?: boolean;
	showProgress?: boolean;
	important?: boolean;
	actions?: ToastAction[];
	ignoreDuplicateStack?: boolean;
}

export interface ToastRecord {
	id: string;
	variant: ToastVariant;
	placement: ToastDesktopPlacement;
	mobilePlacement: ToastMobilePlacement;
	title: string;
	description: string;
	duration: number | null;
	dismissible: boolean;
	showProgress: boolean;
	important: boolean;
	actions: ToastAction[];
	duplicateCount: number;
	updatedAt: number;
}

const DEFAULT_DURATION_BY_VARIANT: Record<ToastVariant, number | null> = {
	success: 4800,
	error: 7200,
	info: 5600,
	warning: 6400,
	loading: null
};

const createToastId = (): string =>
	`toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const deriveMobilePlacement = (placement: ToastDesktopPlacement): ToastMobilePlacement => {
	if (placement.startsWith('top-')) return 'top';
	if (placement.startsWith('middle-')) return 'middle';
	return 'bottom';
};

const createDuplicateSignature = (
	input: Pick<ToastInput, 'variant' | 'title' | 'description' | 'actions'>
): string => {
	const actionSignature = (input.actions ?? [])
		.map((action) => ({
			label: action.label.trim(),
			style: action.style ?? 'outline',
			dismissOnClick: action.dismissOnClick ?? true
		}))
		.map(
			(action) =>
				`${action.label}::${action.style}::${action.dismissOnClick ? '1' : '0'}`
		)
		.join('||');

	return [
		input.variant ?? 'info',
		input.title?.trim() ?? '',
		input.description.trim(),
		actionSignature
	].join('###');
};

const normalizeToast = (input: ToastInput): ToastRecord => {
	const variant = input.variant ?? 'info';
	const placement = input.placement ?? DEFAULT_TOAST_DESKTOP_PLACEMENT;
	return {
		id: input.id ?? createToastId(),
		variant,
		placement,
		mobilePlacement: input.mobilePlacement ?? deriveMobilePlacement(placement),
		title: input.title?.trim() ?? '',
		description: input.description.trim(),
		duration:
			input.duration === undefined ? DEFAULT_DURATION_BY_VARIANT[variant] : input.duration,
		dismissible: input.dismissible ?? true,
		showProgress: input.showProgress ?? variant !== 'loading',
		important: input.important ?? variant === 'error',
		actions: input.actions ?? [],
		duplicateCount: 1,
		updatedAt: Date.now()
	};
};

const removeAtIndex = (items: ToastRecord[], index: number): ToastRecord[] =>
	items.filter((_, itemIndex) => itemIndex !== index);

const insertToastAtVisibleBoundary = (items: ToastRecord[], nextToast: ToastRecord): ToastRecord[] => {
	let visibleCount = 0;

	for (let index = 0; index < items.length; index += 1) {
		if (items[index].placement !== nextToast.placement) {
			continue;
		}

		if (visibleCount === TOAST_STACK_LIMIT - 1) {
			return [...items.slice(0, index), nextToast, ...items.slice(index)];
		}

		visibleCount += 1;
	}

	return [...items, nextToast];
};

const insertToast = (items: ToastRecord[], nextToast: ToastRecord): ToastRecord[] => {
	const placementIndices = items.flatMap((item, index) =>
		item.placement === nextToast.placement ? [index] : []
	);

	if (!nextToast.important || placementIndices.length < TOAST_STACK_LIMIT) {
		return [...items, nextToast];
	}

	const nextItems = removeAtIndex(items, placementIndices[0]);
	return insertToastAtVisibleBoundary(nextItems, nextToast);
};

const { subscribe, update } = writable<ToastRecord[]>([]);

const upsert = (input: ToastInput): string => {
	const nextToast = normalizeToast(input);
	const duplicateSignature = createDuplicateSignature({
		variant: nextToast.variant,
		title: nextToast.title,
		description: nextToast.description,
		actions: nextToast.actions
	});
	update((items) => {
		const existingIndex = items.findIndex((item) => item.id === nextToast.id);
		if (existingIndex === -1) {
			if (input.ignoreDuplicateStack) {
				return insertToast(items, nextToast);
			}

			const duplicateIndex = items.findIndex((item) => {
				if (item.id === nextToast.id) {
					return false;
				}

				return (
					createDuplicateSignature({
						variant: item.variant,
						title: item.title,
						description: item.description,
						actions: item.actions
					}) === duplicateSignature
				);
			});

			if (duplicateIndex === -1) {
				return insertToast(items, nextToast);
			}

			const nextItems = [...items];
			nextItems[duplicateIndex] = {
				...nextToast,
				id: items[duplicateIndex].id,
				duplicateCount: items[duplicateIndex].duplicateCount + 1
			};
			return nextItems;
		}

		const nextItems = [...items];
		nextItems[existingIndex] = {
			...nextToast,
			duplicateCount: items[existingIndex].duplicateCount
		};
		return nextItems;
	});
	return nextToast.id;
};

const dismiss = (id: string): void => {
	update((items) => items.filter((item) => item.id !== id));
};

const dismissMany = (ids: string[]): void => {
	if (ids.length === 0) {
		return;
	}

	const idSet = new Set(ids);
	update((items) => items.filter((item) => !idSet.has(item.id)));
};

const dismissAll = (): void => {
	update(() => []);
};

const updateToast = (id: string, patch: Partial<Omit<ToastInput, 'id'>>): void => {
	update((items) =>
		items.map((item) => {
			if (item.id !== id) {
				return item;
			}

			return {
				...normalizeToast({
					id,
					variant: patch.variant ?? item.variant,
					placement: patch.placement ?? item.placement,
					mobilePlacement: patch.mobilePlacement ?? item.mobilePlacement,
					title: patch.title ?? item.title,
					description: patch.description ?? item.description,
					duration: patch.duration ?? item.duration,
					dismissible: patch.dismissible ?? item.dismissible,
					showProgress: patch.showProgress ?? item.showProgress,
					important: patch.important ?? item.important,
					actions: patch.actions ?? item.actions
				}),
				duplicateCount: item.duplicateCount
			};
		})
	);
};

const showVariant = (
	variant: ToastVariant,
	description: string,
	options: Omit<ToastInput, 'description' | 'variant'> = {}
): string => upsert({ ...options, description, variant });

const promise = async <T>(
	pending: Promise<T>,
	copy: {
		loading: string | ToastInput;
		success: string | ToastInput | ((value: T) => string | ToastInput);
		error: string | ToastInput | ((error: unknown) => string | ToastInput);
	}
): Promise<T> => {
		const loadingToast =
			typeof copy.loading === 'string'
				? { description: copy.loading, variant: 'loading' as const }
				: { ...copy.loading, variant: copy.loading.variant ?? 'loading' };
		const toastId = upsert(loadingToast);

		try {
			const value = await pending;
			const successToast =
				typeof copy.success === 'function' ? copy.success(value) : copy.success;
			updateToast(
				toastId,
				typeof successToast === 'string'
					? {
							variant: 'success',
							description: successToast
						}
					: {
							...successToast,
							variant: successToast.variant ?? 'success'
						}
			);
			return value;
		} catch (error) {
			const errorToast = typeof copy.error === 'function' ? copy.error(error) : copy.error;
			updateToast(
				toastId,
				typeof errorToast === 'string'
					? {
							variant: 'error',
							description: errorToast
						}
					: {
							...errorToast,
							variant: errorToast.variant ?? 'error'
						}
			);
			throw error;
		}
};

export const toastStore = {
	subscribe
};

export const toast = {
	show: upsert,
	update: updateToast,
	dismiss,
	dismissMany,
	dismissAll,
	success: (description: string, options?: Omit<ToastInput, 'description' | 'variant'>) =>
		showVariant('success', description, options),
	error: (description: string, options?: Omit<ToastInput, 'description' | 'variant'>) =>
		showVariant('error', description, options),
	info: (description: string, options?: Omit<ToastInput, 'description' | 'variant'>) =>
		showVariant('info', description, options),
	warning: (description: string, options?: Omit<ToastInput, 'description' | 'variant'>) =>
		showVariant('warning', description, options),
	loading: (description: string, options?: Omit<ToastInput, 'description' | 'variant'>) =>
		showVariant('loading', description, options),
	promise
};
