import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, LogOut, Menu, X } from 'lucide-react'
import { appRoutes } from '@/app/router/routes'
import { getRoutesByRole, toRoleLabel } from '@/core/auth/roles'
import useAuth from '@/core/auth/useAuth'
import { getSidebarNavEntries } from '@/navigation/sidebarMenu'
import { getNotifications, markAsRead } from '@/features/notifications/services/notifications.service'

function DashboardLayout() {
  const location = useLocation()
  const { role: currentRole, userName, logout } = useAuth()
  const visibleRoutes = getRoutesByRole(appRoutes, currentRole).filter((route) => route.showInMenu !== false)
  const menuEntries = useMemo(
    () => getSidebarNavEntries(currentRole, visibleRoutes),
    [currentRole, visibleRoutes],
  )
  const initials =
    userName
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'US'

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    let isMounted = true

    if (currentRole === 'estudiante') {
      setNotifications([])
      return () => {
        isMounted = false
      }
    }

    const loadNotifications = async () => {
      try {
        const data = await getNotifications()
        if (!isMounted) return
        setNotifications(data)
      } catch (error) {
        if (!isMounted) return
        setNotifications([])
      }
    }

    loadNotifications()
    const intervalId = window.setInterval(loadNotifications, 15000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [currentRole])

  const handleMarkAsRead = async (id) => {
    try {
      await markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.idNotificacion === id ? { ...n, estadoEnvio: 'Leído' } : n))
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => {
      const state = String(item.estadoEnvio ?? '').toLowerCase()
      return state !== 'leído' && state !== 'leido'
    }).length
  }, [notifications])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <button
            className="header-icon-button sidebar-toggle"
            type="button"
            aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            {sidebarOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
          <div className="app-brand">Sistema de Gestion de Inventario</div>
        </div>

        <div className="header-user">
          <span className="header-user-role">{toRoleLabel(currentRole)}</span>
          <div className="header-notifications">
            <button
              className="header-icon-button"
              type="button"
              aria-label="Notificaciones"
              onClick={() => setNotificationsOpen((prev) => !prev)}
            >
              <Bell size={16} aria-hidden="true" />
              {unreadCount > 0 ? (
                <span className="header-notification-badge">{unreadCount}</span>
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="header-notification-panel">
                <div className="header-notification-panel-head">
                  <strong>Notificaciones</strong>
                  <span>{notifications.length}</span>
                </div>
                <div className="header-notification-list">
                  {notifications.length === 0 ? (
                    <p className="header-notification-empty">No hay notificaciones registradas.</p>
                  ) : (
                    notifications.map((item) => (
                      <article key={item.idNotificacion} className="header-notification-item">
                        <div className="header-notification-item-top">
                          <span className="header-notification-loan">Prestamo #{String(item.idPrestamo).padStart(3, '0')}</span>
                          <span className={`header-notification-status ${String(item.estadoEnvio ?? '').toLowerCase() === 'enviado' ? 'header-notification-status-sent' : String(item.estadoEnvio ?? '').toLowerCase() === 'leído' || String(item.estadoEnvio ?? '').toLowerCase() === 'leido' ? 'header-notification-status-read' : 'header-notification-status-pending'}`}>
                            {item.estadoEnvio ?? 'Pendiente'}
                          </span>
                        </div>
                        <p>{item.mensaje}</p>
                        {String(item.estadoEnvio ?? '').toLowerCase() !== 'leído' && String(item.estadoEnvio ?? '').toLowerCase() !== 'leido' ? (
                          <button
                            className="dashboard-action-button"
                            style={{ marginTop: '8px', fontSize: '12px', padding: '4px 8px' }}
                            onClick={() => handleMarkAsRead(item.idNotificacion)}
                          >
                            Marcar como vista
                          </button>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <span className="header-user-name">{userName || 'Usuario'}</span>
          <span className="header-user-avatar">{initials}</span>
          <button className="header-logout" type="button" onClick={logout}>
            <LogOut size={16} aria-hidden="true" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      <div className="app-main">
        {/* Overlay for mobile sidebar */}
        {sidebarOpen ? (
          <div
            className="sidebar-overlay"
            role="presentation"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside className={`app-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
          <nav className="menu" onClick={() => setSidebarOpen(false)}>
            {menuEntries.map((entry) => {
              const Icon = entry.icon
              const active = entry.match(location)
              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  className={() => `menu-item${active ? ' menu-item-active' : ''}`}
                >
                  <Icon className="menu-icon" size={18} aria-hidden="true" />
                  <span>{entry.title}</span>
                </NavLink>
              )
            })}
          </nav>
        </aside>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
