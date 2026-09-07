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
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined" && window.location.pathname !== "/sign-in") {
        window.location.href = "/sign-in";
      }
    }
    return Promise.reject(error);
  }
);
