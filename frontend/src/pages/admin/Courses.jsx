import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import Table from '@components/Table.jsx'
import Modal, { ConfirmModal } from '@components/Modal.jsx'

export default function AdminCourses() {
  const queryClient = useQueryClient()

  // States
  const [deptFilter, setDeptFilter] = useState('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [deletingCourse, setDeletingCourse] = useState(null)

  // Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate }
  } = useForm({
    defaultValues: {
      name: '',
      code: '',
      department_id: '',
      credits: 3,
      semester: 1
    }
  })

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit, isSubmitting: isSubmittingEdit }
  } = useForm()

  // ── Query: List Departments (for dropdown filters/forms) ─────────────────────
  const { data: departments = [], isLoading: isDeptsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/departments', {
        params: { limit: 100 }
      })
      return data
    }
  })

  // ── Query: List Courses ──────────────────────────────────────────────────────
  const { data: courses = [], isLoading: isCoursesLoading, error } = useQuery({
    queryKey: ['courses', deptFilter],
    queryFn: async () => {
      const params = { limit: 100 }
      if (deptFilter !== 'all') {
        params.department_id = Number(deptFilter)
      }
      const { data } = await axiosInstance.get('/courses', { params })
      return data
    }
  })

  // ── Mutation: Create Course ──────────────────────────────────────────────────
  const createCourseMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/courses', payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success(`Course '${data.name}' created successfully!`)
      setIsCreateOpen(false)
      resetCreate()
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to create course.'
      toast.error(typeof detail === 'string' ? detail : 'Course Code already exists.')
    }
  })

  // ── Mutation: Update Course ──────────────────────────────────────────────────
  const updateCourseMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await axiosInstance.put(`/courses/${id}`, payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success(`Course '${data.name}' updated successfully!`)
      setEditingCourse(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to update course.'
      toast.error(typeof detail === 'string' ? detail : 'Conflict in updating course.')
    }
  })

  // ── Mutation: Delete Course ──────────────────────────────────────────────────
  const deleteCourseMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/courses/${id}`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success(data.detail ?? 'Course deleted successfully!')
      setDeletingCourse(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to delete course.'
      toast.error(detail)
    }
  })

  // Handlers
  const onCreateSubmit = (data) => {
    createCourseMutation.mutate({
      name: data.name,
      code: data.code.toUpperCase(),
      department_id: Number(data.department_id),
      credits: Number(data.credits),
      semester: Number(data.semester)
    })
  }

  const onEditClick = (course) => {
    setEditingCourse(course)
    resetEdit({
      name: course.name,
      code: course.code,
      department_id: course.department_id,
      credits: course.credits,
      semester: course.semester
    })
  }

  const onEditSubmit = (data) => {
    updateCourseMutation.mutate({
      id: editingCourse.id,
      payload: {
        name: data.name,
        code: data.code.toUpperCase(),
        department_id: Number(data.department_id),
        credits: Number(data.credits),
        semester: Number(data.semester)
      }
    })
  }

  const handleDelete = () => {
    deleteCourseMutation.mutate(deletingCourse.id)
  }

  // Table Columns
  const columns = [
    { key: 'id', label: 'ID', sortable: true, width: '80px', muted: true },
    { key: 'code', label: 'Course Code', sortable: true },
    { key: 'name', label: 'Course Name', sortable: true },
    {
      key: 'department',
      label: 'Department',
      sortable: true,
      render: (dept) => dept?.name ?? '—'
    },
    { key: 'credits', label: 'Credits', sortable: true },
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
            onClick={() => setDeletingCourse(row)}
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
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Courses</h1>
          <p className="text-sm text-text-muted mt-1">Configure academic curriculum subjects, credit points, and semester mappings.</p>
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
          Add Course
        </button>
      </div>

      {/* Toolbar & Filters */}
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
          Error loading courses: {error.message}
        </div>
      ) : (
        <Table
          columns={columns}
          data={courses}
          loading={isCoursesLoading}
          searchKeys={['name', 'code']}
          emptyMessage="No courses found."
        />
      )}

      {/* ── CREATE COURSE MODAL ── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Course"
        description="Establish a new subject structure in the system syllabus."
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
              form="create-course-form"
              className="btn-primary"
              disabled={isSubmittingCreate}
            >
              {isSubmittingCreate ? 'Saving...' : 'Add Course'}
            </button>
          </>
        }
      >
        <form
          id="create-course-form"
          onSubmit={handleSubmitCreate(onCreateSubmit)}
          className="space-y-4"
        >
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Course Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Data Structures and Algorithms"
              {...registerCreate('name', { required: 'Course Name is required' })}
            />
            {errorsCreate.name && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.name.message}</p>
            )}
          </div>

          {/* Code */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Course Code</label>
            <input
              type="text"
              className="input uppercase"
              placeholder="e.g. CS201"
              {...registerCreate('code', {
                required: 'Course Code is required',
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
            {/* Credits */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Credits</label>
              <input
                type="number"
                min="1"
                max="10"
                className="input"
                {...registerCreate('credits', {
                  required: 'Credits are required',
                  valueAsNumber: true,
                  min: { value: 1, message: 'Must be positive' }
                })}
              />
              {errorsCreate.credits && (
                <p className="text-xs text-status-red font-medium">{errorsCreate.credits.message}</p>
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

      {/* ── EDIT COURSE MODAL ── */}
      <Modal
        isOpen={!!editingCourse}
        onClose={() => setEditingCourse(null)}
        title="Edit Course"
        description={`Update details for course '${editingCourse?.name}'`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingCourse(null)}
              className="btn-secondary"
              disabled={isSubmittingEdit}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-course-form"
              className="btn-primary"
              disabled={isSubmittingEdit}
            >
              {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form
          id="edit-course-form"
          onSubmit={handleSubmitEdit(onEditSubmit)}
          className="space-y-4"
        >
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Course Name</label>
            <input
              type="text"
              className="input"
              {...registerEdit('name', { required: 'Course Name is required' })}
            />
            {errorsEdit.name && (
              <p className="text-xs text-status-red font-medium">{errorsEdit.name.message}</p>
            )}
          </div>

          {/* Code */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Course Code</label>
            <input
              type="text"
              className="input uppercase"
              {...registerEdit('code', {
                required: 'Course Code is required',
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

          {/* Department */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Academic Department</label>
            <select
              className="input bg-white"
              {...registerEdit('department_id', { required: 'Department selection is required' })}
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
            {/* Credits */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Credits</label>
              <input
                type="number"
                min="1"
                max="10"
                className="input"
                {...registerEdit('credits', {
                  required: 'Credits are required',
                  valueAsNumber: true,
                  min: { value: 1, message: 'Must be positive' }
                })}
              />
              {errorsEdit.credits && (
                <p className="text-xs text-status-red font-medium">{errorsEdit.credits.message}</p>
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

      {/* ── DELETE COURSE CONFIRMATION MODAL ── */}
      <ConfirmModal
        isOpen={!!deletingCourse}
        onClose={() => setDeletingCourse(null)}
        onConfirm={handleDelete}
        title="Delete Course"
        message={`Are you sure you want to permanently delete the course '${deletingCourse?.name}'? Note that this will fail if any classes, enrollments, or timetables depend on it.`}
        confirmLabel="Delete"
        danger
        loading={deleteCourseMutation.isPending}
      />
    </div>
  )
}
