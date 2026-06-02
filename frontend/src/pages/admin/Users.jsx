import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import Table from '@components/Table.jsx'
import Modal, { ConfirmModal } from '@components/Modal.jsx'
import StatusBadge, { ActiveBadge, RoleBadge } from '@components/StatusBadge.jsx'
import { useAuth } from '@context/AuthContext.jsx'

// Roles matching seeded database
const ROLES = [
  { id: 1, name: 'admin', label: 'Admin' },
  { id: 2, name: 'teacher', label: 'Teacher' },
  { id: 3, name: 'student', label: 'Student' }
]

export default function AdminUsers() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()

  // States
  const [roleFilter, setRoleFilter] = useState('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deactivatingUser, setDeactivatingUser] = useState(null)

  // CSV Import States
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  // React Hook Form for Create/Edit
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate }
  } = useForm({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      role_id: 3 // Default to Student
    }
  })

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setValueEdit,
    formState: { errors: errorsEdit, isSubmitting: isSubmittingEdit }
  } = useForm()

  // ── Query: List Users ────────────────────────────────────────────────────────
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users', roleFilter],
    queryFn: async () => {
      const params = { limit: 100 }
      if (roleFilter !== 'all') {
        params.role = roleFilter
      }
      const { data } = await axiosInstance.get('/users', { params })
      return data
    }
  })

  // ── Mutation: Create User ───────────────────────────────────────────────────
  const createUserMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/users', payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(`User '${data.username}' created successfully!`)
      setIsCreateOpen(false)
      resetCreate()
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to create user.'
      toast.error(typeof detail === 'string' ? detail : 'Username/Email already exists.')
    }
  })

  // ── Mutation: Update User ───────────────────────────────────────────────────
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await axiosInstance.put(`/users/${id}`, payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(`User '${data.username}' updated successfully!`)
      setEditingUser(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to update user.'
      toast.error(typeof detail === 'string' ? detail : 'Username/Email duplicate conflict.')
    }
  })

  // ── Mutation: Deactivate User ───────────────────────────────────────────────
  const deactivateUserMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/users/${id}`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(data.detail ?? 'User deactivated successfully!')
      setDeactivatingUser(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to deactivate user.'
      toast.error(detail)
    }
  })

  // Handlers
  const onCreateSubmit = (data) => {
    createUserMutation.mutate({
      username: data.username,
      email: data.email,
      password: data.password,
      role_id: Number(data.role_id)
    })
  }

  const onEditClick = (user) => {
    setEditingUser(user)
    resetEdit({
      username: user.username,
      email: user.email,
      password: '',
      role_id: user.role.id,
      is_active: user.is_active
    })
  }

  const onEditSubmit = (data) => {
    const payload = {
      username: data.username,
      email: data.email,
      role_id: Number(data.role_id),
      is_active: data.is_active
    }
    // Only send password if user inputted a new one
    if (data.password && data.password.trim().length >= 6) {
      payload.password = data.password
    }
    updateUserMutation.mutate({ id: editingUser.id, payload })
  }

  const handleDeactivate = () => {
    deactivateUserMutation.mutate(deactivatingUser.id)
  }

  const handleImportSubmit = async (e) => {
    e.preventDefault()
    if (!importFile) {
      toast.error('Please select a CSV file first.')
      return
    }

    setIsImporting(true)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', importFile)

    try {
      const { data } = await axiosInstance.post(`/users/import`, formData, {
        params: { role: roleFilter },
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      setImportResult(data)
      if (data.created > 0) {
        queryClient.invalidateQueries({ queryKey: ['users'] })
        toast.success(`Successfully imported ${data.created} ${roleFilter}s!`)
      } else {
        toast.error('No new users were imported.')
      }
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Failed to import CSV file.'
      toast.error(typeof detail === 'string' ? detail : 'Invalid CSV structure or values.')
    } finally {
      setIsImporting(false)
    }
  }

  // Columns for the users table
  const columns = [
    { key: 'id', label: 'ID', sortable: true, width: '80px', muted: true },
    { key: 'username', label: 'Username', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (role) => <RoleBadge role={role?.name} />
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: (is_active) => <ActiveBadge active={is_active} />
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => {
        const isSelf = row.id === currentUser?.id
        const hasDocs = row.role?.name && (row.role.name.toLowerCase() === 'student' || row.role.name.toLowerCase() === 'teacher')
        return (
          <div className="flex gap-2 justify-end">
            {hasDocs && (
              <Link
                to={`/admin/users/${row.id}/documents`}
                className="btn-secondary py-1 px-3 text-xs flex items-center gap-1"
                title="View compliance documents"
              >
                View Documents
              </Link>
            )}
            <button
              onClick={() => onEditClick(row)}
              className="btn-secondary py-1 px-3 text-xs flex items-center gap-1"
            >
              Edit
            </button>
            <button
              onClick={() => setDeactivatingUser(row)}
              className="btn-danger py-1 px-3 text-xs"
              disabled={isSelf || !row.is_active}
              title={isSelf ? 'Cannot deactivate yourself' : !row.is_active ? 'Already deactivated' : 'Deactivate user'}
            >
              Deactivate
            </button>
          </div>
        )
      }
    }
  ]

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">User Management</h1>
          <p className="text-sm text-text-muted mt-1">Create, update, and manage portal accounts and security roles.</p>
        </div>

        <div className="flex items-center gap-2">
          {(roleFilter === 'student' || roleFilter === 'teacher') && (
            <button
              onClick={() => {
                setImportFile(null)
                setImportResult(null)
                setIsImportOpen(true)
              }}
              className="btn-primary py-1.5 px-3.5 text-xs flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import CSV
            </button>
          )}

          <button
            onClick={() => {
              setIsCreateOpen(true)
              resetCreate()
            }}
            className="btn-primary py-1.5 px-3.5 text-xs flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>
      </div>

      {/* Role Filter Toolbar */}
      <div className="flex items-center gap-4 p-4 card bg-white">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Filter by Role:</label>
        <div className="flex gap-2">
          {[{ id: 'all', label: 'All Users' }, ...ROLES].map((role) => (
            <button
              key={role.id}
              onClick={() => setRoleFilter(role.name || role.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                roleFilter === (role.name || role.id)
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-50 text-text-secondary hover:bg-slate-100'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      {error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading user list: {error.message}
        </div>
      ) : (
        <Table
          columns={columns}
          data={users}
          loading={isLoading}
          searchKeys={['username', 'email']}
          emptyMessage="No accounts found."
        />
      )}

      {/* ── CREATE USER MODAL ── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New User Account"
        description="Create a new credential and assign a system security role."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="btn-secondary"
              disabled={isSubmittingCreate}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-user-form"
              className="btn-primary"
              disabled={isSubmittingCreate}
            >
              {isSubmittingCreate ? 'Saving...' : 'Create Account'}
            </button>
          </>
        }
      >
        <form
          id="create-user-form"
          onSubmit={handleSubmitCreate(onCreateSubmit)}
          className="space-y-4"
        >
          {/* Username */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Username</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. johndoe"
              {...registerCreate('username', {
                required: 'Username is required',
                pattern: {
                  value: /^[a-zA-Z0-9_]+$/,
                  message: 'Username must not contain spaces or special characters (letters, numbers, underscore only)'
                }
              })}
            />
            {errorsCreate.username && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.username.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="e.g. johndoe@sms.edu"
              {...registerCreate('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
            />
            {errorsCreate.email && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Initial Password</label>
            <input
              type="password"
              className="input"
              placeholder="Minimum 6 characters"
              {...registerCreate('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters'
                }
              })}
            />
            {errorsCreate.password && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.password.message}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Security Role</label>
            <select
              className="input bg-white"
              {...registerCreate('role_id', { required: true })}
            >
              {ROLES.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* ── EDIT USER MODAL ── */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User Account"
        description={`Modifying configuration for '${editingUser?.username}'`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="btn-secondary"
              disabled={isSubmittingEdit}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-user-form"
              className="btn-primary"
              disabled={isSubmittingEdit}
            >
              {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form
          id="edit-user-form"
          onSubmit={handleSubmitEdit(onEditSubmit)}
          className="space-y-4"
        >
          {/* Username */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Username</label>
            <input
              type="text"
              className="input"
              placeholder="Username"
              {...registerEdit('username', {
                required: 'Username is required',
                pattern: {
                  value: /^[a-zA-Z0-9_]+$/,
                  message: 'Username must not contain spaces or special characters (letters, numbers, underscore only)'
                }
              })}
            />
            {errorsEdit.username && (
              <p className="text-xs text-status-red font-medium">{errorsEdit.username.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="Email"
              {...registerEdit('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
            />
            {errorsEdit.email && (
              <p className="text-xs text-status-red font-medium">{errorsEdit.email.message}</p>
            )}
          </div>

          {/* Password (Optional) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">
              Update Password <span className="text-text-muted font-normal">(Leave blank to keep current)</span>
            </label>
            <input
              type="password"
              className="input"
              placeholder="New password (min 6 characters)"
              {...registerEdit('password', {
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters'
                }
              })}
            />
            {errorsEdit.password && (
              <p className="text-xs text-status-red font-medium">{errorsEdit.password.message}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Security Role</label>
            <select
              className="input bg-white"
              {...registerEdit('role_id', { required: true })}
            >
              {ROLES.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status (is_active) */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active"
              className="w-4 h-4 rounded border-card-border text-primary focus:ring-primary"
              {...registerEdit('is_active')}
            />
            <label htmlFor="is_active" className="text-sm font-semibold text-text-secondary cursor-pointer select-none">
              Account is Active
            </label>
          </div>
        </form>
      </Modal>

      {/* ── DEACTIVATE USER CONFIRMATION MODAL ── */}
      <ConfirmModal
        isOpen={!!deactivatingUser}
        onClose={() => setDeactivatingUser(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Account"
        message={`Are you sure you want to deactivate the user account '${deactivatingUser?.username}'? This is a soft-delete operation that will immediately lock the user out of the portal.`}
        confirmLabel="Deactivate"
        danger
        loading={deactivateUserMutation.isPending}
      />

      {/* ── BULK CSV IMPORT MODAL ── */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title={`Bulk Import ${roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}s`}
        description={`Import multiple ${roleFilter}s at once from a CSV spreadsheet file.`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsImportOpen(false)}
              className="btn-secondary"
              disabled={isImporting}
            >
              Close
            </button>
            {!importResult && (
              <button
                type="submit"
                form="import-csv-form"
                className="btn-primary"
                disabled={isImporting || !importFile}
              >
                {isImporting ? 'Importing...' : 'Upload & Import'}
              </button>
            )}
          </>
        }
      >
        {!importResult ? (
          <form id="import-csv-form" onSubmit={handleImportSubmit} className="space-y-4">
            <div className="bg-slate-50 border border-card-border p-3.5 rounded-lg text-xs space-y-2">
              <p className="font-bold text-text-primary">CSV Template Columns Required:</p>
              <div className="flex flex-wrap gap-1.5">
                {roleFilter === 'student' ? (
                  <>
                    <code className="bg-slate-200/80 text-text-primary px-1.5 py-0.5 rounded font-mono font-semibold">username</code>
                    <code className="bg-slate-200/80 text-text-primary px-1.5 py-0.5 rounded font-mono font-semibold">email</code>
                    <code className="bg-slate-200/80 text-text-primary px-1.5 py-0.5 rounded font-mono font-semibold">password</code>
                    <code className="bg-slate-200/80 text-text-primary px-1.5 py-0.5 rounded font-mono font-semibold">department_code</code>
                    <code className="bg-slate-200/80 text-text-primary px-1.5 py-0.5 rounded font-mono font-semibold">class_name</code>
                    <code className="bg-slate-200/80 text-text-primary px-1.5 py-0.5 rounded font-mono font-semibold">roll_number</code>
                  </>
                ) : (
                  <>
                    <code className="bg-slate-200/80 text-text-primary px-1.5 py-0.5 rounded font-mono font-semibold">username</code>
                    <code className="bg-slate-200/80 text-text-primary px-1.5 py-0.5 rounded font-mono font-semibold">email</code>
                    <code className="bg-slate-200/80 text-text-primary px-1.5 py-0.5 rounded font-mono font-semibold">password</code>
                  </>
                )}
              </div>
              <p className="text-text-muted mt-1 leading-relaxed">
                Ensure headers match precisely. Duplicates (by username or email) already in the database will be skipped automatically.
              </p>
            </div>

            {/* File drop zone */}
            <div className="border-2 border-dashed border-card-border hover:border-primary/50 transition-colors rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 relative group">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isImporting}
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-text-muted group-hover:text-primary transition-colors mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-xs font-semibold text-text-primary max-w-xs text-center truncate">
                {importFile ? importFile.name : 'Click to choose file or drag and drop'}
              </span>
              <span className="text-[10px] text-text-muted mt-1">
                {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : 'CSV spreadsheet files only'}
              </span>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-card-border grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Imported</p>
                <p className="text-2xl font-extrabold text-status-green mt-0.5">{importResult.created}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Skipped</p>
                <p className="text-2xl font-extrabold text-status-amber mt-0.5">{importResult.skipped}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Errors</p>
                <p className="text-2xl font-extrabold text-status-red mt-0.5">{importResult.errors?.length || 0}</p>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-status-red flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Errors Encountered
                </label>
                <div className="max-h-40 overflow-y-auto border border-red-100 bg-red-50/20 rounded-lg p-3 divide-y divide-red-50/50 text-xs font-sans">
                  {importResult.errors.map((err, idx) => (
                    <div key={idx} className="py-1.5 flex justify-between gap-4 text-status-red font-medium">
                      <span className="flex-shrink-0 font-semibold">Row {err.row}:</span>
                      <span className="text-right">{err.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setImportResult(null)
                setImportFile(null)
              }}
              className="btn-secondary text-xs font-semibold py-2 px-3"
            >
              Upload Another File
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
