export type ListboxVariant = 'auto' | 'button' | 'field';

export function resolveListboxVariant(
	variant: ListboxVariant,
	inModal: boolean,
	mode: 'select' | 'action',
	customButtonClass: string
): 'button' | 'field' {
	if (variant !== 'auto') return variant;
	return inModal && mode === 'select' && !customButtonClass.trim() ? 'field' : 'button';
}
