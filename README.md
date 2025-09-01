# ProjetCNAM Tarot Game

This repository contains an old multiplayer Tarot project updated to run easily with Docker.

## Prerequisites
- Docker and Docker Compose installed

## Usage
Run the following command to start the MySQL database and the Java server:

```bash
docker-compose up --build
```

The server listens on port `3333` and connects to the MySQL container using the environment variables defined in `docker-compose.yml`.
Clients open a second connection handled by `ServerListener` to receive real-time events like lobby updates.

A basic database schema is provided in `db/init.sql` and loaded automatically when the database container starts.

## Development
The project uses Gradle 8 and Java 17. To build the jar locally:

```bash
./gradlew jar
```

The main entry point of the server is `server.Server`.

## Running the client with Docker
An optional `client` service is defined in `docker-compose.yml`. It launches the
JavaFX GUI and connects to the server container. An X server must be available
on the host so Docker can display the window. On Linux you can run:

```bash
DISPLAY=$DISPLAY docker-compose run --rm client
```
The Docker image now installs the X11 and OpenGL libraries required by JavaFX
so the GUI can launch in the container.

If you run Linux, you may need to allow Docker to access your X server with:

```bash
xhost +local:
```

On Windows, install an X server such as VcXsrv and ensure the `DISPLAY` environment variable is set before running the command. The client container now bundles all required JavaFX libraries so the GUI starts without additional setup.

### Should the client run in Docker?
Running the GUI inside Docker guarantees the correct JavaFX dependencies are present and avoids configuring your local JVM. However it requires an X server on the host and may be less convenient during development. If you already have Java and JavaFX installed locally, you can run the client from your IDE or with `./gradlew run` without Docker.

### Running the client in a web browser
This project can also run the JavaFX client in a browser thanks to [JPro](https://www.jpro.one/).
After installing the JPro Gradle plugin, launch the application on `http://localhost:8080` with:

```bash
./gradlew jproRun -PenableJPro
```

To embed the application in your portfolio, point an iframe to the deployed JPro instance:

```html
<iframe
  src="https://play.example.com/app"
  style="width:100%;height:100%;border:0;"
  allow="fullscreen; autoplay; clipboard-read; clipboard-write">
</iframe>
```

Replace `play.example.com` with your own domain when deploying.

