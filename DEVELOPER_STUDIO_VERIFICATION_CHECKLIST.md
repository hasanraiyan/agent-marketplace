# Developer Studio (Phase 11) — Manual Verification Checklist

Covers PR-55 (backend) through PR-59 (frontend), none of which were visually verified in a browser
this session (Chrome extension never connected). Test against the running dev servers
(`frontend` on :3001, `agent-backend`).

Use a real Persona account that is (or will become) a Project Admin. Where useful, open two
browser profiles/Projects to check cross-Project isolation.

---

## 1. Access & navigation

- [ ] Navigate to `/developer` while signed out → redirected to sign-in (Clerk auth-gated, same as `/studio`)
- [ ] Sign in, navigate to `/developer` → redirects straight to `/developer/projects`
- [ ] Sidebar shows "Developer Studio" branding, a single "Projects" nav item, a "New Project" CTA, and a "Back to Persona" link
- [ ] "Back to Persona" link returns to the main dashboard

## 2. Projects list (`/developer/projects`)

- [ ] With zero Projects: empty state renders ("No Projects yet" + "Create your first Project" button)
- [ ] With Projects: table shows Name (linked), Slug, Status badge, Created date
- [ ] Status badge color: ACTIVE = green outline, SUSPENDED = grey, DELETING = red, DELETED = outline
- [ ] Clicking a Project name navigates to its detail page
- [ ] "New Project" button (top of page) navigates to the create form

## 3. Create Project (`/developer/projects/new`)

- [ ] Form shows Name (required), Slug (optional), Description (optional textarea)
- [ ] Submitting with only Name filled succeeds
- [ ] Submitting with a duplicate slug shows a clear error toast, not a crash
- [ ] On success, redirects to the new Project's detail page and you land there as its Admin automatically
- [ ] "Cancel" returns to the Projects list without creating anything

## 4. Project detail — Overview tab

- [ ] Header shows Project name + status badge
- [ ] Card shows Slug, Description, Created date
- [ ] "Edit" button opens a dialog pre-filled with current values
- [ ] Editing Name/Slug/Description and saving updates the page immediately, dialog closes, success toast shown
- [ ] Canceling the edit dialog discards changes

### Lifecycle actions (test on a disposable test Project, not a real one)

- [ ] **Suspend** (ACTIVE only): confirm dialog appears → confirming flips status to SUSPENDED, badge updates
- [ ] After suspending, Suspend button disappears, Reactivate button appears
- [ ] **Reactivate** (SUSPENDED, self-suspended): confirm dialog → confirming flips status back to ACTIVE
- [ ] Delete button is visible in both ACTIVE and SUSPENDED states
- [ ] **Delete**: dialog requires typing `DELETE` exactly — button stays disabled until the text matches
- [ ] Confirming delete flips status to DELETING, shows "Cancel Deletion" instead of Suspend/Delete
- [ ] **Cancel Deletion** (DELETING only): confirm dialog → confirming returns status to ACTIVE
- [ ] A DELETED Project (if you can reach one) shows a read-only tombstone message, no action buttons

## 5. Project detail — Members tab

- [ ] Table lists current Admins: Persona User ID, Role badge, Joined date
- [ ] "Add Admin" opens a dialog asking for a Persona User ID (note: no email lookup in v1 — you need the raw internal id)
- [ ] Adding a valid existing Persona User ID succeeds, appears in the table
- [ ] Adding a nonexistent Persona User ID shows a clear "not found" error toast
- [ ] "Remove" on a non-last Admin: confirm dialog → succeeds, row disappears
- [ ] "Remove" on the **last remaining Admin**: server rejects with a 400 → error toast shown, Admin is NOT removed (last-Admin invariant)

## 6. Project detail — Credentials tab

- [ ] Table lists credentials: Key ID, Label, Status badge, Last used
- [ ] "Mint new" opens a dialog with an optional Label field
- [ ] Minting closes that dialog and opens a **separate** one-time secret dialog showing Key ID + full plaintext secret
- [ ] Copy button on the secret copies it to clipboard (toast confirms "Copied to clipboard")
- [ ] Closing the secret dialog and reopening the Credentials tab — the plaintext secret is never shown again anywhere
- [ ] New credential appears in the table with status ACTIVE
- [ ] "Revoke" on an ACTIVE credential: confirm dialog → status flips to REVOKED, Revoke button disappears for that row

## 7. Project detail — read-only resource tabs

For a Project that already owns some Agents/Skills/Knowledge/Connectors/Providers (create a few via the existing Studio or SDK first if none exist):

- [ ] **Agents** tab lists Name/Description/Created — matches what actually exists for this Project
- [ ] **Skills** tab — same
- [ ] **Knowledge** tab — same
- [ ] **Connectors** tab — same (MCP connectors)
- [ ] **Providers** tab lists Label/Base URL/Default Model/Created (different columns from the others — confirm it renders correctly, not blank)
- [ ] Every one of these 5 tabs has **zero** create/edit/delete controls — confirms Studio stays read-only for resources (SDK/API-key is the only way to manage them)
- [ ] A Project with none of a given resource type shows the correct empty-state text (e.g. "No Agents yet.")

## 8. Cross-Project isolation (spot check)

- [ ] Project A's Admin cannot see Project B's Projects, Members, Credentials, or resources anywhere in Studio
- [ ] Navigating directly to `/developer/projects/<project-B-id>` as Project A's Admin is rejected (404, not a data leak)

## 9. General

- [ ] No console errors on any of the above pages (check browser devtools)
- [ ] Dark mode (if you use it) renders all badges/dialogs/tables legibly
- [ ] Mobile/narrow viewport doesn't horizontally overflow the page (tables should scroll within their own container, not the whole page)

---

**If you find a real bug**, note the page, the exact steps, and what you expected vs. what happened — that's enough for a fast fix, no need to file it formally first.
