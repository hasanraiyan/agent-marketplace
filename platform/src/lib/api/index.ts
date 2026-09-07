// Barrel export for platform/'s API layer. Deliberately narrower than
// frontend/src/lib/api/index.js — platform/ is the Developer Platform
// dashboard only (Studio), not the consumer marketplace product, so only
// the account + Project-admin surfaces are ported here. Personal-agent
// endpoints (agents.js, mcps.js, knowledge.js, skills.js, providers.js,
// threads.js, memory.js, upload.js, admin.js, health.js in frontend/) stay
// out of scope.
export { api, setTokenFetcher } from "./core";
export * from "./profile";
export * from "./projects";
