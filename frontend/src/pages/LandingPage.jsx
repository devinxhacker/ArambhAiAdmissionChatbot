import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  GraduationCap,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  Sparkles,
  Globe,
  ArrowRight,
  Bot,
  BookOpen,
  LayoutDashboard,
  UploadCloud,
  Search,
  Layers,
  Compass,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6 } } }
const stagger = { show: { transition: { staggerChildren: 0.12 } } }

const floatingEmojis = [
  { emoji: '🎓', className: 'top-10 left-10', delay: 0 },
  { emoji: '📚', className: 'top-24 right-16', delay: 0.2 },
  { emoji: '💬', className: 'bottom-12 left-24', delay: 0.4 },
  { emoji: '🧠', className: 'bottom-24 right-24', delay: 0.1 },
  { emoji: '💻', className: 'top-40 left-1/2', delay: 0.3 },
]

const features = [
  {
    icon: MessageSquare,
    title: 'AI Chat Companion',
    desc: 'Ask admissions questions, clarify requirements, and get instant guidance in plain language.',
  },
  {
    icon: BarChart3,
    title: 'College Comparison',
    desc: 'Compare colleges across programs, facilities, placements, and scholarships in one view.',
  },
  {
    icon: BookOpen,
    title: 'Personalized Guidance',
    desc: 'Share your marks, preferences, and goals to receive curated college recommendations.',
  },
  {
    icon: Globe,
    title: 'Multilingual by Design',
    desc: 'Chat in the language you are most comfortable with for clarity and confidence.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified Data',
    desc: 'College information stays reliable with admin-managed updates and audit trails.',
  },
  {
    icon: Sparkles,
    title: 'Smart Suggestions',
    desc: 'Receive next-step prompts, deadlines, and document checklists tailored to you.',
  },
]

const journeys = [
  { title: 'Set your goals', desc: 'Share your course interest, location, and budget preferences.' },
  { title: 'Talk to AdmissionAI', desc: 'Clarify eligibility, deadlines, and program requirements instantly.' },
  { title: 'Compare colleges', desc: 'Shortlist with side-by-side comparisons and save your favorites.' },
  { title: 'Apply with confidence', desc: 'Move forward with a clear, guided checklist of next steps.' },
]

function SectionHeading({ eyebrow, title, description }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-center mb-12"
    >
      {eyebrow && (
        <Badge variant="outline" className="mb-4 border-primary/20 bg-white/60">
          {eyebrow}
        </Badge>
      )}
      <h2 className="text-3xl md:text-4xl font-semibold text-balance">{title}</h2>
      {description && (
        <p className="text-muted-foreground mt-3 max-w-2xl mx-auto text-balance">
          {description}
        </p>
      )}
    </motion.div>
  )
}

export default function LandingPage() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const glowX = useSpring(mouseX, { stiffness: 120, damping: 20 })
  const glowY = useSpring(mouseY, { stiffness: 120, damping: 20 })
  const glow = useMotionTemplate`
    radial-gradient(620px circle at ${glowX}px ${glowY}px, rgba(99, 102, 241, 0.18), transparent 55%)
  `

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    mouseX.set(event.clientX - rect.left)
    mouseY.set(event.clientY - rect.top)
  }

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section
        className="relative min-h-[92vh] flex items-center px-4 py-20"
        onMouseMove={handleMouseMove}
      >
        <motion.div style={{ backgroundImage: glow }} className="absolute inset-0 opacity-80" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="floating-orb -top-32 -right-24 w-72 h-72 bg-indigo-300/40 animate-blob" />
          <div className="floating-orb bottom-10 -left-24 w-80 h-80 bg-cyan-300/30 animate-blob" />
          <div className="floating-orb top-1/3 left-1/2 w-[520px] h-[520px] bg-pink-300/20 animate-blob" />
          {floatingEmojis.map((item) => (
            <motion.span
              key={`${item.emoji}-${item.className}`}
              className={`absolute text-2xl ${item.className}`}
              aria-hidden
              animate={{ y: [0, -10, 0], rotate: [0, 4, -4, 0] }}
              transition={{ duration: 6, repeat: Infinity, delay: item.delay }}
            >
              {item.emoji}
            </motion.span>
          ))}
        </div>

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="border-primary/20 bg-white/70">
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Futuristic Admission OS
              </Badge>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl font-semibold leading-tight text-balance">
              A premium AI admission platform built for confident student decisions.
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-xl text-balance">
              Chat with an AI counselor, compare colleges, and plan every step of your admission journey in a single intelligent workspace.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" variant="glow" asChild>
                <Link to="/register">
                  Start free with AI <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/chat">Preview the chatbot</Link>
              </Button>
            </motion.div>
            <motion.div variants={fadeUp} className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 border border-white/60">🎓 Student-first guidance</div>
              <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 border border-white/60">📚 Verified college data</div>
              <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 border border-white/60">💬 Multilingual chat</div>
            </motion.div>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="show" className="relative">
            <div className="glass-panel p-5 relative overflow-hidden">
              <div className="flex items-center gap-2 pb-3 border-b border-white/70">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-muted-foreground">AdmissionAI Live Assistant</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex gap-2 items-start">
                  <div className="h-8 w-8 rounded-full bg-indigo-500/15 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="bg-white/80 border border-white/70 rounded-2xl rounded-tl-sm px-3 py-2 text-sm shadow-soft">
                    Tell me your preferred course and location, and I will curate a shortlist.
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <div className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm shadow-glow">
                    I want to study Data Science in Bengaluru.
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="h-8 w-8 rounded-full bg-indigo-500/15 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="bg-white/80 border border-white/70 rounded-2xl rounded-tl-sm px-3 py-2 text-sm shadow-soft">
                    Perfect. I will match programs, fees, and deadlines and show comparisons.
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                {['Scholarships', 'Deadlines', 'Eligibility'].map((item) => (
                  <div key={item} className="rounded-xl bg-white/70 border border-white/70 px-2 py-2 text-center">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
              className="absolute -bottom-6 -left-6 glass-card px-4 py-3 text-xs"
            >
              ✅ Smart shortlists, no fake metrics
            </motion.div>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 7, repeat: Infinity }}
              className="absolute -top-6 right-6 glass-card px-4 py-3 text-xs"
            >
              🎯 Personalized guidance flow
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Platform features"
            title="Everything students need to decide with clarity"
            description="From AI guidance to verified data, each module works together to make admissions feel simple and confident."
          />
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp} className="glass-card p-6 hover:-translate-y-1 transition-transform">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-indigo-500" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* AI Chatbot Preview */}
      <section className="py-24 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <SectionHeading
              eyebrow="AI chatbot preview"
              title="A conversational admission assistant that feels alive"
              description="Experience clean, fast, and context-aware chat with intelligent suggestions, all wrapped in a premium interface."
            />
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-500" /> Smart suggestion chips and next steps.</div>
              <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-indigo-500" /> Clean, modern message bubbles with AI glow.</div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-indigo-500" /> Verified responses backed by admin uploads.</div>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-panel p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/70">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bot className="h-4 w-4 text-indigo-500" /> AdmissionAI Chat
              </div>
              <Badge variant="outline" className="bg-white/70">Typing...</Badge>
            </div>
            <div className="mt-4 space-y-3">
              <div className="bg-white/80 border border-white/70 rounded-2xl rounded-tl-sm px-3 py-2 text-sm">
                What programs in Delhi accept CAT scores with scholarships?
              </div>
              <div className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm">
                I can filter by program type and scholarship criteria. Want me to compare fees too?
              </div>
              <div className="flex flex-wrap gap-2">
                {['Compare fees', 'View deadlines', 'Show eligibility'].map((item) => (
                  <span key={item} className="text-xs rounded-full bg-white/70 border border-white/70 px-3 py-1">{item}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* College Comparison */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -18 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-5">
            <SectionHeading
              eyebrow="College comparison"
              title="Beautiful side-by-side comparisons"
              description="Compare programs, facilities, placements, and scholarships with a layout designed to make trade-offs clear."
            />
            <div className="flex flex-wrap gap-2">
              {['Scholarships', 'Hostel', 'Accreditation', 'Placements', 'Facilities'].map((item) => (
                <span key={item} className="text-xs rounded-full bg-white/70 border border-white/70 px-3 py-1">{item}</span>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 18 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="glass-panel p-6">
            <div className="grid grid-cols-2 gap-4">
              {['College A', 'College B'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/70 bg-white/70 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-500/15" />
                    <div>
                      <p className="text-sm font-semibold">{item}</p>
                      <p className="text-xs text-muted-foreground">Verified profile</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between"><span>Ranking</span><span>View details</span></div>
                    <div className="flex items-center justify-between"><span>Fees</span><span>Compare</span></div>
                    <div className="flex items-center justify-between"><span>Placements</span><span>Available</span></div>
                    <div className="flex items-center justify-between"><span>Scholarships</span><span>Available</span></div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Guidance Section */}
      <section className="py-24 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-medium"><Compass className="h-4 w-4 text-indigo-500" /> Guidance Flow</div>
              <Badge variant="outline" className="bg-white/70">Step 2 of 3</Badge>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3">Course Interest</div>
                <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3">Preferred State</div>
                <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3">Budget Range</div>
                <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3">Entrance Exam</div>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-xs text-indigo-700">
                AI notes: We will prioritize colleges with data science labs and scholarship coverage.
              </div>
              <Button className="w-full" variant="glow">Generate Recommendations</Button>
            </div>
          </motion.div>
          <div>
            <SectionHeading
              eyebrow="Smart admission guidance"
              title="Step-by-step clarity without the stress"
              description="A guided flow that captures your goals, validates eligibility, and returns a curated shortlist you can trust."
            />
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-indigo-500" /> Personalized shortlist logic.</div>
              <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-500" /> Admission checklists and document hints.</div>
              <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-indigo-500" /> Smart filters for course fit.</div>
            </div>
          </div>
        </div>
      </section>

      {/* College Discovery */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="College discovery"
            title="Search and explore with premium discovery UI"
            description="A clean search experience with visual previews, campus details, and saved shortlists."
          />
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-panel p-6">
            <div className="flex flex-col md:flex-row gap-3 mb-5">
              <div className="flex-1 rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                <Search className="h-4 w-4" /> Search colleges, courses, or cities
              </div>
              <div className="rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                <Layers className="h-4 w-4" /> Filters
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {['Campus-ready profile', 'Scholarship details', 'Verified placements'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/70 bg-white/70 p-4 text-sm">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/15 mb-3" />
                  <p className="font-medium">{item}</p>
                  <p className="text-xs text-muted-foreground mt-1">Tap to view official data cards.</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Admin Dashboard */}
      <section className="py-24 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <SectionHeading
              eyebrow="Admin dashboards"
              title="Professional admin control with modern SaaS UI"
              description="Upload PDFs, manage URLs, and monitor analytics with a dashboard designed for speed and clarity."
            />
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><UploadCloud className="h-4 w-4 text-indigo-500" /> Document and URL ingestion.</div>
              <div className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4 text-indigo-500" /> Analytics at a glance.</div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-indigo-500" /> Secure admin roles and audit logs.</div>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-panel p-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: LayoutDashboard, label: 'Overview' },
                { icon: UploadCloud, label: 'Uploads' },
                { icon: BarChart3, label: 'Analytics' },
                { icon: ShieldCheck, label: 'Admin control' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/70 bg-white/70 p-4 text-sm">
                  <item.icon className="h-4 w-4 text-indigo-500 mb-3" />
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">Streamlined dashboards</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Student Journey */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            eyebrow="Student journey"
            title="A guided path from curiosity to enrollment"
            description="Every step is designed to remove friction and build confidence."
          />
          <div className="grid md:grid-cols-2 gap-6">
            {journeys.map((step, idx) => (
              <motion.div key={step.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-card p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-sm font-semibold text-indigo-600">
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center glass-panel p-12"
        >
          <h2 className="text-4xl font-semibold mb-4">Ready to plan admissions with clarity?</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Build your shortlist, chat with AI, and move forward with a modern admission companion.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="glow" asChild>
              <Link to="/register">Create your account <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/colleges">Explore colleges</Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
