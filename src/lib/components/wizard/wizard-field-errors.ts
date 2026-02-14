export function pickFieldErrors(
	errors: Record<string, string>,
	fieldKeys: string[]
): Record<string, string> {
	const subset: Record<string, string> = {};
	for (const key of fieldKeys) {
		if (errors[key]) subset[key] = errors[key];
	}
	return subset;
}

export function toServerFieldErrorMap(
	fieldErrors: Record<string, string[] | undefined> | undefined
): Record<string, string> {
	const flattened: Record<string, string> = {};
	if (!fieldErrors) return flattened;

	for (const [key, value] of Object.entries(fieldErrors)) {
		if (Array.isArray(value) && value.length > 0 && value[0]) {
			flattened[key] = value[0];
		}
	}

	return flattened;
}

export function isRequiredFieldMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return normalized.endsWith(' is required.') || normalized === 'required.';
}
