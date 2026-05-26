import { useEffect, useState } from 'react'
import { Users, MessageSquare, FileText, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

const StatCard = ({ title, value, icon: Icon, description }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value ?? '—'}</div>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </CardContent>
  </Card>
)

export default function AdminPage() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/admin/stats').then((res) => setStats(res.data)).catch(() => {})
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">System overview and statistics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={stats?.users} icon={Users} description="Registered accounts" />
        <StatCard title="Chat Sessions" value={stats?.sessions} icon={MessageSquare} description="All time" />
        <StatCard title="Documents" value={stats?.documents} icon={FileText} description="Indexed in vector store" />
        <StatCard title="Queries Today" value={stats?.queriesToday} icon={Activity} description="RAG queries" />
      </div>
    </div>
  )
}
