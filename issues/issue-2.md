---
title: "Skills Modal (Create/Edit) Is Broken for Long Instructions — Needs Full Redesign into a Dedicated Page or Scrollable Sheet"
labels: bug, ux, skills, modal, responsive
assignees: []
---

## 🐛 Bug Report + UX Failure — SkillDialog Cannot Handle Real-World Skill Content

### Summary

The `SkillDialog` component (`frontend/src/components/skills/skill-dialog.jsx`) is used for **both creating and editing skills**. It renders inside a shadcn `<Dialog>` with a fixed max-width of `sm:max-w-[600px]`. 

The core problem: **skills are designed to hold long-form `SKILL.md`-style instruction documents** — potentially hundreds or thousands of words of workflow rules, logic, and examples. The modal has a fixed-height `<Textarea rows={8}>` for the instructions field with **no overflow scroll on the dialog itself**. As soon as the `instructions` content grows beyond ~8 lines, the modal **overflows the viewport**, the footer buttons get clipped off the bottom of the screen, and on mobile the entire form becomes unusable.

This is a fundamental design mismatch: a fixed-size dialog being used for content that is inherently unbounded in length.

---

## 🔍 Exact Bugs Found in Code

### Bug 1 — Dialog has no vertical scroll (`skill-dialog.jsx` Line 71)

```jsx
// frontend/src/components/skills/skill-dialog.jsx  Line 71
<DialogContent className="sm:max-w-[600px]">
```

The `DialogContent` is given only a max-width constraint. There is **no `max-h`, no `overflow-y-auto`, no `flex flex-col`** applied to the content wrapper. When the instructions textarea grows tall (or when the user pastes in a large SKILL.md body), the dialog box expands downward past the screen bottom.

The `DialogFooter` (containing Cancel and Save buttons) is a **sibling of the form body inside the dialog**, not sticky-positioned. So as the dialog overflows, the Save button scrolls out of view — the user literally **cannot submit the form** without scrolling inside a non-scrollable container.

```jsx
// The full structure — no overflow control anywhere:
<Dialog>
  <DialogContent className="sm:max-w-[600px]">   {/* ← NO max-h, NO overflow */}
    <form>
      <DialogHeader />          {/* title */}
      <div className="grid gap-6 py-6">   {/* ← grows unboundedly */}
        <Input />               {/* name */}
        <Textarea rows={2} />   {/* description */}
        <Textarea rows={8} />   {/* instructions — this is the main offender */}
        <div>...</div>          {/* isPublic toggle */}
      </div>
      <DialogFooter>            {/* ← CLIPS OFF SCREEN when content is tall */}
        <Button>Cancel</Button>
        <Button>Save Skill</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### Bug 2 — Instructions textarea has fixed `rows={8}` with no resize control (`skill-dialog.jsx` Line 132)

```jsx
// Line 132
<Textarea
  id="instructions"
  rows={8}
  className="font-mono text-sm bg-muted/20"
  // NO resize="none", NO max-h, NO overflow-y-auto on the textarea itself
/>
```

The textarea is set to 8 rows but by default HTML textareas are vertically resizable. When the user **drags the textarea handle to make it taller**, the dialog grows with it and again pushes the footer off-screen. Alternatively, if the browser or CSS disables resize, the user is trapped editing a large SKILL.md in 8 visible lines with no comfortable editing surface.

### Bug 3 — Skill name field forces kebab-case silently but gives no live feedback (`skill-dialog.jsx` Lines 92–100)

```jsx
// Lines 92-100
onChange={(e) =>
  update(
    "name",
    e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")   // ← replaces spaces with hyphens silently
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, ""),
  )
}
```

When the user types `"My Skill"`, it becomes `"my-skill"` silently. There is **no inline hint, badge, or live preview** showing "Your skill will be saved as: `my-skill`". Users unfamiliar with kebab-case naming get confused when their input changes under their fingers. The label says `"Skill Name (kebab-case)"` in tiny muted text but there is no validation feedback or guidance on why their cursor position jumps.

### Bug 4 — No character counter on `instructions` field despite an uncapped backend schema

```jsx
// skill-dialog.jsx — instructions Textarea has no maxLength or char counter
// Skill.js model — instructions field has NO maxlength defined:
instructions: {
  type: String,
  required: true,   // ← no maxlength!
}
// skill.validator.js — instructions only enforces min(10), no max:
instructions: z.string().min(10, '...'),   // ← no .max()
```

The `instructions` field has **no maximum length enforced** at either the model or validator level. A user can paste an entire 50,000-word document. The dialog textarea gives no feedback about content length, which causes:
- Enormous payloads sent to the API
- MongoDB document size concerns (16MB BSON limit)
- The dialog UI becoming completely unusable due to overflow

### Bug 5 — Search in header is `hidden` on mobile, no mobile fallback (`page.jsx` Lines 90–102)

```jsx
// page.jsx  Line 90
<div className="hidden w-72 md:block">   // ← search bar hidden on mobile!
  <InputGroup>...</InputGroup>
</div>
```

On screens narrower than `md` (768px), the search bar in the header is `hidden`. There is **no inline search fallback** on the page body for mobile users. Mobile users cannot search their skills at all.

### Bug 6 — Skill card title truncated too aggressively at 150px (`page.jsx` Line 173)

```jsx
// page.jsx  Line 173
<h3 className="font-bold text-base truncate max-w-[150px]">
  {skill.name}
</h3>
```

The skill name is hardcoded to truncate at `max-w-[150px]` (roughly 18–20 characters). A name like `"advanced-data-analysis-pipeline"` gets cut to `"advanced-data-anal..."`. This is a fixed pixel width that doesn't adapt to card size, and the truncation gives no tooltip or `title` attribute to reveal the full name.

### Bug 7 — Delete confirmation fires `getUsedByAgents` API call inside a `DropdownMenuItem onClick` with no loading state (`page.jsx` Lines 200–208)

```jsx
// page.jsx  Lines 200-208
<DropdownMenuItem className="text-destructive ..." onClick={async () => {
  setDeleteTarget(skill);
  try {
    const res = await getUsedByAgents(skill.id || skill._id);
    setUsedByAgents(res.data?.data || []);
  } catch (err) {
    console.error("Failed to load referencing agents", err);  // ← silent failure!
  }
}}>
```

- The API call happens inside a dropdown item click handler with **no loading spinner**.
- If the request is slow, the delete dialog opens immediately showing 0 agents (because the async call hasn't resolved yet), and the agent list appears after a delay — users may confirm deletion before seeing the warning.
- **Failure is silently swallowed** — `console.error` only, no toast or UI indicator.
- `usedByAgents` state is **never cleared** between delete targets — if you delete Skill A (which has 3 agents) and immediately try to delete Skill B (which has 0 agents), Skill B's dialog still shows Skill A's 3 agents until the new fetch completes.

### Bug 8 — `editTarget` state stale between opens: `useEffect` depends on `[skill, open]` but `skill` object reference doesn't change on re-open of same skill (`skill-dialog.jsx` Lines 32–43)

```jsx
// skill-dialog.jsx  Lines 32-43
useEffect(() => {
  if (skill) {
    setForm({
      name: skill.name || "",
      description: skill.description || "",
      instructions: skill.instructions || "",
      isPublic: skill.isPublic || false,
    });
  } else {
    setForm(DEFAULT_FORM);
  }
}, [skill, open]);
```

If the user:
1. Opens the edit dialog for Skill A → makes changes → closes without saving
2. Immediately reopens the edit dialog for Skill A

The `skill` reference is the same object (from `mySkills` array), so the `useEffect` **does not re-run** (React does object reference equality for deps). The form retains the user's unsaved edits from step 1 rather than resetting to the saved skill data. This is a subtle but real data integrity bug.

---

## 📸 Impact Summary

| Bug | Severity | Users Affected |
|-----|----------|---------------|
| Dialog overflow — Save button unreachable on long instructions | 🔴 Critical | Anyone editing a real SKILL.md doc |
| Fixed `rows={8}` textarea with no scroll | 🔴 Critical | All users |
| No char counter on instructions, no max enforced | 🟠 High | Power users |
| Mobile search hidden with no fallback | 🟠 High | All mobile users |
| Skill name truncated at fixed 150px | 🟡 Medium | Users with long skill names |
| Delete dialog race condition + stale agents list | 🟠 High | All users |
| Stale form state on re-open same skill | 🟡 Medium | Users who abandon edits |
| No live kebab-case preview | 🟡 Medium | New users |

---

## ✅ Proposed Solution — Replace Modal with a Full-Page Skill Editor (or Scrollable Sheet)

The modal pattern is fundamentally wrong for editing long-form `SKILL.md` content. There are two viable alternatives:

### Option A — Dedicated `/dashboard/skills/[id]/edit` Page (Recommended)

Replace the dialog entirely with a dedicated route that gives the instructions field a full-page editor:

```
/dashboard/skills/new          ← create
/dashboard/skills/[id]/edit    ← edit
```

- The `instructions` field becomes a **full-height CodeMirror or Monaco editor** with markdown syntax highlighting (since SKILL.md is markdown).
- The page layout has a sticky header with Save / Cancel buttons — always visible regardless of content length.
- This matches how the Agent Builder works (dedicated page, not a modal).

### Option B — Scrollable Sheet (if modal must be kept)

Convert `<Dialog>` to a `<Sheet side="right">` (shadcn Sheet) which is designed for long-form content:

```jsx
// Replace Dialog with Sheet
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";

<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent className="flex flex-col w-full sm:max-w-2xl">
    <SheetHeader>...</SheetHeader>
    <form className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto py-6 space-y-6 px-1">
        {/* all fields */}
      </div>
      <SheetFooter className="border-t pt-4 shrink-0">
        {/* sticky footer with Save/Cancel */}
      </SheetFooter>
    </form>
  </SheetContent>
</Sheet>
```

Key fix: `flex flex-col flex-1 min-h-0` on the form + `overflow-y-auto` on the body + `shrink-0` on the footer keeps the Save button always visible.

### Option C — Minimum Fix for the Current Dialog (stopgap)

If neither A nor B can be done immediately, at minimum:

```jsx
// skill-dialog.jsx — fix the DialogContent
<DialogContent className="sm:max-w-[680px] flex flex-col max-h-[90vh]">
  <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
    <DialogHeader className="shrink-0">...</DialogHeader>
    <div className="flex-1 overflow-y-auto grid gap-6 py-6 pr-1">
      {/* fields */}
    </div>
    <DialogFooter className="shrink-0 border-t pt-4">
      {/* buttons — now always visible */}
    </DialogFooter>
  </form>
</DialogContent>
```

---

## 📋 Implementation Checklist

### Phase 1 — Critical Fixes (Stopgap)
- [ ] Add `max-h-[90vh] flex flex-col` to `DialogContent`
- [ ] Add `flex-1 overflow-y-auto` to the fields wrapper `div`
- [ ] Add `shrink-0` to `DialogFooter` so it never scrolls out of view
- [ ] Add `resize-none` to instructions `Textarea` to prevent manual overflow
- [ ] Clear `usedByAgents` state before each delete dialog open
- [ ] Wrap `getUsedByAgents` call in a loading state; show spinner in delete dialog while fetching
- [ ] Fix stale `useEffect` for `skill` re-opens: add a `skillId` key prop or use `JSON.stringify` dependency

### Phase 2 — Full UX Redesign (Recommended)
- [ ] Create `/dashboard/skills/new` and `/dashboard/skills/[id]/edit` dedicated page routes
- [ ] Add a full-height instructions editor (CodeMirror or `<Textarea>` inside a `ScrollArea` with `min-h-[300px] max-h-[60vh]`)
- [ ] Add live kebab-case preview beneath the name field: `"Will be saved as: my-skill"`
- [ ] Add a character counter to the instructions field (e.g., `"1,240 characters"`)
- [ ] Add `maxlength` to `instructions` in both `Skill.js` model and `skill.validator.js` (suggest `50000` chars / ~50KB)
- [ ] Fix mobile search: add an inline `<Input>` search bar on the page body for `sm` and below

### Phase 3 — Skill Card Polish
- [ ] Remove hardcoded `max-w-[150px]` on skill name; use `truncate` with a `title` tooltip instead
- [ ] Add `title={skill.name}` attribute so hovering reveals the full name
- [ ] Add instruction preview: show the first line of `skill.instructions` as a subtle subtitle on the card

---

## 📎 Affected Files

| File | Issue | Change Needed |
|------|-------|---------------|
| `frontend/src/components/skills/skill-dialog.jsx` | Dialog overflow, stale form, no scroll | Add `max-h`, `overflow-y-auto`, fix `useEffect` key, add `shrink-0` footer |
| `frontend/src/app/dashboard/skills/page.jsx` | Hidden mobile search, 150px truncation, delete race condition, stale agents | Inline mobile search, fix `max-w`, clear `usedByAgents`, add loading state |
| `agent-backend/src/models/Skill.js` | No `maxlength` on `instructions` | Add `maxlength: 50000` |
| `agent-backend/src/validators/skill.validator.js` | No `.max()` on instructions | Add `.max(50000)` |

---

## 🔗 Related Files

- Dialog component: `frontend/src/components/skills/skill-dialog.jsx`
- Skills page: `frontend/src/app/dashboard/skills/page.jsx`
- Skill model: `agent-backend/src/models/Skill.js`
- Skill validator: `agent-backend/src/validators/skill.validator.js`
- Skill service: `agent-backend/src/services/skill.service.js`
- Skills API lib: `frontend/src/lib/api/skills.js`
