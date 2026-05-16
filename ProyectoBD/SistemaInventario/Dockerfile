FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY SistemaInventario.API/SistemaInventario.API.csproj ./SistemaInventario.API/
COPY SistemaInventario.Aplication/SistemaInventario.Aplication.csproj ./SistemaInventario.Aplication/
COPY SistemaInventario.Domain/SistemaInventario.Domain.csproj ./SistemaInventario.Domain/
COPY SistemaInventario.Infrastructure/SistemaInventario.Infrastructure.csproj ./SistemaInventario.Infrastructure/

RUN dotnet restore SistemaInventario.API/SistemaInventario.API.csproj

COPY . .
RUN rm -f SistemaInventario.API/global.json

WORKDIR "/src/SistemaInventario.API"
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV TZ=America/Guayaquil

ENTRYPOINT ["dotnet", "SistemaInventario.API.dll"]
