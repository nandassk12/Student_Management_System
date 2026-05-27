import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import Table from '@components/Table.jsx'
import Modal, { ConfirmModal } from '@components/Modal.jsx'

export default function AdminDepartments() {
  const queryClient = useQueryClient()

  // States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [deletingDept, setDeletingDept] = useState(null)

  // Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate }
  } = useForm({
    defaultValues: {
      name: '',
      code: ''
    }
  })

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit, isSubmitting: isSubmittingEdit }
  } = useForm()

  // ── Query: List Departments ──────────────────────────────────────────────────
  const { data: departments = [], isLoading, error } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/departments', {
        params: { limit: 100 }
      })
      return data
    }
  })

  // ── Mutation: Create Department ───────────────────────────────────────────────
  const createDeptMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/departments', payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast.success(`Department '${data.name}' created successfully!`)
      setIsCreateOpen(false)
      resetCreate()
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to create department.'
      toast.error(typeof detail === 'string' ? detail : 'Code already exists.')
    }
  })

  // ── Mutation: Update Department ───────────────────────────────────────────────
  const updateDeptMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await axiosInstance.put(`/departments/${id}`, payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast.success(`Department '${data.name}' updated successfully!`)
      setEditingDept(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to update department.'
      toast.error(typeof detail === 'string' ? detail : 'Code conflict.')
    }
  })

  // ── Mutation: Delete Department ───────────────────────────────────────────────
  const deleteDeptMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/departments/${id}`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast.success(data.detail ?? 'Department deleted successfully!')
      setDeletingDept(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to delete department.'
      toast.error(detail)
    }
  })

  // Submit Handlers
  const onCreateSubmit = (data) => {
    createDeptMutation.mutate({
      name: data.name,
      code: data.code.toUpperCase()
    })
  }

  const onEditClick = (dept) => {
    setEditingDept(dept)
    resetEdit({
      name: dept.name,
      code: dept.code
    })
  }

  const onEditSubmit = (data) => {
    updateDeptMutation.mutate({
      id: editingDept.id,
      payload: {
        name: data.name,
        code: data.code.toUpperCase()
      }
    })
  }

  const handleDelete = () => {
    deleteDeptMutation.mutate(deletingDept.id)
  }

  // Table Columns
  const columns = [
    { key: 'id', label: 'ID', sortable: true, width: '80px', muted: true },
    { key: 'name', label: 'Department Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onEditClick(row)}
            className="btn-secondary py-1 px-3 text-xs"
          >
            Edit
          </button>
          <button
            onClick={() => setDeletingDept(row)}
            className="btn-danger py-1 px-3 text-xs"
          >
            Delete
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Departments</h1>
          <p className="text-sm text-text-muted mt-1">Configure academic departments, schools, or faculties.</p>
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
          Add Department
        </button>
      </div>

      {/* Main Table */}
      {error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading departments: {error.message}
        </div>
      ) : (
        <Table
          columns={columns}
          data={departments}
          loading={isLoading}
          searchKeys={['name', 'code']}
          emptyMessage="No departments found."
        />
      )}

      {/* ── CREATE DEPT MODAL ── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Department"
        description="Establish a new academic department in the system database."
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
              form="create-dept-form"
              className="btn-primary"
              disabled={isSubmittingCreate}
            >
              {isSubmittingCreate ? 'Saving...' : 'Add Department'}
            </button>
          </>
        }
      >
        <form
          id="create-dept-form"
          onSubmit={handleSubmitCreate(onCreateSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Department Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Computer Science and Engineering"
              {...registerCreate('name', { required: 'Department Name is required' })}
            />
            {errorsCreate.name && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Department Code</label>
            <input
              type="text"
              className="input uppercase"
              placeholder="e.g. CSE"
              {...registerCreate('code', {
                required: 'Department Code is required',
                pattern: {
                  value: /^[a-zA-Z0-9]+$/,
                  message: 'Code must be alphanumeric'
                }
              })}
            />
            {errorsCreate.code && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.code.message}</p>
            )}
          </div>
        </form>
      </Modal>

      {/* ── EDIT DEPT MODAL ── */}
      <Modal
        isOpen={!!editingDept}
        onClose={() => setEditingDept(null)}
        title="Edit Department"
        description={`Update parameters for department '${editingDept?.name}'`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingDept(null)}
              className="btn-secondary"
              disabled={isSubmittingEdit}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-dept-form"
              className="btn-primary"
              disabled={isSubmittingEdit}
            >
              {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form
          id="edit-dept-form"
          onSubmit={handleSubmitEdit(onEditSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Department Name</label>
            <input
              type="text"
              className="input"
              {...registerEdit('name', { required: 'Department Name is required' })}
            />
            {errorsEdit.name && (
              <p className="text-xs text-status-red font-medium">{errorsEdit.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Department Code</label>
            <input
              type="text"
              className="input uppercase"
              {...registerEdit('code', {
                required: 'Department Code is required',
                pattern: {
                  value: /^[a-zA-Z0-9]+$/,
                  message: 'Code must be alphanumeric'
                }
              })}
            />
            {errorsEdit.code && (
              <p className="text-xs text-status-red font-medium">{errorsEdit.code.message}</p>
            )}
          </div>
        </form>
      </Modal>

      {/* ── DELETE DEPT CONFIRMATION MODAL ── */}
      <ConfirmModal
        isOpen={!!deletingDept}
        onClose={() => setDeletingDept(null)}
        onConfirm={handleDelete}
        title="Delete Department"
        message={`Are you sure you want to permanently delete the department '${deletingDept?.name}'? Note that this will fail if any courses or classes are linked to this department.`}
        confirmLabel="Delete"
        danger
        loading={deleteDeptMutation.isPending}
      />
    </div>
  )
}
