CREATE DATABASE IF NOT EXISTS tarot_project;
USE tarot_project;

CREATE TABLE IF NOT EXISTS utilisateur (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(50),
    prenom VARCHAR(50),
    email VARCHAR(100),
    pseudo VARCHAR(50),
    motdepasse VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS partie (
    id INT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS joueur (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur INT,
    num INT,
    partie INT,
    reponse VARCHAR(20) DEFAULT 'WAIT',
    equipe INT DEFAULT 0,
    carte1 INT NULL,
    carte2 INT NULL,
    carte3 INT NULL,
    carte4 INT NULL,
    carte5 INT NULL,
    carte6 INT NULL,
    carte7 INT NULL,
    carte8 INT NULL,
    carte9 INT NULL,
    carte10 INT NULL,
    carte11 INT NULL,
    carte12 INT NULL,
    carte13 INT NULL,
    carte14 INT NULL,
    carte15 INT NULL
);

CREATE TABLE IF NOT EXISTS carte (
    id INT PRIMARY KEY,
    lien VARCHAR(100),
    couleur VARCHAR(20),
    valeur VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS chien (
    id INT AUTO_INCREMENT PRIMARY KEY,
    carte1 INT,
    carte2 INT,
    carte3 INT
);

CREATE TABLE IF NOT EXISTS plis (
    id INT PRIMARY KEY,
    pliChien TINYINT(1),
    carte1 INT NULL,
    carte2 INT NULL,
    carte3 INT NULL,
    carte4 INT NULL,
    carte5 INT NULL
);

CREATE TABLE IF NOT EXISTS main (
    id INT PRIMARY KEY,
    carte1 INT,
    carte2 INT,
    carte3 INT,
    carte4 INT,
    carte5 INT,
    carte6 INT,
    carte7 INT,
    carte8 INT,
    carte9 INT,
    carte10 INT,
    carte11 INT,
    carte12 INT,
    carte13 INT,
    carte14 INT,
    carte15 INT
);

INSERT INTO utilisateur (nom, prenom, email, pseudo, motdepasse) VALUES ('Doe','John','john@example.com','john','password');
