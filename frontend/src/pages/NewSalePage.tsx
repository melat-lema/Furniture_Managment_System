import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, PackageOpen, Plus, Trash2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../components/FormAlert';
import ProductPicker from '../components/ProductPicker';
import ReceiptPicker from '../components/ReceiptPicker';
import { SelectField, TextField, ToggleField } from '../components/form/Fields';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import { useAuth } from '../features/auth/useAuth';
import { METHOD_LABEL } from '../features/sales/PaymentBadges';
import { useAddPayment, useCreateSale } from '../features/sales/useSales';
import { useSalespeople } from '../features/salespeople/useSalespeople';
import { toApiError } from '../lib/errors';
import { handleFormError, type FormFailure } from '../lib/form-errors';
import { formatMoney } from '../lib/format';
import type { PaymentMethod } from '../types/api';

const METHODS = ['CASH', 'BANK_TRANSFER', 'TELEBIRR', 'CBE_BIRR', 'OTHER'] as const satisfies readonly PaymentMethod[];
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const PHONE = /^[+\d][\d\s-]{5,19}$/;

const optionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  imageUrl: z.string().nullable(),
  available: z.number().optional(),
  price: z.string().optional(),
});

interface Line {
  product: { price?: string } | null;
  quantity: string;
}
const num = (value: string): number => (value.trim() === '' ? 0 : Number(value));
const subtotalOf = (items: Line[]): number =>
  items.reduce((sum, line) => sum + (line.product?.price ? Number(line.product.price) : 0) * (Number(line.quantity) || 0), 0);

const schema = z
  .object({
    salespersonId: z.string().min(1, 'Choose who made the sale.'),
    customerName: z.string().trim().max(100, 'The customer name is too long.'),
    customerPhone: z.string().trim().refine((value) => value === '' || PHONE.test(value), 'Enter a valid phone number, for example +251 911 000000.'),
    items: z
      .array(
        z
          .object({
            product: optionSchema.nullable().refine((product) => product !== null, 'Choose a product.'),
            quantity: z.string().trim().regex(/^[1-9]\d{0,4}$/, 'Enter a whole number of 1 or more.'),
          })
          .refine(
            (line) => !line.product || line.product.available === undefined || !/^\d+$/.test(line.quantity) || Number(line.quantity) <= line.product.available,
            { message: 'You do not have that many in stock.', path: ['quantity'] },
          ),
      )
      .min(1, 'Add at least one product.')
      .refine(
        (items) => {
          const ids = items.flatMap((line) => (line.product ? [line.product.id] : []));
          return new Set(ids).size === ids.length;
        },
        'Each product can only appear once. Combine the quantities into one line.',
      ),
    discount: z.string().trim().refine((value) => value === '' || MONEY.test(value), 'Enter an amount like 500 or 500.50.'),
    discountReason: z.string().trim().max(200, 'The reason is too long (200 characters at most).'),
    payNow: z.boolean(),
    payAmount: z.string().trim(),
    payMethod: z.enum(METHODS),
    payReference: z.string().trim().max(60, 'The reference is too long (60 characters at most).'),
  })
  .refine((v) => num(v.discount) === 0 || v.discountReason.length >= 3, {
    message: 'Please give a reason for the discount.',
    path: ['discountReason'],
  })
  .refine((v) => num(v.discount) === 0 || num(v.discount) < subtotalOf(v.items), {
    message: 'The discount must be less than the total price.',
    path: ['discount'],
  })
  .refine(
    (v) => !v.payNow || (MONEY.test(v.payAmount) && Number(v.payAmount) > 0 && Number(v.payAmount) <= subtotalOf(v.items) - num(v.discount) + 0.001),
    { message: 'Enter the amount received. It cannot be more than the total.', path: ['payAmount'] },
  )
  .refine((v) => !v.payNow || v.payMethod === 'CASH' || v.payReference !== '', {
    message: 'Enter the transaction or reference number.',
    path: ['payReference'],
  });
type Values = z.input<typeof schema>;

export default function NewSalePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: salespeople, isPending: loadingPeople } = useSalespeople();
  const createSale = useCreateSale();
  const addPayment = useAddPayment();

  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const amountEdited = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      salespersonId: '',
      customerName: '',
      customerPhone: '',
      items: [{ product: null, quantity: '' }],
      discount: '',
      discountReason: '',
      payNow: true,
      payAmount: '',
      payMethod: 'CASH',
      payReference: '',
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const items = useWatch({ control, name: 'items' });
  const discountText = useWatch({ control, name: 'discount' });
  const payNow = useWatch({ control, name: 'payNow' });
  const payMethod = useWatch({ control, name: 'payMethod' });

  const subtotal = subtotalOf(items);
  const discount = Number.isFinite(num(discountText)) ? num(discountText) : 0;
  const total = Math.max(0, subtotal - discount);
  const needsReceipt = payNow && payMethod !== 'CASH';

  // Start the "amount received" at the total, until the person types their own number.
  useEffect(() => {
    if (payNow && !amountEdited.current) setValue('payAmount', total > 0 ? String(Math.round(total * 100) / 100) : '');
  }, [payNow, total, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    setReceiptError(null);
    if (values.payNow && values.payMethod !== 'CASH' && !receipt) {
      setReceiptError('Upload the receipt (a photo or a PDF) for this payment.');
      return;
    }

    const lines = values.items.flatMap((line) => (line.product ? [{ productId: line.product.id, quantity: Number(line.quantity) }] : []));
    const discountAmount = num(values.discount);

    // Step 1: the sale (this is what takes the goods out of the stock).
    let saleId: string;
    let saleCode: string;
    try {
      const sale = await createSale.mutateAsync({
        salespersonId: values.salespersonId,
        customerName: values.customerName || null,
        customerPhone: values.customerPhone || null,
        items: lines,
        ...(discountAmount > 0 && { discount: discountAmount }),
        discountReason: discountAmount > 0 ? values.discountReason : null,
      });
      saleId = sale.id;
      saleCode = sale.code;
    } catch (error) {
      setFailure(handleFormError(error, setError, ['salespersonId', 'customerName', 'customerPhone', 'items', 'discount', 'discountReason']));
      return;
    }

    // Step 2: the payment. If this fails the sale is still saved, and the person can add the payment from the sale page.
    if (values.payNow) {
      try {
        await addPayment.mutateAsync({
          saleId,
          amount: Number(values.payAmount),
          method: values.payMethod,
          referenceNo: values.payReference || null,
          receipt: values.payMethod === 'CASH' ? null : receipt,
        });
      } catch (error) {
        toast.warning('Sale saved, but the payment was not recorded', {
          description: `${toApiError(error).message} You can add the payment from the sale page.`,
        });
        navigate(`/sales/${saleId}`);
        return;
      }
    }

    toast.success('Sale recorded', { description: saleCode });
    navigate(`/sales/${saleId}`);
  });

  if (!user?.locationId) {
    return <EmptyState icon={PackageOpen} title="Only showrooms record sales" text="Sign in with a showroom account to record a sale." />;
  }

  if (!loadingPeople && salespeople && salespeople.length === 0) {
    return (
      <EmptyState
        icon={UserRound}
        title="Add your salespeople first"
        text="Every sale records who made it. Add the people who sell in your showroom, then come back."
        action={
          <Link to="/salespeople">
            <Button>Add salespeople</Button>
          </Link>
        }
      />
    );
  }

  const busy = createSale.isPending || addPayment.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-up">
      <div>
        <Link to="/sales" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-gold-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All sales
        </Link>
        <PageHeader title="New sale" description={`The goods are taken from the stock of ${user.locationName ?? 'your showroom'}.`} />
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-8">
        {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

        {/* ------------------------------------------------ who and for whom */}
        <section className="space-y-5 rounded-2xl border border-white/10 bg-ink-900 p-6 sm:p-8">
          <SelectField label="Sold by" required error={errors.salespersonId?.message} {...register('salespersonId')}>
            <option value="">{loadingPeople ? 'Loading…' : 'Choose who made the sale'}</option>
            {(salespeople ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </SelectField>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Customer name (optional)" error={errors.customerName?.message} {...register('customerName')} />
            <TextField label="Customer phone (optional)" type="tel" placeholder="+251 911 000000" error={errors.customerPhone?.message} {...register('customerPhone')} />
          </div>
        </section>

        {/* ------------------------------------------------ what was sold */}
        <section className="space-y-4 rounded-2xl border border-white/10 bg-ink-900 p-6 sm:p-8">
          <h2 className="text-sm font-semibold text-zinc-200">What was sold?</h2>

          {fields.map((field, index) => {
            const line = items[index];
            const unit = line?.product?.price ? Number(line.product.price) : 0;
            const lineTotal = unit * (Number(line?.quantity) || 0);
            return (
              <div key={field.id} className="grid gap-3 rounded-xl border border-white/5 bg-black/20 p-4 sm:grid-cols-[1fr_7rem_auto] sm:items-start">
                <Controller
                  control={control}
                  name={`items.${index}.product`}
                  render={({ field: productField }) => (
                    <ProductPicker
                      label={index === 0 ? 'Product (only what is in your stock)' : undefined}
                      value={productField.value}
                      onChange={productField.onChange}
                      stockLocationId={user.locationId ?? undefined}
                      error={errors.items?.[index]?.product?.message}
                    />
                  )}
                />
                <TextField
                  label={index === 0 ? 'How many?' : ''}
                  inputMode="numeric"
                  placeholder="1"
                  aria-label="Quantity"
                  error={errors.items?.[index]?.quantity?.message}
                  {...register(`items.${index}.quantity`)}
                />
                <div className={index === 0 ? 'sm:pt-7' : ''}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                    icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    aria-label="Remove this line"
                  >
                    <span className="sm:sr-only">Remove</span>
                  </Button>
                </div>
                {unit > 0 && (
                  <p className="text-xs text-zinc-500 sm:col-span-3">
                    {formatMoney(unit)} each{lineTotal > 0 && <span className="text-zinc-300"> · {formatMoney(lineTotal)}</span>}
                  </p>
                )}
              </div>
            );
          })}

          {errors.items?.message && <p role="alert" className="text-sm text-red-400">{errors.items.message}</p>}
          {errors.items?.root?.message && <p role="alert" className="text-sm text-red-400">{errors.items.root.message}</p>}

          <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => append({ product: null, quantity: '' })} disabled={fields.length >= 50}>
            Add another product
          </Button>

          {/* ---- discount and totals */}
          <div className="grid gap-5 border-t border-white/5 pt-5 sm:grid-cols-2">
            <TextField label="Discount in ETB (optional)" inputMode="decimal" placeholder="0" error={errors.discount?.message} {...register('discount')} />
            {discount > 0 && (
              <TextField label="Reason for the discount" required placeholder="For example: regular customer" error={errors.discountReason?.message} {...register('discountReason')} />
            )}
          </div>

          <dl className="space-y-2 rounded-xl bg-black/30 p-4 text-sm">
            <div className="flex justify-between text-zinc-400">
              <dt>Subtotal</dt>
              <dd>{formatMoney(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-zinc-400">
                <dt>Discount</dt>
                <dd>- {formatMoney(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold text-gold-300">
              <dt>Total</dt>
              <dd>{formatMoney(total)}</dd>
            </div>
          </dl>
        </section>

        {/* ------------------------------------------------ payment */}
        <section className="space-y-5 rounded-2xl border border-white/10 bg-ink-900 p-6 sm:p-8">
          <ToggleField label="The customer is paying now" hint="Turn off to save the sale as unpaid and add the payment later." {...register('payNow')} />

          {payNow && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Amount received (ETB)"
                  required
                  inputMode="decimal"
                  error={errors.payAmount?.message}
                  {...register('payAmount', { onChange: () => (amountEdited.current = true) })}
                />
                <SelectField label="How did they pay?" required error={errors.payMethod?.message} {...register('payMethod')}>
                  {METHODS.map((value) => (
                    <option key={value} value={value}>
                      {METHOD_LABEL[value]}
                    </option>
                  ))}
                </SelectField>
              </div>

              {needsReceipt && (
                <>
                  <TextField
                    label="Transaction or reference number"
                    required
                    placeholder="From the receipt or the bank message"
                    error={errors.payReference?.message}
                    {...register('payReference')}
                  />
                  <div className="space-y-1.5">
                    <label htmlFor="sale-payment-receipt" className="block text-sm font-medium text-zinc-300">
                      Payment receipt <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="sale-payment-receipt"
                      type="file"
                      accept="image/*,.pdf"
                      disabled={busy}
                      onChange={(event) => {
                        setReceipt(event.target.files?.[0] ?? null);
                        if (event.target.files?.[0]) setReceiptError(null);
                      }}
                      className="block w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink-950"
                    />
                    {receiptError && <p role="alert" className="text-sm text-red-400">{receiptError}</p>}
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <div className="flex justify-end gap-3">
          <Link to="/sales">
            <Button variant="ghost" disabled={busy}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" loading={busy}>
            Record sale
          </Button>
        </div>
      </form>
    </div>
  );
}
