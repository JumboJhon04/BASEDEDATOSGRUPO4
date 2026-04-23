using SistemaInventario.Domain.Enums;
using SistemaInventario.Domain.Exceptions;
using System;
using System.ComponentModel.DataAnnotations;

namespace SistemaInventario.Domain.Entities
{
    public class Prestamo
    {
        [Key]
        public int IdPrestamo { get; private set; }
        public int IdUsuario { get; private set; }
        public int? IdAdminAutoriza { get; private set; }

        public DateTime? FechaSalida { get; private set; }
        public DateTime FechaPrevista { get; private set; }
        public DateTime? FechaDevolucionReal { get; private set; }

        // El préstamo se registra como solicitud y requiere aprobación administrativa.
        public EstadoPrestamo Estado { get; private set; } = EstadoPrestamo.Pendiente;

        protected Prestamo() { }

        public Prestamo(int idUsuario, DateTime fechaPrevista)
        {
            if (fechaPrevista <= DateTime.Now)
                throw new DomainException("La fecha prevista de devolución debe ser en el futuro.");

            IdUsuario = idUsuario;
            FechaSalida = null;
            FechaPrevista = fechaPrevista;
            Estado = EstadoPrestamo.Pendiente;
        }

        public void AprobarPrestamo(int idAdminAutoriza)
        {
            if (Estado != EstadoPrestamo.Pendiente)
                throw new DomainException("Solo se pueden aprobar préstamos en estado Pendiente.");

            IdAdminAutoriza = idAdminAutoriza;
            FechaSalida = DateTime.Now;
            Estado = EstadoPrestamo.Activo;
        }

        /// <summary>
        /// Al devolver el artículo, el préstamo pasa a Finalizado.
        /// Se acepta tanto Activo como Vencido porque un préstamo vencido
        /// también puede ser devuelto tarde.
        /// </summary>
        public void FinalizarPrestamo()
        {
            if (Estado != EstadoPrestamo.Activo && Estado != EstadoPrestamo.Vencido)
                throw new DomainException("Solo se puede finalizar un préstamo en estado Activo o Vencido.");

            Estado = EstadoPrestamo.Finalizado;
            FechaDevolucionReal = DateTime.Now;
        }

        /// <summary>
        /// Marca el préstamo como Vencido cuando la FechaPrevista ya pasó
        /// y el artículo aún no fue devuelto. Lo invoca el repositorio al consultar.
        /// </summary>
        public void MarcarVencido()
        {
            if (Estado != EstadoPrestamo.Activo)
                throw new DomainException("Solo un préstamo Activo puede marcarse como Vencido.");

            Estado = EstadoPrestamo.Vencido;
        }
    }
}