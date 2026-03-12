import { useBaseFetch } from '../composables/useBaseFetch'

export async function acceptTeamInvite(teamId: string): Promise<void> {
	await useBaseFetch(`team/${teamId}/join`, { apiVersion: 3, method: 'POST' })
}

export async function removeSelfFromTeam(teamId: string, userId: string): Promise<void> {
	await useBaseFetch(`team/${teamId}/members/${userId}`, { apiVersion: 3, method: 'DELETE' })
}
