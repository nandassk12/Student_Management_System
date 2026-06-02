import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)

function getNotificationIcon(type) {
  switch (type) {
    case 'notice':
      return (
        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </div>
      )
    case 'leave':
      return (
        <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )
    case 'report':
      return (
        <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      )
    case 'fee':
      return (
        <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )
  }
}

// ─── Relative time formatter ──────────────────────────────────────────────────
function formatRelativeTime(dateString) {
  if (!dateString) return ''
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function NotificationDropdown() {
  const { userRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // ─── Queries ────────────────────────────────────────────────────────────────
  
  // Notices (All roles)
  const { data: notices = [] } = useQuery({
    queryKey: ['notificationsNotices', userRole],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/notice', { params: { limit: 10 } })
      return data
    },
    enabled: !!userRole,
    refetchInterval: 30000,
  })

  // Student: Leave requests
  const { data: studentLeaves = [] } = useQuery({
    queryKey: ['notificationsStudentLeaves', userRole],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/leave/me')
      return data
    },
    enabled: userRole === 'student',
    refetchInterval: 30000,
  })

  // Student: AI reports
  const { data: studentReports = [] } = useQuery({
    queryKey: ['notificationsStudentReports', userRole],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/ai/reports/me')
      return data
    },
    enabled: userRole === 'student',
    refetchInterval: 30000,
  })

  // Student: Fees
  const { data: studentFees = [] } = useQuery({
    queryKey: ['notificationsStudentFees', userRole],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/fees/me')
      return data
    },
    enabled: userRole === 'student',
    refetchInterval: 30000,
  })

  // Teacher: Student leave requests to review
  const { data: teacherStudentLeaves = [] } = useQuery({
    queryKey: ['notificationsTeacherStudentLeaves', userRole],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/leave/me')
      return data
    },
    enabled: userRole === 'teacher',
    refetchInterval: 30000,
  })

  // Teacher: Own leave requests
  const { data: teacherOwnLeaves = [] } = useQuery({
    queryKey: ['notificationsTeacherOwnLeaves', userRole],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/teacher/leave/me')
      return data
    },
    enabled: userRole === 'teacher',
    refetchInterval: 30000,
  })

  // Admin: Teacher leave requests to review
  const { data: adminTeacherLeaves = [] } = useQuery({
    queryKey: ['notificationsAdminTeacherLeaves', userRole],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/teacher/leave', { params: { status: 'pending' } })
      return data
    },
    enabled: userRole === 'admin',
    refetchInterval: 30000,
  })

  // ─── Merge Notifications ───────────────────────────────────────────────────
  const combinedNotifications = useMemo(() => {
    const list = []

    // 1. Notices (All roles)
    notices.forEach(notice => {
      list.push({
        id: `notice-${notice.id}`,
        type: 'notice',
        title: 'New Notice Posted',
        description: notice.title,
        timestamp: notice.created_at,
        link: `/${userRole}/notice`,
      })
    })

    // 2. Role-specific items
    if (userRole === 'student') {
      // Student Leaves
      studentLeaves.forEach(leave => {
        if (leave.status !== 'pending') {
          list.push({
            id: `leave-status-${leave.id}-${leave.status}`,
            type: 'leave',
            title: `Leave request ${leave.status}`,
            description: `Your leave request for ${leave.from_date} was ${leave.status}.`,
            timestamp: leave.created_at,
            link: '/student/leave',
          })
        }
      })

      // Student reports
      studentReports.forEach(report => {
        list.push({
          id: `report-${report.id}`,
          type: 'report',
          title: 'AI Report Generated',
          description: `Your academic report for Semester ${report.semester} is available.`,
          timestamp: report.approved_at || report.created_at,
          link: '/student/reports',
        })
      })

      // Student fees
      studentFees.forEach(fee => {
        if (fee.status !== 'paid') {
          list.push({
            id: `fee-${fee.id}-${fee.status}`,
            type: 'fee',
            title: `Fee ${fee.status === 'overdue' ? 'Overdue' : 'Pending'}`,
            description: `${fee.fee_type.charAt(0).toUpperCase() + fee.fee_type.slice(1)} fee of $${fee.amount} is ${fee.status}.`,
            timestamp: fee.created_at,
            link: '/student/fees',
          })
        }
      })
    } else if (userRole === 'teacher') {
      // Student leave requests pending review
      teacherStudentLeaves.forEach(leave => {
        if (leave.status === 'pending') {
          list.push({
            id: `student-leave-pending-${leave.id}`,
            type: 'leave',
            title: 'Student Leave Request',
            description: `${leave.student?.full_name || 'A student'} requested leave for ${leave.duration_days} days.`,
            timestamp: leave.created_at,
            link: '/teacher/leave',
          })
        }
      })

      // Teacher's own leaves
      teacherOwnLeaves.forEach(leave => {
        if (leave.status !== 'pending') {
          list.push({
            id: `teacher-leave-status-${leave.id}-${leave.status}`,
            type: 'leave',
            title: `Leave Request ${leave.status}`,
            description: `Your leave request for ${leave.from_date} was ${leave.status}.`,
            timestamp: leave.created_at,
            link: '/teacher/leave',
          })
        }
      })
    } else if (userRole === 'admin') {
      // Teacher leave requests pending review
      adminTeacherLeaves.forEach(leave => {
        if (leave.status === 'pending') {
          list.push({
            id: `teacher-leave-pending-${leave.id}`,
            type: 'leave',
            title: 'Teacher Leave Request',
            description: `${leave.teacher?.full_name || 'A teacher'} requested leave for ${leave.duration_days} days.`,
            timestamp: leave.created_at,
            link: '/admin/leave',
          })
        }
      })
    }

    // Sort by newest first
    return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [userRole, notices, studentLeaves, studentReports, studentFees, teacherStudentLeaves, teacherOwnLeaves, adminTeacherLeaves])

  // ─── Local Storage Read Tracking ──────────────────────────────────────────
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('read_notification_ids')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    localStorage.setItem('read_notification_ids', JSON.stringify(Array.from(readIds)))
  }, [readIds])

  const unreadNotifications = useMemo(() => {
    return combinedNotifications.filter(n => !readIds.has(n.id))
  }, [combinedNotifications, readIds])

  const unreadCount = unreadNotifications.length

  const handleMarkAllAsRead = (e) => {
    e.stopPropagation()
    const allIds = combinedNotifications.map(n => n.id)
    setReadIds(new Set(allIds))
  }

  const handleNotificationClick = (notification) => {
    setReadIds(prev => {
      const updated = new Set(prev)
      updated.add(notification.id)
      return updated
    })
    setIsOpen(false)
  }

  // ─── Click Outside Listener ────────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="navbar-notifications"
        aria-label="Notifications"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: isOpen ? '#f1f5f9' : '#f8fafc',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isOpen ? '#0f172a' : '#64748b',
          position: 'relative',
          transition: 'background 150ms, color 150ms',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!isOpen) {
            e.currentTarget.style.background = '#f1f5f9'
            e.currentTarget.style.color      = '#0f172a'
          }
        }}
        onMouseLeave={e => {
          if (!isOpen) {
            e.currentTarget.style.background = '#f8fafc'
            e.currentTarget.style.color      = '#64748b'
          }
        }}
      >
        <BellIcon />
        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute bg-status-red text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-white animate-pulse"
            style={{
              top: '-3px',
              right: '-3px',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white border border-card-border rounded-xl shadow-modal z-50 overflow-hidden animate-modal-in"
          style={{
            transformOrigin: 'top right',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-card-border flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-text-primary text-sm font-sans">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-navy-100 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold font-sans">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary hover:text-primary-hover font-semibold transition-colors font-sans"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Scrollable List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-card-border">
            {combinedNotifications.length === 0 ? (
              <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-text-muted mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-text-secondary font-sans">All caught up!</p>
                <p className="text-[11px] text-text-muted mt-0.5 font-sans">No notifications at the moment.</p>
              </div>
            ) : (
              combinedNotifications.map((notif) => {
                const isUnread = !readIds.has(notif.id)
                return (
                  <Link
                    key={notif.id}
                    to={notif.link}
                    onClick={() => handleNotificationClick(notif)}
                    className={`block px-4 py-3 hover:bg-slate-50 transition-colors border-b border-card-border last:border-b-0 ${
                      isUnread ? 'bg-navy-50/20' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notif.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <p className={`text-xs font-semibold text-text-primary font-sans ${isUnread ? 'font-bold' : ''}`}>
                            {notif.title}
                          </p>
                          {isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-[11px] text-text-secondary mt-0.5 font-sans leading-relaxed line-clamp-2">
                          {notif.description}
                        </p>
                        <p className="text-[10px] text-text-muted mt-1.5 flex items-center gap-1 font-sans">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatRelativeTime(notif.timestamp)}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
