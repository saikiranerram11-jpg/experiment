import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badge?: string;
  maxWidth?: string;
  children: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  badge,
  maxWidth = 'max-w-lg',
  children,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className={`relative w-full ${maxWidth} overflow-hidden rounded-3xl border border-white/15 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl sm:p-8 animate-in zoom-in-95 duration-200`}>
        {/* Glow accent */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 h-36 w-36 rounded-full bg-amber-500/15 blur-2xl"
          aria-hidden="true"
        />

        <div className="flex items-start justify-between gap-4">
          <div>
            {badge && (
              <span className="inline-block rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                {badge}
              </span>
            )}
            <h3
              id="modal-title"
              className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl"
            >
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:border-amber-400/30 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 text-sm leading-relaxed text-slate-300">
          {children}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-amber-400/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500/20 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
