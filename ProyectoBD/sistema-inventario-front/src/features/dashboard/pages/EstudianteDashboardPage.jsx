import { useMemo, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import ModulePageShell from '@/shared/components/ModulePageShell'
import useAuth from '@/core/auth/useAuth'
import { getMyLoans } from '@/features/loans/services/loans.service'
import { pick, normalizeText, formatDateISO, getPrestamoStatusClass, getPageNumbers } from '@/features/dashboard/utils/dashboardFormat'

const ITEMS_PER_PAGE = 3

function isLoanActive(loan) {
  return normalizeText(pick(loan, 'estado', 'Estado') ?? '') === 'activo'
}

function isLoanOverdue(loan) {
  const estado = normalizeText(pick(loan, 'estado', 'Estado') ?? '')
  if (estado === 'vencido') return true
  if (estado === 'finalizado') return false

  const fechaPrevista = pick(loan, 'fechaPrevista', 'FechaPrevista')
  if (!fechaPrevista) return false

  const parsedDate = new Date(fechaPrevista)
  if (Number.isNaN(parsedDate.getTime())) return false

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return parsedDate < hoy
}

function formatDaysLeft(loan) {
  const fechaPrevista = pick(loan, 'fechaPrevista', 'FechaPrevista')
  if (!fechaPrevista) return 'Sin fecha prevista'

  const parsedDate = new Date(fechaPrevista)
  if (Number.isNaN(parsedDate.getTime())) return 'Sin fecha prevista'

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const diffMs = parsedDate.getTime() - hoy.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return `Vencido hace ${Math.abs(diffDays)} día${Math.abs(diffDays) === 1 ? '' : 's'}`
  }

  if (diffDays === 0) return 'Entrega hoy'
  if (diffDays === 1) return 'Te queda 1 día'
  return `Te quedan ${diffDays} días`
}

function getLoanAlertText(loan) {
  const nombreArticulo = pick(loan, 'articulos', 'Articulos') ?? 'tu artículo'
  if (isLoanOverdue(loan)) {
    return `El artículo ${nombreArticulo} está vencido. Debes devolverlo cuanto antes.`
  }

  return `Te falta ${formatDaysLeft(loan)} para entregar ${nombreArticulo}.`
}

function EstudianteDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userName, userId } = useAuth()

  const initials = useMemo(() => {
    return (
      userName
        ?.split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'ES'
    )
  }, [userName])

  const isLoansView = location.pathname.startsWith('/mis-prestamos')

  const [loansPreview, setLoansPreview] = useState([])
  const [loansData, setLoansData] = useState([])
  const [loansLoading, setLoansLoading] = useState(false)
  const [loansError, setLoansError] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoansLoading(true)
      setLoansError('')
      try {
        const data = await getMyLoans()
        if (!mounted) return
        const filtered = Array.isArray(data) ? data : []
        setLoansData(filtered)
        setLoansPreview(filtered.slice(0, ITEMS_PER_PAGE))
      } catch (err) {
        // Silenciosamente degradamos si no hay permisos (403) o falla el backend
        const status = err?.response?.status
        if (status === 403) {
          setLoansError('No tienes permiso para ver préstamos globales desde el servidor.')
        } else {
          setLoansError('No se pudieron cargar tus préstamos. Intenta acceder a "Mis préstamos".')
        }
      } finally {
        if (mounted) setLoansLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [userName])

  const activeLoansCount = useMemo(
    () => loansData.filter((loan) => isLoanActive(loan)).length,
    [loansData],
  )

  const overdueLoansCount = useMemo(
    () => loansData.filter((loan) => isLoanOverdue(loan)).length,
    [loansData],
  )

  const notifications = useMemo(() => {
    return loansData
      .filter((loan) => {
        if (isLoanOverdue(loan)) return true
        if (isLoanActive(loan)) {
          const fechaPrevista = pick(loan, 'fechaPrevista', 'FechaPrevista')
          if (!fechaPrevista) return false
          const parsedDate = new Date(fechaPrevista)
          if (Number.isNaN(parsedDate.getTime())) return false
          const hoy = new Date()
          hoy.setHours(0, 0, 0, 0)
          const diffMs = parsedDate.getTime() - hoy.getTime()
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
          return diffDays <= 2 && diffDays >= 0
        }
        return false
      })
      .slice(0, ITEMS_PER_PAGE)
  }, [loansData])

  const notificationCount = notifications.length
  const pageNumbers = getPageNumbers(Math.max(1, Math.ceil(loansPreview.length / ITEMS_PER_PAGE)))

  return (
    <ModulePageShell
      title={isLoansView ? 'Mis préstamos' : 'Panel General'}
      description={
        isLoansView
          ? `Consulta tu información personal${userName ? `, ${userName}` : ''}.`
          : `Bienvenido${userName ? `, ${userName}` : ''}. Este panel resume tu información personal.`
      }
    >
      <div className="dashboard-docente-shell">
        <div className="dashboard-docente-main">
          <section className="dashboard-section-topline" style={{ marginBottom: '8px' }}>
            <h3>{`Bienvenido ${userName || 'Estudiante'}`}</h3>
          </section>

          <section className="dashboard-kpi-row dashboard-docente-kpi">
            <article className="dashboard-kpi-card dashboard-kpi-card-info">
              <span className="dashboard-kpi-title">Préstamos activos</span>
              <strong className="dashboard-kpi-value">
                {loansLoading ? '…' : activeLoansCount}
              </strong>
              <div className="dashboard-kpi-meter" aria-hidden="true">
                <span style={{ width: `${loansLoading ? 0 : Math.min(100, activeLoansCount * 20 + 15)}%` }} />
              </div>
            </article>

            <article className="dashboard-kpi-card dashboard-kpi-card-danger">
              <span className="dashboard-kpi-title">Préstamos retrasados</span>
              <strong className="dashboard-kpi-value">
                {loansLoading ? '…' : overdueLoansCount}
              </strong>
              <div className="dashboard-kpi-meter" aria-hidden="true">
                <span style={{ width: `${loansLoading ? 0 : Math.min(100, overdueLoansCount * 35 + 15)}%` }} />
              </div>
            </article>
          </section>

          <section className="dashboard-table-section">
            <div className="dashboard-section-topline">
            </div>
            <span style={{ width: `${loansLoading ? 0 : Math.min(100, overdueLoansCount * 35 + 15)}%` }} />
            <div className="dashboard-table-card">
              {loansLoading ? (
                <div style={{ padding: 20 }}>Cargando tus préstamos...</div>
              ) : loansError ? (
                <div style={{ padding: 20 }}>
                  <p style={{ margin: 0, color: '#475569' }}>{loansError}</p>
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/mis-prestamos')}>Ver mis préstamos</button>
                    <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => navigate('/inventario')}>Ir al catálogo</button>
                  </div>
                </div>
              ) : loansPreview.length === 0 ? (
                <div style={{ padding: 20 }}>
                  <p style={{ margin: 0, color: '#475569' }}>No tienes préstamos activos para mostrar en este panel.</p>
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/mis-prestamos')}>Ver mis préstamos</button>
                    <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => navigate('/inventario')}>Ir al catálogo</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="dashboard-table-head dashboard-docente-loan-grid" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 0.6fr' }}>
                    <span>Equipo</span>
                    <span>Fecha Salida</span>
                    <span>Fecha Prevista</span>
                    <span>Estado</span>
                    <span>Acciones</span>
                  </div>
                  <div className="dashboard-table-body">
                    {loansPreview.map((loan) => {
                      const equipo = pick(loan, 'articulos', 'Articulos') ?? '-'
                      const fechaSalida = formatDateISO(pick(loan, 'fechaSalida', 'FechaSalida'))
                      const fechaPrevista = formatDateISO(pick(loan, 'fechaPrevista', 'FechaPrevista'))
                      const estado = pick(loan, 'estado', 'Estado') ?? '-'
                      return (
                        <div key={loan.idPrestamo || Math.random()} className="dashboard-table-row dashboard-docente-loan-grid" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 0.6fr' }}>
                          <span className="dashboard-table-strong">{equipo}</span>
                          <span>{fechaSalida}</span>
                          <span>{fechaPrevista}</span>
                          <span><span className={`dashboard-status-chip ${getPrestamoStatusClass(estado)}`}>{estado}</span></span>
                          <span>
                            <button type="button" className="dashboard-action-button" onClick={() => navigate('/mis-prestamos')}>Ver</button>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="dashboard-docente-alerts" aria-labelledby="estudiante-alertas-titulo">
          <div className="dashboard-docente-alerts-head">
            <div>
              <span className="dashboard-docente-alerts-kicker">Alertas</span>
              <h3 id="estudiante-alertas-titulo">Alertas</h3>
              <p className="dashboard-docente-alerts-sub">
                Notificaciones automáticas de tus préstamos activos y vencidos.
              </p>
            </div>
            <div className="dashboard-docente-alerts-countbox" aria-label="Perfil de estudiante">
              <strong>{loansLoading ? '…' : notificationCount}</strong>
              <span>avisos</span>
            </div>
          </div>

          {loansLoading ? (
            <p className="users-empty">Cargando alertas…</p>
          ) : notifications.length === 0 ? (
            <div className="dashboard-docente-alerts-emptybox">
              <p className="dashboard-docente-alerts-empty">No hay notificaciones pendientes.</p>
            </div>
          ) : (
            <ul className="dashboard-docente-alerts-list">
              {notifications.map((loan) => {
                const articulo = pick(loan, 'articulos', 'Articulos') ?? 'Artículo'
                const fechaPrevista = formatDateISO(pick(loan, 'fechaPrevista', 'FechaPrevista'))
                const message = getLoanAlertText(loan)
                const overdue = isLoanOverdue(loan)
                return (
                  <li key={loan.idPrestamo} className="dashboard-docente-alerts-item">
                    <span className="dashboard-docente-alerts-item-icon" aria-hidden="true">
                      <AlertTriangle size={16} aria-hidden="true" />
                    </span>
                    <div className="dashboard-docente-alerts-item-body">
                      <strong>{articulo}</strong>
                      <p>{message}</p>
                      <small>
                        {overdue ? `Vencido · ${fechaPrevista}` : `Entrega límite ${fechaPrevista}`}
                      </small>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
      </div>
    </ModulePageShell>
  )
}

export default EstudianteDashboardPage