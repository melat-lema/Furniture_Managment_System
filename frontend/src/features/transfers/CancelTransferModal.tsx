import { useState } from 'react';
import { toast } from 'sonner';
import FormAlert from '../../components/FormAlert';
import { TextAreaField } from '../../components/form/Fields';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { handleFormError, type FormFailure } from '../../lib/form-errors';
import type { TransferDetail } from '../../types/api';
import { useCancelTransfer } from './useTransfers';

interface CancelTransferModalProps {
  open: boolean;
  onClose: () => void;
  transfer: TransferDetail;
}

export default function CancelTransferModal({ open, onClose, transfer }: CancelTransferModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Cancel this transfer?">
      <CancelForm transfer={transfer} onClose={onClose} />
    </Modal>
  );
}

function CancelForm({ transfer, onClose }: { transfer: TransferDetail; onClose: () => void }) {
  const cancel = useCancelTransfer();
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const onTheRoad = transfer.status === 'IN_TRANSIT';

  const submit = async () => {
    setFailure(null);
    try {
      await cancel.mutateAsync({ id: transfer.id, reason: reason.trim() || null });
      toast.success('Transfer cancelled', {
        description: onTheRoad ? `The stock went back to ${transfer.fromLocation.name}.` : transfer.code,
      });
      onClose();
    } catch (error) {
      // there is no form field to point at, so every problem is shown in the alert
      setFailure(handleFormError(error, () => undefined, []));
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-zinc-400">
        {onTheRoad
          ? `${transfer.code} is already on its way. If you cancel it, the goods are put back into the stock of ${transfer.fromLocation.name}.`
          : `${transfer.code} is only a draft. Nothing has left the stock yet.`}
      </p>

      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

      <TextAreaField
        label="Reason (optional)"
        rows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="For example: sent by mistake"
        maxLength={300}
      />

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={cancel.isPending}>
          Keep it
        </Button>
        <Button variant="danger" loading={cancel.isPending} onClick={() => void submit()}>
          Cancel transfer
        </Button>
      </div>
    </div>
  );
}
