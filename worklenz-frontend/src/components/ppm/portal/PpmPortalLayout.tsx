import React, { memo, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import {
  Layout, ConfigProvider, theme, Flex, Typography, Button, Dropdown, Avatar,
} from 'antd/es';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchPortalUser, resetAuth } from '@/features/ppm/ppmPortalSlice';
import { ppmAuthApi } from '@/api/ppm/ppm-portal.api';

const { Header, Content } = Layout;

/**
 * Client portal layout with branded header.
 * Reads branding_config from the authenticated client user's session.
 * Wraps all /portal/* routes.
 */
const PpmPortalLayout: React.FC = memo(() => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAppSelector(state => state.ppmPortal);

  useEffect(() => {
    dispatch(fetchPortalUser());
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated && window.location.pathname !== '/portal/login') {
      // Give fetchPortalUser a moment to resolve before redirecting
      const timer = setTimeout(() => {
        navigate('/portal/login');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, navigate]);

  const branding = user?.branding_config;
  const primaryColor = branding?.primary_color || '#1890ff';

  const themeConfig = useMemo(() => ({
    token: {
      colorPrimary: primaryColor,
    },
    algorithm: theme.defaultAlgorithm,
  }), [primaryColor]);

  const handleLogout = async () => {
    await ppmAuthApi.logout();
    dispatch(resetAuth());
    navigate('/portal/login');
  };

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Header style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <Flex align="center" gap={12}>
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={user?.client_name || 'Client Portal'}
                style={{ height: 32 }}
              />
            ) : (
              <Typography.Title level={4} style={{ margin: 0, color: primaryColor }}>
                {user?.client_name || 'Client Portal'}
              </Typography.Title>
            )}
          </Flex>

          {isAuthenticated && user && (
            <Flex align="center" gap={16}>
              <Link to="/portal/deliverables">
                <Button type="text">Deliverables</Button>
              </Link>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'user',
                      label: (
                        <Flex vertical>
                          <Typography.Text strong>{user.display_name || user.email}</Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {user.role}
                          </Typography.Text>
                        </Flex>
                      ),
                      disabled: true,
                    },
                    { type: 'divider' },
                    {
                      key: 'logout',
                      label: 'Logout',
                      icon: <LogoutOutlined />,
                      danger: true,
                      onClick: handleLogout,
                    },
                  ],
                }}
                trigger={['click']}
              >
                <Avatar
                  icon={<UserOutlined />}
                  style={{ backgroundColor: primaryColor, cursor: 'pointer' }}
                />
              </Dropdown>
            </Flex>
          )}
        </Header>

        <Content style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Outlet />
        </Content>
      </Layout>
    </ConfigProvider>
  );
});

PpmPortalLayout.displayName = 'PpmPortalLayout';
export default PpmPortalLayout;
