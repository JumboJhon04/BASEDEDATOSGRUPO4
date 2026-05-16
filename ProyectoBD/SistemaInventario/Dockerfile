# 1. Etapa de compilación (SDK de .NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Al estar en la raíz de la solución, copiamos el .sln directamente
COPY SistemaInventario/*.sln ./

# Copiamos los archivos .csproj usando las carpetas que tienes al lado del Dockerfile
COPY CleanTeeth.WebApi/CleanTeeth.WebApi.csproj ./CleanTeeth.WebApi/
COPY CleanTeeth.Application/CleanTeeth.Application.csproj ./CleanTeeth.Application/
COPY CleanTeeth.Domain/CleanTeeth.Domain.csproj ./CleanTeeth.Domain/
COPY CleanTeeth.Infrastructure/CleanTeeth.Infrastructure.csproj ./CleanTeeth.Infrastructure/

# Restauramos los paquetes NuGet de toda la solución
RUN dotnet restore *.sln

# Copiamos todo el resto del código de los proyectos al contenedor
COPY . .

# Nos movemos a la carpeta de tu WebApi para compilar el publish
WORKDIR "/src/CleanTeeth.WebApi"
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# 2. Etapa de ejecución (Runtime de .NET 10)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "CleanTeeth.WebApi.dll"]