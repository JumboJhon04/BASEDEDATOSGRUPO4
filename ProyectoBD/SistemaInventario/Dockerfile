# 1. Etapa de compilación (SDK de .NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copiamos la solución desde la carpeta SistemaInventario
COPY SistemaInventario/SistemaInventario.* ./SistemaInventario/

# Copiamos cada archivo .csproj apuntando ADENTRO de la carpeta SistemaInventario
COPY SistemaInventario/SistemaInventario.API/SistemaInventario.API.csproj ./SistemaInventario.API/
COPY SistemaInventario/SistemaInventario.Aplication/SistemaInventario.Aplication.csproj ./SistemaInventario.Aplication/
COPY SistemaInventario/SistemaInventario.Domain/SistemaInventario.Domain.csproj ./SistemaInventario.Domain/
COPY SistemaInventario/SistemaInventario.Infrastructure/SistemaInventario.Infrastructure.csproj ./SistemaInventario.Infrastructure/

# Restauramos los paquetes NuGet usando la solución
RUN dotnet restore SistemaInventario/SistemaInventario.*

# Copiamos absolutamente todo el resto del código al contenedor
COPY . .

# Nos movemos a la ruta interna de la API para compilar el publish
WORKDIR "/src/SistemaInventario.API"
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# 2. Etapa de ejecución (Runtime de .NET 10)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "SistemaInventario.API.dll"]
