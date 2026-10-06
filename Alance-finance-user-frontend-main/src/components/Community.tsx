export default function Community() {
  const channels = [
    {
      name: 'Telegram',
      role: 'Announcements & Community',
      description: 'Engage with fellow community members and receive instant updates.',
      icon: (
        <svg className="h-6 w-6 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
        </svg>
      ),
    },
    {
      name: 'Discord',
      role: 'Developer & Governance Hub',
      description: 'Join technical working groups, propose ideas, and chat with contributors.',
      icon: (
        <svg className="h-6 w-6 text-orange-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.894.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      ),
    },
    {
      name: 'X (Twitter)',
      role: 'News & Announcements',
      description: 'Follow protocol announcements, partnerships, and key releases.',
      icon: (
        <svg className="h-6 w-6 text-amber-200" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      name: 'GitHub',
      role: 'Open-Source Codebase',
      description: 'Inspect smart contracts, frontend SDKs, and developer documentation.',
      icon: (
        <svg className="h-6 w-6 text-slate-200" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="community"
      aria-labelledby="community-heading"
      className="relative scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Container with ambient sunset glow */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-[#080c18]/80 p-8 shadow-2xl backdrop-blur-2xl sm:p-12 lg:p-16">
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-600/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
              Global Ecosystem
            </div>

            <h2
              id="community-heading"
              className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl"
            >
              Join the{' '}
              <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-orange-400 bg-clip-text text-transparent">
                Decentralized Community
              </span>
            </h2>

            <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
              Connect with developers, node runners, DAO participants, and
              visionaries co-building the next generation of decentralized finance.
            </p>
          </div>

          {/* Channels Grid */}
          <div className="relative z-10 mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {channels.map((channel) => (
              <div
                key={channel.name}
                className="glass-card flex flex-col justify-between rounded-2xl p-6 transition-all hover:border-amber-400/35 hover:bg-slate-900/90"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950/80 ring-1 ring-amber-400/20">
                      {channel.icon}
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      Official
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-white">
                    {channel.name}
                  </h3>
                  <div className="mt-0.5 text-xs font-medium text-amber-300">
                    {channel.role}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    {channel.description}
                  </p>
                </div>

                <div className="mt-6 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-400 transition-colors"
                    title="Official community links will be activated with mainnet announcement"
                  >
                    <span>Opening at Mainnet</span>
                    <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px]">
                      TBD
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Community Promise Bar */}
          <div className="relative z-10 mt-10 text-center">
            <p className="text-xs text-slate-300">
              Community Governance is built on respect, open discussions, and collective consensus. Beware of impersonators; no team member will ever message you privately requesting private keys or seed phrases.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
