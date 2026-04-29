import React, { memo, useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Flex, Button, Descriptions, Tag, Divider,
  Spin, Result, Space, message,
} from 'antd/es';
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchDeliverable, updateDeliverableStatus } from '@/features/ppm/ppmPortalSlice';
import PpmStatusBadge from '@/components/ppm/shared/PpmStatusBadge';
import PpmFeedbackModal from '@/components/ppm/shared/PpmFeedbackModal';

const { Title, Paragraph, Text } = Typography;

/** Format hours as "Xh XXm" */
function formatHours(hours?: number): string {
  if (!hours) return '-';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const PpmDeliverableDetailPage: React.FC = memo(() => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentDeliverable, currentDeliverableLoading, user } = useAppSelector(
    state => state.ppmPortal
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchDeliverable(id));
  }, [id, dispatch]);

  const handleApprove = useCallback(async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await dispatch(updateDeliverableStatus({ id, status: 'approved' })).unwrap();
      message.success('Deliverable approved');
    } catch (err: any) {
      message.error(err || 'Failed to approve');
    }
    setActionLoading(false);
  }, [id, dispatch]);

  const handleReject = useCallback(async (feedback: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await dispatch(updateDeliverableStatus({ id, status: 'revision', feedback })).unwrap();
      message.info('Revision requested');
      setFeedbackOpen(false);
    } catch (err: any) {
      message.error(err || 'Failed to request revision');
    }
    setActionLoading(false);
  }, [id, dispatch]);

  if (currentDeliverableLoading) {
    return (
      <Flex justify="center" style={{ paddingTop: 120 }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (!currentDeliverable) {
    return (
      <Result
        status="404"
        title="Deliverable Not Found"
        extra={<Button onClick={() => navigate('/portal/deliverables')}>Back to List</Button>}
      />
    );
  }

  const d = currentDeliverable;
  const canReview = d.status === 'client_review' && ['reviewer', 'admin'].includes(user?.role || '');

  return (
    <Flex vertical gap={24}>
      <Flex align="center" gap={12}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/portal/deliverables')}
        />
        <Title level={3} style={{ margin: 0 }}>{d.title}</Title>
        <PpmStatusBadge status={d.status} statusLabel={d.status_label} />
      </Flex>

      {canReview && (
        <Card size="small" style={{ borderColor: '#faad14', background: '#fffbe6' }}>
          <Flex justify="space-between" align="center">
            <Text strong>This deliverable is awaiting your review</Text>
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleApprove}
                loading={actionLoading}
              >
                Approve
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => setFeedbackOpen(true)}
              >
                Request Revision
              </Button>
            </Space>
          </Flex>
        </Card>
      )}

      <Card>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="Type">
            {d.type_label ? <Tag color={d.type_color}>{d.type_label}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Channel">
            {d.channel_label ? <Tag color={d.channel_color}>{d.channel_label}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Priority">
            {d.priority_label ? <Tag color={d.priority_color}>{d.priority_label}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <PpmStatusBadge status={d.status} statusLabel={d.status_label} />
          </Descriptions.Item>
          <Descriptions.Item label="Send Date">
            {d.send_date ? new Date(d.send_date).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Due Date">
            {d.due_date ? new Date(d.due_date).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Estimated">
            {formatHours(d.estimated_hours)}
          </Descriptions.Item>
          <Descriptions.Item label="Actual">
            {formatHours(d.actual_hours)}
          </Descriptions.Item>
          {d.month_completed && (
            <Descriptions.Item label="Completed">
              {d.month_completed}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {d.description && (
        <Card title="Description" size="small">
          <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{d.description}</Paragraph>
        </Card>
      )}

      {d.asset_review_link && (
        <Card title="Review Asset" size="small">
          <a href={d.asset_review_link} target="_blank" rel="noopener noreferrer">
            <Space>
              <LinkOutlined />
              {d.asset_review_link}
            </Space>
          </a>
        </Card>
      )}

      <PpmFeedbackModal
        open={feedbackOpen}
        loading={actionLoading}
        onSubmit={handleReject}
        onCancel={() => setFeedbackOpen(false)}
      />
    </Flex>
  );
});

PpmDeliverableDetailPage.displayName = 'PpmDeliverableDetailPage';
export default PpmDeliverableDetailPage;
