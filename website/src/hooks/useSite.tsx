import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { publicApi } from '../lib/api';
import { site as config } from '../lib/config';
import { DEMO_SITE } from '../lib/fallback';
import type { SiteData } from '../lib/types';

interface SiteState {
  data: SiteData;
  /** true while showing demo content because the backend could not be reached */
  isDemo: boolean;
  loading: boolean;
  /** the best phone number we know (the .env one, then the server's, then a showroom's) */
  phone: string | null;
  whatsapp: string | null;
  hours: string | null;
}

const SiteContext = createContext<SiteState | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SiteData>(DEMO_SITE);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    publicApi
      .site()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setIsDemo(false);
      })
      .catch(() => {
        if (!cancelled) setIsDemo(true); // keep the demo content
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SiteState>(
    () => ({
      data,
      isDemo,
      loading,
      phone: config.phone ?? data.contact.phone ?? data.showrooms.find((room) => room.phone)?.phone ?? null,
      whatsapp: config.whatsapp ?? data.contact.whatsapp,
      hours: config.hours ?? data.contact.hours,
    }),
    [data, isDemo, loading],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteState {
  const value = useContext(SiteContext);
  if (!value) throw new Error('useSite must be used inside SiteProvider');
  return value;
}
