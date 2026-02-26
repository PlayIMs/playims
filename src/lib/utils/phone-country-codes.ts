type RawPhoneCountry = readonly [iso2: string, dialCode: string, priority: number];

// Sourced from intl-tel-input rawCountryData.
const rawPhoneCountries: RawPhoneCountry[] = [
	['af', '93', 0],
	['ax', '358', 1],
	['al', '355', 0],
	['dz', '213', 0],
	['as', '1', 5],
	['ad', '376', 0],
	['ao', '244', 0],
	['ai', '1', 6],
	['ag', '1', 7],
	['ar', '54', 0],
	['am', '374', 0],
	['aw', '297', 0],
	['ac', '247', 0],
	['au', '61', 0],
	['at', '43', 0],
	['az', '994', 0],
	['bs', '1', 8],
	['bh', '973', 0],
	['bd', '880', 0],
	['bb', '1', 9],
	['by', '375', 0],
	['be', '32', 0],
	['bz', '501', 0],
	['bj', '229', 0],
	['bm', '1', 10],
	['bt', '975', 0],
	['bo', '591', 0],
	['ba', '387', 0],
	['bw', '267', 0],
	['br', '55', 0],
	['io', '246', 0],
	['vg', '1', 11],
	['bn', '673', 0],
	['bg', '359', 0],
	['bf', '226', 0],
	['bi', '257', 0],
	['kh', '855', 0],
	['cm', '237', 0],
	['ca', '1', 1],
	['cv', '238', 0],
	['bq', '599', 1],
	['ky', '1', 12],
	['cf', '236', 0],
	['td', '235', 0],
	['cl', '56', 0],
	['cn', '86', 0],
	['cx', '61', 2],
	['cc', '61', 1],
	['co', '57', 0],
	['km', '269', 0],
	['cg', '242', 0],
	['cd', '243', 0],
	['ck', '682', 0],
	['cr', '506', 0],
	['ci', '225', 0],
	['hr', '385', 0],
	['cu', '53', 0],
	['cw', '599', 0],
	['cy', '357', 0],
	['cz', '420', 0],
	['dk', '45', 0],
	['dj', '253', 0],
	['dm', '1', 13],
	['do', '1', 2],
	['ec', '593', 0],
	['eg', '20', 0],
	['sv', '503', 0],
	['gq', '240', 0],
	['er', '291', 0],
	['ee', '372', 0],
	['sz', '268', 0],
	['et', '251', 0],
	['fk', '500', 0],
	['fo', '298', 0],
	['fj', '679', 0],
	['fi', '358', 0],
	['fr', '33', 0],
	['gf', '594', 0],
	['pf', '689', 0],
	['ga', '241', 0],
	['gm', '220', 0],
	['ge', '995', 0],
	['de', '49', 0],
	['gh', '233', 0],
	['gi', '350', 0],
	['gr', '30', 0],
	['gl', '299', 0],
	['gd', '1', 14],
	['gp', '590', 0],
	['gu', '1', 15],
	['gt', '502', 0],
	['gg', '44', 1],
	['gn', '224', 0],
	['gw', '245', 0],
	['gy', '592', 0],
	['ht', '509', 0],
	['hn', '504', 0],
	['hk', '852', 0],
	['hu', '36', 0],
	['is', '354', 0],
	['in', '91', 0],
	['id', '62', 0],
	['ir', '98', 0],
	['iq', '964', 0],
	['ie', '353', 0],
	['im', '44', 2],
	['il', '972', 0],
	['it', '39', 0],
	['jm', '1', 4],
	['jp', '81', 0],
	['je', '44', 3],
	['jo', '962', 0],
	['kz', '7', 1],
	['ke', '254', 0],
	['ki', '686', 0],
	['xk', '383', 0],
	['kw', '965', 0],
	['kg', '996', 0],
	['la', '856', 0],
	['lv', '371', 0],
	['lb', '961', 0],
	['ls', '266', 0],
	['lr', '231', 0],
	['ly', '218', 0],
	['li', '423', 0],
	['lt', '370', 0],
	['lu', '352', 0],
	['mo', '853', 0],
	['mg', '261', 0],
	['mw', '265', 0],
	['my', '60', 0],
	['mv', '960', 0],
	['ml', '223', 0],
	['mt', '356', 0],
	['mh', '692', 0],
	['mq', '596', 0],
	['mr', '222', 0],
	['mu', '230', 0],
	['yt', '262', 1],
	['mx', '52', 0],
	['fm', '691', 0],
	['md', '373', 0],
	['mc', '377', 0],
	['mn', '976', 0],
	['me', '382', 0],
	['ms', '1', 16],
	['ma', '212', 0],
	['mz', '258', 0],
	['mm', '95', 0],
	['na', '264', 0],
	['nr', '674', 0],
	['np', '977', 0],
	['nl', '31', 0],
	['nc', '687', 0],
	['nz', '64', 0],
	['ni', '505', 0],
	['ne', '227', 0],
	['ng', '234', 0],
	['nu', '683', 0],
	['nf', '672', 0],
	['kp', '850', 0],
	['mk', '389', 0],
	['mp', '1', 17],
	['no', '47', 0],
	['om', '968', 0],
	['pk', '92', 0],
	['pw', '680', 0],
	['ps', '970', 0],
	['pa', '507', 0],
	['pg', '675', 0],
	['py', '595', 0],
	['pe', '51', 0],
	['ph', '63', 0],
	['pl', '48', 0],
	['pt', '351', 0],
	['pr', '1', 3],
	['qa', '974', 0],
	['re', '262', 0],
	['ro', '40', 0],
	['ru', '7', 0],
	['rw', '250', 0],
	['ws', '685', 0],
	['sm', '378', 0],
	['st', '239', 0],
	['sa', '966', 0],
	['sn', '221', 0],
	['rs', '381', 0],
	['sc', '248', 0],
	['sl', '232', 0],
	['sg', '65', 0],
	['sx', '1', 21],
	['sk', '421', 0],
	['si', '386', 0],
	['sb', '677', 0],
	['so', '252', 0],
	['za', '27', 0],
	['kr', '82', 0],
	['ss', '211', 0],
	['es', '34', 0],
	['lk', '94', 0],
	['bl', '590', 1],
	['sh', '290', 0],
	['kn', '1', 18],
	['lc', '1', 19],
	['mf', '590', 2],
	['pm', '508', 0],
	['vc', '1', 20],
	['sd', '249', 0],
	['sr', '597', 0],
	['sj', '47', 1],
	['se', '46', 0],
	['ch', '41', 0],
	['sy', '963', 0],
	['tw', '886', 0],
	['tj', '992', 0],
	['tz', '255', 0],
	['th', '66', 0],
	['tl', '670', 0],
	['tg', '228', 0],
	['tk', '690', 0],
	['to', '676', 0],
	['tt', '1', 22],
	['tn', '216', 0],
	['tr', '90', 0],
	['tm', '993', 0],
	['tc', '1', 23],
	['tv', '688', 0],
	['vi', '1', 24],
	['ug', '256', 0],
	['ua', '380', 0],
	['ae', '971', 0],
	['gb', '44', 0],
	['us', '1', 0],
	['uy', '598', 0],
	['uz', '998', 0],
	['vu', '678', 0],
	['va', '39', 1],
	['ve', '58', 0],
	['vn', '84', 0],
	['wf', '681', 0],
	['eh', '212', 1],
	['ye', '967', 0],
	['zm', '260', 0],
	['zw', '263', 0]
];

const fallbackCountryNameByIso2: Record<string, string> = {
	ac: 'Ascension Island',
	xk: 'Kosovo'
};

const regionDisplayNames =
	typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
		? new Intl.DisplayNames(['en'], { type: 'region' })
		: null;

function resolveCountryName(iso2: string): string {
	const normalized = iso2.trim().toUpperCase();
	if (!normalized) {
		return 'Unknown country';
	}

	const fallbackName = fallbackCountryNameByIso2[normalized.toLowerCase()];
	if (fallbackName) {
		return fallbackName;
	}

	if (!regionDisplayNames) {
		return normalized;
	}

	const displayName = regionDisplayNames.of(normalized);
	if (!displayName) {
		return normalized;
	}

	return displayName;
}

function toFlagEmoji(iso2: string): string {
	const normalized = iso2.trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(normalized)) {
		return '';
	}

	const firstCodePoint = normalized.charCodeAt(0) + 127397;
	const secondCodePoint = normalized.charCodeAt(1) + 127397;
	return String.fromCodePoint(firstCodePoint, secondCodePoint);
}

export type PhoneCountry = {
	iso2: string;
	countryName: string;
	dialCode: string;
	dialCodePlus: string;
	flagIconClass: string;
	flagEmoji: string;
	priority: number;
};

const parsedPhoneCountries: PhoneCountry[] = rawPhoneCountries.map(
	([iso2, dialCode, priority]) => ({
		iso2,
		countryName: resolveCountryName(iso2),
		dialCode,
		dialCodePlus: `+${dialCode}`,
		flagIconClass: iso2 === 'ac' ? '' : `fi fi-${iso2}`,
		flagEmoji: toFlagEmoji(iso2),
		priority
	})
);

export const phoneCountries: PhoneCountry[] = parsedPhoneCountries.toSorted((a, b) => {
	const byDialCode = Number(a.dialCode) - Number(b.dialCode);
	if (byDialCode !== 0) return byDialCode;
	if (a.priority !== b.priority) return a.priority - b.priority;
	const byName = a.countryName.localeCompare(b.countryName, 'en', { sensitivity: 'base' });
	if (byName !== 0) return byName;
	return a.iso2.localeCompare(b.iso2);
});

export const phoneCountryByIso2 = new Map(
	phoneCountries.map((country) => [country.iso2, country] as const)
);

const defaultPhoneCountryIso2ByDialCodeMap = new Map<string, string>();
const defaultPhoneCountryPriorityByDialCodeMap = new Map<string, number>();

for (const [iso2, dialCode, priority] of rawPhoneCountries) {
	const dialCodePlus = `+${dialCode}`;
	const existingPriority = defaultPhoneCountryPriorityByDialCodeMap.get(dialCodePlus);
	if (existingPriority !== undefined && existingPriority <= priority) {
		continue;
	}

	defaultPhoneCountryPriorityByDialCodeMap.set(dialCodePlus, priority);
	defaultPhoneCountryIso2ByDialCodeMap.set(dialCodePlus, iso2);
}

export const defaultPhoneCountryIso2ByDialCode = defaultPhoneCountryIso2ByDialCodeMap;

export const phoneCountryDialValues = Array.from(
	new Set(rawPhoneCountries.map(([, dialCode]) => `+${dialCode}`))
);
