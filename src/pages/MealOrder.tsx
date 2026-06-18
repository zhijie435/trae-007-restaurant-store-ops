import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  MinusOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  ShopOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api';
import { formatCurrency } from '@/utils/format';
import type {
  CreateOrderResponse,
  Dish,
  OrderDetail,
  OrderListItem,
} from '@/types';

const { Title, Text } = Typography;

interface CartRow {
  dish_id: number;
  quantity: number;
}

interface IngredientConsumption {
  id: number;
  name: string;
  category: string;
  unit: string;
  stock_qty: number;
  warning_threshold: number;
  quantity: number;
  after_stock: number;
}

export default function MealOrder() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [operator, setOperator] = useState('张三');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [result, setResult] = useState<CreateOrderResponse['order'] | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);
  const [soldOutIds, setSoldOutIds] = useState<Set<number>>(new Set());
  const [discountRate, setDiscountRate] = useState<number>(1);

  const submittingRef = useRef(false);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundDetail, setRefundDetail] = useState<OrderDetail | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundItemId, setRefundItemId] = useState<number | null>(null);
  const [refundQty, setRefundQty] = useState(1);
  const [refundReason, setRefundReason] = useState('');

  async function loadDishes() {
    let canceled = false;
    setLoading(true);
    setError(null);
    try {
      const data = await api.dishes(showInactive);
      if (!canceled) {
        setDishes(data);
        const inactive = new Set(data.filter((d) => !d.is_active).map((d) => d.id));
        setSoldOutIds(inactive);
      }
    } catch (e) {
      if (!canceled) setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (e as Error).message ?? '加载菜品失败');
    } finally {
      if (!canceled) setLoading(false);
    }
    return () => {
      canceled = true;
    };
  }

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const res = await api.orderList({ per_page: 10 });
      setOrders(res.items);
    } catch {
      // ignore
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    loadDishes();
    loadOrders();
  }, [showInactive]);

  async function handleToggle(dish: Dish) {
    if (togglingId !== null) return;

    setTogglingId(dish.id);
    try {
      const res = await api.toggleDish(dish.id);
      setDishes((prev) =>
        prev.map((d) => (d.id === dish.id ? { ...d, is_active: res.is_active } : d)),
      );
      if (!res.is_active) {
        setSoldOutIds((prev) => new Set(prev).add(dish.id));
        setCart((prev) => {
          const copy = { ...prev };
          delete copy[dish.id];
          return copy;
        });
        message.success('菜品已售罄');
      } else {
        setSoldOutIds((prev) => {
          const next = new Set(prev);
          next.delete(dish.id);
          return next;
        });
        message.success('菜品已上架');
      }
    } catch (e) {
      message.error('操作失败，请稍后重试');
    } finally {
      setTogglingId(null);
    }
  }

  const groupedDishes = useMemo(() => {
    const map = new Map<string, Dish[]>();
    dishes.forEach((d) => {
      const list = map.get(d.category) ?? [];
      list.push(d);
      map.set(d.category, list);
    });
    return Array.from(map.entries());
  }, [dishes]);

  const cartRows: CartRow[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => ({ dish_id: Number(id), quantity })),
    [cart],
  );

  const totalAmount = useMemo(() => {
    return cartRows.reduce((sum, row) => {
      const dish = dishes.find((d) => d.id === row.dish_id);
      return sum + (dish ? dish.price * row.quantity : 0);
    }, 0);
  }, [cartRows, dishes]);

  const actualAmount = useMemo(() => {
    return Math.round(totalAmount * discountRate * 100) / 100;
  }, [totalAmount, discountRate]);

  const discountTotal = useMemo(() => {
    return Math.round((totalAmount - actualAmount) * 100) / 100;
  }, [totalAmount, actualAmount]);

  const consumption: IngredientConsumption[] = useMemo(() => {
    const map = new Map<number, IngredientConsumption>();
    cartRows.forEach((row) => {
      const dish = dishes.find((d) => d.id === row.dish_id);
      if (!dish) return;
      dish.ingredients.forEach((recipe) => {
        const existing = map.get(recipe.id);
        const qty = recipe.quantity * row.quantity;
        if (existing) {
          existing.quantity += qty;
        } else {
          map.set(recipe.id, {
            id: recipe.id,
            name: recipe.name,
            category: recipe.category,
            unit: recipe.unit,
            stock_qty: recipe.stock_qty,
            warning_threshold: recipe.warning_threshold,
            quantity: qty,
            after_stock: recipe.stock_qty - qty,
          });
        }
      });
    });
    const list = Array.from(map.values());
    list.forEach((item) => {
      item.after_stock = Number((item.stock_qty - item.quantity).toFixed(4));
    });
    return list.sort((a, b) => {
      const aLow = a.after_stock <= a.warning_threshold ? 1 : 0;
      const bLow = b.after_stock <= b.warning_threshold ? 1 : 0;
      return bLow - aLow;
    });
  }, [cartRows, dishes]);

  const lowStock = consumption.some((c) => c.after_stock < 0);

  const refundableItems = useMemo(() => {
    if (!refundDetail) return [];
    return refundDetail.items.filter((it) => it.quantity - it.refunded_quantity > 0);
  }, [refundDetail]);

  const refundMaxQty = useMemo(() => {
    if (!refundDetail || refundItemId === null) return 1;
    const item = refundDetail.items.find((it) => it.id === refundItemId);
    return item ? item.quantity - item.refunded_quantity : 1;
  }, [refundDetail, refundItemId]);

  function changeQty(dishId: number, delta: number) {
    setCart((prev) => {
      const current = prev[dishId] ?? 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[dishId];
      else copy[dishId] = next;
      return copy;
    });
  }

  function setQty(dishId: number, value: number | null) {
    setCart((prev) => {
      const copy = { ...prev };
      if (!value || value <= 0) delete copy[dishId];
      else copy[dishId] = value;
      return copy;
    });
  }

  function handleSubmit() {
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
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      const idempotencyKey = `order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const res = await api.createOrder({
        operator: operator || undefined,
        items: cartRows,
        discount_rate: discountRate < 1 ? discountRate : undefined,
        idempotency_key: idempotencyKey,
      });
      setResult(res.order);
      setResultOpen(true);
      setCart({});
      setDiscountRate(1);
      message.success('下单成功,原料库存已扣减');
      await loadDishes();
      await loadOrders();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        '下单失败,请稍后重试';
      message.error(msg);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  async function openRefund(order: OrderListItem) {
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
  }

  async function doRefund() {
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
      await loadDishes();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        '退菜失败,请稍后重试';
      message.error(msg);
    } finally {
      setRefundLoading(false);
    }
  }

  const consumptionColumns: ColumnsType<IngredientConsumption> = [
    { title: '原料', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category', width: 90 },
    {
      title: '当前库存',
      key: 'stock',
      width: 110,
      align: 'right' as const,
      render: (_, r) => `${r.stock_qty} ${r.unit}`,
    },
    {
      title: '预计扣减',
      key: 'need',
      width: 110,
      align: 'right' as const,
      render: (_, r) => <Text type="warning">-{Number(r.quantity.toFixed(4))} {r.unit}</Text>,
    },
    {
      title: '扣减后库存',
      key: 'after',
      width: 130,
      align: 'right' as const,
      render: (_, r) => {
        if (r.after_stock < 0) return <Text type="danger">{r.after_stock} {r.unit}</Text>;
        if (r.after_stock <= r.warning_threshold)
          return <Tag color="orange">{r.after_stock} {r.unit}</Tag>;
        return <Text>{r.after_stock} {r.unit}</Text>;
      },
    },
  ];

  if (loading && dishes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error && dishes.length === 0) {
    return <Alert type="error" message="加载菜单失败" description={error} showIcon style={{ margin: 24 }} />;
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            点餐出餐 <ShopOutlined />
          </Title>
          <Text type="secondary">提交订单后将按菜品配方自动扣减原料库存,并写入出库记录</Text>
        </div>
        <Space>
          <Space size={6}>
            <Text type="secondary" style={{ fontSize: 13 }}>显示售罄菜品</Text>
            <Switch
              checked={showInactive}
              onChange={setShowInactive}
              size="small"
            />
          </Space>
          <span style={{ color: '#8c8c8c' }}>操作人</span>
          <Input
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            placeholder="请输入操作人"
            style={{ width: 160 }}
          />
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="菜单" variant="borderless" style={{ borderRadius: 12 }}>
            {groupedDishes.length === 0 ? (
              <Empty description="暂无菜品" />
            ) : (
              groupedDishes.map(([category, list]) => (
                <div key={category} style={{ marginBottom: 16 }}>
                  <Divider orientation="left" plain style={{ margin: '4px 0 12px' }}>
                    <Text strong>{category}</Text>
                  </Divider>
                  <Row gutter={[12, 12]}>
                    {list.map((dish) => {
                      const qty = cart[dish.id] ?? 0;
                      const noRecipe = dish.ingredients.length === 0;
                      const isInactive = !dish.is_active || soldOutIds.has(dish.id);
                      return (
                        <Col xs={24} sm={12} xl={8} key={dish.id}>
                          <Card
                            size="small"
                            hoverable={!isInactive}
                            style={{
                              borderRadius: 10,
                              border: 'none',
                              background: isInactive ? '#fff1f0' : '#fafafa',
                              height: '100%',
                              opacity: isInactive ? 0.75 : 1,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  {dish.name}
                                  {isInactive && <Tag color="red" icon={<PauseCircleOutlined />}>售罄</Tag>}
                                </div>
                                <Space size={6} wrap style={{ marginTop: 4 }}>
                                  <Text strong style={{ color: isInactive ? '#8c8c8c' : '#00857C' }}>
                                    {formatCurrency(dish.price)}
                                  </Text>
                                  {noRecipe && <Tag color="default">未配置配方</Tag>}
                                </Space>
                              </div>
                              <Space direction="vertical" size={4} style={{ alignItems: 'flex-end' }}>
                                <Tooltip title={isInactive ? '点击重新上架' : '点击标记售罄'}>
                                  <Button
                                    type="text"
                                    size="small"
                                    danger={!isInactive}
                                    onClick={() => handleToggle(dish)}
                                    loading={togglingId === dish.id}
                                    style={{ padding: '0 4px', height: 24 }}
                                  >
                                    {isInactive ? '上架' : '售罄'}
                                  </Button>
                                </Tooltip>
                                <Space.Compact size="small">
                                  <Button
                                    shape="circle"
                                    icon={<MinusOutlined />}
                                    disabled={qty === 0 || isInactive || submitting}
                                    onClick={() => changeQty(dish.id, -1)}
                                  />
                                  <InputNumber
                                    min={0}
                                    value={qty}
                                    controls={false}
                                    disabled={isInactive || submitting}
                                    onChange={(v) => setQty(dish.id, typeof v === 'number' ? v : null)}
                                    style={{ width: 48, textAlign: 'center' }}
                                  />
                                  <Button
                                    type="primary"
                                    shape="circle"
                                    icon={<PlusOutlined />}
                                    disabled={isInactive || submitting}
                                    onClick={() => changeQty(dish.id, 1)}
                                  />
                                </Space.Compact>
                              </Space>
                            </div>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                </div>
              ))
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <span>当前订单</span>
                <Tag color="blue">{cartRows.length} 种</Tag>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12, position: 'sticky', top: 88 }}
            extra={
              <Text strong style={{ color: '#00857C', fontSize: 18 }}>
                {formatCurrency(actualAmount)}
              </Text>
            }
          >
            {cartRows.length === 0 ? (
              <Empty description="购物车为空,请在左侧选择菜品" />
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {cartRows.map((row) => {
                  const dish = dishes.find((d) => d.id === row.dish_id);
                  return (
                    <div
                      key={row.dish_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        background: '#fafafa',
                        borderRadius: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500 }}>{dish?.name}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatCurrency(dish?.price ?? 0)} × {row.quantity}
                        </Text>
                      </div>
                      <Text strong>{formatCurrency((dish?.price ?? 0) * row.quantity)}</Text>
                    </div>
                  );
                })}
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">原价合计</Text>
                  <Text>{formatCurrency(totalAmount)}</Text>
                </div>
                {discountTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">优惠折扣</Text>
                    <Text type="danger">-{formatCurrency(discountTotal)}</Text>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">应收金额</Text>
                  <Text strong style={{ fontSize: 18, color: '#00857C' }}>
                    {formatCurrency(actualAmount)}
                  </Text>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="secondary" style={{ width: 70 }}>折扣</Text>
                  <Select
                    value={discountRate}
                    onChange={(v: number) => setDiscountRate(v)}
                    style={{ flex: 1 }}
                    disabled={submitting}
                    options={[
                      { value: 1, label: '不打折' },
                      { value: 0.95, label: '9.5折' },
                      { value: 0.9, label: '9折' },
                      { value: 0.85, label: '8.5折' },
                      { value: 0.8, label: '8折' },
                      { value: 0.75, label: '7.5折' },
                      { value: 0.7, label: '7折' },
                      { value: 0.6, label: '6折' },
                      { value: 0.5, label: '5折' },
                    ]}
                  />
                </div>

                <Button
                  type="primary"
                  size="large"
                  block
                  loading={submitting}
                  onClick={handleSubmit}
                  style={{ height: 44, fontWeight: 600, marginTop: 8 }}
                >
                  确认出餐并扣减库存
                </Button>
                {lowStock && (
                  <Alert type="warning" showIcon message="下单后将出现负库存,请谨慎操作" style={{ marginTop: 4 }} />
                )}
              </Space>
            )}
          </Card>

          {consumption.length > 0 && (
            <Card title="预计原料扣减" variant="borderless" style={{ borderRadius: 12, marginTop: 16 }}>
              <Table<IngredientConsumption>
                rowKey="id"
                size="small"
                columns={consumptionColumns}
                dataSource={consumption}
                pagination={false}
                scroll={{ y: 260 }}
              />
            </Card>
          )}
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <UnorderedListOutlined />
            <span>最近订单</span>
            <Tag color="blue">{orders.length}</Tag>
          </Space>
        }
        extra={
          <Button size="small" onClick={loadOrders} loading={ordersLoading}>
            刷新
          </Button>
        }
        variant="borderless"
        style={{ borderRadius: 12, marginTop: 16 }}
      >
        {orders.length === 0 ? (
          <Empty description="暂无订单" />
        ) : (
          <Table<OrderListItem>
            rowKey="id"
            size="small"
            dataSource={orders}
            pagination={false}
            scroll={{ x: 720 }}
            columns={[
              { title: '订单号', dataIndex: 'order_no', key: 'order_no', ellipsis: true },
              {
                title: '原价',
                dataIndex: 'total_amount',
                key: 'total_amount',
                width: 100,
                align: 'right' as const,
                render: (v: number) => formatCurrency(v),
              },
              {
                title: '优惠',
                dataIndex: 'discount_amount',
                key: 'discount_amount',
                width: 90,
                align: 'right' as const,
                render: (v: number) => (v > 0 ? <Text type="danger">-{formatCurrency(v)}</Text> : '-'),
              },
              {
                title: '实付',
                dataIndex: 'actual_amount',
                key: 'actual_amount',
                width: 100,
                align: 'right' as const,
                render: (v: number) => <Text strong style={{ color: '#00857C' }}>{formatCurrency(v)}</Text>,
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                width: 90,
                render: (v: string) =>
                  v === '已退' ? <Tag color="red">已退</Tag> : <Tag color="green">{v}</Tag>,
              },
              {
                title: '下单时间',
                dataIndex: 'created_at',
                key: 'created_at',
                width: 160,
              },
              {
                title: '操作',
                key: 'action',
                width: 90,
                render: (_, r) => (
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={r.status === '已退' || r.item_count === 0}
                    onClick={() => openRefund(r)}
                  >
                    退菜
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        title="下单成功"
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setResultOpen(false)}>
            完成
          </Button>,
        ]}
      >
        {result && (
          <>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">订单号 </Text>
                <Text strong copyable>{result.order_no}</Text>
              </div>
              <div>
                <Text type="secondary">原价 </Text>
                <Text>{formatCurrency(result.total_amount)}</Text>
              </div>
              {result.discount_amount > 0 && (
                <div>
                  <Text type="secondary">优惠 </Text>
                  <Text type="danger">-{formatCurrency(result.discount_amount)}</Text>
                </div>
              )}
              <div>
                <Text type="secondary">实付金额 </Text>
                <Text strong style={{ color: '#00857C', fontSize: 18 }}>
                  {formatCurrency(result.actual_amount)}
                </Text>
              </div>
              {result.member_name && (
                <div>
                  <Text type="secondary">会员 </Text>
                  <Text>{result.member_name}</Text>
                </div>
              )}
            </Space>
            <Divider />
            <Table
              rowKey="dish_name"
              size="small"
              pagination={false}
              dataSource={result.items}
              columns={[
                { title: '菜品', dataIndex: 'dish_name', key: 'dish_name' },
                { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
                {
                  title: '单价',
                  dataIndex: 'price',
                  key: 'price',
                  width: 110,
                  align: 'right' as const,
                  render: (v: number) => formatCurrency(v),
                },
                {
                  title: '小计',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  width: 110,
                  align: 'right' as const,
                  render: (v: number) => formatCurrency(v),
                },
              ]}
            />
          </>
        )}
      </Modal>

      <Modal
        title="退菜"
        open={refundOpen}
        onCancel={() => setRefundOpen(false)}
        confirmLoading={refundLoading}
        onOk={doRefund}
        okText="确认退菜"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={560}
      >
        {!refundDetail ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : (
          <>
            <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 12 }}>
              <div>
                <Text type="secondary">订单号 </Text>
                <Text strong copyable>{refundDetail.order_no}</Text>
              </div>
              <div>
                <Text type="secondary">原价 </Text>
                <Text>{formatCurrency(refundDetail.total_amount)}</Text>
                {refundDetail.discount_amount > 0 && (
                  <Text type="danger"> 优惠 -{formatCurrency(refundDetail.discount_amount)}</Text>
                )}
                <Text type="secondary"> 实付 </Text>
                <Text strong style={{ color: '#00857C' }}>{formatCurrency(refundDetail.actual_amount)}</Text>
              </div>
            </Space>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={refundDetail.items}
              scroll={{ y: 200 }}
              columns={[
                { title: '菜品', dataIndex: 'dish_name', key: 'dish_name' },
                { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 70 },
                {
                  title: '可退',
                  key: 'remaining',
                  width: 70,
                  render: (_, r) => r.quantity - r.refunded_quantity,
                },
                {
                  title: '已退',
                  dataIndex: 'refunded_quantity',
                  key: 'refunded_quantity',
                  width: 70,
                  render: (v: number) => (v > 0 ? <Text type="warning">{v}</Text> : '-'),
                },
              ]}
            />
            <Divider style={{ margin: '12px 0' }} />
            {refundableItems.length === 0 ? (
              <Alert type="info" message="该订单所有菜品均已退完,无法继续退菜" showIcon />
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="secondary" style={{ width: 70 }}>退菜项</Text>
                  <Select
                    value={refundItemId ?? undefined}
                    onChange={(v: number) => {
                      setRefundItemId(v);
                      setRefundQty(1);
                    }}
                    style={{ flex: 1 }}
                    options={refundableItems.map((it) => ({
                      value: it.id,
                      label: `${it.dish_name}（可退 ${it.quantity - it.refunded_quantity}）`,
                    }))}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="secondary" style={{ width: 70 }}>退菜数量</Text>
                  <InputNumber
                    min={1}
                    max={refundMaxQty}
                    value={refundQty}
                    onChange={(v) => setRefundQty(typeof v === 'number' ? v : 1)}
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="secondary" style={{ width: 70 }}>退菜原因</Text>
                  <Input
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="可选,填写退菜原因"
                    style={{ flex: 1 }}
                  />
                </div>
              </Space>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}