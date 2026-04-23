using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Data;
using SistemaInventario.Domain.Entities;
using SistemaInventario.Application.DTOs;
using SistemaInventario.Application.Interfaces;
using SistemaInventario.Infrastructure.Persistence;

namespace SistemaInventario.Infrastructure.Repositories
{
    public class ArticuloRepository : IArticuloRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IAuditoriaRepository _auditoriaRepository;

        public ArticuloRepository(ApplicationDbContext context, IAuditoriaRepository auditoriaRepository)
        {
            _context = context;
            _auditoriaRepository = auditoriaRepository;
        }

        public async Task<IEnumerable<ArticuloDTO>> ObtenerCatalogoAsync()
        {
            return await (from a in _context.Articulos.AsNoTracking()
                          join c in _context.Categorias.AsNoTracking() on a.IdCategoria equals c.IdCategoria into categoriaJoin
                          from c in categoriaJoin.DefaultIfEmpty()
                          join u in _context.Ubicaciones.AsNoTracking() on a.IdUbicacion equals u.IdUbicacion into ubicacionJoin
                          from u in ubicacionJoin.DefaultIfEmpty()
                          join r in _context.Usuarios.AsNoTracking() on a.IdResponsable equals r.IdUsuario into responsableJoin
                          from r in responsableJoin.DefaultIfEmpty()
                          orderby a.IdArticulo descending
                          select new ArticuloDTO
                          {
                              IdArticulo = a.IdArticulo,
                              CodigoInstitucional = a.Codigo.Valor,
                              Nombre = a.Nombre,
                              Marca = a.Marca,
                              Modelo = a.Modelo,
                              NumeroSerie = a.NumeroSerie,
                              Estado = a.Estado.ToString(),
                              DescripcionTecnica = a.DescripcionTecnica,
                              ObservacionesFisicas = a.ObservacionesFisicas,
                              IdCategoria = a.IdCategoria,
                              Categoria = c != null ? c.NombreCategoria : null,
                              IdUbicacion = a.IdUbicacion,
                              Ubicacion = u != null ? u.NombreEspacio : null,
                              IdResponsable = a.IdResponsable,
                              Responsable = r != null ? r.Nombre : null
                          }).ToListAsync();
        }

        public async Task<Articulo?> ObtenerPorIdAsync(int id)
        {
            var articulos = await _context.Articulos
        .Where(a => a.IdArticulo == id)
        .ToListAsync(); // Esto genera un SELECT simple con WHERE que 10g sí entiende

            return articulos.FirstOrDefault();
        }

        public async Task AgregarAsync(Articulo articulo)
        {
            _context.Articulos.Add(articulo);
        }
        public async Task<int> CrearManualAsync(Articulo articulo, int idUsuarioActor)
        {
            // Usamos ExecuteSqlRawAsync que es más limpio que el DbCommand manual
            var sql = @"INSERT INTO ARTICULOS 
                (COD_INSTITUCIONAL, NOMBRE, MARCA, MODELO, NUMERO_SERIE, 
                 DESCRIPCION_TECNICA, OBSERVACIONES_FISICAS, ESTADO, 
                 ID_CATEGORIA, ID_UBICACION, ID_RESPONSABLE)
                VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9}, {10})";

            var affected = await _context.Database.ExecuteSqlRawAsync(sql,
                articulo.Codigo.Valor, // 👈 Aquí ya viene validado con el -UTA-
                articulo.Nombre,
                articulo.Marca,
                articulo.Modelo,
                articulo.NumeroSerie,
                articulo.DescripcionTecnica,
                articulo.ObservacionesFisicas,
                articulo.Estado.ToString(),
                articulo.IdCategoria,
                articulo.IdUbicacion,
                articulo.IdResponsable);

            if (affected > 0)
            {
                var idArticuloCreado = await ObtenerIdArticuloPorCodigoAsync(articulo.Codigo.Valor);

                await _auditoriaRepository.RegistrarAccionAsync(new AuditoriaCreateDTO
                {
                    IdUsuario = idUsuarioActor,
                    TablaAfectada = "ARTICULOS",
                    IdRegistroAfectado = idArticuloCreado ?? 0,
                    Accion = "INSERT",
                    DetallesCambio = $"Artículo creado: {articulo.Nombre} ({articulo.Codigo.Valor})"
                });
            }

            return affected;
        }

        public void Actualizar(Articulo articulo)
        {
            _context.Articulos.Update(articulo);
        }

        public async Task<int> ActualizarManualAsync(
            int id,
            Articulo articulo,
            string estado,
            int idUsuarioActor)
        {
            var sql = @"UPDATE ARTICULOS
                SET COD_INSTITUCIONAL = {1},
                    NOMBRE = {2},
                    MARCA = {3},
                    MODELO = {4},
                    NUMERO_SERIE = {5},
                    DESCRIPCION_TECNICA = {6},
                    OBSERVACIONES_FISICAS = {7},
                    ESTADO = {8},
                    ID_CATEGORIA = {9},
                    ID_UBICACION = {10},
                    ID_RESPONSABLE = {11}
                WHERE ID_ARTICULO = {0}";

            var affected = await _context.Database.ExecuteSqlRawAsync(sql,
                id,
                articulo.Codigo.Valor,
                articulo.Nombre,
                articulo.Marca,
                articulo.Modelo,
                articulo.NumeroSerie,
                articulo.DescripcionTecnica,
                articulo.ObservacionesFisicas,
                estado,
                articulo.IdCategoria,
                articulo.IdUbicacion,
                articulo.IdResponsable);

            if (affected > 0)
            {
                await _auditoriaRepository.RegistrarAccionAsync(new AuditoriaCreateDTO
                {
                    IdUsuario = idUsuarioActor,
                    TablaAfectada = "ARTICULOS",
                    IdRegistroAfectado = id,
                    Accion = "UPDATE",
                    DetallesCambio = $"Artículo actualizado. ID={id}, Estado={estado}"
                });
            }

            return affected;
        }

        public async Task<int> EliminarManualAsync(int id, int idUsuarioActor)
        {
            // SQL directo: Corto, conciso y sin puntos y coma (;)
            var sql = "DELETE FROM ARTICULOS WHERE ID_ARTICULO = {0}";

            // Esto ejecuta el comando directamente en Oracle 10g
            var affected = await _context.Database.ExecuteSqlRawAsync(sql, id);

            if (affected > 0)
            {
                await _auditoriaRepository.RegistrarAccionAsync(new AuditoriaCreateDTO
                {
                    IdUsuario = idUsuarioActor,
                    TablaAfectada = "ARTICULOS",
                    IdRegistroAfectado = id,
                    Accion = "DELETE",
                    DetallesCambio = $"Artículo eliminado. ID={id}"
                });
            }

            return affected;
        }

        public async Task GuardarCambiosAsync()
        {
            await _context.SaveChangesAsync();
        }

        private async Task<int?> ObtenerIdArticuloPorCodigoAsync(string codigoInstitucional)
        {
            const string sql = @"SELECT ID_ARTICULO
                                 FROM ARTICULOS
                                 WHERE COD_INSTITUCIONAL = :p_codigo";

            var connection = _context.Database.GetDbConnection();
            var wasClosed = connection.State != ConnectionState.Open;

            if (wasClosed)
                await connection.OpenAsync();

            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = sql;
                command.Transaction = _context.Database.CurrentTransaction?.GetDbTransaction();

                var parameter = command.CreateParameter();
                parameter.ParameterName = "p_codigo";
                parameter.Value = codigoInstitucional;
                command.Parameters.Add(parameter);

                var result = await command.ExecuteScalarAsync();
                if (result == null || result == DBNull.Value)
                    return null;

                return Convert.ToInt32(result);
            }
            finally
            {
                if (wasClosed)
                    await connection.CloseAsync();
            }
        }
    }
}