import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'

export default function StudentMaterial() {
  const [selectedCourse, setSelectedCourse] = useState('')

  // ── Query: Fetch Courses ──────────────────────────────────────────────────────
  const { data: courses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['studentCoursesListMaterials'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/courses', { params: { limit: 100 } })
      return data
    }
  })

  // ── Query: Fetch Materials for Course ─────────────────────────────────────────
  const { data: materials = [], isLoading: isMaterialsLoading, error } = useQuery({
    queryKey: ['courseMaterialsList', selectedCourse],
    queryFn: async () => {
      if (!selectedCourse) return []
      const { data } = await axiosInstance.get(`/material/course/${selectedCourse}`)
      return data
    },
    enabled: !!selectedCourse
  })

  // ── Authenticated Download Trigger ───────────────────────────────────────────
  const handleDownload = async (materialId, fileName, fileExt) => {
    const toastId = toast.loading(`Downloading ${fileName}...`)
    try {
      const { data } = await axiosInstance.get(`/material/${materialId}`, {
        responseType: 'blob'
      })

      const blob = new Blob([data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${fileName}.${fileExt}`)
      document.body.appendChild(link)
      link.click()
      
      // Clean up
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Download completed!', { id: toastId })
    } catch (err) {
      toast.error('Failed to download study material.', { id: toastId })
    }
  }

  // Formatting for file size
  const formatBytes = (bytes, decimals = 1) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  // Icon type resolution helper
  const getFileTypeIcon = (ext = '') => {
    const format = ext.toLowerCase()
    if (format === 'pdf') {
      return (
        <span className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-extrabold text-xs">
          PDF
        </span>
      )
    }
    if (['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(format)) {
      return (
        <span className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-extrabold text-xs">
          IMG
        </span>
      )
    }
    if (['mp4', 'mkv', 'avi', 'mov'].includes(format)) {
      return (
        <span className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-extrabold text-xs">
          VID
        </span>
      )
    }
    if (['doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(format)) {
      return (
        <span className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-extrabold text-xs">
          DOC
        </span>
      )
    }
    return (
      <span className="w-10 h-10 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center font-extrabold text-xs">
        FILE
      </span>
    )
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Study Materials</h1>
        <p className="text-sm text-text-muted mt-1">Access study materials, notes, resources, and lectures shared by your instructors.</p>
      </div>

      {/* Selector Toolbar */}
      <div className="flex items-center gap-4 p-4 card bg-white">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Choose Course / Subject:</label>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="input bg-white max-w-xs text-xs font-semibold py-1.5"
          disabled={isCoursesLoading}
        >
          <option value="">-- Choose Course --</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name} ({course.code})
            </option>
          ))}
        </select>
      </div>

      {/* Main Content Area */}
      {!selectedCourse ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-2xl border border-card-border">
            📂
          </div>
          <h3 className="font-bold text-text-primary text-lg">Select a Course</h3>
          <p className="text-sm max-w-md">
            Please choose a course from the drop-down menu above to see the uploaded notes and resources.
          </p>
        </div>
      ) : isMaterialsLoading ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2 animate-pulse">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs font-semibold">Loading course materials...</span>
        </div>
      ) : error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading study materials: {error.message}
        </div>
      ) : materials.length === 0 ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2 border border-dashed border-card-border bg-slate-50/20">
          <span className="text-2xl">📦</span>
          <h4 className="font-bold text-text-secondary text-sm">No materials shared yet</h4>
          <p className="text-xs max-w-xs mt-1">Your instructors haven't uploaded study files for this course yet.</p>
        </div>
      ) : (
        /* Materials Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {materials.map((mat) => {
            return (
              <div 
                key={mat.id}
                className="card bg-white p-5 hover:shadow-card hover:border-primary/40 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* File icon & Identity */}
                  <div className="flex items-center gap-3">
                    {getFileTypeIcon(mat.file_type)}
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-text-primary truncate" title={mat.title}>
                        {mat.title}
                      </h4>
                      <p className="text-[10px] text-text-muted font-bold mt-0.5">
                        Uploaded by {mat.teacher?.full_name || mat.teacher?.username}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {mat.description && (
                    <p className="text-[11px] text-text-secondary mt-4 leading-relaxed bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/60 line-clamp-2">
                      {mat.description}
                    </p>
                  )}
                </div>

                {/* Footer specs & Actions */}
                <div className="mt-6 pt-3 border-t border-card-border/60 flex items-center justify-between">
                  <span className="text-[10px] text-text-muted font-bold">
                    {formatBytes(mat.file_size)}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => handleDownload(mat.id, mat.title, mat.file_type)}
                    className="text-[11px] font-bold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Download
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
