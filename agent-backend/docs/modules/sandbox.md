# Sandbox Module

## Purpose

Provides isolated micro-VM code execution sandboxes for agents and developers powered by the **CodeSandbox SDK** (`@codesandbox/sdk`). Allows agents to safely inspect, write, test, and execute untrusted code in ephemeral remote cloud environments without exposing host backend resources.

## Location

`src/modules/sandbox/`

## Structure

```
src/modules/sandbox/
├── index.js                     # Barrel exports
├── agentSandbox.model.js        # Mongoose schema for active sandbox sessions
├── codesandbox.backend.js       # Low-level CodeSandbox SDK integration client
└── sandbox.service.js           # Sandbox lifecycle, command execution & timeouts
```

## Responsibilities

- **Ephemeral Environment Provisioning**: Spins up isolated cloud containers on demand with predefined language runtimes (Node.js, Python, Bash).
- **Remote Command Execution**: Executes shell commands and scripts with real-time stdout/stderr streaming, execution timeout bounds, and exit code capture.
- **Filesystem Synchronization**: Allows agents to write files to the sandbox, compile code, execute unit tests, and retrieve generated artifacts.
- **Automatic Lifecycle Cleanup**: Shuts down idle sandboxes after a configured inactivity window to conserve cloud computing resources.

## Local (dev/debug) sandbox

When no `CSB_API_KEY` Project Secret is present **and** the backend is running
in development/debug mode (`NODE_ENV=development`, or `DEBUG`/`ENABLE_LOCAL_SANDBOX`
set), `getSandboxBackend()` falls back to a `LocalShellBackend` (from
`deepagents`) that executes real shell commands on the host machine. This lets
agents exercise real code execution locally without a paid CodeSandbox account.

**Security:** this runs unsandboxed shell on the host. It is gated by
`isLocalSandboxAllowed()` and must never be enabled in production. The
`.local-sandboxes/` working directories are gitignored.

## Dependencies

| Dependency         | Type     | Purpose                                               |
| ------------------ | -------- | ----------------------------------------------------- |
| `@codesandbox/sdk` | External | Cloud container orchestration and remote VM execution |
| `agents` module    | Internal | Tool exposure (`execute_code`, `read_sandbox_file`)   |
