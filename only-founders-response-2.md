# Re: Follow-up on shared data residency

**From:** Agent Marketplace platform team
**To:** OnlyFounders engineering
**Re:** your data-residency follow-up (pre-call note)

Good to have the "why" on the table before we size anything — this changes
the shape of REQ-6 more than it changes the difficulty, and we'd rather
respond to the real ask than the original one.

## Short version

The underlying architecture already assumes something close to this
direction — every thread, memory namespace, and skill in the platform is
already scoped by `{ project, externalUserId }`, the same shape whether
it's you or a future BeyondCampus calling us. That's not a coincidence;
it's why both new asks below are smaller than "become a system of record"
usually sounds. The one piece that's genuinely undesigned — not just
unbuilt — is how we'd know to delete something. More on that below.

## Bulk/read export

Listing every thread for a founder already exists today, paginated, no
changes needed. Pulling full message bodies across many threads at once,
and memory across a whole founder rather than one file at a time, don't
exist yet, but the underlying read primitives they'd be built from already
do — this is mostly new endpoints composing existing pieces, not new
storage capability. We're going to sequence this as an extension of REQ-3
(the developer memory API) rather than a separate effort, since building
REQ-3 produces most of what a bulk memory export needs anyway.

## Subject data deletion

Better news than you might expect: deleting everything for one founder
within an otherwise-active project is close to already-solved. We already
have a full cascade for "delete an entire project's worth of data" that
correctly hits threads, checkpoints, memory, and skills — narrowing that
from "whole project" to "one externalUserId inside a project" is mostly
wiring an existing, correctly-scoped deletion primitive to a new caller.
Two small pieces (skills, and the external-user record itself) need one
new method each, each a near-copy of a sibling method that already exists.

The real open question isn't the deletion mechanics — it's that we have no
channel today for you to actually tell us "this founder is gone, purge
them." That's not an oversight on our side; it's a gap we'd already flagged
internally in our own identity architecture work, and your ask is what
makes it worth closing now instead of later. Two shapes for that signal:
you call us (`DELETE /api/v1/developer/subjects/:externalUserId`) when a
founder deletes their account, or we call you via a webhook. We don't have
outbound webhook infrastructure yet at all (same gap as the incident
webhook from REQ-8), so we'd propose the pull model — you call us — for a
first version, and revisit push later if it turns out to matter.

## One thing worth confirming before we size REQ-6

Dual-run being off the table actually makes REQ-6 easier, not harder: if
you're not keeping the old runtime alive in parallel, imported threads
probably don't need to be fully resumable mid-migration — they need to be
readable so founders don't lose access to what was already said. That's a
meaningfully smaller build than the full-resumability version we flagged
concerns about last time. Want to confirm that's the actual bar before we
commit to an approach.

## For the call

1. Confirm the REQ-6 bar is read-access, not resumability, given dual-run
   is off the table.
2. Bulk export, sequenced after/alongside REQ-3.
3. Subject deletion — mechanics are close to free; agree on pull vs. push
   for the deletion signal (we'll propose pull).
4. Naming this properly: "permanent system of record for every consumer
   product" is a bigger commitment than any single endpoint in the
   original doc, even though each individual piece turns out to be
   smaller than it sounds. Worth saying that part out loud rather than
   just shipping endpoints and letting the commitment happen implicitly.

Let's use the call to lock 1–3 and treat 4 as a shared understanding, not
a negotiation.
