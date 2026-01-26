import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Sparkles, Github, Wifi, WifiOff, MessagesSquare, BarChart3 } from "lucide-react"

const Header = ({ 
  darkMode, 
  onToggleDarkMode, 
  currentChatTitle,
  isBackendOnline = false,
  onOpenDashboard,
  showDashboard = false,
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

