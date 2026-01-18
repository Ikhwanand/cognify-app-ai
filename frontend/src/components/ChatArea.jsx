import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, User, Loader2, Sparkles, Square } from "lucide-react"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const ChatMessage = ({ message, isUser, isStreaming = false }) => {
  return (
    <div className={cn(
      "flex gap-3 p-4",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-linear-to-br from-purple-500 to-pink-500 text-white"
      )}>
        {isUser ? (
          <User className="h-4 w-4" />
        ) : isStreaming ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex-1 max-w-[80%] rounded-2xl px-4 py-3 overflow-hidden",
        isUser 
          ? "bg-primary text-primary-foreground rounded-tr-sm" 
          : "bg-muted text-foreground rounded-tl-sm"
      )}>
        <div className={cn(
          "text-sm prose dark:prose-invert max-w-none break-words",
          isUser && "prose-p:text-primary-foreground prose-headings:text-primary-foreground prose-strong:text-primary-foreground prose-ul:text-primary-foreground prose-ol:text-primary-foreground"
        )}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom components to ensure styling matches shadcn/ui theme
              p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
              li: ({node, ...props}) => <li className="mb-1" {...props} />,
              h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2 mt-4" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2 mt-3" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-base font-bold mb-1 mt-2" {...props} />,
              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary/30 pl-4 italic my-2" {...props} />,
              code: ({node, inline, className, children, ...props}) => {
                return inline ? (
                  <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-xs" {...props}>
                    {children}
                  </code>
                ) : (
                  <pre className="bg-black/10 dark:bg-black/30 p-2 rounded-lg overflow-x-auto my-2">
                    <code className="font-mono text-xs" {...props}>
                      {children}
                    </code>
                  </pre>
                )
              },
              table: ({node, ...props}) => (
                <div className="overflow-x-auto my-4 w-full">
                  <table className="w-full border-collapse text-sm" {...props} />
                </div>
              ),
              thead: ({node, ...props}) => <thead className="bg-black/5 dark:bg-white/5" {...props} />,
              th: ({node, ...props}) => <th className="border border-border px-4 py-2 text-left font-bold" {...props} />,
              td: ({node, ...props}) => <td className="border border-border px-4 py-2" {...props} />,
              a: ({node, ...props}) => <a className="text-blue-500 underline hover:text-blue-600" target="_blank" rel="noopener noreferrer" {...props} />,
            }}
          >
            {message.content || (isStreaming ? "▌" : "")}
          </ReactMarkdown>
        </div>
        
        {message.timestamp && !isStreaming && (
          <p className={cn(
            "text-xs mt-2 opacity-70",
            isUser ? "text-primary-foreground" : "text-muted-foreground"
          )}>
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        )}
      </div>
    </div>
  )
}

const WelcomeScreen = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Cognify AI</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        Upload your documents and ask questions. I'll help you find answers from your personal knowledge base.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        {[
          { icon: "📚", title: "Upload Documents", desc: "Add PDFs, text files, or markdown" },
          { icon: "💬", title: "Ask Questions", desc: "Query your knowledge base naturally" },
          { icon: "🔍", title: "Semantic Search", desc: "Find relevant information instantly" },
          { icon: "🤖", title: "AI Powered", desc: "Powered by Groq & Agno" },
        ].map((item, i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors text-left"
          >
            <span className="text-2xl mb-2 block">{item.icon}</span>
            <h3 className="font-medium mb-1">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const ChatArea = ({ 
  messages = [], 
  streamingMessage = null,
  onSendMessage, 
  onStopStreaming,
  isLoading = false,
  isStreaming = false,
  className 
}) => {
  const [input, setInput] = React.useState("")
  const scrollRef = React.useRef(null)
  const textareaRef = React.useRef(null)

  // Auto-scroll to bottom when new messages arrive or streaming updates
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingMessage])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && !isLoading && !isStreaming) {
      onSendMessage(input.trim())
      setInput("")
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleStopClick = () => {
    if (isStreaming && onStopStreaming) {
      onStopStreaming()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInput(e.target.value)
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
  }

  const allMessages = streamingMessage 
    ? [...messages, streamingMessage]
    : messages

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Messages Area */}
      {allMessages.length === 0 ? (
        <WelcomeScreen />
      ) : (
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto min-h-0"
        >
          <div className="max-w-4xl mx-auto py-4">
            {allMessages.map((message, index) => (
              <ChatMessage 
                key={message.id || `msg-${index}`} 
                message={message} 
                isUser={message.role === 'user'}
                isStreaming={message.isStreaming}
              />
            ))}
            
            {/* Loading indicator (only when not streaming) */}
            {isLoading && !isStreaming && (
              <div className="flex gap-3 p-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-background/80 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-2 bg-muted rounded-2xl p-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents..."
              className="flex-1 min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-3 px-4"
              rows={1}
              disabled={isLoading || isStreaming}
            />
            {isStreaming ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={handleStopClick}
                className="h-10 w-10 rounded-xl shrink-0"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 rounded-xl shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            {isStreaming ? "Click stop to cancel streaming" : "Press Enter to send, Shift+Enter for new line"}
          </p>
        </form>
      </div>
    </div>
  )
}

export { ChatArea, ChatMessage, WelcomeScreen }

