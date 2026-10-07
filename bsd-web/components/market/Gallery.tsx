"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { mediaUrl, type MarketImage } from "@/lib/market-api";

// Main image plus up to five thumbnails. The images already carry the bsd.wales watermark from the server.

export default function Gallery({ images, title }: { images: MarketImage[]; title: string }) {
  const [i, setI] = useState(0);
  if (!images.length) {
    return (
      <div role="img" aria-label="No photos" className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <ImageOff className="h-10 w-10" aria-hidden="true" />
      </div>
    );
  }
  const main = images[Math.min(i, images.length - 1)]!;
  return (
    <div>
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(main.url)} alt={`${title}, photo ${i + 1} of ${images.length}`} width={main.width} height={main.height} className="h-full w-full object-contain" />
      </div>
      {images.length > 1 && (
        <ul role="list" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, n) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setI(n)}
                aria-label={`Show photo ${n + 1}`}
                aria-current={n === i ? "true" : undefined}
                className={`block min-h-11 min-w-11 overflow-hidden rounded-lg border-2 ${n === i ? "border-bc-bar" : "border-transparent"} touch-manipulation`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(img.thumbUrl)} alt="" loading="lazy" className="h-16 w-16 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
