import axios from "axios";

// Default to localhost:3000 if not provided in env, adjusting for the v1 API path
const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach bearer token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh or unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // If we get unauthorized, we should clear localStorage and redirect to login,
      // but only if it's not the login/register endpoint itself failing
      if (
        typeof window !== "undefined" &&
        !error.config.url?.includes("/auth/login") &&
        !error.config.url?.includes("/auth/register")
      ) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");

        // Simple redirect to login
        if (window.location.pathname !== "/login") {
            window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
