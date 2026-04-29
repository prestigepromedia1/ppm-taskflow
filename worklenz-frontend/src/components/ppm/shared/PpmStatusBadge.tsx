import React, { memo } from 'react';
import { Tag } from 'antd/es';

/** Client-facing status label mapping (3-tier visibility model). */
const CLIENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  queued:           { label: 'Submitted',       color: 'default' },
  in_progress:      { label: 'In Progress',     color: 'processing' },
  internal_review:  { label: 'In Progress',     color: 'processing' },
  client_review:    { label: 'Awaiting Review', color: 'warning' },
  revision:         { label: 'Revision',        color: 'error' },
  approved:         { label: 'Approved',        color: 'success' },
  done:             { label: 'Done',            color: 'success' },
};

interface Props {
  status: string;
  statusLabel?: string;
}

const PpmStatusBadge: React.FC<Props> = memo(({ status, statusLabel }) => {
  const mapped = CLIENT_STATUS_MAP[status] || { label: status, color: 'default' };
  return (
    <Tag color={mapped.color}>
      {statusLabel || mapped.label}
    </Tag>
  );
});

PpmStatusBadge.displayName = 'PpmStatusBadge';
export default PpmStatusBadge;
