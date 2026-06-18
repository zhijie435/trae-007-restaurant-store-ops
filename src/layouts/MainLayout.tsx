import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  InboxOutlined,
  TeamOutlined,
  ForkOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '综合仪表盘' },
  { key: '/report/inventory', icon: <InboxOutlined />, label: '库存日报' },
  { key: '/report/member', icon: <TeamOutlined />, label: '会员日报' },
  { key: '/report/meal', icon: <ForkOutlined />, label: '出餐日报' },
];

export default function MainLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey =
    menuItems.find((m) => m.key !== '/' && location.pathname.startsWith(m.key))?.key ?? '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth={0}
        style={{
          background: 'linear-gradient(180deg, #0f3d39 0%, #14524c 100%)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: '#fff',
          }}
        >
          <ForkOutlined style={{ fontSize: 22, color: '#5fd3c4' }} />
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: 1 }}>
            老味道餐厅
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            borderInlineEnd: 'none',
            marginTop: 8,
          }}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: '#262626' }}>
            门店运营日报系统
          </span>
          <span style={{ color: '#8c8c8c', fontSize: 13 }}>
            老味道餐厅（旗舰店） · 黄浦区南京东路
          </span>
        </Header>
        <Content style={{ padding: 24, background: '#f5f7fa', minHeight: 'calc(100vh - 64px)' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
