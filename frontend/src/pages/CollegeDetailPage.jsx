import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  MapPin, Globe, Phone, Mail, Award, TrendingUp, Users, BookOpen,
  Home, Dumbbell, FlaskConical, ArrowLeft, HelpCircle, CheckCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function CollegeDetailPage() {
  const { slug } = useParams()
  const [college, setCollege] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/colleges/${slug}`)
      .then(r => setCollege(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="h-48 bg-muted animate-pulse rounded-2xl mb-6" />
      <div className="h-8 bg-muted animate-pulse rounded w-1/2 mb-3" />
      <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
    </div>
  )

  if (!college) return (
    <div className="max-w-5xl mx-auto px-4 py-20 text-center">
      <p className="text-xl font-medium">College not found</p>
      <Button asChild className="mt-4"><Link to="/colleges">Back to Colleges</Link></Button>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link to="/colleges" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Colleges
      </Link>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-primary/20 to-blue-500/10 h-48">
        {college.banner && <img src={college.banner} alt="" className="w-full h-full object-cover" />}
      </div>

      {/* Identity */}
      <div className="flex items-start gap-4 mb-6">
        <Avatar className="h-20 w-20 rounded-2xl border-4 border-background -mt-12 shadow-xl shrink-0">
          <AvatarImage src={college.logo} />
          <AvatarFallback className="rounded-2xl text-2xl font-bold bg-primary/10 text-primary">{college.name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{college.name}</h1>
            {college.isVerified && <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>}
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {college.address?.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{college.address.city}, {college.address.state}</span>}
            {college.type && <Badge variant="outline">{college.type}</Badge>}
            {college.ranking && <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />Rank #{college.ranking}</span>}
            {college.accreditation && <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5" />{college.accreditation}</span>}
          </div>
        </div>
        {college.websiteUrl && (
          <a href={college.websiteUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><Globe className="h-4 w-4 mr-1" />Website</Button>
          </a>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1 mb-6">
          {['overview', 'courses', 'campus', 'placements', 'admission', 'faqs'].map(t => (
            <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          {college.description && (
            <Card><CardContent className="p-5"><p className="text-sm leading-relaxed">{college.description}</p></CardContent></Card>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {college.contactEmail && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{college.contactEmail}</p>}
                {college.contactPhone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{college.contactPhone}</p>}
                {college.websiteUrl && <a href={college.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline"><Globe className="h-4 w-4" />{college.websiteUrl}</a>}
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-sm">Quick Facts</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {college.establishmentYear && <p>Est. {college.establishmentYear}</p>}
                {college.totalFaculty && <p className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" />{college.totalFaculty} Faculty</p>}
                {college.campusSize && <p>{college.campusSize} campus</p>}
                {college.hostelAvailable && <p className="flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground" />Hostel Available</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Courses */}
        <TabsContent value="courses">
          {college.courses?.length === 0 ? <p className="text-muted-foreground text-sm">No courses listed.</p> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {college.courses?.map((c, i) => (
                <Card key={i}><CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.department} · {c.duration}</p>
                    </div>
                    <Badge variant="outline">{c.degreeType}</Badge>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    {c.fees && <span>₹{c.fees.toLocaleString()}/yr</span>}
                    {c.seats && <span>{c.seats} seats</span>}
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Campus */}
        <TabsContent value="campus" className="space-y-4">
          {college.facilities?.length > 0 && (
            <Card><CardHeader><CardTitle className="text-sm">Facilities</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-2">
                {college.facilities.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <span>{f.name}{f.description && ` — ${f.description}`}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {college.hostelDetails && (
            <Card><CardHeader><CardTitle className="text-sm">Hostel</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{college.hostelDetails}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Placements */}
        <TabsContent value="placements">
          {college.placements?.length === 0 ? <p className="text-muted-foreground text-sm">No placement data available.</p> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {college.placements?.map((p, i) => (
                <Card key={i}><CardContent className="p-4">
                  <p className="font-semibold mb-2">{p.year}</p>
                  <div className="space-y-1 text-sm">
                    {p.placementRate && <p>Placement Rate: <span className="font-medium">{p.placementRate}%</span></p>}
                    {p.averagePackage && <p>Avg Package: <span className="font-medium">₹{(p.averagePackage / 100000).toFixed(1)} LPA</span></p>}
                    {p.highestPackage && <p>Highest: <span className="font-medium">₹{(p.highestPackage / 100000).toFixed(1)} LPA</span></p>}
                  </div>
                  {p.topRecruiters?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.topRecruiters.map(r => <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>)}
                    </div>
                  )}
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Admission */}
        <TabsContent value="admission" className="space-y-4">
          {college.admissionProcess && (
            <Card><CardHeader><CardTitle className="text-sm">Admission Process</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed">{college.admissionProcess}</p></CardContent>
            </Card>
          )}
          {college.eligibilityCriteria && (
            <Card><CardHeader><CardTitle className="text-sm">Eligibility Criteria</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed">{college.eligibilityCriteria}</p></CardContent>
            </Card>
          )}
          {college.scholarshipDetails && (
            <Card><CardHeader><CardTitle className="text-sm">Scholarships</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed">{college.scholarshipDetails}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        {/* FAQs */}
        <TabsContent value="faqs">
          {college.faqs?.length === 0 ? <p className="text-muted-foreground text-sm">No FAQs available.</p> : (
            <div className="space-y-3">
              {college.faqs?.map((faq, i) => (
                <Card key={i}><CardContent className="p-4">
                  <p className="font-medium text-sm mb-1">Q: {faq.question}</p>
                  <p className="text-sm text-muted-foreground">A: {faq.answer}</p>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
