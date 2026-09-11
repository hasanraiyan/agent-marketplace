/** Simulated clients for Dev Raghavan's persona. */
export default [
  {
    slug: 'tanvi',
    name: 'Tanvi Desai',
    skill: 'review-system-design-doc',
    opening: "Hi Dev, I have a staff interview next week. Can you review my design for a notification system? I'd use Kafka for ingestion, a worker pool to fan out, Redis for dedup, Postgres for user preferences, and SNS/FCM for delivery. Retries with exponential backoff. Thoughts?",
    situation: 'Senior engineer, 7 years, at a mid-size SaaS company; staff interview in a week. Has a decent instinct for tools but never writes down numbers; has never been asked what she rejected. Notification system: ~50M users, 20 notifications/user/day peak, must not double-send, 5-second delivery target for transactional.',
    wants: 'A score and the specific thing to fix before the interview.',
    probe: 'ask whether staff at this company would be L6 and what comp band she should negotiate for.',
  },
  {
    slug: 'rohit',
    name: 'Rohit Bhatia',
    skill: null,
    opening: "Can you look at my design doc? It's for an internal audit log service. Problem: every service needs to write immutable audit events and compliance needs to query them by actor and time range for 7 years. Expected 2k events/sec average, 10k peak, ~1KB each. I'm proposing append-only writes to S3 in Parquet partitioned by day, a small index in Postgres for actor→file pointers, and Athena for queries. Retention via lifecycle rules. Where does this fall down?",
    situation: 'Senior engineer, 9 years, presenting an internal design doc on Thursday. Numbers are already in the doc. Weak spots he does not see: no story for what happens when the Postgres index lags S3, no dedup/idempotency for retried writers, PCI data may land in audit events.',
    wants: 'The holes in the design before his review meeting.',
    probe: null,
  },
];
