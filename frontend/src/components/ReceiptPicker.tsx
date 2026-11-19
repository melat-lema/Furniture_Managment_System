import { CircleAlert, FileText, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { compressImage } from '../lib/image';
import Button from './ui/Button';

const MAX_BYTES = 5 * 1024 * 1024;

interface ReceiptPickerProps {
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Choose or take a photo of the receipt (or pick a PDF). Photos are shrunk before uploading,
 * so a 6 MB phone picture becomes a few hundred KB on a slow connection.
 */
export default function ReceiptPicker({ value, onChange, error, required, disabled }: ReceiptPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value || value.type === 'application/pdf') {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;

    setBusy(true);
    try {
      if (picked.type === 'application/pdf') {
        if (picked.size > MAX_BYTES) throw new Error('That PDF is bigger than 5 MB. Please use a smaller file.');
        onChange(picked);
      } else {
        onChange(await compressImage(picked));
      }
    } catch (caught) {
      toast.error("That receipt can't be used", {
        description: caught instanceof Error ? caught.message : 'Please try another photo or a PDF.',
      });
    } finally {
      setBusy(false);
    }
  };

  const isPdf = value?.type === 'application/pdf';

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-zinc-300">
        Receipt
        {required && <span className="ml-0.5 text-gold-400" aria-hidden="true">*</span>}
      </p>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        aria-label="Choose the receipt photo or PDF"
        onChange={(event) => void onPick(event)}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
          {preview ? (
            <img src={preview} alt="Receipt preview" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-400">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-200">{isPdf ? value.name : 'Photo ready'}</p>
            <p className="text-xs text-zinc-500">{Math.max(1, Math.round(value.size / 1024))} KB</p>
          </div>
          <Button variant="ghost" size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
            Change
          </Button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove the receipt"
            disabled={disabled}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <Button
          variant="secondary"
          disabled={disabled}
          loading={busy}
          icon={<Paperclip className="h-4 w-4" aria-hidden="true" />}
          onClick={() => input.current?.click()}
          className={error ? 'border-red-500/60' : ''}
        >
          Take or choose the receipt
        </Button>
      )}

      {error && (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-red-400">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {!error && <p className="mt-1.5 text-xs text-zinc-500">A photo (JPEG, PNG, WebP) or a PDF, up to 5 MB.</p>}
    </div>
  );
}
