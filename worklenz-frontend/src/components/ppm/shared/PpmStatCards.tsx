import React, { memo, useMemo } from 'react';
import { Card, Col, Row, Statistic } from 'antd/es';
import {
  SendOutlined,
  SyncOutlined,
  EyeOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { IPpmDeliverable } from '@/api/ppm/ppm-portal.api';

interface Props {
  deliverables: IPpmDeliverable[];
}

const PpmStatCards: React.FC<Props> = memo(({ deliverables }) => {
  const counts = useMemo(() => {
    const submitted = deliverables.filter(d =>
      ['queued'].includes(d.status)
    ).length;
    const active = deliverables.filter(d =>
      ['in_progress', 'internal_review', 'revision'].includes(d.status)
    ).length;
    const awaitingReview = deliverables.filter(d =>
      d.status === 'client_review'
    ).length;
    const approved = deliverables.filter(d =>
      ['approved', 'done'].includes(d.status)
    ).length;
    return { submitted, active, awaitingReview, approved };
  }, [deliverables]);

  const cards = [
    { title: 'Submitted', value: counts.submitted, icon: <SendOutlined />, color: '#8c8c8c' },
    { title: 'Active', value: counts.active, icon: <SyncOutlined />, color: '#1890ff' },
    { title: 'Awaiting Review', value: counts.awaitingReview, icon: <EyeOutlined />, color: '#faad14' },
    { title: 'Approved', value: counts.approved, icon: <CheckCircleOutlined />, color: '#52c41a' },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map(card => (
        <Col xs={12} sm={6} key={card.title}>
          <Card size="small" hoverable>
            <Statistic
              title={card.title}
              value={card.value}
              prefix={card.icon}
              valueStyle={{ color: card.color }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
});

PpmStatCards.displayName = 'PpmStatCards';
export default PpmStatCards;
