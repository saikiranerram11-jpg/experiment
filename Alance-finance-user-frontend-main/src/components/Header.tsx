import { useState, useEffect } from 'react';
import logo from '../assets/images/logo.png';

export interface HeaderProps {
  onSeeFuture?: () => void;
  onEnterFuture?: () => void;
  onLaunchApp?: () => void;
}

const navItems = [
  { label: 'About', href: '#about' },
  { label: 'Ecosystem', href: '#ecosystem' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Token', href: '#token' },
  { label: 'Governance', href: '#governance' },
  { label: 'Transparency', href: '#transparency' },
  { label: 'Community', href: '#community' },
];

export default function Header(_props: HeaderProps = {}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 w-full transition-all duration-300 ${isScrolled
          ? 'border-b border-amber-500/20 bg-[#070a16]/80 py-3 shadow-xl shadow-black/40 backdrop-blur-xl'
          : 'border-b border-white/[0.08] bg-[#070a16]/45 py-3.5 sm:py-4 shadow-sm backdrop-blur-lg'
        }`}
    >
      <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <a
          href="#"
          className="group z-10 flex items-center gap-2.5 rounded-xl p-1 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          aria-label="Alance Home"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-1 ring-1 ring-amber-400/30 transition-transform duration-200 group-hover:scale-105">
            <img
              src={logo}
              alt="Alance emblem"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Alance
          </span>
        </a>

        {/* Centered Desktop Navigation Pill */}
        <nav
          aria-label="Main navigation"
          className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-slate-950/50 p-1.5 backdrop-blur-md shadow-lg shadow-black/20 ring-1 ring-white/5 xl:gap-1.5"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium text-slate-200/90 transition-all duration-200 hover:bg-amber-400/10 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 xl:h-8.5 xl:px-3.5 xl:text-sm"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Mobile Hamburger Button (Right-aligned, hidden on desktop) */}
        <div className="flex items-center lg:hidden">
          <button
            type="button"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsMenuOpen((curr) => !curr)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/20 bg-slate-950/70 text-white transition-colors hover:border-amber-400/40 hover:bg-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="sr-only">{isMenuOpen ? 'Close menu' : 'Open menu'}</span>
            <div className="relative flex h-5 w-5 flex-col items-center justify-center gap-1.5" aria-hidden="true">
              <span
                className={`block h-0.5 w-5 rounded-full bg-white transition-all duration-300 ${isMenuOpen ? 'translate-y-2 rotate-45' : ''
                  }`}
              />
              <span
                className={`block h-0.5 w-5 rounded-full bg-white transition-all duration-200 ${isMenuOpen ? 'opacity-0' : 'opacity-100'
                  }`}
              />
              <span
                className={`block h-0.5 w-5 rounded-full bg-white transition-all duration-300 ${isMenuOpen ? '-translate-y-2 -rotate-45' : ''
                  }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMenuOpen && (
        <div
          id="mobile-navigation"
          className="mx-4 mt-3 rounded-2xl border border-white/10 bg-[#070a16]/90 p-3 shadow-2xl shadow-black/80 backdrop-blur-2xl lg:hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className="flex min-h-11 items-center rounded-xl px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-amber-500/15 hover:text-amber-300 active:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}