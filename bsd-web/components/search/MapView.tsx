"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PIN_COLOURS, pinsToBounds, type Pin, type Point } from "@/lib/near-api";

// Leaflet with OpenStreetMap tiles: free, no key, no tracking code. This file is only loaded for the map view
// (next/dynamic with ssr off), so no other page carries any map code.
const SA1: [number, number] = [51.6267, -3.9404];

function popup(p: Pin["properties"]): HTMLElement {
  const box = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = p.name;
  const cat = document.createElement("div");
  cat.textContent = p.categoryName;
  const a = document.createElement("a");
  a.href = `/businesses/${encodeURIComponent(p.slug)}`;
  a.textContent = "View";
  a.style.cssText = "display:inline-block;padding:10px 0;font-weight:600";
  box.append(name, cat, a);
  return box;
}

export default function MapView({ pins, point }: { pins: Pin[]; point: Point | null }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const map = L.map(host.current, { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    for (const f of pins) {
      const [lng, lat] = f.geometry.coordinates;
      const colour = PIN_COLOURS[f.properties.verificationStatus] ?? "#2563eb";
      L.circleMarker([lat, lng], { radius: 9, color: "#ffffff", weight: 2, fillColor: colour, fillOpacity: 1 })
        .bindPopup(popup(f.properties))
        .bindTooltip(f.properties.name)
        .addTo(map);
    }
    if (point) L.circleMarker([point.lat, point.lng], { radius: 7, color: "#ffffff", weight: 2, fillColor: "#0f172a", fillOpacity: 1 }).bindTooltip("You are here").addTo(map);
    const bounds = pinsToBounds(pins);
    if (bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    else map.setView(point ? [point.lat, point.lng] : SA1, point ? 13 : 11);
    return () => {
      map.remove();
    };
  }, [pins, point]);

  return <div ref={host} role="region" aria-label="Map of businesses" className="h-[60vh] min-h-72 w-full rounded-xl border border-slate-200" />;
}
