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

CREATE TABLE IF NOT EXISTS auth_session (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    tokenHash CHAR(64) NOT NULL UNIQUE,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastSeenAt DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    expiresAt DATETIME NOT NULL,
    INDEX idx_auth_session_userId (userId),
    INDEX idx_auth_session_expiresAt (expiresAt)
);

CREATE TABLE IF NOT EXISTS partie (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(12) NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    ownerUserId INT NULL,
    allowQuickJoin TINYINT(1) NOT NULL DEFAULT 0,
    fillWithBots TINYINT(1) NOT NULL DEFAULT 0,
    mode VARCHAR(20) NOT NULL DEFAULT 'CLASSIC',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    startedAt DATETIME NULL
);

CREATE TABLE IF NOT EXISTS joueur (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur INT,
    num INT,
    partie INT,
    reponse VARCHAR(20) DEFAULT 'WAIT',
    equipe INT DEFAULT 0,
    score DOUBLE DEFAULT 0,
    playerType VARCHAR(10) NOT NULL DEFAULT 'HUMAN',
    botLevel VARCHAR(20) NULL,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    lien VARCHAR(100),
    couleur VARCHAR(20),
    valeur VARCHAR(10),
    points DOUBLE DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS chien (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partie INT,
    carte1 INT,
    carte2 INT,
    carte3 INT
);

CREATE TABLE IF NOT EXISTS plis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partie INT,
    pliChien TINYINT(1),
    carte1 INT NULL,
    carte2 INT NULL,
    carte3 INT NULL,
    carte4 INT NULL,
    carte5 INT NULL,
    joueurGagnant INT NULL
);

CREATE TABLE IF NOT EXISTS main (
    id INT AUTO_INCREMENT PRIMARY KEY,
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

INSERT INTO `utilisateur` (`nom`, `prenom`, `email`, `pseudo`, `motdepasse`) VALUES ('Strady', 'Nicolas', 'nicostrady@gmail.com', 'nistra', 'scrypt$09063e4b6d290c9c8907a7417a137258$dd70ca2b440cf982dc37c1f55025260bc4c12d05a855a68649f048abcf68383cea6160993c9836c392c9343251bfbb2bf8e6c1a15daa56768e8b289d51a0d141');
INSERT INTO `utilisateur` (`nom`, `prenom`, `email`, `pseudo`, `motdepasse`) VALUES ('Sönmez', 'Duygu', 'dodo@gmail.com', 'dodo', 'scrypt$15450ef4c149e19cb660ea493bb26ea2$e54a7314958a8135fa8cb60f09e74ca559f87af430c79d182f5948405d4b7ffc8541a694c5f05294a97729ffe51ed05598cba85554c1f4335b14f31bf0df884f');
INSERT INTO `utilisateur` (`nom`, `prenom`, `email`, `pseudo`, `motdepasse`) VALUES ('Wittmann', 'Hugo', 'hugo@gmail.com', 'hugo', 'scrypt$26cbec0275ec155cdae6f1f8f30d1c70$0c98b6fc60a17167b349e2f720fa346a3a8a453a95dcb3aef0d79c43dafc3b5b46bb915506224e41a9fffa35178fb6c6d1a628ba95000c0962c7d90a1db401ca');
INSERT INTO `utilisateur` (`nom`, `prenom`, `email`, `pseudo`, `motdepasse`) VALUES ('Pottier', 'Domitille', 'dom@gmail.com', 'dom', 'scrypt$e6e9d65e2c6b643d31027c65fe45a4ac$459361be980e4fe2e712856d6b42010ec53baf87e751e8f0d01751821ccd4c55e498c937c271822f323fe5b232f7790e3057477648d5aab64b7384ec16db86ab');
INSERT INTO `utilisateur` (`nom`, `prenom`, `email`, `pseudo`, `motdepasse`) VALUES ('Massicot', 'Hippolyte', 'ipo@gmail.com', 'ipo', 'scrypt$8abf1b67df91ff61129ba0d26048f901$e9c2bb517a21c83c8c3e563679274c4992b3e77963723252ca8780f2b40dbe14a75ad7f609624e6e9d52b2770f4f0046e333e662bd23acf3a17d6010ef01ca66');

INSERT INTO carte (id,lien,couleur,valeur) VALUES (1, 'cards/Spade/card_1_spade.png', 'SPADE', '1');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (2, 'cards/Spade/card_2_spade.png', 'SPADE', '2');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (3, 'cards/Spade/card_3_spade.png', 'SPADE', '3');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (4, 'cards/Spade/card_4_spade.png', 'SPADE', '4');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (5, 'cards/Spade/card_5_spade.png', 'SPADE', '5');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (6, 'cards/Spade/card_6_spade.png', 'SPADE', '6');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (7, 'cards/Spade/card_7_spade.png', 'SPADE', '7');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (8, 'cards/Spade/card_8_spade.png', 'SPADE', '8');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (9, 'cards/Spade/card_9_spade.png', 'SPADE', '9');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (10, 'cards/Spade/card_10_spade.png', 'SPADE', '10');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (11, 'cards/Spade/card_11_spade.png', 'SPADE', '11');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (12, 'cards/Spade/card_12_spade.png', 'SPADE', '12');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (13, 'cards/Spade/card_13_spade.png', 'SPADE', '13');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (14, 'cards/Spade/card_14_spade.png', 'SPADE', '14');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (15, 'cards/Heart/card_1_heart.png', 'HEART', '1');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (16, 'cards/Heart/card_2_heart.png', 'HEART', '2');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (17, 'cards/Heart/card_3_heart.png', 'HEART', '3');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (18, 'cards/Heart/card_4_heart.png', 'HEART', '4');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (19, 'cards/Heart/card_5_heart.png', 'HEART', '5');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (20, 'cards/Heart/card_6_heart.png', 'HEART', '6');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (21, 'cards/Heart/card_7_heart.png', 'HEART', '7');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (22, 'cards/Heart/card_8_heart.png', 'HEART', '8');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (23, 'cards/Heart/card_9_heart.png', 'HEART', '9');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (24, 'cards/Heart/card_10_heart.png', 'HEART', '10');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (25, 'cards/Heart/card_11_heart.png', 'HEART', '11');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (26, 'cards/Heart/card_12_heart.png', 'HEART', '12');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (27, 'cards/Heart/card_13_heart.png', 'HEART', '13');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (28, 'cards/Heart/card_14_heart.png', 'HEART', '14');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (29, 'cards/Diamond/card_1_diamond.png', 'DIAMOND', '1');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (30, 'cards/Diamond/card_2_diamond.png', 'DIAMOND', '2');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (31, 'cards/Diamond/card_3_diamond.png', 'DIAMOND', '3');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (32, 'cards/Diamond/card_4_diamond.png', 'DIAMOND', '4');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (33, 'cards/Diamond/card_5_diamond.png', 'DIAMOND', '5');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (34, 'cards/Diamond/card_6_diamond.png', 'DIAMOND', '6');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (35, 'cards/Diamond/card_7_diamond.png', 'DIAMOND', '7');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (36, 'cards/Diamond/card_8_diamond.png', 'DIAMOND', '8');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (37, 'cards/Diamond/card_9_diamond.png', 'DIAMOND', '9');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (38, 'cards/Diamond/card_10_diamond.png', 'DIAMOND', '10');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (39, 'cards/Diamond/card_11_diamond.png', 'DIAMOND', '11');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (40, 'cards/Diamond/card_12_diamond.png', 'DIAMOND', '12');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (41, 'cards/Diamond/card_13_diamond.png', 'DIAMOND', '13');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (42, 'cards/Diamond/card_14_diamond.png', 'DIAMOND', '14');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (43, 'cards/Clover/card_1_clover.png', 'CLOVER', '1');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (44, 'cards/Clover/card_2_clover.png', 'CLOVER', '2');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (45, 'cards/Clover/card_3_clover.png', 'CLOVER', '3');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (46, 'cards/Clover/card_4_clover.png', 'CLOVER', '4');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (47, 'cards/Clover/card_5_clover.png', 'CLOVER', '5');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (48, 'cards/Clover/card_6_clover.png', 'CLOVER', '6');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (49, 'cards/Clover/card_7_clover.png', 'CLOVER', '7');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (50, 'cards/Clover/card_8_clover.png', 'CLOVER', '8');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (51, 'cards/Clover/card_9_clover.png', 'CLOVER', '9');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (52, 'cards/Clover/card_10_clover.png', 'CLOVER', '10');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (53, 'cards/Clover/card_11_clover.png', 'CLOVER', '11');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (54, 'cards/Clover/card_12_clover.png', 'CLOVER', '12');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (55, 'cards/Clover/card_13_clover.png', 'CLOVER', '13');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (56, 'cards/Clover/card_14_clover.png', 'CLOVER', '14');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (57, 'cards/Atout/card_1_atout.png', 'ATOUT', '1');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (58, 'cards/Atout/card_2_atout.png', 'ATOUT', '2');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (59, 'cards/Atout/card_3_atout.png', 'ATOUT', '3');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (60, 'cards/Atout/card_4_atout.png', 'ATOUT', '4');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (61, 'cards/Atout/card_5_atout.png', 'ATOUT', '5');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (62, 'cards/Atout/card_6_atout.png', 'ATOUT', '6');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (63, 'cards/Atout/card_7_atout.png', 'ATOUT', '7');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (64, 'cards/Atout/card_8_atout.png', 'ATOUT', '8');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (65, 'cards/Atout/card_9_atout.png', 'ATOUT', '9');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (66, 'cards/Atout/card_10_atout.png', 'ATOUT', '10');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (67, 'cards/Atout/card_11_atout.png', 'ATOUT', '11');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (68, 'cards/Atout/card_12_atout.png', 'ATOUT', '12');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (69, 'cards/Atout/card_13_atout.png', 'ATOUT', '13');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (70, 'cards/Atout/card_14_atout.png', 'ATOUT', '14');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (71, 'cards/Atout/card_15_atout.png', 'ATOUT', '15');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (72, 'cards/Atout/card_16_atout.png', 'ATOUT', '16');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (73, 'cards/Atout/card_17_atout.png', 'ATOUT', '17');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (74, 'cards/Atout/card_18_atout.png', 'ATOUT', '18');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (75, 'cards/Atout/card_19_atout.png', 'ATOUT', '19');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (76, 'cards/Atout/card_20_atout.png', 'ATOUT', '20');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (77, 'cards/Atout/card_21_atout.png', 'BOUT', '21');
INSERT INTO carte (id,lien,couleur,valeur) VALUES (78, 'cards/Atout/card_E_atout.png', 'BOUT', 'E');

UPDATE carte SET points = 1.5 WHERE valeur = '11' AND couleur NOT IN ('ATOUT','BOUT');
UPDATE carte SET points = 2.5 WHERE valeur = '12' AND couleur NOT IN ('ATOUT','BOUT');
UPDATE carte SET points = 3.5 WHERE valeur = '13' AND couleur NOT IN ('ATOUT','BOUT');
UPDATE carte SET points = 4.5 WHERE valeur = '14' AND couleur NOT IN ('ATOUT','BOUT');
UPDATE carte SET points = 4.5 WHERE couleur = 'ATOUT' AND valeur IN ('1','21');
UPDATE carte SET points = 4.5 WHERE couleur = 'BOUT';
