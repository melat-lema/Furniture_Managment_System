import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../../lib/api';
import { ApiError } from '../../lib/errors';
import type { SalesReport } from '../../types/api';

export interface ReportFilters {
  from: string;
  to: string;
  locationId: string;
  salespersonId: string;
}

function paramsOf(filters: ReportFilters) {
  return {
    from: filters.from,
    to: filters.to,
    ...(filters.locationId && { locationId: filters.locationId }),
    ...(filters.salespersonId && { salespersonId: filters.salespersonId }),
  };
}

export function useSalesReport(filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'sales', filters],
    enabled,
    queryFn: async () => (await api.get<SalesReport>('/reports/sales', { params: paramsOf(filters) })).data,
    meta: { silent: true },
  });
}

/** Downloads a CSV file. The server sends the file; the browser saves it. */
export async function downloadReport(kind: 'sales' | 'payments', filters: ReportFilters): Promise<void> {
  try {
    const response = await api.get<Blob>(`/reports/${kind}/export`, { params: paramsOf(filters), responseType: 'blob', timeout: 60_000 });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${kind}_${filters.from}_to_${filters.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    // When a download fails the error body arrives as a file too: read it so the message is clear.
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      let body: { code?: string; message?: string; requestId?: string } = {};
      try {
        body = JSON.parse(await error.response.data.text()) as typeof body;
      } catch {
        body = {};
      }
      throw new ApiError({
        status: error.response.status,
        code: body.code ?? `HTTP_${error.response.status}`,
        message: body.message ?? 'The file could not be created. Please try again.',
        requestId: body.requestId,
      });
    }
    throw error;
  }
}
