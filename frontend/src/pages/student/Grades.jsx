import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'

export default function StudentGrades() {
  const { user } = useAuth()

  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadReport = async () => {
    if (!user?.id || !selectedSemester || !selectedYear) return
    setIsDownloading(true)
    try {
      const response = await axiosInstance.get(`/grades/report/${user.id}`, {
        params: { semester: selectedSemester, academic_year: selectedYear },
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const link = document.createElement('a')
      const url = window.URL.createObjectURL(blob)
      link.href = url
      link.download = `report_card_semester_${selectedSemester}_${selectedYear.replace('-', '_')}.pdf`
      document.body.appendChild(link)
      link.click()
      
      link.parentNode.removeChild(link)
      setTimeout(() => window.URL.revokeObjectURL(url), 100)
    } catch (err) {
      alert('Failed to download report card. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  // ── Query: Fetch GPA Summary ──────────────────────────────────────────────────
  const { data: gpaSummary, isLoading: isGpaLoading } = useQuery({
    queryKey: ['studentGpaSummary', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data } = await axiosInstance.get(`/grades/gpa/${user.id}`)
      return data
    },
    enabled: !!user?.id
  })

  // ── Query: Fetch CGPA Summary (10-point scale) ──────────────────────────────
  const { data: cgpaSummary, isLoading: isCgpaLoading } = useQuery({
    queryKey: ['studentCgpaSummary', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data } = await axiosInstance.get(`/grades/cgpa/${user.id}`)
      return data
    },
    enabled: !!user?.id
  })

  const chartData = cgpaSummary?.semesters?.map(sem => ({
    name: `Sem ${sem.semester}`,
    SGPA: sem.sgpa,
    Credits: sem.credits
  })) || []

  // ── Query: Fetch Course Grades list ───────────────────────────────────────────
  const { data: gradesList = [], isLoading: isGradesLoading, error } = useQuery({
    queryKey: ['studentGradesList', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await axiosInstance.get('/grades/me')
      return data
    },
    enabled: !!user?.id
  })

  const uniqueSemesters = [...new Set(gradesList.map(g => g.semester))].sort((a, b) => a - b)
  const uniqueYears = [...new Set(gradesList.map(g => g.academic_year))].sort()

  useEffect(() => {
    if (gradesList.length > 0) {
      if (!selectedSemester && uniqueSemesters.length > 0) {
        setSelectedSemester(uniqueSemesters[0])
      }
      if (!selectedYear && uniqueYears.length > 0) {
        setSelectedYear(uniqueYears[0])
      }
    }
  }, [gradesList])

  // ── Query: Fetch Student Grades Result ───────────────────────────────────────
  const { data: resultData, isLoading: isResultLoading } = useQuery({
    queryKey: ['studentGradesResult', user?.id, selectedSemester, selectedYear],
    queryFn: async () => {
      if (!user?.id || !selectedSemester || !selectedYear) return null
      const { data } = await axiosInstance.get(`/grades/result/${user.id}`, {
        params: { semester: selectedSemester, academic_year: selectedYear }
      })
      return data
    },
    enabled: !!user?.id && !!selectedSemester && !!selectedYear
  })

  // Get color pills for letter grades
  const getGradePillClass = (letter) => {
    switch (letter) {
      case 'A': return 'text-green-700 bg-green-50 border-green-200 shadow-[0_1px_2px_rgba(22,163,74,0.05)]'
      case 'B': return 'text-blue-700 bg-blue-50 border-blue-200 shadow-[0_1px_2px_rgba(37,99,235,0.05)]'
      case 'C': return 'text-yellow-700 bg-yellow-50 border-yellow-200 shadow-[0_1px_2px_rgba(202,138,4,0.05)]'
      case 'D': return 'text-orange-700 bg-orange-50 border-orange-200 shadow-[0_1px_2px_rgba(234,88,12,0.05)]'
      case 'F': return 'text-red-700 bg-red-50 border-red-200 shadow-[0_1px_2px_rgba(220,38,38,0.05)]'
      default: return 'text-slate-400 bg-slate-50 border-slate-200'
    }
  }

  const breakdownLetters = ['A', 'B', 'C', 'D', 'F']

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Academic Grades</h1>
        <p className="text-sm text-text-muted mt-1">Review your overall cumulative performance, semester GPA, and report cards.</p>
      </div>

      {/* Top Section: CGPA, Recharts Progress Chart, and Grade Distribution */}
      {isCgpaLoading || isGpaLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="h-48 rounded-xl bg-slate-100 border border-slate-200" />
          <div className="h-48 rounded-xl bg-slate-100 border border-slate-200 lg:col-span-2" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CGPA Card */}
            <div className="card bg-gradient-to-br from-primary to-navy-900 text-white p-6 flex flex-col justify-between hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-1">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-navy-200 font-bold uppercase tracking-wider">Overall Academic Standing</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-white/10 text-navy-200 border border-white/20">
                    10-Point Scale
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-5xl font-black tracking-tight">
                    {cgpaSummary ? cgpaSummary.cgpa.toFixed(2) : '0.00'}
                  </span>
                  <span className="text-sm font-bold text-navy-300"> / 10.0</span>
                </div>
                <p className="text-xs text-navy-200 mt-2 font-medium">Cumulative Grade Point Average (CGPA)</p>
              </div>
              <div className="border-t border-white/10 pt-4 mt-6 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-navy-300 block uppercase font-bold tracking-wider">Total Credits</span>
                  <span className="text-sm font-extrabold text-white">{cgpaSummary ? cgpaSummary.total_credits : 0} credits</span>
                </div>
                <div>
                  <span className="text-[10px] text-navy-300 block uppercase font-bold tracking-wider">Completed Semesters</span>
                  <span className="text-sm font-extrabold text-white text-right block">{cgpaSummary ? cgpaSummary.semesters.length : 0}</span>
                </div>
              </div>
            </div>

            {/* Recharts Progress Chart Card */}
            <div className="card bg-white p-6 lg:col-span-2 flex flex-col justify-between hover:shadow-card-hover transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Semester-wise Progress</h3>
                  <p className="text-[10px] text-text-muted mt-0.5">Performance tracking of SGPA over academic terms</p>
                </div>
                {cgpaSummary && cgpaSummary.semesters.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold text-primary bg-navy-50 border border-navy-100">
                    Latest SGPA: {cgpaSummary.semesters[cgpaSummary.semesters.length - 1].sgpa.toFixed(2)}
                  </span>
                )}
              </div>

              <div className="h-36 w-full mt-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        domain={[0, 10]} 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        ticks={[0, 2, 4, 6, 8, 10]} 
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-lg border border-slate-800 text-[11px] font-medium space-y-1">
                                <p className="font-extrabold text-navy-300">{payload[0].payload.name}</p>
                                <p className="flex justify-between gap-4">
                                  <span>SGPA:</span> 
                                  <span className="font-black text-status-green">{Number(payload[0].value).toFixed(2)}</span>
                                </p>
                                <p className="flex justify-between gap-4 text-slate-400">
                                  <span>Credits:</span> 
                                  <span>{payload[0].payload.Credits}</span>
                                </p>
                              </div>
                            )
                          }
                          return null
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="SGPA" 
                        stroke="#1e3a5f" 
                        strokeWidth={3} 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#16a34a' }} 
                        dot={{ r: 4, strokeWidth: 1, fill: '#ffffff', stroke: '#1e3a5f' }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-text-muted italic">
                    Not enough graded terms to display progress trend.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grade Distribution & Semester SGPA cards grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Semester-wise SGPA Breakdown Cards */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider px-1">Semester Breakdown</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cgpaSummary && cgpaSummary.semesters.map((sem) => {
                  return (
                    <div 
                      key={sem.semester}
                      className="card bg-white p-4 flex items-center justify-between border-l-4 border-l-navy-400 hover:shadow-card-hover transition-all duration-200"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Semester {sem.semester}</span>
                        <span className="text-base font-extrabold text-text-primary mt-1 block">
                          SGPA: {sem.sgpa.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 text-text-secondary border border-card-border">
                          {sem.credits} Credits
                        </span>
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden ml-auto">
                          <div 
                            className="bg-primary h-full rounded-full transition-all duration-500" 
                            style={{ width: `${(sem.sgpa / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
                {(!cgpaSummary || cgpaSummary.semesters.length === 0) && (
                  <div className="card bg-white p-6 text-center text-text-muted text-xs italic col-span-2">
                    No semester GPA data recorded.
                  </div>
                )}
              </div>
            </div>

            {/* Grade Distribution */}
            {gpaSummary && (
              <div className="card bg-white p-5 flex flex-col justify-between">
                <div>
                  <span className="text-xs text-text-muted font-bold uppercase tracking-wider mb-3 block">Grade Distribution (4.0 Scale)</span>
                  <div className="grid grid-cols-5 gap-2 mt-1">
                    {breakdownLetters.map((letter) => {
                      const count = gpaSummary.grade_breakdown?.[letter] || 0
                      return (
                        <div 
                          key={letter}
                          className="p-2.5 rounded-lg border border-card-border bg-slate-50/30 text-center flex flex-col justify-between"
                        >
                          <span className="text-xs font-black text-text-secondary block">{letter}</span>
                          <span className="text-base font-black text-primary mt-1 block">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="text-[9px] text-text-muted italic mt-4 pt-3 border-t border-slate-100">
                  Reflects letter grades recorded on standard 4.0 scale courses.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Card Table Card */}
      <div className="card bg-white overflow-hidden">
        <div className="p-4 border-b border-card-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Academic record sheet</h3>
          
          {gradesList.length > 0 && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Semester</label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(Number(e.target.value))}
                  className="input py-1 px-2.5 text-xs bg-white font-medium border border-card-border rounded"
                >
                  {uniqueSemesters.map((sem) => (
                    <option key={sem} value={sem}>Semester {sem}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Academic Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="input py-1 px-2.5 text-xs bg-white font-medium border border-card-border rounded"
                >
                  {uniqueYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {resultData && resultData.courses.length > 0 && (
                <button
                  disabled={isDownloading}
                  onClick={handleDownloadReport}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#1e3a5f] hover:bg-[#152a46] disabled:bg-slate-400 text-white text-xs font-bold rounded shadow-sm transition-colors active:scale-95 ml-2"
                >
                  {isDownloading ? (
                    <>
                      <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Report Card
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {isGradesLoading || isResultLoading ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs font-semibold">Loading grades sheet...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-status-red bg-red-50/50">
            Failed to load academic records: {error.message}
          </div>
        ) : gradesList.length === 0 ? (
          <div className="p-12 text-center text-text-muted">
            No academic grades recorded for your account yet.
          </div>
        ) : (
          <div>
            {resultData && resultData.courses.length > 0 && (
              <div className="p-4 bg-slate-50/20 border-b border-card-border">
                {/* Banner based on overall_result */}
                {resultData.overall_result === 'DISTINCTION' && (
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-extrabold flex items-center justify-between shadow-[0_1px_3px_rgba(107,33,168,0.05)] transition-all duration-300">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🏆</span>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider block font-bold text-purple-600">Semester Standing</span>
                        <span className="block text-lg font-black tracking-tight">PASS WITH DISTINCTION</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider block font-bold text-purple-600">Semester GPA</span>
                      <span className="block text-lg font-black tracking-tight">{resultData.semester_gpa.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {resultData.overall_result === 'PASS' && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-status-green font-extrabold flex items-center justify-between shadow-[0_1px_3px_rgba(22,163,74,0.05)] transition-all duration-300">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">✅</span>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider block font-bold text-green-600">Semester Standing</span>
                        <span className="block text-lg font-black tracking-tight">PASS</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider block font-bold text-green-600">Semester GPA</span>
                      <span className="block text-lg font-black tracking-tight">{resultData.semester_gpa.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {resultData.overall_result === 'FAIL' && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-red font-extrabold flex items-center justify-between shadow-[0_1px_3px_rgba(220,38,38,0.05)] transition-all duration-300">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">❌</span>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider block font-bold text-red-600">Semester Standing</span>
                        <span className="block text-lg font-black tracking-tight">FAIL</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider block font-bold text-red-600">Semester GPA</span>
                      <span className="block text-lg font-black tracking-tight">{resultData.semester_gpa.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!resultData || resultData.courses.length === 0 ? (
              <div className="p-12 text-center text-text-muted">
                No academic grades recorded for Semester {selectedSemester} ({selectedYear}) yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-card-border bg-slate-50/20">
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider w-32 text-center">Semester</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Course / Subject</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center w-36">Marks (100)</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center w-36">Letter Grade</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right w-36">Standing Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {resultData.courses.map((record, index) => {
                      return (
                        <tr key={index} className="hover:bg-slate-50/20 transition-colors">
                          {/* Semester */}
                          <td className="p-4 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-text-secondary border border-card-border">
                              Sem {selectedSemester}
                            </span>
                          </td>

                          {/* Course */}
                          <td className="p-4 text-xs font-bold text-text-primary">
                            {record.course}
                          </td>

                          {/* Marks */}
                          <td className="p-4 text-center font-bold text-xs text-text-primary">
                            {record.marks}
                          </td>

                          {/* Letter Grade */}
                          <td className="p-4 text-center">
                            <span className={`inline-block px-3 py-0.5 text-xs font-black rounded-full border ${getGradePillClass(record.grade)}`}>
                              {record.grade}
                            </span>
                          </td>

                          {/* Standing Result Badge */}
                          <td className="p-4 text-right">
                            <span className={`inline-block px-2.5 py-0.5 text-[10px] font-black rounded-full border uppercase tracking-wider ${
                              record.result === 'distinction' ? 'text-purple-700 bg-purple-50 border-purple-200' :
                              record.result === 'pass' ? 'text-status-green bg-green-50 border-green-200' :
                              'text-status-red bg-red-50 border-red-200'
                            }`}>
                              {record.result}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
