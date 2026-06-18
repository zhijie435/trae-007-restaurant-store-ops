import { Row, Col, Card, Spin, Alert, Typography, Space, Divider, Table, Empty } from 'antd';
import {
  ShoppingOutlined,
  DollarOutlined,
  CrownOutlined,
  TeamOutlined,
  WalletOutlined,
  PlusOutlined,
  MinusOutlined,
  ExclamationCircleOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import StatCard from '@/components/StatCard';
import ReportToolbar from '@/components/ReportToolbar';
import { useReportData, useReportDate } from '@/hooks/useReport';
import { api } from '@/api';
import { formatCurrency } from '@/utils/format';
import type { DailyReport as DailyReportData, TopDish } from '@/types';

const { Text } = Typography;

export default function DailyReport() {
  const { date, setDate } = useReportDate();
  const { data, loading, error } = useReportData<DailyReportData>(
    api.dailyReport,
    date,
  );

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (error && !data) {
    return <Alert type="error" message="数据加载失败" description={error} showIcon style={{ margin: 24 }} />;
  }

  const meal = data?.meal;
  const member = data?.member;
  const inventory = data?.inventory;
  const hourly = meal?.hourly ?? [];

  const peakHour = hourly.reduce(
    (acc, cur) => (cur.count > acc.count ? cur : acc),
    { hour: '-', count: 0, revenue: 0 },
  );
  const totalHourRevenue = hourly.reduce((sum, h) => sum + h.revenue, 0);

  const mealMemberRatio =
    meal && meal.order_count > 0
      ? Math.round((meal.member_orders / meal.order_count) * 100)
      : 0;

  const topDishColumns = [
    { title: '菜品', dataIndex: 'name', key: 'name' },
    {
      title: '销量',
      dataIndex: 'total_qty',
      key: 'total_qty',
      width: 100,
      align: 'right' as const,
      render: (v: number) => `${v} 份`,
    },
    {
      title: '销售额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => formatCurrency(v),
    },
  ];

  return (
    <div>
      <ReportToolbar
        title="综合运营日报"
        subtitle={`数据日期：${data?.date ?? date.format('YYYY-MM-DD')}`}
        date={date}
        onDateChange={setDate}
      />

      <Divider orientation="left" plain style={{ margin: '0 0 12px' }}>
        <Space align="center">
          <ShoppingOutlined style={{ color: '#00857C' }} />
          <Text strong>出餐数据</Text>
        </Space>
      </Divider>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="出餐订单" value={meal?.order_count ?? 0} suffix="单" icon={<ShoppingOutlined />} accent="#00857C" />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="营业额" value={meal?.revenue ?? 0} prefix="¥" precision={2} icon={<DollarOutlined />} accent="#1677ff" />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="客单价" value={meal?.avg_order_value ?? 0} prefix="¥" precision={2} icon={<CrownOutlined />} accent="#fa8c16" />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="会员订单" value={meal?.member_orders ?? 0} suffix="单" icon={<TeamOutlined />} accent="#722ed1" />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="散客订单" value={meal?.guest_orders ?? 0} suffix="单" icon={<AppstoreOutlined />} accent="#13c2c2" />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="会员占比" value={mealMemberRatio} suffix="%" icon={<TeamOutlined />} accent="#eb2f96" />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="菜品销量 Top5" variant="borderless" style={{ borderRadius: 12, height: '100%' }}>
            <Table<TopDish>
              rowKey="name"
              size="small"
              columns={topDishColumns}
              dataSource={meal?.top_dishes ?? []}
              pagination={false}
              locale={{ emptyText: '暂无出餐数据' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#1677ff' }} />
                <span>订单时段分布（24 小时）</span>
              </Space>
            }
            extra={
              <Space size="large">
                <span>
                  <Text type="secondary">高峰时段 </Text>
                  <Text strong style={{ color: '#fa8c16' }}>
                    {peakHour.count > 0 ? peakHour.hour : '-'}
                  </Text>
                </span>
                <span>
                  <Text type="secondary">时段营收 </Text>
                  <Text strong style={{ color: '#00857C' }}>
                    {formatCurrency(totalHourRevenue)}
                  </Text>
                </span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12, height: '100%' }}
          >
            {hourly.length === 0 ? (
              <Empty description="暂无时段数据" />
            ) : (
              <Column
                data={hourly}
                xField="hour"
                yField="count"
                height={320}
                color="#1677ff"
                axis={{
                  x: { title: false },
                  y: { title: '订单数' },
                }}
                tooltip={{
                  items: [
                    { channel: 'y', name: '订单数', valueFormatter: (v: number) => `${v} 单` },
                    {
                      field: 'revenue',
                      name: '营业额',
                      valueFormatter: (v: number) => formatCurrency(v),
                    },
                  ],
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Divider orientation="left" plain style={{ margin: '20px 0 12px' }}>
        <Space align="center">
          <TeamOutlined style={{ color: '#722ed1' }} />
          <Text strong>会员数据</Text>
        </Space>
      </Divider>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="新增会员" value={member?.new_members ?? 0} suffix="人" icon={<PlusOutlined />} accent="#1677ff" />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="活跃会员" value={member?.active_members ?? 0} suffix="人" icon={<TeamOutlined />} accent="#00857C" />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="会员总数" value={member?.total_members ?? 0} suffix="人" icon={<CrownOutlined />} accent="#fa8c16" />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="会员消费" value={member?.consumption ?? 0} prefix="¥" precision={2} icon={<DollarOutlined />} accent="#eb2f96" />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="会员充值" value={member?.recharge ?? 0} prefix="¥" precision={2} icon={<WalletOutlined />} accent="#722ed1" />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="积分变动" value={member?.points_change ?? 0} suffix="分" icon={<CrownOutlined />} accent="#13c2c2" />
        </Col>
      </Row>

      <Divider orientation="left" plain style={{ margin: '20px 0 12px' }}>
        <Space align="center">
          <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
          <Text strong>库存数据</Text>
        </Space>
      </Divider>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6} lg={4}>
          <StatCard title="原料入库" value={inventory?.inbound ?? 0} suffix="件" icon={<PlusOutlined />} accent="#52c41a" />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatCard title="原料出库" value={inventory?.outbound ?? 0} suffix="件" icon={<MinusOutlined />} accent="#eb2f96" />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatCard title="净变动" value={inventory?.net ?? 0} suffix="件" icon={<AppstoreOutlined />} accent="#1677ff" />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatCard title="库存预警" value={inventory?.warning_count ?? 0} suffix="项" icon={<ExclamationCircleOutlined />} accent="#fa8c16" />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatCard title="SKU 总数" value={inventory?.total_skus ?? 0} suffix="项" icon={<AppstoreOutlined />} accent="#722ed1" />
        </Col>
      </Row>
    </div>
  );
}
