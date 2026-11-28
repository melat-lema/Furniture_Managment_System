import { Clock, Mail, MessageCircle, Phone, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, LinkButton } from '../components/ui/Button';
import Reveal from '../components/ui/Reveal';
import SectionHeading from '../components/ui/SectionHeading';
import { useSite } from '../hooks/useSite';
import { site } from '../lib/config';
import { telHref } from '../lib/format';

const PHONE_PATTERN = /^[+\d][\d\s-]{6,19}$/;

interface Errors {
  name?: string;
  phone?: string;
}

export default function Contact() {
  const { data, phone, whatsapp, hours } = useSite();
  const [name, setName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [interest, setInterest] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  const canSend = Boolean(whatsapp || site.email);
  const options = [...data.categories.map((category) => category.name), 'Something custom', 'Not sure yet'];

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (name.trim().length < 2) next.name = 'Please tell us your name.';
    if (!PHONE_PATTERN.test(contactPhone.trim())) next.phone = 'Please enter a phone number we can call, for example +251 911 000000.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const text = [
      `Hello Gorgeous Furniture, my name is ${name.trim()}.`,
      interest ? `I am interested in: ${interest}.` : '',
      message.trim(),
      `Please call me on ${contactPhone.trim()}.`,
    ]
      .filter(Boolean)
      .join('\n');

    // the message opens in the person's own WhatsApp (or email app); nothing is stored on a server
    const url = whatsapp
      ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`
      : `mailto:${site.email}?subject=${encodeURIComponent('Enquiry from the website')}&body=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setSent(true);
  };

  const field =
    'w-full rounded-2xl border bg-ink-900 px-5 py-3.5 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-gold-400/70 focus:ring-4 focus:ring-gold-400/10 sm:text-sm';

  return (
    <section id="contact" className="relative overflow-hidden bg-ink-950 py-28 sm:py-36">
      <div aria-hidden="true" className="absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-gold-500/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl gap-16 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
        <div>
          <SectionHeading
            eyebrow="Contact"
            title={
              <>
                Let us furnish <span className="text-gold-gradient italic">your space.</span>
              </>
            }
            text="Tell us what you are looking for and our team will get back to you. Prefer to talk? Call or visit us."
          />

          <ul className="mt-12 space-y-5 text-zinc-300">
            {phone && (
              <li>
                <Reveal from="left" y={20}>
                  <a href={telHref(phone)} className="group flex items-center gap-4 transition hover:text-gold-300">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 text-gold-300 transition group-hover:border-gold-400/50">
                      <Phone className="h-5 w-5" aria-hidden="true" />
                    </span>
                    {phone}
                  </a>
                </Reveal>
              </li>
            )}
            {whatsapp && (
              <li>
                <Reveal from="left" y={20} delay={0.06}>
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 transition hover:text-gold-300">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 text-gold-300 transition group-hover:border-gold-400/50">
                      <MessageCircle className="h-5 w-5" aria-hidden="true" />
                    </span>
                    Chat on WhatsApp
                  </a>
                </Reveal>
              </li>
            )}
            {site.email && (
              <li>
                <Reveal from="left" y={20} delay={0.12}>
                  <a href={`mailto:${site.email}`} className="group flex items-center gap-4 transition hover:text-gold-300">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 text-gold-300 transition group-hover:border-gold-400/50">
                      <Mail className="h-5 w-5" aria-hidden="true" />
                    </span>
                    {site.email}
                  </a>
                </Reveal>
              </li>
            )}
            {hours && (
              <li>
                <Reveal from="left" y={20} delay={0.18}>
                  <p className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 text-gold-300">
                      <Clock className="h-5 w-5" aria-hidden="true" />
                    </span>
                    {hours}
                  </p>
                </Reveal>
              </li>
            )}
          </ul>
        </div>

        <Reveal from="right" y={50}>
          {canSend ? (
            <form onSubmit={onSubmit} noValidate className="rounded-[2rem] border border-white/10 bg-ink-850 p-7 sm:p-10">
              {sent ? (
                <div role="status" className="flex flex-col items-center gap-4 py-10 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
                    <Send className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <p className="font-display text-3xl font-semibold text-white">Thank you!</p>
                  <p className="max-w-xs text-zinc-400">Your message is ready in {whatsapp ? 'WhatsApp' : 'your email app'}. Press send there and we will reply soon.</p>
                  <Button variant="ghost" onClick={() => setSent(false)}>
                    Write another message
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="c-name" className="mb-2 block text-sm font-medium text-zinc-300">
                      Your name
                    </label>
                    <input id="c-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={errors.name ? true : undefined} className={`${field} ${errors.name ? 'border-red-500/60' : 'border-white/10'}`} />
                    {errors.name && <p role="alert" className="mt-1.5 text-sm text-red-400">{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="c-phone" className="mb-2 block text-sm font-medium text-zinc-300">
                      Phone number
                    </label>
                    <input id="c-phone" type="tel" autoComplete="tel" placeholder="+251 911 000000" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} aria-invalid={errors.phone ? true : undefined} className={`${field} ${errors.phone ? 'border-red-500/60' : 'border-white/10'}`} />
                    {errors.phone && <p role="alert" className="mt-1.5 text-sm text-red-400">{errors.phone}</p>}
                  </div>
                  <div>
                    <label htmlFor="c-interest" className="mb-2 block text-sm font-medium text-zinc-300">
                      What are you looking for?
                    </label>
                    <select id="c-interest" value={interest} onChange={(event) => setInterest(event.target.value)} className={`${field} border-white/10 [&>option]:bg-ink-900`}>
                      <option value="">Choose one (optional)</option>
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="c-message" className="mb-2 block text-sm font-medium text-zinc-300">
                      Message (optional)
                    </label>
                    <textarea id="c-message" rows={4} maxLength={600} value={message} onChange={(event) => setMessage(event.target.value)} className={`${field} resize-none border-white/10`} placeholder="Room size, colours, when you need it…" />
                  </div>
                  <Button type="submit" className="w-full" icon={<Send className="h-4 w-4" aria-hidden="true" />}>
                    {whatsapp ? 'Send on WhatsApp' : 'Send by email'}
                  </Button>
                </div>
              )}
            </form>
          ) : (
            <div className="rounded-[2rem] border border-white/10 bg-ink-850 p-10 text-center">
              <p className="font-display text-3xl font-semibold text-white">The best way to choose is to visit.</p>
              <p className="mx-auto mt-3 max-w-sm text-zinc-400">Our showroom team is happy to help you in person.</p>
              <div className="mt-8 flex justify-center">
                <LinkButton href="#showrooms">Find a showroom</LinkButton>
              </div>
              {import.meta.env.DEV && <p className="mt-6 text-xs text-gold-300/70">Developer note: set VITE_WHATSAPP or VITE_EMAIL in website/.env to turn on the message form.</p>}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
