const API = '/api';
const TOKEN_KEY = 'base44_access_token';

class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, data?.data);
  return data;
}

function entityApi(name) {
  return {
    list: (sort = '-created_date', limit = 100) => request(`/entities/${name}?sort=${encodeURIComponent(sort)}&limit=${limit}`),
    create: (payload) => request(`/entities/${name}`, { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/entities/${name}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  };
}

export const base44 = {
  app: {
    getPublicSettings: () => request('/public-settings'),
  },
  auth: {
    me: () => request('/auth/me'),
    register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    verifyOtp: (payload) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(payload) }),
    resendOtp: (email) => request('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) }),
    loginViaEmailPassword: async (email, password) => {
      const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem(TOKEN_KEY, result.access_token); localStorage.setItem('token', result.access_token);
      return result;
    },
    setToken: (token) => { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem('token', token); },
    resetPasswordRequest: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
    loginWithProvider: () => { throw new ApiError('Google sign-in is not configured in the local backend. Use email/password.', 501); },
    logout: (redirect) => {
      localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('token');
      if (redirect) window.location.href = '/login';
    },
    redirectToLogin: (returnTo) => {
      const target = new URL(returnTo || window.location.href, window.location.origin);
      const path = target.pathname + target.search;
      window.location.href = `/login?returnTo=${encodeURIComponent(path)}`;
    },
  },
  entities: {
    Disaster: entityApi('Disaster'),
    IncidentReport: entityApi('IncidentReport'),
    Resource: entityApi('Resource'),
    VictimReport: entityApi('VictimReport'),
    Alert: entityApi('Alert'),
  },
  integrations: {
    Core: {
      InvokeLLM: (payload) => request('/integrations/llm', { method: 'POST', body: JSON.stringify(payload) }),
      SendEmail: (payload) => request('/integrations/send-email', { method: 'POST', body: JSON.stringify({ to: payload.to, subject: payload.subject, text: payload.body }) }),
      UploadFile: async ({ file }) => {
        const form = new FormData(); form.append('file', file);
        return request('/integrations/upload-file', { method: 'POST', body: form });
      },
    },
  },
};
