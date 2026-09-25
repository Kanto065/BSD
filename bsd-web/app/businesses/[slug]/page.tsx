import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Clock, Globe, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ArrowLink } from "@/components/ArrowLink";
import VerificationBadge from "@/components/VerificationBadge";
import { businessBySlug, publicApiBase, safeExternalUrl, whatsappLink } from "@/lib/api";
import ListingRequests from "@/components/ListingRequests";
import { SITE_URL } from "@/lib/content";

// Business pages are rendered on demand the first time they are visited, then cached and refreshed from the API at
// most once a minute. None are built ahead of time, so the build never depends on the API.
export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const result = await businessBySlug(slug);
  if (!result.ok) return { title: "Listing not found", robots: { index: false, follow: false } };
  const b = result.data;
  const where = b.localities[0]?.name ?? b.zone.name;
  const description = `${b.name}, ${b.category.name} in ${where}. ${b.description}`.slice(0, 200);
  return {
    title: b.name,
    description,
    alternates: { canonical: `/businesses/${b.slug}` },
    openGraph: { title: b.name, description, url: `${SITE_URL}/businesses/${b.slug}` },
  };
}

// Text that owners typed is rendered as plain text by React. The one place a value becomes a link is guarded:
// only real http(s) URLs (see safeExternalUrl), and WhatsApp numbers are reduced to digits.
export default async function BusinessPage({ params }: { params: Params }) {
  const { slug } = await params;
  const result = await businessBySlug(slug);
  if (!result.ok) {
    if (result.reason === "not_found") notFound();
    // Fail loudly rather than cache an error page: on a refresh Next keeps serving the last good version.
    throw new Error("The BSD API is unavailable");
  }
  const b = result.data;

  const website = safeExternalUrl(b.websiteOrSocial);
  const wa = b.whatsapp ? whatsappLink(b.whatsapp) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    description: b.description,
    url: `${SITE_URL}/businesses/${b.slug}`,
    telephone: b.phone,
    ...(b.email ? { email: b.email } : {}),
    // Home-based listings carry the district only, never a full postcode or street address.
    address: {
      "@type": "PostalAddress",
      ...(b.postcode && b.address ? { streetAddress: b.address } : {}),
      postalCode: b.postcode ?? b.postcodeDistrict,
      addressRegion: "Wales",
      addressCountry: "GB",
    },
    areaServed: [...b.localities.map((l) => l.name), ...b.servedZones.map((z) => z.name)],
    ...(website ? { sameAs: [website] } : {}),
  };

  const contactLink = "inline-flex items-center gap-2 font-semibold text-brand-navy hover:text-brand-blue hover:underline";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        // "<" is escaped so no text in a listing can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ArrowLink href={`/categories/${b.category.slug}`} direction="left" className="text-sm">
        {b.category.name}
      </ArrowLink>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {b.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logoUrl} alt={`${b.name} logo`} className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 bg-white object-contain" />
          )}
          <div>
          <h1 className="text-3xl font-bold text-brand-navy">{b.name}</h1>
          <p className="mt-1 font-medium text-brand-teal-dark">
            {b.category.name}
            {b.subcategory ? ` · ${b.subcategory.name}` : ""}
          </p>
          </div>
        </div>
        <VerificationBadge status={b.verificationStatus} />
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-brand-navy">About</h2>
            <p className="mt-3 whitespace-pre-line text-slate-600">{b.description}</p>
          </section>

          {b.servicesOffered.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-brand-navy">Services Offered</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
                {b.servicesOffered.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          {b.openingHours && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-brand-navy">
                <Clock className="h-5 w-5 text-brand-teal" aria-hidden="true" />
                Opening Hours
              </h2>
              <p className="mt-3 whitespace-pre-line text-slate-600">{b.openingHours}</p>
            </section>
          )}

          {b.specialNotes && (
            <section>
              <h2 className="text-xl font-semibold text-brand-navy">Special Notes</h2>
              <p className="mt-3 whitespace-pre-line text-slate-600">{b.specialNotes}</p>
            </section>
          )}

          {b.photos.filter((p) => !p.isLogo).length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-brand-navy">Photos</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {b.photos
                  .filter((p) => !p.isLogo)
                  .map((p) => (
                    <a key={p.url} href={p.url} target="_blank" rel="noopener" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.thumbUrl ?? p.url}
                        alt={b.name}
                        loading="lazy"
                        width={p.width ?? undefined}
                        height={p.height ?? undefined}
                        className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                      />
                    </a>
                  ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-brand-navy">Contact</h2>
            <ul className="mt-3 space-y-3 text-sm">
              <li>
                <a href={`tel:${b.phone.replace(/\s+/g, "")}`} className={contactLink}>
                  <Phone className="h-4 w-4 text-brand-teal" aria-hidden="true" />
                  {b.phone}
                </a>
              </li>
              {wa && (
                <li>
                  <a href={wa} target="_blank" rel="noopener noreferrer" className={contactLink}>
                    <MessageCircle className="h-4 w-4 text-brand-teal" aria-hidden="true" />
                    WhatsApp
                  </a>
                </li>
              )}
              {b.email && (
                <li>
                  <a href={`mailto:${b.email}`} className={`${contactLink} break-all`}>
                    <Mail className="h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" />
                    {b.email}
                  </a>
                </li>
              )}
              {b.websiteOrSocial && (
                <li>
                  {website ? (
                    <a href={website} target="_blank" rel="nofollow noopener noreferrer" className={`${contactLink} break-all`}>
                      <Globe className="h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" />
                      {b.websiteOrSocial}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 break-all text-slate-600">
                      <Globe className="h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" />
                      {b.websiteOrSocial}
                    </span>
                  )}
                </li>
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-navy">
              <MapPin className="h-5 w-5 text-brand-teal" aria-hidden="true" />
              Location
            </h2>
            <p className="mt-3 text-sm text-slate-600">{b.address ?? "HomeBased"}</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{b.postcode ?? b.postcodeDistrict}</p>
            {b.localities.length > 0 && <p className="mt-2 text-sm text-slate-600">{b.localities.map((l) => l.name).join(", ")}</p>}
            <p className="mt-2 text-sm">
              <Link href={`/${b.zone.slug}`} className="font-semibold text-brand-teal-dark hover:underline">
                {b.zone.name}
              </Link>
            </p>
            {(b.servedZones.length > 0 || b.otherAreaText) && (
              <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Also serves</p>
                {b.servedZones.length > 0 && <p className="mt-1">{b.servedZones.map((z) => z.name).join(", ")}</p>}
                {b.otherAreaText && <p className="mt-1">{b.otherAreaText}</p>}
              </div>
            )}
          </section>
        </aside>
      </div>

      <footer className="mt-12 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Information provided by business owner.</p>
        <p className="mt-2">
          The badge above shows the verification status of this listing.{" "}
          <Link href="/verification-policy" className="font-semibold text-brand-teal-dark hover:underline">
            How verification works
          </Link>
          .
        </p>
        <p className="mt-2">Is this your business, or is something wrong? Claim it, or ask us to update or remove it.</p>
        <ListingRequests apiBase={publicApiBase()} slug={b.slug} businessName={b.name} />
      </footer>
    </div>
  );
}
