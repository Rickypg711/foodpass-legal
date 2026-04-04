import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F5F5DC] via-[#FAF8F2] to-[#EFEBE0] dark:from-[#1c1917] dark:via-[#1c1917] dark:to-[#292524]">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-2xl space-y-8 text-center">
          {/* Logo + title (same asset as Flutter app launcher) */}
          <div className="space-y-5">
            <div className="flex justify-center">
              <Image
                src="/anto-app-icon.png"
                alt="ANTO"
                width={88}
                height={88}
                priority
                className="h-[88px] w-[88px] rounded-[22px] shadow-md ring-1 ring-black/[0.06] dark:ring-white/10"
              />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#171717] dark:text-white">
              ANTO
            </h1>
            <p className="text-xl text-neutral-600 dark:text-neutral-400">
              Legal Documents
            </p>
          </div>

          {/* Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Privacy Policy Card */}
            <Link
              href="/privacy-policy.html"
              className="group block rounded-lg border border-neutral-200/80 bg-white p-8 shadow-md transition-all hover:border-[#FF7A00] hover:shadow-lg dark:border-neutral-700 dark:bg-[#292524]"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-[#FF7A00]/12 p-4 dark:bg-[#FF7A00]/15">
                    <svg
                      className="h-8 w-8 text-[#FF7A00]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-[#171717] dark:text-white">
                  Privacy Policy
                </h2>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Learn how we collect, use, and protect your personal information.
                </p>
                <div className="flex items-center justify-center text-[#FF7A00]">
                  <span className="text-sm font-medium">View Policy</span>
                  <svg
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Terms of Use Card */}
            <Link
              href="/terms-of-use.html"
              className="group block rounded-lg border border-neutral-200/80 bg-[#FAFAF4] p-8 shadow-md transition-all hover:border-[#FF7A00] hover:shadow-lg dark:border-neutral-700 dark:bg-[#292524]"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-[#FF7A00]/12 p-4 dark:bg-[#FF7A00]/15">
                    <svg
                      className="h-8 w-8 text-[#FF7A00]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-[#171717] dark:text-white">
                  Terms of Use
                </h2>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Read our terms and conditions for using the App.
                </p>
                <div className="flex items-center justify-center text-[#FF7A00]">
                  <span className="text-sm font-medium">View Terms</span>
                  <svg
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          </div>

          {/* Footer */}
          <div className="pt-8 text-sm text-neutral-500 dark:text-neutral-500">
            <p>© 2024 ANTO. All rights reserved.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
