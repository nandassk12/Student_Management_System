import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import {
  changePassword,
  deleteTeacherDocument,
  downloadTeacherDocumentSelf,
  getTeacherDocuments,
  getTeacherProfile,
  updateTeacherProfile,
  uploadTeacherDocument,
  uploadTeacherPhoto,
  uploadTeacherSignature
} from '@api/axios.js'

export default function TeacherProfile() {
  const queryClient = useQueryClient()

  // ── Query: Fetch Profile ────────────────────────────────────────────────────
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['teacherProfileSelf'],
    queryFn: async () => {
      const { data } = await getTeacherProfile()
      return data
    }
  })

  // ── Query: Fetch Documents ──────────────────────────────────────────────────
  const { data: documents = [], isLoading: isDocsLoading } = useQuery({
    queryKey: ['teacherDocumentsSelf'],
    queryFn: async () => {
      const { data } = await getTeacherDocuments()
      return data
    }
  })

  // ── Form States ─────────────────────────────────────────────────────────────
  // Section 1: Basic Identity
  const [identityForm, setIdentityForm] = useState({
    full_name: '',
    gender: '',
    date_of_birth: '',
    highest_qualification: '',
    phone: '',
    alternate_phone: ''
  })

  // Section 2: Contact Details
  const [contactForm, setContactForm] = useState({
    personal_email: '',
    current_address: '',
    permanent_address: '',
    emergency_contact_name: '',
    emergency_contact_rel: '',
    emergency_contact_phone: ''
  })
  const [sameAddress, setSameAddress] = useState(false)

  // Section 3: Bank Details
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_number: '',
    ifsc_code: ''
  })

  // Section 5: Security / Password
  const [securityForm, setSecurityForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Accordion state for Section 4 (Document Vault)
  const [openAccordion, setOpenAccordion] = useState(null)

  // Upload refs
  const photoInputRef = useRef(null)
  const signatureInputRef = useRef(null)

  // ── Initialize form states from profile data ────────────────────────────────
  useEffect(() => {
    if (profile) {
      setIdentityForm({
        full_name: profile.full_name || '',
        gender: profile.gender || '',
        date_of_birth: profile.date_of_birth || null,
        highest_qualification: profile.highest_qualification || '',
        phone: profile.phone || '',
        alternate_phone: profile.alternate_phone || ''
      })

      setContactForm({
        personal_email: profile.personal_email || '',
        current_address: profile.current_address || '',
        permanent_address: profile.permanent_address || '',
        emergency_contact_name: profile.emergency_contact_name || '',
        emergency_contact_rel: profile.emergency_contact_rel || '',
        emergency_contact_phone: profile.emergency_contact_phone || ''
      })

      if (profile.current_address && profile.current_address === profile.permanent_address) {
        setSameAddress(true)
      } else {
        setSameAddress(false)
      }

      setBankForm({
        bank_name: profile.bank_name || '',
        account_number: profile.account_number || '',
        ifsc_code: profile.ifsc_code || ''
      })
    }
  }, [profile])

  // Address sync
  useEffect(() => {
    if (sameAddress) {
      setContactForm(prev => ({
        ...prev,
        permanent_address: prev.current_address
      }))
    }
  }, [sameAddress, contactForm.current_address])

  // ── Section Save Handlers ───────────────────────────────────────────────────
  // Strip empty strings to null so Pydantic date fields don't get a "" value
  const sanitizePayload = (obj) =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v])
    )

  const saveIdentity = async (e) => {
    e.preventDefault()
    const toastId = toast.loading('Saving identity info...')
    try {
      const { data } = await updateTeacherProfile(sanitizePayload(identityForm))
      queryClient.setQueryData(['teacherProfileSelf'], data)
      toast.success('Identity info updated!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save identity info.', { id: toastId })
    }
  }

  const saveContact = async (e) => {
    e.preventDefault()
    const toastId = toast.loading('Saving contact info...')
    try {
      const payload = { ...contactForm }
      if (sameAddress) {
        payload.permanent_address = payload.current_address
      }
      const { data } = await updateTeacherProfile(sanitizePayload(payload))
      queryClient.setQueryData(['teacherProfileSelf'], data)
      toast.success('Contact info updated!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save contact info.', { id: toastId })
    }
  }

  const saveBank = async (e) => {
    e.preventDefault()
    const toastId = toast.loading('Saving bank details...')
    try {
      const { data } = await updateTeacherProfile(sanitizePayload(bankForm))
      queryClient.setQueryData(['teacherProfileSelf'], data)
      toast.success('Bank details updated!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save bank details.', { id: toastId })
    }
  }

  // ── Media Uploads ───────────────────────────────────────────────────────────
  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    const toastId = toast.loading('Uploading profile photo...')
    try {
      const { data } = await uploadTeacherPhoto(formData)
      queryClient.setQueryData(['teacherProfileSelf'], data)
      toast.success('Profile photo updated!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload photo.', { id: toastId })
    }
  }

  const handleSignatureSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    const toastId = toast.loading('Uploading signature...')
    try {
      const { data } = await uploadTeacherSignature(formData)
      queryClient.setQueryData(['teacherProfileSelf'], data)
      toast.success('Signature uploaded successfully!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload signature.', { id: toastId })
    }
  }

  // ── Document Vault Operations ───────────────────────────────────────────────
  const uploadDoc = async (docType, file) => {
    if (!file) return
    const formData = new FormData()
    formData.append('doc_type', docType)
    formData.append('file', file)
    const toastId = toast.loading(`Uploading ${docType.replace('_', ' ')}...`)
    try {
      await uploadTeacherDocument(formData)
      queryClient.invalidateQueries({ queryKey: ['teacherDocumentsSelf'] })
      queryClient.invalidateQueries({ queryKey: ['teacherProfileSelf'] })
      toast.success('Document uploaded successfully!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload document.', { id: toastId })
    }
  }

  const deleteDoc = async (docId) => {
    const toastId = toast.loading('Deleting document...')
    try {
      await deleteTeacherDocument(docId)
      queryClient.invalidateQueries({ queryKey: ['teacherDocumentsSelf'] })
      queryClient.invalidateQueries({ queryKey: ['teacherProfileSelf'] })
      toast.success('Document deleted.', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete document.', { id: toastId })
    }
  }

  const handlePreview = async (docId, fileName) => {
    const toastId = toast.loading('Preparing preview...')
    try {
      const response = await downloadTeacherDocumentSelf(docId)
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

  const handleDownload = async (docId, fileName) => {
    const toastId = toast.loading(`Downloading ${fileName}...`)
    try {
      const response = await downloadTeacherDocumentSelf(docId)
      const disposition = response.headers?.['content-disposition']
      let name = fileName
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) {
          name = match[1]
        }
      }
      const blob = new Blob([response.data], { type: response.data.type || 'application/octet-stream' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', name)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Download completed!', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Failed to download document.', { id: toastId })
    }
  }

  // ── Password Change & Strength ──────────────────────────────────────────────
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (securityForm.new_password !== securityForm.confirm_password) {
      toast.error('Passwords do not match!')
      return
    }
    const toastId = toast.loading('Updating security credentials...')
    try {
      await changePassword({
        current_password: securityForm.current_password,
        new_password: securityForm.new_password
      })
      toast.success('Password changed successfully!', { id: toastId })
      setSecurityForm({ current_password: '', new_password: '', confirm_password: '' })
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password.', { id: toastId })
    }
  }

  const getPasswordStrength = (pw) => {
    if (!pw) return 0
    let score = 0
    if (pw.length >= 8) score += 1
    if (/[A-Z]/.test(pw)) score += 1
    if (/[0-9]/.test(pw)) score += 1
    if (/[^A-Za-z0-9]/.test(pw)) score += 1
    return score
  }

  const pwStrength = getPasswordStrength(securityForm.new_password)
  const strengthLabels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = ['bg-slate-200', 'bg-status-red', 'bg-status-amber', 'bg-blue-400', 'bg-status-green']

  const getFileUrl = (path) => {
    if (!path) return null
    const apiURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    return `${apiURL}/${path}`
  }

  // ── Document Vault Configurations ───────────────────────────────────────────
  const docVaultTypes = [
    { key: 'aadhaar', label: 'Aadhaar Card' },
    { key: 'pan', label: 'PAN Card' },
    { key: 'teaching_license', label: 'Teaching License' },
    { key: 'experience_letter', label: 'Experience Letter' },
    { key: 'resume', label: 'Resume' }
  ]

  if (isLoading) {
    return (
      <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-3 min-h-[50vh]">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="text-sm font-semibold">Loading profile information...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center card bg-white text-status-red font-semibold max-w-lg mx-auto mt-10">
        Error loading profile: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-8 page-enter max-w-4xl pb-16">
      {/* Header Info */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Faculty Profile</h1>
        <p className="text-sm text-text-muted mt-1">Manage credentials, identity details, bank details, and verification documents.</p>
      </div>

      {/* ── CARD: Profile Overview & Header ── */}
      <div className="card bg-white p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-[#e2e8f0]">
        <div className="flex flex-col sm:flex-row items-center gap-5 w-full md:w-auto">
          {/* Circular Photo with Edit Trigger */}
          <div className="relative group cursor-pointer" onClick={() => photoInputRef.current?.click()}>
            {profile?.profile_photo ? (
              <img
                src={getFileUrl(profile.profile_photo)}
                alt="Profile Photo"
                className="w-24 h-24 rounded-full object-cover border-2 border-primary/20 shadow-md group-hover:opacity-75 transition-all"
                onError={(e) => {
                  e.target.style.display = 'none'
                  const parent = e.target.parentElement
                  const fallback = parent.querySelector('.avatar-fallback')
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className="avatar-fallback w-24 h-24 rounded-full bg-gradient-to-tr from-[#1e3a5f]/20 to-[#1e3a5f]/5 text-[#1e3a5f] border-2 border-[#1e3a5f]/20 flex items-center justify-center text-3xl font-extrabold shadow-inner group-hover:opacity-75 transition-all"
              style={{ display: profile?.profile_photo ? 'none' : 'flex' }}
            >
              {(profile?.full_name || profile?.user?.username || '??').substring(0, 2).toUpperCase()}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] text-white font-bold uppercase tracking-wider">Change</span>
            </div>
            <input
              type="file"
              ref={photoInputRef}
              onChange={handlePhotoSelect}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="text-center sm:text-left space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-xl font-extrabold text-text-primary">{profile?.full_name || profile?.user?.username}</h2>
              <span className="inline-block px-2.5 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider bg-blue-50 border border-blue-200 text-primary self-center">
                {profile?.user?.role?.name || 'Teacher'}
              </span>
            </div>
            <p className="text-xs text-text-muted font-semibold">
              @{profile?.user?.username} • {profile?.user?.email}
            </p>
            {profile?.designation && (
              <p className="text-xs font-bold text-text-secondary">
                {profile.designation} {profile.department ? `(${profile.department.name})` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Profile Completion Bar */}
        <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Completeness</span>
            <span className={`text-sm font-black px-2.5 py-0.5 rounded-full ${(profile?.profile_completed_pct || 0) >= 80 ? 'bg-green-50 text-status-green' : (profile?.profile_completed_pct || 0) >= 50 ? 'bg-amber-50 text-status-amber' : 'bg-red-50 text-status-red'
              }`}>
              {profile?.profile_completed_pct || 0}%
            </span>
          </div>
          <div className="w-48 bg-slate-100 h-2 rounded-full overflow-hidden mt-1 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-550 ${(profile?.profile_completed_pct || 0) >= 80 ? 'bg-status-green' : (profile?.profile_completed_pct || 0) >= 50 ? 'bg-status-amber' : 'bg-status-red'
                }`}
              style={{ width: `${profile?.profile_completed_pct || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 1: IDENTITY & BASIC DETAILS ── */}
      <div className="card bg-white p-6 space-y-6 border-[#e2e8f0]">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-text-primary">Identity & Basic Details</h3>
          <p className="text-xs text-text-muted mt-0.5">Primary academic information and official identity metrics.</p>
        </div>

        <form onSubmit={saveIdentity} className="space-y-6">
          {/* Read-Only Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Employee ID</span>
              <p className="text-sm font-semibold text-text-primary">{profile?.employee_id || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Designation</span>
              <p className="text-sm font-semibold text-text-primary">{profile?.designation || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Department</span>
              <p className="text-sm font-semibold text-text-primary">{profile?.department?.name || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Employment Type</span>
              <p className="text-sm font-semibold text-text-primary uppercase">{profile?.employment_type || '—'}</p>
            </div>
          </div>

          {/* Editable Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                value={identityForm.full_name}
                onChange={(e) => setIdentityForm({ ...identityForm, full_name: e.target.value })}
                className="input font-medium"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Gender</label>
              <select
                value={identityForm.gender}
                onChange={(e) => setIdentityForm({ ...identityForm, gender: e.target.value })}
                className="input bg-white font-medium"
              >
                <option value="">-- Select Gender --</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Date of Birth</label>
              <input
                type="date"
                value={identityForm.date_of_birth}
                onChange={(e) => setIdentityForm({ ...identityForm, date_of_birth: e.target.value })}
                className="input font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Highest Qualification</label>
              <input
                type="text"
                value={identityForm.highest_qualification}
                placeholder="e.g. Ph.D. in Computer Science"
                onChange={(e) => setIdentityForm({ ...identityForm, highest_qualification: e.target.value })}
                className="input font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Phone</label>
              <input
                type="text"
                value={identityForm.phone}
                onChange={(e) => setIdentityForm({ ...identityForm, phone: e.target.value })}
                className="input font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Alternate Phone</label>
              <input
                type="text"
                value={identityForm.alternate_phone}
                onChange={(e) => setIdentityForm({ ...identityForm, alternate_phone: e.target.value })}
                className="input font-medium"
              />
            </div>
          </div>

          {/* Signature Upload & Preview Block */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Official Signature</span>
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="w-full sm:w-48 h-20 border border-card-border bg-white rounded-lg flex items-center justify-center overflow-hidden shadow-inner relative">
                {profile?.signature ? (
                  <img
                    src={getFileUrl(profile.signature)}
                    alt="Signature preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-text-muted font-bold tracking-wide uppercase">No signature uploaded</span>
                )}
              </div>
              <div className="flex-1 space-y-1 text-center sm:text-left">
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  className="btn-secondary py-1.5 px-4 text-xs font-bold"
                >
                  {profile?.signature ? 'Upload New Signature' : 'Upload Signature'}
                </button>
                <p className="text-[10px] text-text-muted font-semibold mt-1">Acceptable types: PNG, JPG (transparent recommended, max 2MB)</p>
                <input
                  type="file"
                  ref={signatureInputRef}
                  onChange={handleSignatureSelect}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary">
              Save Identity Info
            </button>
          </div>
        </form>
      </div>

      {/* ── SECTION 2: CONTACT INFORMATION ── */}
      <div className="card bg-white p-6 space-y-6 border-[#e2e8f0]">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-text-primary">Contact Info & Family</h3>
          <p className="text-xs text-text-muted mt-0.5">Configure address parameters and emergency coordination points.</p>
        </div>

        <form onSubmit={saveContact} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Personal Email</label>
            <input
              type="email"
              value={contactForm.personal_email}
              onChange={(e) => setContactForm({ ...contactForm, personal_email: e.target.value })}
              className="input font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Current Address</label>
              <textarea
                value={contactForm.current_address}
                onChange={(e) => setContactForm({ ...contactForm, current_address: e.target.value })}
                className="input min-h-[100px] leading-relaxed"
                placeholder="Current residence details..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Permanent Address</label>
                <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer font-bold select-none">
                  <input
                    type="checkbox"
                    checked={sameAddress}
                    onChange={(e) => setSameAddress(e.target.checked)}
                    className="rounded text-primary border-slate-300 focus:ring-primary w-3.5 h-3.5"
                  />
                  <span>Same as Current</span>
                </label>
              </div>
              <textarea
                value={sameAddress ? contactForm.current_address : contactForm.permanent_address}
                onChange={(e) => setContactForm({ ...contactForm, permanent_address: e.target.value })}
                disabled={sameAddress}
                className="input min-h-[100px] leading-relaxed disabled:bg-slate-50 disabled:text-text-muted"
                placeholder="Permanent residence details..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Emergency Contact Coordinate</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase">Contact Name</label>
                <input
                  type="text"
                  value={contactForm.emergency_contact_name}
                  onChange={(e) => setContactForm({ ...contactForm, emergency_contact_name: e.target.value })}
                  className="input py-1.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase">Relationship</label>
                <input
                  type="text"
                  value={contactForm.emergency_contact_rel}
                  onChange={(e) => setContactForm({ ...contactForm, emergency_contact_rel: e.target.value })}
                  className="input py-1.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase">Phone Number</label>
                <input
                  type="text"
                  value={contactForm.emergency_contact_phone}
                  onChange={(e) => setContactForm({ ...contactForm, emergency_contact_phone: e.target.value })}
                  className="input py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary">
              Save Contact Details
            </button>
          </div>
        </form>
      </div>

      {/* ── SECTION 3: BANK DETAILS ── */}
      <div className="card bg-white p-6 space-y-6 border-[#e2e8f0]">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-text-primary">Bank Account Configuration</h3>
          <p className="text-xs text-text-muted mt-0.5">Required for salary disbursements and financial records.</p>
        </div>

        <form onSubmit={saveBank} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Bank Name</label>
            <input
              type="text"
              value={bankForm.bank_name}
              onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
              className="input font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Account Number</label>
            <input
              type="text"
              value={bankForm.account_number}
              onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
              className="input font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">IFSC Code</label>
            <input
              type="text"
              value={bankForm.ifsc_code}
              onChange={(e) => setBankForm({ ...bankForm, ifsc_code: e.target.value })}
              className="input font-medium"
            />
          </div>

          <div className="col-span-1 md:col-span-3 flex justify-end pt-4">
            <button type="submit" className="btn-primary">
              Save Bank Details
            </button>
          </div>
        </form>
      </div>

      {/* ── SECTION 4: DOCUMENT VAULT ACCORDION ── */}
      <div className="card bg-white p-6 space-y-6 border-[#e2e8f0]">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-text-primary">Document Vault</h3>
          <p className="text-xs text-text-muted mt-0.5">Official compliance files and verification documentation status.</p>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
          {docVaultTypes.map((type) => {
            const uploadedDoc = documents.find(d => d.doc_type.toLowerCase() === type.key)
            const isOpen = openAccordion === type.key

            return (
              <div key={type.key} className="transition-all duration-200">
                {/* Accordion Trigger */}
                <button
                  type="button"
                  onClick={() => setOpenAccordion(isOpen ? null : type.key)}
                  className="w-full flex items-center justify-between p-4 text-left font-semibold text-sm hover:bg-slate-50 transition-colors focus-visible:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${uploadedDoc ? 'bg-status-green animate-pulse' : 'bg-status-amber'}`} />
                    <span className="text-text-primary text-xs font-bold uppercase tracking-wider">{type.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {uploadedDoc ? (
                      <span className="text-[10px] font-black text-status-green bg-green-50 px-2 py-0.5 rounded border border-green-200 uppercase tracking-wider">
                        Submitted
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-status-amber bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
                        Pending
                      </span>
                    )}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Accordion Content */}
                {isOpen && (
                  <div className="p-4 bg-slate-50/50 border-t border-slate-100 space-y-4">
                    {uploadedDoc ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 border border-green-100 bg-green-50/5 rounded-lg">
                        <div className="min-w-0 flex items-center gap-3">
                          <span className="text-2xl">📄</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-text-primary truncate">{uploadedDoc.file_name}</p>
                            <p className="text-[10px] text-text-muted font-semibold mt-0.5">
                              Submitted: {new Date(uploadedDoc.uploaded_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => handlePreview(uploadedDoc.id, uploadedDoc.file_name)}
                            className="btn-secondary py-1 px-3 text-xs flex items-center justify-center gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(uploadedDoc.id, uploadedDoc.file_name)}
                            className="btn-primary py-1 px-3 text-xs flex items-center justify-center gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDoc(uploadedDoc.id)}
                            className="btn-danger py-1 px-3 text-xs flex items-center justify-center gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 cursor-pointer relative">
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => uploadDoc(type.key, e.target.files[0])}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="space-y-2">
                          <span className="text-2xl text-slate-400 block">📤</span>
                          <p className="text-xs font-bold text-text-primary">Click to upload or drag & drop {type.label}</p>
                          <p className="text-[9px] text-text-muted uppercase font-semibold">Accepts PDF, PNG, JPEG (Max 10MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── SECTION 5: SECURITY / PASSWORD CHANGE ── */}
      <div className="card bg-white p-6 space-y-6 border-[#e2e8f0]">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-text-primary">Security & Authentication</h3>
          <p className="text-xs text-text-muted mt-0.5">Manage credentials and authentication parameters.</p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Current Password</label>
            <div className="flex items-center gap-2">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={securityForm.current_password}
                onChange={(e) => setSecurityForm({ ...securityForm, current_password: e.target.value })}
                className="input font-medium flex-1"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="flex-shrink-0 p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus-visible:outline-none"
              >
                {showCurrentPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">New Password</label>
              <div className="flex items-center gap-2">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={securityForm.new_password}
                  onChange={(e) => setSecurityForm({ ...securityForm, new_password: e.target.value })}
                  className="input font-medium flex-1"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="flex-shrink-0 p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus-visible:outline-none"
                >
                  {showNewPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Strength Indicator */}
              {securityForm.new_password && (
                <div className="space-y-1.5 mt-2">
                  <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase">
                    <span>Password Strength:</span>
                    <span className="font-extrabold">{strengthLabels[pwStrength]}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 h-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full rounded-full transition-colors ${pwStrength >= step ? strengthColors[pwStrength] : 'bg-slate-200'
                          }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={securityForm.confirm_password}
                  onChange={(e) => setSecurityForm({ ...securityForm, confirm_password: e.target.value })}
                  className="input font-medium pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none"
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" className="btn-primary">
              Update Password
            </button>
          </div>
        </form>
      </div>

      {/* Footer Info */}
      {profile?.last_edited_at && (
        <p className="text-right text-[10px] text-text-muted font-bold uppercase tracking-wider">
          Last profile edit was at: {new Date(profile.last_edited_at).toLocaleString()}
        </p>
      )}
    </div>
  )
}
