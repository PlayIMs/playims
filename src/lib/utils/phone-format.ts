export function formatPhoneNationalFromDigits(value: string): string {
	const digits = value.replace(/\D/g, '').slice(0, 10);
	if (digits.length === 0) return '';
	if (digits.length <= 3) return `(${digits}`;
	if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
	return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function parseStoredPhoneNumber(value: string | null | undefined): {
	countryCode: string;
	nationalDigits: string;
} {
	if (!value) {
		return {
			countryCode: '+1',
			nationalDigits: ''
		};
	}

	const trimmed = value.trim();
	const digits = trimmed.replace(/\D/g, '');
	if (digits.length === 0) {
		return {
			countryCode: '+1',
			nationalDigits: ''
		};
	}

	if (digits.length <= 10) {
		return {
			countryCode: '+1',
			nationalDigits: digits.slice(-10)
		};
	}

	return {
		countryCode: `+${digits.slice(0, digits.length - 10)}`,
		nationalDigits: digits.slice(-10)
	};
}

export function formatPhoneForDisplay(value: string | null | undefined): string {
	const parsed = parseStoredPhoneNumber(value);
	const nationalPhone = formatPhoneNationalFromDigits(parsed.nationalDigits);
	if (!nationalPhone) return '';
	return `${parsed.countryCode} ${nationalPhone}`;
}
