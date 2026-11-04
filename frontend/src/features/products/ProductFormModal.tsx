import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Armchair, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../../components/FormAlert';
import { SelectField, TextAreaField, TextField, ToggleField } from '../../components/form/Fields';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { handleFormError, type FormFailure } from '../../lib/form-errors';
import { compressImage } from '../../lib/image';
import { notifyError } from '../../lib/notify';
import type { ProductRecord } from '../../types/api';
import { useCategories } from '../categories/useCategories';
import { removeProductImage, uploadProductImage, useSaveProduct } from './useProducts';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the product name.').max(120, 'That name is too long.'),
  sku: z
    .string()
    .trim()
    .min(2, 'Enter a product code (SKU).')
    .max(40, 'That code is too long.')
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Use letters, numbers, dots, dashes or underscores.'),
  categoryId: z.string().min(1, 'Choose a category.'),
  price: z
    .string()
    .trim()
    .min(1, 'Enter a price.')
    .regex(/^\d{1,9}(\.\d{1,2})?$/, 'Enter an amount like 12500 or 12500.50.'),
  material: z.string().trim().max(100, 'That is too long.'),
  dimensions: z.string().trim().max(100, 'That is too long.'),
  description: z.string().trim().max(2000, 'The description is too long (2000 characters at most).'),
  isPublished: z.boolean(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;
const FIELDS = ['name', 'sku', 'categoryId', 'price', 'material', 'dimensions', 'description', 'isPublished', 'isActive'] as const;

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null = create a new product */
  product: ProductRecord | null;
}

export default function ProductFormModal({ open, onClose, product }: ProductFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="lg" title={product ? 'Edit product' : 'Add a product'} description={product?.sku}>
      <ProductForm product={product} onClose={onClose} />
    </Modal>
  );
}

function ProductForm({ product, onClose }: { product: ProductRecord | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const save = useSaveProduct();
  const { data: categories = [], isPending: loadingCategories } = useCategories();
  const [failure, setFailure] = useState<FormFailure | null>(null);

  // ---- photo state
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shownImage = preview ?? (removeExisting ? null : (product?.imageUrl ?? null));

  const onPickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = ''; // lets the same file be chosen again later
    if (!picked) return;

    setProcessing(true);
    try {
      const compressed = await compressImage(picked);
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));
      setRemoveExisting(false);
    } catch (error) {
      toast.error("That photo can't be used", {
        description: error instanceof Error ? error.message : 'Please try another photo.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const clearPhoto = () => {
    setFile(null);
    setPreview(null);
    if (product?.imageUrl) setRemoveExisting(true);
  };

  // ---- form
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      categoryId: product?.categoryId ?? '',
      price: product ? String(Number(product.price)) : '',
      material: product?.material ?? '',
      dimensions: product?.dimensions ?? '',
      description: product?.description ?? '',
      isPublished: product?.isPublished ?? false,
      isActive: product?.isActive ?? true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);

    // Step 1: save the product details.
    let saved: ProductRecord;
    try {
      saved = await save.mutateAsync({
        id: product?.id,
        name: values.name,
        sku: values.sku,
        categoryId: values.categoryId,
        price: Number(values.price),
        material: values.material || null,
        dimensions: values.dimensions || null,
        description: values.description || null,
        isPublished: values.isPublished,
        isActive: values.isActive,
      });
    } catch (error) {
      setFailure(handleFormError(error, setError, FIELDS));
      return;
    }

    // Step 2: the photo. If this part fails the product is still saved, and we say so clearly.
    if (file || (removeExisting && product?.imagePath)) {
      setUploading(true);
      try {
        if (file) await uploadProductImage(saved.id, file);
        else await removeProductImage(saved.id);
        await queryClient.invalidateQueries({ queryKey: ['products'] });
      } catch (error) {
        notifyError(error, 'The photo could not be saved');
        toast.warning('Product saved, but the photo was not', {
          description: 'Open the product again and retry the photo.',
        });
        setUploading(false);
        onClose();
        return;
      }
      setUploading(false);
    }

    toast.success(product ? 'Product updated' : 'Product added', { description: values.name });
    onClose();
  });

  const busy = save.isPending || uploading;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

      <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
        {/* ---------------- photo */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-zinc-300">Photo</p>
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-black/30">
            {shownImage ? (
              <img src={shownImage} alt="Product preview" className="h-full w-full object-cover" />
            ) : (
              <Armchair className="h-12 w-12 text-zinc-700" aria-hidden="true" />
            )}
            {processing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <LoaderCircle className="h-6 w-6 animate-spin text-gold-300" aria-label="Preparing photo" />
              </div>
            )}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void onPickPhoto(event)}
            aria-label="Choose a product photo"
          />
          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={processing || busy}
              icon={<ImagePlus className="h-4 w-4" aria-hidden="true" />}
              onClick={() => fileInput.current?.click()}
            >
              {shownImage ? 'Replace' : 'Add photo'}
            </Button>
            {shownImage && (
              <Button variant="ghost" size="sm" disabled={busy} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} onClick={clearPhoto}>
                Remove
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500">JPEG, PNG or WebP. Large photos are shrunk automatically before uploading.</p>
        </div>

        {/* ---------------- details */}
        <div className="space-y-5">
          <TextField label="Name" required placeholder="Royal 3-seater sofa" error={errors.name?.message} {...register('name')} />

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Code (SKU)"
              required
              placeholder="SOFA-001"
              autoCapitalize="characters"
              spellCheck={false}
              hint="Must be unique."
              error={errors.sku?.message}
              {...register('sku')}
            />
            <SelectField
              label="Category"
              required
              disabled={loadingCategories}
              error={errors.categoryId?.message}
              hint={!loadingCategories && categories.length === 0 ? 'Add a category first on the Categories page.' : undefined}
              {...register('categoryId')}
            >
              <option value="">{loadingCategories ? 'Loading…' : 'Choose a category'}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Price (ETB)" required inputMode="decimal" placeholder="12500" error={errors.price?.message} {...register('price')} />
            <TextField label="Material" placeholder="Oak, leather…" error={errors.material?.message} {...register('material')} />
          </div>

          <TextField label="Dimensions" placeholder="220 × 95 × 85 cm" error={errors.dimensions?.message} {...register('dimensions')} />
          <TextAreaField label="Description" rows={3} error={errors.description?.message} {...register('description')} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField label="Show on the website" hint="Visitors can see it in the public catalog." {...register('isPublished')} />
        <ToggleField label="Active" hint="Turn off to hide it from staff without deleting it." {...register('isActive')} />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={processing}>
          {uploading ? 'Uploading photo…' : product ? 'Save changes' : 'Add product'}
        </Button>
      </div>
    </form>
  );
}
