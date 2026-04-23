import httpClient from '@/core/api/httpClient'

export async function getInventoryCatalog() {
  const response = await httpClient.get('/Articulos/catalogo')
  return Array.isArray(response.data) ? response.data : []
}

export async function getArticuloImages(idArticulo) {
  const response = await httpClient.get(`/Imagenes/articulo/${idArticulo}`)
  return Array.isArray(response.data) ? response.data : []
}

export async function getCategorias() {
  const response = await httpClient.get('/Categorias')
  return Array.isArray(response.data) ? response.data : []
}

export async function getUbicaciones() {
  const response = await httpClient.get('/Ubicaciones')
  return Array.isArray(response.data) ? response.data : []
}

export async function getDepartamentos() {
  const response = await httpClient.get('/Departamentos')
  return Array.isArray(response.data) ? response.data : []
}

export async function getMovimientoHistorial() {
  const response = await httpClient.get('/Movimientos/historial')
  return Array.isArray(response.data) ? response.data : []
}

export async function linkArticuloImage(idArticulo, urlImagen) {
  const payload = {
    idArticulo,
    urlImagen,
  }

  const response = await httpClient.post('/Imagenes/subir', payload)
  return response.data
}

export async function updateArticulo(id, payload) {
  const response = await httpClient.put(`/Articulos/${id}`, payload)
  return response.data
}
