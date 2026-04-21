# Proprietors Search Endpoint

## Overview

`GET /api/proprietors` allows clients to search for land proprietors by name. It proxies the request to the Property Boundaries Service (PBS) and returns paginated results.

## Request

**Authentication:** Bearer token required (standard JWT auth).

**Query parameters:**

| Parameter    | Type    | Required | Default | Constraints             | Description                        |
|--------------|---------|----------|---------|-------------------------|------------------------------------|
| `searchTerm` | string  | Yes      | —       | 1–200 characters        | Partial or full proprietor name    |
| `page`       | integer | No       | `1`     | min 1                   | Page number                        |
| `pageSize`   | integer | No       | `10`    | min 1, max 100          | Number of results per page         |

**Example:**

```
GET /api/proprietors?searchTerm=Acme&page=1&pageSize=10
```

## Response

**200 OK**

```json
{
  "results": [
    { "id": "abc123", "proprietorName": "Acme Ltd" }
  ],
  "page": 1,
  "pageSize": 10,
  "totalResults": 42
}
```

**400 Bad Request** - returned when query validation fails (e.g. missing `searchTerm`, value out of range).

```json
{ "message": "\"searchTerm\" is required" }
```

**499** - returned when the client disconnects before the PBS response arrives. The in-flight PBS request is aborted via `AbortController`.

**500 Internal Server Error** - returned on unexpected errors from the PBS.

## Feature flag

Set `MEILISEARCH_ENABLED=true` in your `.env` to enable this endpoint. It is enabled by default in `.env.test`.

## Implementation

| File | Role |
|------|------|
| [src/routes/proprietors.ts](../src/routes/proprietors.ts) | Route definition, input validation, client-abort handling |
| [src/queries/proprietors.ts](../src/queries/proprietors.ts) | `searchProprietors()` - axios call to PBS `/proprietors` |
| [src/routes/proprietors.test.ts](../src/routes/proprietors.test.ts) | Unit tests |
