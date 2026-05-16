# 1. Etapa de compilación (SDK de .NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copiamos el .sln desde la raíz del repositorio
COPY SistemaInventario.slnx ./

# Copiamos los .csproj con los nombres correctos de tus carpetas
COPY SistemaInventario.API/SistemaInventario.API.csproj ./SistemaInventario.API/
COPY SistemaInventario.Aplication/SistemaInventario.Aplication.csproj ./SistemaInventario.Aplication/
COPY SistemaInventario.Domain/SistemaInventario.Domain.csproj ./SistemaInventario.Domain/
COPY SistemaInventario.Infrastructure/SistemaInventario.Infrastructure.csproj ./SistemaInventario.Infrastructure/

# Restauramos los paquetes NuGet
RUN dotnet restore SistemaInventario.slnx

# Copiamos todo el resto del código
COPY . .

# Compilamos y publicamos desde el proyecto API
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
