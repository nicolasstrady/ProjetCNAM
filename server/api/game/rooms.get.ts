import { listLobbyRooms } from '~/server/utils/lobby'

export default defineEventHandler(async (event) => {
  const queryParams = getQuery(event)
  const userId = queryParams.userId ? Number(queryParams.userId) : undefined

  const result = await listLobbyRooms(userId)

  return {
    success: true as const,
    activeRoom: result.activeRoom,
    publicRooms: result.publicRooms
  }
})
