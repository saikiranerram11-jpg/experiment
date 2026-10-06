import logo from '../assets/images/logo.png';

interface HeroProps {
  onSeeFuture?: () => void;
  onEnterFuture?: () => void;
  onLaunchApp?: () => void;
  onReadWhitepaper?: () => void;
}

export default function Hero({
  onSeeFuture,
  onEnterFuture,
  onLaunchApp,
  onReadWhitepaper,
}: HeroProps) {
  const handleAction = () => {
    if (onSeeFuture) {
      onSeeFuture();
    } else if (onEnterFuture) {
      onEnterFuture();
    } else if (onLaunchApp) {
      onLaunchApp();
    }
  };

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 pt-6 pb-12 sm:px-6 sm:pt-10 sm:pb-16 md:pt-12 md:pb-20 lg:px-8 lg:pt-16 lg:pb-24"
    >
      <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-12 xl:gap-16">
        {/* Hero Content Column */}
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
          {/* Main Heading with Living Sunset Shimmer Gradient */}
          <h1
            id="hero-heading"
            className="text-balance text-4xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-5xl md:text-6xl lg:text-[62px] sm:leading-[1.1] md:leading-[1.08] lg:leading-[1.05]"
          >
            Building the Future of{' '}
            <span className="headline-shimmer bg-clip-text text-transparent drop-shadow-sm">
              Decentralized Finance
            </span>
          </h1>

          {/* Description */}
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200 drop-shadow sm:text-lg md:text-xl sm:leading-8">
            A community-driven ecosystem powered by blockchain, smart
            contracts, and decentralized governance.
          </p>

          {/* Action CTAs: Consistently Sized, Aligned & Spaced */}
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5">
            {/* Primary CTA - Explore Ecosystem */}
            <a
              href="#ecosystem"
              className="group inline-flex h-11 sm:h-12 w-full sm:w-auto items-center justify-center gap-2 sm:gap-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 px-5 sm:px-6 text-sm sm:text-base font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-500/30 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap"
            >
              <span>Explore Ecosystem</span>
              <svg
                className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-y-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </a>

            {/* Secondary CTA - See Future */}
            <button
              type="button"
              onClick={handleAction}
              className="group inline-flex h-11 sm:h-12 w-full sm:w-auto items-center justify-center gap-2 sm:gap-2.5 rounded-xl border border-amber-400/35 bg-slate-900/80 px-5 sm:px-6 text-sm sm:text-base font-semibold text-white shadow-lg shadow-black/30 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/60 hover:bg-slate-800/90 hover:text-amber-200 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0 transition-transform duration-200 group-hover:scale-125" aria-hidden="true" />
              <span>See Future</span>
            </button>

            {/* Tertiary CTA - Read Whitepaper */}
            <button
              type="button"
              onClick={onReadWhitepaper}
              className="group inline-flex h-11 sm:h-12 w-full sm:w-auto items-center justify-center gap-2 sm:gap-2.5 rounded-xl border border-white/15 bg-white/5 px-5 sm:px-6 text-sm sm:text-base font-semibold text-slate-200 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/35 hover:bg-white/10 hover:text-white active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap"
            >
              <svg
                className="h-4 w-4 shrink-0 text-slate-400 transition-all duration-200 group-hover:rotate-6 group-hover:text-amber-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>Read Whitepaper</span>
            </button>
          </div>
        </div>

        {/* Layout Anchor Slot for Persistent Alance Logo */}
        <div
          id="hero-logo-anchor"
          className="relative z-0 flex w-full items-center justify-center py-4 sm:py-6 lg:justify-end"
          aria-hidden="true"
        >
          <div className="hero-logo-wrapper invisible pointer-events-none opacity-0">
            <div className="hero-logo-stage">
              <img
                src={logo}
                alt=""
                className="hero-logo"
                loading="eager"
              />
            </div>
            <div className="hero-logo-shadow" />
          </div>
        </div>
      </div>
    </section>
  );
}