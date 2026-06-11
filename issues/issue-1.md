---
title: "Old / Long-Ago Threads Are Effectively Unreachable in the Sidebar"
labels: bug, ux, threads, sidebar, pagination
assignees: []
---

## 🐛 Bug Report — Thread Discovery Failure for Historically Used Agents

### Summary

If a user had a conversation with an agent **a long time ago** — and has since created many newer conversations with other agents — that old thread becomes **practically impossible to find** in the sidebar. The user has no search, no filter, and must blindly click **"Load More Chats"** an unbounded number of times to scroll back through time and reach it.

Even worse: the sidebar **groups threads by agent**, so a thread from Agent X that was used 3 months ago won't even appear under Agent X's group header until enough "Load More" pages have been fetched. The agent group itself may not appear in the sidebar at all until that historical page loads.

---

## 🔍 Reproduction Scenario

1. User creates 40+ threads across multiple agents over several weeks.
2. User had one early conversation with **Agent "Sage"** — say, thread #3 from 2 months ago.
3. User opens the dashboard sidebar.
4. ✅ Sidebar loads **page 1** → 20 most recent threads. Agent "Sage" is **not listed** (thread is on page 3).
5. User clicks **"Load More Chats"** → page 2 loads → Sage still not visible.
6. User clicks **"Load More Chats"** again → page 3 loads → Sage finally appears, buried at the bottom.
7. If the user has 100+ threads, this requires **5+ "Load More" clicks** before the old thread can even be seen, with zero indication that a specific agent exists in history.

---

## 🧠 Root Cause Analysis

### Backend — `threadRepository.js` `findByUser()`

```js
// agent-backend/src/repositories/threadRepository.js  Line 25-31
async findByUser(userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  return await Conversation.find({ userId, isArchived: false })
    .sort({ lastMessageAt: -1 })   // <- global recency sort across ALL agents
    .skip(skip)
    .limit(limit)
    .populate('agentId', 'name avatar slug');
}
```

The query fetches threads **globally sorted by `lastMessageAt` descending** with no awareness of per-agent grouping. If Agent X's most recent thread has `lastMessageAt = 60 days ago`, it will only appear after all threads with `lastMessageAt` within the past 60 days have been paginated through.

There is no endpoint to fetch threads **filtered by a specific agent**, and no count of how many total threads exist to inform the user how far back they need to scroll.

### Frontend — `threads-context.jsx` Pagination

```js
// frontend/src/components/threads-context.jsx  Line 106 + 134
const limit = 20;
// ...
setHasMore(newThreads.length === limit);  // <- only shows "Load More" if a full page returned
```

- Page size is hardcoded at `20`.
- `hasMore` detection is fragile: if exactly 20 threads exist and that's the last page, the button incorrectly shows "Load More" and fires one extra empty request.
- There is **no total count** returned from the API to render something like "Showing 20 of 143 threads".
- There is **no per-agent thread count** in the sidebar group header that reflects the true DB total — it only counts what has been loaded so far.

### Frontend — `nav-threads.jsx` Grouping

```js
// frontend/src/components/threads-context.jsx  Line 21-50
function groupThreadsByAgent(threads) {
  // Groups only the threads already loaded into memory.
  // An agent that exists in the DB but whose threads haven't been paginated
  // to yet simply does not appear in the sidebar at all.
}
```

The grouping function runs **only on the in-memory `threads` array**. An agent whose threads haven't been fetched yet is **completely invisible** in the sidebar, with no hint that it exists.

---

## 📸 Impact

| Scenario | Impact |
|---|---|
| User with 20+ threads, wants to resume an old conversation | Must click "Load More" multiple times with no progress indicator |
| User looks for a specific agent they used "a few weeks ago" | Agent group doesn't appear in sidebar at all until enough pages load |
| User wants to know "how many total threads do I have?" | Impossible — only loaded count is shown |
| User has 100+ threads | Finding a specific old thread takes O(n) manual clicks |

**Severity: High** — This breaks the core value proposition of the thread sidebar (quick access to past conversations) for any user with a meaningful chat history.

---

## ✅ Expected Behaviour

1. Any thread from any point in time should be **discoverable within 1–2 interactions**.
2. Agent group headers should be visible in the sidebar even if their threads haven't been paginated to yet, or show a count reflecting the real DB total.
3. The user should know **how many total threads exist** and have a progress indicator while paginating.

---

## 🛠️ Proposed Solutions

### Option A — Thread Search Endpoint + Sidebar Search Bar (Recommended)

Add a search endpoint on the backend and a search input in the sidebar above the thread list:

**Backend:**
```js
// New endpoint: GET /threads/search?q=<query>&agentId=<optional>
router.get('/search', threadController.search);
```

```js
// threadRepository.js — new method
async search(userId, { q, agentId, limit = 20 } = {}) {
  const filter = {
    userId,
    isArchived: false,
    ...(agentId ? { agentId } : {}),
    ...(q ? { title: { $regex: q, $options: 'i' } } : {}),
  };
  return await Conversation.find(filter)
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .populate('agentId', 'name avatar slug');
}
```

**Frontend:**
- Add a search `<input>` at the top of `NavThreads`.
- Debounce the input (300ms) and call a new `searchThreads(q)` API function.
- Show search results flat (ungrouped, or grouped) replacing the normal list.
- Clear search to return to the paginated view.

---

### Option B — Expose Total Count + Per-Agent Counts

Return total count from `GET /threads` and per-agent thread counts from a lightweight aggregation endpoint:

**Backend:**
```js
// Modified GET /threads response
{
  success: true,
  data: [...threads],
  meta: {
    page: 1,
    limit: 20,
    total: 143,
    totalPages: 8
  }
}
```

```js
// New endpoint: GET /threads/agent-summary
// Returns: [{ agentId, agentName, agentAvatar, totalThreads }]
// Allows sidebar to render ALL agent group headers immediately, even before
// their threads are paginated to, with the correct total count badge.
```

**Frontend:**
- Display "Showing 20 of 143 threads" below the list.
- Render all agent group headers immediately from `agent-summary`, with a "lazy load" for their thread lists.
- Replace dashed "Load More" button with a proper progress bar or infinite scroll.

---

### Option C — Per-Agent Paginated Loading (Alternative)

Instead of global pagination, fetch threads **per agent on demand**:
- Sidebar loads the list of agents the user has ever chatted with.
- Each agent group starts collapsed; expanding it fetches that agent's threads (`GET /threads?agentId=xxx`).
- Removes the need for global "Load More" entirely.

**Backend change needed:**
```js
// threadRepository.js
async findByUserAndAgent(userId, agentId, { page = 1, limit = 10 } = {}) {
  return await Conversation.find({ userId, agentId, isArchived: false })
    .sort({ lastMessageAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('agentId', 'name avatar slug');
}
```

---

## 📋 Implementation Checklist

### Phase 1 — Backend
- [ ] Add `total` / `totalPages` to `GET /threads` response (`threadRepository.findByUser` + controller)
- [ ] Add `GET /threads/search?q=` endpoint with title regex search
- [ ] Add `GET /threads/agent-summary` aggregation endpoint (agent + thread count per user)
- [ ] (Optional) Add `GET /threads?agentId=` filter support to `findByUser`

### Phase 2 — Frontend State
- [ ] Store `meta.total` and `meta.totalPages` in `ThreadsProvider`
- [ ] Add `searchQuery` state and `searchResults` to context
- [ ] Add `searchThreads(q)` API function to `frontend/src/lib/api/threads.js`

### Phase 3 — UI
- [ ] Add a search input at the top of `NavThreads` with debounce (300ms)
- [ ] Show search results replacing paginated list while query is active
- [ ] Show "Showing X of Y threads" counter below the thread list
- [ ] Replace "Load More Chats" button with an infinite scroll trigger (IntersectionObserver) or progress indicator
- [ ] Show all agent groups from `agent-summary` immediately on load, even before pagination reaches their threads

### Phase 4 — Edge Cases
- [ ] Handle empty search results with a friendly empty state
- [ ] Ensure search clears and returns to paginated view on input clear
- [ ] Fix off-by-one `hasMore` bug: use `total > page * limit` instead of `newThreads.length === limit`

---

## 📎 Affected Files

| File | Change Needed |
|---|---|
| `agent-backend/src/repositories/threadRepository.js` | Add `search()`, `getAgentSummary()`, add `total` to `findByUser()` |
| `agent-backend/src/controllers/thread.controller.js` | New `search` and `agentSummary` actions |
| `agent-backend/src/routes/thread.routes.js` | Register `GET /search` and `GET /agent-summary` |
| `frontend/src/lib/api/threads.js` | Add `searchThreads()` export |
| `frontend/src/components/threads-context.jsx` | Store `total`, add search state and `searchThreads` action |
| `frontend/src/components/nav-threads.jsx` | Add search input, counter, fix `hasMore` display |

---

## 🔗 Related

- Existing issue doc: `issue-thread-management-grouped-by-agent.md`
- Conversation model: `agent-backend/src/models/Conversation.js`
- Thread repository: `agent-backend/src/repositories/threadRepository.js`
