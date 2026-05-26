import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, X, BarChart3, Search, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

const MAX = 4

export default function CollegeComparePage() {
  const [selected, setSelected] = useState([])
  const [compared, setCompared] = useState([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [comparing, setComparing] = useState(false)
  const { toast } = useToast()

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!search.trim()) return
    setSearching(true)
    try {
      const res = await api.get('/api/colleges', { params: { search, limit: 6 } })
      setResults(res.data.colleges)
    } catch { }
    setSearching(false)
  }

  const addCollege = (college) => {
    if (selected.length >= MAX) { toast({ title: `Max ${MAX} colleges`, variant: 'destructive' }); return }
    if (selected.find(c => c._id === college._id)) return
    setSelected(s => [...s, college])
    setResults([])
    setSearch('')
  }

  const removeCollege = (id) => setSelected(s => s.filter(c => c._id !== id))

  const handleCompare = async () => {
    if (selected.length < 2) { toast({ title: 'Select at least 2 colleges', variant: 'destructive' }); return }
    setComparing(true)
    try {
      const ids = selected.map(c => c._id).join(',')
      const res = await api.get('/api/colleges/compare', { params: { ids } })
      setCompared(res.data)
    } catch { }
    setComparing(false)
  }

  // Build radar data from compared colleges
  const radarData = compared.length > 0 ? [
    { subject: 'Ranking', ...Object.fromEntries(compared.map(c => [c.name?.slice(0, 10), c.ranking ? Math.max(0, 100 - c.ranking) : 0])) },
    { subject: 'Courses', ...Object.fromEntries(compared.map(c => [c.name?.slice(0, 10), Math.min(100, (c.courses?.length || 0) * 5)])) },
    { subject: 'Facilities', ...Object.fromEntries(compared.map(c => [c.name?.slice(0, 10), Math.min(100, (c.facilities?.length || 0) * 10)])) },
    { subject: 'Placement', ...Object.fromEntries(compared.map(c => [c.name?.slice(0, 10), c.placements?.[0]?.placementRate || 0])) },
  ] : []

  const COLORS = ['hsl(var(--primary))', '#3b82f6', '#10b981', '#f59e0b']

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full mb-4">
          <Sparkles className="h-3.5 w-3.5" /> Comparison Workspace
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold mb-2">Compare colleges with clarity</h1>
        <p className="text-muted-foreground">Select up to {MAX} colleges to compare side-by-side.</p>
      </div>

      {/* Search */}
      <Card className="mb-6 glass-panel">
        <CardContent className="p-5 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search college to add..." className="pl-9" />
            </div>
            <Button type="submit" disabled={searching}>Search</Button>
          </form>

          {results.length > 0 && (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {results.map(c => (
                <button key={c._id} onClick={() => addCollege(c)} className="flex items-center gap-2 p-2 rounded-xl border border-white/70 bg-white/70 hover:border-indigo-300 hover:bg-white text-left transition-colors">
                  <Avatar className="h-8 w-8 rounded-lg shrink-0">
                    <AvatarImage src={c.logo} />
                    <AvatarFallback className="rounded-lg text-xs">{c.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.address?.city}</p>
                  </div>
                  <Plus className="h-4 w-4 text-primary ml-auto shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Selected */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map(c => (
                <Badge key={c._id} variant="secondary" className="gap-1 pr-1 bg-white/70 border border-white/70">
                  {c.name?.slice(0, 20)}
                  <button onClick={() => removeCollege(c._id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              <Button size="sm" onClick={handleCompare} disabled={comparing || selected.length < 2}>
                <BarChart3 className="h-4 w-4 mr-1" /> Compare
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison table */}
      {compared.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Radar chart */}
          <Card className="glass-panel">
            <CardHeader><CardTitle className="text-base">Visual Comparison</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  {compared.map((c, i) => (
                    <Radar key={c._id} name={c.name?.slice(0, 15)} dataKey={c.name?.slice(0, 10)} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="glass-panel">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/70">
                    <th className="text-left p-4 font-medium text-muted-foreground w-36">Parameter</th>
                    {compared.map(c => (
                      <th key={c._id} className="text-left p-4 font-medium">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 rounded-lg">
                            <AvatarImage src={c.logo} />
                            <AvatarFallback className="rounded-lg text-xs">{c.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[120px]">{c.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Type', key: c => c.type || '—' },
                    { label: 'Ranking', key: c => c.ranking ? `#${c.ranking}` : '—' },
                    { label: 'Accreditation', key: c => c.accreditation || '—' },
                    { label: 'Location', key: c => c.address?.city ? `${c.address.city}, ${c.address.state}` : '—' },
                    { label: 'Courses', key: c => c.courses?.length || 0 },
                    { label: 'Hostel', key: c => c.hostelAvailable ? '✓ Yes' : '✗ No' },
                    { label: 'Campus Size', key: c => c.campusSize || '—' },
                    { label: 'Placement Rate', key: c => c.placements?.[0]?.placementRate ? `${c.placements[0].placementRate}%` : '—' },
                    { label: 'Avg Package', key: c => c.placements?.[0]?.averagePackage ? `₹${(c.placements[0].averagePackage / 100000).toFixed(1)} LPA` : '—' },
                    { label: 'Scholarships', key: c => c.scholarshipDetails ? '✓ Available' : '—' },
                  ].map(({ label, key }) => (
                    <tr key={label} className="border-b border-white/70 hover:bg-white/60">
                      <td className="p-4 font-medium text-muted-foreground">{label}</td>
                      {compared.map(c => <td key={c._id} className="p-4">{key(c)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
