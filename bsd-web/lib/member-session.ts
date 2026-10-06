// Which view the Pass and Marketplace placeholders show for the current visitor.

export const MODULE_FOR_SITE = { card: "CARD", market: "MARKETPLACE" } as const;

export function sessionView(member: { modules: string[] } | null, site: "card" | "market"): "out" | "join" | "in" {
  if (!member) return "out";
  return member.modules.includes(MODULE_FOR_SITE[site]) ? "in" : "join";
}
