## Collaboration Model

**Roles**

- **You (Lead):**
  - Define goals and priorities.
  - Approve or adjust plans.
  - Make scope, quality, and timeline tradeoffs.

- **Jules (Google coding agent):**
  - Executes code changes on this repo.
  - Creates branches/commits/PRs.
  - Runs builds/tests and applies fixes under guidance.

- **Assistant (Planner/Reviewer):**
  - Designs architecture and breaks work into phases.
  - Explores and analyzes the codebase.
  - Answers questions from you or Jules.
  - Reviews proposed changes, focusing on bugs, risks, and gaps.

---

## Workflow

1. **Goal Definition**
   - You define a high-level goal (example: "Complete frontend auth integration with backend v1").

2. **Planning (Assistant)**
   - Assistant reads the repo and:
     - Identifies current state.
     - Designs the approach.
     - Breaks work into clear phases and tasks.
     - Notes constraints (e.g., no new test runner yet, use React Context for auth state).

3. **Plan Approval (You)**
   - You review the plan.
   - You approve or request adjustments.
   - Once approved, you assign phases/tasks to Jules.

4. **Execution (Jules)**
   - Jules implements the approved plan:
     - Modifies code.
     - Runs lint/build/tests.
     - Opens PRs as needed.
   - If Jules is unsure or blocked, it asks you; you forward questions to the Assistant.

5. **Q&A and Guidance (Assistant)**
   - Assistant answers with:
     - Concrete file locations and patterns.
     - Specific design decisions and recommended behaviors.
     - Minimal, actionable instructions (not generic theory).

6. **Review (Assistant + You)**
   - You share diffs or descriptions of Jules's changes with Assistant.
   - Assistant reviews for:
     - Bugs and edge cases.
     - Security/auth issues.
     - Missing tests/checks.
     - UX problems.
   - Assistant produces:
     - A "must fix" list.
     - Optional "nice to have" improvements.
   - You feed this back to Jules for follow-up changes.

---

## Current Active Goal

- Implement frontend authentication integration with the existing backend auth APIs.
- Follow the phased plan in `TASKS.md` (Phases 1–4), with:
  - JWT bearer token strategy (accessToken in memory + localStorage).
  - No new frontend test framework in this ticket.
  - React Context + `useAuth` for auth state.
  - Protected `/profile` route as the initial auth-gated page.
