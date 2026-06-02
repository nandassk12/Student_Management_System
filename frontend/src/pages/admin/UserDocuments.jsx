import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { getAdminUserProfile, getAdminUserDocuments, downloadAdminUserDocument } from '@api/axios.js'
import Table from '@components/Table.jsx'

export default function AdminUserDocuments() {
  const { user_id } = useParams()
  const navigate = useNavigate()

  // ── Query: Fetch User Profile ───────────────────────────────────────────────
  const { data: profile, isLoading: isProfileLoading, error: profileError } = useQuery({
    queryKey: ['adminUserProfile', user_id],
    queryFn: async () => {
      const { data } = await getAdminUserProfile(user_id)
      return data
    },
    enabled: !!user_id,
  })

  // ── Query: Fetch User Documents ─────────────────────────────────────────────
  const { data: documents = [], isLoading: isDocsLoading, error: docsError } = useQuery({
    queryKey: ['adminUserDocuments', user_id],
    queryFn: async () => {
      const { data } = await getAdminUserDocuments(user_id)
      return data
    },
    enabled: !!user_id,
  })

  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // ── Preview Document Handler ───────────────────────────────────────────────
  const handlePreview = async (docId, fileName) => {
    const toastId = toast.loading('Preparing preview...')
    try {
      const response = await downloadAdminUserDocument(user_id, docId)
      const blob = new Blob([response.data], { type: response.data.type || 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      toast.success('Preview loaded in new tab!', { id: toastId })
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 15000)
    } catch (err) {
      console.error(err)
      toast.error('Failed to preview document.', { id: toastId })
    }
  }

  // ── Download Document Handler ───────────────────────────────────────────────
  const handleDownload = async (docId, fileName) => {
    const toastId = toast.loading(`Requesting ${fileName}...`)
    try {
      const response = await downloadAdminUserDocument(user_id, docId)
      
      // Parse content-disposition header if available
      const disposition = response.headers?.['content-disposition']
      let name = fileName
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) {
          name = match[1]
        }
      }

      // Convert response data (blob) into a URL and trigger download
      const blob = new Blob([response.data], { type: response.data.type || 'application/octet-stream' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', name)
      document.body.appendChild(link)
      link.click()

      // Cleanup
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Download completed!', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Failed to download document.', { id: toastId })
    }
  }

  const getFileUrl = (path) => {
    if (!path) return null
    const apiURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    return `${apiURL}/${path}`
  }

  // Resolve user display name
  const displayName = profile
    ? profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.user?.username
    : 'User Profile'

  const userRole = profile?.user?.role?.name || ''
  const isStudent = userRole.toLowerCase() === 'student'

  // Table Columns Setup
  const columns = [
    {
      key: 'doc_type',
      label: 'Document Type',
      sortable: true,
      render: (val) => (
        <span className="font-bold text-text-primary uppercase tracking-wider text-[11px] bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
          {(val || '').replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'file_name',
      label: 'File Name',
      sortable: true,
      render: (val) => <span className="font-mono text-xs font-semibold text-text-secondary">{val}</span>,
    },
    {
      key: 'uploaded_at',
      label: 'Uploaded At',
      sortable: true,
      render: (val) => (
        <span className="text-xs text-text-muted font-medium">
          {val ? new Date(val).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => handlePreview(row.id, row.file_name)}
            className="btn-secondary py-1 px-3 text-xs flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            Preview
          </button>
          <button
            onClick={() => handleDownload(row.id, row.file_name)}
            className="btn-primary py-1 px-3 text-xs flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download
          </button>
        </div>
      ),
    },
  ]

  const isLoading = isProfileLoading || isDocsLoading

  if (isLoading) {
    return (
      <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-3 min-h-[50vh]">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="text-sm font-semibold">Loading documents vault...</span>
      </div>
    )
  }

  if (profileError || docsError) {
    return (
      <div className="p-12 text-center card bg-white text-status-red font-semibold max-w-lg mx-auto mt-10">
        Error loading documents vault: {profileError?.message || docsError?.message}
      </div>
    )
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header and Back Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 border border-card-border hover:bg-slate-50 rounded-xl transition-all active:scale-95 text-text-secondary bg-white flex items-center justify-center"
          title="Back to directory"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Document Vault</h1>
          <p className="text-sm text-text-muted mt-1">Review official identity proofs and verification documents.</p>
        </div>
      </div>

      {/* User Information Header Card */}
      <div className="card bg-white p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-[#e2e8f0]">
        <div className="flex flex-col sm:flex-row items-center gap-5 w-full md:w-auto">
          {/* Avatar block */}
          {profile?.profile_photo ? (
            <img
              src={getFileUrl(profile.profile_photo)}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 shadow-sm"
              onError={(e) => {
                // Fallback to initials if image fails to load
                e.target.style.display = 'none'
                const parent = e.target.parentElement
                const fallback = parent.querySelector('.avatar-fallback')
                if (fallback) fallback.style.display = 'flex'
              }}
            />
          ) : null}
          <div
            className="avatar-fallback w-20 h-20 rounded-full bg-gradient-to-tr from-[#1e3a5f]/20 to-[#1e3a5f]/5 text-[#1e3a5f] border-2 border-[#1e3a5f]/20 flex items-center justify-center text-2xl font-extrabold shadow-inner"
            style={{ display: profile?.profile_photo ? 'none' : 'flex' }}
          >
            {(displayName || '??').substring(0, 2).toUpperCase()}
          </div>

          <div className="text-center sm:text-left space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-lg font-extrabold text-text-primary">{displayName}</h2>
              <span className={`inline-block px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider border self-center ${
                isStudent ? 'bg-green-50 border-green-200 text-status-green' : 'bg-blue-50 border-blue-200 text-primary'
              }`}>
                {userRole || 'User'}
              </span>
            </div>
            <p className="text-xs text-text-muted font-medium flex items-center gap-1.5 justify-center sm:justify-start">
              <span>@{profile?.user?.username}</span>
              <span className="text-slate-300">•</span>
              <span>{profile?.user?.email}</span>
            </p>
            {isStudent && profile?.roll_number && (
              <p className="text-[11px] font-bold text-text-secondary tracking-wide bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 inline-block">
                ROLL NO: {profile.roll_number}
              </p>
            )}
            {!isStudent && profile?.employee_id && (
              <p className="text-[11px] font-bold text-text-secondary tracking-wide bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 inline-block">
                EMPLOYEE ID: {profile.employee_id}
              </p>
            )}
          </div>
        </div>

        {/* Completion & Edit stats */}
        <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Profile Completion</span>
            <span className={`text-sm font-black px-2.5 py-0.5 rounded-full ${
              (profile?.profile_completed_pct || 0) >= 80 ? 'bg-green-50 text-status-green' : (profile?.profile_completed_pct || 0) >= 50 ? 'bg-amber-50 text-status-amber' : 'bg-red-50 text-status-red'
            }`}>
              {profile?.profile_completed_pct || 0}%
            </span>
          </div>
          <div className="w-40 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full rounded-full transition-all duration-550 ${
                (profile?.profile_completed_pct || 0) >= 80 ? 'bg-status-green' : (profile?.profile_completed_pct || 0) >= 50 ? 'bg-status-amber' : 'bg-status-red'
              }`}
              style={{ width: `${profile?.profile_completed_pct || 0}%` }}
            />
          </div>
          {profile?.last_edited_at && (
            <span className="text-[10px] text-text-muted font-medium mt-1">
              Last updated: {new Date(profile.last_edited_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </span>
          )}
        </div>
      </div>

      {/* Documents Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-text-primary">Submitted Documents ({documents.length})</h3>
        </div>

        <Table
          columns={columns}
          data={documents}
          loading={false}
          searchKeys={['doc_type', 'file_name']}
          emptyMessage="No documents have been uploaded by this user yet."
        />
      </div>
    </div>
  )
}
