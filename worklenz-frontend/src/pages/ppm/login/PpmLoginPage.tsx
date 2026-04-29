import React, { memo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Flex, Result, Spin } from 'antd/es';
import { MailOutlined } from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { requestMagicLink, verifyMagicLink } from '@/features/ppm/ppmPortalSlice';

const { Title, Text, Paragraph } = Typography;

const PpmLoginPage: React.FC = memo(() => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authLoading, authError, magicLinkSent, isAuthenticated } = useAppSelector(
    state => state.ppmPortal
  );
  const [form] = Form.useForm();

  // Handle magic link token in URL (e.g., /portal/login?token=abc123)
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      dispatch(verifyMagicLink(token));
    }
  }, [token, dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/portal/deliverables');
    }
  }, [isAuthenticated, navigate]);

  const onFinish = useCallback(
    (values: { email: string }) => {
      dispatch(requestMagicLink(values.email));
    },
    [dispatch]
  );

  // Verifying token
  if (token && authLoading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '60vh' }}>
        <Spin size="large" tip="Verifying your link..." />
      </Flex>
    );
  }

  // Token verification failed
  if (token && authError) {
    return (
      <Flex justify="center" style={{ marginTop: 96 }}>
        <Card style={{ maxWidth: 440, width: '100%' }}>
          <Result
            status="error"
            title="Invalid or Expired Link"
            subTitle="This magic link is no longer valid. Please request a new one."
            extra={
              <Button type="primary" onClick={() => navigate('/portal/login')}>
                Request New Link
              </Button>
            }
          />
        </Card>
      </Flex>
    );
  }

  // Magic link sent confirmation
  if (magicLinkSent) {
    return (
      <Flex justify="center" style={{ marginTop: 96 }}>
        <Card style={{ maxWidth: 440, width: '100%' }}>
          <Result
            status="success"
            title="Check Your Email"
            subTitle="We've sent a login link to your email address. Click the link to access your portal."
          />
          <Flex justify="center">
            <Button type="link" onClick={() => window.location.reload()}>
              Try a different email
            </Button>
          </Flex>
        </Card>
      </Flex>
    );
  }

  // Login form
  return (
    <Flex justify="center" style={{ marginTop: 96 }}>
      <Card style={{ maxWidth: 440, width: '100%' }}>
        <Flex vertical align="center" style={{ marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>Client Portal</Title>
          <Text type="secondary">Enter your email to receive a login link</Text>
        </Flex>

        <Form
          form={form}
          name="ppm-login"
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="your@email.com"
              size="large"
              autoFocus
            />
          </Form.Item>

          {authError && (
            <Paragraph type="danger" style={{ marginBottom: 16 }}>
              {authError}
            </Paragraph>
          )}

          <Button
            block
            type="primary"
            htmlType="submit"
            size="large"
            loading={authLoading}
          >
            Send Magic Link
          </Button>
        </Form>
      </Card>
    </Flex>
  );
});

PpmLoginPage.displayName = 'PpmLoginPage';
export default PpmLoginPage;
