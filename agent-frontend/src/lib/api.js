const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

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
    // eslint-disable-line no-unused-vars
    // Some endpoints like logout might return empty body
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      (data && data.message) || response.statusText || 'API Error',
    );
    error.status = response.status;
    error.data = data; // Keep field errors or full response
    throw error;
  }

  return data;
}

export const authApi = {
  register: (payload) =>
    fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    fetchWithAuth('/auth/logout', {
      method: 'POST',
    }),

  verifyEmail: (payload) =>
    fetchWithAuth('/auth/verify-email-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resendOtp: (payload) =>
    fetchWithAuth('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  requestPasswordReset: (payload) =>
    fetchWithAuth('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resetPassword: (payload) =>
    fetchWithAuth('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getProfile: () =>
    fetchWithAuth('/profile', {
      method: 'GET',
    }),
};

export const assistantsApi = {
  getMyAssistants: ({ page = 1, limit = 20 } = {}) =>
    fetchWithAuth(`/assistants/me?page=${page}&limit=${limit}`, {
      method: 'GET',
    }),

  createAssistant: (payload) =>
    fetchWithAuth('/assistants', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAssistant: (id) =>
    fetchWithAuth(`/assistants/${id}`, {
      method: 'GET',
    }),

  updateAssistant: (id, payload) =>
    fetchWithAuth(`/assistants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  
  listPublicAssistants: ({ page = 1, limit = 20 } = {}) =>
    fetchWithAuth(`/assistants?page=${page}&limit=${limit}`, {
      method: 'GET',
    }),
};

export const chatApi = {
  createConversation: (assistantId, payload = {}) =>
    fetchWithAuth(`/assistants/${assistantId}/conversations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listConversations: (assistantId, { page = 1, limit = 20 } = {}) =>
    fetchWithAuth(
      `/assistants/${assistantId}/conversations?page=${page}&limit=${limit}`,
      {
        method: 'GET',
      },
    ),

  sendMessage: (assistantId, conversationId, payload) =>
    fetchWithAuth(
      `/assistants/${assistantId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  listMessages: (assistantId, conversationId, { page = 1, limit = 50 } = {}) =>
    fetchWithAuth(
      `/assistants/${assistantId}/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
      {
        method: 'GET',
      },
    ),
};
