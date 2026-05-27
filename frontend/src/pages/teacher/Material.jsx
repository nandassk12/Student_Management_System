import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import { ConfirmModal } from '@components/Modal.jsx'

export default function TeacherMaterial() {
  const queryClient = useQueryClient()

  // Upload Form States
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  const fileInputRef = useRef(null)

  // Delete Material States
  const [deletingMaterial, setDeletingMaterial] = useState(null)

  // ── Query: Fetch Courses ──────────────────────────────────────────────────────
  const { data: courses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['teacherCoursesMaterials'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/courses', { params: { limit: 100 } })
      return data
    }
  })

  // ── Query: Fetch Uploaded Materials ──────────────────────────────────────────
  const { data: myMaterials = [], isLoading: isMaterialsLoading } = useQuery({
    queryKey: ['teacherMyMaterials'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/material/me', { params: { limit: 100 } })
      return data
    }
  })

  // ── Mutation: Delete Material ─────────────────────────────────────────────────
  const deleteMaterialMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/material/${id}`)
      return data
    },
    onSuccess: (data) => {
      toast.success(data.detail ?? 'Material deleted successfully!')
      queryClient.invalidateQueries({ queryKey: ['teacherMyMaterials'] })
      queryClient.invalidateQueries({ queryKey: ['teacherDashboard'] })
      setDeletingMaterial(null)
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.detail ?? 'Failed to delete material.'
      toast.error(errorMsg)
      setDeletingMaterial(null)
    }
  })

  // ── Drag & Drop Handlers ──────────────────────────────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    validateAndSetFile(file)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    validateAndSetFile(file)
  }

  const validateAndSetFile = (file) => {
    if (!file) return

    // Limit check: 50MB
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File size exceeds the 50MB limit.')
      return
    }

    setSelectedFile(file)
    // Pre-fill title if empty
    if (!title) {
      // Remove file extension for default title suggestion
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      setTitle(nameWithoutExt)
    }
  }

  // ── Submission: Upload File ──────────────────────────────────────────────────
  const handleUploadSubmit = async (e) => {
    e.preventDefault()

    if (!courseId) {
      toast.error('Please select a course.')
      return
    }
    if (!title.trim()) {
      toast.error('Please enter a title.')
      return
    }
    if (!selectedFile) {
      toast.error('Please select or drop a file to upload.')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('course_id', Number(courseId))
    formData.append('title', title.trim())
    formData.append('description', description.trim())
    formData.append('file', selectedFile)

    try {
      await axiosInstance.post('/material', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percent)
        }
      })

      toast.success('Study material uploaded successfully!')
      
      // Reset Form
      setCourseId('')
      setTitle('')
      setDescription('')
      setSelectedFile(null)
      setUploadProgress(0)
      
      // Invalidate Queries
      queryClient.invalidateQueries({ queryKey: ['teacherMyMaterials'] })
      queryClient.invalidateQueries({ queryKey: ['teacherDashboard'] })
    } catch (err) {
      const errorMsg = err.response?.data?.detail ?? 'Upload failed.'
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

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
      
      toast.success('Download ready!', { id: toastId })
    } catch (err) {
      toast.error('Failed to download material.', { id: toastId })
    }
  }

  // Helper formatting for file size
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
    <div className="space-y-8 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Study Materials</h1>
        <p className="text-sm text-text-muted mt-1">Upload files, slide decks, syllabi, or videos for enrolled courses.</p>
      </div>

      {/* Split view: Upload on Left (or top) & Uploaded List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Upload Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card bg-white p-6 space-y-6">
            <h3 className="text-base font-bold text-text-primary">Upload New Material</h3>
            
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Course selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Course / Subject</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="input bg-white font-semibold"
                  disabled={isCoursesLoading || isUploading}
                  required
                >
                  <option value="">-- Choose Course --</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name} ({course.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Material Title</label>
                <input
                  type="text"
                  placeholder="e.g. Lecture 1 Introduction to Programming"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input font-medium"
                  disabled={isUploading}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Description / Note</label>
                <textarea
                  placeholder="Summarize the resource content..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[80px]"
                  disabled={isUploading}
                />
              </div>

              {/* Drag and Drop Zone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Upload File (Max 50MB)</label>
                
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${
                    isDragOver 
                      ? 'border-primary bg-navy-50/20 scale-[1.01]' 
                      : 'border-card-border hover:border-text-muted hover:bg-slate-50/30'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                  />

                  {selectedFile ? (
                    <div className="space-y-2 w-full text-left p-3 border border-navy-100 bg-navy-50/10 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileTypeIcon(selectedFile.name.split('.').pop() ?? '')}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-text-primary truncate">{selectedFile.name}</p>
                          <p className="text-[10px] text-text-muted font-semibold mt-0.5">{formatBytes(selectedFile.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFile(null)
                          setTitle('')
                        }}
                        className="p-1 text-text-muted hover:text-status-red transition-colors flex items-center justify-center rounded-md hover:bg-red-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-lg border border-card-border text-text-muted">
                        📁
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">Drag & drop your study material here</p>
                        <p className="text-[10px] text-text-muted mt-1">or click to browse files</p>
                      </div>
                      <p className="text-[9px] text-text-muted tracking-wider uppercase font-semibold">
                        PDF, DOCX, MP4, PNG, JPG accepted
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-text-secondary">
                    <span>Uploading file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                type="submit"
                disabled={isUploading || isCoursesLoading || !selectedFile || !title}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                {isUploading ? 'Uploading...' : 'Publish Material'}
              </button>
            </form>
          </div>
        </div>

        {/* Uploaded materials grid */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card bg-white p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">My Uploaded Materials</h3>
                <p className="text-xs text-text-muted mt-0.5">List of documents you shared with students.</p>
              </div>
              <span className="text-xs font-bold text-primary bg-navy-50 px-2.5 py-1 rounded-full border border-navy-100">
                {myMaterials.length} Shared
              </span>
            </div>

            {isMaterialsLoading ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs font-semibold">Loading your uploads...</span>
              </div>
            ) : myMaterials.length === 0 ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2 border border-dashed border-card-border rounded-xl bg-slate-50/20">
                <div className="text-2xl">📦</div>
                <h4 className="font-bold text-text-secondary text-sm">No materials uploaded yet</h4>
                <p className="text-xs max-w-xs mt-1">Use the upload panel on the left to start publishing study files.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myMaterials.map((mat) => {
                  return (
                    <div 
                      key={mat.id}
                      className="p-4 rounded-xl border border-card-border bg-white hover:border-primary-hover hover:shadow-card transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        {/* Upper info */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getFileTypeIcon(mat.file_type)}
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-text-primary truncate" title={mat.title}>
                                {mat.title}
                              </h4>
                              <p className="text-[10px] text-text-muted font-medium mt-0.5">
                                {mat.course?.name ?? 'Course ID: ' + mat.course_id}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setDeletingMaterial(mat)}
                            className="p-1 text-text-muted hover:text-status-red rounded-md hover:bg-red-50 transition-colors"
                            title="Delete resource"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {/* Description */}
                        {mat.description && (
                          <p className="text-[11px] text-text-secondary mt-3 line-clamp-2 leading-relaxed bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                            {mat.description}
                          </p>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-card-border/60 flex items-center justify-between">
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
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingMaterial}
        onClose={() => setDeletingMaterial(null)}
        onConfirm={() => deleteMaterialMutation.mutate(deletingMaterial.id)}
        title="Delete Study Material"
        message={`Are you sure you want to permanently delete the study material resource '${deletingMaterial?.title}'? This will remove the file from storage and cannot be undone.`}
        confirmLabel="Delete permanently"
        danger
        loading={deleteMaterialMutation.isPending}
      />
    </div>
  )
}
