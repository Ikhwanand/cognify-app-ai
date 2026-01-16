import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { 
  MessageSquare, 
  Plus, 
  FolderOpen, 
  Upload, 
  Trash2, 
  Settings,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles
} from "lucide-react"

const Sidebar = ({ 
  isCollapsed, 
  onToggle, 
  chatHistory = [], 
  knowledgeBase = [],
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onUploadDocument,
  onDeleteDocument,
  onOpenSettings,
  selectedChatId,
  className
}) => {
  return (
    <TooltipProvider delayDuration={0}>
      <div 
        className={cn(
          "relative flex flex-col h-full bg-card border-r border-border transition-all duration-300",
          isCollapsed ? "w-16" : "w-72",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Cognify AI</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={cn("h-8 w-8", isCollapsed && "mx-auto")}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onNewChat}
                  className="w-full h-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New Chat</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              onClick={onNewChat}
              className="w-full justify-start gap-2"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          )}
        </div>

        <Separator />

        {/* Chat History Section */}
        <div className="flex-1 overflow-hidden">
          {!isCollapsed && (
            <div className="px-4 py-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Chat History
              </h3>
            </div>
          )}
          
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-1 py-2">
              {chatHistory.length === 0 ? (
                !isCollapsed && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No conversations yet
                  </p>
                )
              ) : (
                chatHistory.map((chat) => (
                  isCollapsed ? (
                    <Tooltip key={chat.id}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={selectedChatId === chat.id ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => onSelectChat(chat.id)}
                          className="w-full h-10"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{chat.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <div
                      key={chat.id}
                      className="flex items-center w-full"
                    >
                      <button
                        onClick={() => onSelectChat(chat.id)}
                        className={cn(
                          "flex-1 flex items-center gap-2 h-9 px-3 text-sm font-normal rounded-md transition-colors text-left",
                          "hover:bg-accent hover:text-accent-foreground",
                          "min-w-0 overflow-hidden",
                          selectedChatId === chat.id && "bg-secondary text-secondary-foreground"
                        )}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {chat.title.length > 20 ? chat.title.slice(0, 20) + "..." : chat.title}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteChat?.(chat.id)
                        }}
                        className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Knowledge Base Section */}
        <div className="p-3 space-y-2">
          {!isCollapsed && (
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Knowledge Base
              </h3>
              <span className="text-xs text-muted-foreground">
                {knowledgeBase.length} files
              </span>
            </div>
          )}

          {/* Upload Button */}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onUploadDocument}
                  className="w-full h-10"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Upload Document</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              onClick={onUploadDocument}
              className="w-full justify-start gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          )}

          {/* Knowledge Base Files */}
          {!isCollapsed && knowledgeBase.length > 0 && (
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {knowledgeBase.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-accent group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{doc.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteDocument(doc.id)}
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <Separator />

        {/* Settings */}
        <div className="p-3">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenSettings}
                  className="w-full h-10"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              onClick={onOpenSettings}
              className="w-full justify-start gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export { Sidebar }
