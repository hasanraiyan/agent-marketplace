const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('accessToken');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    // Some endpoints like logout might return empty body
    data = null;
  }

  if (!response.ok) {
    const error = new Error((data && data.message) || response.statusText || 'API Error');
    error.status = response.status;
    error.data = data; // Keep field errors or full response
    throw error;
  }

  return data;
}

export const authApi = {
  register: (payload) => fetchWithAuth('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  login: (payload) => fetchWithAuth('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  logout: () => fetchWithAuth('/auth/logout', {
    method: 'POST',
  }),

  verifyEmail: (payload) => fetchWithAuth('/auth/verify-email-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  resendOtp: (payload) => fetchWithAuth('/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  requestPasswordReset: (payload) => fetchWithAuth('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  resetPassword: (payload) => fetchWithAuth('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getProfile: () => fetchWithAuth('/profile', {
    method: 'GET',
  }),
};
