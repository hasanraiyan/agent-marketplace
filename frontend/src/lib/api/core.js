import axios from "axios";

// Default to localhost:3000 if not provided in env, adjusting for the v1 API path
const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

let tokenFetcher = null;
export const setTokenFetcher = (fetcher) => {
  tokenFetcher = fetcher;
};

// Request interceptor to attach bearer token via window.Clerk if available
api.interceptors.request.use(
  async (config) => {
    try {
      let token = null;
      if (tokenFetcher) {
        token = await tokenFetcher();
        console.log(
          "[Axios Interceptor] Token fetched from React hook:",
          token ? "SUCCESS" : "NULL",
        );
      } else if (
        typeof window !== "undefined" &&
        window.Clerk &&
        window.Clerk.session
      ) {
        token = await window.Clerk.session.getToken();
        console.log(
          "[Axios Interceptor] Token fetched from window.Clerk:",
          token ? "SUCCESS" : "NULL",
        );
      } else {
        console.log(
          "[Axios Interceptor] No token fetcher or window.Clerk available",
        );
      }

      // Disable client-side request caching to ensure fresh thread info
      config.headers["Cache-Control"] = "no-cache";
      config.headers["Pragma"] = "no-cache";
      config.headers["Expires"] = "0";

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.log(
          "[Axios Interceptor] WARNING: Request proceeding without Authorization header!",
        );
      }
    } catch (err) {
      console.error("[Axios Interceptor] Failed to fetch token:", err);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle unhandled errors (e.g., 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        if (window.location.pathname !== "/sign-in") {
          window.location.href = "/sign-in";
        }
      }
    }
    return Promise.reject(error);
  },
);
