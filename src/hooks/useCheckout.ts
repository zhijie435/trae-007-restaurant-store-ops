import { useState, useRef, useMemo, useCallback } from 'react';
import { Modal, message } from 'antd';
import { api } from '@/api';
import type {
  CartRow,
  OrderListItem,
  OrderDetail,
  CreateOrderResponse,
} from '@/types';

interface UseCheckoutParams {
  cartRows: CartRow[];
  lowStock: boolean;
  discountRate: number;
  discountAmount: number;
  operator: string;
  onSuccess: () => void;
  onRefresh: () => Promise<void>;
}

interface UseCheckoutReturn {
  submitting: boolean;
  result: CreateOrderResponse['order'] | null;
  resultOpen: boolean;
  setResultOpen: (open: boolean) => void;
  orders: OrderListItem[];
  ordersLoading: boolean;
  refundOpen: boolean;
  setRefundOpen: (open: boolean) => void;
  refundDetail: OrderDetail | null;
  refundLoading: boolean;
  refundItemId: number | null;
  setRefundItemId: (id: number | null) => void;
  refundQty: number;
  setRefundQty: (qty: number) => void;
  refundReason: string;
  setRefundReason: (reason: string) => void;
  refundableItems: OrderDetail['items'];
  refundMaxQty: number;
  loadOrders: () => Promise<void>;
  handleSubmit: () => void;
  openRefund: (order: OrderListItem) => Promise<void>;
  doRefund: () => Promise<void>;
}

function generateIdempotencyKey(): string {
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getErrorMessage(e: unknown, defaultMsg: string): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? defaultMsg
  );
}

function useCheckout({
  cartRows,
  lowStock,
  discountRate,
  discountAmount,
  operator,
  onSuccess,
  onRefresh,
}: UseCheckoutParams): UseCheckoutReturn {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [result, setResult] = useState<CreateOrderResponse['order'] | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundDetail, setRefundDetail] = useState<OrderDetail | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundItemId, setRefundItemId] = useState<number | null>(null);
  const [refundQty, setRefundQty] = useState(1);
  const [refundReason, setRefundReason] = useState('');

  const refundableItems = useMemo(() => {
    if (!refundDetail) return [];
    return refundDetail.items.filter((it) => it.quantity - it.refunded_quantity > 0);
  }, [refundDetail]);

  const refundMaxQty = useMemo(() => {
    if (!refundDetail || refundItemId === null) return 1;
    const item = refundDetail.items.find((it) => it.id === refundItemId);
    return item ? item.quantity - item.refunded_quantity : 1;
  }, [refundDetail, refundItemId]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await api.orderList({ per_page: 10 });
      setOrders(res.items);
    } catch {
      // ignore
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const doSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const idempotencyKey = generateIdempotencyKey();
      const res = await api.createOrder({
        operator: operator || undefined,
        items: cartRows,
        discount_rate: discountRate < 1 ? discountRate : undefined,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        idempotency_key: idempotencyKey,
      });
      setResult(res.order);
      setResultOpen(true);
      onSuccess();
      message.success('下单成功,原料库存已扣减');
      await onRefresh();
      await loadOrders();
    } catch (e: unknown) {
      const msg = getErrorMessage(e, '下单失败,请稍后重试');
      message.error(msg);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [cartRows, discountRate, discountAmount, operator, onSuccess, onRefresh, loadOrders]);

  const handleSubmit = useCallback(() => {
    if (submittingRef.current) return;
    if (cartRows.length === 0) {
      message.warning('请先选择菜品');
      return;
    }
    if (lowStock) {
      submittingRef.current = true;
      setSubmitting(true);
      Modal.confirm({
        title: '确认提交?',
        content: '下单后部分原料库存会变为负数,建议先补充库存。是否仍然继续提交?',
        okText: '继续提交',
        cancelText: '再检查一下',
        onOk: () => doSubmit(),
        onCancel: () => {
          submittingRef.current = false;
          setSubmitting(false);
        },
      });
      return;
    }
    submittingRef.current = true;
    doSubmit();
  }, [cartRows, lowStock, doSubmit]);

  const openRefund = useCallback(async (order: OrderListItem) => {
    setRefundOpen(true);
    setRefundDetail(null);
    setRefundItemId(null);
    setRefundQty(1);
    setRefundReason('');
    try {
      const detail = await api.orderDetail(order.id);
      setRefundDetail(detail);
      const first = detail.items.find((it) => it.quantity - it.refunded_quantity > 0);
      if (first) {
        setRefundItemId(first.id);
        setRefundQty(1);
      }
    } catch {
      message.error('加载订单详情失败');
      setRefundOpen(false);
    }
  }, []);

  const doRefund = useCallback(async () => {
    if (!refundDetail || refundItemId === null) {
      message.warning('请选择要退菜的菜品');
      return;
    }
    if (refundQty <= 0 || refundQty > refundMaxQty) {
      message.warning(`退菜数量必须在 1-${refundMaxQty} 之间`);
      return;
    }
    setRefundLoading(true);
    try {
      await api.returnDish(refundDetail.id, {
        order_item_id: refundItemId,
        quantity: refundQty,
        reason: refundReason || undefined,
        operator: operator || undefined,
      });
      message.success('退菜成功,原料已退回库存');
      setRefundOpen(false);
      await loadOrders();
      await onRefresh();
    } catch (e: unknown) {
      const msg = getErrorMessage(e, '退菜失败,请稍后重试');
      message.error(msg);
    } finally {
      setRefundLoading(false);
    }
  }, [refundDetail, refundItemId, refundQty, refundMaxQty, refundReason, operator, loadOrders, onRefresh]);

  return {
    submitting,
    result,
    resultOpen,
    setResultOpen,
    orders,
    ordersLoading,
    refundOpen,
    setRefundOpen,
    refundDetail,
    refundLoading,
    refundItemId,
    setRefundItemId,
    refundQty,
    setRefundQty,
    refundReason,
    setRefundReason,
    refundableItems,
    refundMaxQty,
    loadOrders,
    handleSubmit,
    openRefund,
    doRefund,
  };
}

export { useCheckout };
export type { UseCheckoutReturn };
