# API configuration

## Base URL and endpoints

The Express API is mounted at `/api`. The frontend uses the public
`VITE_API_BASE_URL` setting (normally `http://localhost:5000/api`) and appends
endpoint paths through its shared Axios client.

| Method and path | Purpose | Authentication |
| --- | --- | --- |
| `GET /api` | Lists the API's available endpoints. | None |
| `GET /api/health` | Confirms that the API process is reachable. | None |
| `GET /api/health/database` | Checks connectivity to the configured PostgreSQL database. | None |
| `GET /api/nasa/power/daily` | Proxies a validated daily point request to NASA POWER. | None |

`GET /api/health` returns:

```json
{
  "success": true,
  "message": "METHOD404 FarmShift AI API is running!",
  "project": "FarmShift AI",
  "team": "METHOD404"
}
```

### NASA POWER daily point request

Supply all required query parameters. Coordinates are decimal degrees,
`start` and `end` are valid calendar dates in `YYYYMMDD` format, and parameter
names are comma-separated NASA POWER parameter identifiers:

```text
GET /api/nasa/power/daily?latitude=13.45&longitude=-16.58&start=20240101&end=20240103&parameters=T2M,PRECTOTCORR&community=AG
```

`community` is optional and accepts `AG` (the default) or `RE`. The API returns
the NASA POWER JSON response without fabricating or transforming observations.
Responses for identical successful requests are cached in memory for five
minutes; concurrent identical requests share one upstream request. This cache
is process-local and is not a durable data store.

### Errors

Errors use a consistent JSON envelope:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_LATITUDE",
    "message": "latitude must be a number between -90 and 90."
  },
  "message": "latitude must be a number between -90 and 90."
}
```

Invalid NASA request parameters return `400`; disallowed production CORS
origins return `403`; NASA failures return `502`; NASA timeouts return `504`.
Unexpected backend failures return a generic `500` message and are logged
server-side without returning stack traces or credentials.

The browser Axios client applies a ten-second timeout and normalizes HTTP,
timeout, and connection failures into reusable user-facing errors. NASA
requests use a separate 15-second server-side timeout.

## CORS and authentication

CORS allows the configured `CORS_ORIGINS` values. Development additionally
allows local HTTP origins so Vite can use another local port. Production
rejects an unlisted browser origin. Requests without an `Origin` header are
allowed; CORS is not authentication or access control for non-browser clients.

No endpoint currently requires authentication. Supabase is configuration-only:
the backend has a PostgreSQL connection pool for `DATABASE_URL` and a database
health check, but no application queries, user authentication, or persistence
are implemented. Run `npm run db:check --prefix backend` to test the connection.
The Supabase service-role key and database URL are read only by backend
configuration and must never be copied into a `VITE_` variable.

## External data sources

NASA POWER daily point data is the only implemented external data proxy.
NASA SMAP, NASA GPM, and NASA MODIS remain planned and are not operational.
The upstream base URL is configurable through `NASA_POWER_BASE_URL`; no NASA
API key is required or invented.
