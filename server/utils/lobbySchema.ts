import { query, queryOne } from '~/server/utils/db'

let schemaReadyPromise: Promise<void> | null = null

async function columnExists(tableName: string, columnName: string) {
  const result = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  )

  return (result?.count ?? 0) > 0
}

async function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
  if (await columnExists(tableName, columnName)) {
    return
  }

  await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}

export async function ensureLobbySchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await addColumnIfMissing('partie', 'code', 'VARCHAR(12) NULL')
      await addColumnIfMissing('partie', 'visibility', "VARCHAR(20) NOT NULL DEFAULT 'PRIVATE'")
      await addColumnIfMissing('partie', 'status', "VARCHAR(20) NOT NULL DEFAULT 'WAITING'")
      await addColumnIfMissing('partie', 'ownerUserId', 'INT NULL')
      await addColumnIfMissing('partie', 'allowQuickJoin', 'TINYINT(1) NOT NULL DEFAULT 0')
      await addColumnIfMissing('partie', 'fillWithBots', 'TINYINT(1) NOT NULL DEFAULT 0')
      await addColumnIfMissing('partie', 'mode', "VARCHAR(20) NOT NULL DEFAULT 'CLASSIC'")
      await addColumnIfMissing('partie', 'createdAt', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP')
      await addColumnIfMissing('partie', 'startedAt', 'DATETIME NULL')
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }

  await schemaReadyPromise
}
