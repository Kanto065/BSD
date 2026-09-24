import { Mail } from "lucide-react";
import { ArrowLink } from "@/components/ArrowLink";

// CLIENT-REVIEW: the client did not supply copy for this page. It exists so the footer links resolve, with a
// short neutral holding message. Pages using it are marked noindex and left out of the sitemap.
export default function PlaceholderPage({
  title,
  message,
  email,
}: {
  title: string;
  message: string;
  email: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">{title}</h1>
      <p className="mt-4 text-slate-600">{message}</p>
      <p className="mt-6 inline-flex items-center gap-2 text-slate-700">
        <Mail className="h-4 w-4 text-brand-teal-dark" aria-hidden="true" />
        <a href={`mailto:${email}`} className="font-semibold text-brand-teal-dark hover:underline">
          {email}
        </a>
      </p>
      <div className="mt-10">
        <ArrowLink href="/" direction="left" className="justify-center">
          Back to Home
        </ArrowLink>
      </div>
    </div>
  );
}
