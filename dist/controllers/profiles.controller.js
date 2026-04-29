"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfiles = getProfiles;
exports.exportProfiles = exportProfiles;
exports.searchProfiles = searchProfiles;
exports.getProfileById = getProfileById;
exports.createProfile = createProfile;
exports.deleteProfile = deleteProfile;
const axios_1 = __importDefault(require("axios"));
const Profile_1 = require("../models/Profile");
const nlpParser_1 = require("../utils/nlpParser");
const response_1 = require("../utils/response");
// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildProfileFilter(query) {
    const filter = {};
    if (query.gender)
        filter.gender = query.gender;
    if (query.age_group)
        filter.age_group = query.age_group;
    if (query.country_id)
        filter.country_id = query.country_id.toUpperCase();
    const minAge = query.min_age !== undefined ? parseInt(query.min_age, 10) : undefined;
    const maxAge = query.max_age !== undefined ? parseInt(query.max_age, 10) : undefined;
    if (minAge !== undefined || maxAge !== undefined) {
        const ageCond = {};
        if (minAge !== undefined)
            ageCond.$gte = minAge;
        if (maxAge !== undefined)
            ageCond.$lte = maxAge;
        filter.age = ageCond;
    }
    const minGP = query.min_gender_probability !== undefined
        ? parseFloat(query.min_gender_probability) : undefined;
    if (minGP !== undefined)
        filter.gender_probability = { $gte: minGP };
    const minCP = query.min_country_probability !== undefined
        ? parseFloat(query.min_country_probability) : undefined;
    if (minCP !== undefined)
        filter.country_probability = { $gte: minCP };
    return filter;
}
function buildSort(query) {
    const allowed = ['age', 'created_at', 'gender_probability'];
    const field = allowed.includes(query.sort_by) ? query.sort_by : 'created_at';
    const dir = query.order === 'asc' ? 1 : -1;
    return { [field]: dir };
}
function parsePage(query) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || '10', 10)));
    return { page, limit, skip: (page - 1) * limit };
}
/** Map _id → id on lean() results */
function normalize(doc) {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
}
// ─── External API calls ───────────────────────────────────────────────────────
async function fetchGender(name) {
    try {
        const { data } = await axios_1.default.get(`https://api.genderize.io/?name=${encodeURIComponent(name)}`);
        return { gender: data.gender || 'male', probability: data.probability ?? 0.5 };
    }
    catch {
        return { gender: 'male', probability: 0.5 };
    }
}
async function fetchAge(name) {
    try {
        const { data } = await axios_1.default.get(`https://api.agify.io/?name=${encodeURIComponent(name)}`);
        return { age: data.age || 25 };
    }
    catch {
        return { age: 25 };
    }
}
async function fetchNationality(name) {
    try {
        const { data } = await axios_1.default.get(`https://api.nationalize.io/?name=${encodeURIComponent(name)}`);
        const top = data.country?.[0];
        if (!top)
            return { country_id: 'US', country_name: 'United States', probability: 0.5 };
        const countryName = await resolveCountryName(top.country_id);
        return { country_id: top.country_id, country_name: countryName, probability: top.probability };
    }
    catch {
        return { country_id: 'US', country_name: 'United States', probability: 0.5 };
    }
}
async function resolveCountryName(iso) {
    try {
        const { data } = await axios_1.default.get(`https://restcountries.com/v3.1/alpha/${iso}`);
        return data[0]?.name?.common || iso;
    }
    catch {
        return iso;
    }
}
// ─── Controllers ─────────────────────────────────────────────────────────────
/** GET /api/v1/profiles */
async function getProfiles(req, res) {
    try {
        const { page, limit, skip } = parsePage(req.query);
        const filter = buildProfileFilter(req.query);
        const sort = buildSort(req.query);
        const [docs, total] = await Promise.all([
            Profile_1.Profile.find(filter).sort(sort).skip(skip).limit(limit).lean(),
            Profile_1.Profile.countDocuments(filter),
        ]);
        const links = (0, response_1.buildPaginationLinks)('/api/v1/profiles', page, limit, total);
        res.json({
            status: 'success',
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
            links,
            data: docs.map(normalize),
        });
    }
    catch (err) {
        console.error('getProfiles error:', err);
        (0, response_1.sendError)(res, 'Failed to retrieve profiles', 500);
    }
}
/** GET /api/v1/profiles/export?format=csv */
async function exportProfiles(req, res) {
    try {
        if (req.query.format !== 'csv') {
            (0, response_1.sendError)(res, 'Only format=csv is supported', 400);
            return;
        }
        const filter = buildProfileFilter(req.query);
        const sort = buildSort(req.query);
        const docs = await Profile_1.Profile.find(filter).sort(sort).lean();
        const headers = [
            'id', 'name', 'gender', 'gender_probability',
            'age', 'age_group', 'country_id', 'country_name',
            'country_probability', 'created_at',
        ];
        const rows = docs.map((p) => [
            p._id,
            `"${p.name}"`,
            p.gender,
            p.gender_probability,
            p.age,
            p.age_group,
            p.country_id,
            `"${p.country_name}"`,
            p.country_probability,
            new Date(p.created_at).toISOString(),
        ].join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="profiles_${timestamp}.csv"`);
        res.send(csv);
    }
    catch (err) {
        console.error('exportProfiles error:', err);
        (0, response_1.sendError)(res, 'Export failed', 500);
    }
}
/** GET /api/v1/profiles/search?q=... */
async function searchProfiles(req, res) {
    try {
        const q = req.query.q?.trim();
        if (!q) {
            (0, response_1.sendError)(res, 'Missing or empty query parameter', 400);
            return;
        }
        const parsed = (0, nlpParser_1.parseNaturalLanguageQuery)(q);
        if (!parsed) {
            res.status(422).json({ status: 'error', message: 'Unable to interpret query' });
            return;
        }
        const { page, limit, skip } = parsePage(req.query);
        const filter = buildProfileFilter(parsed);
        const sort = buildSort(req.query);
        const [docs, total] = await Promise.all([
            Profile_1.Profile.find(filter).sort(sort).skip(skip).limit(limit).lean(),
            Profile_1.Profile.countDocuments(filter),
        ]);
        const links = (0, response_1.buildPaginationLinks)(`/api/v1/profiles/search?q=${encodeURIComponent(q)}`, page, limit, total);
        res.json({
            status: 'success',
            page, limit, total,
            total_pages: Math.ceil(total / limit),
            links,
            data: docs.map(normalize),
        });
    }
    catch (err) {
        console.error('searchProfiles error:', err);
        (0, response_1.sendError)(res, 'Search failed', 500);
    }
}
/** GET /api/v1/profiles/:id */
async function getProfileById(req, res) {
    try {
        const doc = await Profile_1.Profile.findById(req.params.id).lean();
        if (!doc) {
            (0, response_1.sendError)(res, 'Profile not found', 404);
            return;
        }
        res.json({ status: 'success', data: normalize(doc) });
    }
    catch {
        (0, response_1.sendError)(res, 'Failed to retrieve profile', 500);
    }
}
/** POST /api/v1/profiles  [admin only] */
async function createProfile(req, res) {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            (0, response_1.sendError)(res, 'Name is required', 400);
            return;
        }
        const trimmed = name.trim();
        const existing = await Profile_1.Profile.findOne({
            name: { $regex: new RegExp(`^${trimmed}$`, 'i') },
        });
        if (existing) {
            res.status(409).json({ status: 'error', message: 'Profile already exists' });
            return;
        }
        const [genderData, ageData, nationalityData] = await Promise.all([
            fetchGender(trimmed),
            fetchAge(trimmed),
            fetchNationality(trimmed),
        ]);
        const age = ageData.age;
        const age_group = (0, Profile_1.getAgeGroup)(age);
        const profile = await Profile_1.Profile.create({
            name: trimmed,
            gender: genderData.gender,
            gender_probability: genderData.probability,
            age,
            age_group,
            country_id: nationalityData.country_id,
            country_name: nationalityData.country_name,
            country_probability: nationalityData.probability,
        });
        const doc = profile.toObject();
        res.status(201).json({ status: 'success', data: normalize(doc) });
    }
    catch (err) {
        if (err.code === 11000) {
            res.status(409).json({ status: 'error', message: 'Profile already exists' });
            return;
        }
        console.error('createProfile error:', err);
        (0, response_1.sendError)(res, 'Failed to create profile', 500);
    }
}
/** DELETE /api/v1/profiles/:id  [admin only] */
async function deleteProfile(req, res) {
    try {
        const deleted = await Profile_1.Profile.findByIdAndDelete(req.params.id);
        if (!deleted) {
            (0, response_1.sendError)(res, 'Profile not found', 404);
            return;
        }
        res.json({ status: 'success', message: 'Profile deleted successfully' });
    }
    catch {
        (0, response_1.sendError)(res, 'Failed to delete profile', 500);
    }
}
