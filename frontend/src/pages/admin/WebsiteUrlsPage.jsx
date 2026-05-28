import { useEffect, useState } from 'react'
import { Plus, Globe, ExternalLink, Loader2, Trash2, CheckCircle, XCircle, Clock, RefreshCw, Settings2 } from 'lucide-react'
import { useCollegeStore } from '@/store/collegeStore'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

function StatusBadge({ status }) {
  if (status === 'completed') return <Badge variant="success" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Indexed</Badge>
  if (status === 'failed') return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
  if (status === 'scraping') return <Badge className="text-xs bg-blue-100 text-blue-700"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Crawling</Badge>
  return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return `${diffDays}d ago`
}

export default function WebsiteUrlsPage() {
  const { myCollege, fetchMyCollege, addWebsiteUrl, deleteWebsiteUrl } = useCollegeStore()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ url: '', label: '', max_depth: 10, max_pages: 200, auto_refresh: true, refresh_interval_hours: 24 })
  const [saving, setSaving] = useState(false)
  const [recrawling, setRecrawling] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => { fetchMyCollege() }, [])

  // Auto-refresh the page to show crawl progress
  useEffect(() => {
    const urls = myCollege?.websiteUrls || []
    const hasCrawling = urls.some(u => u.status === 'scraping')
    if (hasCrawling) {
      const interval = setInterval(() => fetchMyCollege(), 5000)
      return () => clearInterval(interval)
    }
  }, [myCollege?.websiteUrls])

  const urls = myCollege?.websiteUrls || []

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    const result = await addWebsiteUrl(form)
    if (result.success) {
      toast({ title: 'Deep crawl started', description: 'The system is crawling the entire website and indexing all subpages. This may take a few minutes.' })
      setOpen(false)
      setForm({ url: '', label: '', max_depth: 10, max_pages: 200, auto_refresh: true, refresh_interval_hours: 24 })
      setShowAdvanced(false)
      // Refresh periodically to show progress
      setTimeout(() => fetchMyCollege(), 5000)
      setTimeout(() => fetchMyCollege(), 15000)
      setTimeout(() => fetchMyCollege(), 30000)
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleRecrawl = async (urlEntry) => {
    setRecrawling(urlEntry._id)
    try {
      const resp = await api.post('/api/admin/crawl-url', {
        url: urlEntry.url,
        entity_name: urlEntry.label || myCollege?.name || '',
        college: myCollege?.name || '',
        max_depth: urlEntry.max_depth || 10,
        max_pages: urlEntry.max_pages || 200,
      })
      const result = resp.data
      toast({
        title: 'Re-crawl complete',
        description: `${result.pages_crawled || 0} pages crawled. ${result.pages_updated || 0} updated, ${result.pages_unchanged || 0} unchanged.`,
      })
      fetchMyCollege()
    } catch (err) {
      toast({ title: 'Re-crawl failed', description: err.response?.data?.detail || 'Something went wrong', variant: 'destructive' })
    }
    setRecrawling(null)
  }

  const handleDelete = async (urlId) => {
    if (!confirm('Remove this URL and all its indexed pages from the knowledge base?')) return
    const result = await deleteWebsiteUrl(urlId)
    if (result.success) toast({ title: 'URL removed' })
    else toast({ title: 'Error', description: result.message, variant: 'destructive' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Website URLs</h1>
          <p className="text-muted-foreground mt-1">Add college website URLs — they are automatically deep-crawled and indexed into the AI knowledge base.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add URL
        </Button>
      </div>

      {/* Info card */}
      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> When you add a URL, the system performs a <strong>deep crawl</strong> of the entire website — following all internal links across every subpage (default: up to 10 levels deep, 200 pages). Each page is indexed separately. The system <strong>automatically re-crawls</strong> every 24 hours and only updates pages whose content has changed. Stale pages that no longer exist are automatically removed.
          </p>
        </CardContent>
      </Card>

      {urls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">No URLs added yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your college website URLs to help the AI answer questions about admissions, courses, fees, etc.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add First URL</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {urls.map((u) => (
            <Card key={u._id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{u.label || u.url}</p>
                    <StatusBadge status={u.status} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{u.url}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {u.pages_crawled > 0 && (
                      <p className="text-xs text-blue-600">{u.pages_crawled} pages crawled</p>
                    )}
                    {u.chunks_indexed > 0 && (
                      <p className="text-xs text-emerald-600">{u.chunks_indexed} chunks indexed</p>
                    )}
                    {u.last_crawled_at && (
                      <p className="text-xs text-muted-foreground">Last crawled: {formatTimeAgo(u.last_crawled_at)}</p>
                    )}
                    {u.auto_refresh && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
                        Auto-refresh {u.refresh_interval_hours || 24}h
                      </Badge>
                    )}
                  </div>
                  {u.last_refresh_result && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Last update: {u.last_refresh_result.pages_updated || 0} changed, {u.last_refresh_result.pages_unchanged || 0} unchanged, {u.last_refresh_result.stale_removed || 0} removed
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRecrawl(u)}
                    disabled={recrawling === u._id || u.status === 'scraping'}
                    title="Re-crawl entire website (only changed pages will be updated)"
                  >
                    {recrawling === u._id || u.status === 'scraping' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                  <a href={u.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-3.5 w-3.5" /></Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(u._id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Website URL</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required placeholder="https://college.edu" />
              <p className="text-xs text-muted-foreground">The system will deep-crawl this entire website, following all internal links across every subpage.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. MIT Academy of Engineering" />
            </div>

            {/* Advanced settings toggle */}
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {showAdvanced ? 'Hide' : 'Show'} advanced settings
            </button>

            {showAdvanced && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Max Depth</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={form.max_depth}
                      onChange={e => setForm(f => ({ ...f, max_depth: parseInt(e.target.value) || 10 }))}
                    />
                    <p className="text-[10px] text-muted-foreground">How many link levels deep to follow</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Pages</Label>
                    <Input
                      type="number"
                      min={10}
                      max={1000}
                      value={form.max_pages}
                      onChange={e => setForm(f => ({ ...f, max_pages: parseInt(e.target.value) || 200 }))}
                    />
                    <p className="text-[10px] text-muted-foreground">Maximum pages to crawl</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto_refresh"
                    checked={form.auto_refresh}
                    onChange={e => setForm(f => ({ ...f, auto_refresh: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="auto_refresh" className="text-xs cursor-pointer">
                    Auto-refresh (re-crawl periodically to detect changes)
                  </Label>
                </div>
                {form.auto_refresh && (
                  <div className="space-y-1">
                    <Label className="text-xs">Refresh Interval (hours)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      value={form.refresh_interval_hours}
                      onChange={e => setForm(f => ({ ...f, refresh_interval_hours: parseInt(e.target.value) || 24 }))}
                    />
                    <p className="text-[10px] text-muted-foreground">How often to check for content changes (default: every 24 hours)</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add & Deep Crawl
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
