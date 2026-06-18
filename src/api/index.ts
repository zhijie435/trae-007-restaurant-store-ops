import axios from 'axios';
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  DashboardData,
  DailyReport,
  Dish,
  InventoryReport,
  MealReport,
  MemberReport,
} from '@/types';

const client = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    console.error('API Error:', err?.response?.status, err?.message);
    return Promise.reject(err);
  },
);

export const api = {
  dashboard: (date?: string) =>
    client.get<unknown, DashboardData>('/dashboard', { params: { date } }),
  dailyReport: (date?: string) =>
    client.get<unknown, DailyReport>('/reports/daily', { params: { date } }),
  inventoryReport: (date?: string) =>
    client.get<unknown, InventoryReport>('/reports/inventory', { params: { date } }),
  memberReport: (date?: string) =>
    client.get<unknown, MemberReport>('/reports/member', { params: { date } }),
  mealReport: (date?: string) =>
    client.get<unknown, MealReport>('/reports/meal', { params: { date } }),
  dishes: (withInactive?: boolean) =>
    client.get<unknown, Dish[]>('/dishes', { params: { with_inactive: withInactive } }),
  toggleDish: (id: number) =>
    client.patch<unknown, { id: number; is_active: boolean }>(`/dishes/${id}/toggle`),
  createOrder: (payload: CreateOrderRequest) =>
    client.post<unknown, CreateOrderResponse>('/orders', payload),
};

