FROM gradle:8.5-jdk17 AS build
WORKDIR /app
COPY . .
RUN gradle jar --no-daemon

FROM openjdk:17-jdk-slim
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
COPY --from=build /root/.gradle/caches/modules-2/files-2.1/**/mysql-connector-*.jar /app/libs/
ENV DB_URL=jdbc:mysql://db:3306/tarot_project DB_USER=root DB_PASSWORD=example
CMD ["java","-cp","app.jar:/app/libs/*","server.Server"]
