import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, ShoppingCart, AlertOctagon, Terminal } from "lucide-react";

export const metadata: Metadata = {
  title: "Cart Recovery Control Center",
  description: "End-to-end abandoned cart recovery operations dashboard and audit trail",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <Link href="/" className="flex items-center space-x-3 group">
                  <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                      Cart Recovery <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 font-mono">Control Center</span>
                    </span>
                    <p className="text-[11px] text-slate-400 font-mono">CartFlow Operations & Audit</p>
                  </div>
                </Link>

                <nav className="hidden md:flex space-x-1">
                  <Link
                    href="/"
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800 flex items-center space-x-2 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                    <span>Dashboard</span>
                  </Link>

                  <Link
                    href="/carts"
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800 flex items-center space-x-2 transition-colors"
                  >
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    <span>Work Queue</span>
                  </Link>

                  <Link
                    href="/exceptions"
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800 flex items-center space-x-2 transition-colors"
                  >
                    <AlertOctagon className="w-4 h-4 text-rose-400" />
                    <span>Exceptions</span>
                  </Link>
                </nav>
              </div>

              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>SEED: 20261022</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-indigo-400">STARTER</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-mono">
            <div>CartFlow Recovery Control Center • Local Verification Prototype</div>
            <div>Database: SQLite • Base Time: 2026-10-01T00:00:00Z</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
