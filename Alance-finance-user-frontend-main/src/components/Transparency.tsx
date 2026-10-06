export default function Transparency() {
  const transparencyItems = [
    {
      title: 'Smart Contract',
      category: 'Protocol Code',
      description: 'Information about deployed smart contracts.',
      detail:
        'Deterministic, immutable bytecode designed for trustless financial execution and automated settlement without human intermediaries.',
      status: 'Coming Soon',
      icon: (
        <svg className="h-6 w-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
    },
    {
      title: 'Audit Report',
      category: 'Security Verification',
      description: 'Security audit documentation.',
      detail:
        'Rigorous third-party security audits, formal verification, and automated vulnerability test suites conducted prior to public contract deployment.',
      status: 'Coming Soon',
      icon: (
        <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: 'Liquidity',
      category: 'Market Stability',
      description: 'Liquidity information and transparency.',
      detail:
        'Decentralized liquidity pool addresses and initial lock proofs will be publicly published to guarantee permanent trading transparency.',
      status: 'Coming Soon',
      icon: (
        <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      title: 'Treasury',
      category: 'DAO Capital',
      description: 'Treasury information and management.',
      detail:
        'On-chain treasury balances, multi-sig signer addresses, and timelocked disbursement schedules visible via public block explorers.',
      status: 'Coming Soon',
      icon: (
        <svg className="h-6 w-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      title: 'Token Allocation',
      category: 'Tokenomics',
      description: 'Distribution and allocation details.',
      detail:
        'Comprehensive breakdown of circulating, staking, liquidity, and ecosystem grant reserves with transparent vesting schedules.',
      status: 'Coming Soon',
      icon: (
        <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    },
    {
      title: 'Governance Contracts',
      category: 'DAO Rules',
      description: 'Governance contract information.',
      detail:
        'Standardized timelock and governor contracts enforcing democratic voting, proposal execution delays, and parameter modifications.',
      status: 'Coming Soon',
      icon: (
        <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      ),
    },
    {
      title: 'Open Source',
      category: 'Public Codebase',
      description: 'GitHub/open-source code when applicable.',
      detail:
        'Public repository releases containing smart contracts, frontend SDKs, and deployment scripts open for peer review and audits.',
      status: 'Coming Soon',
      icon: (
        <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="transparency"
      aria-labelledby="transparency-heading"
      className="relative scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-md">
            Integrity & Accountability
          </div>
          <h2
            id="transparency-heading"
            className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            Built for{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              Transparency
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
            We adhere to rigorous standards of disclosure. All smart contract
            artifacts, treasury audits, and distribution records are documented
            verifiably for community inspection.
          </p>
        </div>

        {/* 7 Transparency Cards Grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {transparencyItems.map((item, index) => (
            <div
              key={item.title}
              className={`glass-card glass-card-interactive flex flex-col justify-between rounded-2xl p-6 sm:p-7 shadow-xl hover:border-amber-400/35 ${
                index === 6 ? 'md:col-span-2 lg:col-span-3' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950/80 ring-1 ring-amber-400/20">
                    {item.icon}
                  </div>
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                    {item.status}
                  </span>
                </div>

                <div className="mt-5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {item.category}
                  </span>
                  <h3 className="mt-1 text-lg font-bold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-amber-300/90">
                    {item.description}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
                    {item.detail}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Documentation Target
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Status: Coming Soon
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Non-fabrication guarantee notice */}
        <div className="mt-8 rounded-2xl border border-amber-400/15 bg-slate-950/60 p-5 text-center backdrop-blur-md">
          <p className="text-xs text-slate-300 sm:text-sm">
            🛡️ <strong className="text-amber-200">Protocol Commitment:</strong> In accordance with our security policies, contract addresses, audit certs, and repository URLs will only be published once deployed and finalized on public testnets and mainnet.
          </p>
        </div>
      </div>
    </section>
  );
}
