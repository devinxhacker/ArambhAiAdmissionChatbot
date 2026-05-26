import { useState, useCallback } from 'react'
import { Upload, FileText, Globe, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { aiApi } from '@/lib/api'
import { useToast } from '@/hooks/useToast'

export default function UploadPage() {
  const [files, setFiles] = useState([])
  const [url, setUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [results, setResults] = useState([])
  const { toast } = useToast()

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).filter((f) => f.type === 'application/pdf')
    setFiles(selected)
  }

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      const res = await aiApi.post('/ingest/pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResults((prev) => [...prev, ...res.data.results])
      toast({ title: 'PDFs ingested successfully', description: `${files.length} file(s) processed.` })
      setFiles([])
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleCrawl = async () => {
    if (!url.trim()) return
    setCrawling(true)
    try {
      const res = await aiApi.post('/ingest/crawl', { url: url.trim() })
      setResults((prev) => [...prev, res.data])
      toast({ title: 'URL crawled successfully', description: `Indexed ${res.data.pages_crawled} pages.` })
      setUrl('')
    } catch (err) {
      toast({ title: 'Crawl failed', description: err.message, variant: 'destructive' })
    } finally {
      setCrawling(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground mt-1">Upload PDFs or crawl URLs to build the admission knowledge base.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* PDF Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> PDF Ingestion
            </CardTitle>
            <CardDescription>Upload admission PDFs to index into the vector store.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <Label htmlFor="pdf-upload" className="cursor-pointer text-sm text-primary hover:underline">
                Click to select PDFs
              </Label>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              {files.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{files.length} file(s) selected</p>
              )}
            </div>
            <Button onClick={handleUpload} disabled={!files.length || uploading} className="w-full">
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ingest PDFs
            </Button>
          </CardContent>
        </Card>

        {/* Web Crawler */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> Web Crawler
            </CardTitle>
            <CardDescription>Crawl a university admission URL to index its content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="crawl-url">URL to crawl</Label>
              <Input
                id="crawl-url"
                type="url"
                placeholder="https://university.edu/admissions"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button onClick={handleCrawl} disabled={!url.trim() || crawling} className="w-full">
              {crawling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crawl URL
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-3">Ingestion Results</h2>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted">
                  {r.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span className="truncate">{r.source || r.filename}</span>
                  <span className="ml-auto text-muted-foreground shrink-0">{r.chunks} chunks</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
