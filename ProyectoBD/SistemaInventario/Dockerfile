# 1. Etapa de compilación (SDK de .NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copiamos la solución (.sln) buscando en la raíz del repositorio
COPY ProyectoBD/SistemaInventario/*.sln ./

# Copiamos los archivos .csproj de tus proyectos reales con sus nombres exactos
COPY ProyectoBD/CleanTeeth.WebApi/CleanTeeth.WebApi.csproj ./CleanTeeth.WebApi/
COPY ProyectoBD/CleanTeeth.Application/CleanTeeth.Application.csproj ./CleanTeeth.Application/
COPY ProyectoBD/CleanTeeth.Domain/CleanTeeth.Domain.csproj ./CleanTeeth.Domain/
COPY ProyectoBD/CleanTeeth.Infrastructure/CleanTeeth.Infrastructure.csproj ./CleanTeeth.Infrastructure/

# Restauramos los paquetes NuGet de toda la solución usando el .sln
RUN dotnet restore *.sln

# Copiamos todo el resto del código del repositorio al contenedor
COPY . .

# Nos movemos a la carpeta de tu WebApi real para compilar el publish
WORKDIR "/src/ProyectoBD/CleanTeeth.WebApi"
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# 2. Etapa de ejecución (Runtime de .NET 10)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Ejecutamos tu DLL real del proyecto Presentation
ENTRYPOINT ["dotnet", "CleanTeeth.WebApi.dll"]