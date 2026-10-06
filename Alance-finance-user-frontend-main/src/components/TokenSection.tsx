import { useState } from 'react';

export default function TokenSection() {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const contractAddressDisplay = 'TBD (To be published at mainnet launch)';

  const handleCopy = () => {
    navigator.clipboard?.writeText(contractAddressDisplay);
    setCopyStatus('Copied to clipboard');
    setTimeout(() => setCopyStatus(null), 2500);
  };

  const tokenMetrics = [
    { label: 'Token Name', value: 'Alance' },
    { label: 'Symbol', value: 'TBD' },
    { label: 'Total Supply', value: 'TBD' },
    { label: 'Blockchain', value: 'EVM / Multi-chain (TBD)' },
  ];

  const utilityPillars = [
    {
      title: 'Governance Voting',
      description: 'Vote on key protocol parameters and DAO treasury proposals.',
    },
    {
      title: 'Staking & Security',
      description: 'Lock tokens in consensus contracts to secure network validation.',
    },
    {
      title: 'Fee Discounts',
      description: 'Subsidize transaction fees across native decentralized swap routes.',
    },
    {
      title: 'Ecosystem Grants',
      description: 'Fund community developers building tools and integrations.',
    },
  ];

  return (
    <section
      id="token"
      aria-labelledby="token-heading"
      className="relative scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-md">
            Native Asset
          </div>
          <h2
            id="token-heading"
            className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            The Ecosystem{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              Token
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
            Empowering governance, fueling network utility, and aligning community
            incentives across the Alance decentralized ecosystem.
          </p>
        </div>

        {/* Main Token Specs Card */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-amber-400/15 bg-[#080c18]/70 p-6 shadow-2xl backdrop-blur-2xl sm:p-8 lg:p-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left: Token Metrics Grid */}
            <div className="lg:col-span-7">
              <h3 className="text-xl font-bold text-white sm:text-2xl">
                Token Specifications
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                Official parameters will be finalized and verified on-chain upon public token generation.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2">
                {tokenMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-amber-400/10 bg-slate-950/70 p-4 transition-colors hover:border-amber-400/25"
                  >
                    <span className="text-xs font-medium text-slate-400">
                      {metric.label}
                    </span>
                    <div className="mt-1 font-mono text-base font-bold text-white sm:text-lg">
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Contract Address Bar */}
              <div className="mt-6 rounded-2xl border border-amber-400/15 bg-slate-950/80 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Contract Address
                  </span>
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                    Mainnet Pending
                  </span>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="overflow-hidden">
                    <p className="truncate font-mono text-xs text-slate-300 sm:text-sm">
                      {contractAddressDisplay}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/20 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-amber-400/40 hover:bg-slate-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    aria-label="Copy contract address placeholder"
                  >
                    <svg className="h-3.5 w-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>{copyStatus || 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons (Explorer / Contract) */}
              <div className="mt-6 flex flex-wrap gap-4">
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-400 shadow-sm transition-colors sm:text-sm"
                  title="Block explorer link will activate upon contract deployment"
                >
                  <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View on Explorer
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    TBD
                  </span>
                </button>

                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-400 shadow-sm transition-colors sm:text-sm"
                  title="Contract code will be verified on-chain at release"
                >
                  <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Contract
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    TBD
                  </span>
                </button>
              </div>
            </div>

            {/* Right: Token Utility Highlights */}
            <div className="flex flex-col justify-between rounded-2xl border border-amber-400/15 bg-slate-950/60 p-6 lg:col-span-5">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Ecosystem Value Flow
                </span>
                <h4 className="mt-1 text-lg font-bold text-white">
                  Token Utility
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
                  The ecosystem token fuels economic incentives and coordinates decentralized participants across protocols.
                </p>

                <div className="mt-6 space-y-4">
                  {utilityPillars.map((pillar) => (
                    <div key={pillar.title} className="flex gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {pillar.title}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {pillar.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                Notice: Token generation event dates and official allocations will be announced exclusively through verified community channels.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
