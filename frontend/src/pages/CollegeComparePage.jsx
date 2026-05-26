import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, X, Sparkles, Send, Loader2, Bot, RotateCcw, Globe } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function CollegeComparePage() {
  const [colleges, setColleges] = useState(['', ''])
  const [aspects, setAspects] = useState('')
  const [result, setResult] = useState('')
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const resultRef = useRef(null)
  const { toast } = useToast()

  const updateCollege = (index, value) => {
    setColleges(prev => prev.map((c, i) => i === index ? value : c))
  }

  const addCollege = () => {
    if (colleges.length >= 4) {
      toast({ title: 'Max 4 colleges', variant: 'destructive' })
      return
    }
    setColleges(prev => [...prev, ''])
  }

  const removeCollege = (index) => {
    if (colleges.length <= 2) return
    setColleges(prev => prev.filter((_, i) => i !== index))
  }

  const handleCompare = async () => {
    const filled = colleges.filter(c => c.trim())
    if (filled.length < 2) {
      toast({ title: 'Enter at least 2 college names', variant: 'destructive' })
      return
    }

    setLoading(true)
    setStreaming(true)
    setResult('')
    setSources([])

    const collegeList = filled.join(', ')
    const aspectText = aspects.trim()
      ? `Focus on these aspects: ${aspects.trim()}.`
      : 'Compare on: ranking, fees, placements (avg & highest package), courses offered, campus facilities, hostel, accreditation, admission process, cutoffs, and scholarships.'

    const message = `Give me a detailed comparison table between ${collegeList}. ${aspectText} Present the data in a well-formatted markdown table with actual specific numbers/data (not generic statements). After the table, provide a brief summary highlighting key differences and which college might be better for different student profiles. Include specific data like exact fees, placement statistics, NIRF ranking numbers, cutoff percentiles where available.`

    // Use the same streaming chat endpoint as the main chatbot
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

    // First create a conversation for this comparison
    let convId
    try {
      const convRes = await api.post('/api/conversations')
      convId = convRes.data.id
    } catch {
      toast({ title: 'Failed to start comparison', variant: 'destructive' })
      setLoading(false)
      setStreaming(false)
      return
    }

    const token = api.defaults.headers.common['Authorization']

    try {
      const resp = await fetch(`${baseUrl}/api/conversations/${convId}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({
          message,
          language: 'en',
          stream: true,
          web_search: true,
        }),
      })

      if (!resp.ok) {
        throw new Error(`Backend ${resp.status}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let accumulated = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        let nl = buf.indexOf('\n')
        while (nl >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (line) {
            try {
              const parsed = JSON.parse(line)
              if (parsed.type === 'token') {
                accumulated += parsed.text || ''
                setResult(accumulated)
              } else if (parsed.type === 'translation') {
                accumulated = parsed.text || accumulated
                setResult(accumulated)
              } else if (parsed.type === 'citations') {
                setSources(parsed.citations || [])
              } else if (parsed.type === 'web_search_result') {
                // web search happened — sources will come via citations event
              }
            } catch { /* skip */ }
          }
          nl = buf.indexOf('\n')
        }
      }

      if (!accumulated) {
        setResult('No comparison data could be generated. Please try with different college names.')
      }
    } catch (err) {
      toast({ title: 'Comparison failed', description: err.message, variant: 'destructive' })
      setResult('')
    }

    setLoading(false)
    setStreaming(false)
  }

  // Auto-scroll as content streams in
  useEffect(() => {
    if (resultRef.current && streaming) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [result, streaming])

  const SUGGESTIONS = [
    ['MITAOE vs COEP', 'MIT Academy of Engineering', 'College of Engineering Pune'],
    ['IIT Bombay vs IIT Delhi', 'IIT Bombay', 'IIT Delhi'],
    ['VIT vs SRM', 'VIT Vellore', 'SRM Chennai'],
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full mb-4">
          <Sparkles className="h-3.5 w-3.5" /> AI-Powered Comparison
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold mb-2">Compare colleges intelligently</h1>
        <p className="text-muted-foreground">Enter college names and our AI will research and generate a detailed comparison using web data and our knowledge base.</p>
      </div>

      {/* Input Card */}
      <Card className="mb-6 glass-panel">
        <CardContent className="p-6 space-y-5">
          {/* College name inputs */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Colleges to compare</label>
            {colleges.map((college, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <Input
                  value={college}
                  onChange={(e) => updateCollege(i, e.target.value)}
                  placeholder={`College ${i + 1} name (e.g. ${i === 0 ? 'MITAOE Pune' : i === 1 ? 'COEP Pune' : 'VIT Vellore'})`}
                  className="flex-1"
                />
                {colleges.length > 2 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCollege(i)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            {colleges.length < 4 && (
              <Button variant="outline" size="sm" onClick={addCollege} className="ml-9">
                <Plus className="h-4 w-4 mr-1" /> Add college
              </Button>
            )}
          </div>

          {/* Aspects input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Focus areas <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input
              value={aspects}
              onChange={(e) => setAspects(e.target.value)}
              placeholder="e.g. fees, placements, hostel, cutoffs, campus life..."
              className="ml-9"
            />
            <p className="text-xs text-muted-foreground ml-9">Leave empty for a comprehensive comparison across all parameters.</p>
          </div>

          {/* Compare button */}
          <div className="flex items-center gap-3 ml-9">
            <Button
              variant="glow"
              onClick={handleCompare}
              disabled={loading || colleges.filter(c => c.trim()).length < 2}
              className="px-6"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loading ? 'Researching...' : 'Compare with AI'}
            </Button>
            {result && (
              <Button variant="outline" size="sm" onClick={() => { setResult(''); setSources([]); setColleges(['', '']); setAspects('') }}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
            )}
          </div>

          {/* Quick suggestions */}
          {!result && !loading && (
            <div className="ml-9">
              <p className="text-xs text-muted-foreground mb-2">Quick comparisons:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map(([label, c1, c2]) => (
                  <button
                    key={label}
                    onClick={() => { setColleges([c1, c2]); }}
                    className="text-xs border bg-white rounded-full px-3 py-1 hover:bg-slate-50 hover:border-indigo-300 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {(result || loading) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">AI Comparison Result</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {streaming ? 'Researching and generating comparison...' : 'Based on web search and knowledge base data'}
                  </p>
                </div>
                {streaming && <Loader2 className="h-4 w-4 animate-spin text-indigo-500 ml-auto" />}
              </div>
            </CardHeader>
            <CardContent ref={resultRef}>
              {result ? (
                <div className="comparison-result">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table({ children }) {
                        return (
                          <div className="my-4 overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-sm border-collapse">{children}</table>
                          </div>
                        )
                      },
                      thead({ children }) {
                        return <thead className="bg-indigo-50 border-b border-slate-200">{children}</thead>
                      },
                      th({ children }) {
                        return <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">{children}</th>
                      },
                      td({ children }) {
                        return <td className="px-4 py-2.5 text-sm text-slate-600 border-t border-slate-100">{children}</td>
                      },
                      tr({ children }) {
                        return <tr className="hover:bg-slate-50/50 transition-colors">{children}</tr>
                      },
                      h1({ children }) { return <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1> },
                      h2({ children }) { return <h2 className="text-base font-bold mt-3 mb-1.5">{children}</h2> },
                      h3({ children }) { return <h3 className="text-sm font-bold mt-2.5 mb-1">{children}</h3> },
                      p({ children }) { return <p className="mb-2 last:mb-0 leading-relaxed text-sm">{children}</p> },
                      ul({ children }) { return <ul className="list-disc ml-4 mb-2 space-y-1 text-sm">{children}</ul> },
                      ol({ children }) { return <ol className="list-decimal ml-4 mb-2 space-y-1 text-sm">{children}</ol> },
                      strong({ children }) { return <strong className="font-semibold text-slate-900">{children}</strong> },
                      blockquote({ children }) {
                        return <blockquote className="border-l-3 border-indigo-400 bg-indigo-50/50 pl-3 py-1.5 my-2 rounded-r-lg text-slate-700 italic text-sm">{children}</blockquote>
                      },
                    }}
                  >
                    {result}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Searching web and knowledge base for college data...</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sources */}
          {sources.length > 0 && !streaming && (
            <Card className="mt-4 glass-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4 text-indigo-500" />
                  Sources ({sources.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sources.map((src, i) => {
                    const url = src.source_url || src.url || src.host || ''
                    const title = src.title || src.source || (url ? (() => { try { return new URL(url).hostname } catch { return 'Source' } })() : `Source ${i + 1}`)
                    const snippet = src.snippet || ''
                    const sourceType = src.source_type || 'web'
                    return (
                      <a
                        key={i}
                        href={url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-white transition-all group"
                      >
                        <span className="flex items-center justify-center h-6 w-6 rounded-lg bg-indigo-100 text-indigo-600 text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                            {title}
                          </p>
                          {snippet && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{snippet}</p>
                          )}
                          {url && (
                            <p className="text-[10px] text-slate-400 truncate mt-1">{url.replace(/^https?:\/\//, '').slice(0, 50)}</p>
                          )}
                        </div>
                      </a>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  )
}
