import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useCashier, DISCOUNT_OPTIONS } from '@/hooks/useCashier';
import { useCart } from '@/hooks/useCart';
import { useCheckout } from '@/hooks/useCheckout';
import type {
  Dish,
  OrderListItem,
  IngredientConsumption,
} from '@/types';

const { Title, Text } = Typography;

export default function MealOrder() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [operator, setOperator] = useState('张三');
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);
  const [soldOutIds, setSoldOutIds] = useState<Set<number>>(new Set());

  const cart = useCart({ dishes });
  const cashier = useCashier({ cartRows: cart.cartRows, dishes });
  const checkout = useCheckout({
    cartRows: cart.cartRows,
    lowStock: cart.lowStock,
    discountRate: cashier.discountRate,
    discountAmount: cashier.discountAmount,
    operator,
    onSuccess: () => {
      cart.clearCart();
      cashier.resetDiscount();
    },
    onRefresh: async () => {
      await loadDishes();
    },
  });
  const { loadOrders } = checkout;

  const loadDishes = useCallback(async () => {
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
  }, [showInactive]);

  useEffect(() => {
    loadDishes();
    loadOrders();
  }, [loadDishes, loadOrders]);

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
        cart.removeDish(dish.id);
        message.success('菜品已售罄');
      } else {
        setSoldOutIds((prev) => {
          const next = new Set(prev);
          next.delete(dish.id);
          return next;
        });
        message.success('菜品已上架');
      }
    } catch {
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
                      const qty = cart.getQty(dish.id);
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
                                    disabled={qty === 0 || isInactive || checkout.submitting}
                                    onClick={() => cart.changeQty(dish.id, -1)}
                                  />
                                  <InputNumber
                                    min={0}
                                    value={qty}
                                    controls={false}
                                    disabled={isInactive || checkout.submitting}
                                    onChange={(v) => cart.setQty(dish.id, typeof v === 'number' ? v : null)}
                                    style={{ width: 48, textAlign: 'center' }}
                                  />
                                  <Button
                                    type="primary"
                                    shape="circle"
                                    icon={<PlusOutlined />}
                                    disabled={isInactive || checkout.submitting}
                                    onClick={() => cart.changeQty(dish.id, 1)}
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
                <Tag color="blue">{cart.cartRows.length} 种</Tag>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12, position: 'sticky', top: 88 }}
            extra={
              <Text strong style={{ color: '#00857C', fontSize: 18 }}>
                {formatCurrency(cashier.actualAmount)}
              </Text>
            }
          >
            {cart.cartRows.length === 0 ? (
              <Empty description="购物车为空,请在左侧选择菜品" />
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {cart.cartRows.map((row) => {
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
                  <Text>{formatCurrency(cashier.totalAmount)}</Text>
                </div>
                {cashier.discountTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">优惠折扣</Text>
                    <Text type="danger">-{formatCurrency(cashier.discountTotal)}</Text>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">应收金额</Text>
                  <Text strong style={{ fontSize: 18, color: '#00857C' }}>
                    {formatCurrency(cashier.actualAmount)}
                  </Text>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="secondary" style={{ width: 70 }}>折扣</Text>
                  <Select
                    value={cashier.discountRate}
                    onChange={(v: number) => cashier.setDiscountRate(v)}
                    style={{ flex: 1 }}
                    disabled={checkout.submitting}
                    options={DISCOUNT_OPTIONS}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <Text type="secondary" style={{ width: 70 }}>减免金额</Text>
                  <InputNumber
                    min={0}
                    step={1}
                    value={cashier.discountAmount}
                    onChange={(v) => cashier.setDiscountAmount(typeof v === 'number' ? v : 0)}
                    style={{ flex: 1 }}
                    disabled={checkout.submitting}
                    prefix="¥"
                  />
                </div>

                <Button
                  type="primary"
                  size="large"
                  block
                  loading={checkout.submitting}
                  onClick={checkout.handleSubmit}
                  style={{ height: 44, fontWeight: 600, marginTop: 8 }}
                >
                  确认出餐并扣减库存
                </Button>
                {cart.lowStock && (
                  <Alert type="warning" showIcon message="下单后将出现负库存,请谨慎操作" style={{ marginTop: 4 }} />
                )}
              </Space>
            )}
          </Card>

          {cart.consumption.length > 0 && (
            <Card title="预计原料扣减" variant="borderless" style={{ borderRadius: 12, marginTop: 16 }}>
              <Table<IngredientConsumption>
                rowKey="id"
                size="small"
                columns={consumptionColumns}
                dataSource={cart.consumption}
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
            <Tag color="blue">{checkout.orders.length}</Tag>
          </Space>
        }
        extra={
          <Button size="small" onClick={checkout.loadOrders} loading={checkout.ordersLoading}>
            刷新
          </Button>
        }
        variant="borderless"
        style={{ borderRadius: 12, marginTop: 16 }}
      >
        {checkout.orders.length === 0 ? (
          <Empty description="暂无订单" />
        ) : (
          <Table<OrderListItem>
            rowKey="id"
            size="small"
            dataSource={checkout.orders}
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
                    onClick={() => checkout.openRefund(r)}
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
        open={checkout.resultOpen}
        onCancel={() => checkout.setResultOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => checkout.setResultOpen(false)}>
            完成
          </Button>,
        ]}
      >
        {checkout.result && (
          <>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">订单号 </Text>
                <Text strong copyable>{checkout.result.order_no}</Text>
              </div>
              <div>
                <Text type="secondary">原价 </Text>
                <Text>{formatCurrency(checkout.result.total_amount)}</Text>
              </div>
              {checkout.result.discount_amount > 0 && (
                <div>
                  <Text type="secondary">优惠 </Text>
                  <Text type="danger">-{formatCurrency(checkout.result.discount_amount)}</Text>
                </div>
              )}
              <div>
                <Text type="secondary">实付金额 </Text>
                <Text strong style={{ color: '#00857C', fontSize: 18 }}>
                  {formatCurrency(checkout.result.actual_amount)}
                </Text>
              </div>
              {checkout.result.member_name && (
                <div>
                  <Text type="secondary">会员 </Text>
                  <Text>{checkout.result.member_name}</Text>
                </div>
              )}
            </Space>
            <Divider />
            <Table
              rowKey="dish_name"
              size="small"
              pagination={false}
              dataSource={checkout.result.items}
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
        open={checkout.refundOpen}
        onCancel={() => checkout.setRefundOpen(false)}
        confirmLoading={checkout.refundLoading}
        onOk={checkout.doRefund}
        okText="确认退菜"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={560}
      >
        {!checkout.refundDetail ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : (
          <>
            <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 12 }}>
              <div>
                <Text type="secondary">订单号 </Text>
                <Text strong copyable>{checkout.refundDetail.order_no}</Text>
              </div>
              <div>
                <Text type="secondary">原价 </Text>
                <Text>{formatCurrency(checkout.refundDetail.total_amount)}</Text>
                {checkout.refundDetail.discount_amount > 0 && (
                  <Text type="danger"> 优惠 -{formatCurrency(checkout.refundDetail.discount_amount)}</Text>
                )}
                {checkout.refundDetail.items.some((it) => it.refunded_amount > 0) && (
                  <Text type="warning"> 已退 -{formatCurrency(checkout.refundDetail.items.reduce((s, it) => s + it.refunded_amount, 0))}</Text>
                )}
                <Text type="secondary"> 实付 </Text>
                <Text strong style={{ color: '#00857C' }}>{formatCurrency(checkout.refundDetail.actual_amount)}</Text>
              </div>
            </Space>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={checkout.refundDetail.items}
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
            {checkout.refundableItems.length === 0 ? (
              <Alert type="info" message="该订单所有菜品均已退完,无法继续退菜" showIcon />
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="secondary" style={{ width: 70 }}>退菜项</Text>
                  <Select
                    value={checkout.refundItemId ?? undefined}
                    onChange={(v: number) => {
                      checkout.setRefundItemId(v);
                      checkout.setRefundQty(1);
                    }}
                    style={{ flex: 1 }}
                    options={checkout.refundableItems.map((it) => ({
                      value: it.id,
                      label: `${it.dish_name}（可退 ${it.quantity - it.refunded_quantity}）`,
                    }))}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="secondary" style={{ width: 70 }}>退菜数量</Text>
                  <InputNumber
                    min={1}
                    max={checkout.refundMaxQty}
                    value={checkout.refundQty}
                    onChange={(v) => checkout.setRefundQty(typeof v === 'number' ? v : 1)}
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="secondary" style={{ width: 70 }}>退菜原因</Text>
                  <Input
                    value={checkout.refundReason}
                    onChange={(e) => checkout.setRefundReason(e.target.value)}
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
