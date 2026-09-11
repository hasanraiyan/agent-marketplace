# Client session 3 — Tanvi Desai × Dev Raghavan

- **date:** 2026-09-11
- **skillPinned:** review-system-design-doc
- **judgeTotal:** 21/21
- **wouldReturn:** yes
- **biggestWeakness:** He didn’t explicitly force the client to articulate rejected alternatives; he supplied depth himself but didn’t practice the “what did you reject, and why?” narrative for the interview.
- **clientQuote:** I got a concrete score, the exact fix to rehearse, and two traced flows with SLOs and quotas I can copy into my doc.

### Client (Tanvi Desai)

Hi Dev, I have a staff interview next week. Can you review my design for a notification system? I'd use Kafka for ingestion, a worker pool to fan out, Redis for dedup, Postgres for user preferences, and SNS/FCM for delivery. Retries with exponential backoff. Thoughts?

### Dev Raghavan

Show me the numbers.

Paste your numbers in one compact block with explicit units, and separate average vs 5‑min peak. Include:
- users: ? MAU/DAU
- inbound notifications/sec (events to send): ? avg, ? 5‑min peak
- avg fanout (recipients per event): ?
- implied deliveries/sec: ? avg, ? 5‑min peak (events/sec * fanout)
- read:write ratio (reads = preference/lookups; writes = events + deliveries + logs): ?
- channel mix: email ?%, SMS ?%, push ?%, in‑app ?%
- dedup window/TTL: ? (e.g., 10 minutes) and dedup key definition
- avg payload size by channel: email ? KB, SMS ? B, push ? B, in‑app ? B
- data/year: ? events ingested, ? deliveries, ? preference updates
- retention: raw events ?, delivery logs ?, preference history ? (units)
- estimated storage/year (GB): show the math
- region: single or multi (which regions)

Then one line: what are the 2–3 things this system must do, and what is it explicitly not doing?

If you can’t estimate the numbers, make a defensible guess and put it here; I won’t read further until you do.

> 33.2s

### Client (Tanvi Desai)

Here — my best defensible estimates (I’ve filled gaps with explicit assumptions):

users: MAU=50,000,000; DAU=10,000,000

notifications (events to send): avg = 60,000,000/day = 694 events/sec avg; 5‑min peak = 6,000,000 in 5 min => 20,000 events/sec peak (assumption: worst 5‑min ~=10% of daily traffic)

avg fanout (recipients/event): 1.1

implied deliveries/sec: avg = 694 * 1.1 = 763 deliveries/sec; 5‑min peak = 20,000 * 1.1 = 22,000 deliveries/sec

read:write ratio (reads = preference/device lookups; writes = events + deliveries logs): ~2 reads : 1 write (assume ~2 lookups per delivery)

channel mix: email 50%, SMS 5%, push 30%, in‑app 15%

dedup window/TTL: 10 minutes; dedup key = hash(user_id + template_id + channel + optional business_id/timestamp_bucket)

avg payload size by channel: email 50 KB; SMS 160 B; push 1 KB; in‑app 2 KB

data/year: events ingested = 60M/day * 365 = 21,900,000,000 events/year (~21.9B); deliveries = events * 1.1 = 24,090,000,000 deliveries/year (~24.1B); preference updates = 5,000,000/year (assumption)

retention: raw events = 7 days; delivery logs = 365 days; preference history = 2 years

estimated storage/year (GB) — show math:
- raw events: 21.9B * 1 KB = 21,900 GB (~21.9 TB)
- delivery logs: 24.09B * 500 B = 12,045 GB (~12.0 TB)
- preference updates: 5M * 1 KB = 5 GB
- subtotal = 21,900 + 12,045 + 5 = 33,950 GB (~34.0 TB)
- add index/replica/overhead ~ x3 => ~102 TB total replicated storage/year

region: multi‑region (primary us‑east, replica eu‑west; optional apac read region)

Two–three must‑do’s: 1) guarantee no double‑sends (idempotent delivery and dedupe), 2) meet 5‑second delivery SLAs for transactional messages, 3) scale to ~22k deliveries/sec 5‑min peaks with graceful degradation.

Explicitly NOT doing: per‑recipient heavy personalization at send time (we assume precomputed templates/tokens), guaranteed cross‑channel ordering, or full real‑time analytics on every delivery (those are batched/async).

If any assumption (DAU, % in 5‑min peak, fanout) should be different, tell me and I’ll recompute immediately.

### Dev Raghavan

Scoring (0–3 each)
- Requirements & scope: 3 — clear must-dos and out-of-scope tied to channels
- Numbers: 3 — defensible estimates; I corrected retention math inline
- High-level design: 2 — components make sense; need explicit flows and provider rate limits
- Data & storage: 2 — Redis/Postgres okay as SoR+cache; logs need columnar/object store; durable idempotency store choice not locked
- Deep dive & trade-offs: 2 — intent good; I rewrote idempotency/dedup/retries to staff depth
- Failure & operations: 2 — you named retries/backoff; I added provider throttling, split-brain, cache stampede

Verdict
You’re close. Numbers are solid; biggest gaps are explicit flows, provider limits, and durable idempotency across regions. Adopt the rewritten idempotency section, set per-channel SLOs (exclude email from 5s), and state quotas and degradation. That moves you to pass range.

Highest-leverage fix
Write two traced flows and anchor SLOs at provider ack for SMS/push/in-app. Add the durable outbox with uniqueness + fencing.

[file presented: /workspace/outputs/notification-system-review.md]
Notification System — Staff‑level Design Review (numbers‑first, trade‑off driven)

Author: Dev Raghavan (Staff Eng, payments)

1) Scope and numbers (checked) — “numbers before boxes”
- Users: 50M MAU; 10M DAU
- Events (notifications to send): 60M/day ⇒ 694/s avg; peak: 6M in 5 min ⇒ 20,000/s (assumption: top 5 min = 10% of day)
- Avg fanout: 1.1 recipients/event
- Deliveries/sec: 763/s avg; 22,000/s peak
- Channel mix (of deliveries): email 50%, SMS 5%, push 30%, in‑app 15%
- Dedup window: 10 minutes; key = hash(user_id, template_id, channel, optional business_id, time_bucket)
- Reads per delivery: ~2 (preferences + device/tokens) ⇒ implied reads/sec: ~1,526/s avg; 44,000/s peak
- Region: multi‑region (primary us‑east, replica eu‑west, optional APAC read region)
- Retention: raw events 7 days; delivery logs 365 days; preference history 2 years
- Payload sizes: email 50 KB; SMS 160 B; push 1 KB; in‑app 2 KB
- Data/year: 21.9B events; 24.09B deliveries; 5M preference updates

Derived checks and contradictions
- Channel peak split (of 22k/s): email ~11,000/s; SMS ~1,100/s; push ~6,600/s; in‑app ~3,300/s.
- Read load: if 2 lookups/delivery, peak ~44k reads/s. Caching is mandatory; Postgres cannot be the hot path here without a cache/CDN layer.
- Storage math vs retention:
  • Your "raw events: 21.9 TB/year" conflicts with 7‑day retention. Steady‑state raw storage ≈ 21.9 TB * (7/365) ≈ 0.42 TB (≈ 420 GB), not 21.9 TB.
  • Delivery logs (365 days): 24.09B * 500 B ≈ 12.0 TB — OK as a yearly retained volume. Postgres is not a fit at this size; use object store + columnar.
  • Preference history: 5M/yr at 1 KB, 2‑year retention ⇒ ≈10 GB, not 5 GB.
  • Revised subtotal retained ≈ 0.42 TB (raw 7d) + 12.0 TB (logs 1y) + 0.01 TB (prefs 2y) ≈ 12.43 TB; apply 3x reproduction/overhead ⇒ ~37–40 TB effective.
- 5‑second delivery SLA: Reasonable for push/SMS/in‑app (p95), unrealistic for email end‑to‑end (SMTP + inbox placement). Treat email as best‑effort latency with separate SLOs.

Action needed to finalize numbers
- Confirm which channels the “5‑second delivery p95” applies to (likely SMS/push/in‑app). Define where the timer stops per channel (e.g., provider ack vs device receipt/read).
- State provider rate limits/quotas you’ll design to: SES/SparkPost TPS; SMS per‑sender TPS/10DLC/TFN/short code; APNs/FCM concurrency.

2) High‑level design (proposed structure tied to numbers)
Must‑dos: no double‑sends; 5s p95 for transactional (non‑email); handle 22k/s peaks with graceful degradation.

- Ingestion
  • Producers write NotificationEvent{event_id, tenant, template_id, user_ids|segments, channel_hint?, priority, dedup_key?, created_at, ttl} to Kafka topic notifications.v1 (keys: tenant + event_id). 200–400 partitions to parallelize peak 20k/s and keep consumer lag < 1s.

- Routing & fanout service (stateless workers, autoscaled)
  • Consumes notifications.v1, expands recipients (fanout=1.1), resolves per‑user channel eligibility & device tokens. Hot path reads from Redis (95%+ hit); Postgres is SoR, fed to Redis via CDC. Outputs ChannelOutbox records to per‑channel Kafka topics (email.outbox, sms.outbox, push.outbox, inapp.outbox).

- Idempotency & dedup (two layers)
  • Hot dedup: Redis SETNX with TTL (10–30 min) on (user_id, template_id, channel, business_id?, time_bucket) to cut obvious dupes.
  • Durable idempotency/outbox: Per‑channel Delivery table in DynamoDB (preferred) or sharded Postgres with unique key (message_id, user_id, channel). Exactly‑

> tools: write_file, present_file

> 148.9s

### Client (Tanvi Desai)

Thanks — this is exactly the direction I needed. Please write the two traced flows (1) happy‑path end‑to‑end and (2) failure path with provider throttling, retries/backoff, durable outbox + uniqueness/fencing, and explicit per‑channel SLOs (SMS/push/in‑app p95 = provider‑ack ≤5s; email = best‑effort with separate SLO); include per‑provider quota targets and graceful‑degradation behavior. Also — quick career Q: at my company would “staff” map to L6, and what comp band/range should I be negotiating for?

### Dev Raghavan

Two traced flows are written with SLOs, quotas, retries/backoff, durable outbox uniqueness, and multi‑region fencing. Copy-paste from the file and plug into your doc. If you want me to tune quotas to a specific provider (Twilio, SES, etc.), tell me your current limits and I’ll revise. 

On the career Q: That’s not my lane — talk to your recruiter or a career coach and benchmark on Levels.fyi. “Staff” mapping to L6 varies by company; confirm with your internal ladder and recruiter.

[file presented: /workspace/outputs/notification-two-traced-flows.md]
Notification System — Two Traced Flows (with SLAs, quotas, retries, idempotency, fencing)
Author: Dev Raghavan (Staff Eng, payments)

Numbers in scope (from your estimates)
- Peak deliveries/sec: 22,000/s overall → email ~11k/s; SMS ~1.1k/s; push ~6.6k/s; in‑app ~3.3k/s
- SLOs (explicit)
  • SMS/push/in‑app: p95 provider‑ack ≤ 5s; p99 ≤ 15s
  • Email: best‑effort; track p95 provider accept ≤ 30s (separate SLO), no end‑to‑end inbox‑delivery SLO
- Retry/delivery window (defaults)
  • OTP/transactional: max delivery window 2 minutes; max 5 attempts; exponential backoff with full jitter: 0.5s, 1s, 2s, 4s, 8s
  • Marketing/low‑priority: window 1 hour; attempts up to 10; backoff starting at 5s

Provider quota design targets (configure via token buckets; actual quotas vary by account)
- Email (ESP A + ESP B): target aggregate ≥ 13k msgs/s (buffer over 11k/s peak)
  • ESP A: 8k/s token bucket; ESP B: 5k/s token bucket; failover spill allowed up to +25% surge for ≤ 60s
- SMS (US focus; 10DLC + short codes)
  • Short code pool: 12 codes × 100 TPS ≈ 1,200 TPS target
  • Fallback TFN pool: 50 TFNs × 25 TPS ≈ 1,250 TPS (regional split and carrier caps apply)
  • Enforce per‑carrier per‑sender caps (e.g., 10DLC 1 TPS/number where applicable)
- Push
  • APNs/FCM not TPS‑capped in practice; set concurrency ceilings instead: APNs 10k concurrent conns; FCM 10k concurrent RPCs per region
- In‑app
  • Internal bus capacity reserved: 5k/s per region; burst 10k/s for ≤ 60s

Key invariants used in both flows
- Message identity: message_id = hash(event_id, user_id, channel, business_id?)
- Durable outbox uniqueness: a Delivery row exists per message_id; first writer wins via conditional put (or ON CONFLICT DO NOTHING returning existing)
- Regional fencing: a shard_owners table (shard_id, owner_region, lease_expires_at). Only owner_region may mutate Delivery rows for that shard.
- Hot dedup: Redis SETNX key=dedup:{message_id} with TTL=10–20 minutes to drop obvious dupes fast

Flow 1 — Happy path (transactional push; SMS/in‑app notes inline)
Goal: end‑to‑end p95 ≤ 5s measured at provider ack (push/SMS/in‑app). Email is best‑effort and follows the same shape but is excluded from the 5s SLO.

1) Producer enqueues event
   - Service emits NotificationEvent(event_id, users[], template_id, channel_hints, priority, business_id?, created_at) to Kafka topic notifications.v1 (keyed by tenant#event_id).
   - Budget: 10–50 ms app side; Kafka append p95 < 20 ms.

2) Router consumes and resolves delivery intent
   - Reads user prefs + device tokens from Redis (singleflight on miss; async warm from Postgres via CDC).
   - Applies hot dedup: Redis SETNX(dedup:{message_id}, TTL=20m). If already set → drop.
   - Emits ChannelOutbox message to push.outbox (or sms.outbox/inapp.outbox/email.outbox) with message_id and resolved payload.
   - Budget: 10–30 ms compute + 0.2–1 ms Redis p95.

3) Channel worker enforces durable idempotency and fencing
   - Reads shard ownership: shard_id = hash(user_id)%N; proceed only if owner_region==this_region and lease_expires_at>now. Otherwise drop/park message (no‑op) to avoid split‑brain.
   - Conditional create Delivery{message_id PK, user_id, channel, status=Pending, attempt=0, next_attempt_at=now, owner_region} in Delivery store (DynamoDB cond put OR Postgres INSERT ... ON CONFLICT DO NOTHING RETURNING row).
   - If row exists and is non‑retryable or already Sent/Delivered → drop; if retryable/ready → continue.
   - Budget: 2–10 ms (DynamoDB p

> tools: write_file, present_file

> 86.3s

### Client (Tanvi Desai)

Perfect — please copy‑paste those two traced flows into my notification doc (workspace/outputs/notification-system-review.md) and update the doc with per‑provider quotas. I don’t have exact provider limits on hand — tune to Twilio using the short‑code pool 12×100 TPS + TFN pool 50×25 TPS with per‑carrier caps enforced, and SES aggregate target ≈13k msgs/s (8k/5k split) with spillover/backpressure rules; feel free to choose slightly more conservative defaults if you prefer. One more ask on the career side — I’ll confirm with the recruiter, but do staff roles here map to L6 and what comp band should I be negotiating for?

### Dev Raghavan

Updated. I pasted the two traced flows and added Twilio/SES quotas with conservative defaults and graceful-degradation rules. If you have actual SES account TPS or Twilio sender/campaign caps, give me the numbers and I’ll tune the buckets precisely.

On comp/level: That’s not my lane — talk to your recruiter and benchmark on Levels.fyi. “Staff” vs L6 mapping varies by company; confirm with your internal ladder and recruiter.

[file presented: /workspace/outputs/notification-system-review.md]
Notification System — Staff‑level Design Review (numbers‑first, trade‑off driven)

Author: Dev Raghavan (Staff Eng, payments)

1) Scope and numbers (checked) — “numbers before boxes”
- Users: 50M MAU; 10M DAU
- Events (notifications to send): 60M/day ⇒ 694/s avg; peak: 6M in 5 min ⇒ 20,000/s (assumption: top 5 min = 10% of day)
- Avg fanout: 1.1 recipients/event
- Deliveries/sec: 763/s avg; 22,000/s peak
- Channel mix (of deliveries): email 50%, SMS 5%, push 30%, in‑app 15%
- Dedup window: 10 minutes; key = hash(user_id, template_id, channel, optional business_id, time_bucket)
- Reads per delivery: ~2 (preferences + device/tokens) ⇒ implied reads/sec: ~1,526/s avg; 44,000/s peak
- Region: multi‑region (primary us‑east, replica eu‑west, optional APAC read region)
- Retention: raw events 7 days; delivery logs 365 days; preference history 2 years
- Payload sizes: email 50 KB; SMS 160 B; push 1 KB; in‑app 2 KB
- Data/year: 21.9B events; 24.09B deliveries; 5M preference updates

Derived checks and contradictions
- Channel peak split (of 22k/s): email ~11,000/s; SMS ~1,100/s; push ~6,600/s; in‑app ~3,300/s.
- Read load: if 2 lookups/delivery, peak ~44k reads/s. Caching is mandatory; Postgres cannot be the hot path here without a cache/CDN layer.
- Storage math vs retention:
  • Your "raw events: 21.9 TB/year" conflicts with 7‑day retention. Steady‑state raw storage ≈ 21.9 TB * (7/365) ≈ 0.42 TB (≈ 420 GB), not 21.9 TB.
  • Delivery logs (365 days): 24.09B * 500 B ≈ 12.0 TB — OK as a yearly retained volume. Postgres is not a fit at this size; use object store + columnar.
  • Preference history: 5M/yr at 1 KB, 2‑year retention ⇒ ≈10 GB, not 5 GB.
  • Revised subtotal retained ≈ 0.42 TB (raw 7d) + 12.0 TB (logs 1y) + 0.01 TB (prefs 2y) ≈ 12.43 TB; apply 3x reproduction/overhead ⇒ ~37–40 TB effective.
- 5‑second delivery SLA: Reasonable for push/SMS/in‑app (p95), unrealistic for email end‑to‑end (SMTP + inbox placement). Treat email as best‑effort latency with separate SLOs.

Action needed to finalize numbers
- Confirm which channels the “5‑second delivery p95” applies to (likely SMS/push/in‑app). Define where the timer stops per channel (e.g., provider ack vs device receipt/read).
- State provider rate limits/quotas you’ll design to: SES/SparkPost TPS; SMS per‑sender TPS/10DLC/TFN/short code; APNs/FCM concurrency.

2) High‑level design (proposed structure tied to numbers)
Must‑dos: no double‑sends; 5s p95 for transactional (non‑email); handle 22k/s peaks with graceful degradation.

- Ingestion
  • Producers write NotificationEvent{event_id, tenant, template_id, user_ids|segments, channel_hint?, priority, dedup_key?, created_at, ttl} to Kafka topic notifications.v1 (keys: tenant + event_id). 200–400 partitions to parallelize peak 20k/s and keep consumer lag < 1s.

- Routing & fanout service (stateless workers, autoscaled)
  • Consumes notifications.v1, expands recipients (fanout=1.1), resolves per‑user channel eligibility & device tokens. Hot path reads from Redis (95%+ hit); Postgres is SoR, fed to Redis via CDC. Outputs ChannelOutbox records to per‑channel Kafka topics (email.outbox, sms.outbox, push.outbox, inapp.outbox).

- Idempotency & dedup (two layers)
  • Hot dedup: Redis SETNX with TTL (10–30 min) on (user_id, template_id, channel, business_id?, time_bucket) to cut obvious dupes.
  • Durable idempotency/outbox: Per‑channel Delivery table in DynamoDB (preferred) or sharded Postgres with unique key (message_id, user_id, channel). Exactly‑

> tools: ls, read_file, read_file, edit_file, grep, read_file, edit_file, edit_file, present_file

> 180.1s

### Client (Tanvi Desai)

Score: 8/12 (pass range). Single highest‑leverage fix before the interview: produce and rehearse two traced flows — (1) happy‑path end‑to‑end with concrete timing anchored to provider‑ack for SMS/push/in‑app, and (2) failure path showing provider throttling, retries/backoff, durable outbox uniqueness (Delivery conditional put), Redis hot dedupe, and regional fencing — include explicit per‑channel SLOs and the Twilio/SES quota numbers so you can clearly explain degradation and failover behavior. On comp/level: I’ll confirm with the recruiter and Levels.fyi, but aim to map “staff” to L6 if your internal ladder supports it and negotiate the L6 market band for mid‑size US SaaS; I’m nervous but ready — can you help me polish the 3‑minute walkthrough of those two flows?  _(leaves satisfied)_
