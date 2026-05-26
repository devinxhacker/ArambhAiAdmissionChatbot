import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { MessageSquare, Eye, TrendingUp, BarChart3, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }
const stagger = { show: { transition: { staggerChildren: 0.08 } } }

function StatCard({ title, value, icon: Icon }) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="glass-panel">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Icon className="h-5 w-5 text-indigo-500" />
            </div>
          </div>
          <div className="text-3xl font-bold mb-1">{value ?? '—'}</div>
          <div className="text-sm text-muted-foreground">{title}</div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/api/admin/analytics/summary').then(r => setStats(r.data)).catch(() => {})
  }, [])

  const chartData = stats?.dailyQueries?.map(d => ({ date: d._id?.slice(5), count: d.count })) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {stats?.college?.name || 'My College'} Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Analytics for your college.</p>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Sessions" value={stats?.totalSessions} icon={MessageSquare} />
        <StatCard title="Queries Today" value={stats?.queriesToday} icon={TrendingUp} />
        <StatCard title="College Views" value={stats?.collegeViews} icon={Eye} />
        <StatCard title="Uploaded Files" value={stats?.totalFiles} icon={Building2} />
      </motion.div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Daily Queries (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#qGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
