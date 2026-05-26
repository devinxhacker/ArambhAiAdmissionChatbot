import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, MapPin, Award, TrendingUp, Building2, Sparkles } from 'lucide-react'
import { useCollegeStore } from '@/store/collegeStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const stagger = { show: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

function CollegeCard({ college }) {
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
      <Link to={`/colleges/${college.slug}`}>
        <Card className="overflow-hidden glass-panel hover:border-indigo-300/60 transition-all h-full">
          {/* Banner */}
          <div className="h-32 bg-gradient-to-br from-indigo-200/60 to-blue-200/40 relative overflow-hidden">
            {college.banner && <img src={college.banner} alt="" className="w-full h-full object-cover" />}
            <div className="absolute top-3 right-3">
              <Badge variant="secondary" className="text-xs">{college.type}</Badge>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <Avatar className="h-12 w-12 rounded-xl border-2 border-white -mt-8 shrink-0 shadow-md">
                <AvatarImage src={college.logo} />
                <AvatarFallback className="rounded-xl text-sm font-bold bg-primary/10 text-primary">{college.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 pt-1">
                <h3 className="font-semibold text-sm leading-tight line-clamp-2">{college.name}</h3>
                {college.address?.city && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />{college.address.city}, {college.address.state}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{college.description || 'No description available.'}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {college.ranking && (
                <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />Rank #{college.ranking}</span>
              )}
              {college.accreditation && (
                <span className="flex items-center gap-1"><Award className="h-3 w-3" />{college.accreditation}</span>
              )}
              {college.courses?.length > 0 && (
                <span>{college.courses.length} courses</span>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

export default function CollegesPage() {
  const { colleges, total, pages, isLoading, fetchColleges } = useCollegeStore()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')

  useEffect(() => { fetchColleges({ search, page, type }) }, [page, type])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchColleges({ search, page: 1, type })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full mb-4">
          <Sparkles className="h-3.5 w-3.5" /> Verified listings
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold mb-2">Explore Colleges</h1>
        <p className="text-muted-foreground">Browse {total} colleges and find your perfect match.</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search colleges..." className="pl-9" />
          </div>
          <Button type="submit">Search</Button>
        </form>
        <select
          className="h-11 rounded-xl border border-input/70 bg-white/70 backdrop-blur px-3 text-sm"
          value={type}
          onChange={e => { setType(e.target.value); setPage(1) }}
        >
          <option value="">All Types</option>
          {['Government', 'Private', 'Deemed', 'Autonomous'].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-white/70 border border-white/70 animate-pulse" />
          ))}
        </div>
      ) : colleges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No colleges found</p>
          <p className="text-muted-foreground mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {colleges.map(college => <CollegeCard key={college._id} college={college} />)}
        </motion.div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">Page {page} of {pages}</span>
          <Button variant="outline" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
