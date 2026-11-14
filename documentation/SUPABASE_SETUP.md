# Supabase setup

## Project configuration

Create or select the hosted Supabase project, then configure the following
values locally or in the deployment platform's secret manager:

| Variable | Where | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Backend | Project URL used by the API and health check. |
| `SUPABASE_PUBLISHABLE_KEY` | Backend | Public project key used with a verified user's access token for RLS-scoped API requests. |
| `SUPABASE_SECRET_KEY` | Backend only | Secret project key used only by the live connection check. Never expose it to browsers. |
| `VITE_SUPABASE_URL` | Frontend | Project URL used by Supabase Auth. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Public key used by Supabase Auth. |

Use the `sb_publishable_...` and `sb_secret_...` keys from the Supabase API
Keys page, or the legacy anon/service-role equivalents if the project still
uses legacy keys. The backend accepts legacy `SUPABASE_ANON_KEY` as the
publishable-key fallback and `SUPABASE_SERVICE_ROLE_KEY` as the secret-key
fallback for compatibility. Prefer the explicit names above. Do not put either
secret name in a `VITE_` variable. The browser Supabase client is initialized
lazily and reports which frontend values are missing.

Copy the templates to `backend/.env` and `frontend/.env` as needed. Do not
commit the resulting environment files or share secrets in logs or screenshots.

## Apply the migration to the hosted project

The migration `supabase/migrations/20261114000000_farmshift_schema.sql` is
additive: it creates the application tables, indexes, profile synchronization
trigger, grants, and row-level security policies. It also backfills profiles
for existing Auth users. It does not drop or rewrite existing objects. Review
it against any project-specific schema changes before applying.

Apply with either method:

1. In Supabase Dashboard, open **SQL Editor**, paste the migration contents,
   and run it against the intended project.
2. With the Supabase CLI installed, link this repository to the project and
   push pending migrations:

   ```powershell
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```

`supabase db push` applies pending migrations and does not reset the hosted
database. Do not use `supabase db reset` against the hosted project. If you
apply SQL manually, do not also run `db push` until the version is recorded in
migration history with `supabase migration repair --status applied
20261114000000`.

The migration creates `profiles`, `farms`, `climate_observations`,
`crop_catalog`, `crop_recommendations`, and `crop_rotation_plans`. Profiles
are inserted/updated from Supabase Auth user creation/email changes; passwords
remain exclusively managed by Supabase Auth and are never copied to profiles.
`confidence_level` is a fraction from `0` to `1`. Climate observations have a
unique `(farm_id, source, parameter, observation_date)` key so NASA fetches
can safely upsert repeated results for the same farm.

## Security model

RLS is enabled on all six tables. Farm rows require `owner_id = auth.uid()`.
Climate observations, crop recommendations, and rotation plans are accessible
only when their `farm_id` belongs to the authenticated user. Profiles are
selectable by their owner and only `full_name` can be updated by that user;
email and user type are not user-editable. Authenticated users can read the
crop catalog, which has no client write grant or write policy. No anonymous or
unrestricted write policy is created.

Protected API routes require a valid Supabase access token. The backend
validates it with Supabase Auth, then uses the publishable key and the same
user token for database operations. The database enforces ownership through
RLS. The secret key is used only for the health check's `profiles` query.

## Verify the hosted connection

Once the migration and backend variables are configured, run:

```powershell
npm run db:check --prefix backend
```

Or call `GET /api/health/supabase`. The endpoint executes a real select against
`profiles`; HTTP `200` with `{"success":true,"supabase":"connected"}` means
the Data API and table are reachable. A missing key, network error, or
unapplied migration returns HTTP `503` and a clear failure result. The check
does not merely test whether environment variables are present.

After signing in through Supabase Auth, send the session access token as a
Bearer token to `POST /api/farms`, `GET /api/farms`, or `PATCH /api/farms/:farmId`.
To persist NASA POWER data for the stored farm coordinates, use
`POST /api/farms/:farmId/climate-observations/nasa` with a JSON body such as:

```json
{
  "start": "20240101",
  "end": "20240103",
  "parameters": "T2M,PRECTOTCORR",
  "community": "AG"
}
```

Retrieve observations with `GET /api/farms/:farmId/climate-observations`;
optional `start` and `end` filters use `YYYY-MM-DD`. Access to farms and
observations belonging to another user is denied by RLS.

## Verification status

Repository tests verify Supabase client configuration, token-scoped requests,
health-check query behavior, request validation, and frontend/backend builds.
The configured hosted project was reached through the Supabase Data API, but
the read check returned PostgREST `PGRST205`: `public.profiles` is not present
in the API schema cache. The migration has not been applied, so hosted table
operations are not yet verifiable. Apply the migration, then rerun the health
check and test authenticated farm/observation operations with a Supabase user
access token. This is a real failed schema check, not a successful connection
claim.
