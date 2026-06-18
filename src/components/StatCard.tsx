import { Card, Statistic } from 'antd';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: number;
  prefix?: ReactNode;
  suffix?: string;
  precision?: number;
  valueStyle?: React.CSSProperties;
  icon?: ReactNode;
  accent?: string;
}

export default function StatCard({
  title,
  value,
  prefix,
  suffix,
  precision = 0,
  valueStyle,
  icon,
  accent = '#00857C',
}: StatCardProps) {
  return (
    <Card
      variant="borderless"
      style={{ borderRadius: 12, height: '100%' }}
      styles={{ body: { padding: 20 } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 8 }}>{title}</div>
          <Statistic
            value={value}
            prefix={prefix}
            suffix={suffix}
            precision={precision}
            valueStyle={{ fontSize: 28, fontWeight: 600, color: accent, ...valueStyle }}
          />
        </div>
        {icon && (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: `${accent}1a`,
              color: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
