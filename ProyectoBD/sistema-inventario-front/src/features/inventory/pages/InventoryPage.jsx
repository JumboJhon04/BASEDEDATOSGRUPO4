import { useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, Archive, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModulePageShell from '@/shared/components/ModulePageShell'
import {
  getArticuloImages,
  getCategorias,
  getInventoryCatalog,
  getUbicaciones,
  linkArticuloImage,
  updateArticulo,
  createArticulo,
} from '@/features/inventory/services/inventory.service'
import { getUsers } from '@/features/users/services/users.service'
import { uploadImageToCloudinary } from '@/features/inventory/services/cloudinary.service'

const ITEMS_PER_PAGE = 5

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getEstadoChipClass(estado) {
  const normalizedEstado = normalizeText(estado)
  if (normalizedEstado === 'disponible') return 'dashboard-status-chip-success'
  if (normalizedEstado === 'prestado') return 'dashboard-status-chip-info'
  if (normalizedEstado === 'vencido') return 'dashboard-status-chip-danger'
  if (normalizedEstado === 'mantenimiento') return 'dashboard-status-chip-warning'
  if (normalizedEstado === 'dadodebaja') return 'dashboard-status-chip-neutral'
  return 'dashboard-status-chip-neutral'
}

const initialEditForm = {
  codigo: '',
  nombre: '',
  marca: '',
  modelo: '',
  numeroSerie: '',
  descripcionTecnica: '',
  observacionesFisicas: '',
  idCategoria: '',
  idUbicacion: '',
  idResponsable: '',
}

function InventoryPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [articulos, setArticulos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [ubicaciones, setUbicaciones] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [appliedFilters, setAppliedFilters] = useState({
    categoria: 'Todos',
    estado: 'Todos',
    ubicacion: 'Todos',
    responsable: '',
    general: '',
  })
  const [draftFilters, setDraftFilters] = useState(appliedFilters)
  const [page, setPage] = useState(1)

  // Baja state
  const [bajaArticulo, setBajaArticulo] = useState(null)
  const [showBajaModal, setShowBajaModal] = useState(false)
  const [bajaSubmitting, setBajaSubmitting] = useState(false)
  const [bajaError, setBajaError] = useState('')
  const [restrictionMessage, setRestrictionMessage] = useState('') // Mensaje para modal de restricción
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingArticulo, setEditingArticulo] = useState(null)
  const [editForm, setEditForm] = useState(initialEditForm)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')

  // Image upload state (inside edit modal)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadError, setUploadError] = useState('')

  const loadInventory = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const [catalogoRes, categoriasRes, ubicacionesRes, usuariosRes] = await Promise.all([
        getInventoryCatalog(),
        getCategorias(),
        getUbicaciones(),
        getUsers(),
      ])
      setArticulos(catalogoRes)
      setCategorias(categoriasRes)
      setUbicaciones(ubicacionesRes)
      setUsuarios(usuariosRes)
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ??
        'No se pudo cargar el inventario. Verifica la conexion con el backend.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      setLoading(true)
      setErrorMessage('')
      try {
        const [catalogoRes, categoriasRes, ubicacionesRes, usuariosRes] = await Promise.all([
          getInventoryCatalog(),
          getCategorias(),
          getUbicaciones(),
          getUsers(),
        ])
        if (!isMounted) return
        setArticulos(catalogoRes)
        setCategorias(categoriasRes)
        setUbicaciones(ubicacionesRes)
        setUsuarios(usuariosRes)
      } catch (error) {
        if (!isMounted) return
        setErrorMessage(
          error.response?.data?.message ??
          'No se pudo cargar el inventario. Verifica la conexion con el backend.',
        )
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [])

  const filterOptions = useMemo(() => {
    const categories = [...new Set(articulos.map((item) => item.categoria).filter(Boolean))].sort()
    const locations = [...new Set(articulos.map((item) => item.ubicacion).filter(Boolean))].sort()
    return { categories, locations }
  }, [articulos])

  const filteredArticulos = useMemo(() => {
    return articulos.filter((item) => {
      const matchesCategoria =
        appliedFilters.categoria === 'Todos' || item.categoria === appliedFilters.categoria
      const matchesEstado =
        appliedFilters.estado === 'Todos' ||
        normalizeText(item.estado) === normalizeText(appliedFilters.estado)
      const matchesUbicacion =
        appliedFilters.ubicacion === 'Todos' || item.ubicacion === appliedFilters.ubicacion
      const matchesResponsable =
        !appliedFilters.responsable ||
        normalizeText(item.responsable).includes(normalizeText(appliedFilters.responsable))
      
      const matchesGeneral = 
        !appliedFilters.general ||
        normalizeText(item.nombre).includes(normalizeText(appliedFilters.general))

      return matchesCategoria && matchesEstado && matchesUbicacion && matchesResponsable && matchesGeneral
    })
  }, [appliedFilters, articulos])

  const totalPages = Math.max(1, Math.ceil(filteredArticulos.length / ITEMS_PER_PAGE))
  const pageSafe = Math.min(page, totalPages)
  const pageStart = (pageSafe - 1) * ITEMS_PER_PAGE
  const paginatedArticulos = filteredArticulos.slice(pageStart, pageStart + ITEMS_PER_PAGE)
  const visibleFrom = filteredArticulos.length === 0 ? 0 : pageStart + 1
  const visibleTo = Math.min(pageStart + ITEMS_PER_PAGE, filteredArticulos.length)

  const handleDraftChange = (e) => {
    const { name, value } = e.target
    setDraftFilters((prev) => ({ ...prev, [name]: value }))
    
    // Si es responsable o general, aplicamos el filtro en tiempo real
    if (name === 'responsable' || name === 'general') {
      setAppliedFilters((prev) => ({ ...prev, [name]: value }))
    }
  }

  const applyFilters = () => {
    setAppliedFilters(draftFilters)
    setPage(1)
  }

  const clearFilters = () => {
    const resetFilters = { categoria: 'Todos', estado: 'Todos', ubicacion: 'Todos', responsable: '', general: '' }
    setDraftFilters(resetFilters)
    setAppliedFilters(resetFilters)
    setPage(1)
  }

  // ---------- Edit modal ----------
  const openEditModal = (item) => {
    setEditingArticulo(item)
    setEditForm({
      codigo: item.codigoInstitucional ?? item.CodigoInstitucional ?? '',
      nombre: item.nombre ?? item.Nombre ?? '',
      marca: item.marca ?? item.Marca ?? '',
      modelo: item.modelo ?? item.Modelo ?? '',
      numeroSerie: item.numeroSerie ?? item.NumeroSerie ?? '',
      descripcionTecnica: item.descripcionTecnica ?? item.DescripcionTecnica ?? '',
      observacionesFisicas: item.observacionesFisicas ?? item.ObservacionesFisicas ?? '',
      idCategoria: (item.idCategoria ?? item.IdCategoria) ? String(item.idCategoria ?? item.IdCategoria) : '',
      idUbicacion: (item.idUbicacion ?? item.IdUbicacion) ? String(item.idUbicacion ?? item.IdUbicacion) : '',
      idResponsable: (item.idResponsable ?? item.IdResponsable) ? String(item.idResponsable ?? item.IdResponsable) : '',
    })
    setEditError('')
    setEditSuccess('')
    setSelectedFile(null)
    setUploadError('')
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingArticulo(null)
    setEditError('')
    setEditSuccess('')
    setSelectedFile(null)
    setUploadError('')
  }

  // ---------- Create modal ----------
  const openCreateModal = () => {
    setEditForm(initialEditForm)
    setEditError('')
    setEditSuccess('')
    setSelectedFile(null)
    setUploadError('')
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setEditError('')
    setEditSuccess('')
    setSelectedFile(null)
    setUploadError('')
  }

  const handleCreateSubmit = async (event) => {
    event.preventDefault()
    if (!editForm.codigo || !editForm.nombre || !editForm.idCategoria || !editForm.idUbicacion) {
      setEditError('Completa los campos obligatorios: Código, Nombre, Categoría y Ubicación.')
      return
    }
    setEditSubmitting(true)
    setEditError('')
    setEditSuccess('')
    try {
      const payload = {
        codigo: editForm.codigo.trim(),
        nombre: editForm.nombre.trim(),
        marca: editForm.marca.trim() || null,
        modelo: editForm.modelo.trim() || null,
        numeroSerie: editForm.numeroSerie.trim() || null,
        descripcionTecnica: editForm.descripcionTecnica.trim() || null,
        observacionesFisicas: editForm.observacionesFisicas.trim() || null,
        idCategoria: Number(editForm.idCategoria),
        idUbicacion: Number(editForm.idUbicacion),
        idResponsable: Number(editForm.idResponsable) || 0,
      }

      const response = await createArticulo(payload)
      
      // El back no devuelve el ID, así que lo buscamos en el catálogo por su código único
      let newArtId = response.idArticulo ?? response.IdArticulo

      if (!newArtId) {
        const freshCatalog = await getInventoryCatalog()
        const found = freshCatalog.find(a => 
          (a.codigoInstitucional ?? a.CodigoInstitucional) === payload.codigo
        )
        newArtId = found?.idArticulo ?? found?.IdArticulo
      }
 
      if (selectedFile && newArtId) {
        const { secureUrl } = await uploadImageToCloudinary(selectedFile)
        await linkArticuloImage(newArtId, secureUrl)
      }

      closeCreateModal()
      await loadInventory()
    } catch (error) {
      setEditError(
        error.response?.data?.message ?? 'No se pudo crear el artículo. Revisa los datos.',
      )
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleEditChange = (event) => {
    const { name, value } = event.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditSubmit = async (event) => {
    event.preventDefault()
    if (!editForm.codigo || !editForm.nombre || !editForm.idCategoria || !editForm.idUbicacion) {
      setEditError('Completa los campos obligatorios: Código, Nombre, Categoría y Ubicación.')
      return
    }
    setEditSubmitting(true)
    setEditError('')
    setEditSuccess('')
    try {
      const payload = {
        codigo: editForm.codigo.trim(),
        nombre: editForm.nombre.trim(),
        marca: editForm.marca.trim() || null,
        modelo: editForm.modelo.trim() || null,
        numeroSerie: editForm.numeroSerie.trim() || null,
        descripcionTecnica: editForm.descripcionTecnica.trim() || null,
        observacionesFisicas: editForm.observacionesFisicas.trim() || null,
        idCategoria: Number(editForm.idCategoria),
        idUbicacion: Number(editForm.idUbicacion),
        idResponsable: Number(editForm.idResponsable) || editingArticulo.idResponsable,
        estado: editingArticulo.estado,
      }
      const idSano = editingArticulo.idArticulo ?? editingArticulo.IdArticulo
      await updateArticulo(idSano, payload)

      // Si se seleccionó una imagen, subirla y vincularla
      if (selectedFile) {
        const { secureUrl } = await uploadImageToCloudinary(selectedFile)
        await linkArticuloImage(idSano, secureUrl)
      }

      closeEditModal()
      await loadInventory()
    } catch (error) {
      setEditError(
        error.response?.data?.message ?? 'No se pudo actualizar el artículo. Revisa los datos.',
      )
    } finally {
      setEditSubmitting(false)
    }
  }

  // ---------- Image file selection ----------
  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null
    setUploadError('')
    if (!file) { setSelectedFile(null); return }
    if (!file.type.startsWith('image/')) {
      setUploadError('Solo puedes subir archivos de imagen.')
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
  }
 
  // ---------- Baja (Dar de baja) ----------
  const handleBajaClick = (item) => {
    const estado = normalizeText(item.estado)
    if (estado === 'prestado') {
      setRestrictionMessage('Restricción de Seguridad: El artículo seleccionado se encuentra bajo un proceso de préstamo activo. Por razones de integridad de datos, debe ser devuelto al inventario antes de proceder con su baja definitiva.')
      return
    }
    if (estado === 'dadodebaja') {
      setRestrictionMessage('Aviso de Inventario: El artículo ya ha sido procesado como "Dado de Baja" y se encuentra fuera del inventario activo.')
      return
    }
    setRestrictionMessage('')
    setBajaArticulo(item)
    setBajaError('')
    setShowBajaModal(true)
  }
 
  const confirmBaja = async () => {
    if (!bajaArticulo) return
    setBajaSubmitting(true)
    setBajaError('')
    try {
      const payload = {
        codigo: (bajaArticulo.codigoInstitucional ?? bajaArticulo.CodigoInstitucional),
        nombre: bajaArticulo.nombre,
        marca: bajaArticulo.marca,
        modelo: bajaArticulo.modelo,
        numeroSerie: bajaArticulo.numeroSerie,
        descripcionTecnica: bajaArticulo.descripcionTecnica,
        observacionesFisicas: bajaArticulo.observacionesFisicas,
        idCategoria: bajaArticulo.idCategoria,
        idUbicacion: bajaArticulo.idUbicacion,
        idResponsable: bajaArticulo.idResponsable,
        estado: 'DadoDeBaja', // Cambiamos el estado
      }
      
      const idSano = bajaArticulo.idArticulo ?? bajaArticulo.IdArticulo
      await updateArticulo(idSano, payload)
      
      setShowBajaModal(false)
      setBajaArticulo(null)
      await loadInventory()
    } catch (error) {
      setBajaError(error.response?.data?.message ?? 'No se pudo dar de baja el artículo.')
    } finally {
      setBajaSubmitting(false)
    }
  }


  return (
    <>
      <ModulePageShell
        title="Gestion de Inventario"
        description="Consulta y administra los articulos desde el listado principal."
      >
        {errorMessage ? <p className="feedback-error">{errorMessage}</p> : null}

        <section className="inventory-filters-card">
          <div className="inventory-filter-grid">
            <label>
              <span>Categoría</span>
              <select name="categoria" value={draftFilters.categoria} onChange={handleDraftChange}>
                <option value="Todos">Todos</option>
                {filterOptions.categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Estado</span>
              <select name="estado" value={draftFilters.estado} onChange={handleDraftChange}>
                <option value="Todos">Todos</option>
                <option value="Disponible">Disponible</option>
                <option value="Prestado">Prestado</option>
                <option value="Mantenimiento">Mantenimiento</option>
              </select>
            </label>

            <label>
              <span>Ubicación</span>
              <select name="ubicacion" value={draftFilters.ubicacion} onChange={handleDraftChange}>
                <option value="Todos">Todos</option>
                {filterOptions.locations.map((location) => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </label>

            <label>
            <span>Buscar por Nombre</span>
            <input
              type="text"
              name="general"
              value={draftFilters.general}
              onChange={handleDraftChange}
              placeholder="Ej: Laptop, Proyector..."
            />
          </label>

          <label>
            <span>Responsable</span>
            <input
              type="text"
              name="responsable"
              value={draftFilters.responsable}
              onChange={handleDraftChange}
              placeholder="Nombre del responsable"
            />
          </label>

            <div className="inventory-filter-actions">
              <button className="btn btn-primary" type="button" onClick={applyFilters}>
                Aplicar Filtros
              </button>
              <button className="btn btn-ghost" type="button" onClick={clearFilters}>
                Limpiar
              </button>
            </div>
          </div>
        </section>

        <div className="inventory-table-toolbar">
          <div>
            <h3>Listado de Artículos</h3>
            <p>Mostrando {visibleFrom}-{visibleTo} de {filteredArticulos.length} resultados</p>
          </div>
          <button className="btn btn-primary" type="button" onClick={openCreateModal}>
            + Añadir Artículo
          </button>
        </div>

        <div className="inventory-table-card">
          <div className="inventory-table-head inventory-grid">
            <span>ID</span>
            <span>Nombre</span>
            <span>Categoría</span>
            <span>Estado</span>
            <span>Ubicación</span>
            <span>Responsable</span>
            <span>Acciones</span>
          </div>

          <div className="inventory-table-body">
            {loading ? (
              <p className="users-empty">Cargando inventario...</p>
            ) : paginatedArticulos.length === 0 ? (
              <p className="users-empty">No hay artículos para mostrar con esos filtros.</p>
            ) : (
              paginatedArticulos.map((item) => (
                <article className="inventory-table-row inventory-grid" key={item.idArticulo}>
                  <span>{String(item.idArticulo).padStart(3, '0')}</span>
                  <span>{item.nombre}</span>
                  <span>{item.categoria || '-'}</span>
                  <span>
                    <span className={`dashboard-status-chip ${getEstadoChipClass(item.estado)}`}>
                      {item.estado}
                    </span>
                  </span>
                  <span>{item.ubicacion || '-'}</span>
                  <span>{item.responsable || '-'}</span>
                  <span className="inventory-actions">
                    <button
                      type="button"
                      className="inventory-icon-button inventory-icon-button-view"
                      title="Mirar detalle"
                      aria-label="Mirar detalle"
                      onClick={() => navigate(`/inventario/detalle/${item.idArticulo}`)}
                    >
                      <Eye size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="inventory-icon-button inventory-icon-button-edit"
                      title="Editar artículo"
                      aria-label="Editar artículo"
                      onClick={() => openEditModal(item)}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="inventory-icon-button inventory-icon-button-delete"
                      title="Dar de baja artículo"
                      aria-label="Dar de baja artículo"
                      onClick={() => handleBajaClick(item)}
                    >
                      <Archive size={16} aria-hidden="true" />
                    </button>
                  </span>
                </article>
              ))
            )}
          </div>
        </div>

        {filteredArticulos.length > 0 ? (
          <div className="dashboard-pagination-row inventory-pagination-row">
            <button
              type="button"
              className="dashboard-page-button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={pageSafe === 1}
            >
              Anterior
            </button>
            <div className="dashboard-page-numbers" role="group" aria-label="Paginacion de inventario">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`dashboard-page-button dashboard-page-number ${pageNumber === pageSafe ? 'dashboard-page-number-active' : ''
                    }`}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
            <span className="dashboard-page-info">Página {pageSafe} de {totalPages}</span>
            <button
              type="button"
              className="dashboard-page-button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={pageSafe === totalPages}
            >
              Siguiente
            </button>
          </div>
        ) : null}

      </ModulePageShell>

      {/* ── Edit Modal ── */}
      {showEditModal ? (
        <div className="modal-backdrop" role="presentation" onClick={closeEditModal}>
          <section
            className="modal-card articulo-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-articulo-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <h2 id="edit-articulo-title">Editar Artículo</h2>
              <button type="button" className="icon-button" onClick={closeEditModal} aria-label="Cerrar modal">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="articulo-modal-body">
              <form className="articulo-form" onSubmit={handleEditSubmit}>
                <label>
                  Código Institucional *
                  <input name="codigo" value={editForm.codigo} onChange={handleEditChange} placeholder="Ej: LAB-UTA-001" />
                </label>

                <label>
                  Nombre *
                  <input name="nombre" value={editForm.nombre} onChange={handleEditChange} placeholder="Nombre del artículo" />
                </label>

                <label>
                  Marca
                  <input name="marca" value={editForm.marca} onChange={handleEditChange} placeholder="Marca" />
                </label>

                <label>
                  Modelo
                  <input name="modelo" value={editForm.modelo} onChange={handleEditChange} placeholder="Modelo" />
                </label>

                <label>
                  Número de Serie
                  <input name="numeroSerie" value={editForm.numeroSerie} onChange={handleEditChange} placeholder="Número de serie" />
                </label>

                <label>
                  Categoría *
                  <select name="idCategoria" value={editForm.idCategoria} onChange={handleEditChange}>
                    <option value="">-- Seleccionar --</option>
                    {categorias.map((c) => (
                      <option key={c.idCategoria} value={c.idCategoria}>{c.nombre}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Ubicación *
                  <select name="idUbicacion" value={editForm.idUbicacion} onChange={handleEditChange}>
                    <option value="">-- Seleccionar --</option>
                    {ubicaciones.map((u) => (
                      <option key={u.idUbicacion} value={u.idUbicacion}>{u.nombreEspacio}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Responsable
                  <select name="idResponsable" value={editForm.idResponsable} onChange={handleEditChange}>
                    <option value="">-- Seleccionar --</option>
                    {usuarios.map((u) => (
                      <option key={u.idUsuario} value={u.idUsuario}>{u.nombre}</option>
                    ))}
                  </select>
                </label>

                <label className="articulo-form-span-2">
                  Descripción Técnica
                  <textarea
                    name="descripcionTecnica"
                    value={editForm.descripcionTecnica}
                    onChange={handleEditChange}
                    placeholder="Descripción técnica del artículo"
                    rows={3}
                  />
                </label>

                <label className="articulo-form-span-2">
                  Observaciones Físicas
                  <textarea
                    name="observacionesFisicas"
                    value={editForm.observacionesFisicas}
                    onChange={handleEditChange}
                    placeholder="Estado físico, daños visibles, etc."
                    rows={2}
                  />
                </label>

                <div className="articulo-form-divider articulo-form-span-2">
                  <span>Imagen del artículo</span>
                </div>

                <div className="articulo-form-span-2 inventory-upload-panel">
                  <label className="inventory-upload-label" htmlFor="inv-list-image-file">
                    Seleccionar imagen
                    <span className="inventory-upload-hint"> (se subirá al guardar)</span>
                  </label>
                  <input
                    id="inv-list-image-file"
                    className="inventory-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={editSubmitting}
                  />
                  {selectedFile ? (
                    <span className="inventory-upload-filename">📎 {selectedFile.name}</span>
                  ) : null}
                  {uploadError ? <p className="feedback-error">{uploadError}</p> : null}
                </div>


                {editError ? <p className="feedback-error articulo-form-span-2">{editError}</p> : null}
                {editSuccess ? <p className="feedback-success articulo-form-span-2">{editSuccess}</p> : null}

                <footer className="users-form-footer articulo-form-span-2">
                  <button className="btn btn-ghost" type="button" onClick={closeEditModal}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={editSubmitting}>
                    {editSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </footer>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {/* ---------- Modal: Crear Artículo ---------- */}
      {showCreateModal ? (
        <div className="modal-backdrop" role="presentation" onClick={closeCreateModal}>
          <section
            className="modal-card articulo-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-articulo-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <h2 id="create-articulo-title">Nuevo Artículo</h2>
              <button type="button" className="icon-button" onClick={closeCreateModal} aria-label="Cerrar modal">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="articulo-modal-body">
              <form className="articulo-form" onSubmit={handleCreateSubmit}>
                <label>
                  Código Institucional *
                  <input
                    name="codigo"
                    value={editForm.codigo}
                    onChange={handleEditChange}
                    placeholder="Ej: UTA-123"
                    required
                  />
                </label>

                <label>
                  Nombre *
                  <input
                    name="nombre"
                    value={editForm.nombre}
                    onChange={handleEditChange}
                    placeholder="Nombre del artículo"
                    required
                  />
                </label>

                <label>
                  Marca
                  <input name="marca" value={editForm.marca} onChange={handleEditChange} placeholder="Marca" />
                </label>

                <label>
                  Modelo
                  <input name="modelo" value={editForm.modelo} onChange={handleEditChange} placeholder="Modelo" />
                </label>

                <label>
                  Número de Serie
                  <input name="numeroSerie" value={editForm.numeroSerie} onChange={handleEditChange} placeholder="Número de serie" />
                </label>

                <label>
                  Categoría *
                  <select name="idCategoria" value={editForm.idCategoria} onChange={handleEditChange} required>
                    <option value="">-- Seleccionar --</option>
                    {categorias.map((c) => (
                      <option key={c.idCategoria} value={c.idCategoria}>{c.nombre}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Ubicación *
                  <select name="idUbicacion" value={editForm.idUbicacion} onChange={handleEditChange} required>
                    <option value="">-- Seleccionar --</option>
                    {ubicaciones.map((u) => (
                      <option key={u.idUbicacion} value={u.idUbicacion}>{u.nombreEspacio}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Responsable
                  <select name="idResponsable" value={editForm.idResponsable} onChange={handleEditChange}>
                    <option value="">-- Seleccionar --</option>
                    {usuarios.map((u) => (
                      <option key={u.idUsuario} value={u.idUsuario}>{u.nombre}</option>
                    ))}
                  </select>
                </label>

                <label className="articulo-form-span-2">
                  Descripción Técnica
                  <textarea
                    name="descripcionTecnica"
                    value={editForm.descripcionTecnica}
                    onChange={handleEditChange}
                    placeholder="Descripción técnica del artículo"
                    rows={3}
                  />
                </label>

                <label className="articulo-form-span-2">
                  Observaciones Físicas
                  <textarea
                    name="observacionesFisicas"
                    value={editForm.observacionesFisicas}
                    onChange={handleEditChange}
                    placeholder="Estado físico, daños visibles, etc."
                    rows={2}
                  />
                </label>

                <div className="articulo-form-divider articulo-form-span-2">
                  <span>Imagen del artículo</span>
                </div>

                <div className="articulo-form-span-2 inventory-upload-panel">
                  <label className="inventory-upload-label" htmlFor="inv-create-image-file">
                    Seleccionar imagen
                    <span className="inventory-upload-hint"> (se subirá al guardar)</span>
                  </label>
                  <input
                    id="inv-create-image-file"
                    className="inventory-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={editSubmitting}
                  />
                  {selectedFile ? (
                    <span className="inventory-upload-filename">📎 {selectedFile.name}</span>
                  ) : null}
                  {uploadError ? <p className="feedback-error">{uploadError}</p> : null}
                </div>

                {editError ? <p className="feedback-error articulo-form-span-2">{editError}</p> : null}

                <footer className="users-form-footer articulo-form-span-2">
                  <button className="btn btn-ghost" type="button" onClick={closeCreateModal}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={editSubmitting}>
                    {editSubmitting ? 'Creando...' : 'Crear Artículo'}
                  </button>
                </footer>
              </form>
            </div>
          </section>
        </div>
      ) : null}
      {/* ---------- Modal: Confirmar Baja ---------- */}
      {showBajaModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowBajaModal(false)}>
          <section
            className="modal-card"
            style={{ maxWidth: '400px' }}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <h2 style={{ color: '#c93844' }}>Dar de Baja</h2>
              <button type="button" className="icon-button" onClick={() => setShowBajaModal(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="articulo-modal-body" style={{ padding: '20px' }}>
              <p style={{ marginBottom: '16px', lineHeight: '1.5' }}>
                ¿Estás seguro de que deseas dar de baja este artículo? <br />
                <strong>{bajaArticulo?.nombre}</strong> ({bajaArticulo?.codigoInstitucional ?? bajaArticulo?.CodigoInstitucional})
              </p>
              <p style={{ fontSize: '0.85rem', color: '#666' }}>
                Esta acción marcará el artículo como no disponible permanentemente.
              </p>
              {bajaError && <p className="feedback-error" style={{ marginTop: '10px' }}>{bajaError}</p>}
            </div>
            <footer className="users-form-footer" style={{ padding: '16px 20px', background: '#f9f9f9' }}>
              <button className="btn btn-ghost" type="button" onClick={() => setShowBajaModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" style={{ background: '#c93844' }} onClick={confirmBaja} disabled={bajaSubmitting}>
                {bajaSubmitting ? 'Procesando...' : 'Confirmar Baja'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {/* ---------- Modal: Restricción (Aviso Profesional) ---------- */}
      {restrictionMessage ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setRestrictionMessage('')}>
          <section
            className="modal-card"
            style={{ maxWidth: '450px', borderLeft: '5px solid #f59e0b' }}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <h2 style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Acción Restringida
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
            <footer className="users-form-footer" style={{ padding: '16px 20px', background: '#fffbeb' }}>
              <button className="btn btn-primary" style={{ background: '#d97706' }} type="button" onClick={() => setRestrictionMessage('')}>
                Entendido
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  )
}

export default InventoryPage
