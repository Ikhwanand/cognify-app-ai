// API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Helper function for API calls
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// ============ Chat API ============

export const chatAPI = {
  // Get all chat sessions
  getSessions: () => fetchAPI('/chat/sessions'),

  // Get a single chat session with messages
  getSession: (sessionId) => fetchAPI(`/chat/sessions/${sessionId}`),

  // Create a new chat session
  createSession: () => fetchAPI('/chat/sessions', { method: 'POST' }),

  // Delete a chat session
  deleteSession: (sessionId) => fetchAPI(`/chat/sessions/${sessionId}`, { method: 'DELETE' }),

  // Send a message and get AI response
  sendMessage: (content, sessionId = null, topK = 5, includeSources = true) => {
    const params = new URLSearchParams({
      top_k: topK.toString(),
      include_sources: includeSources.toString(),
    });
    
    return fetchAPI(`/chat/message?${params}`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        session_id: sessionId,
      }),
    });
  },
};

// ============ Documents API ============

export const documentsAPI = {
  // Get all documents
  getAll: () => fetchAPI('/documents/'),

  // Upload a document
  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${API_BASE_URL}/documents/upload`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Delete a document
  delete: (documentId) => fetchAPI(`/documents/${documentId}`, { method: 'DELETE' }),
};

// ============ Settings API ============

export const settingsAPI = {
  // Get current settings
  get: () => fetchAPI('/settings/'),

  // Update settings
  update: (settings) => fetchAPI('/settings/', {
    method: 'POST',
    body: JSON.stringify(settings),
  }),

  // Reset settings to defaults
  reset: () => fetchAPI('/settings/reset', { method: 'POST' }),
};

// ============ Health Check ============

export const healthAPI = {
  check: async () => {
    try {
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
      return response.ok;
    } catch {
      return false;
    }
  },
};

export default {
  chat: chatAPI,
  documents: documentsAPI,
  settings: settingsAPI,
  health: healthAPI,
};
