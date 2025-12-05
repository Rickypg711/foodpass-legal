import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-2xl space-y-8 text-center">
          {/* Logo/Title */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
              FoodiePass
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Legal Documents
            </p>
          </div>

          {/* Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Privacy Policy Card */}
            <Link
              href="/privacy-policy.html"
              className="group block rounded-lg border-2 border-gray-200 bg-white p-8 shadow-lg transition-all hover:border-blue-500 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-blue-100 p-4 dark:bg-blue-900">
                    <svg
                      className="h-8 w-8 text-blue-600 dark:text-blue-400"
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
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Privacy Policy
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Learn how we collect, use, and protect your personal information.
                </p>
                <div className="flex items-center justify-center text-blue-600 dark:text-blue-400">
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
              className="group block rounded-lg border-2 border-gray-200 bg-white p-8 shadow-lg transition-all hover:border-blue-500 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-green-100 p-4 dark:bg-green-900">
                    <svg
                      className="h-8 w-8 text-green-600 dark:text-green-400"
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
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Terms of Use
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Read our terms and conditions for using FoodiePass services.
                </p>
                <div className="flex items-center justify-center text-blue-600 dark:text-blue-400">
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
          <div className="pt-8 text-sm text-gray-500 dark:text-gray-400">
            <p>© 2024 FoodiePass. All rights reserved.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
