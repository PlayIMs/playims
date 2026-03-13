type SnapshotResolver<T> = (value: T) => unknown;

interface WizardDirtyStateOptions<T> {
	snapshot?: SnapshotResolver<T>;
}

export interface WizardDirtyState<T> {
	captureBaseline: (value: T) => void;
	clearBaseline: () => void;
	isDirty: (value: T) => boolean;
}

function defaultSnapshot<T>(value: T): T {
	return value;
}

export function createWizardDirtyState<T>(
	options: WizardDirtyStateOptions<T> = {}
): WizardDirtyState<T> {
	const resolveSnapshot = options.snapshot ?? defaultSnapshot<T>;
	let baseline: string | null = null;

	function serialize(value: T): string {
		return JSON.stringify(resolveSnapshot(value));
	}

	return {
		captureBaseline(value: T): void {
			baseline = serialize(value);
		},
		clearBaseline(): void {
			baseline = null;
		},
		isDirty(value: T): boolean {
			if (baseline === null) return false;
			return serialize(value) !== baseline;
		}
	};
}
