import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Plus, Trash2, Loader2, Building2 } from 'lucide-react'
import { useCollegeStore } from '@/store/collegeStore'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    {children}
  </div>
)

export default function CollegeFormPage() {
  const { myCollege, fetchMyCollege, updateMyCollege, isLoading } = useCollegeStore()
  const { toast } = useToast()
  const [form, setForm] = useState(null)
  const [courses, setCourses] = useState([])
  const [departments, setDepartments] = useState([])
  const [facilities, setFacilities] = useState([])

  useEffect(() => { fetchMyCollege() }, [])

  useEffect(() => {
    if (myCollege) {
      setForm({
        name: myCollege.name || '',
        description: myCollege.description || '',
        websiteUrl: myCollege.websiteUrl || '',
        contactEmail: myCollege.contactEmail || '',
        contactPhone: myCollege.contactPhone || '',
        establishmentYear: myCollege.establishmentYear || '',
        accreditation: myCollege.accreditation || '',
        ranking: myCollege.ranking || '',
        type: myCollege.type || 'Private',
        campusSize: myCollege.campusSize || '',
        hostelAvailable: myCollege.hostelAvailable || false,
        hostelDetails: myCollege.hostelDetails || '',
        admissionProcess: myCollege.admissionProcess || '',
        eligibilityCriteria: myCollege.eligibilityCriteria || '',
        scholarshipDetails: myCollege.scholarshipDetails || '',
        totalFaculty: myCollege.totalFaculty || '',
        facultyDetails: myCollege.facultyDetails || '',
        'address.street': myCollege.address?.street || '',
        'address.city': myCollege.address?.city || '',
        'address.state': myCollege.address?.state || '',
        'address.pincode': myCollege.address?.pincode || '',
        'socialLinks.facebook': myCollege.socialLinks?.facebook || '',
        'socialLinks.twitter': myCollege.socialLinks?.twitter || '',
        'socialLinks.instagram': myCollege.socialLinks?.instagram || '',
        'socialLinks.linkedin': myCollege.socialLinks?.linkedin || '',
      })
      setCourses(myCollege.courses?.length ? myCollege.courses : [{ name: '', degreeType: 'UG', department: '', duration: '', fees: '', seats: '' }])
      setDepartments(myCollege.departments?.length ? myCollege.departments : [''])
      setFacilities(myCollege.facilities?.length ? myCollege.facilities : [{ name: '', description: '' }])
    }
  }, [myCollege])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      name: form.name,
      description: form.description,
      websiteUrl: form.websiteUrl,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      establishmentYear: form.establishmentYear ? Number(form.establishmentYear) : undefined,
      accreditation: form.accreditation,
      ranking: form.ranking ? Number(form.ranking) : undefined,
      type: form.type,
      campusSize: form.campusSize,
      hostelAvailable: form.hostelAvailable,
      hostelDetails: form.hostelDetails,
      admissionProcess: form.admissionProcess,
      eligibilityCriteria: form.eligibilityCriteria,
      scholarshipDetails: form.scholarshipDetails,
      totalFaculty: form.totalFaculty ? Number(form.totalFaculty) : undefined,
      facultyDetails: form.facultyDetails,
      address: {
        street: form['address.street'],
        city: form['address.city'],
        state: form['address.state'],
        pincode: form['address.pincode'],
      },
      socialLinks: {
        facebook: form['socialLinks.facebook'],
        twitter: form['socialLinks.twitter'],
        instagram: form['socialLinks.instagram'],
        linkedin: form['socialLinks.linkedin'],
      },
      courses: courses.filter(c => c.name),
      departments: departments.filter(Boolean),
      facilities: facilities.filter(f => f.name),
    }
    const result = await updateMyCollege(payload)
    if (result.success) toast({ title: 'College information saved!' })
    else toast({ title: 'Save failed', description: result.message, variant: 'destructive' })
  }

  if (!form) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">College Information</h1>
          <p className="text-muted-foreground mt-1">Manage your college profile and details.</p>
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="flex-wrap h-auto gap-1">
          {['basic', 'contact', 'academics', 'campus', 'admission', 'social'].map(t => (
            <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        {/* ── Basic ── */}
        <TabsContent value="basic">
          <Card><CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Field label="College Name *"><Input value={form.name} onChange={e => set('name', e.target.value)} required /></Field>
              <Field label="Type">
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={e => set('type', e.target.value)}>
                  {['Government', 'Private', 'Deemed', 'Autonomous'].map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Establishment Year"><Input type="number" value={form.establishmentYear} onChange={e => set('establishmentYear', e.target.value)} /></Field>
              <Field label="Accreditation"><Input value={form.accreditation} onChange={e => set('accreditation', e.target.value)} placeholder="NAAC A+, NBA..." /></Field>
              <Field label="National Ranking"><Input type="number" value={form.ranking} onChange={e => set('ranking', e.target.value)} /></Field>
              <div className="md:col-span-2">
                <Field label="Description"><Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} /></Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Contact ── */}
        <TabsContent value="contact">
          <Card><CardHeader><CardTitle>Contact & Address</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Field label="Website URL"><Input type="url" value={form.websiteUrl} onChange={e => set('websiteUrl', e.target.value)} /></Field>
              <Field label="Contact Email"><Input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></Field>
              <Field label="Contact Phone"><Input value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} /></Field>
              <Field label="Street"><Input value={form['address.street']} onChange={e => set('address.street', e.target.value)} /></Field>
              <Field label="City"><Input value={form['address.city']} onChange={e => set('address.city', e.target.value)} /></Field>
              <Field label="State"><Input value={form['address.state']} onChange={e => set('address.state', e.target.value)} /></Field>
              <Field label="Pincode"><Input value={form['address.pincode']} onChange={e => set('address.pincode', e.target.value)} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Academics ── */}
        <TabsContent value="academics">
          <div className="space-y-4">
            {/* Departments */}
            <Card><CardHeader><CardTitle>Departments</CardTitle><CardDescription>Add all departments offered.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {departments.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={d} onChange={e => setDepartments(arr => arr.map((x, j) => j === i ? e.target.value : x))} placeholder="e.g. Computer Science" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDepartments(arr => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setDepartments(arr => [...arr, ''])}><Plus className="h-4 w-4 mr-1" />Add Department</Button>
              </CardContent>
            </Card>

            {/* Courses */}
            <Card><CardHeader><CardTitle>Courses</CardTitle><CardDescription>Add all courses with fees and seat intake.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {courses.map((c, i) => (
                  <div key={i} className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 border border-border rounded-lg relative">
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => setCourses(arr => arr.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    <Field label="Course Name"><Input value={c.name} onChange={e => setCourses(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></Field>
                    <Field label="Degree">
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={c.degreeType} onChange={e => setCourses(arr => arr.map((x, j) => j === i ? { ...x, degreeType: e.target.value } : x))}>
                        {['UG', 'PG', 'Diploma', 'PhD', 'Certificate'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="Department"><Input value={c.department} onChange={e => setCourses(arr => arr.map((x, j) => j === i ? { ...x, department: e.target.value } : x))} /></Field>
                    <Field label="Duration"><Input value={c.duration} onChange={e => setCourses(arr => arr.map((x, j) => j === i ? { ...x, duration: e.target.value } : x))} placeholder="4 years" /></Field>
                    <Field label="Fees (₹)"><Input type="number" value={c.fees} onChange={e => setCourses(arr => arr.map((x, j) => j === i ? { ...x, fees: e.target.value } : x))} /></Field>
                    <Field label="Seats"><Input type="number" value={c.seats} onChange={e => setCourses(arr => arr.map((x, j) => j === i ? { ...x, seats: e.target.value } : x))} /></Field>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setCourses(arr => [...arr, { name: '', degreeType: 'UG', department: '', duration: '', fees: '', seats: '' }])}><Plus className="h-4 w-4 mr-1" />Add Course</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Campus ── */}
        <TabsContent value="campus">
          <Card><CardHeader><CardTitle>Campus & Facilities</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Campus Size"><Input value={form.campusSize} onChange={e => set('campusSize', e.target.value)} placeholder="e.g. 50 acres" /></Field>
                <Field label="Total Faculty"><Input type="number" value={form.totalFaculty} onChange={e => set('totalFaculty', e.target.value)} /></Field>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="hostel" checked={form.hostelAvailable} onChange={e => set('hostelAvailable', e.target.checked)} className="h-4 w-4" />
                  <Label htmlFor="hostel">Hostel Available</Label>
                </div>
                {form.hostelAvailable && (
                  <Field label="Hostel Details"><Input value={form.hostelDetails} onChange={e => set('hostelDetails', e.target.value)} /></Field>
                )}
              </div>
              <Field label="Faculty Details"><Textarea value={form.facultyDetails} onChange={e => set('facultyDetails', e.target.value)} rows={3} /></Field>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-3">Facilities</p>
                {facilities.map((f, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input value={f.name} onChange={e => setFacilities(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Facility name" />
                    <Input value={f.description} onChange={e => setFacilities(arr => arr.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Description" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setFacilities(arr => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setFacilities(arr => [...arr, { name: '', description: '' }])}><Plus className="h-4 w-4 mr-1" />Add Facility</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Admission ── */}
        <TabsContent value="admission">
          <Card><CardHeader><CardTitle>Admission Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Admission Process"><Textarea value={form.admissionProcess} onChange={e => set('admissionProcess', e.target.value)} rows={4} /></Field>
              <Field label="Eligibility Criteria"><Textarea value={form.eligibilityCriteria} onChange={e => set('eligibilityCriteria', e.target.value)} rows={4} /></Field>
              <Field label="Scholarship Details"><Textarea value={form.scholarshipDetails} onChange={e => set('scholarshipDetails', e.target.value)} rows={3} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Social ── */}
        <TabsContent value="social">
          <Card><CardHeader><CardTitle>Social Media Links</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              {['facebook', 'twitter', 'instagram', 'linkedin'].map(s => (
                <Field key={s} label={s.charAt(0).toUpperCase() + s.slice(1)}>
                  <Input value={form[`socialLinks.${s}`]} onChange={e => set(`socialLinks.${s}`, e.target.value)} placeholder={`https://${s}.com/...`} />
                </Field>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  )
}
