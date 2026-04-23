import { useEffect, useMemo, useState } from 'react'
import { Pencil, RefreshCw, UserX, X } from 'lucide-react'
import ModulePageShell from '@/shared/components/ModulePageShell'
import PrimaryButton from '@/shared/components/PrimaryButton'
import { createUser, deactivateUser, getUsers, updateUser } from '@/features/users/services/users.service'
import { getRoles } from '@/features/users/services/roles.service'

const initialForm = {
  nombre: '',
  apellido: '',
  cedula: '',
  correo: '',
  password: '',
  idRol: '',
  estado: 'Activo',
}

const fallbackRoles = [
  { idRol: 1, nombreRol: 'Administrador' },
  { idRol: 2, nombreRol: 'Docente' },
  { idRol: 3, nombreRol: 'Estudiante' },
]

function UsersPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState(fallbackRoles)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [formData, setFormData] = useState(initialForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const roleOptions = useMemo(() => {
    return roles.length > 0 ? roles : fallbackRoles
  }, [roles])

  const fetchUsers = async () => {
    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        getUsers(),
        getRoles().catch(() => fallbackRoles),
      ])

      setUsers(Array.isArray(usersResponse) ? usersResponse : [])
      if (Array.isArray(rolesResponse) && rolesResponse.length > 0) {
        setRoles(rolesResponse)
      }
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ??
          'No se pudo cargar usuarios. Verifica token y conexion al backend.',
      )
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    await fetchUsers()
  }

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return users
    return users.filter(user => 
      (user.nombre?.toLowerCase().includes(term)) ||
      (user.cedula?.toLowerCase().includes(term)) ||
      (user.correo?.toLowerCase().includes(term))
    )
  }, [users, searchTerm])

  // Carga inicial de datos del modulo al montar la vista.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers()
  }, [])

  const openCreateModal = () => {
    const firstRoleId = roleOptions[0]?.idRol ? String(roleOptions[0].idRol) : ''
    setIsEditMode(false)
    setEditingUserId(null)
    setFormData({ ...initialForm, idRol: firstRoleId })
    setErrorMessage('')
    setShowCreateModal(true)
  }

  const openEditModal = (user) => {
    // Separar nombre completo en nombre y apellido (por primer espacio)
    const nombrePartes = (user.nombre ?? '').trim().split(' ')
    let nombre = nombrePartes[0] || ''
    let apellido = nombrePartes.slice(1).join(' ') || ''

    setIsEditMode(true)
    setEditingUserId(user.idUsuario)
    setFormData({
      ...initialForm,
      nombre,
      apellido,
      cedula: user.cedula ?? '',
      correo: user.correo ?? '',
      idRol: user.idRol ? String(user.idRol) : '',
      estado: user.estado || 'Activo',
    })
    setErrorMessage('')
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setIsEditMode(false)
    setEditingUserId(null)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nombreCompleto = `${formData.nombre.trim()} ${formData.apellido.trim()}`.trim()
    const payload = {
      cedula: isEditMode ? '' : formData.cedula.trim(), // No enviar cédula en edición
      nombre: nombreCompleto,
      correo: formData.correo.trim(),
      password: formData.password,
      idRol: Number(formData.idRol),
      estado: formData.estado?.trim() || 'Activo',
    }

    // En creación, cédula es obligatoria; en edición no se valida
    const camposRequeridos = isEditMode
      ? !payload.nombre || !payload.correo || !payload.password || !payload.idRol
      : !payload.cedula || !payload.nombre || !payload.correo || !payload.password || !payload.idRol

    if (camposRequeridos) {
      setErrorMessage(
        isEditMode
          ? 'Completa todos los campos (excepto cédula) para actualizar el usuario.'
          : 'Completa todos los campos para registrar el usuario.',
      )
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    try {
      if (isEditMode && editingUserId) {
        await updateUser(editingUserId, payload)
      } else {
        await createUser(payload)
      }

      closeCreateModal()
      await loadUsers()
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ??
          (isEditMode
            ? 'No se pudo actualizar el usuario. Revisa permisos y datos enviados.'
            : 'No se pudo crear el usuario. Revisa permisos y datos enviados.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (idUsuario) => {
    const confirmDeactivate = window.confirm('Se desactivará este usuario. Deseas continuar?')
    if (!confirmDeactivate) {
      return
    }

    try {
      await deactivateUser(idUsuario)
      await loadUsers()
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ?? 'No se pudo desactivar el usuario seleccionado.',
      )
    }
  }

  return (
    <>
      <ModulePageShell
        title="Gestion de Usuarios"
        description="Administra altas y bajas de usuarios segun el rol asignado."
        actions={
          <div className="header-actions">
            <button className="btn btn-secondary" type="button" onClick={loadUsers}>
              <RefreshCw size={16} aria-hidden="true" />
              Recargar
            </button>
            <PrimaryButton onClick={openCreateModal}>+ Crear Nuevo Usuario</PrimaryButton>
          </div>
        }
      >
        {errorMessage ? <p className="feedback-error">{errorMessage}</p> : null}

        <div className="inventory-filters-card mb-4" style={{ padding: '16px', marginBottom: '20px' }}>
          <div className="inventory-filter-grid" style={{ gridTemplateColumns: '1fr auto', alignItems: 'flex-end' }}>
            <label>
              <span style={{ fontWeight: '700', color: '#4a5168', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Buscar Usuario</span>
              <input 
                type="text" 
                placeholder="Nombre, Cédula o Correo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            <div className="inventory-filter-actions" style={{ padding: 0 }}>
              <button className="btn btn-ghost" onClick={() => setSearchTerm('')} type="button">Limpiar</button>
            </div>
          </div>
        </div>

        <div className="users-table-card">
          <div className="users-table-head">
            <span>Cédula</span>
            <span>Nombre</span>
            <span>Correo</span>
            <span>Rol</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>

          <div className="users-table-body">
            {loading ? (
              <p className="users-empty">Cargando usuarios...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="users-empty">No hay usuarios que coincidan con la búsqueda.</p>
            ) : (
              filteredUsers.map((user) => (
                <article className="users-row" key={user.idUsuario}>
                  <span>{user.cedula || '-'}</span>
                  <span>{user.nombre}</span>
                  <span>{user.correo}</span>
                  <span>{user.nombreRol ?? `Rol ${user.idRol}`}</span>
                  <span>
                    <span className={`status-chip ${String(user.estado).toLowerCase() === 'activo' ? 'status-chip-active' : 'status-chip-inactive'}`}>
                      {user.estado ?? 'Activo'}
                    </span>
                  </span>
                  <span className="users-actions">
                    <button
                      className="icon-button"
                      type="button"
                      title="Editar usuario"
                      aria-label="Editar usuario"
                      onClick={() => openEditModal(user)}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      className="icon-button icon-button-danger"
                      type="button"
                      title="Desactivar usuario"
                      aria-label="Desactivar usuario"
                      onClick={() => handleDeactivate(user.idUsuario)}
                    >
                      <UserX size={16} aria-hidden="true" />
                    </button>
                  </span>
                </article>
              ))
            )}
          </div>
        </div>
      </ModulePageShell>

      {showCreateModal ? (
        <div className="modal-backdrop" role="presentation" onClick={closeCreateModal}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="modal-header">
              <h2 id="create-user-title">
                {isEditMode ? 'Edicion de Usuario' : 'Registro de Nuevo Usuario'}
              </h2>
              <button
                type="button"
                className="icon-button"
                onClick={closeCreateModal}
                aria-label="Cerrar modal"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <form className="users-form" onSubmit={handleSubmit}>
              <label>
                Nombre
                <input
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Solicitar Nombre"
                />
              </label>

              <label>
                Apellido
                <input
                  name="apellido"
                  value={formData.apellido}
                  onChange={handleChange}
                  placeholder="Solicitar Apellido"
                />
              </label>

              <label className="users-form-span-2">
                Cédula
                <input
                  name="cedula"
                  value={formData.cedula}
                  onChange={handleChange}
                  placeholder="Solicitar Cédula"
                  disabled={isEditMode}
                  title={isEditMode ? 'La cédula no puede ser modificada' : ''}
                />
              </label>

              <label className="users-form-span-2">
                Correo Electronico
                <input
                  name="correo"
                  type="email"
                  value={formData.correo}
                  onChange={handleChange}
                  placeholder="Solicitar Correo Electronico"
                />
              </label>

              {isEditMode ? (
                <label className="users-form-span-2">
                  Estado
                  <select name="estado" value={formData.estado} onChange={handleChange}>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </label>
              ) : null}

              <label>
                Contrasena
                <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Solicitar Contrasena"
                />
              </label>

              <label>
                Rol
                <select name="idRol" value={formData.idRol} onChange={handleChange}>
                  {roleOptions.map((roleOption) => (
                    <option key={roleOption.idRol} value={roleOption.idRol}>
                      {roleOption.nombreRol}
                    </option>
                  ))}
                </select>
              </label>

              {errorMessage ? <p className="feedback-error users-form-span-2">{errorMessage}</p> : null}

              <footer className="users-form-footer users-form-span-2">
                <button className="btn btn-ghost" type="button" onClick={closeCreateModal}>
                  Cancelar
                </button>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting
                    ? isEditMode
                      ? 'Actualizando...'
                      : 'Registrando...'
                    : isEditMode
                      ? 'Guardar Cambios'
                      : 'Registrar Usuario'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}

export default UsersPage
