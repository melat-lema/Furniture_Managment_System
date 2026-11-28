import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MapPin, MessageCircle, Navigation, Phone, SendHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSite } from '../../hooks/useSite';
import { publicApi } from '../../lib/api';
import { openProduct } from '../../lib/bus';
import { site } from '../../lib/config';
import { formatPrice, mapsHref, telHref } from '../../lib/format';
import type { ChatAction, ProductCard, Showroom } from '../../lib/types';
import Crown from '../ui/Crown';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  products?: ProductCard[];
  showrooms?: Showroom[];
  actions?: ChatAction[];
}

const STORAGE_KEY = 'gf-chat-v1';
const TEASER_KEY = 'gf-chat-teaser';
const uid = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function loadMessages(): Message[] {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Message[]) : [];
  } catch {
    return [];
  }
}

function TypingDots() {
  return (
    <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md bg-ink-700 px-4 py-3.5" role="status" aria-label="The assistant is typing">
      {[0, 1, 2].map((dot) => (
        <motion.span
          key={dot}
          className="h-2 w-2 rounded-full bg-gold-300"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.15 }}
        />
      ))}
    </div>
  );
}

function ActionLink({ action }: { action: ChatAction }) {
  const Icon = action.type === 'call' ? Phone : MessageCircle;
  const external = action.type !== 'call';
  return (
    <a
      href={action.href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 px-4 py-2 text-sm font-semibold text-gold-200 transition hover:bg-gold-400 hover:text-ink-950"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {action.label}
    </a>
  );
}

function Bubble({ message }: { message: Message }) {
  const mine = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col gap-2.5 ${mine ? 'items-end' : 'items-start'}`}
    >
      <p
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
          mine ? 'rounded-br-md bg-linear-to-br from-gold-300 to-gold-500 font-medium text-ink-950' : 'rounded-bl-md bg-ink-700 text-zinc-100'
        }`}
      >
        {message.text}
      </p>

      {message.products && message.products.length > 0 && (
        <ul className="thin-scroll -mx-1 flex w-full snap-x gap-3 overflow-x-auto px-1 pb-2">
          {message.products.map((product) => (
            <li key={product.id} className="w-40 shrink-0 snap-start">
              <button
                type="button"
                onClick={() => openProduct(product)}
                className="group block w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-800 text-left transition hover:border-gold-400/50"
              >
                <div className="aspect-square bg-ink-900">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[radial-gradient(70%_60%_at_50%_40%,rgb(201_154_46/0.2),transparent)]">
                      <Crown className="h-8 w-8 text-gold-500/60" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{product.name}</p>
                  {formatPrice(product.price) && <p className="mt-1 text-xs font-semibold text-gold-300">{formatPrice(product.price)}</p>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {message.showrooms && message.showrooms.length > 0 && (
        <ul className="w-full space-y-2.5">
          {message.showrooms.map((room) => (
            <li key={room.id} className="rounded-2xl border border-white/10 bg-ink-800 p-4">
              <p className="flex items-center gap-2 font-semibold text-white">
                <MapPin className="h-4 w-4 text-gold-300" aria-hidden="true" />
                {room.name}
              </p>
              {room.address && <p className="mt-1 text-sm text-zinc-400">{room.address}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={mapsHref(`${room.name} ${room.address ?? ''} ${site.city}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-3.5 py-1.5 text-xs font-bold text-ink-950"
                >
                  <Navigation className="h-3.5 w-3.5" aria-hidden="true" /> Directions
                </a>
                {room.phone && (
                  <a href={telHref(room.phone)} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-zinc-200">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {room.phone}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {message.actions && message.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.actions.map((action) => (
            <ActionLink key={action.label} action={action} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function ChatWidget() {
  const reduce = useReducedMotion();
  const { data, phone, whatsapp } = useSite();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const starters = [
    ...data.categories.slice(0, 2).map((category) => `Show me ${category.name.toLowerCase()}`),
    'Where are your showrooms?',
    'How can I pay?',
  ].slice(0, 4);

  // keep the conversation for this visit only
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      /* private mode: the chat still works, it just is not remembered */
    }
  }, [messages]);

  // the opening message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: uid(),
          role: 'bot',
          text: 'Hello! I am the Gorgeous Furniture assistant. I can show you our pieces, tell you about prices and payment, or help you find a showroom. What are you looking for?',
        },
      ]);
    }
  }, [messages.length]);

  // a small hello bubble, once per visit
  useEffect(() => {
    if (sessionStorage.getItem(TEASER_KEY)) return;
    const timer = setTimeout(() => setTeaser(true), 7000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [messages, busy, reduce]);

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setInput('');
      setSuggestions([]);
      setMessages((previous) => [...previous, { id: uid(), role: 'user', text }]);

      try {
        // a short pause makes the answer feel natural
        const [reply] = await Promise.all([publicApi.chat(text), wait(600)]);
        setMessages((previous) => [
          ...previous,
          { id: uid(), role: 'bot', text: reply.reply, products: reply.products, showrooms: reply.showrooms, actions: reply.actions },
        ]);
        setSuggestions(reply.suggestions);
      } catch {
        const actions: ChatAction[] = [];
        if (phone) actions.push({ type: 'call', label: 'Call us', href: telHref(phone) });
        if (whatsapp) actions.push({ type: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/${whatsapp}` });
        setMessages((previous) => [
          ...previous,
          { id: uid(), role: 'bot', text: 'Sorry, I could not reach our system just now. Please try again in a moment, or contact our team directly.', actions },
        ]);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [phone, whatsapp],
  );

  // other parts of the page can open the chat with a question ready
  useEffect(() => {
    const onOpen = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      setOpen(true);
      setTeaser(false);
      if (message) void send(message);
    };
    window.addEventListener('gf:chat', onOpen);
    return () => window.removeEventListener('gf:chat', onOpen);
  }, [send]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  const dismissTeaser = () => {
    setTeaser(false);
    try {
      sessionStorage.setItem(TEASER_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const chips = suggestions.length > 0 ? suggestions : messages.length <= 1 ? starters : [];

  return (
    <>
      {/* ------------------------------------------------------------ the little hello bubble */}
      <AnimatePresence>
        {teaser && !open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-24 right-5 z-50 max-w-[15rem] rounded-2xl rounded-br-md border border-gold-500/30 bg-ink-800 p-4 pr-9 text-sm text-zinc-200 shadow-2xl sm:right-6"
          >
            <button type="button" onClick={dismissTeaser} aria-label="Dismiss" className="absolute right-2 top-2 rounded-full p-1.5 text-zinc-500 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="text-left"
              onClick={() => {
                dismissTeaser();
                setOpen(true);
              }}
            >
              Need help choosing? <span className="text-gold-300">Ask me anything.</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------ the button */}
      <motion.button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          dismissTeaser();
        }}
        aria-label={open ? 'Close the chat' : 'Open the chat assistant'}
        aria-expanded={open}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.6, type: 'spring', stiffness: 260, damping: 18 }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.94 }}
        className={`fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-gold-300 to-gold-500 text-ink-950 shadow-[0_10px_40px_-6px_rgb(226_176_74/0.7)] sm:right-6 ${open ? 'max-sm:hidden' : ''}`}
      >
        {!open && <span aria-hidden="true" className="absolute inset-0 animate-pulse-ring rounded-full bg-gold-400/60" />}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={open ? 'x' : 'chat'} initial={{ rotate: -80, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 80, opacity: 0 }} transition={{ duration: 0.2 }} className="relative">
            {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* ------------------------------------------------------------ the conversation */}
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Chat with the Gorgeous Furniture assistant"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'bottom right' }}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden border border-white/10 bg-ink-900 shadow-2xl sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[36rem] sm:max-h-[calc(100svh-8rem)] sm:w-[24rem] sm:rounded-[1.75rem]"
          >
            <header className="flex items-center gap-3 border-b border-white/10 bg-linear-to-r from-ink-800 to-ink-850 px-5 py-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-gold-300 to-gold-500 text-ink-950">
                <Crown className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-semibold leading-tight text-white">Gorgeous Assistant</p>
                <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  Here to help
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close the chat" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={list} role="log" aria-live="polite" className="thin-scroll flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {messages.map((message) => (
                <Bubble key={message.id} message={message} />
              ))}
              {busy && <TypingDots />}
              {chips.length > 0 && !busy && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {chips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => void send(chip)}
                      className="rounded-full border border-gold-400/30 px-3.5 py-2 text-[13px] font-medium text-gold-200 transition hover:border-gold-400 hover:bg-gold-400/10"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-white/10 bg-ink-850 p-3">
              <input
                ref={field}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={500}
                placeholder="Ask about a piece, price or showroom…"
                aria-label="Your message"
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-ink-900 px-5 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-gold-400/60 sm:text-sm"
              />
              <button
                type="submit"
                disabled={busy || input.trim() === ''}
                aria-label="Send"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-gold-300 to-gold-500 text-ink-950 transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
              >
                <SendHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
