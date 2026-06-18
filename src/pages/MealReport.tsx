import { Row, Col, Card, Spin, Alert, Empty, Typography, Space } from 'antd';
import { ShoppingOutlined, DollarOutlined, CrownOutlined, UserOutlined } from '@ant-design/icons';
import { Bar, Column } from '@ant-design/charts';
import StatCard from '@/components/StatCard';
import ReportToolbar from '@/components/ReportToolbar';
import { useReportData, useReportDate } from '@/hooks/useReport';
import { api } from '@/api';
import { formatCurrency } from '@/utils/format';
import type { MealReport as MealReportData } from '@/types';

const { Text } = Typography;

export default function MealReport() {
  const { date, setDate } = useReportDate();
  const { data, loading, error } = useReportData<MealReportData>(
    api.mealReport,
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

  const summary = data?.summary;
  const topDishes = data?.top_dishes ?? [];
  const hourly = data?.hourly ?? [];

  const memberRatio =
    summary && summary.order_count > 0
      ? Math.round((summary.member_orders / summary.order_count) * 100)
      : 0;

  return (
    <div>
      <ReportToolbar
        title="出餐日报"
        subtitle={`数据日期：${data?.date ?? date.format('YYYY-MM-DD')}`}
        date={date}
        onDateChange={setDate}
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <StatCard title="今日出餐订单" value={summary?.order_count ?? 0} suffix="单" icon={<ShoppingOutlined />} accent="#00857C" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title="今日营业额" value={summary?.revenue ?? 0} prefix="¥" precision={2} icon={<DollarOutlined />} accent="#1677ff" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title="客单价" value={summary?.avg_order_value ?? 0} prefix="¥" precision={2} icon={<CrownOutlined />} accent="#fa8c16" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title="会员订单占比" value={memberRatio} suffix="%" icon={<UserOutlined />} accent="#722ed1" />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="菜品销量排行 Top10" variant="borderless" style={{ borderRadius: 12, height: '100%' }}>
            {topDishes.length === 0 ? (
              <Empty description="暂无出餐数据" />
            ) : (
              <Bar
                data={topDishes}
                xField="total_qty"
                yField="name"
                height={360}
                color="#00857C"
                axis={{
                  x: { title: '销量（份）' },
                  y: { title: false },
                }}
                tooltip={{
                  items: [
                    { channel: 'x', name: '销量', valueFormatter: (v: number) => `${v} 份` },
                    {
                      field: 'total_amount',
                      name: '销售额',
                      valueFormatter: (v: number) => formatCurrency(v),
                    },
                  ],
                }}
                label={{
                  text: 'total_qty',
                  position: 'right',
                  style: { fill: '#595959' },
                }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="订单时段分布（24 小时）" variant="borderless" style={{ borderRadius: 12, height: '100%' }}>
            <Column
              data={hourly}
              xField="hour"
              yField="count"
              height={360}
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
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="订单构成" variant="borderless" style={{ borderRadius: 12 }}>
            <Space size="large" wrap>
              <span>
                <Text type="secondary">会员订单 </Text>
                <Text strong style={{ color: '#722ed1' }}>{summary?.member_orders ?? 0}</Text>
                <Text type="secondary"> 单</Text>
              </span>
              <span>
                <Text type="secondary">散客订单 </Text>
                <Text strong style={{ color: '#595959' }}>{summary?.guest_orders ?? 0}</Text>
                <Text type="secondary"> 单</Text>
              </span>
              <span>
                <Text type="secondary">总营业额 </Text>
                <Text strong style={{ color: '#00857C' }}>{formatCurrency(summary?.revenue ?? 0)}</Text>
              </span>
              <span>
                <Text type="secondary">客单价 </Text>
                <Text strong>{formatCurrency(summary?.avg_order_value ?? 0)}</Text>
              </span>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
