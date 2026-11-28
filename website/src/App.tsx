import { lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import ProductDialog from './components/ProductDialog';
import { SiteProvider } from './hooks/useSite';
import Collections from './sections/Collections';
import Contact from './sections/Contact';
import Craft from './sections/Craft';
import Footer from './sections/Footer';
import Hero from './sections/Hero';
import Marquee from './sections/Marquee';
import Process from './sections/Process';
import Showrooms from './sections/Showrooms';

// the chatbot loads after everything else, so it never slows the first picture
const ChatWidget = lazy(() => import('./components/chat/ChatWidget'));

export default function App() {
  return (
    <SiteProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-gold-400 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink-950"
      >
        Skip to the content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <Marquee />
        <Craft />
        <Collections />
        <Process />
        <Showrooms />
        <Contact />
      </main>
      <Footer />
      <ProductDialog />
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </SiteProvider>
  );
}
