interface GovernanceProps {
  onExploreGovernance?: () => void;
}

export default function Governance({ onExploreGovernance }: GovernanceProps) {
  const lifecycleSteps = [
    {
      title: 'Proposal Creation',
      desc: 'Token holders submit structured improvement proposals to the community forum.',
    },
    {
      title: 'Community Consensus',
      desc: 'Debate, feedback iterations, and signal testing refine proposal parameters.',
    },
    {
      title: 'On-Chain Voting',
      desc: 'Decentralized voting executes through verified cryptographic signatures.',
    },
    {
      title: 'Timelock Execution',
      desc: 'Approved proposals queue into an autonomous smart contract timelock before deployment.',
    },
  ];

  return (
    <section
      id="governance"
      aria-labelledby="governance-heading"
      className="relative scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-md">
            Decentralized Autonomous Organization
          </div>
          <h2
            id="governance-heading"
            className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            The Community Makes{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              the Decisions
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
            Token holders can participate in proposals and governance according
            to the DAO's rules.
          </p>
        </div>

        {/* Governance Showcase Grid */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Column: Governance Architecture Card */}
          <div className="glass-card flex flex-col justify-between rounded-3xl p-6 sm:p-8 lg:col-span-7 shadow-xl hover:border-amber-400/35">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Governance Lifecycle
                </span>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                  DAO Architecture
                </span>
              </div>

              <h3 className="mt-3 text-xl font-bold text-white sm:text-2xl">
                Democratized On-Chain Decision Making
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                No single founder, entity, or foundation possesses admin keys to
                alter protocol rules unilaterally. The protocol operates in
                strict adherence to community voting consensus.
              </p>

              {/* 4-Step Lifecycle List */}
              <div className="mt-6 space-y-4">
                {lifecycleSteps.map((step, idx) => (
                  <div
                    key={step.title}
                    className="flex items-start gap-3.5 rounded-xl border border-white/5 bg-slate-950/60 p-3.5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-amber-400 ring-1 ring-amber-400/20">
                      0{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        {step.title}
                      </h4>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={onExploreGovernance}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:opacity-95 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:w-auto"
              >
                Explore Governance
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right Column: Governance Proposal Template Card */}
          <div className="flex flex-col justify-between rounded-3xl border border-amber-400/15 bg-[#080c18]/70 p-6 shadow-xl backdrop-blur-2xl sm:p-8 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400">
                  DAO Specification
                </span>
                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  Charter Ready
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-400/15 bg-slate-950/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[11px] text-amber-300">
                    AIP-001
                  </span>
                  <span className="text-xs text-slate-400">Genesis Proposal</span>
                </div>

                <h4 className="mt-3 text-base font-bold text-white">
                  Genesis Protocol Constitution & DAO Rules
                </h4>

                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Establishes voting quorum thresholds, emergency pause safeguards,
                  and decentralized treasury custody parameters.
                </p>

                <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Mechanism:</span>
                    <span className="font-medium text-white">Token-Weighted Voting</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Execution:</span>
                    <span className="font-medium text-white">Timelock Controller</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Status:</span>
                    <span className="font-medium text-amber-300">Scheduled for Genesis</span>
                  </div>
                </div>
              </div>

              {/* Governance Principles */}
              <div className="mt-6 space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>100% On-Chain Proposal Trail</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Verifiable Cryptographic Proofs</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Multi-sig Emergency Safety Latches</span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/70 p-3 text-center text-xs text-slate-400">
              Live voting dashboard opens concurrently with mainnet contract activation.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
