import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  Paginated,
  PaymentMethod,
  ReceiptLink,
  SaleDetail,
  SaleListRow,
  SalePaymentStatus,
  SalesSummary,
} from '../../types/api';

export interface SalesFilters {
  search: string;
  /** "UNPAID" means pending or partly paid */
  payment: '' | SalePaymentStatus | 'UNPAID';
  locationId: string;
  page: number;
}

export function useSales(filters: SalesFilters) {
  return useQuery({
    queryKey: ['sales', 'list', filters],
    queryFn: async () =>
      (
        await api.get<Paginated<SaleListRow>>('/sales', {
          params: {
            page: filters.page,
            pageSize: 15,
            ...(filters.search && { search: filters.search }),
            ...(filters.locationId && { locationId: filters.locationId }),
            ...(filters.payment === 'UNPAID' && { unpaid: true }),
            ...(filters.payment && filters.payment !== 'UNPAID' && { paymentStatus: filters.payment }),
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
}

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: ['sales', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<SaleDetail>(`/sales/${id}`)).data,
    meta: { silent: true },
  });
}

export function useSalesSummary() {
  return useQuery({
    queryKey: ['sales', 'summary'],
    queryFn: async () => (await api.get<SalesSummary>('/sales/summary')).data,
    meta: { silent: true },
  });
}

export interface CreateSaleInput {
  salespersonId: string;
  customerName: string | null;
  customerPhone: string | null;
  items: Array<{ productId: string; quantity: number }>;
  discount?: number;
  discountReason: string | null;
}

/** A sale also changes the stock, so both are refreshed. The form shows its own errors. */
export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async (input: CreateSaleInput) => (await api.post<SaleDetail>('/sales', input)).data,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]),
  });
}

export interface AddPaymentInput {
  saleId: string;
  amount: number;
  method: PaymentMethod;
  referenceNo: string | null;
  receipt: File | null;
}

export function useAddPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({ saleId, amount, method, referenceNo, receipt }: AddPaymentInput) => {
      // a multipart form, because a receipt file travels with the payment
      const form = new FormData();
      form.append('amount', String(amount));
      form.append('method', method);
      if (referenceNo) form.append('referenceNo', referenceNo);
      if (receipt) form.append('receipt', receipt);
      return (await api.post<SaleDetail>(`/sales/${saleId}/payments`, form, { timeout: 60_000 })).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales'] }),
  });
}

/** Asks the server for a link that works for 5 minutes. */
export async function fetchReceiptLink(paymentId: string): Promise<ReceiptLink> {
  return (await api.get<ReceiptLink>(`/payments/${paymentId}/receipt`)).data;
}
