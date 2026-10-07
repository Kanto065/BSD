"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { List, LocateFixed, Map as MapIcon } from "lucide-react";
import BusinessCard from "@/components/BusinessCard";
import {
  DEFAULT_MILES, FALLBACK_POINT, RADIUS_CHOICES, distanceLabel, hiddenLine, nearPath, pinsPath, pointFromPostcode,
  type Miles, type NearFilters, type NearResult, type PinCollection, type Point,
} from "@/lib/near-api";

// Map code is fetched only when someone opens Map View.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <p role="status" className="text-sm text-slate-600">Loading map...</p>,
});

type Source = "gps" | "postcode" | "fallback";
type View = "list" | "map";

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold";
const chip = (on: boolean) => `${btn} border ${on ? "border-brand-blue bg-brand-blue text-white" : "border-slate-300 bg-white text-brand-navy hover:border-brand-blue"}`;

// Rendered only in the browser after hydration, so the server HTML of the search page does not change. The
// visitor's position is held in state only: not stored, not put in the page address.
export default function NearMePanel({ apiBase, filters }: { apiBase: string; filters: NearFilters }) {
  const [mounted, setMounted] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const [source, setSource] = useState<Source>("gps");
  const [notice, setNotice] = useState("");
  const [miles, setMiles] = useState<Miles>(DEFAULT_MILES);
  const [view, setView] = useState<View>("list");
  const [near, setNear] = useState<NearResult | null>(null);
  const [pins, setPins] = useState<PinCollection | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [postcode, setPostcode] = useState("");
  const { q, category, zone } = filters;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!point) return;
    const ctl = new AbortController();
    setBusy(true);
    setFailed(false);
    fetch(`${apiBase}/${nearPath(point, miles, { q, category })}`, { signal: ctl.signal })
      .then(async (res) => {
        if (res.status === 400 && source !== "fallback") {
          // Outside the BSD area: use the SA1 point instead.
          setSource("fallback");
          setPoint(FALLBACK_POINT);
          return;
        }
        if (!res.ok) throw new Error("near failed");
        setNear((await res.json()) as NearResult);
      })
      .catch((e) => { if (!ctl.signal.aborted) { setFailed(true); console.debug(e instanceof Error ? e.message : e); } })
      .finally(() => { if (!ctl.signal.aborted) setBusy(false); });
    return () => ctl.abort();
  }, [apiBase, point, miles, q, category, source]);

  useEffect(() => {
    if (view !== "map") return;
    const ctl = new AbortController();
    setFailed(false);
    fetch(`${apiBase}/${pinsPath({ q, category, zone })}`, { signal: ctl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("pins failed"))))
      .then((d: PinCollection) => setPins(d))
      .catch(() => { if (!ctl.signal.aborted) setFailed(true); });
    return () => ctl.abort();
  }, [apiBase, view, q, category, zone]);

  if (!mounted) return null;

  const useFallback = (why: string) => { setSource("fallback"); setNotice(why); setPoint(FALLBACK_POINT); };
  function locate() {
    setNotice("");
    if (!("geolocation" in navigator)) return useFallback("Your browser cannot share its location. You can enter your postcode instead.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setSource("gps"); setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      (err) => {
        setBusy(false);
        useFallback(err.code === 1 ? "Location permission was denied. You can enter your postcode instead." : "We could not find your location. You can enter your postcode instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  }
  function byPostcode(e: React.FormEvent) {
    e.preventDefault();
    const p = pointFromPostcode(postcode);
    if (!p) return setNotice("That postcode is not in the BSD area. Try one that starts with SA, for example SA1 or SA5.");
    setNotice("");
    setSource("postcode");
    setPoint(p);
  }

  return (
    <section aria-labelledby="near-title" className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
      <h2 id="near-title" className="sr-only">Near you</h2>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={locate} className={`${btn} bg-brand-teal-dark text-white hover:bg-brand-navy`}>
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          Near Me
        </button>
        <div role="group" aria-label="View" className="ml-auto flex gap-2">
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={chip(view === "list")}>
            <List className="h-4 w-4" aria-hidden="true" />
            List View
          </button>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={chip(view === "map")}>
            <MapIcon className="h-4 w-4" aria-hidden="true" />
            Map View
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-600">We use your location only to find businesses near you. It is not saved.</p>

      <form onSubmit={byPostcode} className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="near-postcode" className="block text-sm text-slate-700">Or enter your postcode</label>
          <input
            id="near-postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            maxLength={9}
            autoComplete="postal-code"
            placeholder="SA1 4PE"
            className="mt-1 min-h-11 w-40 rounded-md border border-slate-300 px-3 text-base focus:border-brand-blue focus:outline-none sm:text-sm"
          />
        </div>
        <button type="submit" className={`${btn} border border-slate-300 text-brand-navy hover:border-brand-blue`}>Use postcode</button>
      </form>

      <div role="status" className="mt-3 text-sm text-slate-700">
        {notice && <p>{notice}</p>}
        {source === "fallback" && point && <p>Showing results near Swansea City Centre.</p>}
        {failed && <p>This could not load right now. Please try again.</p>}
      </div>

      {point && (
        <div role="group" aria-label="Distance" className="mt-3 flex flex-wrap gap-2">
          {RADIUS_CHOICES.map((r) => (
            <button key={r.miles} type="button" aria-pressed={miles === r.miles} onClick={() => setMiles(r.miles)} className={chip(miles === r.miles)}>
              {r.label}
            </button>
          ))}
        </div>
      )}

      {view === "map" && (
        <div className="mt-4">
          {pins ? (
            <>
              <MapView pins={pins.features} point={point} />
              <p className="mt-2 text-sm text-slate-600">
                {pins.features.length === 0 ? "No businesses with a map location match your search yet. " : ""}
                {pins.meta.hiddenCount > 0 ? hiddenLine(pins.meta.hiddenCount) + "." : ""}
              </p>
              <p className="text-sm text-slate-600">Prefer text? Switch to List View.</p>
            </>
          ) : (
            !failed && <p role="status" className="text-sm text-slate-600">Loading map...</p>
          )}
        </div>
      )}

      {view === "list" && point && near && (
        <div className="mt-4" aria-busy={busy}>
          <h3 className="text-base font-semibold text-brand-navy">
            Within {near.miles} {near.miles === 1 ? "mile" : "miles"} ({near.total})
          </h3>
          {near.items.length === 0 ? (
            <p className="mt-2 text-slate-600">No businesses found within {near.miles} {near.miles === 1 ? "mile" : "miles"}. Try a wider distance.</p>
          ) : (
            <ul className="mt-3 grid gap-4 sm:grid-cols-2">
              {near.items.map((b) => (
                <li key={b.slug}>
                  {b.distanceMiles !== null && (
                    <p className="mb-1 text-sm font-semibold text-brand-teal-dark">
                      {b.distanceApproximate ? "About " : ""}
                      {distanceLabel(b.distanceMiles)} away
                    </p>
                  )}
                  <BusinessCard business={b} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
