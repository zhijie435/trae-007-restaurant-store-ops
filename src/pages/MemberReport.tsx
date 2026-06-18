import { Row, Col, Card, Table, Tag, Spin, Alert, Empty, Typography, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UserAddOutlined, TeamOutlined, DollarOutlined, WalletOutlined, StarOutlined } from '@ant-design/icons';
import { Pie } from '@ant-design/charts';
import { useMemo, useState } from 'react';
import StatCard from '@/components/StatCard';
import ReportToolbar from '@/components/ReportToolbar';
import { useReportData, useReportDate } from '@/hooks/useReport';
import { api } from '@/api';
import { formatCurrency } from '@/utils/format';
import type { MemberReport as MemberReportData, MemberTransactionItem } from '@/types';

const { Text } = Typography;

const txnColor: Record<string, string> = {
  消费: 'blue',
  充值: 'gold',
  积分变动: 'purple',
};

const levelColors: Record<string, string> = {
  普通会员: '#bfbfbf',
  银卡会员: '#8c8c8c',
  金卡会员: '#faad14',
  钻石会员: '#722ed1',
};

export default function MemberReport() {
  const { date, setDate } = useReportDate();
  const { data, loading, error } = useReportData<MemberReportData>(
    api.memberReport,
    date,
  );
  const [tabKey, setTabKey] = useState<'all' | '消费' | '充值'>('all');

  const summary = data?.summary;
  const transactions = data?.transactions ?? [];
  const levelDist = data?.level_distribution ?? {};

  const filteredTransactions = useMemo(() => {
    if (tabKey === 'all') return transactions;
    return transactions.filter((t) => t.type === tabKey);
  }, [transactions, tabKey]);

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

  const pieData = Object.entries(levelDist).map(([name, value]) => ({
    name,
    value,
  }));
  const totalMembers = pieData.reduce((s, d) => s + d.value, 0);

  const columns: ColumnsType<MemberTransactionItem> = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 150 },
    { title: '会员', dataIndex: 'member', key: 'member', width: 100 },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140 },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (t: string) => <Tag color={txnColor[t] ?? 'default'}>{t}</Tag>,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => formatCurrency(v),
    },
    {
      title: '积分变动',
      dataIndex: 'points_change',
      key: 'points_change',
      width: 100,
      align: 'right' as const,
      render: (v: number) =>
        v === 0 ? <Text type="secondary">-</Text> : <Text type={v > 0 ? 'success' : 'danger'}>{v > 0 ? '+' : ''}{v}</Text>,
    },
  ];

  return (
    <div>
      <ReportToolbar
        title="会员日报"
        subtitle={`数据日期：${data?.date ?? date.format('YYYY-MM-DD')}`}
        date={date}
        onDateChange={setDate}
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <StatCard title="今日新增会员" value={summary?.new_members ?? 0} suffix="人" icon={<UserAddOutlined />} accent="#00857C" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title="今日活跃会员" value={summary?.active_members ?? 0} suffix="人" icon={<TeamOutlined />} accent="#1677ff" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title="会员消费" value={summary?.consumption ?? 0} prefix="¥" precision={2} icon={<DollarOutlined />} accent="#fa8c16" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title="会员充值" value={summary?.recharge ?? 0} prefix="¥" precision={2} icon={<WalletOutlined />} accent="#52c41a" />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card title="会员等级分布" variant="borderless" style={{ borderRadius: 12, height: '100%' }}>
            {pieData.length === 0 ? (
              <Empty description="暂无会员数据" />
            ) : (
              <>
                <Pie
                  data={pieData}
                  angleField="value"
                  colorField="name"
                  height={240}
                  innerRadius={0.6}
                  legend={{ color: { position: 'right', layout: { justifyContent: 'center' } } }}
                  label={{
                    text: 'value',
                    style: { fontWeight: 'bold' },
                  }}
                  tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => `${v} 人` }] }}
                />
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Text type="secondary">会员总数 </Text>
                  <Text strong style={{ fontSize: 18 }}>{summary?.total_members ?? totalMembers}</Text>
                  <Text type="secondary"> 人</Text>
                  <div style={{ marginTop: 6 }}>
                    <Text type="secondary">今日积分变动 </Text>
                    <StarOutlined style={{ color: '#faad14' }} />
                    <Text strong style={{ color: '#faad14' }}> {summary?.points_change ?? 0}</Text>
                  </div>
                </div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title="会员交易明细"
            variant="borderless"
            style={{ borderRadius: 12 }}
            tabList={[
              { key: 'all', tab: `全部 (${transactions.length})` },
              { key: '消费', tab: `消费 (${transactions.filter((t) => t.type === '消费').length})` },
              { key: '充值', tab: `充值 (${transactions.filter((t) => t.type === '充值').length})` },
            ]}
            activeTabKey={tabKey}
            onTabChange={(k) => setTabKey(k as 'all' | '消费' | '充值')}
          >
            <Table<MemberTransactionItem>
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={filteredTransactions}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              locale={{ emptyText: tabKey === 'all' ? '暂无交易记录' : `暂无${tabKey}记录` }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
