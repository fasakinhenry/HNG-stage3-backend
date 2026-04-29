# Insighta Labs+ — Backend API

Secure, multi-interface demographic intelligence platform. Built with **Node.js + TypeScript + Express + MongoDB**.

---

## System Architecture

```
insighta-backend/
├── src/
│   ├── config/          # env + database connection
│   ├── controllers/     # auth, profiles, users
│   ├── middleware/       # authenticate, requireRole, requireApiVersion, rateLimiter, logger
│   ├── models/          # User, Profile, RefreshToken (Mongoose)
│   ├── routes/          # auth, profiles, users
│   ├── services/        # GitHub OAuth service
│   └── utils/           # jwt helpers, response helpers, NLP parser, country map
└── index.ts             # Express app entry point
```

**Three repos, one backend:**
- CLI (`insighta-cli`) — Bearer token auth, talks to this API
- Web portal (`insighta-web`) — HTTP-only cookie auth, same API
- Backend (this repo) — single source of truth

---

## Authentication Flow

### CLI (PKCE)

```
insighta login
  ↓
CLI generates: state, code_verifier, code_challenge (SHA-256 of verifier)
CLI starts local HTTP server on random port
CLI opens: GET /api/v1/auth/github?state=...&code_verifier=...
  ↓
GitHub OAuth page → user authenticates
GitHub redirects to: GET /api/v1/auth/github/callback?code=...&state=...
  ↓
Backend resolves code_verifier from PKCE store (keyed by state)
Backend exchanges code + code_verifier with GitHub
Backend upserts user, issues access_token + refresh_token
Backend returns JSON (CLI flow detected by ?cli=1 or Accept: application/json)
  ↓
CLI stores tokens in ~/.insighta/credentials.json
CLI prints: ✅ Logged in as @username
```

### Web Portal (Browser)

```
User clicks "Continue with GitHub"
Browser → GET /api/v1/auth/github
  ↓
GitHub OAuth → GET /api/v1/auth/github/callback
Backend issues tokens, sets HTTP-only cookies
  access_token cookie: maxAge 3m
  refresh_token cookie: maxAge 5m, path=/api/v1/auth/refresh
Browser redirected to /dashboard
```

---

## Token Handling

| Token        | TTL       | Storage (CLI)                         | Storage (Web)         |
|-------------|-----------|---------------------------------------|----------------------|
| access_token | 3 minutes | `~/.insighta/credentials.json`        | HTTP-only cookie     |
| refresh_token | 5 minutes | `~/.insighta/credentials.json`        | HTTP-only cookie     |

- Refresh tokens are **single-use**: revoked immediately after use, new pair issued
- Tokens stored in MongoDB (`refresh_tokens` collection) with TTL index for auto-cleanup
- On every CLI request: if access token expired, auto-refresh silently; if refresh expired too, prompt re-login

---

## Role Enforcement

| Role    | Permissions                                         |
|---------|-----------------------------------------------------|
| admin   | Full access: list, get, search, create, delete, export |
| analyst | Read-only: list, get, search, export                |

- Default role on first login: **analyst**
- `ADMIN_GITHUB_USERNAME` in `.env` → first user matching that GitHub username gets **admin**
- Enforcement via `requireRole('admin')` middleware — centralized, not scattered
- All `/api/v1/*` routes require `authenticate` middleware first
- Deactivated users (`is_active: false`) receive **403 Forbidden** on all requests

---

## API Versioning

All profile and user endpoints require:
```
X-API-Version: 1
```
Missing → `400 Bad Request`

---

## Pagination Shape

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "total_pages": 203,
  "links": {
    "self": "/api/v1/profiles?page=1&limit=10",
    "next": "/api/v1/profiles?page=2&limit=10",
    "prev": null
  },
  "data": [...]
}
```

---

## Natural Language Parsing

Rule-based only. No AI, no LLMs.

### Supported keywords

**Gender:**
- `male`, `males`, `men`, `man`, `boy`, `boys` → `gender=male`
- `female`, `females`, `women`, `woman`, `girl`, `girls` → `gender=female`

**Age groups:**
- `child`, `children`, `kid`, `kids` → `age_group=child`
- `teenager`, `teen`, `adolescent` → `age_group=teenager`
- `adult`, `adults` → `age_group=adult`
- `senior`, `elderly`, `old` → `age_group=senior`

**"young" keyword:** → `min_age=16, max_age=24` (not a stored age group)

**Age ranges:**
- `above N` / `over N` / `older than N` → `min_age=N`
- `below N` / `under N` / `younger than N` → `max_age=N`
- `between N and M` / `from N to M` → `min_age=N, max_age=M`
- `aged N` → `min_age=N, max_age=N`

**Countries:** 50+ country names, demonyms, and ISO codes supported.
Examples: `nigeria`, `nigerian`, `NG`, `ghana`, `ghanaian`, `GH`, etc.

**Example mappings:**
```
"young males"                    → gender=male, min_age=16, max_age=24
"females above 30"               → gender=female, min_age=30
"people from angola"             → country_id=AO
"adult males from kenya"         → gender=male, age_group=adult, country_id=KE
"male and female teenagers above 17" → age_group=teenager, min_age=17
```

### Limitations
- Cannot parse compound gender ("male and female" — takes first match: male)
- Country detection uses substring matching — rare false positives for short names (e.g., "in", "ne")
- No support for relative terms like "middle-aged"
- Queries with zero parseable tokens return `Unable to interpret query`

---

## Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/auth/github` | Redirect to GitHub OAuth |
| GET | `/api/v1/auth/github/callback` | OAuth callback |
| POST | `/api/v1/auth/refresh` | Refresh token pair |
| POST | `/api/v1/auth/logout` | Revoke refresh token |
| GET | `/api/v1/auth/me` | Get current user |

### Profiles (require `X-API-Version: 1` + Bearer token)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/v1/profiles` | analyst+ | List with filters/sort/pagination |
| GET | `/api/v1/profiles/search?q=` | analyst+ | Natural language search |
| GET | `/api/v1/profiles/export?format=csv` | analyst+ | CSV export |
| GET | `/api/v1/profiles/:id` | analyst+ | Get by ID |
| POST | `/api/v1/profiles` | admin | Create profile |
| DELETE | `/api/v1/profiles/:id` | admin | Delete profile |

### Users (require `X-API-Version: 1` + admin role)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/users` | List users |
| GET | `/api/v1/users/:id` | Get user |
| PATCH | `/api/v1/users/:id/role` | Update role |
| PATCH | `/api/v1/users/:id/status` | Activate/deactivate |

---

## Rate Limiting

| Scope | Limit |
|-------|-------|
| `/api/v1/auth/*` | 10 req/min |
| All other endpoints | 60 req/min per user |

---

## Setup

```bash
cp .env.example .env
# Fill in: MONGODB_URI, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT secrets

npm install
npm run dev        # Development with hot reload
npm run build      # Compile TypeScript
npm start          # Production
```

---

## Engineering Standards

- Conventional commits with scope: `feat(auth): add github oauth`
- Feature branches → PRs → main
- CI/CD: GitHub Actions runs lint + build on PR to main
- All secrets via environment variables
- Standardized error format: `{ "status": "error", "message": "..." }`
