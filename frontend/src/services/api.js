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

  // Send a message and get AI response (non-streaming)
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

  // Send a message with streaming response
  sendMessageStream: (content, sessionId = null, topK = 5, includeSources = true, onChunk, onDone, onError) => {
    const params = new URLSearchParams({
      top_k: topK.toString(),
      include_sources: includeSources.toString(),
    });
    
    const abortController = new AbortController();
    let streamId = null;
    
    const fetchStream = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/chat/message/stream?${params}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content,
            session_id: sessionId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: 'Stream error' }));
          throw new Error(error.detail || `HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'start') {
                  streamId = data.stream_id;
                  if (data.session_id) {
                    onChunk?.({ type: 'session_id', session_id: data.session_id });
                  }
                } else if (data.type === 'chunk') {
                  onChunk?.(data);
                } else if (data.type === 'done') {
                  onDone?.(data);
                } else if (data.type === 'error') {
                  onError?.(new Error(data.error));
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          onError?.(error);
        }
      }
    };

    fetchStream();

    // Return cancel function
    return {
      cancel: async () => {
        abortController.abort();
        if (streamId) {
          try {
            await fetch(`${API_BASE_URL}/chat/message/cancel/${streamId}`, {
              method: 'POST',
            });
          } catch (e) {
            console.error('Failed to cancel stream:', e);
          }
        }
      },
    };
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

// ============ Evals API ============

export const evalsAPI = {
  // Dashboard endpoints - fetches ALL data (no day filter)
  getSummary: () => fetchAPI('/evals/dashboard/summary'),
  
  getStats: () => fetchAPI('/evals/dashboard/stats'),
  
  getHistory: () => fetchAPI('/evals/dashboard/history'),
  
  getToolUsage: () => fetchAPI('/evals/dashboard/tool-usage'),
  
  // Results
  getResults: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.evalType) searchParams.append('eval_type', params.evalType);
    if (params.modelId) searchParams.append('model_id', params.modelId);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.offset) searchParams.append('offset', params.offset);
    return fetchAPI(`/evals/results?${searchParams}`);
  },
  
  getResult: (resultId) => fetchAPI(`/evals/results/${resultId}`),
  
  // Delete all evaluation data
  deleteAllResults: () => fetchAPI('/evals/results/all', {
    method: 'DELETE',
  }),
  
  // Run evaluations
  runEval: (evalData) => fetchAPI('/evals/run', {
    method: 'POST',
    body: JSON.stringify(evalData),
  }),
  
  runBenchmark: (benchmarkId) => fetchAPI(`/evals/run-benchmark/${benchmarkId}`, {
    method: 'POST',
  }),
  
  // Quick tests
  quickAccuracyTest: (inputText, expectedOutput, modelId = null) => 
    fetchAPI(`/evals/quick-test/accuracy?input_text=${encodeURIComponent(inputText)}&expected_output=${encodeURIComponent(expectedOutput)}${modelId ? `&model_id=${modelId}` : ''}`, {
      method: 'POST',
    }),
  
  quickPerformanceTest: (inputText, modelId = null) =>
    fetchAPI(`/evals/quick-test/performance?input_text=${encodeURIComponent(inputText)}${modelId ? `&model_id=${modelId}` : ''}`, {
      method: 'POST',
    }),
  
  // Benchmarks
  getBenchmarks: (evalType = null, activeOnly = true) => {
    const params = new URLSearchParams();
    if (evalType) params.append('eval_type', evalType);
    params.append('active_only', activeOnly);
    return fetchAPI(`/evals/benchmarks?${params}`);
  },
  
  createBenchmark: (benchmarkData) => fetchAPI('/evals/benchmarks', {
    method: 'POST',
    body: JSON.stringify(benchmarkData),
  }),
  
  deleteBenchmark: (benchmarkId) => fetchAPI(`/evals/benchmarks/${benchmarkId}`, {
    method: 'DELETE',
  }),
};

export default {
  chat: chatAPI,
  documents: documentsAPI,
  settings: settingsAPI,
  health: healthAPI,
  evals: evalsAPI,
};
