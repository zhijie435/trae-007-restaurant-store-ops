import { Row, Col, Card, Table, Tag, Spin, Alert, Empty, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowDownOutlined, ArrowUpOutlined, WarningOutlined } from '@ant-design/icons';
import StatCard from '@/components/StatCard';
import ReportToolbar from '@/components/ReportToolbar';
import { useReportData, useReportDate } from '@/hooks/useReport';
import { api } from '@/api';
import type { InventoryReport as InventoryReportData, InventoryRecordItem, WarningItem } from '@/types';

const { Text } = Typography;

const typeColor: Record<string, string> = {
  入库: 'success',
  出库: 'warning',
  盘点: 'processing',
};

export default function InventoryReport() {
  const { date, setDate } = useReportDate();
  const { data, loading, error } = useReportData<InventoryReportData>(
    api.inventoryReport,
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
  const warningList = data?.warning_list ?? [];
  const records = data?.records ?? [];

  const warningColumns: ColumnsType<WarningItem> = [
    { title: '原料', dataIndex: 'name', key: 'name', width: 120 },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
    {
      title: '当前库存',
      key: 'stock',
      width: 120,
      render: (_, r) => (
        <Text type="danger" strong>
          {r.stock} {r.unit}
        </Text>
      ),
    },
    { title: '预警阈值', key: 'threshold', width: 110, render: (_, r) => `${r.threshold} ${r.unit}` },
    {
      title: '缺口',
      key: 'shortage',
      width: 100,
      render: (_, r) => <Tag color="red">缺 {r.shortage} {r.unit}</Tag>,
    },
  ];

  const recordColumns: ColumnsType<InventoryRecordItem> = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 150 },
    { title: '原料', dataIndex: 'ingredient', key: 'ingredient', width: 120 },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (t: string) => <Tag color={typeColor[t] ?? 'default'}>{t}</Tag>,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right' as const,
    },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
  ];

  return (
    <div>
      <ReportToolbar
        title="库存日报"
        subtitle={`数据日期：${data?.date ?? date.format('YYYY-MM-DD')}`}
        date={date}
        onDateChange={setDate}
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <StatCard title="今日入库" value={summary?.inbound ?? 0} prefix="+" icon={<ArrowDownOutlined />} accent="#52c41a" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title="今日出库" value={summary?.outbound ?? 0} prefix="-" icon={<ArrowUpOutlined />} accent="#fa8c16" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title="净变动" value={summary?.net ?? 0} icon={<ArrowUpOutlined />} accent="#00857C" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            title="库存预警"
            value={summary?.warning_count ?? 0}
            suffix="项"
            icon={<WarningOutlined />}
            accent="#fa541c"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card
            title={<span>库存预警列表 <Tag color="red">{warningList.length}</Tag></span>}
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            {warningList.length === 0 ? (
              <Empty description="暂无预警，库存充足" />
            ) : (
              <Table<WarningItem>
                rowKey="id"
                size="small"
                columns={warningColumns}
                dataSource={warningList}
                pagination={false}
                scroll={{ y: 320 }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="出入库明细" bordered={false} style={{ borderRadius: 12 }}>
            <Table<InventoryRecordItem>
              rowKey="id"
              size="small"
              columns={recordColumns}
              dataSource={records}
              pagination={{ pageSize: 8, showSizeChanger: false }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
