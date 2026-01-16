import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { Header } from '@/components/Header'
import { SettingsModal, defaultSettings } from '@/components/SettingsModal'
import { chatAPI, documentsAPI, settingsAPI, healthAPI } from '@/services/api'

// Helper to get/set localStorage
const STORAGE_KEY = 'knowledge-ai-selected-chat'
const getStoredChatId = () => localStorage.getItem(STORAGE_KEY)
const setStoredChatId = (id) => {
  if (id) {
    localStorage.setItem(STORAGE_KEY, id)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

function App() {
  const [darkMode, setDarkMode] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedChatId, setSelectedChatId] = useState(() => getStoredChatId())
  const [chatHistory, setChatHistory] = useState([])
  const [knowledgeBase, setKnowledgeBase] = useState([])
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isBackendOnline, setIsBackendOnline] = useState(false)
  
  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState(defaultSettings)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Persist selectedChatId to localStorage
  useEffect(() => {
    setStoredChatId(selectedChatId)
  }, [selectedChatId])

  // Check backend health and load initial data
  useEffect(() => {
    const initializeApp = async () => {
      // Check if backend is online
      const isOnline = await healthAPI.check()
      setIsBackendOnline(isOnline)

      if (isOnline) {
        try {
          // Load chat sessions
          const sessions = await chatAPI.getSessions()
          setChatHistory(sessions.map(s => ({
            id: s.id,
            title: s.title || 'Untitled Chat',
            timestamp: s.created_at
          })))

          // Load documents
          const docs = await documentsAPI.getAll()
          setKnowledgeBase(docs.map(d => ({
            id: d.id,
            name: d.name,
            size: d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : 'Unknown'
          })))

          // Load settings
          const savedSettings = await settingsAPI.get()
          setSettings(savedSettings)
          
          // Apply theme from settings
          if (savedSettings.theme === 'light') {
            setDarkMode(false)
          } else if (savedSettings.theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            setDarkMode(prefersDark)
          }

          // If there's a stored chat ID, load its messages
          const storedChatId = getStoredChatId()
          if (storedChatId && sessions.some(s => s.id === storedChatId)) {
            try {
              const session = await chatAPI.getSession(storedChatId)
              setMessages(session.messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                sources: m.sources_json ? JSON.parse(m.sources_json) : null,
                timestamp: m.created_at
              })))
            } catch (error) {
              console.error('Error loading stored chat:', error)
              setSelectedChatId(null)
            }
          }
        } catch (error) {
          console.error('Error loading initial data:', error)
        }
      }
    }

    initializeApp()
  }, [])

  // Set dark mode based on state
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const handleNewChat = useCallback(() => {
    setSelectedChatId(null)
    setMessages([])
  }, [])

  const handleSelectChat = useCallback(async (chatId) => {
    setSelectedChatId(chatId)
    
    if (isBackendOnline) {
      try {
        const session = await chatAPI.getSession(chatId)
        setMessages(session.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources_json ? JSON.parse(m.sources_json) : null,
          timestamp: m.created_at
        })))
      } catch (error) {
        console.error('Error loading chat messages:', error)
        setMessages([])
      }
    }
  }, [isBackendOnline])

  const handleUploadDocument = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.txt,.md,.docx'
    input.multiple = true
    input.onchange = async (e) => {
      const files = Array.from(e.target.files)
      
      for (const file of files) {
        try {
          if (isBackendOnline) {
            // Upload to backend
            const result = await documentsAPI.upload(file)
            setKnowledgeBase(prev => [...prev, {
              id: result.id,
              name: result.name,
              size: `${result.chunk_count} chunks`
            }])
          } else {
            // Fallback: just add to local state
            setKnowledgeBase(prev => [...prev, {
              id: `local-${Date.now()}`,
              name: file.name,
              size: `${(file.size / 1024).toFixed(1)} KB`
            }])
          }
        } catch (error) {
          console.error('Error uploading document:', error)
          alert(`Failed to upload ${file.name}: ${error.message}`)
        }
      }
    }
    input.click()
  }, [isBackendOnline])

  const handleDeleteDocument = useCallback(async (docId) => {
    try {
      if (isBackendOnline) {
        await documentsAPI.delete(docId)
      }
      setKnowledgeBase(prev => prev.filter(doc => doc.id !== docId))
    } catch (error) {
      console.error('Error deleting document:', error)
      alert(`Failed to delete document: ${error.message}`)
    }
  }, [isBackendOnline])

  const handleDeleteChat = useCallback(async (chatId) => {
    try {
      if (isBackendOnline) {
        await chatAPI.deleteSession(chatId)
      }
      setChatHistory(prev => prev.filter(chat => chat.id !== chatId))
      
      // If the deleted chat was selected, clear the selection
      if (selectedChatId === chatId) {
        setSelectedChatId(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
      alert(`Failed to delete chat: ${error.message}`)
    }
  }, [isBackendOnline, selectedChatId])

  const handleSendMessage = useCallback(async (content) => {
    // Add user message immediately for responsiveness
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    
    try {
      if (isBackendOnline) {
        // Send message to backend
        const response = await chatAPI.sendMessage(
          content,
          selectedChatId,
          settings.top_k,
          settings.include_sources
        )
        
        // Update selected chat ID if this was a new chat
        if (!selectedChatId && response.session_id) {
          setSelectedChatId(response.session_id)
          
          // Add new chat to history
          const newChat = {
            id: response.session_id,
            title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
            timestamp: new Date().toISOString()
          }
          setChatHistory(prev => [newChat, ...prev])
        }

        // Add assistant response
        const assistantMessage = {
          id: response.id,
          role: 'assistant',
          content: response.content,
          sources: response.sources_json ? JSON.parse(response.sources_json) : null,
          timestamp: response.created_at
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        // Fallback: simulated response when backend is offline
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Create local chat if needed
        if (!selectedChatId) {
          const newChatId = `chat-${Date.now()}`
          const newChat = {
            id: newChatId,
            title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
            timestamp: new Date().toISOString()
          }
          setChatHistory(prev => [newChat, ...prev])
          setSelectedChatId(newChatId)
        }

        const assistantMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Backend Offline**\n\nThe backend server is not running. Please start the backend with:\n\n\`\`\`bash\ncd backend\nuvicorn main:app --reload\n\`\`\`\n\nYour message: "${content}"`,
          timestamp: new Date().toISOString()
        }
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Error**\n\n${error.message}\n\nPlease check if the backend is running correctly.`,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [selectedChatId, settings, isBackendOnline])

  const getCurrentChatTitle = () => {
    if (!selectedChatId) return null
    const chat = chatHistory.find(c => c.id === selectedChatId)
    return chat?.title || null
  }

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true)
  }, [])

  const handleSaveSettings = useCallback(async (newSettings) => {
    setIsSavingSettings(true)
    try {
      if (isBackendOnline) {
        await settingsAPI.update(newSettings)
      }
      
      setSettings(newSettings)
      
      // Apply theme change immediately
      if (newSettings.theme === 'dark') {
        setDarkMode(true)
      } else if (newSettings.theme === 'light') {
        setDarkMode(false)
      } else if (newSettings.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setDarkMode(prefersDark)
      }
      
      setSettingsOpen(false)
    } catch (error) {
      console.error('Error saving settings:', error)
      alert(`Failed to save settings: ${error.message}`)
    } finally {
      setIsSavingSettings(false)
    }
  }, [isBackendOnline])

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        chatHistory={chatHistory}
        knowledgeBase={knowledgeBase}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onUploadDocument={handleUploadDocument}
        onDeleteDocument={handleDeleteDocument}
        onOpenSettings={handleOpenSettings}
        selectedChatId={selectedChatId}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          currentChatTitle={getCurrentChatTitle()}
          isBackendOnline={isBackendOnline}
        />
        
        <ChatArea
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          className="flex-1"
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={handleSaveSettings}
        isLoading={isSavingSettings}
      />
    </div>
  )
}

export default App
