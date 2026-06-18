import { DatePicker, Space, Typography } from 'antd';
import type { Dayjs } from 'dayjs';

const { Title, Text } = Typography;

interface ReportToolbarProps {
  title: string;
  subtitle?: string;
  date: Dayjs;
  onDateChange: (date: Dayjs) => void;
}

export default function ReportToolbar({
  title,
  subtitle,
  date,
  onDateChange,
}: ReportToolbarProps) {
  return (
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
        <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
          {title}
        </Title>
        {subtitle && <Text type="secondary">{subtitle}</Text>}
      </div>
      <Space size="middle">
        <Text type="secondary">查询日期</Text>
        <DatePicker
          value={date}
          onChange={(d) => d && onDateChange(d)}
          allowClear={false}
          format="YYYY-MM-DD"
        />
      </Space>
    </div>
  );
}
