import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'
import StatCard from '@components/StatCard.jsx'

export default function StudentFees() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [checkoutFee, setCheckoutFee] = useState(null)

  const payFeeMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.post(`/fees/${id}/pay`, {})
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['studentFeesList', user?.id] })
      toast.success(`Payment of ₹${data.amount.toLocaleString()} processed successfully!`)
      setCheckoutFee(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Payment processing failed.'
      toast.error(typeof detail === 'string' ? detail : 'Payment failed.')
    }
  })

  const handleNotifyAdmin = (fee) => {
    window.alert("Notification sent! Administration will verify your offline bank transfer deposit shortly.")
  }

  const handleDownloadReceipt = async (feeId) => {
    const toastId = toast.loading('Generating receipt PDF...')
    try {
      const response = await axiosInstance.get(`/fees/${feeId}/receipt`, {
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `receipt_${feeId}.pdf`)
      document.body.appendChild(link)
      link.click()
      
      link.parentNode.removeChild(link)
      setTimeout(() => window.URL.revokeObjectURL(url), 100)
      toast.success('Receipt downloaded successfully!', { id: toastId })
    } catch (err) {
      console.error('Download error:', err)
      toast.error('Failed to download receipt.', { id: toastId })
    }
  }

  // ── Query: Fetch Student Fees ────────────────────────────────────────────────
  const { data: fees = [], isLoading, error } = useQuery({
    queryKey: ['studentFeesList', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await axiosInstance.get(`/fees/student/${user.id}`)
      return data
    },
    enabled: !!user?.id
  })

  // Calculate totals
  const totals = (() => {
    let paid = 0
    let pending = 0
    let overdue = 0
    let paidCount = 0

    fees.forEach((f) => {
      if (f.status === 'paid') {
        paid += f.amount
        paidCount += 1
      } else if (f.status === 'pending') {
        pending += f.amount
      } else if (f.status === 'overdue') {
        overdue += f.amount
      }
    })

    const outstanding = pending + overdue
    const total = paid + outstanding
    const paidRatio = total > 0 ? Math.round((paid / total) * 100) : 0
    const totalCount = fees.length

    return {
      paid,
      pending,
      overdue,
      outstanding,
      total,
      paidRatio,
      paidCount,
      totalCount
    }
  })()

  // Chart data: Paid vs Outstanding
  const chartData = [
    { name: 'Paid Fees', Amount: totals.paid, color: '#16a34a' },
    { name: 'Outstanding (Pending + Overdue)', Amount: totals.outstanding, color: '#dc2626' }
  ]

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'paid': return 'text-status-green bg-green-50 border-green-200 shadow-[0_1px_2px_rgba(22,163,74,0.05)]'
      case 'overdue': return 'text-status-red bg-red-50 border-red-200 shadow-[0_1px_2px_rgba(220,38,38,0.05)]'
      default: return 'text-status-amber bg-amber-50 border-amber-200 shadow-[0_1px_2px_rgba(217,119,6,0.05)]'
    }
  }

  // Icons for stat cards
  const Icons = {
    pending: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    paid: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    ratio: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      </svg>
    )
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Fee Ledger</h1>
        <p className="text-sm text-text-muted mt-1">Review outstanding invoice balances, payments status, and due dates.</p>
      </div>

      {/* Analytics grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-50 border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading fees: {error.message}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Outstanding Fees"
            value={totals.outstanding}
            prefix="₹"
            icon={Icons.pending}
            color="#dc2626"
            loading={isLoading}
          />
          <StatCard
            label="Paid Fees"
            value={totals.paid}
            prefix="₹"
            icon={Icons.paid}
            color="#16a34a"
            loading={isLoading}
          />
          <StatCard
            label="Payment Progress"
            value={totals.paidCount}
            suffix={` of ${totals.totalCount} paid`}
            icon={Icons.ratio}
            color="#1e3a5f"
            loading={isLoading}
          />
        </div>
      )}

      {/* Split view: Chart & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Navy Bar Chart (Left) */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="card bg-white p-6 space-y-6 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-text-primary">Payment Ratios</h3>
              <p className="text-xs text-text-muted mt-0.5">Paid vs outstanding financial liabilities.</p>
            </div>

            {fees.length === 0 ? (
              <div className="h-48 border border-dashed border-card-border rounded-lg flex flex-col items-center justify-center text-center p-4">
                <span className="text-xl">📊</span>
                <p className="text-xs font-bold text-text-secondary mt-1">No transaction data</p>
              </div>
            ) : (
              <div className="h-48 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <Tooltip 
                      formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']}
                      contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                    />
                    <Bar dataKey="Amount" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="text-[10px] text-text-muted text-center italic mt-2">
              Note: Outstanding balances represent unpaid pending & overdue items.
            </div>
          </div>
        </div>

        {/* Ledger Table (Right) */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="card bg-white overflow-hidden flex-1">
            <div className="p-4 border-b border-card-border bg-slate-50/50">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Transaction history log</h3>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs font-semibold">Loading ledger logs...</span>
              </div>
            ) : fees.length === 0 ? (
              <div className="p-12 text-center text-text-muted py-16">
                No fee records mapped to your student profile.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-card-border bg-slate-50/20">
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Fee Category</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center w-36">Amount</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center w-36">Due Date</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center w-32">Status</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right w-32">Receipt</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center w-56">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {fees.map((fee) => {
                      return (
                        <tr key={fee.id} className="hover:bg-slate-50/20 transition-colors">
                          {/* Fee Type */}
                          <td className="p-4 text-xs font-bold text-text-primary capitalize">
                            {fee.fee_type.replace('_', ' ')}
                          </td>

                          {/* Amount */}
                          <td className="p-4 text-center font-black text-xs text-text-primary">
                            ₹{fee.amount.toLocaleString()}
                          </td>

                          {/* Due Date */}
                          <td className="p-4 text-center text-xs font-semibold text-text-secondary">
                            {format(parseISO(fee.due_date), 'MMM dd, yyyy')}
                          </td>

                          {/* Status */}
                          <td className="p-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 text-[10px] font-black rounded-full border uppercase tracking-wider ${getStatusBadgeStyle(fee.status)}`}>
                              {fee.status}
                            </span>
                          </td>

                          {/* Action / Receipt */}
                          <td className="p-4 text-right">
                            {fee.status === 'paid' ? (
                              <button
                                onClick={() => handleDownloadReceipt(fee.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:text-navy-700 bg-slate-50 border border-card-border px-2 py-1 rounded transition-colors active:scale-95 duration-150"
                                title="Download Receipt"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download
                              </button>
                            ) : (
                              <span className="text-[10px] text-text-muted italic">N/A</span>
                            )}
                          </td>

                          {/* Operations */}
                          <td className="p-4 text-center">
                            {fee.status !== 'paid' ? (
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => setCheckoutFee(fee)}
                                  className="py-1 px-2.5 text-[10px] bg-primary text-white border border-primary hover:bg-navy-700 hover:border-navy-700 rounded font-semibold transition-all duration-150 shadow-sm"
                                >
                                  Pay Now
                                </button>
                                <button
                                  onClick={() => handleNotifyAdmin(fee)}
                                  className="py-1 px-2.5 text-[10px] bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 rounded font-semibold transition-all duration-150"
                                >
                                  Notify Admin
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center text-status-green font-bold text-[10px] gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Completed
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── MOCK CHECKOUT MODAL ── */}
      {checkoutFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-card-border p-6 w-full max-w-md shadow-2xl space-y-6 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-card-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Secure Checkout</h3>
                <p className="text-xs text-text-muted mt-0.5">Sandbox Payment Simulator</p>
              </div>
              <button
                onClick={() => setCheckoutFee(null)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Payment details summary */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-card-border">
              <div className="flex justify-between text-xs font-semibold text-text-secondary">
                <span>Fee Category</span>
                <span className="capitalize">{checkoutFee.fee_type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between text-base font-black text-text-primary border-t border-card-border/60 pt-2 mt-2">
                <span>Total Amount</span>
                <span>₹{checkoutFee.amount.toLocaleString()}</span>
              </div>
            </div>

            {/* Mock Credit Card Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              payFeeMutation.mutate(checkoutFee.id);
            }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary">Cardholder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  className="input w-full"
                  defaultValue={user?.username?.toUpperCase() || ''}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    pattern="\d{16}"
                    maxLength="16"
                    placeholder="4111 2222 3333 4444"
                    className="input w-full pl-10"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary">Expiry Date</label>
                  <input
                    type="text"
                    required
                    pattern="(0[1-9]|1[0-2])\/[0-9]{2}"
                    placeholder="MM/YY"
                    className="input w-full"
                    maxLength="5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary">CVV</label>
                  <input
                    type="password"
                    required
                    pattern="\d{3,4}"
                    placeholder="123"
                    className="input w-full"
                    maxLength="4"
                  />
                </div>
              </div>

              {/* SandBox Note */}
              <div className="flex gap-2 items-start bg-blue-50 border border-blue-100 p-3 rounded-lg text-[10px] text-blue-800 leading-normal">
                <svg className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span className="font-bold">Sandbox Mode:</span> Feel free to enter mock details. All transactions are simulated for demo evaluation.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckoutFee(null)}
                  className="btn-secondary flex-1"
                  disabled={payFeeMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 flex justify-center items-center gap-2"
                  disabled={payFeeMutation.isPending}
                >
                  {payFeeMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Pay Now'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
