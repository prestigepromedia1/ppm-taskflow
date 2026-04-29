import React, { memo, useState, useCallback } from 'react';
import { Modal, Form, Select, Input } from 'antd/es';

/** Predefined reject reasons from design spec. */
const REJECT_REASONS = [
  { value: 'missing_items', label: 'Missing items — required form fields not filled out' },
  { value: 'unclear_scope', label: 'Unclear scope — description needs more detail' },
  { value: 'wrong_channel_type', label: 'Wrong channel/type — incorrect dropdown values' },
  { value: 'duplicate_request', label: 'Duplicate request — task already submitted' },
  { value: 'out_of_scope', label: 'Out of scope — not covered by current retainer' },
  { value: 'budget_exceeded', label: 'Budget exceeded — retainer hours depleted' },
  { value: 'needs_assets', label: 'Needs assets — reference files or brand assets missing' },
  { value: 'other', label: 'Other — see comment for details' },
];

interface Props {
  open: boolean;
  loading?: boolean;
  onSubmit: (feedback: string) => void;
  onCancel: () => void;
}

const PpmFeedbackModal: React.FC<Props> = memo(({ open, loading, onSubmit, onCancel }) => {
  const [form] = Form.useForm();
  const [showComment, setShowComment] = useState(false);

  const handleReasonChange = useCallback((value: string) => {
    setShowComment(value === 'other');
  }, []);

  const handleOk = useCallback(() => {
    form.validateFields().then(values => {
      const reason = REJECT_REASONS.find(r => r.value === values.reason)?.label || values.reason;
      const feedback = values.comment
        ? `${reason}\n\n${values.comment}`
        : reason;
      onSubmit(feedback);
      form.resetFields();
      setShowComment(false);
    });
  }, [form, onSubmit]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    setShowComment(false);
    onCancel();
  }, [form, onCancel]);

  return (
    <Modal
      title="Request Revision"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Submit Feedback"
      okButtonProps={{ danger: true, loading }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          name="reason"
          label="Reason for revision"
          rules={[{ required: true, message: 'Please select a reason' }]}
        >
          <Select
            placeholder="Select a reason..."
            options={REJECT_REASONS}
            onChange={handleReasonChange}
          />
        </Form.Item>

        {showComment && (
          <Form.Item
            name="comment"
            label="Additional details"
            rules={[{ required: true, message: 'Please provide details' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Describe what needs to change..."
              maxLength={2000}
              showCount
            />
          </Form.Item>
        )}

        {!showComment && (
          <Form.Item name="comment" label="Additional notes (optional)">
            <Input.TextArea
              rows={3}
              placeholder="Any additional context..."
              maxLength={2000}
              showCount
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
});

PpmFeedbackModal.displayName = 'PpmFeedbackModal';
export default PpmFeedbackModal;
