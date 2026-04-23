import api from '@/core/api/httpClient'

/**
 * Obtiene todos los préstamos registrados (Administrador/Docente)
 */
export const getAllLoans = async () => {
  const response = await api.get('/Prestamos')
  return response.data
}

/**
 * Obtiene solo los préstamos activos
 */
export const getActiveLoans = async () => {
  const response = await api.get('/Prestamos/activos')
  return response.data
}

/**
 * Aprueba una solicitud de préstamo pendiente
 * @param {number} id - ID del préstamo
 */
export const approveLoan = async (id) => {
  // El backend espera un PrestamoAprobarDTO, pero el idAdminAutoriza se saca del token.
  // Sin embargo, el endpoint está definido como PUT y recibe un DTO opcionalmente? 
  // Revisando el controlador, usa idAdminAutoriza del token si está presente.
  const response = await api.put(`/Prestamos/aprobar/${id}`, {})
  return response.data
}

/**
 * Finaliza un préstamo (Devolución)
 * @param {number} id - ID del préstamo
 */
export const finalizeLoan = async (id) => {
  const response = await api.put(`/Prestamos/finalizar/${id}`)
  return response.data
}

/**
 * Registra un préstamo manual por parte de un administrador
 * @param {object} payload - DTO de creación admin
 */
export const createAdminLoan = async (payload) => {
  const response = await api.post('/Prestamos/admin', payload)
  return response.data
}

/**
 * Rechaza una solicitud de préstamo pendiente
 * @param {number} id - ID del préstamo
 */
export const rejectLoan = async (id) => {
  const response = await api.put(`/Prestamos/rechazar/${id}`)
  return response.data
}
