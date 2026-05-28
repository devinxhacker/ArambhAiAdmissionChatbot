import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Database, Globe, FileText, HardDrive, CheckCircle, XCircle, Clock,
  Loader2, RefreshCw, Search, Trash2, ExternalLink, Eye, Filter,
  TrendingUp, Activity, Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }
const stagger = { show: { transition: { staggerChildren: 0.06 } } }

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function StatCard({ title, value, icon: Icon, color = 'indigo', subtitle }) {
  const colorMap = {
    indigo: 'bg-indigo-500/15 text-indigo-500',
    green: 'bg-emerald-500/15 text-emerald-500',
    amber: 'bg-amber-500/15 text-amber-500',
    red: 'bg-red-500/15 text-red-500',
    blue: 'bg-blue-500/15 text-blue-500',
    purple: 'bg-purple-500/15 text-purple-500',
  }
  return (
    <motion.div variants={fadeUp}>
      <Card className="glass-panel">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{value ?? '—'}</div>
              <div className="text-xs text-muted-foreground">{title}</div>
              {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function StatusBadge({ status }) {
  if (status === 'completed') return <Badge variant="success" className="text-[10px]"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Indexed</Badge>
  if (status === 'failed') return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-2.5 w-2.5 mr-0.5" />Failed</Badge>
  if (status === 'scraping') return <Badge className="text-[10px] bg-blue-100 text-blue-700"><Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />Crawling</Badge>
  if (status === 'running') return <Badge className="text-[10px] bg-blue-100 text-blue-700"><Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />Running</Badge>
  if (status === 'success') return <Badge variant="success" className="text-[10px]"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Success</Badge>
  return <Badge variant="outline" className="text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" />Pending</Badge>
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CrawlDataPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [urls, setUrls] = useState({ urls: [], total: 0 })
  const [documents, setDocuments] = useState({ documents: [], total: 0 })
  const [jobs, setJobs] = useState({ jobs: [] })
  const [loading, setLoading] = useState(true)
  const [docSearch, setDocSearch] = useState('')
  const [urlFilter, setUrlFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [docDetailOpen, setDocDetailOpen] = useState(false)

  const fetchOverview = async () => {
    try {
      const res = await api.get('/api/superadmin/crawl/overview')
      setOverview(res.data)
    } catch (e) { console.error(e) }
  }

  const fetchUrls = async (filter = '') => {
    try {
      const params = { limit: 100 }
      if (filter) params.college = filter
      const res = await api.get('/api/superadmin/crawl/urls', { params })
      setUrls(res.data)
    } catch (e) { console.error(e) }
  }

  const fetchDocuments = async (search = '', source_type = '') => {
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (source_type) params.source_type = source_type
      const res = await api.get('/api/superadmin/crawl/documents', { params })
      setDocuments(res.data)
    } catch (e) { console.error(e) }
  }

  const fetchJobs = async () => {
    try {
      const res = await api.get('/api/superadmin/crawl/jobs')
      setJobs(res.data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    Promise.all([fetchOverview(), fetchUrls(), fetchDocuments(), fetchJobs()])
      .finally(() => setLoading(false))
  }, [])

  const handleDeleteDoc = async (docId) => {
    if (!confirm('Delete this document and its vectors from the index?')) return
    try {
      await api.delete(`/api/superadmin/crawl/documents/${docId}`)
      toast({ title: 'Document deleted' })
      fetchDocuments(docSearch, sourceFilter)
      fetchOverview()
    } catch (e) {
      toast({ title: 'Delete failed', variant: 'destructive' })
    }
  }

  const handleViewDoc = async (docId) => {
    try {
      const res = await api.get(`/api/superadmin/crawl/documents/${docId}`)
      setSelectedDoc(res.data)
      setDocDetailOpen(true)
    } catch (e) {
      toast({ title: 'Failed to load document', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const pieData = overview ? [
    { name: 'Web Crawl', value: overview.documents.web_crawl },
    { name: 'Upload', value: overview.documents.upload },
    { name: 'HTML', value: overview.documents.html },
  ].filter(d => d.value > 0) : []

  const urlPieData = overview ? [
    { name: 'Indexed', value: overview.website_urls.indexed },
    { name: 'Pending', value: overview.website_urls.pending },
    { name: 'Failed', value: overview.website_urls.failed },
    { name: 'Crawling', value: overview.website_urls.scraping },
  ].filter(d => d.value > 0) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Crawl Data & Analytics</h1>
          <p className="text-muted-foreground mt-1">Monitor crawl status, explore indexed data, and manage the knowledge base.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchOverview(); fetchUrls(); fetchDocuments(); fetchJobs() }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="urls">URLs</TabsTrigger>
          <TabsTrigger value="data">Data Explorer</TabsTrigger>
          <TabsTrigger value="jobs">Crawl Jobs</TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─── */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard title="Total Documents" value={overview?.documents.total} icon={FileText} color="indigo" />
            <StatCard title="Total Chunks" value={overview?.documents.total_chunks?.toLocaleString()} icon={Layers} color="purple" />
            <StatCard title="Website URLs" value={overview?.website_urls.total} icon={Globe} color="blue" />
            <StatCard title="URLs Indexed" value={overview?.website_urls.indexed} icon={CheckCircle} color="green" />
            <StatCard title="Crawl Jobs" value={overview?.crawl_jobs.total} icon={Activity} color="amber" />
            <StatCard title="Failed Jobs" value={overview?.crawl_jobs.failed} icon={XCircle} color="red" />
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Daily crawl activity chart */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Daily Indexing Activity (7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={overview?.daily_activity || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="_id" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => v?.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="docs_indexed" name="Docs Indexed" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="chunks_created" name="Chunks Created" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Document source distribution */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" /> Data Source Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 w-full">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={urlPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {urlPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top colleges by indexed content */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Top Colleges by Indexed Content</CardTitle>
              <CardDescription>Colleges with the most crawled and indexed data</CardDescription>
            </CardHeader>
            <CardContent>
              {overview?.top_colleges?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No crawled data yet.</p>
              ) : (
                <div className="space-y-2">
                  {overview?.top_colleges?.map((c, i) => (
                    <div key={c._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.url_count} URLs · {c.total_pages || 0} pages</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{c.total_chunks} chunks</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── URLs Tab ─── */}
        <TabsContent value="urls" className="space-y-4 mt-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by college name..."
                className="pl-9"
                value={urlFilter}
                onChange={e => { setUrlFilter(e.target.value); fetchUrls(e.target.value) }}
              />
            </div>
            <Badge variant="outline">{urls.total} total URLs</Badge>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">College</th>
                  <th className="text-left p-3 font-medium">URL</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Pages</th>
                  <th className="text-right p-3 font-medium">Chunks</th>
                  <th className="text-left p-3 font-medium">Auto-Refresh</th>
                  <th className="text-left p-3 font-medium">Last Crawled</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {urls.urls.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No URLs found</td></tr>
                ) : urls.urls.map((u, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="p-3 font-medium text-xs max-w-[140px] truncate">{u.college_name}</td>
                    <td className="p-3 max-w-[200px]">
                      <div className="truncate text-xs">{u.label || u.url}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{u.url}</div>
                    </td>
                    <td className="p-3"><StatusBadge status={u.status} /></td>
                    <td className="p-3 text-right text-xs">{u.pages_crawled || 0}</td>
                    <td className="p-3 text-right text-xs">{u.chunks_indexed || 0}</td>
                    <td className="p-3">
                      {u.auto_refresh ? (
                        <Badge variant="outline" className="text-[10px]">
                          <RefreshCw className="h-2.5 w-2.5 mr-0.5" />{u.refresh_interval_hours || 24}h
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Off</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(u.last_crawled_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ─── Data Explorer Tab ─── */}
        <TabsContent value="data" className="space-y-4 mt-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, URL, or doc ID..."
                className="pl-9"
                value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchDocuments(docSearch, sourceFilter)}
              />
            </div>
            <select
              className="h-9 px-3 rounded-md border text-sm bg-background"
              value={sourceFilter}
              onChange={e => { setSourceFilter(e.target.value); fetchDocuments(docSearch, e.target.value) }}
            >
              <option value="">All Sources</option>
              <option value="web_crawl">Web Crawl</option>
              <option value="html">HTML</option>
              <option value="pdf">PDF</option>
              <option value="upload">Upload</option>
              <option value="text">Text</option>
            </select>
            <Button size="sm" onClick={() => fetchDocuments(docSearch, sourceFilter)}>
              <Search className="h-3.5 w-3.5 mr-1" /> Search
            </Button>
            <Badge variant="outline">{documents.total} documents</Badge>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Title</th>
                  <th className="text-left p-3 font-medium">Source</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-right p-3 font-medium">Chunks</th>
                  <th className="text-left p-3 font-medium">College</th>
                  <th className="text-left p-3 font-medium">Updated</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {documents.documents.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No documents found</td></tr>
                ) : documents.documents.map((doc) => (
                  <tr key={doc._id} className="hover:bg-muted/30">
                    <td className="p-3 max-w-[200px]">
                      <div className="truncate text-xs font-medium">{doc.title || '(untitled)'}</div>
                      <div className="truncate text-[10px] text-muted-foreground font-mono">{doc.doc_id?.slice(0, 40)}</div>
                    </td>
                    <td className="p-3 max-w-[180px]">
                      {doc.source_url ? (
                        <a href={doc.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                          {doc.source_url.replace(/^https?:\/\//, '').slice(0, 40)}
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">{doc.source_type}</Badge>
                    </td>
                    <td className="p-3 text-right text-xs">{doc.chunk_count || 0}</td>
                    <td className="p-3 text-xs text-muted-foreground truncate max-w-[100px]">{doc.metadata?.college || '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(doc.updated_at)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDoc(doc.doc_id)} title="View details">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {doc.source_url && (
                          <a href={doc.source_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Open source">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteDoc(doc.doc_id)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ─── Crawl Jobs Tab ─── */}
        <TabsContent value="jobs" className="space-y-4 mt-6">
          <div className="flex items-center gap-3">
            <Badge variant="outline">{jobs.jobs?.length || 0} recent jobs</Badge>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Source</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Pages</th>
                  <th className="text-right p-3 font-medium">Indexed</th>
                  <th className="text-right p-3 font-medium">PDFs</th>
                  <th className="text-right p-3 font-medium">Duration</th>
                  <th className="text-left p-3 font-medium">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.jobs?.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No crawl jobs found</td></tr>
                ) : jobs.jobs?.map((job) => (
                  <tr key={job._id} className="hover:bg-muted/30">
                    <td className="p-3 text-xs font-medium">{job.source_name || job.source_id || 'ad-hoc'}</td>
                    <td className="p-3"><StatusBadge status={job.status} /></td>
                    <td className="p-3 text-right text-xs">{job.pages_crawled || 0}</td>
                    <td className="p-3 text-right text-xs">{job.pages_indexed || 0}</td>
                    <td className="p-3 text-right text-xs">{job.pdfs_indexed || 0}</td>
                    <td className="p-3 text-right text-xs">{job.elapsed_sec ? `${job.elapsed_sec}s` : '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(job.started_at || job.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Document Detail Dialog */}
      <Dialog open={docDetailOpen} onOpenChange={setDocDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Document Details</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p className="font-medium">{selectedDoc.title || '(untitled)'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source Type</p>
                  <Badge variant="outline">{selectedDoc.source_type}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Doc ID</p>
                  <p className="font-mono text-xs break-all">{selectedDoc.doc_id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Chunks</p>
                  <p className="font-medium">{selectedDoc.chunk_count || 0}</p>
                </div>
                {selectedDoc.source_url && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Source URL</p>
                    <a href={selectedDoc.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                      {selectedDoc.source_url}
                    </a>
                  </div>
                )}
                {selectedDoc.content_hash && (
                  <div>
                    <p className="text-xs text-muted-foreground">Content Hash</p>
                    <p className="font-mono text-[10px] break-all">{selectedDoc.content_hash}</p>
                  </div>
                )}
                {selectedDoc.crawl_seed && (
                  <div>
                    <p className="text-xs text-muted-foreground">Crawl Seed</p>
                    <p className="text-xs break-all">{selectedDoc.crawl_seed}</p>
                  </div>
                )}
                {selectedDoc.crawl_depth !== undefined && selectedDoc.crawl_depth !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Crawl Depth</p>
                    <p className="text-xs">{selectedDoc.crawl_depth}</p>
                  </div>
                )}
              </div>

              {selectedDoc.metadata && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Metadata</p>
                  <pre className="text-[10px] bg-muted/50 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedDoc.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>Created: {formatDate(selectedDoc.created_at)}</div>
                <div>Updated: {formatDate(selectedDoc.updated_at)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
