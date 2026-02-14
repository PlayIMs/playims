export function slugifyFinal(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

export function slugifyLiveWithCursor(
	input: string,
	cursorIndex: number
): { value: string; cursor: number } {
	let output = '';
	let outputCursor = 0;

	for (let index = 0; index < input.length; index++) {
		const character = input[index] ?? '';
		const beforeCursor = index < cursorIndex;

		let next = '';
		if (/[A-Za-z0-9]/.test(character)) next = character.toLowerCase();
		else if (character === ' ' || character === '-') next = '-';

		if (next === '-') {
			if (output.length === 0) {
				next = '';
			} else if (output.endsWith('-')) {
				next = '';
			}
		}

		if (next) {
			output += next;
			if (beforeCursor) outputCursor += next.length;
		}
	}

	return { value: output, cursor: outputCursor };
}

export function applyLiveSlugInput(element: HTMLInputElement): string {
	const cursor = element.selectionStart ?? element.value.length;
	const { value, cursor: nextCursor } = slugifyLiveWithCursor(element.value, cursor);
	element.value = value;
	element.setSelectionRange(nextCursor, nextCursor);
	return value;
}
