import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import Table from '@components/Table.jsx'
import Modal, { ConfirmModal } from '@components/Modal.jsx'
import StatusBadge, { FeeBadge } from '@components/StatusBadge.jsx'

const FEE_TYPES = [
  { value: 'tuition', label: 'Tuition Fee' },
  { value: 'hostel', label: 'Hostel Fee' },
  { value: 'exam', label: 'Exam Fee' },
  { value: 'library', label: 'Library Fee' }
]

const FEE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' }
]

export default function AdminFees() {
  const queryClient = useQueryClient()

  // Tabs: 'all' or 'student'
  const [activeTab, setActiveTab] = useState('all')
  const [selectedStudentId, setSelectedStudentId] = useState('')

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingFee, setEditingFee] = useState(null)
  const [deletingFee, setDeletingFee] = useState(null)
  const [payingFee, setPayingFee] = useState(null)

  // Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate }
  } = useForm({
    defaultValues: {
      student_id: '',
      amount: '',
      fee_type: 'tuition',
      status: 'pending',
      due_date: new Date().toISOString().split('T')[0]
    }
  })

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit, isSubmitting: isSubmittingEdit }
  } = useForm()

  // ── Query: List Students (for selector) ──────────────────────────────────────
  const { data: students = [], isLoading: isStudentsLoading } = useQuery({
    queryKey: ['students-list'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/users', {
        params: { role: 'student', limit: 100 }
      })
      return data
    }
  })

  // ── Query: List All Fees (Tab 1) ──────────────────────────────────────────────
  const { data: allFees = [], isLoading: isAllFeesLoading, error: allFeesError } = useQuery({
    queryKey: ['fees', 'all'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/fees', {
        params: { limit: 100 }
      })
      return data
    },
    enabled: activeTab === 'all'
  })

  // ── Query: List Student Fees (Tab 2) ──────────────────────────────────────────
  const { data: studentFees = [], isLoading: isStudentFeesLoading, error: studentFeesError } = useQuery({
    queryKey: ['fees', 'student', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return []
      const { data } = await axiosInstance.get(`/fees/student/${selectedStudentId}`)
      return data
    },
    enabled: activeTab === 'student' && !!selectedStudentId
  })

  // ── Mutation: Create Fee ──────────────────────────────────────────────────────
  const createFeeMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/fees', payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      toast.success(`Fee obligation of ₹${data.amount} created successfully!`)
      setIsCreateOpen(false)
      resetCreate()
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to create fee obligation.'
      toast.error(typeof detail === 'string' ? detail : 'Validation error.')
    }
  })

  // ── Mutation: Update Fee ──────────────────────────────────────────────────────
  const updateFeeMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await axiosInstance.put(`/fees/${id}`, payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      toast.success(`Fee record updated successfully!`)
      setEditingFee(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to update fee record.'
      toast.error(typeof detail === 'string' ? detail : 'Validation error.')
    }
  })

  // ── Mutation: Pay Fee ────────────────────────────────────────────────────────
  const payFeeMutation = useMutation({
    mutationFn: async ({ id, paidDate }) => {
      const { data } = await axiosInstance.post(`/fees/${id}/pay`, {
        paid_date: paidDate || new Date().toISOString().split('T')[0]
      })
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      toast.success(`Recorded payment of ₹${data.amount} successfully!`)
      setPayingFee(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to record payment.'
      toast.error(detail)
    }
  })

  // ── Mutation: Delete Fee ──────────────────────────────────────────────────────
  const deleteFeeMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/fees/${id}`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      toast.success(data.detail ?? 'Fee record successfully deleted!')
      setDeletingFee(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to delete fee record.'
      toast.error(detail)
    }
  })

  // Submit Handlers
  const onCreateSubmit = (data) => {
    createFeeMutation.mutate({
      student_id: Number(data.student_id),
      amount: Number(data.amount),
      fee_type: data.fee_type,
      status: data.status,
      due_date: data.due_date
    })
  }

  const onEditClick = (fee) => {
    setEditingFee(fee)
    resetEdit({
      amount: fee.amount,
      fee_type: fee.fee_type,
      status: fee.status,
      due_date: fee.due_date
    })
  }

  const onEditSubmit = (data) => {
    updateFeeMutation.mutate({
      id: editingFee.id,
      payload: {
        amount: Number(data.amount),
        fee_type: data.fee_type,
        status: data.status,
        due_date: data.due_date
      }
    })
  }

  const handleRecordPayment = () => {
    payFeeMutation.mutate({ id: payingFee.id })
  }

  const handleDelete = () => {
    deleteFeeMutation.mutate(deletingFee.id)
  }

  // Format Currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)
  }

  // Table Columns
  const getColumns = (showStudentColumn = true) => {
    const cols = []
    if (showStudentColumn) {
      cols.push({
        key: 'student',
        label: 'Student Username',
        sortable: true,
        render: (student) => student?.username ?? '—'
      })
    }
    cols.push(
      {
        key: 'fee_type',
        label: 'Type',
        sortable: true,
        render: (type) => <span className="capitalize font-semibold text-text-secondary">{type}</span>
      },
      {
        key: 'amount',
        label: 'Amount',
        sortable: true,
        render: (amt) => <span className="font-extrabold">{formatCurrency(amt)}</span>
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (status) => <FeeBadge status={status} />
      },
      {
        key: 'due_date',
        label: 'Due Date',
        sortable: true,
        render: (date) => <span className="text-xs text-text-muted">{date}</span>
      },
      {
        key: 'paid_date',
        label: 'Paid On',
        sortable: true,
        render: (date) => date ? <span className="text-xs text-status-green font-semibold">{date}</span> : <span className="text-text-muted font-normal">—</span>
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'right',
        render: (_, row) => (
          <div className="flex gap-2 justify-end">
            {row.status !== 'paid' && (
              <button
                onClick={() => setPayingFee(row)}
                className="py-1 px-3 text-xs bg-emerald-50 text-status-green border border-emerald-200 hover:bg-status-green hover:text-white rounded-md font-semibold transition-all duration-150"
              >
                Record
              </button>
            )}
            <button
              onClick={() => onEditClick(row)}
              className="btn-secondary py-1 px-3 text-xs"
            >
              Edit
            </button>
            <button
              onClick={() => setDeletingFee(row)}
              className="btn-danger py-1 px-3 text-xs"
            >
              Delete
            </button>
          </div>
        )
      }
    )
    return cols
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Fee Management</h1>
          <p className="text-sm text-text-muted mt-1">Configure student invoices, fee types, obligations, and payments.</p>
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
          Add Fee Invoice
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-card-border flex gap-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 text-sm font-bold tracking-tight border-b-2 transition-all ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          All Invoices
        </button>
        <button
          onClick={() => setActiveTab('student')}
          className={`pb-3 text-sm font-bold tracking-tight border-b-2 transition-all ${
            activeTab === 'student'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Student Billing Profiles
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'all' ? (
        <div className="space-y-4">
          {allFeesError ? (
            <div className="p-6 text-center card bg-white text-status-red font-semibold">
              Error loading fees: {allFeesError.message}
            </div>
          ) : (
            <Table
              columns={getColumns(true)}
              data={allFees}
              loading={isAllFeesLoading}
              searchKeys={['student.username', 'fee_type']}
              emptyMessage="No fee obligations created yet."
            />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Student Selector */}
          <div className="p-4 card bg-white flex items-center gap-4">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Select Student:</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="input bg-white max-w-sm"
              disabled={isStudentsLoading}
            >
              <option value="">-- Choose Student --</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.username} ({student.email})
                </option>
              ))}
            </select>
          </div>

          {selectedStudentId ? (
            studentFeesError ? (
              <div className="p-6 text-center card bg-white text-status-red font-semibold">
                Error loading student billing records: {studentFeesError.message}
              </div>
            ) : (
              <Table
                columns={getColumns(false)}
                data={studentFees}
                loading={isStudentFeesLoading}
                searchKeys={['fee_type']}
                emptyMessage="No fee invoices recorded for this student."
              />
            )
          ) : (
            <div className="p-12 text-center card bg-white text-text-muted text-sm font-semibold">
              Please choose a student from the dropdown above to view billing profiles.
            </div>
          )}
        </div>
      )}

      {/* ── CREATE FEE MODAL ── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Fee Obligation"
        description="Invoice a student for academic services (tuition, hostel, library, exams)."
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
              form="create-fee-form"
              className="btn-primary"
              disabled={isSubmittingCreate}
            >
              {isSubmittingCreate ? 'Saving...' : 'Add Fee Invoice'}
            </button>
          </>
        }
      >
        <form
          id="create-fee-form"
          onSubmit={handleSubmitCreate(onCreateSubmit)}
          className="space-y-4"
        >
          {/* Student */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Student Account</label>
            <select
              className="input bg-white"
              {...registerCreate('student_id', { required: 'Student selection is required' })}
            >
              <option value="">-- Select Student --</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.username}
                </option>
              ))}
            </select>
            {errorsCreate.student_id && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.student_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Amount (INR)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                placeholder="e.g. 50000"
                {...registerCreate('amount', {
                  required: 'Amount is required',
                  valueAsNumber: true,
                  min: { value: 0.01, message: 'Amount must be greater than 0' }
                })}
              />
              {errorsCreate.amount && (
                <p className="text-xs text-status-red font-medium">{errorsCreate.amount.message}</p>
              )}
            </div>

            {/* Type */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Fee Category</label>
              <select
                className="input bg-white"
                {...registerCreate('fee_type', { required: true })}
              >
                {FEE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Invoice Status</label>
              <select
                className="input bg-white"
                {...registerCreate('status', { required: true })}
              >
                {FEE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Due Date</label>
              <input
                type="date"
                className="input"
                {...registerCreate('due_date', { required: 'Due Date is required' })}
              />
              {errorsCreate.due_date && (
                <p className="text-xs text-status-red font-medium">{errorsCreate.due_date.message}</p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── EDIT FEE MODAL ── */}
      <Modal
        isOpen={!!editingFee}
        onClose={() => setEditingFee(null)}
        title="Edit Fee Invoice"
        description="Update pricing configurations, dates, and billing statuses."
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingFee(null)}
              className="btn-secondary"
              disabled={isSubmittingEdit}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-fee-form"
              className="btn-primary"
              disabled={isSubmittingEdit}
            >
              {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form
          id="edit-fee-form"
          onSubmit={handleSubmitEdit(onEditSubmit)}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Amount (INR)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                {...registerEdit('amount', {
                  required: 'Amount is required',
                  valueAsNumber: true,
                  min: { value: 0.01, message: 'Amount must be greater than 0' }
                })}
              />
              {errorsEdit.amount && (
                <p className="text-xs text-status-red font-medium">{errorsEdit.amount.message}</p>
              )}
            </div>

            {/* Type */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Fee Category</label>
              <select
                className="input bg-white"
                {...registerEdit('fee_type', { required: true })}
              >
                {FEE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Invoice Status</label>
              <select
                className="input bg-white"
                {...registerEdit('status', { required: true })}
              >
                {FEE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Due Date</label>
              <input
                type="date"
                className="input"
                {...registerEdit('due_date', { required: 'Due Date is required' })}
              />
              {errorsEdit.due_date && (
                <p className="text-xs text-status-red font-medium">{errorsEdit.due_date.message}</p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── RECORD PAYMENT CONFIRMATION MODAL ── */}
      <ConfirmModal
        isOpen={!!payingFee}
        onClose={() => setPayingFee(null)}
        onConfirm={handleRecordPayment}
        title="Record Payment"
        message={`Confirm receiving ₹${payingFee?.amount} for student '${payingFee?.student?.username}'? This will mark the fee invoice status as Paid.`}
        confirmLabel="Record Payment"
        loading={payFeeMutation.isPending}
      />

      {/* ── DELETE FEE CONFIRMATION MODAL ── */}
      <ConfirmModal
        isOpen={!!deletingFee}
        onClose={() => setDeletingFee(null)}
        onConfirm={handleDelete}
        title="Delete Fee Invoice"
        message={`Are you sure you want to delete this fee obligation? This operation is permanent and cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleteFeeMutation.isPending}
      />
    </div>
  )
}
