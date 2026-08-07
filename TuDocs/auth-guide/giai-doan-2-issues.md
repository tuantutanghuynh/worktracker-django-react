# Phase 2 — Issues (3 days)

Copy each block below into a separate GitHub issue (the title = the `##`
line, the rest = the issue body).

---

## [Auth][Day 1] Set Up Redis for the Project

**Description**

Install and configure Redis to prepare for the JWT blacklist mechanism used
on logout (see `docs/auth-guide/02-jwt-and-tokens.md` — the section
"Blacklist on Logout"). This issue only covers the connection infrastructure,
not the actual logout logic.

**Tasks**

- [ ] Install the Redis server (`brew install redis` on Mac), then start it with `brew services start redis`
- [ ] Install a Python library for Redis connectivity (`pip install redis` or `django-redis`) and add it to `requirements.txt`
- [ ] Configure the Redis connection in `settings.py` (host, port, and a dedicated DB index for the blacklist)
- [ ] Write a small test in `manage.py shell`: `SET`/`GET` a sample key and confirm the retrieved value is correct

**Acceptance Criteria**

- The Redis server runs locally (`redis-cli ping` returns `PONG`)
- Django can connect to Redis, and a test `SET`/`GET` succeeds via the shell

**Labels:** `backend`, `auth`, `infra`
**Related:** `docs/auth-guide/09-giai-doan-2-roadmap.md` (section "Day 1")

---

## [Auth][Day 2] Logout API — Store JTI in the Redis Blacklist

**Description**

When a user calls the Logout API, the access token they are currently using
must be marked as "revoked" in Redis, using `jti` (JWT ID) as the key and a
TTL equal to the token's remaining lifetime, so Redis can automatically clean
up the key when the token would expire anyway.

**Tasks**

- [ ] Implement `LogoutView` (`POST /api/auth/logout/`), requiring a valid access token in the header (`IsAuthenticated`, not `AllowAny`)
- [ ] Extract the `jti` and `exp` claims from the token used in the request
- [ ] Compute the TTL as `exp - current time` (in seconds)
- [ ] Call Redis with `SETEX blacklist:<jti> <ttl> "1"`
- [ ] Return `200 OK` after the blacklist entry is stored successfully
- [ ] Add the `logout/` route to `accounts/urls.py`

**Acceptance Criteria**

- Calling `POST /api/auth/logout/` with a valid access token returns 200
- After the call, the key `blacklist:<jti>` appears in Redis with a TTL close to the token's remaining lifetime
- Calling `/logout/` WITHOUT a token returns 401 (because it requires `IsAuthenticated`)

**Labels:** `backend`, `auth`
**Related:** `docs/auth-guide/09-giai-doan-2-roadmap.md` (section "Day 2")

---

## [Auth][Day 2-3] Custom Authentication — Block Blacklisted Tokens

**Description**

Writing blacklist entries to Redis (the issue above) has no effect unless
something actually checks them. Override SimpleJWT's authentication class so
that **every request** checks Redis before trusting a token as valid.

**Tasks**

- [ ] Create a class that inherits from `JWTAuthentication`, overriding `get_validated_token()` to check whether the `jti` exists in the Redis blacklist
- [ ] If it exists in the blacklist, raise `AuthenticationFailed("Token has been revoked.")`
- [ ] Update `DEFAULT_AUTHENTICATION_CLASSES` in `settings.py` to point to the new class (replacing the default `JWTAuthentication`)
- [ ] Manual test: call a protected API with a logged-out token and verify it returns 401

**Acceptance Criteria**

- A blacklisted token causes every protected API to return 401 immediately, without waiting for the token to expire naturally
- A token that has NOT been blacklisted yet (not logged out) continues to work normally and is unaffected

**Labels:** `backend`, `auth`, `security`
**Related:** `docs/auth-guide/09-giai-doan-2-roadmap.md` (section "Day 2-3")

---

## [Auth][Day 3] End-to-End Integration Test for Login → Logout → Token Reuse

**Description**

Run an end-to-end test to confirm that all of Phase 2 works correctly
together, not just as isolated pieces. Record the results in a document using
the same format as Phase 1 (`docs/auth-guide/giai-doan-1-log/05-testing-va-ket-qua.md`).

**Tasks**

- [ ] Test 1: Log in and receive access + refresh tokens (200)
- [ ] Test 2: Call a protected API using that access token and verify it succeeds (200)
- [ ] Test 3: Log out using that access token (200)
- [ ] Test 4: Call the same API from Test 2 again using the SAME old access token and verify it is rejected (401)
- [ ] Test 5: Log in again to get a NEW access token, call the API, and verify it still succeeds (200), confirming the blacklist does not incorrectly block another user or a different token
- [ ] Write a file under `docs/auth-guide/giai-doan-2-log/` to record the test results (following the Phase 1 format)

**Acceptance Criteria**

- All 5 test cases above behave as expected
- A test result log file exists under `docs/`

**Labels:** `backend`, `auth`, `testing`
**Related:** `docs/auth-guide/09-giai-doan-2-roadmap.md` (section "Day 3")
