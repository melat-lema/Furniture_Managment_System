import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../components/FormAlert';
import { TextField } from '../components/form/Fields';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import QueryError from '../components/ui/QueryError';
import { useCategories, useDeleteCategory, useSaveCategory } from '../features/categories/useCategories';
import { handleFormError, type FormFailure } from '../lib/form-errors';
import type { CategoryRecord } from '../types/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name (at least 2 characters).').max(60, 'That name is too long.'),
});
type Values = z.infer<typeof schema>;

export default function CategoriesPage() {
  const { data, isPending, error, refetch } = useCategories();
  const remove = useDeleteCategory();

  const [editing, setEditing] = useState<CategoryRecord | null | 'new'>(null);
  const [deleting, setDeleting] = useState<CategoryRecord | null>(null);

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHeader
        title="Categories"
        description="Group your furniture, for example Sofas, Beds, Dining sets."
        actions={
          <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setEditing('new')}>
            Add category
          </Button>
        }
      />

      {isPending ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : error || !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          text="Add a few before you add products."
          action={<Button onClick={() => setEditing('new')}>Add category</Button>}
        />
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
          {data.map((category) => (
            <li key={category.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-medium text-zinc-100">{category.name}</p>
                <p className="text-xs text-zinc-500">
                  {category.productCount} product{category.productCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setEditing(category)}>
                  Rename
                </Button>
                <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setDeleting(category)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a category' : 'Rename category'}
        size="sm"
      >
        <CategoryForm category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this category?"
        message={`"${deleting?.name ?? ''}" will be removed. A category that still has products cannot be deleted: move them to another category first.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          if (!deleting) return;
          await remove.mutateAsync(deleting.id);
          toast.success('Category deleted', { description: deleting.name });
        }}
      />
    </div>
  );
}

function CategoryForm({ category, onClose }: { category: CategoryRecord | null; onClose: () => void }) {
  const save = useSaveCategory();
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: category?.name ?? '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync({ id: category?.id, name: values.name });
      toast.success(category ? 'Category renamed' : 'Category added', { description: values.name });
      onClose();
    } catch (error) {
      setFailure(handleFormError(error, setError, ['name']));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}
      <TextField label="Name" required autoFocus placeholder="For example Sofas" error={errors.name?.message} {...register('name')} />
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {category ? 'Save' : 'Add category'}
        </Button>
      </div>
    </form>
  );
}
