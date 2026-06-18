import axios from 'axios';
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  DashboardData,
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
  inventoryReport: (date?: string) =>
    client.get<unknown, InventoryReport>('/reports/inventory', { params: { date } }),
  memberReport: (date?: string) =>
    client.get<unknown, MemberReport>('/reports/member', { params: { date } }),
  mealReport: (date?: string) =>
    client.get<unknown, MealReport>('/reports/meal', { params: { date } }),
  dishes: () => client.get<unknown, Dish[]>('/dishes'),
  createOrder: (payload: CreateOrderRequest) =>
    client.post<unknown, CreateOrderResponse>('/orders', payload),
};
