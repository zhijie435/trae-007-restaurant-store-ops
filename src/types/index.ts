export interface DashboardMetrics {
  revenue: number;
  order_count: number;
  new_members: number;
  warning_count: number;
}

export interface TrendItem {
  date: string;
  revenue: number;
  order_count: number;
}

export interface DashboardData {
  date: string;
  metrics: DashboardMetrics;
  trend: TrendItem[];
}

export interface InventorySummary {
  inbound: number;
  outbound: number;
  net: number;
  warning_count: number;
  total_skus: number;
}

export interface WarningItem {
  id: number;
  name: string;
  category: string;
  stock: number;
  threshold: number;
  unit: string;
  shortage: number;
}

export interface InventoryRecordItem {
  id: number;
  ingredient: string;
  type: string;
  quantity: number;
  reason: string;
  operator: string;
  time: string;
}

export interface InventoryReport {
  date: string;
  summary: InventorySummary;
  warning_list: WarningItem[];
  records: InventoryRecordItem[];
}

export interface MemberSummary {
  new_members: number;
  active_members: number;
  consumption: number;
  recharge: number;
  points_change: number;
  total_members: number;
}

export interface MemberTransactionItem {
  id: number;
  member: string;
  phone: string;
  type: string;
  amount: number;
  points_change: number;
  time: string;
}

export interface MemberReport {
  date: string;
  summary: MemberSummary;
  level_distribution: Record<string, number>;
  transactions: MemberTransactionItem[];
}

export interface MealSummary {
  order_count: number;
  revenue: number;
  avg_order_value: number;
  member_orders: number;
  guest_orders: number;
}

export interface TopDish {
  name: string;
  total_qty: number;
  total_amount: number;
}

export interface HourlyItem {
  hour: string;
  count: number;
  revenue: number;
}

export interface MealReport {
  date: string;
  summary: MealSummary;
  top_dishes: TopDish[];
  hourly: HourlyItem[];
}

export interface DailyReportMeal {
  order_count: number;
  revenue: number;
  avg_order_value: number;
  member_orders: number;
  guest_orders: number;
  top_dishes: TopDish[];
  hourly: HourlyItem[];
}

export interface DailyReportMember {
  new_members: number;
  active_members: number;
  consumption: number;
  recharge: number;
  points_change: number;
  total_members: number;
}

export interface DailyReportInventory {
  inbound: number;
  outbound: number;
  net: number;
  warning_count: number;
  total_skus: number;
}

export interface DailyReport {
  date: string;
  meal: DailyReportMeal;
  member: DailyReportMember;
  inventory: DailyReportInventory;
}

export interface DishIngredientRecipe {
  id: number;
  name: string;
  category: string;
  unit: string;
  stock_qty: number;
  warning_threshold: number;
  quantity: number;
}

export interface Dish {
  id: number;
  name: string;
  category: string;
  price: number;
  cost: number;
  is_active: boolean;
  ingredients: DishIngredientRecipe[];
}

export interface CreateOrderRequestItem {
  dish_id: number;
  quantity: number;
}

export interface CreateOrderRequest {
  store_id?: number;
  member_id?: number | null;
  operator?: string;
  items: CreateOrderRequestItem[];
  discount_rate?: number;
  discount_amount?: number;
  idempotency_key?: string;
}

export interface CreateOrderResponse {
  message: string;
  order: {
    id: number;
    order_no: string;
    total_amount: number;
    discount_rate: number;
    discount_amount: number;
    actual_amount: number;
    status: string;
    member_name: string | null;
    items: {
      dish_name: string;
      quantity: number;
      price: number;
      subtotal: number;
    }[];
  };
}

export interface OrderListItem {
  id: number;
  order_no: string;
  total_amount: number;
  discount_rate: number;
  discount_amount: number;
  actual_amount: number;
  status: string;
  member_name: string | null;
  item_count: number;
  created_at: string;
}

export interface OrderDetailItem {
  id: number;
  dish_id: number;
  dish_name: string;
  quantity: number;
  price: number;
  subtotal: number;
  refunded_quantity: number;
  refunded_amount: number;
}

export interface OrderReturnItem {
  id: number;
  dish_name: string;
  quantity: number;
  amount: number;
  reason: string | null;
  operator: string | null;
  created_at: string;
}

export interface OrderDetail {
  id: number;
  order_no: string;
  total_amount: number;
  discount_rate: number;
  discount_amount: number;
  actual_amount: number;
  status: string;
  member_name: string | null;
  created_at: string;
  items: OrderDetailItem[];
  returns: OrderReturnItem[];
}

export interface OrderListResponse {
  total: number;
  page: number;
  per_page: number;
  items: OrderListItem[];
}

export interface ReturnDishRequest {
  order_item_id: number;
  quantity: number;
  reason?: string;
  operator?: string;
}

export interface ReturnDishResponse {
  message: string;
  order: {
    id: number;
    order_no: string;
    total_amount: number;
    discount_rate: number;
    discount_amount: number;
    actual_amount: number;
    status: string;
    items: {
      id: number;
      dish_name: string;
      quantity: number;
      price: number;
      subtotal: number;
      refunded_quantity: number;
      refunded_amount: number;
    }[];
  };
}

