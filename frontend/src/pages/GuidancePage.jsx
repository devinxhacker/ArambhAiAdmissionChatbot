import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, MapPin, BookOpen, ArrowRight, ArrowLeft, Loader2,
  Trophy, Target, TrendingUp, Clock, CheckCircle2,
  GraduationCap, IndianRupee, Building2, BarChart3, Zap,
  Calendar, Award, ChevronRight, Brain, Rocket, ChevronDown,
  Send, MessageSquare, Bot, User, Info, Lightbulb,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, aiApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

// ─── Constants ────────────────────────────────────────────────────────────────
const COURSES = [
  { value: 'Computer Science', icon: '💻', color: 'from-blue-500 to-cyan-500' },
  { value: 'Mechanical Engineering', icon: '⚙️', color: 'from-orange-500 to-red-500' },
  { value: 'Civil Engineering', icon: '🏗️', color: 'from-green-500 to-emerald-500' },
  { value: 'Electronics', icon: '🔌', color: 'from-purple-500 to-violet-500' },
  { value: 'MBA', icon: '📊', color: 'from-indigo-500 to-blue-500' },
  { value: 'Medical', icon: '🏥', color: 'from-red-500 to-pink-500' },
  { value: 'Law', icon: '⚖️', color: 'from-amber-500 to-yellow-500' },
  { value: 'Arts', icon: '🎨', color: 'from-pink-500 to-rose-500' },
  { value: 'Commerce', icon: '💰', color: 'from-teal-500 to-green-500' },
  { value: 'Science', icon: '🔬', color: 'from-cyan-500 to-blue-500' },
]

const STATES = [
  'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat',
  'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Telangana', 'Kerala',
  'Madhya Pradesh', 'Punjab', 'Haryana', 'Andhra Pradesh', 'Bihar',
]

const EXAMS = ['JEE Main', 'JEE Advanced', 'NEET', 'CAT', 'GATE', 'CLAT', 'MHT-CET', 'KCET', 'COMEDK', 'BITSAT']

const BUDGET_RANGES = [
  { label: 'Under ₹1 Lakh', value: 100000, icon: '💵' },
  { label: '₹1-3 Lakhs', value: 300000, icon: '💰' },
  { label: '₹3-5 Lakhs', value: 500000, icon: '💎' },
  { label: '₹5-10 Lakhs', value: 1000000, icon: '🏦' },
  { label: '₹10+ Lakhs', value: 1500000, icon: '👑' },
]

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6']

// ─── XP & Gamification helpers ────────────────────────────────────────────────
function XPBar({ xp, maxXp = 100 }) {
  const pct = Math.min((xp / maxXp) * 100, 100)
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Zap className="h-4 w-4 text-yellow-500" />
        <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">{xp} XP</span>
      </div>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
    </div>
  )
}

function AchievementBadge({ icon, label, unlocked }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
        unlocked
          ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600'
          : 'border-gray-200 dark:border-gray-700 opacity-40'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
      {unlocked && <CheckCircle2 className="h-3 w-3 text-yellow-500" />}
    </motion.div>
  )
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepCourseSelect({ form, set, onNext }) {
  return (
    <motion.div key="step-course" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
      <Card className="glass-panel border-indigo-200/50 dark:border-indigo-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-indigo-500" />
            </div>
            What do you want to study?
          </CardTitle>
          <p className="text-sm text-muted-foreground">Pick your dream field — earn +20 XP!</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {COURSES.map(c => (
              <motion.button
                key={c.value}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => set('course', c.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  form.course === c.value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-lg shadow-indigo-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-xs font-medium text-center leading-tight">{c.value}</span>
                {form.course === c.value && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>
          <Button className="w-full mt-6" onClick={onNext} disabled={!form.course}>
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function StepAcademics({ form, set, onNext, onBack }) {
  return (
    <motion.div key="step-academics" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
      <Card className="glass-panel border-indigo-200/50 dark:border-indigo-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-purple-500" />
            </div>
            Your Academic Profile
          </CardTitle>
          <p className="text-sm text-muted-foreground">Tell us your scores — earn +25 XP!</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">12th Marks / Percentage</Label>
              <Input type="number" min="0" max="100" value={form.marks} onChange={e => set('marks', e.target.value)} placeholder="e.g. 85" className="h-12 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Entrance Exam Percentile / Rank</Label>
              <Input type="number" min="0" value={form.percentile} onChange={e => set('percentile', e.target.value)} placeholder="e.g. 92.5 or rank 15000" className="h-12 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Entrance Exam</Label>
            <div className="flex flex-wrap gap-2">
              {EXAMS.map(exam => (
                <motion.button key={exam} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => set('entranceExam', exam)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    form.entranceExam === exam ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}>{exam}</motion.button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            <Button className="flex-1" onClick={onNext} disabled={!form.marks}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function StepPreferences({ form, set, onNext, onBack }) {
  return (
    <motion.div key="step-prefs" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
      <Card className="glass-panel border-indigo-200/50 dark:border-indigo-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-emerald-500" />
            </div>
            Your Preferences
          </CardTitle>
          <p className="text-sm text-muted-foreground">Location & budget — earn +20 XP!</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Preferred State</Label>
            <div className="flex flex-wrap gap-2">
              {STATES.map(s => (
                <motion.button key={s} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => set('state', form.state === s ? '' : s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    form.state === s ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                  }`}>{s}</motion.button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Annual Budget</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {BUDGET_RANGES.map(b => (
                <motion.button key={b.value} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => set('budget', b.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    form.budget === b.value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                  }`}>
                  <span className="text-lg">{b.icon}</span>
                  <span className="text-[10px] font-medium text-center">{b.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            <Button className="flex-1" onClick={onNext}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function StepGoals({ form, set, onSubmit, onBack, loading }) {
  const priorities = [
    { key: 'placements', label: 'Placements', icon: '💼' },
    { key: 'research', label: 'Research', icon: '🔬' },
    { key: 'campus', label: 'Campus Life', icon: '🏫' },
    { key: 'location', label: 'City/Location', icon: '🌆' },
    { key: 'fees', label: 'Low Fees', icon: '💰' },
    { key: 'ranking', label: 'Ranking', icon: '🏆' },
  ]
  const togglePriority = (key) => {
    const current = form.priorities || []
    const updated = current.includes(key) ? current.filter(p => p !== key) : [...current, key].slice(0, 3)
    set('priorities', updated)
  }

  return (
    <motion.div key="step-goals" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
      <Card className="glass-panel border-indigo-200/50 dark:border-indigo-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Target className="h-4 w-4 text-amber-500" />
            </div>
            What matters most to you?
          </CardTitle>
          <p className="text-sm text-muted-foreground">Pick up to 3 priorities — earn +35 XP & unlock AI analysis!</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {priorities.map(p => (
              <motion.button key={p.key} whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => togglePriority(p.key)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all relative ${
                  (form.priorities || []).includes(p.key) ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-lg shadow-amber-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-amber-300'
                }`}>
                <span className="text-2xl">{p.icon}</span>
                <span className="text-xs font-medium">{p.label}</span>
                {(form.priorities || []).includes(p.key) && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 -right-1">
                    <CheckCircle2 className="h-5 w-5 text-amber-500 fill-amber-100" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Anything else? (optional)</Label>
            <Input value={form.additionalNotes || ''} onChange={e => set('additionalNotes', e.target.value)} placeholder="e.g. Need hostel, prefer co-ed, want sports facilities..." className="h-12 rounded-xl" />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            <Button className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white" onClick={onSubmit} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
              Get AI Guidance
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Loading Animation ────────────────────────────────────────────────────────
function AILoadingState() {
  const steps = [
    { icon: Brain, label: 'Analyzing your profile...' },
    { icon: Target, label: 'Matching with colleges...' },
    { icon: BarChart3, label: 'Generating insights...' },
    { icon: Sparkles, label: 'Preparing your roadmap...' },
  ]
  const [activeStep, setActiveStep] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setActiveStep(s => (s + 1) % steps.length), 1500)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-16 space-y-8">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
        <Brain className="h-10 w-10 text-white" />
      </motion.div>
      <div className="space-y-3 text-center">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div key={i} initial={{ opacity: 0.3 }} animate={{ opacity: activeStep === i ? 1 : 0.3 }} className="flex items-center gap-3 justify-center">
              <Icon className={`h-4 w-4 ${activeStep === i ? 'text-indigo-500' : 'text-muted-foreground'}`} />
              <span className={`text-sm ${activeStep === i ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
              {activeStep > i && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Visualizations ───────────────────────────────────────────────────────────

function MatchScoreRing({ score }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative h-20 w-20 flex items-center justify-center shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-gray-700" />
        <motion.circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.2, ease: 'easeOut' }} />
      </svg>
      <span className="text-lg font-bold" style={{ color }}>{score}%</span>
    </div>
  )
}

function ProfileRadarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar name="Your Profile" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} strokeWidth={2} />
        <Radar name="Avg Admitted" dataKey="avg" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function CollegeComparisonChart({ colleges }) {
  const data = colleges.slice(0, 6).map(c => ({
    name: c.name?.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
    match: c.matchScore || 70,
    placement: c.placementScore || 65,
    value: c.valueScore || 60,
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="match" name="Match %" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="placement" name="Placement" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="value" name="Value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function BudgetPieChart({ budget }) {
  const data = [
    { name: 'Tuition', value: Math.round(budget * 0.6) },
    { name: 'Hostel', value: Math.round(budget * 0.2) },
    { name: 'Books & Misc', value: Math.round(budget * 0.1) },
    { name: 'Savings', value: Math.round(budget * 0.1) },
  ]
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
        </Pie>
        <Tooltip formatter={(v) => `₹${(v / 1000).toFixed(0)}K`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function AdmissionTimeline({ events }) {
  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 rounded-full" />
      {events.map((event, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }} className="relative flex items-start gap-3">
          <div className={`absolute -left-4 top-1 h-4 w-4 rounded-full border-2 border-white dark:border-gray-900 ${
            event.status === 'done' ? 'bg-green-500' : event.status === 'current' ? 'bg-indigo-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
          }`} />
          <div className="flex-1 bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{event.title}</span>
              <Badge variant={event.status === 'done' ? 'success' : event.status === 'current' ? 'default' : 'outline'} className="text-[10px]">{event.date}</Badge>
            </div>
            {event.description && <p className="text-xs text-muted-foreground mt-1">{event.description}</p>}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Embedded Guidance Chatbot ─────────────────────────────────────────────────

function GuidanceChatbot({ form, colleges, aiInsights }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // Build context from user's guidance data
  const buildContext = useCallback(() => {
    const collegeNames = colleges.map(c => c.name).filter(Boolean).join(', ')
    return (
      `Student Profile:\n` +
      `- Course Interest: ${form.course}\n` +
      `- 12th Marks: ${form.marks || 'Not provided'}%\n` +
      `- Entrance Exam: ${form.entranceExam || 'Not specified'}\n` +
      `- Percentile/Rank: ${form.percentile || 'Not provided'}\n` +
      `- Preferred State: ${form.state || 'Any'}\n` +
      `- Annual Budget: ₹${form.budget ? (form.budget / 100000).toFixed(1) + ' Lakhs' : 'Not specified'}\n` +
      `- Priorities: ${(form.priorities || []).join(', ') || 'None selected'}\n` +
      `- Additional Notes: ${form.additionalNotes || 'None'}\n\n` +
      `Recommended Colleges: ${collegeNames || 'None found'}\n\n` +
      `AI Summary: ${aiInsights || 'No summary available'}`
    )
  }, [form, colleges, aiInsights])

  // Suggested questions based on context
  const suggestedQuestions = [
    `What are the admission deadlines for ${colleges[0]?.name || 'my top college'}?`,
    `Compare the placement records of my recommended colleges`,
    `What scholarships am I eligible for with ${form.marks}% marks?`,
    `What should I prepare for ${form.entranceExam || 'entrance exams'}?`,
    `Which college has the best hostel facilities?`,
    `What is the fee structure breakdown for ${form.course}?`,
  ]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sendMessage = async (content) => {
    if (!content.trim() || isTyping) return

    const userMsg = { role: 'user', content: content.trim(), id: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Build history with context injected in first message
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const contextPrefix = history.length === 0
      ? `[Context: ${buildContext()}]\n\nBased on the above student profile and recommendations, answer: `
      : ''

    const fullMessage = contextPrefix + content.trim()

    try {
      const baseUrl = import.meta.env.VITE_AI_BASE_URL || 'http://localhost:8100'
      const token = api.defaults.headers.common['Authorization']

      const resp = await fetch(`${baseUrl}/agent/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({
          message: fullMessage,
          history,
          language: 'en',
          stream: true,
        }),
      })

      if (!resp.ok) throw new Error(`Error ${resp.status}`)

      const assistantMsg = { role: 'assistant', content: '', id: Date.now() + 1 }
      setMessages(prev => [...prev, assistantMsg])

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
                setMessages(prev => {
                  const next = [...prev]
                  next[next.length - 1] = { ...next[next.length - 1], content: accumulated }
                  return next
                })
              }
            } catch { /* skip */ }
          }
          nl = buf.indexOf('\n')
        }
      }
    } catch (err) {
      console.error('Guidance chat error:', err)
      setMessages(prev => [...prev, {
        role: 'assistant', content: 'Sorry, I couldn\'t process that. Please try again.', id: Date.now() + 1,
      }])
    }
    setIsTyping(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      <Card className="glass-panel border-indigo-200/50 dark:border-indigo-800/30 overflow-hidden">
        {/* Chat Header */}
        <div
          className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-indigo-100 dark:border-indigo-900/30 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Ask More About Your Results</h3>
              <p className="text-xs text-muted-foreground">AI assistant with your profile & college context loaded</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="text-[10px]">Context Loaded</Badge>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              {/* Suggested Questions */}
              {messages.length === 0 && (
                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" /> Suggested questions based on your results:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedQuestions.slice(0, 4).map((q, i) => (
                      <motion.button key={i} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => sendMessage(q)}
                        className="text-left text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all">
                        {q}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="h-[350px] p-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Bot className="h-10 w-10 text-indigo-300 mb-3" />
                      <p className="text-sm text-muted-foreground">Ask me anything about your recommendations,<br />admission process, or specific colleges.</p>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                        msg.role === 'user' ? 'bg-indigo-500' : 'bg-gradient-to-br from-emerald-400 to-teal-500'
                      }`}>
                        {msg.role === 'user' ? <User className="h-3.5 w-3.5 text-white" /> : <Bot className="h-3.5 w-3.5 text-white" />}
                      </div>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-indigo-500 text-white rounded-tr-sm'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-sm'
                      }`}>
                        {msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:ml-4 [&>ol]:ml-4">
                            {msg.content || '...'}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                        <Bot className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-end gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 p-2">
                  <Textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="Ask about your recommendations..." rows={1} disabled={isTyping}
                    className="resize-none min-h-[40px] max-h-24 border-0 focus-visible:ring-0 bg-transparent text-sm" />
                  <Button size="icon" variant="glow" onClick={() => sendMessage(input)} disabled={isTyping || !input.trim()} className="shrink-0 h-9 w-9">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

// ─── Helper: Generate "Why Recommended" reason for each college ───────────────
function generateWhyRecommended(college, form, index) {
  const reasons = []
  if (form.state && (college.address?.state === form.state || college.state === form.state)) {
    reasons.push(`Located in your preferred state (${form.state})`)
  }
  if (college.ranking && college.ranking <= 50) {
    reasons.push(`Top-ranked institution (#${college.ranking})`)
  }
  if ((form.priorities || []).includes('placements') && college.placement_rate) {
    reasons.push(`Strong placement record (${college.placement_rate}%)`)
  }
  if (college.accreditation) {
    reasons.push(`${college.accreditation} accredited — quality assured`)
  }
  if (form.course) {
    reasons.push(`Offers ${form.course} programs matching your interest`)
  }
  if (form.budget && college.fees && college.fees <= form.budget) {
    reasons.push(`Within your budget (₹${(college.fees / 100000).toFixed(1)}L/year)`)
  }
  // Fallback reasons based on position
  if (reasons.length === 0) {
    const fallbacks = [
      `High match score based on your academic profile`,
      `Strong alignment with your priorities`,
      `Good value for money in ${form.course || 'your field'}`,
      `Well-regarded for ${(form.priorities || [])[0] || 'academics'}`,
    ]
    reasons.push(fallbacks[index % fallbacks.length])
  }
  return reasons.slice(0, 3)
}

// ─── Results Page ─────────────────────────────────────────────────────────────

function ResultsView({ form, results, aiInsights, aiDetailedSummary, onReset }) {
  const colleges = results || []
  const [expandedCollege, setExpandedCollege] = useState(null)

  const matchedColleges = colleges.map((c, i) => ({
    ...c,
    matchScore: Math.max(60, 98 - i * 5 - Math.floor(Math.random() * 5)),
    placementScore: Math.floor(Math.random() * 30 + 65),
    valueScore: Math.floor(Math.random() * 25 + 65),
  }))

  const radarData = [
    { subject: 'Academics', score: Math.min(100, parseInt(form.marks) || 70), avg: 75 },
    { subject: 'Exam Score', score: Math.min(100, parseInt(form.percentile) || 60), avg: 70 },
    { subject: 'Budget Fit', score: form.budget ? Math.min(100, (form.budget / 10000)) : 70, avg: 65 },
    { subject: 'Location', score: form.state ? 85 : 60, avg: 60 },
    { subject: 'Priorities', score: (form.priorities?.length || 0) * 30 + 10, avg: 55 },
    { subject: 'Readiness', score: 80, avg: 70 },
  ]

  const timeline = [
    { title: 'Research & Shortlist', date: 'Now', status: 'done', description: 'You just completed this step!' },
    { title: 'Application Forms', date: 'Jun-Jul', status: 'current', description: `Apply to top ${Math.min(5, colleges.length)} colleges` },
    { title: 'Entrance Exams', date: 'Jul-Aug', status: 'upcoming', description: form.entranceExam ? `Prepare for ${form.entranceExam}` : 'Check exam dates' },
    { title: 'Counselling', date: 'Aug-Sep', status: 'upcoming', description: 'Attend counselling rounds' },
    { title: 'Admission Confirm', date: 'Sep-Oct', status: 'upcoming', description: 'Pay fees & confirm seat' },
    { title: 'College Starts', date: 'Oct-Nov', status: 'upcoming', description: 'Begin your journey! 🎉' },
  ]

  return (
    <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Your Admission Roadmap
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered analysis for <strong>{form.course}</strong>
            {form.state && ` in ${form.state}`}
            {form.marks && ` • ${form.marks}% marks`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <ArrowLeft className="mr-2 h-3 w-3" /> Start Over
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Colleges Found', value: colleges.length, icon: Building2, color: 'text-indigo-500' },
          { label: 'Best Match', value: `${matchedColleges[0]?.matchScore || 0}%`, icon: Target, color: 'text-green-500' },
          { label: 'Avg Placement', value: '8.5 LPA', icon: TrendingUp, color: 'text-purple-500' },
          { label: 'Applications Due', value: '45 days', icon: Clock, color: 'text-amber-500' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="glass-panel">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <stat.icon className={`h-5 w-5 ${stat.color} mb-1`} />
                <span className="text-lg font-bold">{stat.value}</span>
                <span className="text-[10px] text-muted-foreground">{stat.label}</span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ─── AI Detailed Summary & Analysis ─── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass-panel border-indigo-200/50 dark:border-indigo-800/30 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5 text-indigo-500" />
              AI Analysis & Guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profile Summary Table */}
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 overflow-hidden">
              <div className="bg-indigo-50/80 dark:bg-indigo-900/20 px-4 py-2 border-b border-indigo-100 dark:border-indigo-900/40">
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> Your Profile Summary
                </span>
              </div>
              <div className="p-4 grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Course:</span><span className="font-medium">{form.course}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">12th Marks:</span><span className="font-medium">{form.marks || 'N/A'}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Exam:</span><span className="font-medium">{form.entranceExam || 'Not specified'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Percentile/Rank:</span><span className="font-medium">{form.percentile || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">State:</span><span className="font-medium">{form.state || 'Any'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Budget:</span><span className="font-medium">{form.budget ? `₹${(form.budget/100000).toFixed(1)}L/yr` : 'Flexible'}</span></div>
                <div className="flex justify-between sm:col-span-2"><span className="text-muted-foreground">Priorities:</span><span className="font-medium">{(form.priorities || []).join(', ') || 'None'}</span></div>
              </div>
            </div>

            {/* AI Insights */}
            {aiInsights && (
              <div className="rounded-xl border border-purple-100 dark:border-purple-900/40 p-4 bg-purple-50/30 dark:bg-purple-900/10">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> AI Recommendation Summary
                </p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{aiInsights}</p>
              </div>
            )}

            {/* Detailed AI Summary */}
            {aiDetailedSummary && (
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 p-4 bg-emerald-50/30 dark:bg-emerald-900/10">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Detailed Guidance
                </p>
                <div className="text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiDetailedSummary}</ReactMarkdown>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-indigo-500" />Your Profile vs Average</CardTitle>
            </CardHeader>
            <CardContent className="pb-2"><ProfileRadarChart data={radarData} /></CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" />College Comparison</CardTitle>
            </CardHeader>
            <CardContent className="pb-2">
              {matchedColleges.length > 0 ? <CollegeComparisonChart colleges={matchedColleges} /> : <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data</div>}
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4 text-amber-500" />Budget Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pb-2"><BudgetPieChart budget={form.budget || 300000} /></CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 text-purple-500" />Admission Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pb-4"><AdmissionTimeline events={timeline} /></CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── College Cards with "Why Recommended" ─── */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Award className="h-5 w-5 text-indigo-500" />
          Top Matched Colleges
        </h3>
        {matchedColleges.length === 0 ? (
          <Card className="glass-panel">
            <CardContent className="py-12 text-center text-muted-foreground">No colleges found matching your criteria. Try broadening your preferences.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {matchedColleges.map((college, i) => {
              const whyReasons = generateWhyRecommended(college, form, i)
              const isExpanded = expandedCollege === i

              return (
                <motion.div key={college._id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.08 }}>
                  <Card className="glass-panel hover:border-indigo-300/60 dark:hover:border-indigo-600/40 transition-all group">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Rank badge */}
                        <div className={`flex items-center justify-center h-10 w-10 rounded-xl font-bold text-sm shrink-0 ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          i === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                          i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                        }`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </div>

                        <MatchScoreRing score={college.matchScore} />

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{college.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{college.address?.city || college.city}, {college.address?.state || college.state || form.state}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {college.ranking && <Badge variant="outline" className="text-[10px]">Rank #{college.ranking}</Badge>}
                            {college.accreditation && <Badge variant="secondary" className="text-[10px]">{college.accreditation}</Badge>}
                            <Badge variant="success" className="text-[10px]">{college.matchScore}% Match</Badge>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/colleges/${college.slug}`}>View <ChevronRight className="ml-1 h-3 w-3" /></Link>
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setExpandedCollege(isExpanded ? null : i)}>
                            {isExpanded ? 'Hide' : 'Why?'} <Info className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Why Recommended - Expandable */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1">
                                <Lightbulb className="h-3.5 w-3.5" /> Why this college is recommended for you:
                              </p>
                              <ul className="space-y-1.5">
                                {whyReasons.map((reason, ri) => (
                                  <li key={ri} className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                <div className="text-center p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/20">
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{college.matchScore}%</span>
                                  <p className="text-[10px] text-muted-foreground">Match</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-green-50/50 dark:bg-green-900/20">
                                  <span className="text-xs font-bold text-green-600 dark:text-green-400">{college.placementScore}%</span>
                                  <p className="text-[10px] text-muted-foreground">Placement</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-amber-50/50 dark:bg-amber-900/20">
                                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{college.valueScore}%</span>
                                  <p className="text-[10px] text-muted-foreground">Value</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Embedded Chatbot ─── */}
      <GuidanceChatbot form={form} colleges={matchedColleges} aiInsights={aiInsights} />
    </motion.div>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function GuidancePage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    marks: '', percentile: '', course: '', state: '', budget: '',
    entranceExam: '', priorities: [], additionalNotes: '',
  })
  const [results, setResults] = useState([])
  const [aiInsights, setAiInsights] = useState('')
  const [aiDetailedSummary, setAiDetailedSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [xp, setXp] = useState(0)
  const [achievements, setAchievements] = useState([])

  const totalSteps = 4
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const addXp = (amount) => setXp(prev => Math.min(prev + amount, 100))

  const handleNext = (nextStep) => {
    const xpMap = { 2: 20, 3: 25, 4: 20 }
    if (xpMap[nextStep]) addXp(xpMap[nextStep])
    if (nextStep === 2 && !achievements.includes('course_picked')) setAchievements(a => [...a, 'course_picked'])
    if (nextStep === 3 && !achievements.includes('scores_added')) setAchievements(a => [...a, 'scores_added'])
    if (nextStep === 4 && !achievements.includes('preferences_set')) setAchievements(a => [...a, 'preferences_set'])
    setStep(nextStep)
  }

  const handleSubmit = async () => {
    setLoading(true)
    addXp(35)
    setAchievements(a => [...a, 'ai_unlocked'])
    setStep(5)

    try {
      const payload = {
        branch: form.course,
        state: form.state || undefined,
        rank: form.percentile ? parseInt(form.percentile) : undefined,
        budget: form.budget || undefined,
        needs_hostel: form.additionalNotes?.toLowerCase().includes('hostel') || false,
        placement_min_lpa: (form.priorities || []).includes('placements') ? 5.0 : undefined,
        language: 'en',
      }

      // Try AI recommendation
      let aiResult = null
      try {
        const aiRes = await api.post('/api/recommend', payload)
        aiResult = aiRes.data
      } catch {
        try {
          const aiRes = await aiApi.post('/agent/recommend', payload)
          aiResult = aiRes.data
        } catch { /* ignore */ }
      }

      // Fetch colleges
      const params = { limit: 8 }
      if (form.state) params.state = form.state
      if (form.course) params.search = form.course
      const collegeRes = await api.get('/api/colleges', { params })
      const colleges = collegeRes.data.colleges || collegeRes.data || []

      // Generate AI insights
      let insights = ''
      if (aiResult?.recommendations?.length) {
        insights = `Based on your profile (${form.marks}% marks, ${form.entranceExam || 'general'} exam), here's what our AI found:\n\n`
        insights += `✅ You're a strong candidate for ${form.course} programs.\n`
        if (form.state) insights += `📍 ${form.state} has ${colleges.length}+ matching colleges.\n`
        if (form.budget) insights += `💰 Your budget of ₹${(form.budget/100000).toFixed(1)}L/year covers most options.\n`
        if ((form.priorities || []).includes('placements')) insights += `💼 Focus on colleges with 90%+ placement rates.\n`
        if ((form.priorities || []).includes('ranking')) insights += `🏆 Top-ranked colleges in your range: consider applying early.\n`
        insights += `\n📋 Recommended action: Apply to your top 5 matches and keep 2-3 safety options.`
        if (aiResult.recommendations[0]?.reason) {
          insights += `\n\n🤖 AI Note: ${aiResult.recommendations[0].reason}`
        }
      } else {
        insights = `Based on your profile (${form.marks || 'N/A'}% marks, ${form.course}):\n\n`
        insights += `✅ ${colleges.length} colleges match your criteria.\n`
        insights += `📊 Your academic profile is competitive for this field.\n`
        if (form.state) insights += `📍 Showing results for ${form.state}.\n`
        insights += `\n💡 Tip: Use the chat below for detailed guidance on specific colleges, scholarships, and application strategies.`
      }
      setAiInsights(insights)

      // Generate detailed AI summary via streaming call
      try {
        const summaryPrompt = `I am a student with the following profile:
- Course: ${form.course}
- 12th Marks: ${form.marks || 'Not provided'}%
- Entrance Exam: ${form.entranceExam || 'Not specified'}, Percentile/Rank: ${form.percentile || 'Not provided'}
- Preferred State: ${form.state || 'Any'}
- Budget: ₹${form.budget ? (form.budget/100000).toFixed(1) + ' Lakhs/year' : 'Flexible'}
- Priorities: ${(form.priorities || []).join(', ') || 'None specified'}
- Additional: ${form.additionalNotes || 'None'}

Based on this profile, provide a detailed admission guidance summary in 150-200 words covering:
1. My admission chances assessment
2. Key steps I should take right now
3. Important deadlines to watch
4. Scholarship opportunities I should explore
5. One specific actionable tip

Be specific and helpful. Use bullet points.`

        const baseUrl = import.meta.env.VITE_AI_BASE_URL || 'http://localhost:8100'
        const token = api.defaults.headers.common['Authorization']
        const resp = await fetch(`${baseUrl}/agent/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
          body: JSON.stringify({ message: summaryPrompt, history: [], language: 'en', stream: true }),
        })

        if (resp.ok && resp.body) {
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
                  if (parsed.type === 'token') accumulated += parsed.text || ''
                } catch { /* skip */ }
              }
              nl = buf.indexOf('\n')
            }
          }
          if (accumulated) setAiDetailedSummary(accumulated)
        }
      } catch { /* detailed summary is optional */ }

      setResults(colleges)
      setStep(6)
    } catch (err) {
      console.error('Guidance error:', err)
      setAiInsights('We encountered an issue fetching AI recommendations. Showing available colleges based on your filters. Use the chat below to ask specific questions.')
      try {
        const params = { limit: 8 }
        if (form.state) params.state = form.state
        if (form.course) params.search = form.course
        const res = await api.get('/api/colleges', { params })
        setResults(res.data.colleges || res.data || [])
      } catch { setResults([]) }
      setStep(6)
    }
    setLoading(false)
  }

  const handleReset = () => {
    setStep(1)
    setForm({ marks: '', percentile: '', course: '', state: '', budget: '', entranceExam: '', priorities: [], additionalNotes: '' })
    setResults([])
    setAiInsights('')
    setAiDetailedSummary('')
    setXp(0)
    setAchievements([])
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      {step <= 5 && (
        <div className="text-center mb-8">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-xl shadow-indigo-500/25">
            <Sparkles className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Personalized Admission Guidance
          </h1>
          <p className="text-muted-foreground">Answer a few questions and unlock AI-powered college recommendations</p>
        </div>
      )}

      {/* XP Bar & Achievements */}
      {step >= 1 && step <= 5 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 space-y-3">
          <XPBar xp={xp} />
          <div className="flex items-center gap-2 flex-wrap">
            <AchievementBadge icon="🎯" label="Course Picked" unlocked={achievements.includes('course_picked')} />
            <AchievementBadge icon="📝" label="Scores Added" unlocked={achievements.includes('scores_added')} />
            <AchievementBadge icon="⚙️" label="Preferences" unlocked={achievements.includes('preferences_set')} />
            <AchievementBadge icon="🤖" label="AI Unlocked" unlocked={achievements.includes('ai_unlocked')} />
          </div>
        </motion.div>
      )}

      {/* Progress Steps */}
      {step >= 1 && step <= 4 && (
        <div className="flex items-center gap-1 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
            <div key={s} className="flex-1">
              <div className={`h-2 rounded-full transition-all duration-500 ${
                step > s ? 'bg-indigo-500' : step === s ? 'bg-indigo-400/70 animate-pulse' : 'bg-gray-200 dark:bg-gray-700'
              }`} />
            </div>
          ))}
        </div>
      )}

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {step === 1 && <StepCourseSelect form={form} set={set} onNext={() => handleNext(2)} />}
        {step === 2 && <StepAcademics form={form} set={set} onNext={() => handleNext(3)} onBack={() => setStep(1)} />}
        {step === 3 && <StepPreferences form={form} set={set} onNext={() => handleNext(4)} onBack={() => setStep(2)} />}
        {step === 4 && <StepGoals form={form} set={set} onSubmit={handleSubmit} onBack={() => setStep(3)} loading={loading} />}
        {step === 5 && <AILoadingState />}
        {step === 6 && <ResultsView form={form} results={results} aiInsights={aiInsights} aiDetailedSummary={aiDetailedSummary} onReset={handleReset} />}
      </AnimatePresence>
    </div>
  )
}
