FROM gradle:8.5-jdk17 AS build
WORKDIR /app
COPY . .
RUN gradle jar --no-daemon

FROM openjdk:17-jdk-slim
WORKDIR /app
# install basic X11, GTK and OpenGL libraries required by JavaFX
RUN apt-get update \
    && apt-get install -y libx11-6 libxext6 libxrender1 libxtst6 libxi6 libxkbcommon-x11-0 libfreetype6 libfontconfig1 libgtk-3-0 libgl1-mesa-glx libasound2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/build/libs/*.jar app.jar
COPY --from=build /home/gradle/.gradle/caches/modules-2/files-2.1/*/*/*/*/*.jar /app/libs/
ENV DB_URL=jdbc:mysql://db:3306/tarot_project DB_USER=root DB_PASSWORD=example
CMD ["java","-cp","app.jar:/app/libs/*","server.Server"]
