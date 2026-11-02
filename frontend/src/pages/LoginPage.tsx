import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  ReceiptText,
  ShieldCheck,
  TriangleAlert,
  Truck,
  Warehouse,
} from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import AuthField from '../components/AuthField';
import BrandLogo from '../components/BrandLogo';
import FormAlert from '../components/FormAlert';
import { useAuth } from '../features/auth/useAuth';
import { toApiError, type ApiError } from '../lib/errors';
import { notifyError } from '../lib/notify';
import { ROLE_LABELS } from '../types/auth';

// ------------------------------------------------------------------ validation (runs in the browser first)
const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
type LoginValues = z.infer<typeof loginSchema>;

// ------------------------------------------------------------------ turning server errors into words
interface AlertState {
  id: number;
  title: string;
  message: string;
  tone: 'error' | 'warning';
}

function describeLoginError(error: ApiError): Omit<AlertState, 'id'> {
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return {
        title: 'Incorrect email or password',
        message: 'Check your details and try again. Passwords are case-sensitive.',
        tone: 'error',
      };
    case 'ACCOUNT_LOCKED':
      return { title: 'Account temporarily locked', message: error.message, tone: 'warning' };
    case 'ACCOUNT_DISABLED':
    case 'LOCATION_DISABLED':
      return { title: 'Access disabled', message: error.message, tone: 'warning' };
    case 'RATE_LIMITED':
      return {
        title: 'Too many attempts',
        message: 'Please wait a minute before trying again.',
        tone: 'warning',
      };
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
    case 'SERVER_UNAVAILABLE':
      return { title: 'Cannot reach the server', message: error.message, tone: 'error' };
    case 'VALIDATION_ERROR':
      return { title: 'Please check your details', message: error.message, tone: 'error' };
    default: {
      const reference = error.requestId ? ` (Ref: ${error.requestId.slice(0, 8)})` : '';
      return {
        title: error.isServer ? 'Server problem' : 'Sign-in failed',
        message: `${error.message}${reference}`,
        tone: 'error',
      };
    }
  }
}

const FEATURES = [
  { icon: Warehouse, title: 'Stock you can trust', text: 'Every piece tracked from the workshop to the store and showrooms.' },
  { icon: Truck, title: 'Confirmed transfers', text: 'Send, receive and flag differences the moment goods arrive.' },
  { icon: ReceiptText, title: 'Sales and receipts', text: 'Every sale, salesperson and payment receipt in one place.' },
  { icon: ShieldCheck, title: 'Verified payments', text: 'The owner approves each payment before it counts.' },
];

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-gold-500/10 blur-3xl" />
      <div className="absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-gold-600/10 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(248,175,57,0.09),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]" />
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    try {
      const user = await login(values.email, values.password);
      // GuestOnly moves the user on to the dashboard (or the page they were trying to open).
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}`, {
        description: `Signed in as ${ROLE_LABELS[user.role]}${user.locationName ? ` · ${user.locationName}` : ''}`,
      });
    } catch (caught) {
      const error = toApiError(caught);

      // 1. Problems with a specific field (sent by the server) appear under that field.
      let matchedField = false;
      for (const fieldError of error.fieldErrors) {
        if (fieldError.field === 'email' || fieldError.field === 'password') {
          setError(fieldError.field, { type: 'server', message: fieldError.message });
          matchedField = true;
        }
      }

      // 2. Everything else appears in the alert above the form.
      if (!matchedField) setAlert({ id: Date.now(), ...describeLoginError(error) });

      // 3. Wrong password: clear it and put the cursor back, ready to retype.
      if (error.code === 'INVALID_CREDENTIALS') {
        resetField('password');
        setFocus('password');
      }

      // 4. Connection and server problems also get a toast, because the user cannot fix them by retyping.
      if (error.isNetwork || error.isServer) notifyError(error, 'Sign-in failed');
    }
  });

  const checkCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState('CapsLock'));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <Backdrop />

      <div className="relative mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1.05fr_1fr]">
        {/* ------------------------------------------------ brand panel (desktop) */}
        <section className="hidden flex-col justify-between px-12 py-14 lg:flex">
          <div className="flex animate-fade-up items-center gap-3">
            <span className="h-px w-10 bg-gold-500/60" />
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-400/90">
              Inventory &amp; Sales System
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="relative animate-fade-up [animation-delay:120ms]">
              <div className="absolute inset-0 -z-10 scale-110 rounded-full bg-gold-500/20 blur-3xl" />
              <BrandLogo className="h-64 w-auto animate-float drop-shadow-[0_10px_40px_rgba(248,175,57,0.25)]" />
            </div>
            <h1 className="mt-8 animate-shine bg-[linear-gradient(110deg,#fbd382,#f8af39_40%,#fde7b8_50%,#f8af39_60%,#d9921f)] bg-[length:200%_auto] bg-clip-text font-display text-6xl font-semibold tracking-wide text-transparent">
              Gorgeous Furniture
            </h1>
            <p className="mt-3 max-w-md text-balance text-zinc-400">
              One place to see every piece, every transfer and every payment across the workshop, store and showrooms.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, text }, index) => (
              <li
                key={title}
                style={{ animationDelay: `${240 + index * 90}ms` }}
                className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-semibold text-zinc-100">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ sign-in form */}
        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md animate-fade-up">
            <div className="mb-8 flex flex-col items-center lg:hidden">
              <BrandLogo className="h-28 w-auto" />
              <p className="mt-3 font-display text-3xl font-semibold text-gold-300">Gorgeous Furniture</p>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900/70 p-7 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-9">
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-gold-400/70 to-transparent" />

              <header>
                <h2 className="font-display text-4xl font-semibold text-white">Welcome back</h2>
                <p className="mt-2 text-sm text-zinc-400">Sign in to manage stock, sales and payments.</p>
              </header>

              {alert && (
                <FormAlert
                  key={alert.id}
                  title={alert.title}
                  message={alert.message}
                  tone={alert.tone}
                  className="mt-6 animate-shake"
                />
              )}

              <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
                <AuthField
                  label="Email address"
                  icon={Mail}
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <div>
                  <AuthField
                    label="Password"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    error={errors.password?.message}
                    onKeyUp={checkCapsLock}
                    onKeyDown={checkCapsLock}
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        className="-mr-2 rounded-lg p-2 text-zinc-500 transition hover:text-gold-300"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    }
                    {...register('password')}
                  />
                  {capsLock && (
                    <p role="status" className="mt-2 flex items-center gap-1.5 text-sm text-amber-300">
                      <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                      Caps Lock is on
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-gold-500 via-gold-400 to-gold-500 px-4 py-3.5 text-[15px] font-semibold text-ink-950 shadow-lg shadow-gold-500/20 transition hover:shadow-gold-500/40 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-5 w-5" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
                Accounts are created by the owner. Forgot your password? Ask the owner to reset it.
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-zinc-600">
              © {new Date().getFullYear()} Gorgeous Furniture
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
