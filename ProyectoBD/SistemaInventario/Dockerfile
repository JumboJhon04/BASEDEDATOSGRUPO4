# 1. Etapa de compilación (SDK de .NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copiamos la solución y los archivos .csproj de CADA proyecto para restaurar dependencias
COPY *.sln ./
COPY src/Presentation/WebApi/WebApi.csproj ./src/Presentation/WebApi/
COPY src/Core/Application/Application.csproj ./src/Core/Application/
COPY src/Core/Domain/Domain.csproj ./src/Core/Domain/
COPY src/Infrastructure/Infrastructure.csproj ./src/Infrastructure/

# Ejecutamos la restauración de paquetes Nuget
RUN dotnet restore

# Copiamos todo el resto del código fuente
COPY . .

# Compilamos y publicamos el proyecto WebApi (el ejecutable) en modo Release
WORKDIR "/src/src/Presentation/WebApi"
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# 2. Etapa de ejecución (Runtime de .NET 10)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Exponemos el puerto que Render/Railway leerán por defecto
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "WebApi.dll"]