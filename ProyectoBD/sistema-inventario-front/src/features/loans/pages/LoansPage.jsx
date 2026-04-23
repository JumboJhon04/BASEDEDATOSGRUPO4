import { useEffect, useState, useMemo } from 'react'
import { Eye, Check, X, Undo2, Bell, Search, Plus } from 'lucide-react'
import ModulePageShell from '@/shared/components/ModulePageShell'
import { getAllLoans, approveLoan, finalizeLoan, rejectLoan } from '../services/loans.service'

function LoansPage() {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filtros
  const [filters, setFilters] = useState({
    estado: 'Todos',
    solicitante: '',
    equipo: ''
  })

  useEffect(() => {
    loadLoans()
  }, [])

  const loadLoans = async () => {
    setLoading(true)
    try {
      const data = await getAllLoans()
      setLoans(data)
    } catch (error) {
      setErrorMessage('Error al cargar la lista de préstamos.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  // Paginación
  const ITEMS_PER_PAGE = 5
  const [page, setPage] = useState(1)

  // Approve modal state
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approvingLoan, setApprovingLoan] = useState(null)
  const [approveSubmitting, setApproveSubmitting] = useState(false)

  // Restriction state
  const [restrictionMessage, setRestrictionMessage] = useState('')

  // Detalle modal state
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectingLoan, setRejectingLoan] = useState(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  // Finalize modal state
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)
  const [finalizingLoan, setFinalizingLoan] = useState(null)
  const [finalizeSubmitting, setFinalizeSubmitting] = useState(false)

  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      const matchEstado = filters.estado === 'Todos' || loan.estado === filters.estado
      const matchSolicitante = loan.nombreUsuario.toLowerCase().includes(filters.solicitante.toLowerCase())
      const matchEquipo = loan.articulos.toLowerCase().includes(filters.equipo.toLowerCase())
      return matchEstado && matchSolicitante && matchEquipo
    })
  }, [loans, filters])

  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / ITEMS_PER_PAGE))
  const pageSafe = Math.min(page, totalPages)
  const pageStart = (pageSafe - 1) * ITEMS_PER_PAGE
  const paginatedLoans = filteredLoans.slice(pageStart, pageStart + ITEMS_PER_PAGE)
  const visibleFrom = filteredLoans.length === 0 ? 0 : pageStart + 1
  const visibleTo = Math.min(pageStart + ITEMS_PER_PAGE, filteredLoans.length)

  // Acciones
  const handleApproveClick = (loan) => {
    setApprovingLoan(loan)
    setShowApproveModal(true)
  }

  const confirmApprove = async () => {
    if (!approvingLoan) return
    setApproveSubmitting(true)
    setErrorMessage('')
    try {
      await approveLoan(approvingLoan.idPrestamo)
      setSuccessMessage(`Préstamo #${String(approvingLoan.idPrestamo).padStart(3, '0')} aprobado y artículos marcados como prestados.`)
      setShowApproveModal(false)
      loadLoans()
    } catch (error) {
      const errorDetail = error.response?.data?.error || error.response?.data?.detail || 'No se pudo aprobar el préstamo. Verifique la disponibilidad de los artículos.'

      // Cerrar modal de aprobación y mostrar modal de restricción profesional
      setShowApproveModal(false)
      setRestrictionMessage(errorDetail)
    } finally {
      setApproveSubmitting(false)
    }
  }

  const handleRejectClick = (loan) => {
    setRejectingLoan(loan)
    setShowRejectModal(true)
  }

  const confirmReject = async () => {
    if (!rejectingLoan) return
    setRejectSubmitting(true)
    setErrorMessage('')
    try {
      await rejectLoan(rejectingLoan.idPrestamo)
      setSuccessMessage(`Solicitud de préstamo #${String(rejectingLoan.idPrestamo).padStart(3, '0')} rechazada.`)
      setShowRejectModal(false)
      loadLoans()
    } catch (error) {
      setErrorMessage('No se pudo rechazar la solicitud.')
      console.error(error)
    } finally {
      setRejectSubmitting(false)
    }
  }

  const handleFinalizeClick = (loan) => {
    setFinalizingLoan(loan)
    setShowFinalizeModal(true)
  }

  const confirmFinalize = async () => {
    if (!finalizingLoan) return
    setFinalizeSubmitting(true)
    setErrorMessage('')
    try {
      await finalizeLoan(finalizingLoan.idPrestamo)
      setSuccessMessage(`Préstamo #${String(finalizingLoan.idPrestamo).padStart(3, '0')} finalizado con éxito.`)
      setShowFinalizeModal(false)
      loadLoans()
    } catch (error) {
      setErrorMessage(error.response?.data?.error ?? 'Error al finalizar el préstamo.')
    } finally {
      setFinalizeSubmitting(false)
    }
  }

  const handleViewDetail = (loan) => {
    setSelectedLoan(loan)
    setShowDetailModal(true)
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'Pendiente': return 'dashboard-status-chip-warning'
      case 'Activo': return 'dashboard-status-chip-info'
      case 'Finalizado': return 'dashboard-status-chip-success'
      case 'Vencido': return 'dashboard-status-chip-danger'
      case 'Rechazado': return 'dashboard-status-chip-neutral'
      default: return 'dashboard-status-chip-neutral'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  return (
    <>
      <ModulePageShell
        title="Módulo de Préstamos"
        description="Administra las solicitudes, entregas y devoluciones de equipos."
      >
        {errorMessage && <div className="feedback-error mb-4">{errorMessage}</div>}
        {successMessage && <div className="feedback-success mb-4">{successMessage}</div>}

      {/* Filtros */}
      <section className="inventory-filters-card">
        <div className="inventory-filter-grid">
          <label>
            <span>Estado</span>
            <select name="estado" value={filters.estado} onChange={handleFilterChange}>
              <option value="Todos">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Activo">Activo</option>
              <option value="Vencido">Vencido</option>
              <option value="Finalizado">Finalizado</option>
            </select>
          </label>

          <label>
            <span>Solicitante</span>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                name="solicitante"
                value={filters.solicitante}
                onChange={handleFilterChange}
                placeholder="Buscar solicitante..."
              />
              <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </label>

          <label>
            <span>Equipo / Artículo</span>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                name="equipo"
                value={filters.equipo}
                onChange={handleFilterChange}
                placeholder="Buscar equipo..."
              />
              <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </label>

          <div className="inventory-filter-actions">
            <button className="btn btn-primary" onClick={() => { loadLoans(); setPage(1); }}>Aplicar Filtros</button>
          </div>
        </div>
      </section>

      <div className="inventory-table-toolbar">
        <div>
          <h3>Registro de Préstamos</h3>
          <p>Mostrando {visibleFrom}-{visibleTo} de {filteredLoans.length} registros</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Nueva Solicitud
        </button>
      </div>

      <div className="inventory-table-card">
        <div className="inventory-table-head inventory-grid" style={{ gridTemplateColumns: '80px 1.5fr 1.2fr 1fr 1fr 120px 240px' }}>
          <span>ID</span>
          <span>Artículo(s)</span>
          <span>Solicitante</span>
          <span>F. Solicitud</span>
          <span>F. Devolución</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>

        <div className="inventory-table-body">
          {loading ? (
            <p className="users-empty">Cargando préstamos...</p>
          ) : paginatedLoans.length === 0 ? (
            <p className="users-empty">No se encontraron préstamos.</p>
          ) : (
            paginatedLoans.map((loan) => (
              <div key={loan.idPrestamo} className="inventory-table-row inventory-grid" style={{ gridTemplateColumns: '80px 1.5fr 1.2fr 1fr 1fr 120px 240px', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', color: '#64748b' }}>#{String(loan.idPrestamo).padStart(3, '0')}</span>
                <span style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>{loan.articulos}</span>
                <span style={{ fontWeight: '500' }}>{loan.nombreUsuario}</span>
                <span>{formatDate(loan.fechaSalida)}</span>
                <span>{formatDate(loan.fechaPrevista)}</span>
                <span>
                  <span className={`dashboard-status-chip ${getStatusClass(loan.estado)}`}>
                    {loan.estado}
                  </span>
                </span>
                <span className="inventory-actions" style={{ display: 'grid', gridTemplateColumns: '120px auto', gap: '8px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {loan.estado === 'Pendiente' && (
                      <>
                        <button
                          className="btn btn-xs"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#22c55e', color: 'white', borderRadius: '8px', fontWeight: '600' }}
                          onClick={() => handleApproveClick(loan)}
                        >
                          <Check size={14} /> Aprobar
                        </button>
                        <button
                          className="btn btn-xs"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ef4444', color: 'white', borderRadius: '8px', fontWeight: '600' }}
                          onClick={() => handleRejectClick(loan)}
                        >
                          <X size={14} /> Rechazar
                        </button>
                      </>
                    )}
                    {(loan.estado === 'Activo' || loan.estado === 'Vencido') && (
                      <button
                        className="btn btn-xs"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f97316', color: 'white', borderRadius: '8px', fontWeight: '600' }}
                        onClick={() => handleFinalizeClick(loan)}
                      >
                        <Undo2 size={14} /> Finalizar
                      </button>
                    )}
                    {loan.estado === 'Vencido' && (
                      <button
                        className="btn btn-xs"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ca8a04', color: 'white', borderRadius: '8px', fontWeight: '600' }}
                      >
                        <Bell size={14} /> Recordar
                      </button>
                    )}
                    {loan.estado === 'Finalizado' && (
                      <div style={{ height: '0px' }}></div>
                    )}
                    {loan.estado === 'Activo' && (
                      <button
                        className="btn btn-xs"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#475569', color: 'white', borderRadius: '8px', fontWeight: '600' }}
                        onClick={() => handleViewDetail(loan)}
                      >
                        <Eye size={14} /> Ver
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(loan.estado === 'Pendiente' || loan.estado === 'Vencido' || loan.estado === 'Finalizado') && (
                      <button
                        className="btn btn-xs"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#475569', color: 'white', borderRadius: '8px', fontWeight: '600' }}
                        onClick={() => handleViewDetail(loan)}
                      >
                        <Eye size={14} /> Ver
                      </button>
                    )}
                  </div>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {filteredLoans.length > 0 && (
        <div className="dashboard-pagination-row inventory-pagination-row">
          <button
            type="button"
            className="dashboard-page-button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={pageSafe === 1}
          >
            Anterior
          </button>
          <div className="dashboard-page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                type="button"
                className={`dashboard-page-button dashboard-page-number ${num === pageSafe ? 'dashboard-page-number-active' : ''}`}
                onClick={() => setPage(num)}
              >
                {num}
              </button>
            ))}
          </div>
          <span className="dashboard-page-info">Página {pageSafe} de {totalPages}</span>
          <button
            type="button"
            className="dashboard-page-button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={pageSafe === totalPages}
          >
            Siguiente
          </button>
        </div>
      )}

    </ModulePageShell>

    {/* ---------- Modales Fuera del Shell (Para superposición correcta) ---------- */}

    {/* ---------- Modal: Ver Detalle ---------- */}
    {showDetailModal && selectedLoan && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 25 }} role="presentation" onClick={() => setShowDetailModal(false)}>
        <section
          className="modal-card"
          style={{ maxWidth: '500px', position: 'relative' }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="modal-header">
            <h2>Detalle del Préstamo #{String(selectedLoan.idPrestamo).padStart(3, '0')}</h2>
            <button type="button" className="icon-button" onClick={() => setShowDetailModal(false)}>
              <X size={18} />
            </button>
          </header>
          <div className="articulo-modal-body" style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ fontWeight: '700', color: '#64748b', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Solicitante</label>
                <p style={{ fontWeight: '500', color: '#1e293b' }}>{selectedLoan.nombreUsuario}</p>
              </div>
              <div>
                <label style={{ fontWeight: '700', color: '#64748b', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Estado</label>
                <span className={`dashboard-status-chip ${getStatusClass(selectedLoan.estado)}`}>
                  {selectedLoan.estado}
                </span>
              </div>
              <div>
                <label style={{ fontWeight: '700', color: '#64748b', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Fecha Solicitud</label>
                <p style={{ color: '#1e293b' }}>{formatDate(selectedLoan.fechaSalida)}</p>
              </div>
              <div>
                <label style={{ fontWeight: '700', color: '#64748b', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Fecha Prevista</label>
                <p style={{ color: '#1e293b' }}>{formatDate(selectedLoan.fechaPrevista)}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontWeight: '700', color: '#64748b', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Artículos / Equipos</label>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                  {selectedLoan.articulos.split(',').map((art, idx) => (
                    <p key={idx} style={{ fontSize: '0.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      • {art.trim()}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <footer className="users-form-footer" style={{ padding: '16px 20px' }}>
            <button className="btn btn-primary" type="button" onClick={() => setShowDetailModal(false)}>
              Cerrar
            </button>
          </footer>
        </section>
      </div>
    )}

    {/* ---------- Modal: Confirmar Aprobación ---------- */}
    {showApproveModal && approvingLoan && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 25 }} role="presentation" onClick={() => !approveSubmitting && setShowApproveModal(false)}>
        <section
          className="modal-card"
          style={{ maxWidth: '400px', borderTop: '5px solid #22c55e', position: 'relative' }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="modal-header">
            <h2 style={{ color: '#15803d' }}>Confirmar Entrega</h2>
            <button type="button" className="icon-button" onClick={() => setShowApproveModal(false)} disabled={approveSubmitting}>
              <X size={18} />
            </button>
          </header>
          <div className="articulo-modal-body" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#f0fdf4', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#22c55e' }}>
              <Check size={32} />
            </div>
            <h3 style={{ marginBottom: '8px', color: '#1e293b' }}>¿Aprobar solicitud #{String(approvingLoan.idPrestamo).padStart(3, '0')}?</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Al confirmar, el préstamo pasará a estado <strong>Activo</strong> y los artículos se marcarán como <strong>Prestados</strong> en el inventario.
            </p>

            {errorMessage && (
              <div style={{ marginTop: '16px', padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem', textAlign: 'left' }}>
                <strong>Error:</strong> {errorMessage}
              </div>
            )}

            <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem' }}>
              <p><strong>Solicitante:</strong> {approvingLoan.nombreUsuario}</p>
              <p><strong>Equipos:</strong> {approvingLoan.articulos}</p>
            </div>
          </div>
          <footer className="users-form-footer" style={{ padding: '16px 20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" type="button" onClick={() => setShowApproveModal(false)} disabled={approveSubmitting}>
              Cancelar
            </button>
            <button
              className="btn"
              style={{ backgroundColor: '#22c55e', color: 'white' }}
              type="button"
              onClick={confirmApprove}
              disabled={approveSubmitting}
            >
              {approveSubmitting ? 'Procesando...' : 'Confirmar Aprobación'}
            </button>
          </footer>
        </section>
      </div>
    )}

    {/* ---------- Modal: Restricción (Aviso Profesional) ---------- */}
    {restrictionMessage ? (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 25 }} role="presentation" onClick={() => setRestrictionMessage('')}>
        <section
          className="modal-card"
          style={{ maxWidth: '450px', borderLeft: '5px solid #ef4444', position: 'relative' }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="modal-header">
            <h2 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Error en Aprobación
            </h2>
            <button type="button" className="icon-button" onClick={() => setRestrictionMessage('')}>
              <X size={18} />
            </button>
          </header>
          <div className="articulo-modal-body" style={{ padding: '24px' }}>
            <p style={{ lineHeight: '1.6', color: '#4b5563', fontSize: '0.95rem' }}>
              {restrictionMessage}
            </p>
          </div>
          <footer className="users-form-footer" style={{ padding: '16px 20px', background: '#fef2f2' }}>
            <button className="btn btn-primary" style={{ background: '#dc2626' }} type="button" onClick={() => setRestrictionMessage('')}>
              Entendido
            </button>
          </footer>
        </section>
      </div>
    ) : null}

    {/* ---------- Modal: Confirmar Rechazo ---------- */}
    {showRejectModal && rejectingLoan && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 25 }} role="presentation" onClick={() => !rejectSubmitting && setShowRejectModal(false)}>
        <section
          className="modal-card"
          style={{ maxWidth: '400px', borderTop: '5px solid #ef4444', position: 'relative' }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="modal-header">
            <h2 style={{ color: '#dc2626' }}>Rechazar Solicitud</h2>
            <button type="button" className="icon-button" onClick={() => setShowRejectModal(false)} disabled={rejectSubmitting}>
              <X size={18} />
            </button>
          </header>
          <div className="articulo-modal-body" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#fef2f2', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#ef4444' }}>
              <X size={32} />
            </div>
            <h3 style={{ marginBottom: '8px', color: '#1e293b' }}>¿Rechazar solicitud #{String(rejectingLoan.idPrestamo).padStart(3, '0')}?</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Al rechazar, el préstamo quedará invalidado y los artículos seguirán disponibles para otros usuarios.
            </p>
            <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem' }}>
              <p><strong>Solicitante:</strong> {rejectingLoan.nombreUsuario}</p>
              <p><strong>Equipos:</strong> {rejectingLoan.articulos}</p>
            </div>
          </div>
          <footer className="users-form-footer" style={{ padding: '16px 20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" type="button" onClick={() => setShowRejectModal(false)} disabled={rejectSubmitting}>
              Cancelar
            </button>
            <button
              className="btn"
              style={{ backgroundColor: '#ef4444', color: 'white' }}
              type="button"
              onClick={confirmReject}
              disabled={rejectSubmitting}
            >
              {rejectSubmitting ? 'Procesando...' : 'Confirmar Rechazo'}
            </button>
          </footer>
        </section>
      </div>
    )}

    {/* ---------- Modal: Confirmar Finalización (Devolución) ---------- */}
    {showFinalizeModal && finalizingLoan && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 25 }} role="presentation" onClick={() => !finalizeSubmitting && setShowFinalizeModal(false)}>
        <section
          className="modal-card"
          style={{ maxWidth: '400px', borderTop: '5px solid #f97316', position: 'relative' }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="modal-header">
            <h2 style={{ color: '#ea580c' }}>Confirmar Devolución</h2>
            <button type="button" className="icon-button" onClick={() => setShowFinalizeModal(false)} disabled={finalizeSubmitting}>
              <X size={18} />
            </button>
          </header>
          <div className="articulo-modal-body" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#fff7ed', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#f97316' }}>
              <Undo2 size={32} />
            </div>
            <h3 style={{ marginBottom: '8px', color: '#1e293b' }}>¿Finalizar préstamo #{String(finalizingLoan.idPrestamo).padStart(3, '0')}?</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Al confirmar, el préstamo se marcará como <strong>Finalizado</strong> y los equipos volverán a estar <strong>Disponibles</strong> en el inventario.
            </p>
            <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem' }}>
              <p><strong>Solicitante:</strong> {finalizingLoan.nombreUsuario}</p>
              <p><strong>Equipos a recibir:</strong> {finalizingLoan.articulos}</p>
            </div>
          </div>
          <footer className="users-form-footer" style={{ padding: '16px 20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" type="button" onClick={() => setShowFinalizeModal(false)} disabled={finalizeSubmitting}>
              Cancelar
            </button>
            <button
              className="btn"
              style={{ backgroundColor: '#f97316', color: 'white' }}
              type="button"
              onClick={confirmFinalize}
              disabled={finalizeSubmitting}
            >
              {finalizeSubmitting ? 'Procesando...' : 'Confirmar Devolución'}
            </button>
          </footer>
        </section>
      </div>
    )}
  </>
  )
}

export default LoansPage
