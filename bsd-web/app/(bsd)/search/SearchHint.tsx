// Under the search box when a synonym added words to the search, for example a Bangla spelling. Nothing for most searches.
// CLIENT-REVIEW: new string, goes on the sign-off list.
export default function SearchHint({ expandedFrom }: { expandedFrom?: { term: string; expansions: string[] }[] }) {
  const words = [...new Set((expandedFrom ?? []).flatMap((e) => e.expansions))];
  if (words.length === 0) return null;
  return (
    <p className="mt-4 text-sm text-slate-600" role="status">
      Also showing results for {words.join(", ")}.
    </p>
  );
}
