# Backend Analytics Events Audit

All analytics events are sent to Mixpanel via the EU endpoint (`api-eu.mixpanel.com`). IP geolocation is disabled. Events flow through one of two functions:

- **`trackUserEvent`** - respects the user's analytics consent. With consent: uses a pseudonymous hashed user ID as `distinct_id` and includes `user_groups`. Without consent: uses a session UUID as `distinct_id`. 
- **`trackUserMapEvent`** - wraps `trackUserEvent`. With consent: also includes a hashed `map_id`. Without consent: `map_id` is omitted entirely.

When analtics consent is given, the `distinct_id` hash is SHA-256 of `userId + username + ANALYTICS_PEPPER` (server-side secret), truncated to 16 chars. The `map_id` hash is SHA-256 of `mapId + map.created_date + ANALYTICS_PEPPER`, truncated to 16 chars. Both are pseudonymous rather than anonymous.

---

## Events

### `User_Register`
**Trigger:** New user registers an account  
**Source:** `src/routes/user.ts`  
**Notes:** Fires before consent is possible. Uses a fresh random UUID (not stored) as `distinct_id` - genuinely anonymous, no PII.

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | random UUID | random UUID |
| `sharedMaps` | boolean | boolean |
| `user_groups` | — | — |

---

### `User_Feedback`
**Trigger:** User submits the in-app feedback form  
**Source:** `src/routes/user.ts`  
**Notes:** `sessionId` is hardcoded to `"0"` rather than the real session ID, so feedback cannot be linked to a user's other session activity. Free-text answers are sent regardless of consent - the consent check in `trackUserEvent` only controls `distinct_id` and `user_groups`, not the payload.

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | hashed user ID | `"0"` |
| `user_groups` | array of group names | — |
| `question_use_case` | string | string |
| `question_impact` | string | string |
| `question_who_benefits` | string | string |
| `question_improvements` | string | string |

---

### `User_ViewedGuide`
**Trigger:** User views the user guide when prompted  
**Source:** `src/routes/user.ts`

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | hashed user ID | session UUID |
| `user_groups` | array of group names | — |
| `source` | string (entry point) | string (entry point) |

---

### `Map_FirstSave`
**Trigger:** User saves a map for the first time  
**Source:** `src/queries/map.ts`

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | hashed user ID | session UUID |
| `user_groups` | array of group names | — |
| `map_id` | hashed map ID | — |
| `drawings_count` | number | number |

---

### `Map_Open`
**Trigger:** Map owner opens their map (not fired on first save)  
**Source:** `src/routes/map.ts`

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | hashed user ID | session UUID |
| `user_groups` | array of group names | — |
| `map_id` | hashed map ID | — |
| `drawn_count` | number | number |

---

### `Map_SharedOpen`
**Trigger:** A non-owner opens a map that has been shared with them  
**Source:** `src/routes/map.ts`

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | hashed user ID | session UUID |
| `user_groups` | array of group names | — |
| `map_id` | hashed map ID | — |
| `drawn_count` | number | number |
| `access` | `"Readonly"` or `"Edit"` | `"Readonly"` or `"Edit"` |

---

### `Map_Share`
**Trigger:** Map owner shares their map with one or more users  
**Source:** `src/queries/map.ts`  
**Notes:** `sharedWith` entries are hashed user IDs for consenting recipients, `"NO_CONSENT"` for non-consenting registered recipients and `"PENDING_USER"` for unregistered recipients. This event is only fired if at least one new user is being granted access.

| Field | Consenting (owner) | Non-consenting (owner) |
|---|---|---|
| `distinct_id` | hashed owner user ID | session UUID |
| `user_groups` | array of group names | — |
| `map_id` | hashed map ID | — |
| `sharedWith` | array of hashed IDs / `"NO_CONSENT"` / `"PENDING_USER"` | array of hashed IDs / `"NO_CONSENT"` / `"PENDING_USER"` |

---

### `Map_Export_Shapefile`
**Trigger:** User exports their map as a shapefile  
**Source:** `src/routes/map.ts`

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | hashed user ID | session UUID |
| `user_groups` | array of group names | — |
| `map_id` | hashed map ID | — |

---

### `Map_Export_GeoJSON`
**Trigger:** Map owner creates a public GeoJSON link for their map  
**Source:** `src/routes/map.ts`

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | hashed user ID | session UUID |
| `user_groups` | array of group names | — |
| `map_id` | hashed map ID | — |

---

### `Map_GeoJsonOpen`
**Trigger:** An anonymous visitor opens a public map link (no login required)  
**Source:** `src/routes/map.ts`  
**Notes:** `userId` is `-1` (no real user). Consent is always false. `map_id` is never included.

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | — | — |
| `map_id` | — | — |

---

### `LandOwnership_Enable`
**Trigger:** User enables or switches the land ownership layer on a map  
**Source:** `src/queries/map.ts`

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | hashed user ID | session UUID |
| `user_groups` | array of group names | — |
| `map_id` | hashed map ID | — |
| `layer_id` | string (layer name) | string (layer name) |

---

### `LandOwnership_Backsearch`
**Trigger:** User searches for properties by owner name  
**Source:** `src/routes/map.ts`

| Field | Consenting | Non-consenting |
|---|---|---|
| `distinct_id` | hashed user ID | session UUID |
| `user_groups` | array of group names | — |
| `properties_count` | number of results | number of results |

---

## Defined but unused

`LandOwnership_SaveProperty` is declared in `src/instrument.ts` but never called anywhere in the codebase.
