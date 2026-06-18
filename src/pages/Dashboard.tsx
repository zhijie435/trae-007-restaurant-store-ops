import { useEffect } from 'react';
import { Row, Col, Card, Spin, Alert, Button, Space, Typography } from 'antd';
import {
  DollarOutlined,
  ShoppingOutlined,
  TeamOutlined,
  WarningOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { Area, Column } from '@ant-design/charts';
import { useNavigate } from 'react-router-dom';
import StatCard from '@/components/StatCard';
import ReportToolbar from '@/components/ReportToolbar';
import { useReportData, useReportDate } from '@/hooks/useReport';
import { api } from '@/api';
import { formatCurrency, formatNumber } from '@/utils/format';
import type { DashboardData } from '@/types';

const { Text } = Typography;

export default function Dashboard() {
  const { date, setDate } = useReportDate();
  const { data, loading, error, reload } = useReportData<DashboardData>(
    api.dashboard,
    date,
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const navigate = useNavigate();

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Alert
        type="error"
        message="数据加载失败"
        description={error}
        showIcon
        style={{ margin: 24 }}
      />
    );
  }

  const trend = data?.trend ?? [];
  const revenueData = trend.map((t) => ({ date: t.date.slice(5), revenue: t.revenue }));
  const orderData = trend.map((t) => ({ date: t.date.slice(5), count: t.order_count }));

  const quickLinks = [
    { title: '库存日报', desc: '库存变动与预警', path: '/report/inventory', color: '#00857C' },
    { title: '会员日报', desc: '会员消费与等级', path: '/report/member', color: '#722ed1' },
    { title: '出餐日报', desc: '菜品销量与时段', path: '/report/meal', color: '#fa8c16' },
  ];

  return (
    <div>
      <ReportToolbar
        title="综合仪表盘"
        subtitle={`数据日期：${data?.date ?? date.format('YYYY-MM-DD')}`}
        date={date}
        onDateChange={setDate}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="今日营业额"
            value={data?.metrics.revenue ?? 0}
            prefix="¥"
            precision={2}
            icon={<DollarOutlined />}
            accent="#00857C"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="今日订单数"
            value={data?.metrics.order_count ?? 0}
            suffix="单"
            icon={<ShoppingOutlined />}
            accent="#1677ff"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="新增会员"
            value={data?.metrics.new_members ?? 0}
            suffix="人"
            icon={<TeamOutlined />}
            accent="#722ed1"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="库存预警"
            value={data?.metrics.warning_count ?? 0}
            suffix="项"
            icon={<WarningOutlined />}
            accent="#fa541c"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="近 7 天营业额趋势" variant="borderless" style={{ borderRadius: 12 }}>
            <Area
              data={revenueData}
              xField="date"
              yField="revenue"
              height={260}
              axis={{
                x: { title: false },
                y: { title: false, labelFormatter: (v: number) => `¥${formatNumber(v)}` },
              }}
              style={{ fill: '#00857C', fillOpacity: 0.15, stroke: '#00857C' }}
              tooltip={{
                items: [{ channel: 'y', valueFormatter: (v: number) => formatCurrency(v) }],
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="快速入口" variant="borderless" style={{ borderRadius: 12, height: '100%' }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {quickLinks.map((link) => (
                <Card
                  key={link.path}
                  size="small"
                  hoverable
                  onClick={() => navigate(link.path)}
                  style={{ borderRadius: 10, border: 'none', background: '#fafafa' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{link.title}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{link.desc}</Text>
                    </div>
                    <div style={{ color: link.color }}>
                      <ArrowRightOutlined />
                    </div>
                  </div>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="近 7 天订单量趋势" variant="borderless" style={{ borderRadius: 12 }}>
            <Column
              data={orderData}
              xField="date"
              yField="count"
              height={220}
              color="#1677ff"
              axis={{
                x: { title: false },
                y: { title: false },
              }}
              tooltip={{ items: [{ channel: 'y', name: '订单数' }] }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
