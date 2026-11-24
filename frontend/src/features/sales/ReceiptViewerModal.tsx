import Modal from '../../components/ui/Modal';
import ReceiptPreview from './ReceiptPreview';

interface ReceiptViewerModalProps {
  open: boolean;
  onClose: () => void;
  paymentId: string | null;
  title: string;
}

export default function ReceiptViewerModal({ open, onClose, paymentId, title }: ReceiptViewerModalProps) {
  return (
    <Modal open={open && paymentId !== null} onClose={onClose} size="lg" title="Receipt" description={title}>
      {paymentId && <ReceiptPreview paymentId={paymentId} tall />}
    </Modal>
  );
}
