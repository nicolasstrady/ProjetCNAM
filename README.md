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

On Windows, install an X server such as VcXsrv and ensure the `DISPLAY`
environment variable is set before running the command.

