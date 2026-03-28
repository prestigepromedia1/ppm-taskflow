// PPM-OVERRIDE: Phase 2 — Team management page for PPM role assignments
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Typography, Flex, Spin, message, Button, Tag, Select } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { adminApi, IPPMTeamMember } from './admin-api';

const { Title } = Typography;

const TeamPage: React.FC = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<IPPMTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getTeamMembers();
      if (res.done && res.body) setMembers(res.body);
    } catch { message.error('Failed to load team members'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (userId: string, value: string | null) => {
    setUpdating(userId);
    try {
      if (value === 'partner' || value === 'employee') {
        const res = await adminApi.setTeamMemberRole(userId, value);
        if (res.done) {
          message.success('Role updated');
          load();
        } else {
          message.error(res.message || 'Failed to update role');
        }
      } else {
        const res = await adminApi.removeTeamMemberRole(userId);
        if (res.done) {
          message.success('Role removed');
          load();
        } else {
          message.error(res.message || 'Failed to remove role');
        }
      }
    } catch { message.error('Failed to update role'); }
    finally { setUpdating(null); }
  };

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
    },
    {
      title: 'Email', dataIndex: 'email', key: 'email',
    },
    {
      title: 'PPM Role', key: 'ppm_role',
      render: (_: any, r: IPPMTeamMember) => {
        if (r.ppm_role === 'partner') return <Tag color="blue">Partner</Tag>;
        if (r.ppm_role === 'employee') return <Tag color="green">Employee</Tag>;
        return <Tag>Unassigned</Tag>;
      },
    },
    {
      title: 'Actions', key: 'actions', width: 200,
      render: (_: any, r: IPPMTeamMember) => (
        <Select
          value={r.ppm_role || 'unassigned'}
          onChange={(v) => handleRoleChange(r.user_id, v === 'unassigned' ? null : v)}
          loading={updating === r.user_id}
          disabled={updating === r.user_id}
          style={{ width: 160 }}
          options={[
            { value: 'partner', label: 'Partner' },
            { value: 'employee', label: 'Employee' },
            { value: 'unassigned', label: 'Unassigned' },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <Flex align="center" gap={12} style={{ marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/taskflow/ppm')} />
        <Title level={3} style={{ margin: 0 }}>Team</Title>
      </Flex>

      <Card>
        <Table dataSource={members} columns={columns} rowKey="user_id" pagination={false} size="middle" loading={loading} />
      </Card>
    </div>
  );
};

export default TeamPage;
