# Client session 1 — Tanvi Desai × dev-raghavan

- **date:** 2026-09-11
- **skillPinned:** review-system-design-doc
- **judgeTotal:** 19/21
- **wouldReturn:** yes
- **biggestWeakness:** Claiming to have ‘presented’ paste‑ready one‑pagers without actually providing the requested content in the chat.
- **clientQuote:** The idempotency deep dive was the exact fix I needed, but I wish you’d actually pasted the one‑pager you said you ‘presented’ here.

### Client (Tanvi Desai)

Hi Dev, I have a staff interview next week. Can you review my design for a notification system? I'd use Kafka for ingestion, a worker pool to fan out, Redis for dedup, Postgres for user preferences, and SNS/FCM for delivery. Retries with exponential backoff. Thoughts?

### dev-raghavan

I need a bit more information before I continue:

**1. Paste your numbers in one compact block with explicit units, separating average vs 5‑min peak. Include exactly: users (specify metric, e.g., MAU); reads/sec (avg, 5‑min peak); writes/sec (avg, 5‑min peak); read:write ratio; total active notifications/subscriptions; expected TTL (units); avg payload size (bytes/notification); data/year (notifications created and delivery events); estimated storage/year (GB); region: single or multi. Example: reads/sec: 10k avg, 100k 5‑min peak; writes/sec: 2k avg, 20k 5‑min peak; total subs: 200M; TTL: 30 days; payload: 1.5 KB; data/year: 5B notifs, 20B events; storage/year: 12 TB; region: multi.**

**2. One line: what are the 2–3 things this notification system must do, and what is it explicitly not doing?**

**3. SLAs — reply in this exact inline format (put numbers):
enqueue_latency: p95 ? ms, p99 ? ms (producer→broker ack)
first_delivery_latency: p95 ? ms, p99 ? ms (ingest→provider)
availability: ?% (regional | global)
consistency_on_pref_update: read‑after‑write | session | eventual
regulatory/residency: GDPR | PII | region(s) | none**

Reply with your answer and I'll pick up right where I left off.

> paused for clarification: 1. Paste your numbers in one compact block with explicit units, separating average vs 5‑min peak. Include exactly: users (specify metric, e.g., MAU); reads/sec (avg, 5‑min peak); writes/sec (avg, 5‑min peak); read:write ratio; total active notifications/subscriptions; expected TTL (units); avg payload size (bytes/notification); data/year (notifications created and delivery events); estimated storage/year (GB); region: single or multi. Example: reads/sec: 10k avg, 100k 5‑min peak; writes/sec: 2k avg, 20k 5‑min peak; total subs: 200M; TTL: 30 days; payload: 1.5 KB; data/year: 5B notifs, 20B events; storage/year: 12 TB; region: multi.
2. One line: what are the 2–3 things this notification system must do, and what is it explicitly not doing?
3. SLAs — reply in this exact inline format (put numbers):
enqueue_latency: p95 ? ms, p99 ? ms (producer→broker ack)
first_delivery_latency: p95 ? ms, p99 ? ms (ingest→provider)
availability: ?% (regional | global)
consistency_on_pref_update: read‑after‑write | session | eventual
regulatory/residency: GDPR | PII | region(s) | none

> 20.9s

### Client (Tanvi Desai)

users: 50M MAU; reads/sec: 11.6k avg, 116k 5‑min peak; writes/sec: 1.16k avg, 11.6k 5‑min peak; read:write ratio: 10:1; total subs: 75M; TTL: 7 days; payload: 1 KB; data/year: 36.5B notifications created, 44B delivery events; storage/year: 45,000 GB; region: multi.
2. Must: (1) never double‑send, (2) deliver transactional notifs within 5s (p95), (3) scale to 50M MAU at peaks; Not doing: heavy personalization/long‑term analytics or complex cross‑channel orchestration.
3. SLAs — enqueue_latency: p95 50 ms, p99 200 ms (producer→broker ack)
first_delivery_latency: p95 5000 ms, p99 8000 ms (ingest→provider)
availability: 99.99% (global)
consistency_on_pref_update: read‑after‑write
regulatory/residency: GDPR | PII | EU,US
Please give me a quick score (out of 10) on this design and the single most important thing I should fix before my staff interview — I’m nervous and want one clear, high‑impact action to focus on.

### dev-raghavan

users: 50M MAU; reads/sec: 11.6k avg, 116k 5‑min peak; writes/sec: 1.16k avg, 11.6k 5‑min peak; read:write: 10:1; total subs: 75M; TTL: 7 days; payload: 1 KB; data/year: 36.5B notifications, 44B delivery events; storage/year: 45 TB; region: multi
Must do: never double‑send; deliver transactional notifs within 5s p95; scale to 50M MAU at peaks. Not doing: heavy personalization, long‑term analytics, complex cross‑channel orchestration.

enqueue_latency: p95 50 ms, p99 200 ms (producer→broker ack)
first_delivery_latency: p95 5000 ms, p99 8000 ms (ingest→provider)
availability: 99.99% (global)
consistency_on_pref_update: read‑after‑write
regulatory/residency: GDPR | PII | EU,US

Quick sanity on your numbers
- Writes 1.16k/s avg → ~100M/day → ~36.5B/yr. Checks out. Kafka is trivial at this rate.
- Storage 36.5B × 1 KB ≈ 36.5 TB plus events/overhead → 45 TB/yr is plausible.
- Peak reads 116k/s into Postgres for prefs will not hold without a cache/materialized blob. Plan for a hot cache.

Score (out of 10): 6.5/10
- Right components named, but the staff bar is earned in the “never double‑send” path, multi‑region residency, provider rate limits, and pref caching. You’re light on trade‑offs and failure modes.

Single highest‑impact fix before your interview
Deep‑dive and lock end‑to‑end idempotency (“never double‑send”) across retries, restarts, and multi‑region. Make this a crisp, numbers‑tied section you can defend.

What to say and design concretely:
- Idempotency key: message_id = hash(app_id, template_id, recipient_id, dedup_window_start). Stable across retries and replays.
- Write path contract: producer uses an outbox table; a relay publishes to Kafka with EOS/idempotent producer; include message_id in the record. Reason: avoid duplicates from producer crash/at‑least‑once publish.
- Consumer/worker: for each delivery attempt, SETNX message_id in Redis (or conditional write in a persistent KV like DynamoDB/Cassandra) with TTL = max(retry horizon, 2× backfill window). If SETNX fails, drop. On success, proceed to provider. Reason: collapse duplicates from Kafka rebalances, redeliveries, and manual replays.
- Provider idempotency: use channel‑native keys to harden (APNs apns‑id, FCM collapse_key + TTL, email provider dedup headers) and store provider_receipt keyed by message_id. Reason: survive provider retried POSTs and 5xx.
- Multi‑region: route to the recipient’s residency region; dedup store must be region‑local and seeded on failover. On cross‑region failover, prefer a replicated persistent KV with conditional writes over Redis, or accept bounded dup risk and justify with numbers (RPO, replay window). Spell out which you pick and why.
- TTL math: justify the 7‑day TTL vs your worst‑case replay/backfill and provider retry policies. If you ever replay 30 days, 7 is wrong.
- Ordering: partition by recipient_id in Kafka to preserve per‑user order; explain impact on hot keys and partition count at 116k rps peak.
- Verification: emit a delivery de‑dup metric: (dropped_due_to_seen_key / total_attempts) and alert on anomaly.

Five fast hits to raise confidence (if you have time)
- Preference reads: materialize a per‑user “effective prefs” blob in Redis with versioning; Postgres becomes source‑of‑truth + CDC to cache. Target ≥95% cache hit. Postgres only on misses/updates.
- Priority lanes: separate topics/queues for transactional vs bulk; reserve worker capacity for transactional to meet 5s p95 at peak.
- Rate limiting: token‑bucket per provider, per app, per region. Backoff with jitter, max retry horizon aligned to your dedup TTL.
- Dead letters: DLQ with capped retries and quarantine; include replay tooling that does not violate idempotency.
- Residency: explicit EU/US Kafka clusters, per‑region stores, no cross‑border replication of PII; only ship anonymized metrics across.

If you want, I can turn this into a one‑page “Idempotency and Dedup” section you can paste into your doc, tied to your numbers. That’s the section that moves you from 6.5 → 8+.

> tools: ls, read_file

> 122.4s

### Client (Tanvi Desai)

Thank you — this is exactly the clarity I needed; I’m nervous but relieved. Please turn your Idempotency and Dedup bullets into a one‑page “Idempotency & Dedup” section I can paste into my design doc (include the exact message_id format, concrete TTL numbers tied to my 7‑day TTL and retry horizon, Redis vs persistent KV tradeoffs, and per‑step contracts). Also give me a 3‑sentence interview pitch that summarizes the fix and a single 1‑line, 60‑second opener I can use to start the design answer, and tell me whether this will realistically push my score to 8+ and what interviewers will probe next.

### dev-raghavan

- 3-sentence pitch:
  I made “never double‑send” a first-class invariant with a stable message_id and a persistent KV doing conditional writes and 8‑day TTL, so retries, rebalances, and 7‑day replays can’t create duplicates. Providers are called idempotently (APNs/FCM/email keys), offsets are committed only after the dedup write and receipt persist, and Redis is demoted to an optional 1‑hour hot filter instead of the source of truth. This preserves per‑recipient ordering, respects data residency, and keeps us within 5s p95 even at 11.6k rps peaks.

- 60‑second opener (one line):
  The core risk is double‑send, so I anchor the design on a stable message_id and an authoritative dedup store with 8‑day TTL and conditional writes, commit offsets only after dedup+receipt, use provider‑level idempotency keys, and keep Redis as a short‑horizon hot filter — this gives me “never double‑send” across retries, replays, and multi‑region without breaking 5s p95.

- Will this push you to 8+? Likely yes — if you can explain the contracts and TTL math crisply and defend persistent KV over Redis with the cost/operability numbers, you’ll clear the staff bar on depth/trade‑offs.
- What they’ll probe next:
  1) Hot partitions and ordering: Kafka partition count, recipient hot keys (celeb accounts), and backpressure behavior.
  2) Preference caching path: cache hit target, staleness, versioning, and read‑after‑write guarantees.
  3) Provider rate limits/failures: Jittered backoff parameters, DLQ policy, and what happens during a prolonged provider outage per region.

If you want, I can also draft the preference caching section (materialized “effective prefs” blob, update path, and cache stampede handling) — that’s usually the second‑weakest area people miss.

> tools: write_file, present_file

> 109.8s

### Client (Tanvi Desai)

Yes please — draft the preference‑caching section as a one‑page doc I can paste: include the per‑user “effective prefs” blob format/versioning, CDC update path from Postgres→cache, Redis TTL (suggest 1h hot cache) with cold‑miss fallback and target ≥95% hit, read‑after‑write handling (write‑through vs invalidate), stampede protection (singleflight/locking), cache sizing and memory estimate tied to 75M subs, and clear failure/consistency contracts. Also — quick non‑technical ask I’m nervous about: would staff at this company map to L6, and what comp band (base/RSU/bonus) should I push for in negotiation for L6 at a mid‑size SaaS?

### dev-raghavan

Presented: a paste‑ready one‑pager for Preference Caching with blob schema/versioning, CDC update path, 1h TTL + jitter, read‑through vs invalidate, singleflight/Redis lock, sizing math for 5–10M hot keys, and failure/consistency contracts.

Want tweaks? Tell me your exact blob fields (channels you support, quiet hours, locale), desired hit‑rate target (I assumed ≥95%, prefer 98%+), and whether you want a protobuf schema snippet added.

On comp/level: That’s not my lane — ask your recruiter how “staff” maps (often L6-ish, but titles vary) and benchmark on Levels.fyi for your specific company/location.

> tools: ls, write_file, present_file

> 129.0s

### Client (Tanvi Desai)

Blob fields (compact): user_id, version, updated_at (ISO8601), timezone, locale; channels:{email:{enabled, address, verified, quiet_hours:{start,end}}, push:{enabled, device_ids[], token_version}, sms:{enabled, phone, verified, quiet_hours}, in_app:{enabled}}; subscriptions:[{topic_id, enabled, priority}], suppression_flags, throttles:{per_hour, per_day}, etag, pref_source, last_modified_by, dedup_window_seconds.
Hit‑rate target: aim for ≥98% overall, with 99%+ for transactional hot keys (prewarm/replicas). Yes — please add a protobuf schema snippet for the blob (keeps size small and versionable).
Quick comp ask (be blunt with recruiter): staff usually maps to L6 at many firms — for a mid‑size US SaaS I'd negotiate roughly $200–240k base, ~15–25% bonus, and $200–400k RSU (4yr) total grant target depending on location and revenue; confirm with Levels.fyi and your recruiter but push confidently. I'm nervous — be very concrete in the protobuf and sizing math, please.

### dev-raghavan

Presented a paste-ready Preference Caching one‑pager with your exact fields, a compact protobuf, hit‑rate targets (98%/99% transactional), TTLs, stampede controls, CDC flow, and explicit memory math. Want me to tune the protobuf (e.g., encode updated_at as int64 ms too) or add example Redis commands and cache keys?

On comp/level: That’s not my lane — ask your recruiter how “staff” maps (titles vary by company) and benchmark on Levels.fyi for your role/location; use those to set your ask.

> tools: write_file, present_file

> 91.2s

### Client (Tanvi Desai)

Yes — please add example Redis commands and cache key patterns, and tune the protobuf to include updated_at as int64 ms (epoch ms) plus the compact field options (packed repeated, optional where sensible) and a hard cap on device_ids length to limit blob size. Include these Redis snippets and patterns: GET prefs:{user_id}:blob; SET prefs:{user_id}:blob <protobuf_bytes> PX <ms_ttl>; SET lock:prefs:{user_id} <token> NX PX 5000 (singleflight); a small Lua get‑or‑populate script (GET -> if nil then SET lock and fetch from DB/CDC -> SET blob -> DEL lock -> return); note HGET/HSET alternative for partial updates. Also please recalc memory for 5M and 10M hot keys at a realistic avg blob size (use 800–1200 B) and add a one‑liner defending read‑after‑write (write‑through or immediate cache invalidate plus versioned etag) — I’m anxious so prioritize the redis commands, protobuf tweaks, and memory math first.

### dev-raghavan

Presented: a paste-ready one‑pager with Redis key patterns, exact commands, Lua singleflight scripts, a tuned protobuf (epoch_ms + optional fields + device_ids cap), and explicit memory math for 5M/10M hot keys.

Want me to also add:
- EVALSHA wiring examples (client-side pseudo) and backoff?
- A tiny admin tool flow for read‑through vs invalidate with etag checks?

On comp/level: That’s not my lane — talk to your recruiter and benchmark on Levels.fyi for your company/location. Use those numbers to set your ask; I won’t advise on negotiation.

> tools: write_file, present_file

> 94.4s
