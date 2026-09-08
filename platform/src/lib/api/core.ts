import axios from "axios";

// Same admin API frontend/'s Studio already calls (agent-backend's
// ProjectAdminContext routes), Clerk-authed rather than the machine-
// credential Developer Platform API.
const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// --- Prod-safe API logger: logs every request/response even in production ---
// User asked: "whatever data comes is logged in prod even so we can test"
// So this is intentionally NOT gated by NODE_ENV. To avoid leaking secrets/tokens,
// we truncate long values and never log Authorization header.
const LOG_PREFIX = "[API]";
function safeJson(data: unknown): string {
  try {
    const str = JSON.stringify(data);
    if (!str) return String(data);
    // Truncate huge payloads (e.g. file uploads) to keep console readable
    return str.length > 4000 ? str.slice(0, 4000) + `… (+${str.length - 4000} chars)` : str;
  } catch {
    return String(data);
  }
}
function logApiRequest(config: import("axios").InternalAxiosRequestConfig) {
  const method = (config.method || "GET").toUpperCase();
  const url = `${config.baseURL ?? ""}${config.url ?? ""}`;
  const params = config.params ? ` params=${safeJson(config.params)}` : "";
  const data = config.data ? ` data=${safeJson(config.data)}` : "";
  // Intentionally use console.log (not debug) so it shows in prod browser console
  console.log(`${LOG_PREFIX} ➡️ ${method} ${url}${params}${data}`);
}
function logApiResponse(response: import("axios").AxiosResponse) {
  const method = (response.config.method || "GET").toUpperCase();
  const url = `${response.config.baseURL ?? ""}${response.config.url ?? ""}`;
  console.log(
    `${LOG_PREFIX} ⬅️ ${method} ${url} → ${response.status} data=${safeJson(response.data)}`
  );
}
function logApiError(error: unknown) {
  const err = error as { config?: { method?: string; baseURL?: string; url?: string }; response?: { status?: number; data?: unknown }; message?: string };
  const method = (err.config?.method || "?").toUpperCase();
  const url = `${err.config?.baseURL ?? ""}${err.config?.url ?? ""}`;
  const status = err.response?.status ?? "NO_RESPONSE";
  const data = err.response?.data ? ` data=${safeJson(err.response.data)}` : ` msg=${err.message ?? ""}`;
  console.error(`${LOG_PREFIX} ❌ ${method} ${url} → ${status}${data}`);
}

type TokenFetcher = () => Promise<string | null>;

let tokenFetcher: TokenFetcher | null = null;
export const setTokenFetcher = (fetcher: TokenFetcher) => {
  tokenFetcher = fetcher;
};

api.interceptors.request.use(
  async (config) => {
    try {
      let token: string | null = null;
      if (tokenFetcher) {
        token = await tokenFetcher();
      } else if (
        typeof window !== "undefined" &&
        (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string> } } }).Clerk
          ?.session
      ) {
        token = await (
          window as unknown as { Clerk: { session: { getToken: () => Promise<string> } } }
        ).Clerk.session.getToken();
      }

      config.headers["Cache-Control"] = "no-cache";
      config.headers["Pragma"] = "no-cache";
      config.headers["Expires"] = "0";

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error("[Axios Interceptor] Failed to fetch token:", err);
    }
    // Log every outgoing request even in prod (see top comment)
    logApiRequest(config);
    return config;
  },
  (error) => {
    logApiError(error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    logApiResponse(response);
    return response;
  },
  (error) => {
    logApiError(error);
    if (error.response?.status === 401) {
      if (typeof window !== "undefined" && window.location.pathname !== "/sign-in") {
        window.location.href = "/sign-in";
      }
    }
    return Promise.reject(error);
  }
);
