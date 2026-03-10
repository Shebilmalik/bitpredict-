export const CATEGORIES = {
  crypto   : { label: "Crypto",   color: "#f7931a", icon: "₿"  },
  sports   : { label: "Sports",   color: "#00c853", icon: "⚽" },
  politics : { label: "Politics", color: "#2979ff", icon: "🏛️" },
  other    : { label: "Other",    color: "#aa00ff", icon: "🔮" },
};

export async function fetchBTCPrice() {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true"
    );
    const d = await r.json();
    if (!d.bitcoin) return null;
    return { price: d.bitcoin.usd, change24h: d.bitcoin.usd_24h_change, marketCap: d.bitcoin.usd_market_cap };
  } catch (e) { return null; }
}

export async function fetchBTCDominance() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/global");
    const d = await r.json();
    return d.data?.market_cap_percentage?.btc ?? null;
  } catch (e) { return null; }
}

export function formatBTC(amount, decimals = 6) {
  const n = parseFloat(amount);
  if (isNaN(n) || n === 0) return "0";
  if (n < 0.000001) return "< 0.000001";
  return n.toFixed(decimals).replace(/\.?0+$/, "");
}

export function fmtUSD(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function formatTimeRemaining(endTime) {
  const diff = endTime - Date.now() / 1000;
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0,6)}…${addr.slice(-4)}`;
}

export function calcPotentialPayout(betAmount, myPool, totalPool) {
  const a  = parseFloat(betAmount);
  const my = parseFloat(myPool) + a;
  const tot = parseFloat(totalPool) + a;
  if (!my || !a) return "0";
  return ((a / my) * tot * 0.98).toFixed(6);
}
