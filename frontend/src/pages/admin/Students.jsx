import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import axiosInstance from '@api/axios.js'

export default function AdminStudents() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  // Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState(null)

  // Fetch Users with student filter
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['adminStudentsList'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/users', { params: { limit: 100, role: 'student' } })
      return data
    }
  })

  // Filter students based on search input
  const filteredStudents = users.filter((u) => {
    const q = search.toLowerCase()
    return (
      u.username.toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )
  })

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImportFile(file)
      parseFile(file)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) {
      setImportFile(file)
      parseFile(file)
    }
  }

  const parseFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const rows = parseCSV(text)
      setParsedRows(rows)
    }
    reader.readAsText(file)
  }

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/)
    if (lines.length === 0) return []
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
    const rows = []
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const values = []
      let current = ''
      let inQuotes = false
      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim())
      
      const row = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx] || ''
      })
      rows.push(row)
    }
    return rows
  }

  const startImport = async () => {
    if (!importFile) return
    setIsImporting(true)
    setImportProgress(10)
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 85) {
          clearInterval(interval)
          return 85
        }
        return prev + 15
      })
    }, 150)

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      
      const { data } = await axiosInstance.post('/users/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      clearInterval(interval)
      setImportProgress(100)
      setImportResult(data)
    } catch (err) {
      clearInterval(interval)
      setIsImporting(false)
      alert(err.response?.data?.detail || 'An error occurred during CSV import.')
    } finally {
      setIsImporting(false)
    }
  }

  const closeImportModal = () => {
    setIsImportModalOpen(false)
    setImportFile(null)
    setParsedRows([])
    setImportResult(null)
    setIsImporting(false)
    setImportProgress(0)
    // Invalidate queries to refresh the main list
    queryClient.invalidateQueries({ queryKey: ['adminStudentsList'] })
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Student Directory</h1>
          <p className="text-sm text-[#64748b] mt-1">Manage and view all registered students in the system.</p>
        </div>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#152a46] text-white text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95 self-start sm:self-center"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import CSV
        </button>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by name, username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] outline-none"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="text-xs font-semibold text-[#64748b]">
          Total Students: {filteredStudents.length}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 space-y-4">
            <div className="h-6 w-1/4 bg-slate-100 rounded animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 font-semibold">
            Error loading students: {error.message}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-16 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
            <span className="text-3xl">👥</span>
            <h3 className="font-bold text-sm text-[#0f172a]">No students found</h3>
            <p className="text-xs max-w-xs">No user records matching 'student' role or search criteria were found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e8f0]">
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">ID</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Username</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Email</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Created At</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {filteredStudents.map((student, idx) => (
                  <tr key={student.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50/80 transition-colors`}>
                    <td className="p-4 text-xs font-bold text-[#0f172a]">{student.id}</td>
                    <td className="p-4 text-xs font-semibold text-[#0f172a]">{student.username}</td>
                    <td className="p-4 text-xs text-[#64748b]">{student.email}</td>
                    <td className="p-4 text-xs text-[#64748b]">
                      {student.created_at ? format(parseISO(student.created_at), 'MMM dd, yyyy') : 'N/A'}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-black rounded-full border uppercase tracking-wider ${
                        student.is_active
                          ? 'text-green-600 bg-green-50 border-green-200 shadow-sm'
                          : 'text-red-600 bg-red-50 border-red-200 shadow-sm'
                      }`}>
                        {student.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        to={`/admin/users/${student.id}/documents`}
                        className="text-xs font-bold text-[#1e3a5f] hover:text-[#152a46] transition-colors"
                      >
                        View Documents
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-800">Bulk Import Students</h3>
                <p className="text-xs text-slate-500 mt-0.5">Upload a CSV file containing student records to create profiles and enrollments.</p>
              </div>
              <button 
                onClick={closeImportModal}
                disabled={isImporting}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {!importResult && !isImporting && (
                <>
                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('csv-file-input').click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      importFile 
                        ? 'border-green-350 bg-green-50/10' 
                        : 'border-slate-300 hover:border-indigo-400 bg-slate-50/30 hover:bg-slate-50/70'
                    }`}
                  >
                    <input 
                      id="csv-file-input"
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {importFile ? (
                      <div className="space-y-2">
                        <span className="text-3xl">📄</span>
                        <h4 className="font-semibold text-sm text-slate-800">{importFile.name}</h4>
                        <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(2)} KB</p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setImportFile(null);
                            setParsedRows([]);
                          }}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg border border-red-200 transition-colors mt-2"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-3xl">📤</span>
                        <h4 className="font-semibold text-sm text-slate-700">Drag & drop your CSV file here</h4>
                        <p className="text-xs text-slate-400">or click to browse from your computer</p>
                        <div className="text-[10px] text-slate-400 mt-4 max-w-md mx-auto leading-relaxed">
                          Requires columns: <code className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">username</code>, <code className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">email</code>, <code className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">password</code>, <code className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">department_code</code>, <code className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">class_name</code>, <code className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">roll_number</code>.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CSV Preview */}
                  {parsedRows.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Preview (First 5 Rows)</h4>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">Total {parsedRows.length} rows found</span>
                      </div>
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/20">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200">
                              <th className="p-2 font-bold text-slate-600">Username</th>
                              <th className="p-2 font-bold text-slate-600">Email</th>
                              <th className="p-2 font-bold text-slate-600">Dept</th>
                              <th className="p-2 font-bold text-slate-600">Class</th>
                              <th className="p-2 font-bold text-slate-600">Roll #</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedRows.slice(0, 5).map((row, i) => (
                              <tr key={i} className="hover:bg-slate-50/50">
                                <td className="p-2 text-slate-700 font-medium">{row.username || '-'}</td>
                                <td className="p-2 text-slate-500">{row.email || '-'}</td>
                                <td className="p-2 text-slate-700 font-semibold">{row.department_code || '-'}</td>
                                <td className="p-2 text-slate-600">{row.class_name || '-'}</td>
                                <td className="p-2 text-slate-700 font-mono">{row.roll_number || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Progress bar state */}
              {isImporting && (
                <div className="py-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 text-sm">Uploading and Processing CSV</h4>
                    <p className="text-xs text-slate-400">Please do not close this window or navigate away.</p>
                  </div>
                  <div className="max-w-md mx-auto bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300 rounded-full" 
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Import Results Summary */}
              {importResult && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-xl">
                      <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider block">Created</span>
                      <span className="text-3xl font-extrabold text-green-700 block mt-1">{importResult.created}</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Skipped</span>
                      <span className="text-3xl font-extrabold text-amber-700 block mt-1">{importResult.skipped}</span>
                    </div>
                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Errors</span>
                      <span className="text-3xl font-extrabold text-red-700 block mt-1">{importResult.errors.length}</span>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Error Details</h4>
                      <div className="border border-red-100 rounded-lg overflow-hidden bg-red-50/20 max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-red-50/50 border-b border-red-100 sticky top-0">
                              <th className="p-2 font-bold text-red-700 w-16">Row</th>
                              <th className="p-2 font-bold text-red-700">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-50">
                            {importResult.errors.map((err, i) => (
                              <tr key={i} className="hover:bg-red-50/30">
                                <td className="p-2 text-red-600 font-bold">Row {err.row}</td>
                                <td className="p-2 text-red-700">{err.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              {!importResult && !isImporting ? (
                <>
                  <button
                    onClick={closeImportModal}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!importFile}
                    onClick={startImport}
                    className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#152a46] disabled:bg-slate-350 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    Start Import
                  </button>
                </>
              ) : importResult ? (
                <button
                  onClick={closeImportModal}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Close & Refresh
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
