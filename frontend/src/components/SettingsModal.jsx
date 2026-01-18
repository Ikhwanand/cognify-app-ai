import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select"
import { 
  Sparkles, 
  Palette, 
  MessageSquare, 
  Database,
  RotateCcw,
  Save,
  Loader2
} from "lucide-react"

const defaultSettings = {
  // Appearance
  theme: 'dark',
  
  // AI Configuration
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: 'You are a helpful AI assistant that answers questions based on the provided knowledge base.',
  
  // RAG Settings
  topK: 5,
  includeSources: true,
  
  // Chat Preferences
  autoScroll: true,
  sendOnEnter: true,
  showTimestamps: true,
  enableStreaming: true,
}

const SettingsModal = ({ 
  open, 
  onOpenChange, 
  settings = defaultSettings,
  onSave,
  isLoading = false
}) => {
  const [localSettings, setLocalSettings] = React.useState(settings)
  const [hasChanges, setHasChanges] = React.useState(false)

  // Reset local settings when modal opens
  React.useEffect(() => {
    if (open) {
      setLocalSettings(settings)
      setHasChanges(false)
    }
  }, [open, settings])

  const updateSetting = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    onSave?.(localSettings)
    setHasChanges(false)
  }

  const handleReset = () => {
    setLocalSettings(defaultSettings)
    setHasChanges(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your AI assistant preferences. Settings are saved to the backend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Appearance Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Appearance</h3>
            </div>
            <Separator />
            
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={localSettings.theme}
                  onValueChange={(value) => updateSetting('theme', value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* AI Configuration Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">AI Configuration</h3>
            </div>
            <Separator />
            
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="model">Model</Label>
                <Select
                  value={localSettings.model}
                  onValueChange={(value) => updateSetting('model', value)}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Groq</SelectLabel>
                      <SelectItem value="llama-3.3-70b-versatile">Llama 3.3 70B (Versatile)</SelectItem>
                      <SelectItem value="llama-3.1-8b-instant">Llama 3.1 8B (Instant)</SelectItem>
                      <SelectItem value="mixtral-8x7b-32768">Mixtral 8x7B</SelectItem>
                      <SelectItem value="gemma2-9b-it">Gemma 2 9B</SelectItem>
                      <SelectItem value="qwen/qwen3-32b">Qwen 3 32B</SelectItem>
                      <SelectItem value="moonshotai/kimi-k2-instruct-0905">Kimi K2 Instruct 0905</SelectItem>
                      <SelectItem value="openai/gpt-oss-120b">GPT OSS 120B</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Nvidia NIM</SelectLabel>
                      <SelectItem value="nvidia/meta/llama-3.1-405b-instruct">Llama 3.1 405B</SelectItem>
                      <SelectItem value="nvidia/meta/llama-3.1-70b-instruct">Llama 3.1 70B</SelectItem>
                      <SelectItem value="nvidia/mistralai/mixtral-8x22b-instruct-v0.1">Mixtral 8x22B</SelectItem>
                      <SelectItem value="nvidia/nvidia/nemotron-4-340b-reward">Nemotron 4 340B</SelectItem>
                      <SelectItem value="nvidia/moonshotai/kimi-k2-thinking">Kimi K2 Thinking</SelectItem>
                      <SelectItem value="nvidia/deepseek-ai/deepseek-v3.2">DeepSeek V3.2</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Temperature: {localSettings.temperature.toFixed(1)}</Label>
                  <span className="text-xs text-muted-foreground">
                    {localSettings.temperature < 0.3 ? 'Focused' : localSettings.temperature > 0.7 ? 'Creative' : 'Balanced'}
                  </span>
                </div>
                <Slider
                  value={[localSettings.temperature]}
                  onValueChange={([value]) => updateSetting('temperature', value)}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Max Tokens: {localSettings.maxTokens}</Label>
                </div>
                <Slider
                  value={[localSettings.maxTokens]}
                  onValueChange={([value]) => updateSetting('maxTokens', value)}
                  min={256}
                  max={4096}
                  step={256}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  value={localSettings.systemPrompt}
                  onChange={(e) => updateSetting('systemPrompt', e.target.value)}
                  placeholder="Enter custom instructions for the AI..."
                  className="min-h-[80px] resize-none"
                />
              </div>
            </div>
          </div>

          {/* RAG Settings Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Knowledge Base (RAG)</h3>
            </div>
            <Separator />
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Top-K Results: {localSettings.topK}</Label>
                  <span className="text-xs text-muted-foreground">
                    Number of relevant documents to retrieve
                  </span>
                </div>
                <Slider
                  value={[localSettings.topK]}
                  onValueChange={([value]) => updateSetting('topK', value)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="includeSources">Include Sources</Label>
                  <p className="text-xs text-muted-foreground">
                    Show which documents were used for the answer
                  </p>
                </div>
                <Switch
                  id="includeSources"
                  checked={localSettings.includeSources}
                  onCheckedChange={(checked) => updateSetting('includeSources', checked)}
                />
              </div>
            </div>
          </div>

          {/* Chat Preferences Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Chat Preferences</h3>
            </div>
            <Separator />
            
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoScroll">Auto-scroll</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically scroll to new messages
                  </p>
                </div>
                <Switch
                  id="autoScroll"
                  checked={localSettings.autoScroll}
                  onCheckedChange={(checked) => updateSetting('autoScroll', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sendOnEnter">Send on Enter</Label>
                  <p className="text-xs text-muted-foreground">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
                <Switch
                  id="sendOnEnter"
                  checked={localSettings.sendOnEnter}
                  onCheckedChange={(checked) => updateSetting('sendOnEnter', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showTimestamps">Show Timestamps</Label>
                  <p className="text-xs text-muted-foreground">
                    Display message timestamps
                  </p>
                </div>
                <Switch
                  id="showTimestamps"
                  checked={localSettings.showTimestamps}
                  onCheckedChange={(checked) => updateSetting('showTimestamps', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableStreaming">Enable Streaming</Label>
                  <p className="text-xs text-muted-foreground">
                    Stream AI responses in real-time
                  </p>
                </div>
                <Switch
                  id="enableStreaming"
                  checked={localSettings.enableStreaming}
                  onCheckedChange={(checked) => updateSetting('enableStreaming', checked)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { SettingsModal, defaultSettings }
