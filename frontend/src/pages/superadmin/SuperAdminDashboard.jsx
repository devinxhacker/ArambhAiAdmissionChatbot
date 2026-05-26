import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { Users, Building2, MessageSquare, TrendingUp, Shield, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/lib/api'

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }
const stagger = { show: { transition: { staggerChildren: 0.08 } } }

function StatCard({ title, value, icon: Icon, change }) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="relative overflow-hidden glass-panel">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Icon className="h-5 w-5 text-indigo-500" />
            </div>
            {change !== undefined && (
              <Badge variant={change >= 0 ? 'success' : 'destructive'} className="text-xs">
                {change >= 0 ? '+' : ''}{change}%
              </Badge>
            )}
          </div>
          <div className="text-3xl font-bold mb-1">{value ?? '—'}</div>
          <div className="text-sm text-muted-foreground">{title}</div>
        </CardContent>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400/60 to-blue-500" />
      </Card>
    </motion.div>
  )
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/superadmin/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Fill missing days in chart data
  const fillDays = (data, key = '_id') => {
    if (!data?.length) return []
    return data.map(d => ({ date: d[key]?.slice(5), count: d.count }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">Real-time platform analytics and management.</p>
      </div>

      {/* Stat cards */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Users" value={stats?.totalUsers} icon={Users} />
        <StatCard title="Admins" value={stats?.totalAdmins} icon={Shield} />
        <StatCard title="Colleges" value={stats?.totalColleges} icon={Building2} />
        <StatCard title="Chat Sessions" value={stats?.totalSessions} icon={MessageSquare} />
        <StatCard title="Active Today" value={stats?.activeUsersToday} icon={Activity} />
        <StatCard title="Queries Today" value={stats?.queriesToday} icon={TrendingUp} />
      </motion.div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Daily Signups (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={fillDays(stats?.dailySignups)}>
                <defs>
                  <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#signupGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Daily Queries (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={fillDays(stats?.dailyQueries)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top colleges */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Top Colleges by Queries</CardTitle>
          <CardDescription>Most searched colleges on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats?.topColleges?.length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
            {stats?.topColleges?.map((college, i) => (
              <div key={college._id} className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={college.logo} />
                  <AvatarFallback className="text-xs">{college.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{college.name}</p>
                  <p className="text-xs text-muted-foreground">{college.viewCount} views</p>
                </div>
                <Badge variant="secondary">{college.queryCount} queries</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
