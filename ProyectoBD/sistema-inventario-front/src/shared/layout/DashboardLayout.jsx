import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Bell, LogOut, Menu, X } from 'lucide-react'
import { appRoutes } from '@/app/router/routes'
import { getRoutesByRole, toRoleLabel } from '@/core/auth/roles'
import useAuth from '@/core/auth/useAuth'

function DashboardLayout() {
  const { role: currentRole, userName, logout } = useAuth()
  const visibleRoutes = getRoutesByRole(appRoutes, currentRole).filter((route) => route.showInMenu !== false)
  const initials =
    userName
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'US'

  const [sidebarOpen, setSidebarOpen] = useState(false)

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
          <button className="header-icon-button" type="button" aria-label="Notificaciones">
            <Bell size={16} aria-hidden="true" />
          </button>
          <span className="header-user-name">{userName || 'Usuario'}</span>
          <span className="header-user-avatar">{initials}</span>
          <button className="header-logout" type="button" onClick={logout}>
            <LogOut size={16} aria-hidden="true" />
            Salir
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
            {visibleRoutes.map((route) => {
              const Icon = route.icon
              return (
                <NavLink
                  key={route.path}
                  to={route.path}
                  className={({ isActive }) =>
                    `menu-item ${isActive ? 'menu-item-active' : ''}`
                  }
                >
                  <Icon className="menu-icon" size={18} aria-hidden="true" />
                  <span>{route.title}</span>
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
