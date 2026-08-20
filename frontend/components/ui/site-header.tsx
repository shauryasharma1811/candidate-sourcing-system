import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold text-gray-900">
          Careers
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/jobs" className="text-gray-600 hover:text-gray-900">
            Browse Jobs
          </Link>
          <Link href="/auth/login" className="text-gray-600 hover:text-gray-900">
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
