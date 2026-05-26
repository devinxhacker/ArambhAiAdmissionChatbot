import { useEffect, useState, useCallback } from 'react'
import { Upload, FileText, Trash2, Loader2, CheckCircle, XCircle, Eye } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'

const BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:3001'

export default function AdminUploadPage() {
  const [files, setFiles] = useState([])
  const [uploaded, setUploaded] = useState([])
  const [label, setLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadFiles = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/documents')
      setUploaded(res.data)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { loadFiles() }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    setFiles(prev => [...prev, ...dropped])
  }, [])

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      if (label) formData.append('label', label)
      await api.post('/api/admin/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast({ title: `${files.length} file(s) uploaded successfully` })
      setFiles([])
      setLabel('')
      loadFiles()
    } catch (err) {
      toast({ title: 'Upload failed', description: err.response?.data?.message, variant: 'destructive' })
    }
    setUploading(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this file?')) return
    try {
      await api.delete(`/api/admin/documents/${id}`)
      toast({ title: 'File deleted' })
      loadFiles()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' })
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Files</h1>
        <p className="text-muted-foreground mt-1">Upload PDFs to your college knowledge base.</p>
      </div>

      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> PDF Upload</CardTitle>
          <CardDescription>Drag & drop PDFs or click to select. Max 10 MB per file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onClick={() => document.getElementById('file-input').click()}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Drop PDFs here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">PDF files only, up to 10 MB each</p>
            <input id="file-input" type="file" accept=".pdf" multiple className="hidden" onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])} />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{files.length} file(s) selected:</p>
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted rounded-lg">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label>Label (optional)</Label>
                  <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Prospectus 2024" />
                </div>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uploaded Files</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>}
              {!loading && uploaded.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No files uploaded yet.</TableCell></TableRow>}
              {uploaded.map(file => (
                <TableRow key={file._id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm truncate max-w-[200px]">{file.originalName}</span>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{file.label || '—'}</span></TableCell>
                  <TableCell><span className="text-sm">{formatSize(file.size)}</span></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{(file.createdAt || file.created_at) ? format(new Date(file.createdAt || file.created_at), 'MMM d, yyyy') : '—'}</span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a href={`${BASE_URL}/uploads/${file.filename}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
                      </a>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(file._id)}>
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
    </div>
  )
}
