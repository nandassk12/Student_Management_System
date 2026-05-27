import { useState } from 'react'
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
        return (
          <div className="flex gap-2 justify-end">
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

        <button
          onClick={() => {
            setIsCreateOpen(true)
            resetCreate()
          }}
          className="btn-primary flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
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
    </div>
  )
}
