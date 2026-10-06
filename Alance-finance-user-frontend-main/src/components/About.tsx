export default function About() {
  const pillars = [
    {
      title: 'Decentralized Consensus',
      description:
        'Distributed architecture engineered to eliminate single points of failure, ensuring high availability and fault-tolerant settlement.',
      badge: 'Architecture',
      icon: (
        <svg className="h-6 w-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
    {
      title: 'Smart Contract Security',
      description:
        'Auditable, deterministic smart contracts that govern treasury, staking, and exchange operations without centralized intermediaries.',
      badge: 'Smart Contracts',
      icon: (
        <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: 'Community Sovereignty',
      description:
        'All major protocol upgrades, treasury disbursements, and parameter calibrations require transparent on-chain voter consensus.',
      badge: 'Governance',
      icon: (
        <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      title: 'Open Interoperability',
      description:
        'Standardized Web3 primitives built for frictionless cross-chain liquidity and straightforward integration with broader DeFi ecosystems.',
      badge: 'Composability',
      icon: (
        <svg className="h-6 w-6 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="relative scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-md">
            Protocol Foundations
          </div>
          <h2
            id="about-heading"
            className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            Decentralized. Transparent.{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              Community-Driven.
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
            Our ecosystem brings DeFi, governance, staking, and Web3
            applications together through transparent blockchain technology.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="glass-card glass-card-interactive flex flex-col justify-between rounded-2xl p-6 shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950/80 ring-1 ring-amber-400/20">
                    {pillar.icon}
                  </div>
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                    {pillar.badge}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {pillar.description}
                </p>
              </div>

              <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-xs font-medium text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>Verified Architecture Primitive</span>
              </div>
            </div>
          ))}
        </div>

        {/* Supporting Visual: Protocol Architecture Verification Banner */}
        <div className="glass-card mt-8 overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Network Primitives
              </span>
              <h3 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                Cryptographic Transparency & On-Chain Auditability
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Every transaction, smart contract interaction, and governance
                vote executes through transparent, deterministic state machines.
                No proprietary walled gardens or centralized operator overrides.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-5">
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-center">
                <div className="text-xs font-medium text-slate-400">State Layer</div>
                <div className="mt-1 font-mono text-sm font-semibold text-white">EVM Compatible</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-center">
                <div className="text-xs font-medium text-slate-400">Consensus</div>
                <div className="mt-1 font-mono text-sm font-semibold text-amber-300">Decentralized</div>
              </div>
              <div className="col-span-2 rounded-xl border border-white/10 bg-slate-950/70 p-3 text-center sm:col-span-1">
                <div className="text-xs font-medium text-slate-400">Governance</div>
                <div className="mt-1 font-mono text-sm font-semibold text-orange-300">DAO Governed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
