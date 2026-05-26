import { useEffect, useState } from 'react'
import { Plus, Globe, ExternalLink, Loader2, Trash2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
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

export default function WebsiteUrlsPage() {
  const { myCollege, fetchMyCollege, addWebsiteUrl, deleteWebsiteUrl } = useCollegeStore()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ url: '', label: '' })
  const [saving, setSaving] = useState(false)
  const [recrawling, setRecrawling] = useState(null)

  useEffect(() => { fetchMyCollege() }, [])

  const urls = myCollege?.websiteUrls || []

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    const result = await addWebsiteUrl(form)
    if (result.success) {
      toast({ title: 'URL added & crawl triggered', description: 'The URL is being scraped and indexed into the knowledge base.' })
      setOpen(false)
      setForm({ url: '', label: '' })
      // Refresh after a delay to show updated status
      setTimeout(() => fetchMyCollege(), 3000)
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleRecrawl = async (urlEntry) => {
    setRecrawling(urlEntry._id)
    try {
      await api.post('/api/admin/crawl-url', {
        url: urlEntry.url,
        entity_name: urlEntry.label || myCollege?.name || '',
        college: myCollege?.name || '',
        max_depth: 2,
        max_pages: 15,
      })
      toast({ title: 'Re-crawl complete', description: 'URL has been re-scraped and re-indexed.' })
      fetchMyCollege()
    } catch (err) {
      toast({ title: 'Re-crawl failed', description: err.response?.data?.detail || 'Something went wrong', variant: 'destructive' })
    }
    setRecrawling(null)
  }

  const handleDelete = async (urlId) => {
    if (!confirm('Remove this URL from the knowledge base?')) return
    const result = await deleteWebsiteUrl(urlId)
    if (result.success) toast({ title: 'URL removed' })
    else toast({ title: 'Error', description: result.message, variant: 'destructive' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Website URLs</h1>
          <p className="text-muted-foreground mt-1">Add college website URLs — they are automatically crawled and indexed into the AI knowledge base.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add URL
        </Button>
      </div>

      {/* Info card */}
      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> When you add a URL, the system automatically crawls it (following internal links up to 2 levels deep, max 15 pages), extracts the content, and indexes it into the AI knowledge base. Students can then ask questions about this content.
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
                  {u.chunks_indexed > 0 && (
                    <p className="text-xs text-emerald-600 mt-0.5">{u.chunks_indexed} chunks indexed</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRecrawl(u)}
                    disabled={recrawling === u._id}
                    title="Re-crawl this URL"
                  >
                    {recrawling === u._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Website URL</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required placeholder="https://college.edu/admissions" />
              <p className="text-xs text-muted-foreground">The system will crawl this URL and follow internal links (up to 15 pages).</p>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Admissions Page" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add & Crawl
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
