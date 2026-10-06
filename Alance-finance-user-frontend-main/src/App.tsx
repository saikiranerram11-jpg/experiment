import { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import Ecosystem from './components/Ecosystem';
import HowItWorks from './components/HowItWorks';
import TokenSection from './components/TokenSection';
import Governance from './components/Governance';
import Transparency from './components/Transparency';
import Community from './components/Community';
import Footer from './components/Footer';
import Modal from './components/Modal';
import PersistentLogo from './components/PersistentLogo';
import backgroundImage from './assets/images/Backgroundimage.png';

type ModalType = 'future' | 'whitepaper' | 'governance' | 'terms' | 'privacy' | 'docs' | null;

function App() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedDestination, setSelectedDestination] = useState<'swap' | 'dashboard' | null>(null);

  const closeModal = () => {
    setActiveModal(null);
    setSelectedDestination(null);
  };

  return (
    <main className="relative flex min-h-screen min-h-[100dvh] w-full flex-col overflow-x-hidden selection:bg-white/20">
      {/* Previous existed background only (full vivid original opacity and contrast) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
        aria-hidden="true"
      />

      {/* Dynamic responsive contrast overlay for enhanced legibility */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-slate-950/60 via-slate-950/30 to-slate-950/70 md:bg-gradient-to-r md:from-slate-950/70 md:via-slate-950/35 md:to-transparent"
        aria-hidden="true"
      />

      {/* Ambient Atmospheric Floating Depth Orbs */}
      <div
        className="ambient-orb-1 pointer-events-none fixed top-1/4 -left-20 z-0 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="ambient-orb-2 pointer-events-none fixed bottom-1/4 -right-20 z-0 h-[28rem] w-[28rem] rounded-full bg-orange-500/8 blur-3xl"
        aria-hidden="true"
      />

      {/* Persistent Single Animated Alance Logo (Behind Content) */}
      <PersistentLogo />

      {/* Page Content Layer */}
      <div className="relative z-10 flex min-h-screen min-h-[100dvh] w-full flex-col">
        <Header
          onSeeFuture={() => setActiveModal('future')}
          onEnterFuture={() => setActiveModal('future')}
        />

        <div id="main-content" className="flex-1 pt-[68px] sm:pt-[76px]">
          <Hero
            onSeeFuture={() => setActiveModal('future')}
            onEnterFuture={() => setActiveModal('future')}
            onReadWhitepaper={() => setActiveModal('whitepaper')}
          />
          <About />
          <Ecosystem />
          <HowItWorks />
          <TokenSection />
          <Governance onExploreGovernance={() => setActiveModal('governance')} />
          <Transparency />
          <Community />
        </div>

        <Footer
          onOpenWhitepaper={() => setActiveModal('whitepaper')}
          onOpenTerms={() => setActiveModal('terms')}
          onOpenPrivacy={() => setActiveModal('privacy')}
          onOpenDocs={() => setActiveModal('docs')}
        />
      </div>

      {/* Interactive Modals */}
      <Modal
        isOpen={activeModal === 'future'}
        onClose={closeModal}
        title="See Future"
        badge="Protocol Portal"
        maxWidth="max-w-2xl"
      >
        <p className="text-slate-300">
          Select a decentralized portal to explore and interact with the Alance protocol:
        </p>

        {/* Two Options: Swap & Dashboard */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Swap Option */}
          <button
            type="button"
            onClick={() => setSelectedDestination('swap')}
            className={`group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] ${
              selectedDestination === 'swap'
                ? 'border-amber-400 bg-slate-900/90 shadow-xl shadow-amber-500/20 ring-1 ring-amber-400/40'
                : 'border-white/15 bg-slate-950/60 hover:-translate-y-1 hover:border-amber-400/50 hover:bg-slate-900/80 hover:shadow-xl hover:shadow-amber-500/10'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-300 transition-transform duration-200 group-hover:scale-105">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                  DEX Protocol
                </span>
              </div>

              <h4 className="mt-4 text-lg font-bold text-white transition-colors group-hover:text-amber-200">
                Swap
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Non-custodial token swaps with optimal algorithmic routing, zero middlemen, and deep liquidity pools.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-xs font-semibold text-amber-400">
              <span>Launch Swap</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </div>
          </button>

          {/* Dashboard Option */}
          <button
            type="button"
            onClick={() => setSelectedDestination('dashboard')}
            className={`group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] ${
              selectedDestination === 'dashboard'
                ? 'border-amber-400 bg-slate-900/90 shadow-xl shadow-amber-500/20 ring-1 ring-amber-400/40'
                : 'border-white/15 bg-slate-950/60 hover:-translate-y-1 hover:border-amber-400/50 hover:bg-slate-900/80 hover:shadow-xl hover:shadow-amber-500/10'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-400/30 bg-gradient-to-br from-orange-500/20 to-amber-600/20 text-orange-400 transition-transform duration-200 group-hover:scale-105">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
                <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-orange-300">
                  Analytics & Staking
                </span>
              </div>

              <h4 className="mt-4 text-lg font-bold text-white transition-colors group-hover:text-amber-200">
                Dashboard
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Monitor portfolio analytics, track staking yields, view liquidity positions, and participate in DAO governance.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-xs font-semibold text-orange-400">
              <span>Open Dashboard</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </div>
          </button>
        </div>

        {/* Selected Destination Feedback Banner */}
        {selectedDestination && (
          <div className="mt-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {selectedDestination === 'swap' ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  Swap Interface Selected
                </div>
                <p className="mt-1 text-slate-300">
                  Non-custodial testnet pools are preparing for public launch. Contract routing and liquidity pair contracts are currently undergoing final testnet audits.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-3.5 text-xs text-orange-200">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="h-2 w-2 rounded-full bg-orange-400 animate-ping" />
                  Dashboard Selected
                </div>
                <p className="mt-1 text-slate-300">
                  Protocol analytics, yield calculators, and on-chain governance voting interfaces will be activated alongside the genesis token deployment.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={activeModal === 'whitepaper'}
        onClose={closeModal}
        title="Alance Protocol Whitepaper"
        badge="Documentation"
      >
        <p>
          The comprehensive whitepaper details our decentralized consensus
          primitives, mathematical staking models, and DAO governance rules.
        </p>
        <div className="mt-4 space-y-2 text-xs text-slate-300">
          <div className="flex justify-between border-b border-white/10 pb-1.5">
            <span>Version:</span>
            <span className="font-mono text-white">v1.0-RC</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-1.5">
            <span>Security Framework:</span>
            <span className="font-mono text-amber-300">Audited Architecture</span>
          </div>
          <div className="flex justify-between">
            <span>Full PDF Release:</span>
            <span className="font-mono text-amber-300">Pending Mainnet</span>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'governance'}
        onClose={closeModal}
        title="DAO Governance Portal"
        badge="Community Voting"
      >
        <p>
          On-chain proposal creation and snapshot signaling will commence
          simultaneously with the token generation and protocol Genesis event.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          All verified token holders will be granted non-custodial voting power
          directly through their Web3 wallets with zero gas subsidies or proxy
          custody.
        </p>
      </Modal>

      <Modal
        isOpen={activeModal === 'docs'}
        onClose={closeModal}
        title="Protocol Documentation"
        badge="Developer Docs"
      >
        <p>
          Developer documentation, smart contract interface ABIs, and SDK
          integration manuals are currently being indexed for public release.
        </p>
      </Modal>

      <Modal
        isOpen={activeModal === 'terms'}
        onClose={closeModal}
        title="Terms of Use"
        badge="Legal Notice"
      >
        <p>
          Alance is an open-source, non-custodial software protocol. Users
          interact directly with autonomous smart contracts deployed on
          decentralized blockchain networks at their own discretion.
        </p>
      </Modal>

      <Modal
        isOpen={activeModal === 'privacy'}
        onClose={closeModal}
        title="Privacy Policy"
        badge="Zero Tracking"
      >
        <p>
          We respect digital sovereignty. The Alance frontend does not collect
          personal identification data, email addresses, cookies, or centralized
          telemetry. All on-chain actions are pseudonymous and recorded solely
          on public blockchains.
        </p>
      </Modal>
    </main>
  );
}

export default App;