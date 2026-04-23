import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Building2, ImageOff, MapPin, Pencil, Tag, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import ModulePageShell from '@/shared/components/ModulePageShell'
import {
  getArticuloImages,
  getCategorias,
  getDepartamentos,
  getInventoryCatalog,
  getMovimientoHistorial,
  getUbicaciones,
  linkArticuloImage,
  updateArticulo,
} from '@/features/inventory/services/inventory.service'
import { getUsers } from '@/features/users/services/users.service'
import { API_BASE_URL } from '@/core/config/env'
import { uploadImageToCloudinary } from '@/features/inventory/services/cloudinary.service'

function resolveImageUrl(urlImagen) {
  if (!urlImagen) return ''
  if (/^(https?:|data:|blob:)/i.test(urlImagen)) return urlImagen
  const origin = API_BASE_URL.replace(/\/api\/?$/, '')
  const normalizedPath = urlImagen.startsWith('/') ? urlImagen : `/${urlImagen}`
  return `${origin}${normalizedPath}`
}

function InventoryDetailPage() {
  const navigate = useNavigate()
  const { idArticulo } = useParams()
  const articuloId = Number(idArticulo)

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [articulo, setArticulo] = useState(null)
  const [imagenes, setImagenes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [ubicaciones, setUbicaciones] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [usuarios, setUsuarios] = useState([])

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    codigo: '',
    nombre: '',
    marca: '',
    modelo: '',
    numeroSerie: '',
    descripcionTecnica: '',
    observacionesFisicas: '',
    idCategoria: '',
    idUbicacion: '',
  })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')

  // Image upload (inside edit modal)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')

  const loadDetail = async () => {
    if (!Number.isFinite(articuloId)) {
      setErrorMessage('El identificador del artículo no es válido.')
      setLoading(false)
      return
    }
    setLoading(true)
    setErrorMessage('')
    try {
      const [catalogo, imagenesRes, categoriasRes, ubicacionesRes, departamentosRes, movimientosRes, usuariosRes] =
        await Promise.all([
          getInventoryCatalog(),
          getArticuloImages(articuloId),
          getCategorias(),
          getUbicaciones(),
          getDepartamentos(),
          getMovimientoHistorial(),
          getUsers(),
        ])
      const found = catalogo.find((item) => item.idArticulo === articuloId) ?? null
      if (!found) { setErrorMessage('No se encontró el artículo solicitado.'); return }
      setArticulo(found)
      setImagenes(imagenesRes)
      setCategorias(categoriasRes)
      setUbicaciones(ubicacionesRes)
      setDepartamentos(departamentosRes)
      setMovimientos(movimientosRes)
      setUsuarios(usuariosRes)
    } catch (error) {
      setErrorMessage(error.response?.data?.message ?? 'No se pudo cargar el detalle del artículo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      if (!Number.isFinite(articuloId)) {
        setErrorMessage('El identificador del artículo no es válido.')
        setLoading(false)
        return
      }
      setLoading(true)
      setErrorMessage('')
      try {
        const [catalogo, imagenesRes, categoriasRes, ubicacionesRes, departamentosRes, movimientosRes, usuariosRes] =
          await Promise.all([
            getInventoryCatalog(),
            getArticuloImages(articuloId),
            getCategorias(),
            getUbicaciones(),
            getDepartamentos(),
            getMovimientoHistorial(),
            getUsers(),
          ])
        if (!isMounted) return
        const found = catalogo.find((item) => item.idArticulo === articuloId) ?? null
        if (!found) { setErrorMessage('No se encontró el artículo solicitado.'); return }
        setArticulo(found)
        setImagenes(imagenesRes)
        setCategorias(categoriasRes)
        setUbicaciones(ubicacionesRes)
        setDepartamentos(departamentosRes)
        setMovimientos(movimientosRes)
        setUsuarios(usuariosRes)
      } catch (error) {
        if (!isMounted) return
        setErrorMessage(error.response?.data?.message ?? 'No se pudo cargar el detalle del artículo.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [articuloId])

  const categoriaNombre = useMemo(() =>
    categorias.find((item) => item.idCategoria === articulo?.idCategoria)?.nombre ?? articulo?.categoria ?? '-',
    [articulo, categorias])

  const ubicacionNombre = useMemo(() =>
    ubicaciones.find((item) => item.idUbicacion === articulo?.idUbicacion)?.nombreEspacio ?? articulo?.ubicacion ?? '-',
    [articulo, ubicaciones])

  const departamentoNombre = useMemo(() => {
    const ubi = ubicaciones.find((item) => item.idUbicacion === articulo?.idUbicacion)
    return departamentos.find((item) => item.idDepartamento === ubi?.idDepartamento)?.nombreDepartamento ?? '-'
  }, [articulo, ubicaciones, departamentos])

  const historialArticulo = useMemo(() =>
    movimientos.filter((item) => (item.idArticulo ?? item.IdArticulo) === articuloId),
    [movimientos, articuloId])

  const selectedImageUrl = resolveImageUrl(imagenes[0]?.urlImagen ?? imagenes[0]?.UrlImagen ?? '')

  // ---------- Edit modal ----------
  const openEditModal = () => {
    if (!articulo) return
    setEditForm({
      codigo: articulo.codigoInstitucional ?? articulo.CodigoInstitucional ?? '',
      nombre: articulo.nombre ?? articulo.Nombre ?? '',
      marca: articulo.marca ?? articulo.Marca ?? '',
      modelo: articulo.modelo ?? articulo.Modelo ?? '',
      numeroSerie: articulo.numeroSerie ?? articulo.NumeroSerie ?? '',
      descripcionTecnica: articulo.descripcionTecnica ?? articulo.DescripcionTecnica ?? '',
      observacionesFisicas: articulo.observacionesFisicas ?? articulo.ObservacionesFisicas ?? '',
      idCategoria: (articulo.idCategoria ?? articulo.IdCategoria) ? String(articulo.idCategoria ?? articulo.IdCategoria) : '',
      idUbicacion: (articulo.idUbicacion ?? articulo.IdUbicacion) ? String(articulo.idUbicacion ?? articulo.IdUbicacion) : '',
      idResponsable: (articulo.idResponsable ?? articulo.IdResponsable) ? String(articulo.idResponsable ?? articulo.IdResponsable) : '',
    })
    setEditError('')
    setEditSuccess('')
    setSelectedFile(null)
    setUploadError('')
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditError('')
    setEditSuccess('')
    setSelectedFile(null)
    setUploadError('')
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
      await updateArticulo(articuloId, {
        codigo: editForm.codigo.trim(),
        nombre: editForm.nombre.trim(),
        marca: editForm.marca.trim() || null,
        modelo: editForm.modelo.trim() || null,
        numeroSerie: editForm.numeroSerie.trim() || null,
        descripcionTecnica: editForm.descripcionTecnica.trim() || null,
        observacionesFisicas: editForm.observacionesFisicas.trim() || null,
        idCategoria: Number(editForm.idCategoria),
        idUbicacion: Number(editForm.idUbicacion),
        idResponsable: Number(editForm.idResponsable) || articulo.idResponsable,
        estado: articulo.estado,
      })

      // Si se seleccionó una imagen, subirla y vincularla
      if (selectedFile) {
        const { secureUrl } = await uploadImageToCloudinary(selectedFile)
        await linkArticuloImage(articuloId, secureUrl)
      }

      closeEditModal()
      await loadDetail()
    } catch (error) {
      setEditError(error.response?.data?.message ?? 'No se pudo actualizar el artículo. Revisa los datos.')
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


  return (
    <>
      <ModulePageShell
        title={articulo ? `Detalle del Artículo: ${articulo.nombre}` : 'Detalle del Artículo'}
        description="Vista independiente del artículo con su imagen, ubicación, categorías y trazabilidad."
      >
        <div className="inventory-detail-topbar">
          <button className="inventory-back-button" type="button" onClick={() => navigate('/inventario')}>
            <ArrowLeft size={16} aria-hidden="true" />
            Volver al inventario
          </button>

          {articulo ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={openEditModal}
              style={{ marginLeft: 'auto' }}
            >
              <Pencil size={15} aria-hidden="true" style={{ marginRight: 6 }} />
              Editar Artículo
            </button>
          ) : null}
        </div>

        {errorMessage ? <p className="feedback-error">{errorMessage}</p> : null}

        {loading ? (
          <p className="users-empty">Cargando detalle del artículo...</p>
        ) : articulo ? (
          <div className="inventory-detail-layout">
            <section className="inventory-detail-card-panel">
              <div className="inventory-detail-image-box">
                {selectedImageUrl ? (
                  <img src={selectedImageUrl} alt={articulo.nombre} className="inventory-detail-image" />
                ) : (
                  <div className="inventory-detail-image-placeholder">
                    <ImageOff size={34} aria-hidden="true" />
                    <span>Sin imagen disponible</span>
                  </div>
                )}
              </div>

              <div className="inventory-detail-heading-block">
                <h2>{articulo.nombre}</h2>
                <p>{articulo.descripcionTecnica || 'No hay descripción técnica registrada.'}</p>
              </div>

              <div className="inventory-detail-chip-row">
                <span className="inventory-detail-chip inventory-detail-chip-blue">
                  <Tag size={14} aria-hidden="true" />{categoriaNombre}
                </span>
                <span className="inventory-detail-chip inventory-detail-chip-green">
                  <MapPin size={14} aria-hidden="true" />{ubicacionNombre}
                </span>
                <span className="inventory-detail-chip inventory-detail-chip-slate">
                  <Building2 size={14} aria-hidden="true" />{departamentoNombre}
                </span>
              </div>

              <dl className="inventory-detail-meta-list">
                <div><dt>Estado</dt><dd>{articulo.estado || '-'}</dd></div>
                <div><dt>Responsable</dt><dd>{articulo.responsable || '-'}</dd></div>
                <div><dt>Código Institucional</dt><dd>{articulo.codigoInstitucional || '-'}</dd></div>
                <div><dt>Número de Serie</dt><dd>{articulo.numeroSerie || '-'}</dd></div>
                <div><dt>Marca</dt><dd>{articulo.marca || '-'}</dd></div>
                <div><dt>Modelo</dt><dd>{articulo.modelo || '-'}</dd></div>
              </dl>
            </section>

            <section className="inventory-detail-side">
              <div className="inventory-detail-panel">
                <div className="inventory-detail-panel-header">
                  <h3>Ubicación y catálogo</h3>
                  <span>Datos consultados desde las APIs</span>
                </div>
                <dl className="inventory-detail-rows">
                  <div><dt>Categoría</dt><dd>{categoriaNombre}</dd></div>
                  <div><dt>Ubicación</dt><dd>{ubicacionNombre}</dd></div>
                  <div><dt>Departamento</dt><dd>{departamentoNombre}</dd></div>
                  <div><dt>Responsable</dt><dd>{articulo.responsable || '-'}</dd></div>
                </dl>
              </div>

              <div className="inventory-detail-panel">
                <div className="inventory-detail-panel-header">
                  <h3>Historial del Artículo</h3>
                  <span>{historialArticulo.length} movimientos</span>
                </div>
                {historialArticulo.length > 0 ? (
                  <div className="inventory-history-table">
                    <div className="inventory-history-head">
                      <span>Fecha</span><span>Evento</span><span>Detalle</span>
                    </div>
                    {historialArticulo.map((m) => (
                      <div className="inventory-history-row" key={m.id ?? `${m.fecha}-${m.motivo}`}>
                        <span>{new Date(m.fecha).toLocaleDateString('es-ES')}</span>
                        <span>Movimiento</span>
                        <span>{m.de} → {m.a}. {m.motivo}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="inventory-empty-note">No hay historial de movimientos registrado para este artículo.</p>
                )}
              </div>

              <div className="inventory-detail-panel">
                <div className="inventory-detail-panel-header">
                  <h3>Trazabilidad</h3>
                  <span>Resumen técnico</span>
                </div>
                <ul className="inventory-trace-list inventory-trace-list-detail">
                  <li><strong>Descripción:</strong> {articulo.descripcionTecnica || '-'}</li>
                  <li><strong>Ubicación actual:</strong> {ubicacionNombre}</li>
                  <li><strong>Departamento:</strong> {departamentoNombre}</li>
                  <li><strong>Imagen vinculada:</strong> {selectedImageUrl ? 'Sí' : 'No'}</li>
                </ul>
              </div>
            </section>
          </div>
        ) : null}
      </ModulePageShell>

      {/* ── Edit Modal — fuera de ModulePageShell para que se superponga a todo ── */}
      {showEditModal ? (
        <div className="modal-backdrop" role="presentation" onClick={closeEditModal}>
          <section
            className="modal-card articulo-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-detail-articulo-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <h2 id="edit-detail-articulo-title">Editar Artículo</h2>
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
                  <label className="inventory-upload-label" htmlFor="detail-image-file">
                    Seleccionar imagen
                    <span className="inventory-upload-hint"> (se subirá al guardar)</span>
                  </label>
                  <input
                    id="detail-image-file"
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
    </>
  )
}

export default InventoryDetailPage