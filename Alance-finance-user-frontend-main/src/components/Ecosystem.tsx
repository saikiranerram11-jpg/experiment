export default function Ecosystem() {
  const ecosystemItems = [
    {
      title: 'DeFi',
      description: 'Decentralized financial solutions',
      detail:
        'Access decentralized liquidity pools, non-custodial asset swaps, and autonomous yield opportunities powered by smart contracts.',
      tag: 'Core Protocol',
      accent: 'from-amber-500/20 to-orange-500/20',
      iconBorder: 'border-amber-400/30',
      iconColor: 'text-amber-400',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'DAO',
      description: 'Community-driven governance',
      detail:
        'Decentralized autonomous organization giving token holders direct voting power on proposals, parameter updates, and treasury allocations.',
      tag: 'Governance',
      accent: 'from-orange-500/20 to-amber-600/20',
      iconBorder: 'border-orange-400/30',
      iconColor: 'text-orange-400',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      title: 'Token',
      description: 'Utility within the ecosystem',
      detail:
        'The foundational asset facilitating fee discounts, governance voting rights, protocol staking, and network access incentives.',
      tag: 'Utility',
      accent: 'from-yellow-500/20 to-amber-500/20',
      iconBorder: 'border-yellow-400/30',
      iconColor: 'text-yellow-400',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      title: 'Staking',
      description: 'Participate through smart contracts',
      detail:
        'Lock assets in verified smart contracts to safeguard protocol validation, participate in consensus, and earn programmatic yields.',
      tag: 'Smart Contracts',
      accent: 'from-amber-600/20 to-orange-600/20',
      iconBorder: 'border-amber-500/30',
      iconColor: 'text-amber-300',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      title: 'Gaming',
      description: 'Web3 gaming applications',
      detail:
        'True digital asset ownership, interoperable on-chain items, and player-driven decentralized economies built on smart contracts.',
      tag: 'Entertainment',
      accent: 'from-amber-500/20 to-rose-500/20',
      iconBorder: 'border-amber-400/30',
      iconColor: 'text-amber-300',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v2a1 1 0 01-1 1h-1a1 1 0 00-1 1v3a2 2 0 11-4 0v-1a1 1 0 00-1-1h-3a1 1 0 01-1-1V9a1 1 0 011-1h1a1 1 0 001-1V4z" />
        </svg>
      ),
    },
    {
      title: 'Web3 Apps',
      description: 'Multiple decentralized use cases',
      detail:
        'Composable decentralized applications extending from identity and data provenance to prediction markets and automated tooling.',
      tag: 'Ecosystem DApps',
      accent: 'from-orange-500/20 to-amber-500/20',
      iconBorder: 'border-orange-400/30',
      iconColor: 'text-orange-300',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="ecosystem"
      aria-labelledby="ecosystem-heading"
      className="relative scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-md">
            Modular Architecture
          </div>
          <h2
            id="ecosystem-heading"
            className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            One Ecosystem.{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              Multiple Possibilities.
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
            Discover a unified suite of decentralized protocols, autonomous
            tools, and community-driven platforms engineered on blockchain
            technology.
          </p>
        </div>

        {/* 6 Cards Grid: Desktop 3x2, Tablet 2x3, Mobile 1x6 */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ecosystemItems.map((item) => (
            <div
              key={item.title}
              className="glass-card glass-card-interactive group flex flex-col justify-between rounded-2xl p-6 sm:p-7 shadow-xl hover:border-amber-400/35 transition-all duration-300"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} ${item.iconBorder} border ring-1 ring-white/10 ${item.iconColor} transition-transform duration-300 group-hover:scale-110`}
                  >
                    {item.icon}
                  </div>
                  <span className="rounded-full border border-amber-400/20 bg-slate-950/70 px-3 py-1 text-[11px] font-medium text-slate-300">
                    {item.tag}
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold text-white transition-colors group-hover:text-amber-200">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm font-medium text-amber-300/90">
                  {item.description}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
                  {item.detail}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Ecosystem Pillar
                </span>
                <span className="inline-flex items-center gap-1 text-amber-400 transition-transform duration-200 group-hover:translate-x-1">
                  Learn more
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
