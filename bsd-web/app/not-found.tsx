import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-600">The page you're looking for doesn't exist or may have moved.</p>
      <Link href="/" className="mt-6 font-semibold text-teal hover:underline">
        Back to Home
      </Link>
    </div>
  );
}
