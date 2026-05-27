import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'

import axiosInstance from '@api/axios.js'

export default function StudentNotice() {
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'general' | 'class'

  // ── Query: Fetch Notices ───────────────────────────────────────────────────────
  const { data: notices = [], isLoading, error } = useQuery({
    queryKey: ['studentNoticesBoard'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/notice', { params: { limit: 100 } })
      return data
    }
  })

  // Filter notices based on active tab
  const filteredNotices = notices.filter((n) => {
    if (activeFilter === 'general') return n.class_id === null
    if (activeFilter === 'class') return n.class_id !== null
    return true
  })

  // Audience Badge Style Helper
  const getAudienceBadgeStyle = (role) => {
    switch (role) {
      case 'student': return 'bg-blue-50 text-blue-700 border-blue-200 shadow-[0_1px_2px_rgba(37,99,235,0.05)]'
      default: return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Notice Board</h1>
          <p className="text-sm text-text-muted mt-1">Stay updated with academic broadcasts, class circulars, and notices.</p>
        </div>

        {/* Filter Toolbar tabs */}
        <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-card-border">
          {[
            { id: 'all', label: 'All Notices' },
            { id: 'general', label: 'General' },
            { id: 'class', label: 'My Class' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-150 ${
                activeFilter === tab.id
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notices Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-slate-50 border border-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading notices: {error.message}
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2 border border-dashed border-card-border bg-slate-50/20">
          <span className="text-2xl">📢</span>
          <h4 className="font-bold text-text-secondary text-sm">Notice Board is empty</h4>
          <p className="text-xs max-w-xs mt-1">There are no notices matching this filter category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredNotices.map((notice) => {
            return (
              <div 
                key={notice.id}
                className="card bg-white p-5 hover:shadow-card hover:border-slate-300 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top: Author & Meta details */}
                  <div className="flex items-center gap-3">
                    {/* Avatar initials */}
                    <div className="w-8 h-8 rounded-full bg-navy-50 text-primary border border-navy-100 flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                      {(notice.author?.full_name || notice.author?.username || '??').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-primary">
                        {notice.author?.full_name || notice.author?.username}
                      </h4>
                      <p className="text-[10px] text-text-muted font-bold mt-0.5">
                        Posted {format(parseISO(notice.created_at), 'MMMM dd, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>

                  {/* Notice Title */}
                  <h3 className="text-sm font-extrabold text-text-primary mt-4 tracking-tight leading-snug">
                    {notice.title}
                  </h3>

                  {/* Content body */}
                  <p className="text-xs text-text-secondary leading-relaxed mt-2 whitespace-pre-wrap">
                    {notice.content}
                  </p>
                </div>

                {/* Footer Badges */}
                <div className="mt-5 pt-3 border-t border-card-border/60 flex flex-wrap gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getAudienceBadgeStyle(notice.target_role)}`}>
                    Audience: {notice.target_role}
                  </span>

                  {notice.class_ && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                      Class: {notice.class_.name}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
