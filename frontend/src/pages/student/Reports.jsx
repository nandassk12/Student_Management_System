import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import axiosInstance from '@api/axios.js'
import RichNarrative from '../../components/RichNarrative.jsx'

export default function StudentReports() {
  const [searchQuery, setSearchQuery] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)

  // ── Query: Fetch approved student reports ─────────────────────────────────────
  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ['myReportsList'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/ai/reports/me')
      return data
    }
  })

  // ── PDF Download handler ────────────────────────────────────────────────────
  const handleDownloadPDF = async (reportId) => {
    setDownloadingId(reportId)
    try {
      const response = await axiosInstance.get(`/ai/reports/${reportId}/pdf`, {
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `academic_progress_report_${reportId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('PDF downloaded successfully!')
    } catch (err) {
      toast.error('Failed to download PDF. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const narrative = r.edited_narrative || r.narrative || ''
    const year = r.academic_year || ''
    return (
      narrative.toLowerCase().includes(searchQuery.toLowerCase()) ||
      year.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(r.semester).includes(searchQuery)
    )
  })

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Academic Progress Reports</h1>
        <p className="text-sm text-[#64748b] mt-1">View official narrative feedback, performance flags, and download PDF transcripts.</p>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search reports by semester, year, narrative..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] outline-none"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="text-xs font-semibold text-[#64748b]">
          Total Reports: {filteredReports.length}
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="card bg-white p-12 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs font-semibold">Loading progress reports...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-[#dc2626] bg-red-50/50 rounded-xl border border-red-200">
          Failed to load progress reports: {error.message}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="card bg-white p-16 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
          <span className="text-3xl">📝</span>
          <h3 className="font-bold text-sm text-[#0f172a]">No reports available</h3>
          <p className="text-xs max-w-xs">No approved progress reports have been released for your account yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredReports.map((report) => (
            <div key={report.id} className="card bg-white overflow-hidden border border-[#e2e8f0] hover:shadow-card-hover transition-all duration-300">
              {/* Header */}
              <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#1e3a5f] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                    Semester {report.semester}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Academic Year {report.academic_year}
                  </span>
                  <span className="text-xs text-slate-400">
                    Released: {report.approved_at ? new Date(report.approved_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>

                <button
                  onClick={() => handleDownloadPDF(report.id)}
                  disabled={downloadingId === report.id}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e3a5f] hover:bg-[#152a46] disabled:bg-slate-400 text-white text-xs font-bold rounded-lg transition-colors active:scale-95"
                >
                  {downloadingId === report.id ? (
                    <>
                      <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download PDF Report
                    </>
                  )}
                </button>
              </div>

              {/* Info Bar */}
              <div className="px-6 py-3 bg-[#f8fafc] border-b border-[#e2e8f0] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium">
                <div>
                  <span className="text-slate-400 block">Overall CGPA</span>
                  <span className="text-sm font-bold text-[#0f172a]">{report.current_cgpa || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Overall Attendance</span>
                  <span className="text-sm font-bold text-[#0f172a]">{report.overall_attendance}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Roll Number</span>
                  <span className="text-sm font-bold text-[#0f172a]">{report.roll_number || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Department</span>
                  <span className="text-sm font-bold text-[#0f172a]">{report.department || 'N/A'}</span>
                </div>
              </div>

              {/* Narrative Content */}
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Teacher Feedback & Review</h4>
                  <RichNarrative text={report.edited_narrative || report.narrative} />
                </div>

                {/* Risk Indicator Alerts if any exist */}
                {report.risk_flags && report.risk_flags.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Attention Required</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {report.risk_flags.map((flag, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs font-semibold ${
                            flag.level === 'critical'
                              ? 'text-red-700 bg-red-50 border-red-200'
                              : 'text-amber-700 bg-amber-50 border-amber-200'
                          }`}
                        >
                          <span className="text-base mt-0.5">⚠️</span>
                          <div>
                            <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5">
                              {flag.level} Warning
                            </span>
                            <span>{flag.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
