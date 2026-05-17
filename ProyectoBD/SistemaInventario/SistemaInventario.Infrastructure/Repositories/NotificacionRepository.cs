using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SistemaInventario.Application.DTOs;
using SistemaInventario.Application.Interfaces;
using SistemaInventario.Infrastructure.Persistence;
using System.Net;
using System.Net.Mail;

namespace SistemaInventario.Infrastructure.Repositories
{
    public class NotificacionRepository : INotificacionRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<NotificacionRepository> _logger;

        public NotificacionRepository(
            ApplicationDbContext context,
            IConfiguration configuration,
            ILogger<NotificacionRepository> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<bool> CrearNotificacionAsync(NotificacionCreateDTO dto)
        {
            var sql = @"INSERT INTO NOTIFICACIONES (ID_PRESTAMO, MENSAJE, ESTADO_ENVIO) 
                        VALUES ({0}, {1}, 'Pendiente')";
            await _context.Database.ExecuteSqlRawAsync(sql, dto.IdPrestamo, dto.Mensaje);
            return true;
        }

        public async Task GenerarAlertasVencimientoAsync()
        {
            // Buscamos préstamos que: 1. No se han devuelto y 2. Ya pasó la fecha prevista
            // Usamos SQL crudo para que Oracle 10g maneje bien las fechas
            var sqlVencidos = @"SELECT ID_PRESTAMO FROM PRESTAMOS 
                                WHERE ESTADO_PRESTAMO = 'ACTIVO' 
                                AND FECHA_PREVISTA < SYSDATE";

            // Esto es lógica pura: si hay vencidos, insertamos notificación
            var prestamosVencidos = await _context.Database.SqlQueryRaw<int>(sqlVencidos).ToListAsync();

            foreach (var id in prestamosVencidos)
            {
                await CrearNotificacionAsync(new NotificacionCreateDTO
                {
                    IdPrestamo = id,
                    Mensaje = "¡Alerta! El plazo de devolución ha vencido. Por favor, acercarse a la bodega."
                });
            }
        }

        public async Task<IEnumerable<object>> ObtenerPendientesAsync(int idUsuario)
        {
            var connection = _context.Database.GetDbConnection();
            var wasClosed = connection.State != System.Data.ConnectionState.Open;

            if (wasClosed)
                await connection.OpenAsync();

            try
            {
                await using var command = connection.CreateCommand();
                // Oracle 10g: usar ROWNUM sobre subconsulta ordenada para limitar resultados.
                command.CommandText = @"
                    SELECT ID_NOTIFICACION, ID_PRESTAMO, MENSAJE, ESTADO_ENVIO
                    FROM (
                        SELECT N.ID_NOTIFICACION, N.ID_PRESTAMO, N.MENSAJE, N.ESTADO_ENVIO
                        FROM NOTIFICACIONES N
                        INNER JOIN PRESTAMOS P ON P.ID_PRESTAMO = N.ID_PRESTAMO
                        WHERE P.ID_USUARIO = :idUsuario
                        ORDER BY ID_NOTIFICACION DESC
                    )
                    WHERE ROWNUM <= 20";
                var parameter = command.CreateParameter();
                parameter.ParameterName = "idUsuario";
                parameter.Value = idUsuario;
                command.Parameters.Add(parameter);

                var result = new List<object>();
                await using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    result.Add(new
                    {
                        IdNotificacion = reader.GetInt32(0),
                        IdPrestamo = reader.GetInt32(1),
                        Mensaje = reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                        EstadoEnvio = reader.IsDBNull(3) ? "Pendiente" : reader.GetString(3)
                    });
                }

                return result;
            }
            finally
            {
                if (wasClosed)
                    await connection.CloseAsync();
            }
        }

        public async Task<bool> MarcarComoEnviadaAsync(int idNotificacion)
        {
            var sql = "UPDATE NOTIFICACIONES SET ESTADO_ENVIO = 'Enviado' WHERE ID_NOTIFICACION = {0}";
            await _context.Database.ExecuteSqlRawAsync(sql, idNotificacion);
            return true;
        }

        public async Task<bool> MarcarComoLeidaAsync(int idNotificacion)
        {
            var sql = "UPDATE NOTIFICACIONES SET ESTADO_ENVIO = 'Leído' WHERE ID_NOTIFICACION = {0}";
            await _context.Database.ExecuteSqlRawAsync(sql, idNotificacion);
            return true;
        }

        public async Task<int> EnviarPendientesAsync()
        {
            var pendientes = await ObtenerPendientesConCorreoAsync();
            return await EnviarListaPendientesAsync(pendientes);
        }

        public async Task<int> EnviarPendientesPorPrestamoAsync(int idPrestamo)
        {
            var pendientes = await ObtenerPendientesConCorreoAsync(idPrestamo);
            return await EnviarListaPendientesAsync(pendientes);
        }

        private async Task<int> EnviarListaPendientesAsync(List<NotificacionPendienteCorreo> pendientes)
        {
            var enviados = 0;

            foreach (var noti in pendientes)
            {
                try
                {
                    var enviado = await IntentarEnviarCorreoAsync(noti.Correo, "Recordatorio de préstamo", noti.Mensaje);
                    if (!enviado) continue;

                    var sql = "UPDATE NOTIFICACIONES SET ESTADO_ENVIO = 'Enviado' WHERE ID_NOTIFICACION = {0}";
                    await _context.Database.ExecuteSqlRawAsync(sql, noti.IdNotificacion);
                    enviados++;
                }
                catch (SmtpException ex)
                {
                    // Si falla SMTP (auth, conexión, etc.) dejamos la notificación en Pendiente.
                    // Así se puede reintentar luego sin romper el flujo principal.
                    _logger.LogWarning(
                        ex,
                        "No se pudo enviar la notificación {IdNotificacion} por SMTP. Destino: {Destino}. Motivo: {Motivo}. Se mantiene en Pendiente.",
                        noti.IdNotificacion,
                        noti.Correo,
                        ex.Message);
                    continue;
                }
                catch (Exception ex)
                {
                    // Evita cortar el lote completo por un error puntual.
                    _logger.LogWarning(
                        ex,
                        "Fallo inesperado enviando notificación {IdNotificacion}. Destino: {Destino}. Se mantiene en Pendiente.",
                        noti.IdNotificacion,
                        noti.Correo);
                    continue;
                }
            }

            return enviados;
        }

        private async Task<List<NotificacionPendienteCorreo>> ObtenerPendientesConCorreoAsync()
        {
            var connection = _context.Database.GetDbConnection();
            var wasClosed = connection.State != System.Data.ConnectionState.Open;

            if (wasClosed)
                await connection.OpenAsync();

            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = @"
                    SELECT N.ID_NOTIFICACION, U.CORREO, N.MENSAJE
                    FROM NOTIFICACIONES N
                    INNER JOIN PRESTAMOS P ON P.ID_PRESTAMO = N.ID_PRESTAMO
                    INNER JOIN USUARIOS U ON U.ID_USUARIO = P.ID_USUARIO
                    WHERE N.ESTADO_ENVIO = 'Pendiente'";

                var pendientes = new List<NotificacionPendienteCorreo>();
                await using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    pendientes.Add(new NotificacionPendienteCorreo
                    {
                        IdNotificacion = reader.GetInt32(0),
                        Correo = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                        Mensaje = reader.IsDBNull(2) ? string.Empty : reader.GetString(2)
                    });
                }

                return pendientes;
            }
            finally
            {
                if (wasClosed)
                    await connection.CloseAsync();
            }
        }

        private async Task<List<NotificacionPendienteCorreo>> ObtenerPendientesConCorreoAsync(int idPrestamo)
        {
            var connection = _context.Database.GetDbConnection();
            var wasClosed = connection.State != System.Data.ConnectionState.Open;

            if (wasClosed)
                await connection.OpenAsync();

            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = @"
                    SELECT N.ID_NOTIFICACION, U.CORREO, N.MENSAJE
                    FROM NOTIFICACIONES N
                    INNER JOIN PRESTAMOS P ON P.ID_PRESTAMO = N.ID_PRESTAMO
                    INNER JOIN USUARIOS U ON U.ID_USUARIO = P.ID_USUARIO
                    WHERE N.ESTADO_ENVIO = 'Pendiente'
                      AND N.ID_PRESTAMO = :idPrestamo";

                var parameter = command.CreateParameter();
                parameter.ParameterName = "idPrestamo";
                parameter.Value = idPrestamo;
                command.Parameters.Add(parameter);

                var pendientes = new List<NotificacionPendienteCorreo>();
                await using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    pendientes.Add(new NotificacionPendienteCorreo
                    {
                        IdNotificacion = reader.GetInt32(0),
                        Correo = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                        Mensaje = reader.IsDBNull(2) ? string.Empty : reader.GetString(2)
                    });
                }

                return pendientes;
            }
            finally
            {
                if (wasClosed)
                    await connection.CloseAsync();
            }
        }

        private async Task<bool> IntentarEnviarCorreoAsync(string destino, string asunto, string cuerpo)
        {
            if (string.IsNullOrWhiteSpace(destino))
                return false;

            var simulateOnly = ParseBool(_configuration["Smtp:SimulateOnly"], true);
            if (simulateOnly)
                return true;

            // Cambiamos las variables SMTP viejas por la API Key y el correo de origen
            var apiKey = _configuration["Brevo:ApiKey"];
            var from = _configuration["Smtp:From"];

            if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(from))
            {
                _logger.LogWarning("Configuración de correo incompleta. Verifica Brevo:ApiKey y Smtp:From.");
                return false;
            }

            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.Add("api-key", apiKey);
                client.DefaultRequestHeaders.Add("accept", "application/json");

                // Construimos el JSON nativo que espera la API
                var payload = new
                {
                    sender = new { email = from, name = "Sistema de Inventario" },
                    to = new[] { new { email = destino } },
                    subject = asunto,
                    htmlContent = cuerpo
                };

                string jsonString = System.Text.Json.JsonSerializer.Serialize(payload);
                using var content = new StringContent(jsonString, System.Text.Encoding.UTF8, "application/json");

                // Render permite el puerto 443 (HTTPS) sin restricciones
                var response = await client.PostAsync("https://api.brevo.com/v3/smtp/email", content);

                if (!response.IsSuccessStatusCode)
                {
                    string errorResponse = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning($"La API de correo respondió con error: {response.StatusCode} - {errorResponse}");
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error crítico al intentar conectar con la API de mensajería.");
                return false;
            }
        }

        private static bool ParseBool(string? value, bool defaultValue)
        {
            return bool.TryParse(value, out var parsed) ? parsed : defaultValue;
        }

        private static int ParseInt(string? value, int defaultValue)
        {
            return int.TryParse(value, out var parsed) ? parsed : defaultValue;
        }

        private sealed class NotificacionPendienteCorreo
        {
            public int IdNotificacion { get; set; }
            public string Correo { get; set; } = string.Empty;
            public string Mensaje { get; set; } = string.Empty;
        }
    }
}