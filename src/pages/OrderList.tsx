import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Divider,
  Empty,
  Input,
  InputNumber,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  HistoryOutlined,
  RollbackOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '@/api';
import { formatCurrency } from '@/utils/format';
import type {
  OrderDetail,
  OrderDetailItem,
  OrderListItem,
} from '@/types';

const { Title, Text } = Typography;

interface ReturnForm {
  order_item_id: number;
  quantity: number;
  reason: string;
}

export default function OrderList() {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [operator, setOperator] = useState('张三');

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderDetail | null>(null);

  const [returnVisible, setReturnVisible] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnItem, setReturnItem] = useState<OrderDetailItem | null>(null);
  const [returnForm, setReturnForm] = useState<ReturnForm>({
    order_item_id: 0,
    quantity: 1,
    reason: '',
  });

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await api.orderList({
        date: date?.format('YYYY-MM-DD'),
        page,
        per_page: pageSize,
      });
      setOrders(res.items);
      setTotal(res.total);
    } catch (e) {
      message.error('加载订单列表失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [date, page, pageSize]);

  async function loadDetail(id: number) {
    setDetailLoading(true);
    try {
      const res = await api.orderDetail(id);
      setCurrentOrder(res);
      setDetailVisible(true);
    } catch (e) {
      message.error('加载订单详情失败');
    } finally {
      setDetailLoading(false);
    }
  }

  function handleReturn(item: OrderDetailItem) {
    const remaining = item.quantity - item.refunded_quantity;
    setReturnItem(item);
    setReturnForm({
      order_item_id: item.id,
      quantity: Math.min(1, remaining),
      reason: '',
    });
    setReturnVisible(true);
  }

  async function doReturn() {
    if (!currentOrder || !returnItem) return;

    setReturnLoading(true);
    try {
      await api.returnDish(currentOrder.id, {
        order_item_id: returnForm.order_item_id,
        quantity: returnForm.quantity,
        reason: returnForm.reason || undefined,
        operator: operator || undefined,
      });
      message.success('退菜成功，原料已退回库存');
      setReturnVisible(false);
      await loadDetail(currentOrder.id);
      loadOrders();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? '退菜失败，请稍后重试';
      message.error(msg);
    } finally {
      setReturnLoading(false);
    }
  }

  const columns: ColumnsType<OrderListItem> = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      render: (v: string) => <Text copyable>{v}</Text>,
    },
    {
      title: '菜品数',
      dataIndex: 'item_count',
      key: 'item_count',
      width: 80,
      align: 'center',
    },
    {
      title: '原价',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 110,
      align: 'right',
      render: (v: number) => formatCurrency(v),
    },
    {
      title: '优惠',
      dataIndex: 'discount_amount',
      key: 'discount_amount',
      width: 100,
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <Text type="danger">-{formatCurrency(v)}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '实付金额',
      dataIndex: 'actual_amount',
      key: 'actual_amount',
      width: 120,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: '#00857C' }}>
          {formatCurrency(v)}
        </Text>
      ),
    },
    {
      title: '会员',
      dataIndex: 'member_name',
      key: 'member_name',
      width: 100,
      render: (v: string | null) => v || <Text type="secondary">散客</Text>,
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
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => loadDetail(record.id)}>
          详情
        </Button>
      ),
    },
  ];

  const detailColumns: ColumnsType<OrderDetailItem> = [
    { title: '菜品', dataIndex: 'dish_name', key: 'dish_name' },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      align: 'right',
      render: (v: number) => formatCurrency(v),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center',
    },
    {
      title: '已退',
      dataIndex: 'refunded_quantity',
      key: 'refunded_quantity',
      width: 80,
      align: 'center',
      render: (v: number) =>
        v > 0 ? <Text type="danger">{v}</Text> : 0,
    },
    {
      title: '小计',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 110,
      align: 'right',
      render: (v: number) => formatCurrency(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => {
        const remaining = record.quantity - record.refunded_quantity;
        return (
          <Button
            type="link"
            size="small"
            danger
            icon={<RollbackOutlined />}
            disabled={remaining <= 0}
            onClick={() => handleReturn(record)}
          >
            退菜
          </Button>
        );
      },
    },
  ];

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
            订单管理 <HistoryOutlined />
          </Title>
          <Text type="secondary">查看历史订单，支持退菜操作</Text>
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

      <Card variant="borderless" style={{ borderRadius: 12 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <DatePicker
            value={date}
            onChange={(d) => {
              setDate(d);
              setPage(1);
            }}
            allowClear
            placeholder="选择日期"
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={loadOrders}
          >
            查询
          </Button>
          <Text type="secondary" style={{ marginLeft: 8 }}>
            共 {total} 条订单
          </Text>
        </Space>

        <Table<OrderListItem>
          rowKey="id"
          columns={columns}
          dataSource={orders}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{ emptyText: <Empty description="暂无订单数据" /> }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : currentOrder ? (
          <div>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">订单号 </Text>
                <Text strong copyable>
                  {currentOrder.order_no}
                </Text>
              </div>
              <div>
                <Text type="secondary">下单时间 </Text>
                <Text>{currentOrder.created_at}</Text>
              </div>
              <div>
                <Text type="secondary">会员 </Text>
                <Text>{currentOrder.member_name || '散客'}</Text>
              </div>
            </Space>

            <Divider style={{ margin: '12px 0' }} />

            <Table<OrderDetailItem>
              rowKey="id"
              size="small"
              columns={detailColumns}
              dataSource={currentOrder.items}
              pagination={false}
              scroll={{ x: 600 }}
            />

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Space direction="vertical" size={4} style={{ width: 200 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text type="secondary">原价合计</Text>
                  <Text>{formatCurrency(currentOrder.total_amount)}</Text>
                </div>
                {currentOrder.discount_amount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text type="secondary">优惠折扣</Text>
                    <Text type="danger">
                      -{formatCurrency(currentOrder.discount_amount)}
                    </Text>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text strong>实付金额</Text>
                  <Text strong style={{ color: '#00857C', fontSize: 16 }}>
                    {formatCurrency(currentOrder.actual_amount)}
                  </Text>
                </div>
              </Space>
            </div>

            {currentOrder.returns.length > 0 && (
              <>
                <Divider style={{ margin: '16px 0 8px' }}>
                  <Text type="secondary">退菜记录</Text>
                </Divider>
                {currentOrder.returns.map((ret) => (
                  <div
                    key={ret.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <Text>{ret.dish_name}</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        × {ret.quantity}
                      </Text>
                      {ret.reason && (
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                          （{ret.reason}）
                        </Text>
                      )}
                    </div>
                    <div>
                      <Text type="danger">-{formatCurrency(ret.amount)}</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        {ret.operator}
                      </Text>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        title="退菜确认"
        open={returnVisible}
        onCancel={() => setReturnVisible(false)}
        confirmLoading={returnLoading}
        onOk={doReturn}
        okText="确认退菜"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        {returnItem && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message={`确认退回 ${returnItem.dish_name}？`}
              description="退菜后将退回对应原料库存，并减少订单金额。"
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#fafafa',
                borderRadius: 8,
              }}
            >
              <div>
                <Text strong>{returnItem.dish_name}</Text>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                  单价 {formatCurrency(returnItem.price)}
                </div>
              </div>
              <Text strong>{formatCurrency(returnItem.subtotal)}</Text>
            </div>

            <div>
              <Text type="secondary">可退数量：</Text>
              <Text>
                {returnItem.quantity - returnItem.refunded_quantity} 份
              </Text>
            </div>

            <div>
              <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                退菜数量
              </Text>
              <InputNumber
                min={1}
                max={returnItem.quantity - returnItem.refunded_quantity}
                value={returnForm.quantity}
                onChange={(v) =>
                  setReturnForm((prev) => ({
                    ...prev,
                    quantity: typeof v === 'number' ? v : 0,
                  }))
                }
                style={{ width: '100%' }}
                addonAfter="份"
              />
            </div>

            <div>
              <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                退菜原因
              </Text>
              <Input.TextArea
                value={returnForm.reason}
                onChange={(e) =>
                  setReturnForm((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                placeholder="请输入退菜原因（可选）"
                rows={2}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#fff1f0',
                borderRadius: 8,
              }}
            >
              <Text type="secondary">预计退回金额</Text>
              <Text type="danger" strong>
                -{formatCurrency(returnItem.price * returnForm.quantity)}
              </Text>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}
