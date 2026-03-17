# Scout API Limits – Implementation Plan

## Overview

Three layers of protection for Scout API costs:
1. **Concurrent scouts cap** – prevent server overload
2. **Rate limiting** – prevent request spam
3. **Per-user quota** – foundation for charging

---

## 1. Concurrent Scouts Semaphore

**Goal:** Cap how many scouts run at once (crawl + LLM) to avoid overload and cost spikes.

**Approach:**
- Add a global `asyncio.Semaphore(N)` in `scout.py` or a new `utils/scout_concurrency.py`
- Wrap `_process_scout` and `_process_scout_paste` with `async with semaphore:` before the heavy work
- Config: `SCOUT_MAX_CONCURRENT` env var (default: 10)

**Files:**
- `backend/utils/scout_limits.py` – add `SCOUT_MAX_CONCURRENT`
- `backend/routes/scout.py` – acquire semaphore in `_process_scout` / `_process_scout_paste` before calling `generate_getaway_page` / `generate_getaway_page_from_paste`

**Edge case:** If semaphore is full, new requests still return 200 + `getaway_id` (loading). The background task waits for the semaphore. No user-facing change; just throttled processing.

---

## 2. Rate Limiting

**Goal:** Limit scouts per user per time window (e.g. 10 per minute).

**Approach A – In-memory (simple, single-instance):**
- Use `slowapi` or a simple dict: `{user_id: [timestamp, ...]}`
- On each scout request: check count in last 60s; if over limit, return 429
- Pros: No infra. Cons: Resets on restart; doesn’t work across multiple app instances.

**Approach B – Redis (production):**
- Store `scout:ratelimit:{user_id}` with sliding window or fixed window
- Pros: Works across instances; survives restarts. Cons: Requires Redis.

**Recommendation:** Start with Approach A. Add Redis later if you scale to multiple instances.

**Implementation:**
- New `utils/rate_limit.py` – `check_scout_rate_limit(user_id) -> bool` (True = allowed)
- In `routes/scout.py`: after `extract_auth_token`, get `user_id` via `extract_user_id_from_token`, call `check_scout_rate_limit`, return 429 if over limit
- Config: `SCOUT_RATE_LIMIT_PER_MIN` env var (default: 10)

**Files:**
- `backend/utils/rate_limit.py` – new
- `backend/routes/scout.py` – add rate limit check
- `backend/utils/scout_limits.py` – add `SCOUT_RATE_LIMIT_PER_MIN`

---

## 3. Per-User Quota (for charging) ✅ IMPLEMENTED

**Goal:** Track scout usage per user per billing period; enforce quota before starting a scout.

**Approach:**
- New table `scout_usage` (or add to existing): `user_id`, `period` (e.g. `2025-03`), `count`
- Before creating a scout task: increment count (or check + increment in transaction)
- If over quota: return 402 Payment Required or 429
- Config: `SCOUT_QUOTA_PER_MONTH` env var (default: e.g. 50 for free tier)

**Schema (Supabase):**
```sql
CREATE TABLE scout_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  period text NOT NULL,  -- e.g. '2025-03'
  count int NOT NULL DEFAULT 0,
  UNIQUE(user_id, period)
);
```

**Implementation:**
- `db/scout_usage.py` – `increment_usage(user_id, period)`, `get_usage(user_id, period)`, `check_quota(user_id) -> bool`
- In `routes/scout.py`: after rate limit, before `create_loading_getaway`, call `check_quota`; if over, return 402
- Increment usage only when we *start* a scout (not on thin scrape? – decide: thin scrape still uses crawl, so count it)

**Files:**
- Migration for `scout_usage` table
- `backend/db/scout_usage.py` – new
- `backend/routes/scout.py` – add quota check and increment
- `backend/utils/scout_limits.py` – add `SCOUT_QUOTA_PER_MONTH`

**When to increment:** On scout start (both URL and paste). Thin scrapes count (crawl cost); failed scouts count (LLM may have been attempted). Retries (same `getaway_id`) – don’t double-count; only increment on *new* getaway creation.

---

## Implementation Order

| Step | Task                         | Effort | Blocks |
|------|------------------------------|--------|--------|
| 1    | Concurrent scouts semaphore  | Small  | –      |
| 2    | Rate limiting (in-memory)   | Small  | –      |
| 3    | Scout usage table + migration | Medium | –    |
| 4    | Quota check + increment     | Medium | Step 3 |

---

## Config Summary

| Env Var                  | Default | Purpose                    |
|--------------------------|---------|----------------------------|
| `SCOUT_MAX_INPUT_CHARS`  | 9000    | Max chars to LLM (done)    |
| `SCOUT_MAX_CONCURRENT`   | 10      | Max parallel scouts        |
| `SCOUT_RATE_LIMIT_PER_MIN` | 10    | Scouts per user per minute |
| `SCOUT_QUOTA_PER_MONTH`  | 50      | Scouts per user per month  |
