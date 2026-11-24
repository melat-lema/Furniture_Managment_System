import { useState } from 'react';
import { toast } from 'sonner';
import FormAlert from '../../components/FormAlert';
import { TextAreaField } from '../../components/form/Fields';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { toApiError } from '../../lib/errors';
import type { SaleDetail } from '../../types/api';
import { useCancelSale } from './useSales';

interface CancelSaleModalProps {
  open: boolean;
  onClose: () => void;
  sale: SaleDetail;
}

export default function CancelSaleModal({ open, onClose, sale }: CancelSaleModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Cancel this sale?" description={sale.code}>
      <CancelForm sale={sale} onClose={onClose} />
    </Modal>
  );
}

function CancelForm({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const cancel = useCancelSale();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const hasPayments = sale.payments.some((payment) => payment.verificationStatus !== 'REJECTED');

  const submit = async () => {
    setProblem(null);
    if (reason.trim().length < 3) {
      setReasonError('Please explain why the sale is cancelled.');
      return;
    }
    try {
      await cancel.mutateAsync({ id: sale.id, reason: reason.trim() });
      toast.success('Sale cancelled', { description: `${sale.code}: the goods are back in the stock.` });
      onClose();
    } catch (error) {
      setProblem(toApiError(error).message);
    }
  };

  return (
    <div className="space-y-5">
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>The goods go back into the stock of {sale.location.name}.</li>
        <li>
          {hasPayments
            ? 'The payments recorded for this sale stop counting. If money was already taken, it must be given back to the customer outside this system.'
            : 'No payment was recorded, so there is no money to return.'}
        </li>
        <li>The sale stays in the list as "cancelled", with your reason.</li>
      </ul>

      {problem && <FormAlert title="The sale was not cancelled" message={problem} />}

      <TextAreaField
        label="Why is it cancelled?"
        required
        rows={2}
        value={reason}
        maxLength={200}
        onChange={(event) => {
          setReason(event.target.value);
          setReasonError(null);
        }}
        placeholder="For example: customer changed their mind"
        error={reasonError ?? undefined}
      />

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={cancel.isPending}>
          Keep the sale
        </Button>
        <Button variant="danger" loading={cancel.isPending} onClick={() => void submit()}>
          Cancel the sale
        </Button>
      </div>
    </div>
  );
}
