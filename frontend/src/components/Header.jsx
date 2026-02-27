import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Sparkles, Github, Wifi, WifiOff, MessagesSquare, BarChart3, Zap, Bot, BarChart, Code2, Phone } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const Header = ({ 
  darkMode, 
  onToggleDarkMode, 
  currentChatTitle,
  isBackendOnline = false,
  onOpenDashboard,
  onOpenMCP,
  onOpenLiveTalk,
  showDashboard = false,
  showMCP = false,
  showSkills = false,
  showLiveTalk = false,
  mode = "chat",
  onModeChange,
  className 
}) => {
  return (
    <header className={cn(
      "flex items-center justify-between px-6 py-3 border-b border-border bg-background/80 backdrop-blur-sm",
      className
    )}>
      {/* Left side - Current chat info */}
      <div className="flex items-center gap-3">
        {showDashboard ? (
          <>
            <BarChart3 className="h-5 w-5 text-purple-500" />
            <h1 className="font-medium text-sm">Evaluation Dashboard</h1>
          </>
        ) : showMCP ? (
          <>
            <Zap className="h-5 w-5 text-purple-500" />
            <h1 className="font-medium text-sm">MCP Servers</h1>
          </>
        ) : showLiveTalk ? (
          <>
            <Phone className="h-5 w-5 text-green-500" />
            <h1 className="font-medium text-sm">Live Talk</h1>
          </>
        ) : currentChatTitle ? (
          <>
            <MessagesSquare className="h-5 w-5 text-primary" />
            <h1 className="font-medium text-sm truncate max-w-[300px]">
              {currentChatTitle}
            </h1>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">New Conversation</span>
        )}
      </div>

      {/* Center - Mode Selection */}
      {!showDashboard && !showMCP && !showSkills && !showLiveTalk && (
        <div className="flex justify-center items-center flex-1 mx-4">
          <Select value={mode} onValueChange={onModeChange}>
            <SelectTrigger className="w-[180px] h-9 bg-background">
              <SelectValue placeholder="Select Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chat">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  <span>Chat Assistant</span>
                </div>
              </SelectItem>
              <SelectItem value="analyst">
                <div className="flex items-center gap-2">
                  <BarChart className="w-4 h-4" />
                  <span>Data Analyst</span>
                </div>
              </SelectItem>
              <SelectItem value="engineer">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  <span>Software Engineer</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* Backend status indicator */}
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
          isBackendOnline 
            ? "bg-green-500/10 text-green-500" 
            : "bg-red-500/10 text-red-500"
        )}>
          {isBackendOnline ? (
            <>
              <Wifi className="h-3 w-3" />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </>
          )}
        </div>

        {/* Live Talk button */}
        {!showLiveTalk && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenLiveTalk}
            className="h-9 gap-2 text-muted-foreground hover:text-green-500 transition-colors"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Live Talk</span>
          </Button>
        )}

        {/* MCP button */}
        {!showMCP && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenMCP}
            className="h-9 gap-2 text-muted-foreground hover:text-foreground"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">MCP</span>
          </Button>
        )}

        {/* Dashboard button */}
        {!showDashboard && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDashboard}
            className="h-9 gap-2 text-muted-foreground hover:text-foreground"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
        )}

        {/* GitHub link */}
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-9 w-9"
        >
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Github className="h-4 w-4" />
          </a>
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDarkMode}
          className="h-9 w-9"
        >
          {darkMode ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  )
}

export { Header }
