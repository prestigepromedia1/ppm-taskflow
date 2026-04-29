import React, { memo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Typography, Flex, Select, Tag, Space } from 'antd/es';
import type { ColumnsType } from 'antd/es/table';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchDeliverables,
  setStatusFilter,
  setPage,
} from '@/features/ppm/ppmPortalSlice';
import { IPpmDeliverable } from '@/api/ppm/ppm-portal.api';
import PpmStatusBadge from '@/components/ppm/shared/PpmStatusBadge';
import PpmStatCards from '@/components/ppm/shared/PpmStatCards';

const { Title } = Typography;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'client_review', label: 'Awaiting Review' },
  { value: 'revision', label: 'Revision' },
  { value: 'approved', label: 'Approved' },
  { value: 'done', label: 'Done' },
];

const PpmDeliverablesPage: React.FC = memo(() => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    deliverables, deliverablesTotal, deliverablesLoading,
    statusFilter, page, pageSize,
  } = useAppSelector(state => state.ppmPortal);

  useEffect(() => {
    dispatch(fetchDeliverables({
      status: statusFilter || undefined,
      page,
      size: pageSize,
    }));
  }, [dispatch, statusFilter, page, pageSize]);

  const handleStatusChange = useCallback((value: string) => {
    dispatch(setStatusFilter(value || null));
  }, [dispatch]);

  const handlePageChange = useCallback((newPage: number) => {
    dispatch(setPage(newPage));
  }, [dispatch]);

  const columns: ColumnsType<IPpmDeliverable> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: IPpmDeliverable) => (
        <a onClick={() => navigate(`/portal/deliverables/${record.id}`)}>
          {text}
        </a>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (_: string, record: IPpmDeliverable) => (
        <PpmStatusBadge status={record.status} statusLabel={record.status_label} />
      ),
    },
    {
      title: 'Type',
      key: 'type',
      width: 140,
      render: (_: unknown, record: IPpmDeliverable) =>
        record.type_label ? (
          <Tag color={record.type_color}>{record.type_label}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: 'Priority',
      key: 'priority',
      width: 120,
      render: (_: unknown, record: IPpmDeliverable) =>
        record.priority_label ? (
          <Tag color={record.priority_color}>{record.priority_label}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: 'Send Date',
      dataIndex: 'send_date',
      key: 'send_date',
      width: 120,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 120,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString() : '-',
    },
  ];

  return (
    <Flex vertical gap={24}>
      <Title level={3}>Deliverables</Title>

      <PpmStatCards deliverables={deliverables} />

      <Flex justify="space-between" align="center">
        <Space>
          <Select
            value={statusFilter || ''}
            onChange={handleStatusChange}
            options={STATUS_FILTER_OPTIONS}
            style={{ width: 200 }}
            placeholder="Filter by status"
          />
        </Space>
        <Typography.Text type="secondary">
          {deliverablesTotal} total
        </Typography.Text>
      </Flex>

      <Table
        columns={columns}
        dataSource={deliverables}
        rowKey="id"
        loading={deliverablesLoading}
        pagination={{
          current: page,
          pageSize,
          total: deliverablesTotal,
          onChange: handlePageChange,
          showSizeChanger: false,
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/portal/deliverables/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        size="middle"
      />
    </Flex>
  );
});

PpmDeliverablesPage.displayName = 'PpmDeliverablesPage';
export default PpmDeliverablesPage;
