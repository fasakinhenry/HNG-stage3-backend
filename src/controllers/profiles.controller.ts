import { Request, Response } from 'express';
import axios from 'axios';
import { Profile, getAgeGroup } from '../models/Profile';
import { parseNaturalLanguageQuery } from '../utils/nlpParser';
import { sendError, buildPaginationLinks } from '../utils/response';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildProfileFilter(query: Record<string, unknown>): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.gender)     filter.gender     = query.gender;
  if (query.age_group)  filter.age_group  = query.age_group;
  if (query.country_id) filter.country_id = (query.country_id as string).toUpperCase();

  const minAge = query.min_age !== undefined ? parseInt(query.min_age as string, 10) : undefined;
  const maxAge = query.max_age !== undefined ? parseInt(query.max_age as string, 10) : undefined;
  if (minAge !== undefined || maxAge !== undefined) {
    const ageCond: Record<string, number> = {};
    if (minAge !== undefined) ageCond.$gte = minAge;
    if (maxAge !== undefined) ageCond.$lte = maxAge;
    filter.age = ageCond;
  }

  const minGP = query.min_gender_probability !== undefined
    ? parseFloat(query.min_gender_probability as string) : undefined;
  if (minGP !== undefined) filter.gender_probability = { $gte: minGP };

  const minCP = query.min_country_probability !== undefined
    ? parseFloat(query.min_country_probability as string) : undefined;
  if (minCP !== undefined) filter.country_probability = { $gte: minCP };

  return filter;
}

function buildSort(query: Record<string, unknown>): Record<string, 1 | -1> {
  const allowed = ['age', 'created_at', 'gender_probability'];
  const field   = allowed.includes(query.sort_by as string) ? (query.sort_by as string) : 'created_at';
  const dir: 1 | -1 = (query.order as string) === 'asc' ? 1 : -1;
  return { [field]: dir };
}

function parsePage(query: Record<string, unknown>) {
  const page  = Math.max(1, parseInt((query.page  as string) || '1',  10));
  const limit = Math.min(50, Math.max(1, parseInt((query.limit as string) || '10', 10)));
  return { page, limit, skip: (page - 1) * limit };
}

/** Map _id → id on lean() results */
function normalize(doc: any) {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

// ─── External API calls ───────────────────────────────────────────────────────

async function fetchGender(name: string) {
  try {
    const { data } = await axios.get(`https://api.genderize.io/?name=${encodeURIComponent(name)}`);
    return { gender: data.gender || 'male', probability: data.probability ?? 0.5 };
  } catch {
    return { gender: 'male', probability: 0.5 };
  }
}

async function fetchAge(name: string) {
  try {
    const { data } = await axios.get(`https://api.agify.io/?name=${encodeURIComponent(name)}`);
    return { age: data.age || 25 };
  } catch {
    return { age: 25 };
  }
}

async function fetchNationality(name: string) {
  try {
    const { data } = await axios.get(`https://api.nationalize.io/?name=${encodeURIComponent(name)}`);
    const top = data.country?.[0];
    if (!top) return { country_id: 'US', country_name: 'United States', probability: 0.5 };
    const countryName = await resolveCountryName(top.country_id);
    return { country_id: top.country_id, country_name: countryName, probability: top.probability };
  } catch {
    return { country_id: 'US', country_name: 'United States', probability: 0.5 };
  }
}

async function resolveCountryName(iso: string): Promise<string> {
  try {
    const { data } = await axios.get(`https://restcountries.com/v3.1/alpha/${iso}`);
    return data[0]?.name?.common || iso;
  } catch {
    return iso;
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/** GET /api/v1/profiles */
export async function getProfiles(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePage(req.query);
    const filter = buildProfileFilter(req.query);
    const sort   = buildSort(req.query);

    const [docs, total] = await Promise.all([
      Profile.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Profile.countDocuments(filter),
    ]);

    const links = buildPaginationLinks('/api/v1/profiles', page, limit, total);

    res.json({
      status: 'success',
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
      links,
      data: docs.map(normalize),
    });
  } catch (err) {
    console.error('getProfiles error:', err);
    sendError(res, 'Failed to retrieve profiles', 500);
  }
}

/** GET /api/v1/profiles/export?format=csv */
export async function exportProfiles(req: Request, res: Response): Promise<void> {
  try {
    if (req.query.format !== 'csv') {
      sendError(res, 'Only format=csv is supported', 400);
      return;
    }

    const filter = buildProfileFilter(req.query);
    const sort   = buildSort(req.query);
    const docs   = await Profile.find(filter).sort(sort).lean();

    const headers = [
      'id', 'name', 'gender', 'gender_probability',
      'age', 'age_group', 'country_id', 'country_name',
      'country_probability', 'created_at',
    ];

    const rows = docs.map((p: any) =>
      [
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
      ].join(',')
    );

    const csv       = [headers.join(','), ...rows].join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="profiles_${timestamp}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('exportProfiles error:', err);
    sendError(res, 'Export failed', 500);
  }
}

/** GET /api/v1/profiles/search?q=... */
export async function searchProfiles(req: Request, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    if (!q) { sendError(res, 'Missing or empty query parameter', 400); return; }

    const parsed = parseNaturalLanguageQuery(q);
    if (!parsed) {
      res.status(422).json({ status: 'error', message: 'Unable to interpret query' });
      return;
    }

    const { page, limit, skip } = parsePage(req.query);
    const filter = buildProfileFilter(parsed as Record<string, unknown>);
    const sort   = buildSort(req.query);

    const [docs, total] = await Promise.all([
      Profile.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Profile.countDocuments(filter),
    ]);

    const links = buildPaginationLinks(
      `/api/v1/profiles/search?q=${encodeURIComponent(q)}`,
      page, limit, total
    );

    res.json({
      status: 'success',
      page, limit, total,
      total_pages: Math.ceil(total / limit),
      links,
      data: docs.map(normalize),
    });
  } catch (err) {
    console.error('searchProfiles error:', err);
    sendError(res, 'Search failed', 500);
  }
}

/** GET /api/v1/profiles/:id */
export async function getProfileById(req: Request, res: Response): Promise<void> {
  try {
    const doc = await Profile.findById(req.params.id).lean() as any;
    if (!doc) { sendError(res, 'Profile not found', 404); return; }
    res.json({ status: 'success', data: normalize(doc) });
  } catch {
    sendError(res, 'Failed to retrieve profile', 500);
  }
}

/** POST /api/v1/profiles  [admin only] */
export async function createProfile(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      sendError(res, 'Name is required', 400);
      return;
    }

    const trimmed = name.trim();

    const existing = await Profile.findOne({
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

    const age       = ageData.age;
    const age_group = getAgeGroup(age);

    const profile = await Profile.create({
      name:                trimmed,
      gender:              genderData.gender,
      gender_probability:  genderData.probability,
      age,
      age_group,
      country_id:          nationalityData.country_id,
      country_name:        nationalityData.country_name,
      country_probability: nationalityData.probability,
    });

    const doc = profile.toObject() as any;
    res.status(201).json({ status: 'success', data: normalize(doc) });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ status: 'error', message: 'Profile already exists' });
      return;
    }
    console.error('createProfile error:', err);
    sendError(res, 'Failed to create profile', 500);
  }
}

/** DELETE /api/v1/profiles/:id  [admin only] */
export async function deleteProfile(req: Request, res: Response): Promise<void> {
  try {
    const deleted = await Profile.findByIdAndDelete(req.params.id);
    if (!deleted) { sendError(res, 'Profile not found', 404); return; }
    res.json({ status: 'success', message: 'Profile deleted successfully' });
  } catch {
    sendError(res, 'Failed to delete profile', 500);
  }
}
