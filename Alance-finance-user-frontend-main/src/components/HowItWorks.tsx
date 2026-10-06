export default function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'Connect',
      subtitle: 'Connect your wallet and access the ecosystem.',
      details:
        'Support for Web3 self-custody wallets. Authenticate securely with zero centralized credentials or email requirements.',
      icon: (
        <svg className="h-6 w-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      step: '02',
      title: 'Participate',
      subtitle: 'Use DeFi, staking, and Web3 applications.',
      details:
        'Deploy liquidity, stake in verified protocol contracts, trade non-custodial assets, and engage with decentralized applications.',
      icon: (
        <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      step: '03',
      title: 'Govern',
      subtitle: 'Participate in community proposals and governance.',
      details:
        'Vote on key protocol parameter calibrations, grant distributions, and strategic roadmap votes directly via transparent on-chain proposals.',
      icon: (
        <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      step: '04',
      title: 'Grow',
      subtitle: 'Contribute to and grow the decentralized ecosystem.',
      details:
        'Build integrations, bootstrap liquidity, foster community initiatives, and expand open-source infrastructure across Web3.',
      icon: (
        <svg className="h-6 w-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="relative scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-md">
            Protocol Journey
          </div>
          <h2
            id="how-it-works-heading"
            className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            How It Works
          </h2>

          {/* Flow Indicator Pill */}
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-slate-950/70 px-4 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur-md sm:text-sm">
            <span className="text-amber-300">Connect</span>
            <span className="text-amber-500/60">→</span>
            <span className="text-amber-400">Participate</span>
            <span className="text-amber-500/60">→</span>
            <span className="text-orange-400">Govern</span>
            <span className="text-amber-500/60">→</span>
            <span className="text-amber-300">Grow</span>
          </div>

          <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
            A frictionless path from your Web3 wallet to active protocol
            participation and community decision-making.
          </p>
        </div>

        {/* 4 Steps Grid with Directional Connectors */}
        <div className="relative mt-14">
          {/* Desktop connecting guide line with animated energy pulse */}
          <div
            className="connector-pulse-line pointer-events-none absolute top-1/2 left-10 right-10 -translate-y-8 hidden h-[3px] rounded-full lg:block"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 lg:gap-6">
            {steps.map((item, index) => (
              <div key={item.title} className="relative flex flex-col">
                <div className="glass-card glass-card-interactive group flex flex-1 flex-col justify-between rounded-2xl p-6 sm:p-7 shadow-xl hover:border-amber-400/35">
                  <div>
                    {/* Top Row: Number badge & Icon */}
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 font-mono text-sm font-bold text-amber-300 ring-1 ring-amber-400/30 transition-transform duration-300 group-hover:scale-105">
                        {item.step}
                      </span>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950/80 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110">
                        {item.icon}
                      </div>
                    </div>

                    <h3 className="mt-5 text-xl font-bold text-white transition-colors group-hover:text-amber-200">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm font-medium text-amber-300/90">
                      {item.subtitle}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
                      {item.details}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Step {item.step} of 04
                  </div>
                </div>

                {/* Mobile / Tablet vertical connector indicator between cards */}
                {index < steps.length - 1 && (
                  <div
                    className="flex items-center justify-center py-2 lg:hidden"
                    aria-hidden="true"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/30 bg-slate-950/90 text-amber-400 shadow-md shadow-amber-500/10">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
