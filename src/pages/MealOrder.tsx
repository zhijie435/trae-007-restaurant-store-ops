import { useEffect, useMemo, useState } from 'react';
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
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { MinusOutlined, PlusOutlined, ShopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api';
import { formatCurrency } from '@/utils/format';
import type { CreateOrderResponse, Dish } from '@/types';

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
  const [operator, setOperator] = useState('张三');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [result, setResult] = useState<CreateOrderResponse['order'] | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(null);
    api
      .dishes()
      .then((data) => {
        if (!canceled) setDishes(data);
      })
      .catch((e) => {
        if (!canceled) setError(e?.response?.data?.message ?? e.message ?? '加载菜品失败');
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, []);

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

  async function handleSubmit() {
    if (cartRows.length === 0) {
      message.warning('请先选择菜品');
      return;
    }
    if (lowStock) {
      Modal.confirm({
        title: '确认提交?',
        content: '下单后部分原料库存会变为负数,建议先补充库存。是否仍然继续提交?',
        okText: '继续提交',
        cancelText: '再检查一下',
        onOk: doSubmit,
      });
      return;
    }
    await doSubmit();
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      const res = await api.createOrder({
        operator: operator || undefined,
        items: cartRows,
      });
      setResult(res.order);
      setResultOpen(true);
      setCart({});
      message.success('下单成功,原料库存已扣减');
      // 刷新菜品库存
      const fresh = await api.dishes();
      setDishes(fresh);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        '下单失败,请稍后重试';
      message.error(msg);
    } finally {
      setSubmitting(false);
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
          <Card title="菜单" bordered={false} style={{ borderRadius: 12 }}>
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
                      return (
                        <Col xs={24} sm={12} xl={8} key={dish.id}>
                          <Card
                            size="small"
                            hoverable
                            style={{ borderRadius: 10, border: 'none', background: '#fafafa', height: '100%' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{dish.name}</div>
                                <Space size={6} wrap style={{ marginTop: 4 }}>
                                  <Text strong style={{ color: '#00857C' }}>
                                    {formatCurrency(dish.price)}
                                  </Text>
                                  {noRecipe && <Tag color="default">未配置配方</Tag>}
                                </Space>
                              </div>
                              <Space.Compact size="small">
                                <Button
                                  shape="circle"
                                  icon={<MinusOutlined />}
                                  disabled={qty === 0}
                                  onClick={() => changeQty(dish.id, -1)}
                                />
                                <InputNumber
                                  min={0}
                                  value={qty}
                                  controls={false}
                                  onChange={(v) => setQty(dish.id, typeof v === 'number' ? v : null)}
                                  style={{ width: 48, textAlign: 'center' }}
                                />
                                <Button
                                  type="primary"
                                  shape="circle"
                                  icon={<PlusOutlined />}
                                  onClick={() => changeQty(dish.id, 1)}
                                />
                              </Space.Compact>
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
            bordered={false}
            style={{ borderRadius: 12, position: 'sticky', top: 88 }}
            extra={
              <Text strong style={{ color: '#00857C', fontSize: 18 }}>
                {formatCurrency(totalAmount)}
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
                  <Text type="secondary">应收金额</Text>
                  <Text strong style={{ fontSize: 18, color: '#00857C' }}>
                    {formatCurrency(totalAmount)}
                  </Text>
                </div>
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={submitting}
                  onClick={handleSubmit}
                  style={{ height: 44, fontWeight: 600 }}
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
            <Card title="预计原料扣减" bordered={false} style={{ borderRadius: 12, marginTop: 16 }}>
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
                <Text type="secondary">订单金额 </Text>
                <Text strong style={{ color: '#00857C', fontSize: 18 }}>
                  {formatCurrency(result.total_amount)}
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
    </div>
  );
}
