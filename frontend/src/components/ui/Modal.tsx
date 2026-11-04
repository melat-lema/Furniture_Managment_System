import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const;

/**
 * Built on the browser's own <dialog>: it traps the keyboard focus, closes with Escape and
 * dims the page for us. The content is only rendered while open, so forms start fresh each time.
 */
export default function Modal({ open, onClose, title, description, size = 'md', children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose(); // click on the dimmed backdrop
      }}
      className={cn(
        'm-auto max-h-[92vh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl border border-white/10 bg-ink-900 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm',
        SIZES[size],
      )}
    >
      {open && (
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-semibold text-white">{title}</h2>
              {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
