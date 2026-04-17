import axios from "axios";

// Default to localhost:3000 if not provided in env, adjusting for the v1 API path
const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach bearer token via window.Clerk if available
api.interceptors.request.use(
  async (config) => {
    if (typeof window !== "undefined" && window.Clerk && window.Clerk.session) {
      try {
        const token = await window.Clerk.session.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (err) {
        // Silent catch to prevent request blocking on token failure
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
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
  }
);
