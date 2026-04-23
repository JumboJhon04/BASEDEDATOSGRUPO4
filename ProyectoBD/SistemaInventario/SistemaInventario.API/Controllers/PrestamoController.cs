using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaInventario.API.Extensions;
using SistemaInventario.Application.DTOs;
using SistemaInventario.Application.Interfaces;

[Route("api/[controller]")]
[ApiController]
public class PrestamosController : ControllerBase
{
    private readonly IPrestamoRepository _repository;
    public PrestamosController(IPrestamoRepository repository) => _repository = repository;

    [HttpPost]
    [Authorize(Roles = "Administrador,Docente,Estudiante")]
    public async Task<IActionResult> Registrar(PrestamoCreateDTO dto)
    {
        try
        {
            if (!User.TryGetUserId(out var idUsuarioActor))
                return Unauthorized(new { message = "Token inválido: no se pudo obtener el usuario actor." });

            // Una solicitud normal se registra para el usuario autenticado.
            dto.IdUsuario = idUsuarioActor;

            var result = await _repository.RegistrarPrestamoAsync(dto);
            return result ? Ok(new { m = "Solicitud de préstamo registrada en estado Pendiente" }) : BadRequest(new { error = "No se pudo registrar la solicitud." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("admin")]
    [Authorize(Roles = "Administrador,Docente")]
    public async Task<IActionResult> RegistrarAdmin(PrestamoCreateAdminDTO dto)
    {
        try
        {
            if (!User.TryGetUserId(out var idUsuarioActor))
                return Unauthorized(new { message = "Token inválido: no se pudo obtener el usuario actor." });

            dto.IdAdminAutoriza = idUsuarioActor;

            var result = await _repository.RegistrarPrestamoAdminAsync(dto);
            return result ? Ok(new { m = "Préstamo creado por administrador en estado Activo" }) : BadRequest(new { error = "No se pudo registrar el préstamo por administrador." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet]
    [Authorize(Roles = "Administrador,Docente")]
    public async Task<IActionResult> GetTodos() => Ok(await _repository.ObtenerTodosPrestamosAsync());

    [HttpPut("aprobar/{id}")]
    [Authorize(Roles = "Administrador,Docente")]
    public async Task<IActionResult> Aprobar(int id, PrestamoAprobarDTO dto)
    {
        try
        {
            if (!User.TryGetUserId(out var idUsuarioActor))
                return Unauthorized(new { message = "Token inválido: no se pudo obtener el usuario actor." });

            dto.IdAdminAutoriza = idUsuarioActor;

            var result = await _repository.AprobarPrestamoAsync(id, dto.IdAdminAutoriza);
            return result ? Ok(new { m = "Préstamo aprobado y artículos marcados como PRESTADO" }) : BadRequest(new { error = "No se pudo aprobar el préstamo." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("activos")]
    [Authorize(Roles = "Administrador,Docente")]
    public async Task<IActionResult> GetActivos() => Ok(await _repository.ObtenerPrestamosActivosAsync());

    [HttpPut("finalizar/{id}")]
    [Authorize(Roles = "Administrador,Docente")]
    public async Task<IActionResult> Finalizar(int id)
    {
        try
        {
            if (!User.TryGetUserId(out var idUsuarioActor))
                return Unauthorized(new { message = "Token inválido: no se pudo obtener el usuario actor." });

            var result = await _repository.FinalizarPrestamoAsync(id, idUsuarioActor);
            return result ? Ok(new { m = "Devolución completada" }) : BadRequest(new { error = "No se pudo finalizar el préstamo." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("rechazar/{id}")]
    [Authorize(Roles = "Administrador,Docente")]
    public async Task<IActionResult> Rechazar(int id)
    {
        try
        {
            if (!User.TryGetUserId(out var idUsuarioActor))
                return Unauthorized(new { message = "Token inválido: no se pudo obtener el usuario actor." });

            var result = await _repository.RechazarPrestamoAsync(id, idUsuarioActor);
            return result ? Ok(new { m = "Solicitud de préstamo rechazada correctamente" }) : BadRequest(new { error = "No se pudo rechazar la solicitud." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}