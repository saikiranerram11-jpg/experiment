import logo from '../assets/images/logo.png';

interface FooterProps {
  onOpenWhitepaper?: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  onOpenDocs?: () => void;
}

export default function Footer({
  onOpenWhitepaper,
  onOpenTerms,
  onOpenPrivacy,
  onOpenDocs,
}: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-amber-500/15 bg-slate-950/92 text-slate-400 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Brand & Main Tagline */}
          <div className="lg:col-span-5">
            <a
              href="#"
              className="inline-flex items-center gap-2.5 rounded-xl text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label="Alance home"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-1 ring-1 ring-amber-400/30">
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

            {/* Core Tagline */}
            <p className="mt-4 text-base font-semibold text-white sm:text-lg">
              Decentralized Technology. Community Governance. Open Ecosystem.
            </p>

            <p className="mt-2 text-xs leading-relaxed text-slate-400 sm:text-sm">
              Empowering global participants with transparent, trustless, and
              community-governed financial infrastructure built on open blockchain
              standards.
            </p>
          </div>

          {/* Navigation Links Column */}
          <div className="lg:col-span-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Protocol Links
                </span>
                <nav aria-label="Footer protocol navigation" className="mt-3 flex flex-col space-y-2">
                  <button
                    type="button"
                    onClick={onOpenDocs}
                    className="text-left text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    Documentation
                  </button>
                  <button
                    type="button"
                    onClick={onOpenWhitepaper}
                    className="text-left text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    Whitepaper
                  </button>
                  <a
                    href="#token"
                    className="text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    Contracts
                  </a>
                  <a
                    href="#transparency"
                    className="text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    Audit
                  </a>
                  <a
                    href="#governance"
                    className="text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    Governance
                  </a>
                </nav>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Ecosystem
                </span>
                <nav aria-label="Footer ecosystem navigation" className="mt-3 flex flex-col space-y-2">
                  <a
                    href="#about"
                    className="text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    About Protocol
                  </a>
                  <a
                    href="#ecosystem"
                    className="text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    Ecosystem Primitives
                  </a>
                  <a
                    href="#how-it-works"
                    className="text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    How It Works
                  </a>
                  <a
                    href="#community"
                    className="text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    Community
                  </a>
                </nav>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Legal & Policy
                </span>
                <nav aria-label="Footer legal navigation" className="mt-3 flex flex-col space-y-2">
                  <button
                    type="button"
                    onClick={onOpenTerms}
                    className="text-left text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    Terms of Use
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPrivacy}
                    className="text-left text-xs text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    Privacy Policy
                  </button>
                  <span className="text-xs text-slate-500">
                    Disclaimers & Risks
                  </span>
                </nav>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Compliance */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-slate-500">
            &copy; {currentYear} Alance Decentralized Protocol. Open-source and community governed.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <span>Non-custodial protocol</span>
            <span>•</span>
            <span>Immutable smart contracts</span>
            <span>•</span>
            <span>Zero tracker cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
