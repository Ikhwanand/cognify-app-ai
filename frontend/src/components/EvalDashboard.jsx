import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { 
  Activity, 
  Zap, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Clock,
  Target,
  Cpu,
  BarChart3,
  RefreshCw,
  X,
  ChevronLeft,
} from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { evalsAPI } from '../services/api'

// Color palette for charts
const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

// Stat Card Component
function StatCard({ title, value, subtitle, icon: IconComponent, trend, color = 'purple' }) {
  const colorClasses = {
    purple: 'bg-purple-500/20 text-purple-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    green: 'bg-green-500/20 text-green-400',
    amber: 'bg-amber-500/20 text-amber-400',
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                {subtitle}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
            <IconComponent className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Dashboard Component
export default function EvalDashboard({ onBack }) {
  const [summary, setSummary] = useState(null)
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [_toolUsage, setToolUsage] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch dashboard data
  const fetchData = async () => {
    try {
      setRefreshing(true)
      const [summaryData, statsData, historyData, toolData, resultsData] = await Promise.all([
        evalsAPI.getSummary(),
        evalsAPI.getStats(),      // ALL data
        evalsAPI.getHistory(),    // ALL data
        evalsAPI.getToolUsage(),  // ALL data
        evalsAPI.getResults({ limit: 10 }),
      ])
      
      setSummary(summaryData)
      setStats(statsData)
      setHistory(historyData)
      setToolUsage(toolData)
      setResults(resultsData)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-purple-500" />
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <X className="h-12 w-12 mx-auto text-red-500" />
          <p className="mt-4 text-lg font-medium">Failed to load dashboard</p>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={fetchData} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Prepare data for charts
  const accuracyChartData = history.map(item => ({
    date: item.date.slice(5), // MM-DD format
    accuracy: item.accuracy_avg || 0,
    passRate: item.pass_rate || 0,
  }))

  const latencyChartData = history.map(item => ({
    date: item.date.slice(5),
    latency: item.latency_avg || 0,
  }))

  const modelComparisonData = stats?.stats_by_model 
    ? Object.entries(stats.stats_by_model).map(([model, data]) => ({
        model: model.split('/').pop().slice(0, 15),
        accuracy: data.avg_accuracy || 0,
        latency: data.avg_latency || 0,
        count: data.count || 0,
      }))
    : []

  const typeDistributionData = stats?.stats_by_type
    ? Object.entries(stats.stats_by_type).map(([type, data]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: data.count || 0,
      }))
    : []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Evaluation Dashboard</h1>
            <p className="text-muted-foreground">Monitor AI agent performance metrics</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchData}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Average Accuracy"
            value={`${summary?.avg_accuracy?.toFixed(1) || '0'}/10`}
            subtitle={`${summary?.recent_trend || 'stable'} from last week`}
            icon={Target}
            trend={summary?.recent_trend}
            color="purple"
          />
          <StatCard
            title="Avg Latency"
            value={`${(summary?.avg_latency_ms || 0).toFixed(0)}ms`}
            subtitle="Response time"
            icon={Zap}
            color="cyan"
          />
          <StatCard
            title="Tool Success Rate"
            value={`${(summary?.tool_success_rate || 0).toFixed(0)}%`}
            subtitle="Reliability score"
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            title="Total Evaluations"
            value={summary?.total_evals || 0}
            subtitle={`${(summary?.pass_rate || 0).toFixed(0)}% pass rate`}
            icon={Activity}
            color="amber"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accuracy Trend Chart */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                Accuracy Trend
              </CardTitle>
              <CardDescription>Daily accuracy scores over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {accuracyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={accuracyChartData}>
                      <defs>
                        <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#888" fontSize={12} />
                      <YAxis domain={[0, 10]} stroke="#888" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a2e', 
                          border: '1px solid #333',
                          borderRadius: '8px' 
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="accuracy" 
                        stroke="#8b5cf6" 
                        fill="url(#accuracyGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Latency Chart */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-cyan-500" />
                Response Latency
              </CardTitle>
              <CardDescription>Average response time in milliseconds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {latencyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={latencyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a2e', 
                          border: '1px solid #333',
                          borderRadius: '8px' 
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="#06b6d4" 
                        strokeWidth={2}
                        dot={{ fill: '#06b6d4', r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Model Comparison */}
          <Card className="bg-card/50 backdrop-blur border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-green-500" />
                Model Comparison
              </CardTitle>
              <CardDescription>Performance by AI model</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {modelComparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelComparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" domain={[0, 10]} stroke="#888" fontSize={12} />
                      <YAxis dataKey="model" type="category" stroke="#888" fontSize={11} width={120} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a2e', 
                          border: '1px solid #333',
                          borderRadius: '8px' 
                        }} 
                      />
                      <Bar dataKey="accuracy" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No model data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Eval Type Distribution */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-500" />
                Eval Types
              </CardTitle>
              <CardDescription>Distribution by type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {typeDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {typeDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a2e', 
                          border: '1px solid #333',
                          borderRadius: '8px' 
                        }} 
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Results Table */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              Recent Evaluations
            </CardTitle>
            <CardDescription>Latest evaluation results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Type</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Model</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Score</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Latency</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length > 0 ? (
                    results.map((result) => (
                      <tr key={result.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-3 px-4 font-medium">{result.eval_name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400">
                            {result.eval_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm">
                          {result.model_id?.split('/').pop().slice(0, 20)}
                        </td>
                        <td className="py-3 px-4">
                          {result.accuracy_score ? (
                            <span className={result.accuracy_score >= 7 ? 'text-green-400' : 'text-amber-400'}>
                              {result.accuracy_score.toFixed(1)}/10
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {result.latency_ms ? `${result.latency_ms.toFixed(0)}ms` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {result.passed ? (
                            <span className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="h-4 w-4" /> Passed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-400">
                              <X className="h-4 w-4" /> Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No evaluations yet. Run your first evaluation to see results here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Best Model Card */}
        {summary?.best_model && (
          <Card className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border-purple-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">🏆 Best Performing Model</p>
                  <p className="text-2xl font-bold mt-1">{summary.best_model}</p>
                  <p className="text-muted-foreground mt-1">
                    Average accuracy: <span className="text-green-400">{summary.best_model_accuracy?.toFixed(1)}/10</span>
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-xl">
                  <Target className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
