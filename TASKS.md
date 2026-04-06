## Frontend Auth Integration Tasks (Assigned to: Jules)

Context: Backend authentication (API, tokens, email verification, password reset, etc.) is complete. The frontend currently has UI-only auth pages (Login, SignUp, ForgotPassword) with no real API integration or auth state.

Goals for this work:
1. Wire the existing auth screens to the backend auth endpoints.
2. Introduce a simple, reliable auth state layer on the frontend.
3. Update navigation and routes to respect authenticated vs anonymous users.

---

### Phase 1 

1. Review backend auth API
   - [ ] Read the backend OpenAPI/docs (`agent-backend/src/docs/openapi.js`) for `/api/v1/auth/*` endpoints:
     - `/api/v1/auth/register`
     - `/api/v1/auth/login`
     - `/api/v1/auth/logout`
     - `/api/v1/auth/verify-email-otp`
     - `/api/v1/auth/resend-otp`
     - `/api/v1/auth/forgot-password`
     - `/api/v1/auth/reset-password`
   - [ ] For each endpoint, note:
     - Required request body fields
     - Response shape (especially user, accessToken, refreshToken)
     - Error status codes and error payload format

2. Define frontend API base config
   - [ ] Confirm the base URL for the backend in development (e.g. `http://localhost:PORT/api/v1`).
   - [ ] Add or confirm a `VITE_API_BASE_URL` (or similar) env variable for the frontend.
   - [ ] Decide whether the frontend will rely on:
     - HTTP-only cookies only, or
     - Access token in memory/localStorage plus refresh token flow.
   - [ ] Document this decision briefly at the top of this section or in a comment in the API helper file.

3. Create a small auth API helper
   - [ ] Create a lightweight module in the frontend (for example: `src/lib/api.js` or `src/lib/authApi.js`) that wraps `fetch` (or your chosen client).
   - [ ] Implement functions (names can be adjusted to match team style):
     - `register(payload)` → calls `/api/v1/auth/register`.
     - `login(payload)` → calls `/api/v1/auth/login`.
     - `logout()` → calls `/api/v1/auth/logout`.
     - `requestPasswordReset(payload)` → calls `/api/v1/auth/forgot-password`.
     - `resetPassword(payload)` → calls `/api/v1/auth/reset-password`.
   - [ ] Ensure all helpers:
     - Read the base URL from env/config.
     - Throw or return structured errors so the UI can show messages (e.g. `message`, `fieldErrors`).

---

### Phase 2 

4. Introduce frontend auth state (context or hook)
   - [ ] Add a simple auth context or hook in the frontend (for example: `src/context/AuthContext.jsx` or `src/hooks/useAuth.js`).
   - [ ] Auth state should minimally track:
     - `user` (or `null`)
     - `isAuthenticated`
     - `isLoading` (initial auth check / in-flight calls)
     - `error` (last auth error, optional)
   - [ ] Implement basic actions:
     - `login(credentials)` → uses the auth API helper, stores tokens/session as per the chosen model, updates `user`.
     - `logout()` → clears tokens/session, calls backend logout if applicable, resets `user`.
   - [ ] On app start, perform a minimal “session check”:
     - If using cookies/session: call a small backend endpoint (if available) to fetch the current user profile.
     - If using tokens: attempt to load any stored token and, if valid, load user info.
   - [ ] Wrap `<App />` (or at least the router) with this auth provider so `useAuth` (or similar) is available everywhere.

5. Wire Login screen to backend
   - [ ] Replace the current `console.log('Login submitted')` in `src/pages/auth/Login.jsx` with a real submit handler that:
     - Reads email and password from form inputs.
     - Calls the `login` action from the auth context/hook.
     - Shows relevant error messages based on API response (e.g. invalid credentials, validation errors).
     - On success, redirects the user to a sensible post-login page (e.g. `/browse` or `/`).
   - [ ] Add visual feedback:
     - Disable the submit button while the login request is in flight.
     - Optionally show a spinner or “Signing in…” state.

6. Wire SignUp screen to backend
   - [ ] Replace the current `console.log('Sign up submitted')` in `src/pages/auth/SignUp.jsx` with a submit handler that:
     - Collects first name, last name, email, and password from the form.
     - Calls the `register` helper.
     - Handles success in one of two ways (confirm which with the team):
       - Auto-login after register and redirect to main app, or
       - Redirect to an email verification / “check your inbox” screen.
     - Shows validation or server errors inline.
   - [ ] Ensure Terms/Privacy links keep working; decide later if those routes need full pages.

7. Wire ForgotPassword screen to backend
   - [ ] Replace the current `console.log('Forgot password submitted')` in `src/pages/auth/ForgotPassword.jsx` with a real API call to `requestPasswordReset`.
   - [ ] Keep the existing success UI ("Check your email!") but only show it after a successful API response.
   - [ ] Handle error states (e.g. email not found, rate limiting) with a generic but helpful message.
   - [ ] Confirm if a dedicated `Reset Password` page with token input is needed and, if so, add a follow-up task for that screen.

---

### Phase 3 

8. Update navigation based on auth state
   - [ ] In `src/components/layout/Navbar.jsx`, replace the always-visible "Sign In" / "Get Started" buttons with conditional rendering based on `isAuthenticated`.
   - [ ] When authenticated:
     - Show a simple user avatar or initials and a dropdown/menu.
     - Include at least a `Logout` option that calls the auth context `logout()` and redirects to a public page.
   - [ ] When not authenticated:
     - Keep showing "Sign In" and "Get Started" buttons as they are now.

9. Basic route protection
   - [ ] Introduce a simple protected route wrapper (e.g. `RequireAuth` component) that:
     - Checks `isAuthenticated`.
     - If not authenticated and not currently loading, redirects to `/login` and optionally preserves the intended destination.
   - [ ] Apply this wrapper to any routes that should only be accessed when logged in (for now, identify at least one route with the team, such as a future profile or dashboard page).

10. Handle session expiration
   - [ ] Decide how the UI should react when the backend indicates the session/token is invalid or expired.
   - [ ] Implement a basic pattern in the API helper or auth context:
     - On `401`/`403` from protected calls, clear auth state and redirect to `/login` with a friendly message (e.g. "Session expired, please sign in again.").

---

### Phase 4 

11. Testing and sanity checks
   - [ ] Manually test the complete flows in the browser:
     - Signup → login (or email verification flow, if applicable).
     - Login with correct credentials.
     - Login with wrong credentials (verify error messaging).
     - Forgot password flow (ensure email is accepted and UI responds correctly).
     - Logout from navbar.
   - [ ] Add at least a couple of basic tests (if the project is ready for tests):
     - For the auth context/hook core logic (login/logout state transitions).
     - For the protected route component behavior.
   - [ ] Validate behavior on both desktop and mobile layouts (especially navbar auth controls).

---

Notes for Jules:
- Focus on minimal, clear implementations rather than over-abstracting.
- Prefer small, well-named helper functions and components over complex, multi-purpose ones.
- If any backend contract details are unclear (request/response shapes, error formats), sync with the backend team before guessing.
