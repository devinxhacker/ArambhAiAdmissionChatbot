import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, MapPin, BookOpen, ArrowRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const COURSES = ['Computer Science', 'Mechanical Engineering', 'Civil Engineering', 'Electronics', 'MBA', 'Medical', 'Law', 'Arts', 'Commerce', 'Science']
const STATES = ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Telangana', 'Kerala']

export default function GuidancePage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    marks: '', percentile: '', course: '', state: '', budget: '', entranceExam: '',
  })
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Use college search with filters as a proxy for guidance
      const params = { limit: 8 }
      if (form.state) params.state = form.state
      if (form.course) params.search = form.course
      const res = await api.get('/api/colleges', { params })
      setResults(res.data.colleges)
      setStep(3)
    } catch { }
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-500/15 mb-4">
          <Sparkles className="h-7 w-7 text-indigo-500" />
        </div>
        <h1 className="text-3xl font-semibold mb-2">Personalized Admission Guidance</h1>
        <p className="text-muted-foreground">Enter your details and get tailored college recommendations.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2].map(s => (
          <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${step > s ? 'bg-indigo-500' : step === s ? 'bg-indigo-400/60' : 'bg-muted'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="glass-panel">
              <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-indigo-500" />Academic Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>12th Marks / Percentage</Label>
                    <Input type="number" min="0" max="100" value={form.marks} onChange={e => set('marks', e.target.value)} placeholder="e.g. 85" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Entrance Exam Percentile</Label>
                    <Input type="number" min="0" max="100" value={form.percentile} onChange={e => set('percentile', e.target.value)} placeholder="e.g. 92.5" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Entrance Exam</Label>
                    <Input value={form.entranceExam} onChange={e => set('entranceExam', e.target.value)} placeholder="JEE, NEET, CAT..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Course Interest</Label>
                    <select className="w-full h-11 rounded-xl border border-input/70 bg-white/70 dark:bg-gray-900/70 backdrop-blur px-3 text-sm" value={form.course} onChange={e => set('course', e.target.value)}>
                      <option value="">Select course</option>
                      {COURSES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <Button className="w-full" onClick={() => setStep(2)} disabled={!form.course}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="glass-panel">
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-indigo-500" />Preferences</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Preferred State</Label>
                      <select className="w-full h-11 rounded-xl border border-input/70 bg-white/70 dark:bg-gray-900/70 backdrop-blur px-3 text-sm" value={form.state} onChange={e => set('state', e.target.value)}>
                        <option value="">Any state</option>
                        {STATES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Annual Budget (₹)</Label>
                      <Input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="e.g. 200000" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                    <Button type="submit" variant="glow" className="flex-1" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Get Recommendations
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Recommendations</h2>
              <Button variant="outline" size="sm" onClick={() => { setStep(1); setResults([]) }}>Start Over</Button>
            </div>
            <p className="text-muted-foreground text-sm">Based on your profile: <strong>{form.course}</strong>{form.state && ` in ${form.state}`}{form.marks && `, ${form.marks}% marks`}</p>

            {results.length === 0 ? (
              <Card className="glass-panel"><CardContent className="py-12 text-center text-muted-foreground">No colleges found matching your criteria. Try broadening your preferences.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {results.map((college, i) => (
                  <motion.div key={college._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="glass-panel hover:border-indigo-300/60 transition-colors">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">{i + 1}</div>
                        <Avatar className="h-10 w-10 rounded-xl shrink-0">
                          <AvatarImage src={college.logo} />
                          <AvatarFallback className="rounded-xl text-sm">{college.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{college.name}</p>
                          <p className="text-xs text-muted-foreground">{college.address?.city}, {college.address?.state}</p>
                          <div className="flex gap-2 mt-1">
                            {college.ranking && <Badge variant="outline" className="text-xs">Rank #{college.ranking}</Badge>}
                            {college.accreditation && <Badge variant="secondary" className="text-xs">{college.accreditation}</Badge>}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/colleges/${college.slug}`}>View <ArrowRight className="ml-1 h-3 w-3" /></Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
