import { useEffect, useState } from 'react'
import { Plus, Globe, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { useCollegeStore } from '@/store/collegeStore'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { format } from 'date-fns'

export default function WebsiteUrlsPage() {
  const { myCollege, fetchMyCollege, addWebsiteUrl, deleteWebsiteUrl } = useCollegeStore()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ url: '', label: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchMyCollege() }, [])

  const urls = myCollege?.websiteUrls || []

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    const result = await addWebsiteUrl(form)
    if (result.success) {
      toast({ title: 'URL added' })
      setOpen(false)
      setForm({ url: '', label: '' })
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleDelete = async (urlId) => {
    if (!confirm('Remove this URL?')) return
    const result = await deleteWebsiteUrl(urlId)
    if (result.success) toast({ title: 'URL removed' })
    else toast({ title: 'Error', description: result.message, variant: 'destructive' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Website URLs</h1>
          <p className="text-muted-foreground mt-1">Add college website URLs to the knowledge base.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add URL
        </Button>
      </div>

      {urls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">No URLs added yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your college website URLs to help the AI answer questions.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add First URL</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {urls.map((u) => (
            <Card key={u._id}>
              <CardContent className="p-4 flex items-center gap-3">
                <Globe className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.label || u.url}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.url}</p>
                </div>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Website URL</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required placeholder="https://college.edu/admissions" />
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Admissions Page" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add URL</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
