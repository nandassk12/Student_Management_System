import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { format, parseISO } from 'date-fns'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'
import StatCard from '@components/StatCard.jsx'

export default function StudentFees() {
  const { user } = useAuth()

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
    { name: 'Pending Fees', Amount: totals.outstanding, color: '#dc2626' }
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
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right w-36">Status</th>
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
                          <td className="p-4 text-right">
                            <span className={`inline-block px-2.5 py-0.5 text-[10px] font-black rounded-full border uppercase tracking-wider ${getStatusBadgeStyle(fee.status)}`}>
                              {fee.status}
                            </span>
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
    </div>
  )
}
