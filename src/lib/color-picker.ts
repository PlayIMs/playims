export function hexToHsl(hex: string): { h: number; s: number; l: number } {
	const cleanHex = hex.replace('#', '');
	const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
	const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
	const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}

	return {
		h: h * 360,
		s: s * 100,
		l: l * 100
	};
}

export function hslToHex(h: number, s: number, l: number): string {
	h = ((h % 360) + 360) % 360;
	s /= 100;
	l /= 100;

	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0;
	let g = 0;
	let b = 0;

	if (0 <= h && h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (60 <= h && h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (120 <= h && h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (180 <= h && h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (240 <= h && h < 300) {
		r = x;
		g = 0;
		b = c;
	} else if (300 <= h && h < 360) {
		r = c;
		g = 0;
		b = x;
	}

	r = Math.round((r + m) * 255);
	g = Math.round((g + m) * 255);
	b = Math.round((b + m) * 255);

	return [r, g, b]
		.map((value) => {
			const hex = value.toString(16);
			return hex.length === 1 ? `0${hex}` : hex;
		})
		.join('')
		.toUpperCase();
}

export function colorFromPosition(h: number, x: number, y: number) {
	const clampedX = Math.max(0, Math.min(100, x));
	const clampedY = Math.max(0, Math.min(100, y));
	const v = 1 - clampedY / 100;
	const l = v * (1 - clampedX / 200);
	const s = l > 0 && l < 1 ? (v - l) / Math.min(l, 1 - l) : 0;
	return { h, s: s * 100, l: l * 100, x: clampedX, y: clampedY };
}

export function parsePickerHex(value: string): string | null {
	const hex = value.trim().replace(/^#/, '');
	if (/^[0-9a-f]{6}$/i.test(hex)) return hex.toUpperCase();
	if (/^[0-9a-f]{3}$/i.test(hex))
		return hex
			.split('')
			.map((c) => c + c)
			.join('')
			.toUpperCase();
	return null;
}

export function parsePickerHsl(value: string): { h: number; s: number; l: number } | null {
	const match = value
		.trim()
		.match(
			/^(?:hsl\(\s*)?(\d+(?:\.\d+)?)\u00b0?\s*,\s*(\d+(?:\.\d+)?)%?\s*,\s*(\d+(?:\.\d+)?)%?\s*\)?$/i
		);
	if (!match) return null;
	const [h, s, l] = match.slice(1).map(Number);
	if (h > 360 || s > 100 || l > 100) return null;
	return { h: h % 360, s, l };
}
