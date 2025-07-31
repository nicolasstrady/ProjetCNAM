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

