import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import Button from './Button';
import Modal from './Modal';

interface SecretRevealModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  who: string;
  secret: string;
}

/** Shows a temporary password exactly once, with a copy button. */
export default function SecretRevealModal({ open, onClose, title, who, secret }: SecretRevealModalProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy automatically', { description: 'Select the password and copy it by hand.' });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} description={who} size="sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Temporary password</p>
      <div className="flex items-center gap-3 rounded-xl border border-gold-500/30 bg-gold-500/5 p-4">
        <code className="flex-1 select-all break-all font-mono text-lg tracking-wide text-gold-200">{secret}</code>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void copy()}
          icon={copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <div className="mt-5 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          This password is shown <strong>only once</strong>. Give it to the person in a safe way. They should change it
          on the Account page after their first sign-in.
        </p>
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={onClose}>I have saved it</Button>
      </div>
    </Modal>
  );
}
