import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-8">
        <h1 className="mb-6 text-center text-xl font-semibold text-neutral-100">
          Sign in to MyGPT
        </h1>

        {error && (
          <p className="mb-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 rounded-md bg-emerald-950 px-3 py-2 text-sm text-emerald-400">
            {message}
          </p>
        )}

        <form className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
          />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Password"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
          />

          <button
            formAction={login}
            className="mt-2 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
          >
            Sign in
          </button>
          <button
            formAction={signup}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
          >
            Create account
          </button>
        </form>
      </div>
    </div>
  );
}
