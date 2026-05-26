import { useEffect, useState } from 'react'
import { Plus, Trash2, HelpCircle, Loader2 } from 'lucide-react'
import { useCollegeStore } from '@/store/collegeStore'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export default function FaqsPage() {
  const { myCollege, fetchMyCollege, addFaq, deleteFaq } = useCollegeStore()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ question: '', answer: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchMyCollege() }, [])

  const faqs = myCollege?.faqs || []

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    const result = await addFaq(form)
    if (result.success) {
      toast({ title: 'FAQ added' })
      setOpen(false)
      setForm({ question: '', answer: '' })
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this FAQ?')) return
    const result = await deleteFaq(id)
    if (result.success) toast({ title: 'FAQ deleted' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FAQs</h1>
          <p className="text-muted-foreground mt-1">Manage frequently asked questions for your college.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add FAQ
        </Button>
      </div>

      {faqs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">No FAQs yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add common questions students ask about your college.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add First FAQ</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Card key={faq._id}>
              <CardContent className="p-4 flex gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm mb-1">Q: {faq.question}</p>
                  <p className="text-sm text-muted-foreground">A: {faq.answer}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => handleDelete(faq._id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add FAQ</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Question</Label>
              <Input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} required placeholder="What is the admission process?" />
            </div>
            <div className="space-y-1.5">
              <Label>Answer</Label>
              <Textarea value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} required rows={4} placeholder="Describe the answer..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add FAQ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
