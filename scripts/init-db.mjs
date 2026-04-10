import mysql from 'mysql2/promise'

function readEnv(names, fallback) {
  for (const name of names) {
    const value = process.env[name]
    if (value !== undefined && value !== '') {
      return value
    }
  }

  return fallback
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildCards() {
  const cards = []
  let id = 1

  const suits = [
    { color: 'SPADE', folder: 'Spade', suffix: 'spade' },
    { color: 'HEART', folder: 'Heart', suffix: 'heart' },
    { color: 'DIAMOND', folder: 'Diamond', suffix: 'diamond' },
    { color: 'CLOVER', folder: 'Clover', suffix: 'clover' }
  ]

  for (const suit of suits) {
    for (let value = 1; value <= 14; value += 1) {
      let points = 0.5

      if (value === 11) points = 1.5
      if (value === 12) points = 2.5
      if (value === 13) points = 3.5
      if (value === 14) points = 4.5

      cards.push({
        id,
        lien: `cards/${suit.folder}/card_${value}_${suit.suffix}.png`,
        couleur: suit.color,
        valeur: String(value),
        points
      })

      id += 1
    }
  }

  for (let value = 1; value <= 20; value += 1) {
    cards.push({
      id,
      lien: `cards/Atout/card_${value}_atout.png`,
      couleur: 'ATOUT',
      valeur: String(value),
      points: value === 1 ? 4.5 : 0.5
    })

    id += 1
  }

  cards.push({
    id,
    lien: 'cards/Atout/card_21_atout.png',
    couleur: 'BOUT',
    valeur: '21',
    points: 4.5
  })
  id += 1

  cards.push({
    id,
    lien: 'cards/Atout/card_E_atout.png',
    couleur: 'BOUT',
    valeur: 'E',
    points: 4.5
  })

  return cards
}

async function waitForServerConnection(config, maxAttempts, retryMs) {
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await mysql.createConnection(config)
    } catch (error) {
      lastError = error
      console.log(`Database connection attempt ${attempt}/${maxAttempts} failed, retrying in ${retryMs}ms...`)
      await sleep(retryMs)
    }
  }

  throw lastError
}

async function ensureDatabase(connection, databaseName) {
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
  } catch (error) {
    console.log(`Skipping CREATE DATABASE for ${databaseName}: ${error instanceof Error ? error.message : error}`)
  }
}

async function createTables(connection) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS utilisateur (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(50),
      prenom VARCHAR(50),
      email VARCHAR(100),
      pseudo VARCHAR(50),
      motdepasse VARCHAR(255)
    )`,
    `CREATE TABLE IF NOT EXISTS partie (
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
    )`,
    `CREATE TABLE IF NOT EXISTS joueur (
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
    )`,
    `CREATE TABLE IF NOT EXISTS carte (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lien VARCHAR(100),
      couleur VARCHAR(20),
      valeur VARCHAR(10),
      points DOUBLE DEFAULT 0.5
    )`,
    `CREATE TABLE IF NOT EXISTS chien (
      id INT AUTO_INCREMENT PRIMARY KEY,
      partie INT,
      carte1 INT,
      carte2 INT,
      carte3 INT
    )`,
    `CREATE TABLE IF NOT EXISTS plis (
      id INT AUTO_INCREMENT PRIMARY KEY,
      partie INT,
      pliChien TINYINT(1),
      carte1 INT NULL,
      carte2 INT NULL,
      carte3 INT NULL,
      carte4 INT NULL,
      carte5 INT NULL,
      joueurGagnant INT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS main (
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
    )`
  ]

  for (const statement of statements) {
    await connection.query(statement)
  }
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) as count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  )

  return rows[0].count > 0
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  if (await columnExists(connection, tableName, columnName)) {
    return
  }

  await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}

async function ensureLobbyColumns(connection) {
  await addColumnIfMissing(connection, 'partie', 'code', 'VARCHAR(12) NULL')
  await addColumnIfMissing(connection, 'partie', 'visibility', "VARCHAR(20) NOT NULL DEFAULT 'PRIVATE'")
  await addColumnIfMissing(connection, 'partie', 'status', "VARCHAR(20) NOT NULL DEFAULT 'WAITING'")
  await addColumnIfMissing(connection, 'partie', 'ownerUserId', 'INT NULL')
  await addColumnIfMissing(connection, 'partie', 'allowQuickJoin', 'TINYINT(1) NOT NULL DEFAULT 0')
  await addColumnIfMissing(connection, 'partie', 'fillWithBots', 'TINYINT(1) NOT NULL DEFAULT 0')
  await addColumnIfMissing(connection, 'partie', 'mode', "VARCHAR(20) NOT NULL DEFAULT 'CLASSIC'")
  await addColumnIfMissing(connection, 'partie', 'createdAt', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP')
  await addColumnIfMissing(connection, 'partie', 'startedAt', 'DATETIME NULL')
  await addColumnIfMissing(connection, 'joueur', 'playerType', "VARCHAR(10) NOT NULL DEFAULT 'HUMAN'")
  await addColumnIfMissing(connection, 'joueur', 'botLevel', 'VARCHAR(20) NULL')
}

async function seedUsers(connection, users) {
  for (const user of users) {
    await connection.query(
      `INSERT INTO utilisateur (nom, prenom, email, pseudo, motdepasse)
       SELECT ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM utilisateur WHERE email = ?
       )`,
      [user.nom, user.prenom, user.email, user.pseudo, user.motdepasse, user.email]
    )
  }
}

async function seedCards(connection, cards) {
  for (const card of cards) {
    await connection.query(
      `INSERT INTO carte (id, lien, couleur, valeur, points)
       SELECT ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM carte WHERE id = ?
       )`,
      [card.id, card.lien, card.couleur, card.valeur, card.points, card.id]
    )
  }
}

async function main() {
  const databaseName = readEnv(['DB_NAME', 'MYSQLDATABASE'], 'tarot_project')
  const baseConfig = {
    host: readEnv(['DB_HOST', 'MYSQLHOST'], 'localhost'),
    port: Number(readEnv(['DB_PORT', 'MYSQLPORT'], '3307')),
    user: readEnv(['DB_USER', 'MYSQLUSER'], 'root'),
    password: readEnv(['DB_PASSWORD', 'MYSQLPASSWORD'], 'root')
  }

  const maxAttempts = Number(process.env.DB_INIT_MAX_ATTEMPTS || 30)
  const retryMs = Number(process.env.DB_INIT_RETRY_MS || 2000)
  const seedTestData = (process.env.DB_SEED_TEST_DATA || 'true').toLowerCase() !== 'false'

  const serverConnection = await waitForServerConnection(baseConfig, maxAttempts, retryMs)

  try {
    await ensureDatabase(serverConnection, databaseName)
  } finally {
    await serverConnection.end()
  }

  const dbConnection = await waitForServerConnection(
    {
      ...baseConfig,
      database: databaseName
    },
    maxAttempts,
    retryMs
  )

  try {
    await createTables(dbConnection)
    await ensureLobbyColumns(dbConnection)

    const cards = buildCards()
    await seedCards(dbConnection, cards)

    if (seedTestData) {
      await seedUsers(dbConnection, [
        { nom: 'Strady', prenom: 'Nicolas', email: 'nicostrady@gmail.com', pseudo: 'nistra', motdepasse: 'pass' },
        { nom: 'Sonmez', prenom: 'Duygu', email: 'dodo@gmail.com', pseudo: 'dodo', motdepasse: 'pass' },
        { nom: 'Wittmann', prenom: 'Hugo', email: 'hugo@gmail.com', pseudo: 'hugo', motdepasse: 'pass' },
        { nom: 'Pottier', prenom: 'Domitille', email: 'dom@gmail.com', pseudo: 'dom', motdepasse: 'pass' },
        { nom: 'Massicot', prenom: 'Hippolyte', email: 'ipo@gmail.com', pseudo: 'ipo', motdepasse: 'pass' }
      ])
    }

    const [userRows] = await dbConnection.query('SELECT COUNT(*) as count FROM utilisateur')
    const [cardRows] = await dbConnection.query('SELECT COUNT(*) as count FROM carte')

    console.log(
      `Database ready: ${cardRows[0].count} cards, ${userRows[0].count} users in ${databaseName}.`
    )
  } finally {
    await dbConnection.end()
  }
}

main().catch((error) => {
  console.error('Database initialization failed:', error)
  process.exit(1)
})
