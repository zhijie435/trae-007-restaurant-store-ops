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
