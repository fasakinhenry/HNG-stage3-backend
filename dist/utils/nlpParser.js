"use strict";
/**
 * Rule-based natural language query parser for profile search.
 * No AI or LLMs used.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNaturalLanguageQuery = parseNaturalLanguageQuery;
const countryMap_1 = require("./countryMap");
// Keyword maps
const GENDER_KEYWORDS = {
    male: 'male',
    males: 'male',
    men: 'male',
    man: 'male',
    boy: 'male',
    boys: 'male',
    female: 'female',
    females: 'female',
    women: 'female',
    woman: 'female',
    girl: 'female',
    girls: 'female',
};
const AGE_GROUP_KEYWORDS = {
    child: 'child',
    children: 'child',
    kid: 'child',
    kids: 'child',
    teenager: 'teenager',
    teenagers: 'teenager',
    teen: 'teenager',
    teens: 'teenager',
    adolescent: 'teenager',
    adult: 'adult',
    adults: 'adult',
    senior: 'senior',
    seniors: 'senior',
    elderly: 'senior',
    old: 'senior',
};
// "young" = 16–24 (parsing only, not a stored age group)
const YOUNG_KEYWORDS = ['young', 'youth', 'youthful'];
/**
 * Parse "above N", "below N", "over N", "under N", "from N to M", "between N and M"
 */
function parseAgeRanges(q) {
    const result = {};
    // "between N and M" / "from N to M"
    const rangeMatch = q.match(/(?:between|from)\s+(\d+)\s+(?:and|to)\s+(\d+)/i);
    if (rangeMatch) {
        result.min_age = parseInt(rangeMatch[1], 10);
        result.max_age = parseInt(rangeMatch[2], 10);
        return result;
    }
    // "above N" / "over N" / "older than N"
    const aboveMatch = q.match(/(?:above|over|older than)\s+(\d+)/i);
    if (aboveMatch) {
        result.min_age = parseInt(aboveMatch[1], 10);
    }
    // "below N" / "under N" / "younger than N"
    const belowMatch = q.match(/(?:below|under|younger than)\s+(\d+)/i);
    if (belowMatch) {
        result.max_age = parseInt(belowMatch[1], 10);
    }
    // "aged N" or "age N"
    const agedMatch = q.match(/(?:aged?)\s+(\d+)/i);
    if (agedMatch && !result.min_age && !result.max_age) {
        result.min_age = parseInt(agedMatch[1], 10);
        result.max_age = parseInt(agedMatch[1], 10);
    }
    return result;
}
/**
 * Detect country name or ISO code in query.
 * COUNTRY_MAP maps lowercased country names and ISO codes to ISO codes.
 */
function parseCountry(q) {
    const lower = q.toLowerCase();
    // Try to find a 2-letter ISO code (e.g. "NG", "AO")
    const isoMatch = q.match(/\b([A-Z]{2})\b/);
    if (isoMatch) {
        const iso = isoMatch[1].toUpperCase();
        if (countryMap_1.COUNTRY_MAP[iso.toLowerCase()]) {
            return iso;
        }
    }
    // Try country name — search by longest match to avoid partial hits
    const sortedEntries = Object.entries(countryMap_1.COUNTRY_MAP).sort(([a], [b]) => b.length - a.length);
    for (const [key, code] of sortedEntries) {
        if (lower.includes(key)) {
            return code;
        }
    }
    return undefined;
}
function parseNaturalLanguageQuery(q) {
    const lower = q.toLowerCase().trim();
    if (!lower)
        return null;
    const result = {};
    const words = lower.split(/\s+/);
    // Gender
    for (const word of words) {
        const clean = word.replace(/[^a-z]/g, '');
        if (GENDER_KEYWORDS[clean]) {
            result.gender = GENDER_KEYWORDS[clean];
            break;
        }
    }
    // Age group
    for (const word of words) {
        const clean = word.replace(/[^a-z]/g, '');
        if (AGE_GROUP_KEYWORDS[clean]) {
            result.age_group = AGE_GROUP_KEYWORDS[clean];
            break;
        }
    }
    // "young" keyword → age range 16–24
    for (const word of words) {
        if (YOUNG_KEYWORDS.includes(word)) {
            result.min_age = 16;
            result.max_age = 24;
            break;
        }
    }
    // Explicit age ranges (may override young's defaults)
    const ageRanges = parseAgeRanges(lower);
    if (ageRanges.min_age !== undefined)
        result.min_age = ageRanges.min_age;
    if (ageRanges.max_age !== undefined)
        result.max_age = ageRanges.max_age;
    // Country
    const country = parseCountry(q); // use original case for ISO detection
    if (country)
        result.country_id = country;
    // If we couldn't parse anything meaningful, return null
    const hasFilters = result.gender ||
        result.age_group ||
        result.country_id ||
        result.min_age !== undefined ||
        result.max_age !== undefined;
    if (!hasFilters)
        return null;
    return result;
}
