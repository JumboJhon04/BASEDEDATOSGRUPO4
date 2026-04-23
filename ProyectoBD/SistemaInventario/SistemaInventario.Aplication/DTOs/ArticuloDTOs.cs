namespace SistemaInventario.Application.DTOs
{
    public class ArticuloDTO
    {
        public int IdArticulo { get; set; }
        public string CodigoInstitucional { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string? Marca { get; set; } // Agregado según RF03 
        public string? Modelo { get; set; } // Agregado según RF03 
        public string? NumeroSerie { get; set; } // Agregado según RF03 
        public string Estado { get; set; } = string.Empty;
        public string? DescripcionTecnica { get; set; } // Agregado según RF03 
        public string? ObservacionesFisicas { get; set; }
        public int IdCategoria { get; set; }
        public string? Categoria { get; set; }
        public int IdUbicacion { get; set; }
        public string? Ubicacion { get; set; }
        public int IdResponsable { get; set; }
        public string? Responsable { get; set; }
    }
}