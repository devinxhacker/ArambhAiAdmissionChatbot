import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, CheckCircle, XCircle, Search, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'

const emptyForm = { name: '', description: '', websiteUrl: '', contactEmail: '', contactPhone: '', type: 'Private', 'address.city': '', 'address.state': '' }

export default function CollegesManagePage() {
  const [colleges, setColleges] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/superadmin/colleges')
      setColleges(res.data.colleges)
      setTotal(res.data.total)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        websiteUrl: form.websiteUrl,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        type: form.type,
        address: { city: form['address.city'], state: form['address.state'] },
      }
      await api.post('/api/superadmin/colleges', payload)
      toast({ title: 'College created' })
      setCreateOpen(false)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this college?')) return
    try {
      await api.delete(`/api/superadmin/colleges/${id}`)
      toast({ title: 'College deactivated' })
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Colleges</h1>
          <p className="text-muted-foreground mt-1">{total} colleges on the platform</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add College
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>College</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>}
              {!loading && colleges.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No colleges yet.</TableCell></TableRow>}
              {colleges.map(college => (
                <TableRow key={college._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={college.logo} />
                        <AvatarFallback className="text-xs rounded-lg">{college.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{college.name}</p>
                        <p className="text-xs text-muted-foreground">{college.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{college.type || '—'}</Badge></TableCell>
                  <TableCell>
                    {college.admin ? (
                      <div>
                        <p className="text-sm">{college.admin.name}</p>
                        <p className="text-xs text-muted-foreground">{college.admin.email}</p>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">Unassigned</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={college.isActive ? 'success' : 'destructive'}>
                      {college.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {college.createdAt || college.created_at ? format(new Date(college.createdAt || college.created_at), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(college._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create College Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New College</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {[
              { key: 'name', label: 'College Name', required: true },
              { key: 'description', label: 'Description' },
              { key: 'websiteUrl', label: 'Website URL', type: 'url' },
              { key: 'contactEmail', label: 'Contact Email', type: 'email' },
              { key: 'contactPhone', label: 'Contact Phone' },
              { key: 'address.city', label: 'City' },
              { key: 'address.state', label: 'State' },
            ].map(({ key, label, type = 'text', required }) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required={required} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {['Government', 'Private', 'Deemed', 'Autonomous'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Create College</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
