using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using SistemaInventario.Application.DTOs;
using SistemaInventario.Application.Interfaces;
using SistemaInventario.Domain.Enums;
using SistemaInventario.Infrastructure.Persistence;

namespace SistemaInventario.Infrastructure.Repositories
{
    public class PrestamoRepository : IPrestamoRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IAuditoriaRepository _auditoriaRepository;
        private const string EstadoPendiente  = "Pendiente";
        private const string EstadoActivo     = "Activo";
        private const string EstadoVencido    = "Vencido";
        private const string EstadoFinalizado = "Finalizado";
        private const string EstadoRechazado  = "Rechazado";

        public PrestamoRepository(ApplicationDbContext context, IAuditoriaRepository auditoriaRepository)
        {
            _context = context;
            _auditoriaRepository = auditoriaRepository;
        }

        // ─────────────────────────────────────────────────────────────────────
        // MARCAR VENCIDOS (se llama antes de cualquier consulta de préstamos)
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Actualiza en la BD todos los préstamos Activos cuya FechaPrevista
        /// ya pasó, cambiándoles el estado a "Vencido". Esto garantiza que la
        /// información persiste y no es solo visual en el frontend.
        /// </summary>
        public async Task MarcarVencidosAsync()
        {
            // UPDATE directo: Oracle 10g compatible, sin ROWNUM ni FETCH FIRST.
            // Afecta solo a los préstamos que siguen Activos y ya vencieron.
            await _context.Database.ExecuteSqlRawAsync(
                @"UPDATE PRESTAMOS
                  SET ESTADO_PRESTAMO = {0}
                  WHERE ESTADO_PRESTAMO = {1}
                    AND FECHA_PREVISTA < {2}",
                EstadoVencido,
                EstadoActivo,
                DateTime.Now);
        }

        // ─────────────────────────────────────────────────────────────────────
        // REGISTRAR
        // ─────────────────────────────────────────────────────────────────────

        public async Task<bool> RegistrarPrestamoAsync(PrestamoCreateDTO dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                if (dto.FechaPrevista <= DateTime.Now)
                    throw new InvalidOperationException("La fecha prevista de devolución debe ser en el futuro.");

                await ValidarArticulosDisponiblesAsync(dto.ArticulosIds);

                await _context.Database.ExecuteSqlRawAsync(
                    @"INSERT INTO PRESTAMOS
                      (ID_USUARIO, FECHA_SALIDA, FECHA_PREVISTA, ESTADO_PRESTAMO, FECHA_DEVOLUCION_REAL, ID_ADMIN_AUTORIZA)
                      VALUES ({0}, {1}, {2}, {3}, {4}, {5})",
                    dto.IdUsuario,
                    null,
                    dto.FechaPrevista,
                    EstadoPendiente,
                    null,
                    null);

                var idPrestamo = await ObtenerUltimoIdPrestamoAsync();
                if (idPrestamo <= 0)
                    throw new InvalidOperationException("No se pudo recuperar el ID del préstamo recién insertado.");

                foreach (var articuloId in dto.ArticulosIds)
                {
                    await _context.Database.ExecuteSqlRawAsync(
                        "INSERT INTO DETALLE_PRESTAMO (ID_PRESTAMO, ID_ARTICULO) VALUES ({0}, {1})",
                        idPrestamo,
                        articuloId);
                }

                await _auditoriaRepository.RegistrarAccionAsync(new AuditoriaCreateDTO
                {
                    IdUsuario = dto.IdUsuario,
                    TablaAfectada = "PRESTAMOS",
                    IdRegistroAfectado = idPrestamo,
                    Accion = "INSERT",
                    DetallesCambio = $"Solicitud de préstamo creada. ID={idPrestamo}, Artículos={string.Join(",", dto.ArticulosIds)}"
                });

                await transaction.CommitAsync();
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new InvalidOperationException($"Error al registrar la solicitud de préstamo: {ex.Message}", ex);
            }
        }

        public async Task<bool> RegistrarPrestamoAdminAsync(PrestamoCreateAdminDTO dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                if (dto.FechaPrevista <= DateTime.Now)
                    throw new InvalidOperationException("La fecha prevista de devolución debe ser en el futuro.");

                await ValidarArticulosDisponiblesAsync(dto.ArticulosIds);

                await _context.Database.ExecuteSqlRawAsync(
                    @"INSERT INTO PRESTAMOS
                      (ID_USUARIO, FECHA_SALIDA, FECHA_PREVISTA, ESTADO_PRESTAMO, FECHA_DEVOLUCION_REAL, ID_ADMIN_AUTORIZA)
                      VALUES ({0}, {1}, {2}, {3}, {4}, {5})",
                    dto.IdUsuario,
                    DateTime.Now,
                    dto.FechaPrevista,
                    EstadoActivo,
                    null,
                    dto.IdAdminAutoriza);

                var idPrestamo = await ObtenerUltimoIdPrestamoAsync();
                if (idPrestamo <= 0)
                    throw new InvalidOperationException("No se pudo recuperar el ID del préstamo recién insertado.");

                foreach (var articuloId in dto.ArticulosIds)
                {
                    await _context.Database.ExecuteSqlRawAsync(
                        "INSERT INTO DETALLE_PRESTAMO (ID_PRESTAMO, ID_ARTICULO) VALUES ({0}, {1})",
                        idPrestamo,
                        articuloId);

                    var filasArticulo = await _context.Database.ExecuteSqlRawAsync(
                        "UPDATE ARTICULOS SET ESTADO = 'Prestado' WHERE ID_ARTICULO = {0} AND ESTADO = 'Disponible'",
                        articuloId);

                    if (filasArticulo == 0)
                        throw new InvalidOperationException($"El artículo {articuloId} no está disponible para préstamo.");
                }

                await _auditoriaRepository.RegistrarAccionAsync(new AuditoriaCreateDTO
                {
                    IdUsuario = dto.IdAdminAutoriza,
                    TablaAfectada = "PRESTAMOS",
                    IdRegistroAfectado = idPrestamo,
                    Accion = "INSERT",
                    DetallesCambio = $"Préstamo administrativo creado y activado. ID={idPrestamo}, Usuario={dto.IdUsuario}, Artículos={string.Join(",", dto.ArticulosIds)}"
                });

                await transaction.CommitAsync();
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new InvalidOperationException($"Error al registrar préstamo por administrador: {ex.Message}", ex);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // APROBAR
        // ─────────────────────────────────────────────────────────────────────

        public async Task<bool> AprobarPrestamoAsync(int idPrestamo, int idAdminAutoriza)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var filasPrestamo = await _context.Database.ExecuteSqlRawAsync(
                    @"UPDATE PRESTAMOS
                      SET ID_ADMIN_AUTORIZA = {1}, ESTADO_PRESTAMO = {2}, FECHA_SALIDA = {4}
                      WHERE ID_PRESTAMO = {0} AND ESTADO_PRESTAMO = {3}",
                    idPrestamo,
                    idAdminAutoriza,
                    EstadoActivo,
                    EstadoPendiente,
                    DateTime.Now);

                if (filasPrestamo == 0)
                    return false;

                var detalles = await _context.DetallesPrestamos
                    .Where(d => d.IdPrestamo == idPrestamo)
                    .ToListAsync();

                foreach (var d in detalles)
                {
                    var filasArticulo = await _context.Database.ExecuteSqlRawAsync(
                        "UPDATE ARTICULOS SET ESTADO = 'Prestado' WHERE ID_ARTICULO = {0} AND ESTADO = 'Disponible'",
                        d.IdArticulo);

                    if (filasArticulo == 0)
                        throw new InvalidOperationException($"El artículo {d.IdArticulo} no está disponible para préstamo.");
                }

                await _auditoriaRepository.RegistrarAccionAsync(new AuditoriaCreateDTO
                {
                    IdUsuario = idAdminAutoriza,
                    TablaAfectada = "PRESTAMOS",
                    IdRegistroAfectado = idPrestamo,
                    Accion = "UPDATE",
                    DetallesCambio = $"Préstamo aprobado. ID={idPrestamo}"
                });

                await transaction.CommitAsync();
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new InvalidOperationException($"Error al aprobar préstamo: {ex.Message}", ex);
            }
        }

        public async Task<bool> RechazarPrestamoAsync(int idPrestamo, int idAdminAutoriza)
        {
            try
            {
                var filasPrestamo = await _context.Database.ExecuteSqlRawAsync(
                    @"UPDATE PRESTAMOS
                      SET ID_ADMIN_AUTORIZA = {1}, ESTADO_PRESTAMO = {2}
                      WHERE ID_PRESTAMO = {0} AND ESTADO_PRESTAMO = {3}",
                    idPrestamo,
                    idAdminAutoriza,
                    EstadoRechazado,
                    EstadoPendiente);

                if (filasPrestamo == 0)
                    return false;

                await _auditoriaRepository.RegistrarAccionAsync(new AuditoriaCreateDTO
                {
                    IdUsuario = idAdminAutoriza,
                    TablaAfectada = "PRESTAMOS",
                    IdRegistroAfectado = idPrestamo,
                    Accion = "UPDATE",
                    DetallesCambio = $"Solicitud de préstamo RECHAZADA. ID={idPrestamo}"
                });

                return true;
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Error al rechazar préstamo: {ex.Message}", ex);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // CONSULTAR  (siempre marca vencidos antes de devolver datos)
        // ─────────────────────────────────────────────────────────────────────

        public async Task<IEnumerable<PrestamoDTO>> ObtenerTodosPrestamosAsync()
        {
            // Antes de consultar, actualizamos los que ya vencieron en la BD.
            await MarcarVencidosAsync();

            var prestamos = await (from p in _context.Prestamos
                                   join u in _context.Usuarios on p.IdUsuario equals u.IdUsuario
                                   select new PrestamoDTO
                                   {
                                       IdPrestamo = p.IdPrestamo,
                                       NombreUsuario = u.Nombre,
                                       FechaSalida = p.FechaSalida,
                                       FechaPrevista = p.FechaPrevista,
                                       Estado = p.Estado.ToString()
                                   }).ToListAsync();

            await CompletarResumenArticulosAsync(prestamos);
            return prestamos;
        }

        public async Task<IEnumerable<PrestamoDTO>> ObtenerPrestamosActivosAsync()
        {
            // Marcamos vencidos primero para que el resultado sea exacto.
            await MarcarVencidosAsync();

            var prestamos = await (from p in _context.Prestamos
                                   join u in _context.Usuarios on p.IdUsuario equals u.IdUsuario
                                   where p.Estado == EstadoPrestamo.Activo
                                   select new PrestamoDTO
                                   {
                                       IdPrestamo = p.IdPrestamo,
                                       NombreUsuario = u.Nombre,
                                       FechaSalida = p.FechaSalida,
                                       FechaPrevista = p.FechaPrevista,
                                       Estado = p.Estado.ToString()
                                   }).ToListAsync();

            await CompletarResumenArticulosAsync(prestamos);
            return prestamos;
        }

        // ─────────────────────────────────────────────────────────────────────
        // FINALIZAR  (acepta Activo o Vencido → pasa a Finalizado)
        // ─────────────────────────────────────────────────────────────────────

        public async Task<bool> FinalizarPrestamoAsync(int idPrestamo, int idUsuarioActor)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Aceptamos tanto Activo como Vencido para poder devolver artículos
                // que llegaron tarde — de lo contrario el admin quedaría bloqueado.
                var filasPrestamo = await _context.Database.ExecuteSqlRawAsync(
                    @"UPDATE PRESTAMOS
                      SET ESTADO_PRESTAMO = {1}, FECHA_DEVOLUCION_REAL = {2}
                      WHERE ID_PRESTAMO = {0}
                        AND (ESTADO_PRESTAMO = {3} OR ESTADO_PRESTAMO = {4})",
                    idPrestamo,
                    EstadoFinalizado,
                    DateTime.Now,
                    EstadoActivo,
                    EstadoVencido);

                if (filasPrestamo == 0)
                    return false;

                var detalles = await _context.DetallesPrestamos
                    .Where(d => d.IdPrestamo == idPrestamo)
                    .ToListAsync();

                foreach (var d in detalles)
                {
                    await _context.Database.ExecuteSqlRawAsync(
                        "UPDATE ARTICULOS SET ESTADO = 'Disponible' WHERE ID_ARTICULO = {0}",
                        d.IdArticulo);
                }

                await _auditoriaRepository.RegistrarAccionAsync(new AuditoriaCreateDTO
                {
                    IdUsuario = idUsuarioActor,
                    TablaAfectada = "PRESTAMOS",
                    IdRegistroAfectado = idPrestamo,
                    Accion = "UPDATE",
                    DetallesCambio = $"Préstamo finalizado. ID={idPrestamo}"
                });

                await transaction.CommitAsync();
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new InvalidOperationException($"Error al finalizar préstamo: {ex.Message}", ex);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // HELPERS PRIVADOS
        // ─────────────────────────────────────────────────────────────────────

        private async Task CompletarResumenArticulosAsync(List<PrestamoDTO> prestamos)
        {
            if (prestamos.Count == 0)
                return;

            var prestamosIds = prestamos.Select(p => p.IdPrestamo).ToList();

            var detalles = await _context.DetallesPrestamos
                .Where(d => prestamosIds.Contains(d.IdPrestamo))
                .Select(d => new { d.IdPrestamo, d.IdArticulo })
                .ToListAsync();

            var articulosIds = detalles.Select(d => d.IdArticulo).Distinct().ToList();
            var articulos = await _context.Articulos
                .Where(a => articulosIds.Contains(a.IdArticulo))
                .Select(a => new { a.IdArticulo, a.Nombre })
                .ToListAsync();

            var nombresPorArticuloId = articulos.ToDictionary(a => a.IdArticulo, a => a.Nombre);

            foreach (var prestamo in prestamos)
            {
                var nombres = detalles
                    .Where(d => d.IdPrestamo == prestamo.IdPrestamo)
                    .Select(d => nombresPorArticuloId.TryGetValue(d.IdArticulo, out var nombre) ? nombre : null)
                    .Where(nombre => !string.IsNullOrWhiteSpace(nombre))
                    .Distinct()
                    .ToList();

                prestamo.CantidadArticulos = nombres.Count;

                if (nombres.Count == 0)
                {
                    prestamo.Articulos = "-";
                    continue;
                }

                prestamo.Articulos = string.Join(", ", nombres);
            }
        }

        private async Task<int> ObtenerUltimoIdPrestamoAsync()
        {
            // Oracle 10g no soporta FETCH FIRST, por eso usamos ROWNUM.
            var sql = @"SELECT ID_PRESTAMO
                        FROM (
                            SELECT ID_PRESTAMO FROM PRESTAMOS ORDER BY ID_PRESTAMO DESC
                        )
                        WHERE ROWNUM = 1";

            var connection = _context.Database.GetDbConnection();
            var wasClosed = connection.State != System.Data.ConnectionState.Open;

            if (wasClosed)
                await connection.OpenAsync();

            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = sql;
                command.Transaction = _context.Database.CurrentTransaction?.GetDbTransaction();

                var result = await command.ExecuteScalarAsync();
                if (result == null || result == DBNull.Value)
                    return 0;

                return Convert.ToInt32(result);
            }
            finally
            {
                if (wasClosed)
                    await connection.CloseAsync();
            }
        }

        private async Task ValidarArticulosDisponiblesAsync(IEnumerable<int> articulosIds)
        {
            var ids = articulosIds.Distinct().ToList();
            if (!ids.Any())
                throw new InvalidOperationException("Debe enviar al menos un artículo para el préstamo.");

            var articulos = await _context.Articulos
                .Where(a => ids.Contains(a.IdArticulo))
                .ToListAsync();

            var idsEncontrados = articulos.Select(a => a.IdArticulo).ToHashSet();
            var idsNoEncontrados = ids.Where(id => !idsEncontrados.Contains(id)).ToList();
            if (idsNoEncontrados.Any())
                throw new InvalidOperationException($"No existen los artículos: {string.Join(", ", idsNoEncontrados)}.");

            var idsNoDisponibles = articulos
                .Where(a => !a.EstaDisponibleParaPrestamo())
                .Select(a => a.IdArticulo)
                .ToList();

            if (idsNoDisponibles.Any())
                throw new InvalidOperationException($"Los artículos no disponibles para préstamo son: {string.Join(", ", idsNoDisponibles)}.");
        }
    }
}