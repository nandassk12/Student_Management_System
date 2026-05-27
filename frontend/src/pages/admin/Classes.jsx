import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import Table from '@components/Table.jsx'
import Modal, { ConfirmModal } from '@components/Modal.jsx'

export default function AdminClasses() {
  const queryClient = useQueryClient()

  // States
  const [deptFilter, setDeptFilter] = useState('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingClass, setEditingClass] = useState(null)
  const [deletingClass, setDeletingClass] = useState(null)

  // Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate }
  } = useForm({
    defaultValues: {
      name: '',
      department_id: '',
      year: new Date().getFullYear(),
      semester: 1
    }
  })

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit, isSubmitting: isSubmittingEdit }
  } = useForm()

  // ── Query: List Departments ──────────────────────────────────────────────────
  const { data: departments = [], isLoading: isDeptsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/departments', {
        params: { limit: 100 }
      })
      return data
    }
  })

  // ── Query: List Classes ──────────────────────────────────────────────────────
  const { data: classes = [], isLoading: isClassesLoading, error } = useQuery({
    queryKey: ['classes', deptFilter],
    queryFn: async () => {
      const params = { limit: 100 }
      if (deptFilter !== 'all') {
        params.department_id = Number(deptFilter)
      }
      const { data } = await axiosInstance.get('/classes', { params })
      return data
    }
  })

  // ── Mutation: Create Class ───────────────────────────────────────────────────
  const createClassMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/classes', payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success(`Class '${data.name}' created successfully!`)
      setIsCreateOpen(false)
      resetCreate()
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to create class.'
      toast.error(typeof detail === 'string' ? detail : 'Validation error.')
    }
  })

  // ── Mutation: Update Class ───────────────────────────────────────────────────
  const updateClassMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await axiosInstance.put(`/classes/${id}`, payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success(`Class '${data.name}' updated successfully!`)
      setEditingClass(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to update class.'
      toast.error(typeof detail === 'string' ? detail : 'Conflict in updating class.')
    }
  })

  // ── Mutation: Delete Class ───────────────────────────────────────────────────
  const deleteClassMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/classes/${id}`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success(data.detail ?? 'Class deleted successfully!')
      setDeletingClass(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to delete class.'
      toast.error(detail)
    }
  })

  // Handlers
  const onCreateSubmit = (data) => {
    createClassMutation.mutate({
      name: data.name,
      department_id: Number(data.department_id),
      year: Number(data.year),
      semester: Number(data.semester)
    })
  }

  const onEditClick = (cls) => {
    setEditingClass(cls)
    resetEdit({
      name: cls.name,
      department_id: cls.department_id,
      year: cls.year,
      semester: cls.semester
    })
  }

  const onEditSubmit = (data) => {
    updateClassMutation.mutate({
      id: editingClass.id,
      payload: {
        name: data.name,
        department_id: Number(data.department_id),
        year: Number(data.year),
        semester: Number(data.semester)
      }
    })
  }

  const handleDelete = () => {
    deleteClassMutation.mutate(deletingClass.id)
  }

  // Table Columns
  const columns = [
    { key: 'id', label: 'ID', sortable: true, width: '80px', muted: true },
    { key: 'name', label: 'Class Name', sortable: true },
    {
      key: 'department',
      label: 'Department',
      sortable: true,
      render: (dept) => dept?.name ?? '—'
    },
    { key: 'year', label: 'Year', sortable: true },
    { key: 'semester', label: 'Semester', sortable: true },
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
            onClick={() => setDeletingClass(row)}
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
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Classes</h1>
          <p className="text-sm text-text-muted mt-1">Configure study groups, cohorts, classes, and academic years.</p>
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
          Add Class
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center gap-4 p-4 card bg-white">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Department Filter:</label>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="input bg-white max-w-xs text-xs font-semibold py-1.5"
          disabled={isDeptsLoading}
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name} ({dept.code})
            </option>
          ))}
        </select>
      </div>

      {/* Main Table */}
      {error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading classes: {error.message}
        </div>
      ) : (
        <Table
          columns={columns}
          data={classes}
          loading={isClassesLoading}
          searchKeys={['name']}
          emptyMessage="No classes found."
        />
      )}

      {/* ── CREATE CLASS MODAL ── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Class / Cohort"
        description="Establish a new batch or class group in the portal."
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
              form="create-class-form"
              className="btn-primary"
              disabled={isSubmittingCreate}
            >
              {isSubmittingCreate ? 'Saving...' : 'Add Class'}
            </button>
          </>
        }
      >
        <form
          id="create-class-form"
          onSubmit={handleSubmitCreate(onCreateSubmit)}
          className="space-y-4"
        >
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Class Name / Title</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. CSE-2026 Batch A"
              {...registerCreate('name', { required: 'Class Name is required' })}
            />
            {errorsCreate.name && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.name.message}</p>
            )}
          </div>

          {/* Department */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Academic Department</label>
            <select
              className="input bg-white"
              {...registerCreate('department_id', { required: 'Department selection is required' })}
            >
              <option value="">-- Select Department --</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            {errorsCreate.department_id && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.department_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Year */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Academic Year</label>
              <input
                type="number"
                className="input"
                {...registerCreate('year', {
                  required: 'Year is required',
                  valueAsNumber: true,
                  min: { value: 2000, message: 'Min year is 2000' },
                  max: { value: 2100, message: 'Max year is 2100' }
                })}
              />
              {errorsCreate.year && (
                <p className="text-xs text-status-red font-medium">{errorsCreate.year.message}</p>
              )}
            </div>

            {/* Semester */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Recommended Semester</label>
              <select
                className="input bg-white"
                {...registerCreate('semester', {
                  required: 'Semester is required',
                  valueAsNumber: true
                })}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
              {errorsCreate.semester && (
                <p className="text-xs text-status-red font-medium">{errorsCreate.semester.message}</p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── EDIT CLASS MODAL ── */}
      <Modal
        isOpen={!!editingClass}
        onClose={() => setEditingClass(null)}
        title="Edit Class / Cohort"
        description={`Update parameters for class '${editingClass?.name}'`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingClass(null)}
              className="btn-secondary"
              disabled={isSubmittingEdit}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-class-form"
              className="btn-primary"
              disabled={isSubmittingEdit}
            >
              {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form
          id="edit-class-form"
          onSubmit={handleSubmitEdit(onEditSubmit)}
          className="space-y-4"
        >
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Class Name</label>
            <input
              type="text"
              className="input"
              {...registerEdit('name', { required: 'Class Name is required' })}
            />
            {errorsEdit.name && (
              <p className="text-xs text-status-red font-medium">{errorsEdit.name.message}</p>
            )}
          </div>

          {/* Department */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Academic Department</label>
            <select
              className="input bg-white"
              {...registerEdit('department_id', { required: 'Department is required' })}
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            {errorsEdit.department_id && (
              <p className="text-xs text-status-red font-medium">{errorsEdit.department_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Year */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Academic Year</label>
              <input
                type="number"
                className="input"
                {...registerEdit('year', {
                  required: 'Year is required',
                  valueAsNumber: true,
                  min: { value: 2000, message: 'Min year 2000' },
                  max: { value: 2100, message: 'Max year 2100' }
                })}
              />
              {errorsEdit.year && (
                <p className="text-xs text-status-red font-medium">{errorsEdit.year.message}</p>
              )}
            </div>

            {/* Semester */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Recommended Semester</label>
              <select
                className="input bg-white"
                {...registerEdit('semester', {
                  required: 'Semester is required',
                  valueAsNumber: true
                })}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
              {errorsEdit.semester && (
                <p className="text-xs text-status-red font-medium">{errorsEdit.semester.message}</p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── DELETE CLASS CONFIRMATION MODAL ── */}
      <ConfirmModal
        isOpen={!!deletingClass}
        onClose={() => setDeletingClass(null)}
        onConfirm={handleDelete}
        title="Delete Class / Cohort"
        message={`Are you sure you want to permanently delete the class '${deletingClass?.name}'? Note that this will fail if any timetables, leave requests, or student enrollments link to it.`}
        confirmLabel="Delete"
        danger
        loading={deleteClassMutation.isPending}
      />
    </div>
  )
}
