import type { ReactNode } from "react";

// Renders client document copy section by section, keeping the document's own structure: a string is a paragraph,
// { list } is a bulleted list, and any other node (a paragraph with a link, for example) is rendered as given.
export type DocBlock = string | { list: ReactNode[] } | { node: ReactNode };
export type DocSection = { title: string; body: DocBlock[] };

export function DocSections({ sections }: { sections: DocSection[] }) {
  return (
    <div className="mt-8 space-y-8">
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="text-lg font-semibold text-brand-navy">{s.title}</h2>
          {s.body.map((b, i) =>
            typeof b === "string" ? (
              <p key={i} className="mt-2 text-slate-600">
                {b}
              </p>
            ) : "list" in b ? (
              <ul key={i} className="mt-2 list-disc space-y-1 pl-6 text-slate-600 marker:text-brand-teal">
                {b.list.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            ) : (
              <div key={i} className="mt-2 text-slate-600">
                {b.node}
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

export const docLink = "font-medium text-brand-teal-dark underline-offset-2 hover:underline";
