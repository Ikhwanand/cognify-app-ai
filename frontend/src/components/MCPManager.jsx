import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Server, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Plug, 
  Unplug,
  Check,
  X,
  AlertCircle,
  Loader2,
  Terminal,
  Globe,
  ChevronDown,
  ChevronUp,
  Settings2,
  Zap,
  Clock,
  Wrench,
  ArrowLeft
} from 'lucide-react';
import { mcpAPI } from '../services/api';
import { cn } from '../lib/utils';

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    active: { 
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', 
      icon: Check,
      label: 'Active'
    },
    inactive: { 
      color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', 
      icon: X,
      label: 'Inactive'
    },
    error: { 
      color: 'bg-red-500/20 text-red-400 border-red-500/30', 
      icon: AlertCircle,
      label: 'Error'
    },
  };

  const config = statusConfig[status] || statusConfig.inactive;
  const Icon = config.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
      config.color
    )}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

// MCP Server Card
const MCPServerCard = ({ 
  server, 
  onTest, 
  onConnect, 
  onDisconnect, 
  onDelete,
  isConnected,
  isLoading 
}) => {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(server.id);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
    setTesting(false);
  };

  const isCommand = server.transport_type === 'command';

  return (
    <div className={cn(
      'group relative rounded-xl border transition-all duration-300',
      'bg-gradient-to-br from-gray-900/80 to-gray-800/50',
      'border-gray-700/50 hover:border-gray-600/50',
      'hover:shadow-lg hover:shadow-purple-500/5',
      isConnected && 'ring-2 ring-emerald-500/30 border-emerald-500/30'
    )}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn(
              'p-2.5 rounded-lg',
              isCommand 
                ? 'bg-orange-500/20 text-orange-400' 
                : 'bg-blue-500/20 text-blue-400'
            )}>
              {isCommand ? <Terminal className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white truncate">{server.name}</h3>
                <StatusBadge status={server.status} />
              </div>
              
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {server.description || 'No description'}
              </p>
              
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  isCommand 
                    ? 'bg-orange-500/10 text-orange-400' 
                    : 'bg-blue-500/10 text-blue-400'
                )}>
                  {isCommand ? 'Command' : 'HTTP'}
                </span>
                
                {server.is_enabled ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                    Enabled
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500">
                    Disabled
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={testing || isLoading}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="Test Connection"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
            
            {isConnected ? (
              <button
                onClick={() => onDisconnect(server.id)}
                disabled={isLoading}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'bg-red-500/20 hover:bg-red-500/30 text-red-400',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                title="Disconnect"
              >
                <Unplug className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onConnect(server.id)}
                disabled={isLoading || !server.is_enabled}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                title="Connect"
              >
                <Plug className="w-4 h-4" />
              </button>
            )}
            
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={cn(
            'mt-4 p-3 rounded-lg text-sm',
            testResult.success 
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          )}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-medium">{testResult.message}</p>
                {testResult.latency_ms && (
                  <p className="text-xs opacity-75 mt-1">
                    Latency: {testResult.latency_ms.toFixed(0)}ms
                  </p>
                )}
                {testResult.tools && testResult.tools.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {testResult.tools.map((tool, i) => (
                      <span 
                        key={i}
                        className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300"
                      >
                        {tool.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-700/50 pt-4 space-y-3">
          {isCommand ? (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">Command</label>
              <code className="block mt-1 p-2 bg-black/30 rounded-lg text-sm text-gray-300 font-mono overflow-x-auto">
                {server.command}
              </code>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">URL</label>
              <code className="block mt-1 p-2 bg-black/30 rounded-lg text-sm text-gray-300 font-mono overflow-x-auto">
                {server.url}
              </code>
            </div>
          )}

          {server.available_tools && server.available_tools.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">Available Tools</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {server.available_tools.map((tool, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 text-purple-300 rounded-lg text-xs"
                  >
                    <Wrench className="w-3 h-3" />
                    {tool.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {server.last_connected_at && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              Last connected: {new Date(server.last_connected_at).toLocaleString()}
            </div>
          )}

          {server.error_message && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              <strong>Error:</strong> {server.error_message}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => onDelete(server.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Add Server Modal
const AddServerModal = ({ isOpen, onClose, onAdd, presets }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    transport_type: 'command',
    command: '',
    url: '',
    is_enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPresets, setShowPresets] = useState(true);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      transport_type: 'command',
      command: '',
      url: '',
      is_enabled: true,
    });
    setShowPresets(true);
    setError(null);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await onAdd(formData);
      resetForm();
      onClose();
    } catch (err) {
      console.error('Error in modal submit:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const applyPreset = (preset) => {
    setFormData({
      name: preset.name,
      description: preset.description,
      transport_type: preset.transport_type,
      command: preset.command_template || '',
      url: preset.url || '',
      is_enabled: true,
    });
    setShowPresets(false);
  };

  if (!isOpen) return null;

  // Use portal to render modal outside component tree
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-400" />
            Add MCP Server
          </h2>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Presets Section */}
          {showPresets && presets && presets.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Start with Presets</h3>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all',
                      'bg-gray-800/50 border-gray-700/50',
                      'hover:bg-gray-700/50 hover:border-gray-600/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {preset.transport_type === 'command' ? (
                        <Terminal className="w-4 h-4 text-orange-400" />
                      ) : (
                        <Globe className="w-4 h-4 text-blue-400" />
                      )}
                      <span className="font-medium text-white text-sm">{preset.name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{preset.description}</p>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowPresets(false)}
                className="mt-3 text-sm text-purple-400 hover:text-purple-300"
              >
                Or configure manually →
              </button>
            </div>
          )}

          {/* Manual Form */}
          {!showPresets && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  placeholder="filesystem"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  placeholder="Access local filesystem"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Transport Type</label>
                <select
                  value={formData.transport_type}
                  onChange={(e) => setFormData({ ...formData, transport_type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                >
                  <option value="command">Command (Local)</option>
                  <option value="streamable-http">HTTP (Remote)</option>
                  <option value="sse">SSE (Server-Sent Events)</option>
                </select>
              </div>

              {formData.transport_type === 'command' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Command</label>
                  <input
                    type="text"
                    value={formData.command}
                    onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 font-mono text-sm"
                    placeholder="npx -y @modelcontextprotocol/server-filesystem C:/MyProject"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                    placeholder="https://example.com/mcp"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_enabled"
                  checked={formData.is_enabled}
                  onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                />
                <label htmlFor="is_enabled" className="text-sm text-gray-300">Enable this server</label>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPresets(true)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  ← Back to Presets
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add Server
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// Main MCP Manager Component
export default function MCPManager({ onBack }) {
  const [servers, setServers] = useState([]);
  const [activeConnections, setActiveConnections] = useState([]);
  const [stats, setStats] = useState(null);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      else setRefreshing(true);
      
      const [serversRes, activeRes, statsRes, presetsRes] = await Promise.all([
        mcpAPI.getServers(),
        mcpAPI.getActiveConnections(),
        mcpAPI.getStats(),
        mcpAPI.getPresets(),
      ]);
      
      setServers(serversRes.servers || []);
      // Ensure activeConnections is always an array
      setActiveConnections(Array.isArray(activeRes) ? activeRes : []);
      setStats(statsRes);
      setPresets(presetsRes.presets || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching MCP data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Using IIFE to properly handle async in useEffect
    (async () => {
      await fetchData(true);
    })();
  }, []);

  const handleAddServer = async (serverData) => {
    try {
      const response = await mcpAPI.createServer(serverData);
      // Optimistic update - add to local state instead of refetching
      // This avoids DOM conflicts with browser extensions
      if (response && response.id) {
        setServers(prev => [...prev, response]);
        setStats(prev => prev ? {
          ...prev,
          total_servers: (prev.total_servers || 0) + 1,
          enabled_servers: serverData.is_enabled ? (prev.enabled_servers || 0) + 1 : prev.enabled_servers
        } : null);
      }
      return true;
    } catch (err) {
      console.error('Error adding server:', err);
      throw err;
    }
  };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    // Don't refetch - we already updated optimistically
  };

  const handleTestConnection = async (serverId) => {
    try {
      const result = await mcpAPI.testConnection(serverId);
      await fetchData(false); // Refresh to update status
      return result;
    } catch (err) {
      console.error('Error testing connection:', err);
      throw err;
    }
  };

  const handleConnect = async (serverId) => {
    try {
      await mcpAPI.connectServer(serverId);
      await fetchData(false);
    } catch (err) {
      console.error('Error connecting:', err);
      setError(`Failed to connect: ${err.message}`);
    }
  };

  const handleDisconnect = async (serverId) => {
    try {
      await mcpAPI.disconnectServer(serverId);
      await fetchData(false);
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError(`Failed to disconnect: ${err.message}`);
    }
  };

  const handleDelete = async (serverId) => {
    if (confirm('Are you sure you want to delete this MCP server?')) {
      try {
        await mcpAPI.deleteServer(serverId);
        await fetchData(false);
      } catch (err) {
        console.error('Error deleting:', err);
        setError(`Failed to delete: ${err.message}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              title="Back to Chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              MCP Servers
            </h1>
            <p className="text-gray-400 mt-1">
              Manage Model Context Protocol servers to extend AI capabilities
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="p-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={cn("w-5 h-5", refreshing && "animate-spin")} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20"
          >
            <Plus className="w-5 h-5" />
            Add Server
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-gray-800/80 to-gray-900/50 border border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Server className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_servers}</p>
                <p className="text-xs text-gray-400">Total Servers</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-gradient-to-br from-gray-800/80 to-gray-900/50 border border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Plug className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.active_servers}</p>
                <p className="text-xs text-gray-400">Active</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-gradient-to-br from-gray-800/80 to-gray-900/50 border border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Settings2 className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.enabled_servers}</p>
                <p className="text-xs text-gray-400">Enabled</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-gradient-to-br from-gray-800/80 to-gray-900/50 border border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.error_servers}</p>
                <p className="text-xs text-gray-400">Errors</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Servers Grid */}
      {servers.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex p-4 rounded-full bg-gray-800/50 mb-4">
            <Server className="w-10 h-10 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No MCP Servers</h3>
          <p className="text-gray-400 mb-6">
            Add your first MCP server to extend your AI's capabilities
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Your First Server
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {servers.map((server) => (
            <MCPServerCard
              key={server.id}
              server={server}
              isConnected={activeConnections.includes(server.id)}
              onTest={handleTestConnection}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onDelete={handleDelete}
              isLoading={loading}
            />
          ))}
        </div>
      )}

      {/* Add Server Modal */}
      <AddServerModal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        onAdd={handleAddServer}
        presets={presets}
      />
    </div>
  );
}
