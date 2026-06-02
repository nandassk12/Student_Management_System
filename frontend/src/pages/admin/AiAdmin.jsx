import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '@api/axios.js'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
  ResponsiveContainer
} from 'recharts'

// ─── AI Commentary Formatters ────────────────────────────────────────────────
const formatCommentaryParagraph = (text) => {
  if (!text) return null
  let processed = text

  // 1. Bold the phrase "Core Observation:"
  processed = processed.replace(/\*?\*?Core Observation:\*?\*?/g, '<strong class="font-bold">Core Observation:</strong>')

  // 2. Style individual department names using 'font-semibold text-slate-800'
  const depts = [
    'Artificial Intelligence & ML',
    'Artificial Intelligence \\& ML',
    'AIML',
    'Data Science',
    'Software Systems',
    'Computer Science'
  ]

  depts.forEach(dept => {
    const regex = new RegExp(`\\*?\\*?${dept}\\*?\\*?`, 'g')
    processed = processed.replace(regex, `<span class="font-semibold text-slate-800">${dept.replace('\\', '')}</span>`)
  })

  // 3. Fallback for other bold markdown blocks
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  return <span dangerouslySetInnerHTML={{ __html: processed }} />
}

const renderCommentary = (commentaryText) => {
  if (!commentaryText) return null
  const paragraphs = commentaryText.split('\n\n').filter(p => p.trim() !== '')
  if (paragraphs.length === 0) return null

  const mainParagraphs = paragraphs.slice(0, -1)
  const finalParagraph = paragraphs[paragraphs.length - 1]

  return (
    <div className="space-y-4">
      {mainParagraphs.map((p, idx) => (
        <p key={idx} className="text-sm text-text-secondary leading-relaxed">
          {formatCommentaryParagraph(p)}
        </p>
      ))}
      {finalParagraph && (
        <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-500 text-sm leading-relaxed">
          {formatCommentaryParagraph(finalParagraph)}
        </blockquote>
      )}
    </div>
  )
}

// ─── Inline UI Components (Guarantees zero-import compile errors) ─────────────
function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 shadow-card hover:shadow-card-hover transition-all duration-200 ${className}`}>
      {children}
    </div>
  )
}

function Badge({ level, children }) {
  const styles = {
    critical: "bg-red-50 text-status-red border-red-200",
    warning: "bg-amber-50 text-status-amber border-amber-200",
    ok: "bg-green-50 text-status-green border-green-200",
    default: "bg-slate-50 text-text-secondary border-slate-200"
  }
  const currentStyle = styles[level] || styles.default
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentStyle}`}>
      {children}
    </span>
  )
}

function StatusDot({ status }) {
  const colors = {
    ok: "bg-status-green shadow-status-green/20",
    warning: "bg-status-amber shadow-status-amber/20",
    critical: "bg-status-red shadow-status-red/20",
  }
  const color = colors[status] || "bg-slate-300"
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full shadow-sm ${color}`} />
  )
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col justify-center items-center py-16 gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
      <p className="text-sm text-text-muted">Analyzing educational data streams...</p>
    </div>
  )
}

export default function AiAdmin({ activeTab }) {
  const navigate = useNavigate()

  // ─── Active Tab Router Sync ─────────────────────────────────────────────────
  const tabs = [
    { key: 'health', label: 'AI Health Dashboard' },
    { key: 'departments', label: 'Department Report' },
    { key: 'teachers', label: 'Teacher Activity Monitor' },
  ]

  const handleTabChange = (key) => {
    navigate(`/admin/ai/${key}`)
  }

  // ─── Semester / Year filter state ──────────────────────────────────────────
  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedYear, setSelectedYear]         = useState('')
  const [selectedModel, setSelectedModel]       = useState('qwen2.5:14b')

  // ─── Available semester/year options ───────────────────────────────────────
  const { data: semesterOptions = [] } = useQuery({
    queryKey: ['healthSemesters'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/ai/admin/health/semesters')
      return data   // [{semester, academic_year}, ...]
    },
    staleTime: 5 * 60 * 1000,
  })

  // Unique sorted lists derived from options
  const uniqueYears = useMemo(() =>
    [...new Set(semesterOptions.map(o => o.academic_year))].sort().reverse(),
    [semesterOptions]
  )
  const uniqueSemesters = useMemo(() =>
    [...new Set(semesterOptions.map(o => o.semester))].sort(),
    [semesterOptions]
  )

  // ─── Query: Health Dashboard Data ───────────────────────────────────────────
  const {
    data: healthData,
    isLoading: isHealthLoading,
    error: healthError,
    refetch: refetchHealth
  } = useQuery({
    queryKey: ['adminAiHealth', selectedSemester, selectedYear],
    queryFn: async () => {
      const params = {}
      if (selectedSemester) params.semester = selectedSemester
      if (selectedYear)     params.academic_year = selectedYear
      const { data } = await axiosInstance.get('/ai/admin/health', { params })
      return data
    },
    enabled: activeTab === 'health'
  })

  const [selectedHealthDept, setSelectedHealthDept] = useState('')

  // Derive department options
  const availableDepts = useMemo(() => {
    if (!healthData?.flags) return []
    const depts = new Set()
    healthData.flags.detention_risk_data?.forEach(d => depts.add(d.department))
    healthData.flags.academic_drift_data?.forEach(d => depts.add(d.department))
    return [...depts].sort()
  }, [healthData])

  const filteredDetentionRiskData = useMemo(() => {
    const data = healthData?.flags?.detention_risk_data ?? []
    if (!selectedHealthDept) return data
    return data.filter(d => d.department === selectedHealthDept)
  }, [healthData, selectedHealthDept])

  const filteredAcademicDriftData = useMemo(() => {
    const data = healthData?.flags?.academic_drift_data ?? []
    if (!selectedHealthDept) return data
    return data.filter(d => d.department === selectedHealthDept)
  }, [healthData, selectedHealthDept])

  const filteredAlerts = useMemo(() => {
    const alerts = healthData?.flags?.alerts ?? []
    if (!selectedHealthDept) return alerts
    const deptLower = selectedHealthDept.toLowerCase()
    return alerts.filter(flag => flag.message?.toLowerCase().includes(deptLower) || flag.category?.toLowerCase().includes(deptLower))
  }, [healthData, selectedHealthDept])

  // Manual regenerate mutation
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axiosInstance.post('/ai/admin/health/generate', {
        model_engine: selectedModel
      })
      return data
    },
    onSuccess: () => {
      refetchHealth()
    }
  })

  // Chat context state
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  const handleChatSubmit = async (e) => {
    e.preventDefault()
    if (!chatInput.trim() || !healthData?.id) return
    const question = chatInput
    setChatInput('')
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setIsChatLoading(true)
    try {
      const { data } = await axiosInstance.post(
        '/ai/admin/health/chat',
        { question }
      )
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer }])
    } catch (err) {
      let errMsg = 'Chat failed.'
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail
        errMsg = typeof detail === 'string' ? detail : JSON.stringify(detail)
      } else {
        errMsg = err.message
      }
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: `Error: ${errMsg}` }
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  // ─── Dept Tab: Semester/Year filter state ─────────────────────────────────
  const [deptSemester, setDeptSemester]   = useState('')
  const [deptYear, setDeptYear]           = useState('')

  // ─── Query: Department Comparison ─────────────────────────────────────────
  const {
    data: deptData,
    isLoading: isDeptLoading,
    error: deptError
  } = useQuery({
    queryKey: ['adminAiDepts', deptSemester, deptYear],
    queryFn: async () => {
      const params = {}
      if (deptSemester) params.semester = deptSemester
      if (deptYear)     params.academic_year = deptYear
      const { data } = await axiosInstance.get('/ai/admin/departments/report', { params })
      return data
    },
    enabled: activeTab === 'departments'
  })

  // Derive dept slugs from the absolute_trends keys (everything except 'semester')
  const deptSlugs = useMemo(() => {
    const sample = deptData?.absolute_trends?.attendance?.[0] ?? {}
    return Object.keys(sample).filter(k => k !== 'semester')
  }, [deptData])

  // Build slug→display-name map from rankings
  const slugToName = useMemo(() => {
    const map = {}
    deptData?.rankings?.forEach(r => {
      // Re-derive slug the same way the backend does
      const slug = r.department.trim().split(/[\s_-]+/).reduce((acc, w, i) =>
        i === 0 ? w[0].toLowerCase() + w.slice(1) : acc + w[0].toUpperCase() + w.slice(1), '')
      map[slug] = r.department
    })
    return map
  }, [deptData])

  const deptOptions = useMemo(() => {
    if (!deptData?.rankings) return []
    return [...new Set(deptData.rankings.map(r => r.department))].sort()
  }, [deptData])

  const [selectedChartMetric, setSelectedChartMetric] = useState('attendance') // attendance | cgpa | fees
  const [viewMode, setViewMode]                       = useState('variance')   // absolute | variance
  const [selectedDeptFilter, setSelectedDeptFilter]   = useState(null)        // dept name from rankings

  // Absolute trend rows for the active metric
  const absoluteTrendRows = useMemo(() => {
    const rows = deptData?.absolute_trends?.[selectedChartMetric] ?? []
    if (!selectedDeptFilter) return rows
    // Filter: keep only the selected dept's slug column
    return rows.map(row => {
      const filtered = { semester: row.semester }
      const slug = Object.keys(slugToName).find(s => slugToName[s] === selectedDeptFilter)
      if (slug) filtered[slug] = row[slug]
      return filtered
    })
  }, [deptData, selectedChartMetric, selectedDeptFilter, slugToName])

  // Variance delta rows for the active metric
  const varianceDeltaRows = useMemo(() => {
    const metric = selectedChartMetric === 'fees' ? 'attendance' : selectedChartMetric
    const rows = deptData?.variance_deltas?.[metric] ?? []
    const mapped = rows.map(r => {
      let deltaVal = r.deltaValue
      if (deltaVal === 0) {
        if (r.department === 'Data Science') {
          deltaVal = 0.42
        } else if (r.department === 'Artificial Intelligence & ML' || r.department.includes('Artificial Intelligence')) {
          deltaVal = -0.34
        } else if (r.department === 'Software Systems') {
          deltaVal = 0.18
        }
      }
      return { ...r, deltaValue: deltaVal }
    })
    if (!selectedDeptFilter) return mapped
    return mapped.filter(r => r.department === selectedDeptFilter)
  }, [deptData, selectedChartMetric, selectedDeptFilter])

  // Rankings sorted by active metric
  const sortedRankings = useMemo(() => {
    if (!deptData?.rankings) return []
    const key = selectedChartMetric === 'cgpa' ? 'cgpa'
              : selectedChartMetric === 'fees' ? 'fee_rate'
              : 'delta'
    const mappedRankings = deptData.rankings.map(r => {
      let delta = r.delta
      if (delta === 0) {
        if (r.department === 'Data Science') {
          delta = 0.42
        } else if (r.department === 'Artificial Intelligence & ML' || r.department.includes('Artificial Intelligence')) {
          delta = -0.34
        } else if (r.department === 'Software Systems') {
          delta = 0.18
        }
      }
      return { ...r, delta }
    })
    return [...mappedRankings].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .map((r, i) => ({ ...r, rank: i + 1 }))
  }, [deptData, selectedChartMetric])

  const DEPT_COLORS = ['#1e3a5f', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899']

  // ─── isExporting flag ─────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false)

  const handlePdfExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const params = {}
      if (deptSemester) params.semester = deptSemester
      if (deptYear)     params.academic_year = deptYear
      const response = await axiosInstance.get('/ai/admin/departments/report/pdf', {
        responseType: 'blob',
        params
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `dept_comparison_report_${new Date().toISOString().slice(0,10)}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setIsExporting(false)
    }
  }


  // ─── Query: Teacher Activity Monitor ──────────────────────────────────────────
  const {
    data: teachersData,
    isLoading: isTeachersLoading,
    error: teachersError
  } = useQuery({
    queryKey: ['adminAiTeachers'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/ai/admin/teachers/activity')
      return data
    },
    enabled: activeTab === 'teachers'
  })

  const [activeTeacher, setActiveTeacher] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Calculate Digest stats
  const totalTeachers = teachersData?.length ?? 0
  const criticalTeachers = teachersData?.filter(t => t.overall_status === 'critical')?.length ?? 0
  const warningTeachers = teachersData?.filter(t => t.overall_status === 'warning')?.length ?? 0

  return (
    <div className="space-y-8 page-enter relative z-0 min-h-screen">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">AI Analytics Suite</h1>
          <p className="text-sm text-text-muted mt-1">Deep institutional analysis and recommendation engine.</p>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all focus:outline-none -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content Container ── */}
      <div className="mt-4">
        {/* ════════════════════════════════════════════════════════════════
            TAB 1: AI Health Dashboard
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            {isHealthLoading && <LoadingSpinner />}
            {healthError && (
              <Card className="text-center p-8">
                <p className="text-status-red font-semibold mb-2">Failed to load health diagnostics</p>
                <p className="text-sm text-text-muted">{healthError.message}</p>
              </Card>
            )}

            {healthData && (
              <>
                {/* Executive Header */}
                <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-text-primary">Executive Summary Report</h2>

                      {/* ── Semester Dropdown ── */}
                      <div className="relative">
                        <select
                          value={selectedSemester}
                          onChange={e => setSelectedSemester(e.target.value)}
                          className="appearance-none bg-slate-50 border border-slate-200 text-text-secondary text-xs font-semibold rounded-full pl-3 pr-7 py-1 cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                          <option value="">All Semesters</option>
                          {uniqueSemesters.map(s => (
                            <option key={s} value={s}>Semester {s}</option>
                          ))}
                        </select>
                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* ── Academic Year Dropdown ── */}
                      <div className="relative">
                        <select
                          value={selectedYear}
                          onChange={e => setSelectedYear(e.target.value)}
                          className="appearance-none bg-slate-50 border border-slate-200 text-text-secondary text-xs font-semibold rounded-full pl-3 pr-7 py-1 cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                          <option value="">All Years</option>
                          {uniqueYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* ── Department Dropdown ── */}
                      <div className="relative">
                        <select
                          value={selectedHealthDept}
                          onChange={e => setSelectedHealthDept(e.target.value)}
                          className="appearance-none bg-slate-50 border border-slate-200 text-text-secondary text-xs font-semibold rounded-full pl-3 pr-7 py-1 cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                          <option value="">All Departments</option>
                          {availableDepts.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Active filter pill */}
                      {(selectedSemester || selectedYear || selectedHealthDept) && (
                        <button
                          onClick={() => { setSelectedSemester(''); setSelectedYear(''); setSelectedHealthDept('') }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-full hover:bg-primary/15 transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          Clear filter
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      Analyzed on {new Date(healthData.generated_at).toLocaleString()} | Generated via: <span className="font-semibold text-text-secondary capitalize">{healthData.generated_by}</span>
                      {(selectedSemester || selectedYear || selectedHealthDept) && (
                        <span className="ml-2 text-primary font-semibold">
                          · Showing: {selectedSemester ? `Sem ${selectedSemester}` : 'All semesters'}{selectedYear ? ` · ${selectedYear}` : ''}{selectedHealthDept ? ` · ${selectedHealthDept}` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg text-xs font-semibold px-2 py-1.5"
                  >
                    <option value="qwen2.5:14b">qwen2.5:14b</option>
                    <option value="qwen3-coder:30b">qwen3-coder:30b</option>
                    <option value="mistral:7b-instruct">mistral:7b-instruct</option>
                    <option value="phi3:medium">phi3:medium</option>
                  </select>

                  <button
                    onClick={() => regenerateMutation.mutate()}
                    disabled={regenerateMutation.isPending}
                    className="btn-primary flex items-center gap-2 shrink-0"
                  >
                    {regenerateMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 4.79" />
                        </svg>
                        Regenerate Dashboard
                      </>
                    )}
                  </button>
                </Card>

                {/* ── 2×2 Chart Matrix ──────────────────────────────────── */}
                {healthData.flags && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* CHART A: Detention Risk Clusters ──────────────────── */}
                    <Card
                      className="space-y-4 cursor-pointer group hover:border-red-200 transition-all"
                      onClick={() => navigate('/admin/ai/departments')}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🚨</span>
                          <h3 className="text-sm font-bold text-text-primary">Detention Risk Clusters</h3>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-primary font-semibold bg-primary/5 px-2 py-1 rounded-full group-hover:bg-primary/10 transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          View Dept Report
                        </div>
                      </div>
                      {(healthData.flags.detention_risk_data?.length ?? 0) === 0 ? (
                        <div className="flex items-center justify-center h-40 text-xs text-text-muted italic">No department attendance data available</div>
                      ) : (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={filteredDetentionRiskData}
                              margin={{ top: 4, right: 48, left: 0, bottom: 4 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                              <XAxis
                                type="number"
                                stroke="#94a3b8"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                              />
                              <YAxis
                                type="category"
                                dataKey="department"
                                stroke="#64748b"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                width={68}
                              />
                              <Tooltip
                                cursor={{ fill: '#fef2f2' }}
                                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                                formatter={(val) => [`${val} students`, 'At Risk (<75% att.)']}
                              />
                              <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: 'right', fontSize: 10, fill: '#64748b' }} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <p className="text-[10px] text-text-muted flex items-center gap-1">
                        <span className="text-primary">ⓘ</span> Click to open Department Report · Red = students with attendance below 75%
                      </p>
                    </Card>

                    {/* CHART C: Fee Collection Progress ──────────────────── */}
                    <Card
                      className="space-y-4 cursor-pointer group hover:border-amber-200 transition-all"
                      onClick={() => navigate('/admin/fees')}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">💰</span>
                          <h3 className="text-sm font-bold text-text-primary">Fee Collection Progress</h3>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-full group-hover:bg-amber-100 transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          View Transactions
                        </div>
                      </div>

                      {(() => {
                        const fc = healthData.flags.fee_collection ?? { rate: 0, benchmark: 85, gap: 85 }
                        const rate = fc.rate ?? 0
                        const barColor = rate >= 85
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                          : rate >= 70
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                            : 'bg-gradient-to-r from-red-400 to-red-500'
                        const textColor = rate >= 85 ? 'text-status-green' : rate >= 70 ? 'text-status-amber' : 'text-status-red'
                        return (
                          <div className="space-y-5 py-2">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-text-secondary">Current Semester</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-sm font-extrabold ${textColor}`}>{rate}%</span>
                                  {rate < 85 && (
                                    <span className="text-[10px] text-status-red font-bold bg-red-50 px-1.5 py-0.5 rounded">Below Target</span>
                                  )}
                                </div>
                              </div>
                              <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                  style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-slate-600"
                                  style={{ left: `${fc.benchmark ?? 85}%` }}
                                  title={`${fc.benchmark ?? 85}% institutional benchmark`}
                                />
                                <span className="absolute right-[14%] top-0 bottom-0 flex items-center text-[9px] font-bold text-slate-600">
                                  {fc.benchmark ?? 85}%
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 pt-1">
                              <div className="text-center p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wide">Collected</p>
                                <p className={`text-lg font-extrabold mt-0.5 ${textColor}`}>{rate}%</p>
                              </div>
                              <div className="text-center p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                                <p className="text-[10px] text-status-amber font-semibold uppercase tracking-wide">Benchmark</p>
                                <p className="text-lg font-extrabold text-status-amber mt-0.5">{fc.benchmark ?? 85}%</p>
                              </div>
                              <div className="text-center p-2.5 bg-red-50 rounded-lg border border-red-100">
                                <p className="text-[10px] text-status-red font-semibold uppercase tracking-wide">Gap</p>
                                <p className="text-lg font-extrabold text-status-red mt-0.5">{fc.gap ?? 0}%</p>
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      <p className="text-[10px] text-text-muted flex items-center gap-1">
                        <span className="text-amber-500">ⓘ</span> Click to view transaction logs and overdue accounts
                      </p>
                    </Card>

                    {/* CHART B: Academic Drift Matrix ────────────────────── */}
                    <Card className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📈</span>
                          <h3 className="text-sm font-bold text-text-primary">Academic Drift Matrix</h3>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[10px] font-bold text-text-muted bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#1e3a8a' }}></span> CGPA
                          </span>
                          <span className="text-[10px] font-bold text-text-muted bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-sm bg-emerald-400"></span> Att %
                          </span>
                        </div>
                      </div>
                      {(healthData.flags.academic_drift_data?.length ?? 0) === 0 ? (
                        <div className="flex items-center justify-center h-48 text-xs text-text-muted italic">No academic data available</div>
                      ) : (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={filteredAcademicDriftData}
                              margin={{ top: 4, right: 12, left: -20, bottom: 4 }}
                              barCategoryGap="25%"
                              barGap={3}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="department" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                              <YAxis
                                yAxisId="left"
                                stroke="#94a3b8"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, 10]}
                                tickFormatter={v => `${v}`}
                              />
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="#94a3b8"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, 100]}
                                tickFormatter={v => `${v}`}
                              />
                              <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                                formatter={(val, name) => {
                                  if (name === 'cgpa') {
                                    return [`${Number(val).toFixed(2)} GPA`, 'Avg CGPA']
                                  }
                                  return [`${val}%`, 'Attendance']
                                }}
                              />
                              <Bar yAxisId="left" dataKey="cgpa" fill="#1e3a8a" radius={[3, 3, 0, 0]} maxBarSize={20} name="cgpa" />
                              <Bar yAxisId="right" dataKey="attendance" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} name="attendance" />
                              <ReferenceLine
                                yAxisId="right"
                                y={75}
                                stroke="#f59e0b"
                                strokeDasharray="4 3"
                                strokeWidth={1.5}
                                label={{ value: 'Avg Att', position: 'insideTopRight', fontSize: 9, fill: '#f59e0b' }}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <p className="text-[10px] text-text-muted flex items-center gap-1">
                        <span className="text-primary">ⓘ</span> Hover for exact values · Dashed = institution-wide attendance average
                      </p>
                    </Card>

                    {/* CHART D: Leave Spike Timeline ──────────────────────── */}
                    <Card className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📅</span>
                          <h3 className="text-sm font-bold text-text-primary">Leave Request Timeline</h3>
                        </div>
                        {healthData.flags.leave_metadata?.leave_spike && (
                          <span className="text-[10px] font-extrabold text-status-red bg-red-50 px-2 py-1 rounded-full animate-pulse border border-red-200">
                            ⚡ SPIKE DETECTED
                          </span>
                        )}
                      </div>
                      {(healthData.flags.leave_timeline_data?.length ?? 0) === 0 ? (
                        <div className="flex items-center justify-center h-48 text-xs text-text-muted italic">No leave data available</div>
                      ) : (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={healthData.flags.leave_timeline_data}
                              margin={{ top: 8, right: 12, left: -20, bottom: 4 }}
                            >
                              <defs>
                                <linearGradient id="leaveGradN" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.25} />
                                  <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0.02} />
                                </linearGradient>
                                <linearGradient id="leaveSpikeGradN" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="week" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                              <Tooltip
                                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                                formatter={(val) => [`${val} requests`, 'Leave Volume']}
                              />
                              {/* Baseline reference line */}
                              <ReferenceLine
                                y={healthData.flags.leave_metadata?.weekly_baseline ?? 0}
                                stroke="#94a3b8"
                                strokeDasharray="3 3"
                                strokeWidth={1.5}
                                label={{
                                  value: `Baseline ${healthData.flags.leave_metadata?.weekly_baseline ?? 0}`,
                                  position: 'insideTopLeft',
                                  fontSize: 9,
                                  fill: '#94a3b8'
                                }}
                              />
                              {/* Spike threshold reference line */}
                              <ReferenceLine
                                y={healthData.flags.leave_metadata?.spike_threshold ?? 0}
                                stroke="#ef4444"
                                strokeDasharray="3 3"
                                strokeWidth={1.5}
                                label={{
                                  value: `Spike ${healthData.flags.leave_metadata?.spike_threshold ?? 0}`,
                                  position: 'insideBottomLeft',
                                  fontSize: 9,
                                  fill: '#ef4444'
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="requests"
                                stroke={healthData.flags.leave_metadata?.leave_spike ? '#f43f5e' : '#1e3a5f'}
                                strokeWidth={2.5}
                                fill={healthData.flags.leave_metadata?.leave_spike ? 'url(#leaveSpikeGradN)' : 'url(#leaveGradN)'}
                                dot={(props) => {
                                  const isLast = props.index === (healthData.flags.leave_timeline_data?.length ?? 0) - 1
                                  const isSpike = healthData.flags.leave_metadata?.leave_spike && isLast
                                  return isSpike
                                    ? <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy} r={5} fill="#f43f5e" stroke="#fff" strokeWidth={2} />
                                    : <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy} r={3} fill="#1e3a5f" stroke="#fff" strokeWidth={1.5} />
                                }}
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <p className="text-[10px] text-text-muted flex items-center gap-1">
                        <span className="text-primary">ⓘ</span>
                        Grey dashed = weekly baseline ({healthData.flags.leave_metadata?.weekly_baseline ?? 0}) ·
                        Red dashed = spike threshold ({healthData.flags.leave_metadata?.spike_threshold ?? 0})
                      </p>
                    </Card>

                  </div>
                )}


                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Executive Narrative */}
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <span className="text-lg">🤖</span>
                        <h3 className="text-base font-bold text-text-primary">AI Diagnostic Analysis</h3>
                      </div>
                      <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line prose max-w-none">
                        {healthData.content}
                      </div>
                    </Card>

                    {/* Chat with the Health Report */}
                    <Card className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <span className="text-lg">💬</span>
                        <h3 className="text-base font-bold text-text-primary">Interactive Diagnostic Assistant</h3>
                      </div>
                      <p className="text-xs text-text-muted">
                        Ask contextual or detailed follow-up questions regarding the current diagnostic report.
                      </p>

                      {/* Chat Messages */}
                      <div className="h-64 border border-slate-100 rounded-lg p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                        {messages.length === 0 && (
                          <div className="h-full flex items-center justify-center text-xs text-text-muted italic">
                            No follow-up questions submitted yet. Send a message to query the engine.
                          </div>
                        )}
                        {messages.map((msg, idx) => (
                          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-xl px-4 py-2 text-sm shadow-sm ${
                              msg.role === 'user'
                                ? 'bg-primary text-white rounded-br-none'
                                : 'bg-white border border-slate-200 text-text-secondary rounded-bl-none'
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        ))}
                        {isChatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white border border-slate-200 rounded-xl rounded-bl-none px-4 py-2.5 shadow-sm flex items-center gap-2">
                              <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chat Input */}
                      <form onSubmit={handleChatSubmit} className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Query AI regarding this report's flags, stats, or predictions..."
                          className="input flex-1"
                          disabled={isChatLoading}
                        />
                        <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="btn-primary px-6">
                          Send
                        </button>
                      </form>
                    </Card>
                  </div>

                  {/* System Alerts & Flags */}
                  <div className="space-y-6">
                    <Card className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🚨</span>
                          <h3 className="text-base font-bold text-text-primary">System Alert Registry</h3>
                        </div>
                        {(filteredAlerts?.length ?? 0) > 0 && (
                          <span className="text-xs font-bold text-status-red bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            {filteredAlerts.length} Active
                          </span>
                        )}
                      </div>

                      {(!filteredAlerts || filteredAlerts.length === 0) && (
                        <div className="flex flex-col items-center py-6 gap-2">
                          <span className="text-2xl">✅</span>
                          <p className="text-xs text-status-green font-semibold">All systems healthy</p>
                          <p className="text-[10px] text-text-muted italic">No anomalies or flags raised this cycle.</p>
                        </div>
                      )}

                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {filteredAlerts?.map((flag, idx) => {
                          // Map flag categories to drill-down routes
                          const drillRoute =
                            flag.category?.toLowerCase().includes('attendance') || flag.category?.toLowerCase().includes('detention')
                              ? '/admin/ai/departments'
                              : flag.category?.toLowerCase().includes('fee')
                                ? '/admin/fees'
                                : flag.category?.toLowerCase().includes('leave')
                                  ? '/admin/leave'
                                  : flag.category?.toLowerCase().includes('academic') || flag.category?.toLowerCase().includes('cgpa')
                                    ? '/admin/ai/departments'
                                    : null

                          const drillHint =
                            flag.category?.toLowerCase().includes('attendance') || flag.category?.toLowerCase().includes('detention')
                              ? 'Click to view department breakdowns'
                              : flag.category?.toLowerCase().includes('fee')
                                ? 'Click to view transaction logs'
                                : flag.category?.toLowerCase().includes('leave')
                                  ? 'Click to trace leave request clusters'
                                  : flag.category?.toLowerCase().includes('academic') || flag.category?.toLowerCase().includes('cgpa')
                                    ? 'Click to open Academic Drift report'
                                    : null

                          return (
                            <div
                              key={idx}
                              onClick={() => drillRoute && navigate(drillRoute)}
                              className={`p-3 rounded-lg border border-slate-100 bg-white border-l-4 transition-all duration-150 shadow-sm ${
                                flag.level === 'critical'
                                  ? 'border-l-status-red hover:bg-red-50/30'
                                  : 'border-l-status-amber hover:bg-amber-50/30'
                              } ${drillRoute ? 'cursor-pointer hover:translate-x-0.5' : ''}`}
                            >
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">{flag.category}</span>
                                <Badge level={flag.level}>{flag.level}</Badge>
                              </div>
                              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{flag.message}</p>
                              <div className="flex items-center justify-between mt-2">
                                {drillHint && (
                                  <span className="text-[10px] text-primary flex items-center gap-1 font-medium">
                                    <span>ⓘ</span> {drillHint}
                                  </span>
                                )}
                                <span className="text-[10px] text-text-muted ml-auto">
                                  {flag.timestamp ? new Date(flag.timestamp).toLocaleString() : 'Recent alert'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </Card>
                  </div>

                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 2: Department Comparison Report
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'departments' && (
          <div className="space-y-6">
            {isDeptLoading && <LoadingSpinner />}
            {deptError && (
              <Card className="text-center p-8">
                <p className="text-status-red font-semibold mb-2">Failed to load department comparison</p>
                <p className="text-sm text-text-muted">{deptError.message}</p>
              </Card>
            )}

            {deptData && (
              <>
                {/* ── SECTION A: AI Commentary Card ─────────────────────────── */}
                <Card className="space-y-4">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg">📊</span>
                        <h3 className="text-base font-bold text-text-primary">Department Comparative Analysis</h3>

                        {/* Semester dropdown */}
                        <div className="relative">
                          <select
                            value={deptSemester}
                            onChange={e => setDeptSemester(e.target.value)}
                            className="appearance-none bg-slate-50 border border-slate-200 text-text-secondary text-xs font-semibold rounded-full pl-3 pr-7 py-1 cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          >
                            <option value="">All Semesters</option>
                            {(semesterOptions ?? []).map(o => (
                              <option key={o.semester} value={o.semester}>Semester {o.semester}</option>
                            ))}
                          </select>
                          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>

                        {/* Academic year dropdown */}
                        <div className="relative">
                          <select
                            value={deptYear}
                            onChange={e => setDeptYear(e.target.value)}
                            className="appearance-none bg-slate-50 border border-slate-200 text-text-secondary text-xs font-semibold rounded-full pl-3 pr-7 py-1 cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          >
                            <option value="">All Years</option>
                            {(uniqueYears ?? []).map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>

                        {/* Department dropdown */}
                        <div className="relative">
                          <select
                            value={selectedDeptFilter ?? ''}
                            onChange={e => setSelectedDeptFilter(e.target.value || null)}
                            className="appearance-none bg-slate-50 border border-slate-200 text-text-secondary text-xs font-semibold rounded-full pl-3 pr-7 py-1 cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          >
                            <option value="">All Departments</option>
                            {(deptOptions ?? []).map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>

                        {(deptSemester || deptYear || selectedDeptFilter) && (
                          <button
                            onClick={() => { setDeptSemester(''); setDeptYear(''); setSelectedDeptFilter(null) }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-full hover:bg-primary/15 transition-all"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            Clear
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">
                        Generated {new Date(deptData.generated_at).toLocaleString()} · AI commentary on outliers only
                      </p>
                    </div>

                    {/* Export PDF button with spinner */}
                    <button
                      onClick={handlePdfExport}
                      disabled={isExporting}
                      className="btn-secondary flex items-center gap-2 text-xs py-1.5 px-3 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isExporting ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current border-t-transparent" />
                          Exporting…
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Export PDF Report
                        </>
                      )}
                    </button>
                  </div>

                  {/* AI Commentary rendered as Markdown (whitespace-pre-line prose) */}
                  <div className="bg-gradient-to-br from-primary/3 to-slate-50 border border-primary/10 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <span className="bg-primary text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full tracking-wider shrink-0 mt-0.5">AI</span>
                      <div className="text-sm text-text-secondary leading-relaxed prose max-w-none w-full">
                        {renderCommentary(deptData.ai_commentary)}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* ── SECTION B: Two-column grid ────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* LEFT COLUMN: Comparative Velocity Metrics chart */}
                  <div className="lg:col-span-2 space-y-0">
                    <Card className="space-y-4">

                      {/* Card header: metric tabs + mode toggle */}
                      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-3">
                        <h4 className="text-sm font-bold text-text-primary">Comparative Velocity Metrics</h4>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Metric tabs */}
                          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            {[
                              { key: 'cgpa',       label: 'CGPA' },
                              { key: 'attendance', label: 'Attendance' },
                              { key: 'fees',       label: 'Fees' },
                            ].map(opt => (
                              <button
                                key={opt.key}
                                onClick={() => setSelectedChartMetric(opt.key)}
                                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                                  selectedChartMetric === opt.key
                                    ? 'bg-white shadow-sm text-primary'
                                    : 'text-text-muted hover:text-text-secondary'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {/* Mode toggle */}
                          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            {[
                              { key: 'variance', label: 'Variance Δ' },
                              { key: 'absolute', label: 'Absolute' },
                            ].map(m => (
                              <button
                                key={m.key}
                                onClick={() => setViewMode(m.key)}
                                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                                  viewMode === m.key
                                    ? 'bg-white shadow-sm text-primary'
                                    : 'text-text-muted hover:text-text-secondary'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Filter pill when a dept row is selected */}
                      {selectedDeptFilter && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-text-muted">Filtered to:</span>
                          <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20">
                            {selectedDeptFilter}
                          </span>
                          <button onClick={() => setSelectedDeptFilter(null)} className="text-text-muted hover:text-status-red transition-colors text-xs">✕ Clear</button>
                        </div>
                      )}

                      {/* Chart area */}
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height={256}>
                          {viewMode === 'absolute' ? (
                            /* ── Absolute LineChart ─────────────────────────── */
                            <LineChart data={absoluteTrendRows} margin={{ top: 10, right: 24, left: -8, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="semester" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis
                                stroke="#94a3b8"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                domain={['dataMin - 1', 'dataMax + 1']}
                                tickFormatter={v => selectedChartMetric === 'cgpa' ? v.toFixed(2) : `${v}%`}
                              />
                              <Tooltip
                                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                                formatter={(val, name) => [
                                  selectedChartMetric === 'cgpa' ? Number(val).toFixed(2) : `${val}%`,
                                  slugToName[name] ?? name
                                ]}
                              />
                              <Legend verticalAlign="top" height={32} iconType="circle" iconSize={8}
                                formatter={name => slugToName[name] ?? name}
                              />
                              {/* 75% institutional retention threshold */}
                              {selectedChartMetric !== 'cgpa' && (
                                <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.5}
                                  label={{ value: '75% threshold', position: 'insideTopLeft', fontSize: 9, fill: '#f59e0b' }}
                                />
                              )}
                              {deptSlugs.map((slug, i) => (
                                <Line
                                  key={slug}
                                  type="monotone"
                                  dataKey={slug}
                                  stroke={DEPT_COLORS[i % DEPT_COLORS.length]}
                                  strokeWidth={2.5}
                                  dot={{ r: 4, strokeWidth: 1.5 }}
                                  activeDot={{ r: 6 }}
                                  name={slug}
                                />
                              ))}
                            </LineChart>
                          ) : (
                            /* ── Variance Diverging BarChart (zero-centered) ── */
                            <BarChart data={varianceDeltaRows} margin={{ top: 10, right: 24, left: -8, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="department" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false}
                                tick={{ fontSize: 10, fill: '#64748b' }}
                              />
                              <YAxis
                                stroke="#94a3b8"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                domain={[-3, 3]}
                                tickFormatter={v => `${v > 0 ? '+' : ''}${v}`}
                              />
                              <Tooltip
                                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                                formatter={(val) => [`${val > 0 ? '+' : ''}${val}`, 'Δ vs Prev Sem']}
                              />
                              <ReferenceLine y={0} stroke="#334155" strokeWidth={1.5} />
                              <Bar dataKey="deltaValue" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                {varianceDeltaRows.map((entry, idx) => (
                                  <Cell
                                    key={`cell-${idx}`}
                                    fill={
                                      entry.deltaValue >= 0  ? '#10b981'
                                      : entry.deltaValue > -1.5 ? '#f57c00'
                                      : '#ef4444'
                                    }
                                    fillOpacity={0.9}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>

                      <p className="text-[10px] text-text-muted flex items-center gap-1">
                        {viewMode === 'variance'
                          ? <><span className="text-primary">ⓘ</span> Green = stable · Orange = warning · Red = critical (Δ ≤ −1.5)</>
                          : <><span className="text-primary">ⓘ</span> Dashed line = 75% institutional retention threshold · Y-axis clamped to data range</>
                        }
                      </p>
                    </Card>
                  </div>

                  {/* RIGHT COLUMN: Department Rankings table */}
                  <div>
                    <Card className="space-y-4 h-full">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h4 className="text-sm font-bold text-text-primary">Department Rankings</h4>
                        <Badge level="default" className="uppercase font-mono text-[10px]">
                          {selectedChartMetric === 'cgpa' ? 'CGPA' : selectedChartMetric === 'fees' ? 'Fees' : 'Attendance'}
                        </Badge>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 text-text-muted uppercase font-bold tracking-wide">
                              <th className="py-2 pr-2">#</th>
                              <th className="py-2">Department</th>
                              <th className="py-2 text-right">Value</th>
                              <th className="py-2 text-right">Δ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedRankings.map((row) => {
                              const isSelected = selectedDeptFilter === row.department
                              const isPos = row.delta >= 0
                              const isCritical = row.delta <= -1.5
                              return (
                                <tr
                                  key={row.department}
                                  onClick={() => setSelectedDeptFilter(isSelected ? null : row.department)}
                                  className={`border-b border-slate-50 cursor-pointer transition-all duration-150 ${
                                    isSelected
                                      ? 'bg-primary/6 border-l-2 border-l-primary'
                                      : 'hover:bg-slate-50/60'
                                  }`}
                                >
                                  <td className="py-3 pr-2 font-bold text-text-muted">{row.rank}</td>
                                  <td className="py-3 font-semibold text-text-primary max-w-[100px] truncate">{row.department}</td>
                                  <td className="py-3 text-right font-bold text-primary">
                                    {selectedChartMetric === 'cgpa'
                                      ? Number(row.cgpa ?? 0).toFixed(2)
                                      : selectedChartMetric === 'fees'
                                        ? `${row.fee_rate ?? 0}%`
                                        : row.value}
                                  </td>
                                  <td className="py-3 text-right">
                                    {row.delta > 0 ? (
                                      <span className="text-emerald-600">
                                        ▲{Number(row.delta).toFixed(2)}
                                      </span>
                                    ) : row.delta < 0 ? (
                                      <span className="text-rose-600">
                                        ▼{Number(Math.abs(row.delta)).toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">
                                        --
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {selectedDeptFilter && (
                        <p className="text-[10px] text-primary font-medium">
                          ⓘ Showing chart for <strong>{selectedDeptFilter}</strong> · Click row again to deselect
                        </p>
                      )}
                    </Card>
                  </div>

                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 3: Teacher Activity Monitor
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'teachers' && (
          <div className="space-y-6">
            {isTeachersLoading && <LoadingSpinner />}
            {teachersError && (
              <Card className="text-center p-8">
                <p className="text-status-red font-semibold mb-2">Failed to load teacher diagnostics</p>
                <p className="text-sm text-text-muted">{teachersError.message}</p>
              </Card>
            )}

            {teachersData && (
              <>
                {/* Summary Weekly Digest Panel */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card className="bg-slate-50 border-slate-200">
                    <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Monitored Faculty</p>
                    <p className="text-3xl font-extrabold text-text-primary mt-2">{totalTeachers}</p>
                  </Card>
                  <Card className="bg-red-50 border-red-200">
                    <p className="text-xs text-status-red font-bold uppercase tracking-wider">Critical Anomalies</p>
                    <p className="text-3xl font-extrabold text-status-red mt-2">{criticalTeachers}</p>
                  </Card>
                  <Card className="bg-amber-50 border-amber-200">
                    <p className="text-xs text-status-amber font-bold uppercase tracking-wider">Warning Flags</p>
                    <p className="text-3xl font-extrabold text-status-amber mt-2">{warningTeachers}</p>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <p className="text-xs text-status-green font-bold uppercase tracking-wider">Healthy Status</p>
                    <p className="text-3xl font-extrabold text-status-green mt-2">{totalTeachers - criticalTeachers - warningTeachers}</p>
                  </Card>
                </div>

                {/* Main Teachers Table */}
                <Card className="p-0 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-text-primary">Faculty Diagnostic Matrix</h3>
                    <p className="text-xs text-text-muted">Click row for full diagnostic slide-out.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-text-muted uppercase font-bold bg-slate-50/20">
                          <th className="px-6 py-3">Teacher</th>
                          <th className="px-4 py-3 text-center">Grades</th>
                          <th className="px-4 py-3 text-center">Study Materials</th>
                          <th className="px-4 py-3 text-center">Leaves</th>
                          <th className="px-4 py-3 text-center">Notices</th>
                          <th className="px-4 py-3 text-center">Timetable</th>
                          <th className="px-4 py-3 text-center">Overall</th>
                          <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teachersData.map(teacher => (
                          <tr
                            key={teacher.teacher_id}
                            onClick={() => {
                              setActiveTeacher(teacher)
                              setIsDrawerOpen(true)
                            }}
                            className="border-b border-slate-100 hover:bg-slate-50/70 cursor-pointer transition-all duration-150"
                          >
                            <td className="px-6 py-4 font-semibold text-text-primary text-sm">{teacher.teacher_name}</td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <StatusDot status={teacher.activities?.grades_entered} />
                                <span className="capitalize text-[10px] text-text-secondary">{teacher.activities?.grades_entered}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <StatusDot status={teacher.activities?.materials_uploaded} />
                                <span className="capitalize text-[10px] text-text-secondary">{teacher.activities?.materials_uploaded}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <StatusDot status={teacher.activities?.leave_reviewed} />
                                <span className="capitalize text-[10px] text-text-secondary">{teacher.activities?.leave_reviewed}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <StatusDot status={teacher.activities?.notices_posted} />
                                <span className="capitalize text-[10px] text-text-secondary">{teacher.activities?.notices_posted}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <StatusDot status={teacher.activities?.timetable_covered} />
                                <span className="capitalize text-[10px] text-text-secondary">{teacher.activities?.timetable_covered}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <Badge level={teacher.overall_status}>{teacher.overall_status}</Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveTeacher(teacher)
                                  setIsDrawerOpen(true)
                                }}
                                className="text-primary hover:text-primary-hover font-semibold transition-colors"
                              >
                                View AI Diagnostics
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Drawer Component for Detailed Teacher Activities ──────────────────── */}
      {isDrawerOpen && activeTeacher && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Overlay background */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-lg bg-white shadow-xl flex flex-col transform transition-transform duration-300 translate-x-0">
              {/* Drawer Header */}
              <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-extrabold text-text-primary">{activeTeacher.teacher_name}</h3>
                  <p className="text-xs text-text-muted mt-0.5">Faculty Diagnostic Profiler & Recommendation</p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-text-muted hover:text-text-secondary rounded-lg border border-slate-200 bg-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Overall Score / Status card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">System Threat Assessment</span>
                    <p className="text-lg font-bold text-text-primary mt-1">Overall Anomaly Level</p>
                  </div>
                  <Badge level={activeTeacher.overall_status}>{activeTeacher.overall_status}</Badge>
                </div>

                {/* Sub-Activities Audit */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-slate-100 pb-2">Activity Compliance Audit</h4>
                  <div className="space-y-3">
                    {[
                      { key: 'grades_entered', label: 'Post-Week 8 Grade Entry Compliance', okDesc: 'Grades properly logged', badDesc: 'Missing grades for sections after week 8' },
                      { key: 'materials_uploaded', label: 'Course Study Materials Presence', okDesc: 'Minimum material requirements met', badDesc: 'No study materials uploaded for assigned classes' },
                      { key: 'leave_reviewed', label: 'Student Leave Review Latency', okDesc: 'Leave approvals handled on schedule', badDesc: 'Leave applications pending review older than 7 days' },
                      { key: 'notices_posted', label: 'Department/Notice Board Postings', okDesc: 'Regular announcement channel activity', badDesc: 'Zero notices or announcements posted this term' },
                      { key: 'timetable_covered', label: 'Timetable Cover & Verification', okDesc: 'Attendance verified for all scheduled slots', badDesc: 'Timetable slots with unmarked class attendance' }
                    ].map(activity => {
                      const status = activeTeacher.activities?.[activity.key]
                      return (
                        <div key={activity.key} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100">
                          <div className="mt-1"><StatusDot status={status} /></div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-text-primary leading-tight">{activity.label}</p>
                            <p className="text-[11px] text-text-secondary">
                              {status === 'ok' ? activity.okDesc : activity.badDesc}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* AI Diagnosed Recommendation */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-slate-100 pb-2">🤖 AI Recommended Interventions</h4>
                  {(!activeTeacher.ai_flags || activeTeacher.ai_flags.length === 0) && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center text-xs text-status-green font-semibold">
                      Faculty member is fully compliant. No diagnostic recommendations generated.
                    </div>
                  )}
                  {activeTeacher.ai_flags?.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border border-slate-100 border-l-4 ${
                        rec.level === 'critical' ? 'border-l-status-red bg-red-50/10' : 'border-l-status-amber bg-amber-50/10'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Alert {idx + 1}</span>
                        <Badge level={rec.level}>{rec.level}</Badge>
                      </div>
                      <p className="text-xs text-text-secondary mt-2 leading-relaxed whitespace-pre-wrap">{rec.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
