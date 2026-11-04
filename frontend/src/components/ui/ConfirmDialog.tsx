import { useState } from 'react';
import Button from './Button';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
}

/**
 * Asks "are you sure?". If the action fails, the global error handling shows the toast
 * and the dialog simply closes.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  tone = 'primary',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      /* the error has already been shown as a toast */
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm leading-relaxed text-zinc-400">{message}</p>
      <div className="mt-8 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={() => void handleConfirm()}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
