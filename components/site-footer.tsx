export default function SiteFooter() {
  return (
    <footer className="mt-12 pt-8 border-t border-white/10">
      <div className="flex flex-col items-center gap-3">
        <img src="/favicon.png" alt="HyperScreener Logo" className="w-8 h-8 opacity-60" />
        <p className="text-sm text-white/60 font-mono">
          Made by{" "}
          <a
            href="https://x.com/atareh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ff4f00] hover:text-[#ff4f00]/80 transition-colors"
          >
            @atareh
          </a>
        </p>
      </div>
    </footer>
  )
}
