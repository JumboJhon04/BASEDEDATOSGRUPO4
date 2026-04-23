using SistemaInventario.Application.DTOs;

namespace SistemaInventario.Application.Interfaces
{
    public interface IPrestamoRepository
    {
        // Registro transaccional del préstamo
        Task<bool> RegistrarPrestamoAsync(PrestamoCreateDTO dto);

        // Registro directo de préstamo por parte de administrador
        Task<bool> RegistrarPrestamoAdminAsync(PrestamoCreateAdminDTO dto);

        // Aprobar un préstamo pendiente
        Task<bool> AprobarPrestamoAsync(int idPrestamo, int idAdminAutoriza);

        // Rechazar un préstamo pendiente
        Task<bool> RechazarPrestamoAsync(int idPrestamo, int idAdminAutoriza);

        // Ver todos los préstamos registrados
        Task<IEnumerable<PrestamoDTO>> ObtenerTodosPrestamosAsync();

        // Ver todos los préstamos activos en la FISEI
        Task<IEnumerable<PrestamoDTO>> ObtenerPrestamosActivosAsync();

        // Finalizar y marcar artículos como disponibles nuevamente
        Task<bool> FinalizarPrestamoAsync(int idPrestamo, int idUsuarioActor);

        /// <summary>
        /// Revisa todos los préstamos Activos cuya FechaPrevista ya pasó
        /// y los marca como Vencido en la base de datos.
        /// Se llama automáticamente al consultar préstamos.
        /// </summary>
        Task MarcarVencidosAsync();
    }
}