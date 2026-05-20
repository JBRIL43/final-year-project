import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

export interface DebtMetrics {
  totalCollections: number
  outstandingDebt: number
}

async function fetchDebtOverview(): Promise<DebtMetrics> {
  const res = await api.get<{ success: true; data: DebtMetrics }>('/api/admin/analytics/debt-overview')
  return res.data.data
}

export function useDebtOverview() {
  return useQuery({
    queryKey: ['analytics', 'debt-overview'],
    queryFn: fetchDebtOverview,
  })
}
