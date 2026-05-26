import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, KeyRound, Search, MoreHorizontal, ShieldOff, Shield } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PasswordInput from '@/components/auth/PasswordInput'
import { format } from 'date-fns'

export default function AdminsPage() {
  const [admins, setAdmins] = useState([])
  const [colleges, setColleges] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', collegeId: '' })
  const [resetPw, setResetPw] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [adminsRes, collegesRes] = await Promise.all([
        api.get('/api/superadmin/admins'),
        api.get('/api/superadmin/colleges', { params: { limit: 100 } }),
      ])
      setAdmins(adminsRes.data.admins)
      setTotal(adminsRes.data.total)
      setColleges(collegesRes.data.colleges)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/api/superadmin/admins', form)
      toast({ title: 'Admin created successfully' })
      setCreateOpen(false)
      setForm({ name: '', email: '', password: '', collegeId: '' })
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleToggleSuspend = async (admin) => {
    try {
      await api.patch(`/api/superadmin/admins/${admin._id}`, { isSuspended: !admin.isSuspended })
      toast({ title: admin.isSuspended ? 'Admin activated' : 'Admin suspended' })
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this admin? This cannot be undone.')) return
    try {
      await api.delete(`/api/superadmin/admins/${id}`)
      toast({ title: 'Admin deleted' })
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' })
    }
  }

  const handleResetPassword = async () => {
    if (!resetPw || resetPw.length < 8) return
    setSaving(true)
    try {
      await api.post(`/api/superadmin/admins/${resetOpen}/reset-password`, { password: resetPw })
      toast({ title: 'Password reset successfully' })
      setResetOpen(null)
      setResetPw('')
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Management</h1>
          <p className="text-muted-foreground mt-1">{total} admins registered</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Admin
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>College</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {!loading && admins.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No admins yet.</TableCell></TableRow>
              )}
              {admins.map(admin => (
                <TableRow key={admin._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={admin.profileImage} />
                        <AvatarFallback className="text-xs">{admin.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{admin.name}</p>
                        <p className="text-xs text-muted-foreground">{admin.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {admin.college ? (
                      <span className="text-sm">{admin.college.name}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={admin.isSuspended ? 'destructive' : 'success'}>
                      {admin.isSuspended ? 'Suspended' : 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(admin.createdAt || admin.created_at) ? format(new Date(admin.createdAt || admin.created_at), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleSuspend(admin)} title={admin.isSuspended ? 'Activate' : 'Suspend'}>
                        {admin.isSuspended ? <Shield className="h-3.5 w-3.5 text-green-500" /> : <ShieldOff className="h-3.5 w-3.5 text-yellow-500" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetOpen(admin._id)} title="Reset password">
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(admin._id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Admin Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Admin Account</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <PasswordInput value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} showStrength required />
            </div>
            <div className="space-y-2">
              <Label>Assign College (optional)</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.collegeId}
                onChange={e => setForm(f => ({ ...f, collegeId: e.target.value }))}
              >
                <option value="">— No college —</option>
                {colleges.filter(c => !c.admin).map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Create Admin</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetOpen} onOpenChange={() => setResetOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Admin Password</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <PasswordInput value={resetPw} onChange={e => setResetPw(e.target.value)} showStrength />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetOpen(null)}>Cancel</Button>
              <Button onClick={handleResetPassword} disabled={saving || resetPw.length < 8}>Reset Password</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
