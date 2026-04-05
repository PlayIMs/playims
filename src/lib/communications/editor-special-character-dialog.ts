export interface SpecialCharacterDialogOptionShape {
	value: string;
}

export interface SpecialCharacterDialogOpenState {
	selectedValue: string;
	initialFocusIndex: number | null;
}

export function buildSpecialCharacterDialogOpenState(
	options: SpecialCharacterDialogOptionShape[]
): SpecialCharacterDialogOpenState {
	return {
		selectedValue: '',
		initialFocusIndex: options.length > 0 ? 0 : null
	};
}
