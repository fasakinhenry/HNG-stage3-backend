# Test Tokens for /submit

Generated: 2026-04-29

## Admin Test Token (access token for admin user)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTlkZGIyNS02OTJkLTczODctYTZkZS1mOTdlMDY2MmYxZTUiLCJ1c2VybmFtZSI6InRlc3QtYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzc3NDk4MTU1LCJleHAiOjE3Nzc0OTgzMzV9.omAqvwzbq5g2w6VRMlVPGPwG5shpizO3aS0Chzz2FKc
```

## Analyst Test Token (access token for analyst user)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTlkZGIyNS02YWM0LTc2ZjctYjFkYi1mYzJiYzE2NjY5NmEiLCJ1c2VybmFtZSI6InRlc3QtYW5hbHlzdCIsInJvbGUiOiJhbmFseXN0IiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3NzQ5ODE1NSwiZXhwIjoxNzc3NDk4MzM1fQ.CBqNZhT0F3kkfRrYuXjAfmCz6UlefsRjMsMYYhmNuUI
```

## Refresh Test Token (refresh token paired with admin token)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTlkZGIyNS02OTJkLTczODctYTZkZS1mOTdlMDY2MmYxZTUiLCJ1c2VybmFtZSI6InRlc3QtYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTc3NzQ5ODE1NSwiZXhwIjoxNzc3NDk4NDU1fQ.tRX5czGVcXZQffQBTnRdQPM4DVfmceR4XTH4YiuOZyw
```

---

## How to use

1. Navigate to `/submit` in your stage-3-backend
2. Fill in the form with:
   - **Admin Test Token**: Copy the admin access token above
   - **Analyst Test Token**: Copy the analyst access token above
   - **Refresh Test Token** (optional): Copy the refresh token paired with the admin token

## Token Details

- **User IDs**:
  - Admin: `019ddb25-692d-7387-a6de-f97e0662f1e5`
  - Analyst: `019ddb25-6ac4-76f7-b1db-fc2bc166696a`

- **TTL**:
  - Access tokens: 3 minutes
  - Refresh tokens: 5 minutes

- **Credentials**:
  - Admin: `@test-admin`
  - Analyst: `@test-analyst`

## To regenerate tokens

Run the following command from the backend directory:

```bash
npm run gen:test-tokens
```

This will create fresh test users and generate new tokens if the old ones expire or you need to reset.
