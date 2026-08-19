export function choosePolicy(policies, { payer, service } = {}) {
  const active = (Array.isArray(policies) ? policies : []).filter((policy) => policy.active && policy.active_version);
  if (!active.length) return null;

  const payerText = String(payer || "").toLowerCase();
  const serviceText = String(service || "").toLowerCase();
  const tokens = serviceText
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .slice(0, 8);

  const scored = active.map((policy) => {
    const name = `${policy.name || ""} ${policy.description || ""}`.toLowerCase();
    let score = 0;
    if (payerText && name.includes(payerText)) score += 10;
    tokens.forEach((token) => {
      if (name.includes(token)) score += 2;
    });
    return { policy, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.policy || active[0];
}
