import { useState, useEffect, createContext, useContext, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useWallet }                      from "./hooks/useWallet.js";
import { useMarkets, useBetActions, useUserBets } from "./hooks/useMarkets.js";
import {
  fetchBTCPrice, fetchBTCDominance,
  formatBTC, fmtUSD, formatTimeRemaining,
  CATEGORIES, calcPotentialPayout,
} from "./utils/oracle.js";

// ─────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────
const Ctx = createContext(null);
const useCtx = () => useContext(Ctx);

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
function Toasts({ list }) {
  return (
    <div style={{ position:"fixed", top:20, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:10 }}>
      {list.map(t => (
        <div key={t.id} style={{
          background: t.type==="error" ? "#1a0808" : "#081a0e",
          border:`1px solid ${t.type==="error" ? "#c0392b" : "#27ae60"}`,
          borderRadius:10, padding:"12px 18px", minWidth:280, maxWidth:360,
          animation:"slideIn .25s ease", boxShadow:`0 8px 32px ${t.type==="error"?"#c0392b22":"#27ae6022"}`,
        }}>
          <div style={{ fontSize:12, fontWeight:700, color: t.type==="error"?"#e74c3c":"#2ecc71", marginBottom:4 }}>
            {t.type==="error" ? "✕  Error" : "✓  Confirmed"}
          </div>
          <div style={{ fontSize:13, color:"#ccc" }}>{t.message}</div>
          {t.txHash && <div style={{ fontSize:10, color:"#555", marginTop:4, fontFamily:"monospace" }}>
            TX: {t.txHash.slice(0,28)}…
          </div>}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────
const NAV = [
  { id:"dashboard", icon:"⬡", label:"Dashboard"     },
  { id:"markets",   icon:"◈", label:"Markets"        },
  { id:"create",    icon:"⊕", label:"Create Market"  },
  { id:"mybets",    icon:"◎", label:"My Bets"        },
  { id:"analytics", icon:"▲", label:"Analytics"      },
  { id:"admin",     icon:"⚙", label:"Admin"          },
];

function Sidebar({ page, setPage }) {
  return (
    <aside style={{
      width:220, height:"100vh", position:"fixed", left:0, top:0,
      background:"#07070a", borderRight:"1px solid #141418",
      display:"flex", flexDirection:"column",
    }}>
      {/* Logo */}
      <div style={{ padding:"24px 22px 20px", borderBottom:"1px solid #141418" }}>
        <div style={{ fontSize:22, fontWeight:900, letterSpacing:-0.5 }}>
          <span style={{ color:"#f7931a" }}>Bit</span>
          <span style={{ color:"#e8e8f0" }}>Predict</span>
        </div>
        <div style={{ fontSize:10, color:"#3a3a50", marginTop:3, letterSpacing:1 }}>
          BITCOIN PREDICTION MARKET
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"16px 10px" }}>
        {NAV.map(n => {
          const active = page === n.id;
          return (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:10,
              padding:"10px 12px", borderRadius:8, border:"none", cursor:"pointer",
              background: active ? "#12121a" : "transparent",
              color: active ? "#f7931a" : "#4a4a65",
              fontSize:13, fontWeight: active ? 600 : 400,
              marginBottom:2, textAlign:"left", transition:"all .15s",
              borderLeft: active ? "2px solid #f7931a" : "2px solid transparent",
            }}>
              <span style={{ fontSize:15, width:18, textAlign:"center" }}>{n.icon}</span>
              {n.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding:"16px 22px", borderTop:"1px solid #141418" }}>
        <div style={{ fontSize:10, color:"#2a2a3a" }}>WEEK 3 · OP_NET VIBECODING</div>
        <div style={{ fontSize:10, color:"#f7931a", marginTop:2 }}>#opnetvibecode</div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// TOP BAR
// ─────────────────────────────────────────────
function TopBar() {
  const { wallet } = useCtx();

  return (
    <header style={{
      position:"sticky", top:0, zIndex:50,
      background:"#07070a", borderBottom:"1px solid #141418",
      padding:"12px 32px", display:"flex", justifyContent:"space-between", alignItems:"center",
    }}>
      {/* Left — chain info */}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {wallet.isConnected && (
          <>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#2ecc71", display:"inline-block" }} />
            <span style={{ fontSize:11, color:"#3a3a55", letterSpacing:1 }}>
              {wallet.walletName?.toUpperCase()} · CHAIN {wallet.chainId}
            </span>
          </>
        )}
        {!wallet.isConnected && (
          <span style={{ fontSize:11, color:"#2a2a3a", letterSpacing:1 }}>NOT CONNECTED</span>
        )}
      </div>

      {/* Right — wallet button */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
        {wallet.isConnected ? (
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            {/* Balance */}
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:9, color:"#3a3a50", letterSpacing:1 }}>BALANCE</div>
              <div style={{ fontSize:13, fontWeight:700, color:"#f7931a", fontFamily:"monospace" }}>
                {parseFloat(wallet.balance).toFixed(6)} BTC
              </div>
            </div>

            {/* Address pill */}
            <button onClick={wallet.disconnect} style={{
              display:"flex", alignItems:"center", gap:8,
              background:"#12121a", border:"1px solid #1e1e2a",
              color:"#a0a0c0", padding:"8px 16px", borderRadius:8,
              cursor:"pointer", fontSize:12, transition:"border-color .15s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor="#e74c3c"}
              onMouseLeave={e => e.currentTarget.style.borderColor="#1e1e2a"}
              title="Click to disconnect"
            >
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#2ecc71", display:"inline-block", flexShrink:0 }} />
              {wallet.shortAddr}
              <span style={{ fontSize:9, color:"#3a3a55", marginLeft:4 }}>✕</span>
            </button>
          </div>
        ) : (
          <button
            onClick={wallet.connect}
            disabled={wallet.connecting}
            style={{
              display:"flex", alignItems:"center", gap:10,
              background: wallet.connecting
                ? "#1a1a25"
                : "linear-gradient(135deg, #f7931a, #e67e22)",
              border: wallet.connecting ? "1px solid #2a2a3a" : "none",
              color:"#fff", padding:"11px 24px", borderRadius:9,
              cursor: wallet.connecting ? "not-allowed" : "pointer",
              fontSize:13, fontWeight:700, letterSpacing:.3,
              boxShadow: wallet.connecting ? "none" : "0 4px 20px #f7931a44",
              transition:"all .2s",
            }}
          >
            {/* OP Wallet logo circle */}
            <span style={{
              width:18, height:18, borderRadius:"50%",
              background: wallet.connecting ? "#333" : "#fff",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:10, fontWeight:900,
              color: wallet.connecting ? "#666" : "#f7931a",
              flexShrink:0,
            }}>
              {wallet.connecting ? "⟳" : "⬡"}
            </span>
            {wallet.connecting ? "Connecting to OP Wallet…" : "Connect OP Wallet"}
          </button>
        )}

        {/* Error message */}
        {wallet.error && (
          <div style={{
            fontSize:11, color:"#e74c3c", maxWidth:380, textAlign:"right",
            background:"#1a0808", border:"1px solid #c0392b44",
            padding:"5px 10px", borderRadius:6, marginTop:2,
          }}>
            ⚠ {wallet.error}
          </div>
        )}
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────
// SHARED: ODDS BAR
// ─────────────────────────────────────────────
function OddsBar({ yes, no }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:5 }}>
        <span style={{ color:"#2ecc71" }}>YES {yes.toFixed(1)}%</span>
        <span style={{ color:"#e74c3c" }}>NO {no.toFixed(1)}%</span>
      </div>
      <div style={{ height:5, background:"#12121a", borderRadius:3, overflow:"hidden" }}>
        <div style={{
          height:"100%", borderRadius:3,
          background:"linear-gradient(90deg,#2ecc71,#27ae60)",
          width:`${yes}%`, transition:"width .5s ease",
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MARKET CARD
// ─────────────────────────────────────────────
function MarketCard({ market }) {
  const { wallet, onBet } = useCtx();
  const cat = CATEGORIES[market.category] || CATEGORIES.other;
  const timeLeft = formatTimeRemaining(market.endTime);

  return (
    <div style={{
      background:"#0a0a10", border:"1px solid #141418", borderRadius:12,
      padding:20, display:"flex", flexDirection:"column", gap:14,
      transition:"border-color .2s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor="#2a2a40"}
      onMouseLeave={e => e.currentTarget.style.borderColor="#141418"}
    >
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{
          background:cat.color+"18", color:cat.color,
          padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600,
        }}>{cat.icon} {cat.label}</span>
        <span style={{
          background: market.isActive ? "#2ecc7115" : market.resolved ? "#2979ff15" : "#e74c3c15",
          color: market.isActive ? "#2ecc71" : market.resolved ? "#2979ff" : "#e74c3c",
          padding:"3px 10px", borderRadius:20, fontSize:11,
        }}>
          {market.cancelled ? "Cancelled"
            : market.resolved ? (market.outcome ? "✓ YES Won" : "✓ NO Won")
            : `⏱ ${timeLeft}`}
        </span>
      </div>

      {/* Question */}
      <div style={{ fontSize:14, fontWeight:600, color:"#e0e0f0", lineHeight:1.45 }}>
        {market.question}
      </div>

      <OddsBar yes={market.yesOdds} no={market.noOdds} />

      {/* Footer */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:10, color:"#3a3a50", marginBottom:2 }}>VOLUME</div>
          <div style={{ fontSize:13, fontWeight:700, color:"#f7931a", fontFamily:"monospace" }}>
            {formatBTC(market.totalPool)} BTC
          </div>
        </div>
        {market.isActive && wallet.isConnected && (
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => onBet(market, true)} style={{
              background:"#2ecc7120", border:"1px solid #2ecc71", color:"#2ecc71",
              padding:"6px 16px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700,
            }}>YES</button>
            <button onClick={() => onBet(market, false)} style={{
              background:"#e74c3c20", border:"1px solid #e74c3c", color:"#e74c3c",
              padding:"6px 16px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700,
            }}>NO</button>
          </div>
        )}
        {market.isActive && !wallet.isConnected && (
          <div style={{ fontSize:11, color:"#3a3a50" }}>Connect wallet to bet</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BET MODAL
// ─────────────────────────────────────────────
function BetModal({ market, side, onClose }) {
  const { betActions, refetch, wallet } = useCtx();
  const [amount, setAmount] = useState("0.001");

  const payout = calcPotentialPayout(
    amount,
    side ? market.yesPool : market.noPool,
    market.totalPool
  );

  const confirm = async () => {
    const hash = await betActions.placeBet(market.id, side, amount);
    if (hash) { refetch(); onClose(); }
  };

  return (
    <div style={{
      position:"fixed", inset:0, background:"#000000bb", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center",
    }} onClick={onClose}>
      <div style={{
        background:"#0d0d14", border:"1px solid #1e1e2a", borderRadius:16,
        padding:28, width:400, maxWidth:"92vw",
        animation:"fadeUp .2s ease",
      }} onClick={e => e.stopPropagation()}>

        <div style={{ fontSize:18, fontWeight:800, color:"#e8e8f0", marginBottom:6 }}>Place Bet</div>
        <div style={{ fontSize:12, color:"#4a4a65", marginBottom:20, lineHeight:1.4 }}>{market.question}</div>

        {/* Side badge */}
        <div style={{
          background: side ? "#2ecc7115" : "#e74c3c15",
          border:`1px solid ${side?"#2ecc71":"#e74c3c"}`,
          borderRadius:8, padding:"10px 16px", marginBottom:20,
          fontSize:14, fontWeight:700, color: side?"#2ecc71":"#e74c3c", textAlign:"center",
        }}>
          You are betting: {side ? "✓ YES" : "✗ NO"}
        </div>

        {/* Amount */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, color:"#4a4a65", display:"block", marginBottom:6, letterSpacing:1 }}>
            AMOUNT (BTC)
          </label>
          <input type="number" step="0.001" min="0.001" value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{
              width:"100%", background:"#12121a", border:"1px solid #1e1e2a",
              color:"#e8e8f0", padding:"10px 14px", borderRadius:8, fontSize:14,
              outline:"none", boxSizing:"border-box",
            }}
          />
          <div style={{ display:"flex", gap:6, marginTop:8 }}>
            {["0.001","0.01","0.1","0.5","1"].map(v => (
              <button key={v} onClick={() => setAmount(v)} style={{
                flex:1, background: amount===v ? "#1e1e2a" : "#12121a",
                border:`1px solid ${amount===v?"#3a3a55":"#1e1e2a"}`,
                color:"#6a6a85", padding:"5px 0", borderRadius:6,
                cursor:"pointer", fontSize:11,
              }}>{v}</button>
            ))}
          </div>
        </div>

        {/* Payout info */}
        <div style={{ background:"#0a0a10", borderRadius:8, padding:"12px 16px", marginBottom:22 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#4a4a65", marginBottom:5 }}>
            <span>Current odds</span>
            <span style={{ color:"#e8e8f0" }}>{side ? market.yesOdds.toFixed(1) : market.noOdds.toFixed(1)}%</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#4a4a65", marginBottom:5 }}>
            <span>Platform fee</span>
            <span>2%</span>
          </div>
          <div style={{ borderTop:"1px solid #1a1a25", marginTop:8, paddingTop:8, display:"flex", justifyContent:"space-between", fontSize:13, fontWeight:700 }}>
            <span style={{ color:"#4a4a65" }}>Potential payout</span>
            <span style={{ color:"#2ecc71", fontFamily:"monospace" }}>{payout} BTC</span>
          </div>
        </div>

        {betActions.error && (
          <div style={{ background:"#1a0808", border:"1px solid #c0392b", borderRadius:8, padding:"8px 14px", marginBottom:16, fontSize:12, color:"#e74c3c" }}>
            {betActions.error}
          </div>
        )}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{
            flex:1, background:"#12121a", border:"1px solid #1e1e2a", color:"#6a6a85",
            padding:"12px", borderRadius:8, cursor:"pointer", fontSize:13,
          }}>Cancel</button>
          <button onClick={confirm} disabled={betActions.pending || parseFloat(amount) <= 0} style={{
            flex:2, border:"none", color: side ? "#000" : "#fff",
            background: side
              ? "linear-gradient(135deg,#2ecc71,#27ae60)"
              : "linear-gradient(135deg,#e74c3c,#c0392b)",
            padding:"12px", borderRadius:8, cursor:"pointer",
            fontSize:14, fontWeight:700, opacity: betActions.pending ? .6 : 1,
          }}>
            {betActions.pending ? "Signing transaction…" : `Confirm ${side?"YES":"NO"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
function Dashboard() {
  const { markets, totalVolume } = useCtx();
  const [btc, setBtc] = useState(null);
  const [dom, setDom] = useState(null);

  useEffect(() => {
    fetchBTCPrice().then(setBtc);
    fetchBTCDominance().then(setDom);
  }, []);

  const active   = markets.filter(m => m.isActive);
  const resolved = markets.filter(m => m.resolved);

  const statCards = [
    { label:"Active Markets",  value: active.length,                          color:"#f7931a" },
    { label:"Total Volume",    value: `${formatBTC(totalVolume)} BTC`,        color:"#2ecc71" },
    { label:"BTC Price",       value: btc ? fmtUSD(btc.price)  : "—",        color:"#3498db" },
    { label:"BTC Dominance",   value: dom ? `${dom.toFixed(1)}%` : "—",      color:"#9b59b6" },
    { label:"Resolved",        value: resolved.length,                        color:"#1abc9c" },
    { label:"Platform Fee",    value: "2 %",                                  color:"#e67e22" },
  ];

  const chartData = markets.slice(-10).map(m => ({
    name  : `#${m.id}`,
    volume: parseFloat(m.totalPool),
  }));

  return (
    <div style={{ animation:"fadeUp .3s ease" }}>
      <h1 style={{ fontSize:26, fontWeight:900, color:"#e8e8f0", marginBottom:6 }}>Dashboard</h1>
      <p style={{ fontSize:13, color:"#3a3a55", marginBottom:28 }}>
        Decentralized prediction markets on Bitcoin L1 · OP_NET
      </p>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:28 }}>
        {statCards.map(s => (
          <div key={s.label} style={{
            background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:"18px 22px",
          }}>
            <div style={{ fontSize:10, color:"#3a3a50", marginBottom:8, letterSpacing:1 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color, fontFamily:"monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* BTC Price card */}
      {btc && (
        <div style={{
          background:"#0a0a10", border:"1px solid #141418", borderRadius:12,
          padding:"20px 24px", marginBottom:28, display:"flex", justifyContent:"space-between", alignItems:"center",
        }}>
          <div>
            <div style={{ fontSize:10, color:"#3a3a50", letterSpacing:1, marginBottom:6 }}>BITCOIN LIVE PRICE</div>
            <div style={{ fontSize:36, fontWeight:900, color:"#f7931a", fontFamily:"monospace" }}>
              {fmtUSD(btc.price)}
            </div>
            <div style={{ fontSize:12, color:"#3a3a55", marginTop:4 }}>
              Market Cap: {fmtUSD(btc.marketCap)}
            </div>
          </div>
          <div style={{
            fontSize:20, fontWeight:800,
            color: btc.change24h >= 0 ? "#2ecc71" : "#e74c3c",
          }}>
            {btc.change24h >= 0 ? "▲" : "▼"} {Math.abs(btc.change24h).toFixed(2)}%
            <div style={{ fontSize:11, color:"#3a3a50", fontWeight:400 }}>24h change</div>
          </div>
        </div>
      )}

      {/* Volume chart */}
      {chartData.length > 0 && (
        <div style={{ background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:"20px 24px", marginBottom:28 }}>
          <div style={{ fontSize:12, color:"#3a3a50", letterSpacing:1, marginBottom:16 }}>MARKET VOLUME (BTC)</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f7931a" stopOpacity={.35} />
                  <stop offset="95%" stopColor="#f7931a" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="#1a1a25" tick={{ fill:"#3a3a55", fontSize:10 }} />
              <YAxis              stroke="#1a1a25" tick={{ fill:"#3a3a55", fontSize:10 }} />
              <Tooltip contentStyle={{ background:"#0d0d14", border:"1px solid #1e1e2a", borderRadius:8, fontSize:11 }} />
              <Area type="monotone" dataKey="volume" stroke="#f7931a" fill="url(#vg)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Latest markets */}
      <div style={{ fontSize:12, color:"#3a3a50", letterSpacing:1, marginBottom:14 }}>LATEST MARKETS</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
        {active.slice(0,4).map(m => <MarketCard key={m.id} market={m} />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MARKETS PAGE
// ─────────────────────────────────────────────
function Markets() {
  const { markets } = useCtx();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");

  const shown = markets.filter(m => {
    const catOk    = filter === "all" || m.category === filter;
    const searchOk = !search || m.question.toLowerCase().includes(search.toLowerCase());
    const statusOk =
      status === "all"      ? true :
      status === "active"   ? m.isActive :
      status === "resolved" ? m.resolved :
      m.cancelled;
    return catOk && searchOk && statusOk;
  });

  return (
    <div style={{ animation:"fadeUp .3s ease" }}>
      <h1 style={{ fontSize:26, fontWeight:900, color:"#e8e8f0", marginBottom:6 }}>Markets</h1>
      <p style={{ fontSize:13, color:"#3a3a55", marginBottom:24 }}>{markets.filter(m=>m.isActive).length} active markets</p>

      {/* Filter bar */}
      <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap", alignItems:"center" }}>
        {["all","active","resolved","cancelled"].map(s => (
          <button key={s} onClick={() => setStatus(s)} style={{
            background: status===s ? "#f7931a" : "#12121a",
            border:`1px solid ${status===s?"#f7931a":"#1e1e2a"}`,
            color: status===s ? "#000" : "#5a5a75",
            padding:"5px 14px", borderRadius:20, cursor:"pointer", fontSize:12, fontWeight:600,
          }}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
        ))}
        <div style={{ width:1, height:20, background:"#1a1a25" }} />
        {Object.entries(CATEGORIES).map(([k,v]) => (
          <button key={k} onClick={() => setFilter(f => f===k ? "all" : k)} style={{
            background: filter===k ? v.color+"22" : "#12121a",
            border:`1px solid ${filter===k?v.color:"#1e1e2a"}`,
            color: filter===k ? v.color : "#5a5a75",
            padding:"5px 12px", borderRadius:20, cursor:"pointer", fontSize:12,
          }}>{v.icon} {v.label}</button>
        ))}
        <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{
          marginLeft:"auto", background:"#12121a", border:"1px solid #1e1e2a",
          color:"#e8e8f0", padding:"6px 14px", borderRadius:20, fontSize:12, outline:"none", width:180,
        }}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14 }}>
        {shown.map(m => <MarketCard key={m.id} market={m} />)}
        {shown.length === 0 && (
          <div style={{ gridColumn:"1/-1", textAlign:"center", padding:60, color:"#3a3a55" }}>No markets found</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CREATE MARKET
// ─────────────────────────────────────────────
const DURATION_OPTIONS = [
  { label:"1 Hour",   secs:3600        },
  { label:"6 Hours",  secs:21600       },
  { label:"1 Day",    secs:86400       },
  { label:"3 Days",   secs:259200      },
  { label:"7 Days",   secs:604800      },
  { label:"14 Days",  secs:1209600     },
  { label:"30 Days",  secs:2592000     },
];

function CreateMarket() {
  const { wallet, betActions, refetch, setPage } = useCtx();
  const [q, setQ]       = useState("");
  const [cat, setCat]   = useState("crypto");
  const [dur, setDur]   = useState("7 Days");
  const [img, setImg]   = useState("");
  const [done, setDone] = useState(null);

  if (!wallet.isConnected) return (
    <div style={{ textAlign:"center", padding:"80px 0" }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
      <div style={{ color:"#3a3a55", marginBottom:16 }}>Connect your wallet to create markets</div>
      <button onClick={wallet.connect} style={{
        background:"linear-gradient(135deg,#f7931a,#e67e22)", border:"none",
        color:"#fff", padding:"12px 28px", borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:700,
      }}>Connect OP Wallet</button>
    </div>
  );

  const submit = async () => {
    if (!q.trim()) return;
    const secs = DURATION_OPTIONS.find(d=>d.label===dur)?.secs ?? 604800;
    const hash = await betActions.createMarket(q.trim(), cat, secs, img);
    if (hash) {
      await refetch();
      setDone(hash);
      setQ(""); setImg("");
    }
  };

  return (
    <div style={{ maxWidth:580, animation:"fadeUp .3s ease" }}>
      <h1 style={{ fontSize:26, fontWeight:900, color:"#e8e8f0", marginBottom:6 }}>Create Market</h1>
      <p style={{ fontSize:13, color:"#3a3a55", marginBottom:28 }}>Deploy a new prediction market on-chain</p>

      {done && (
        <div style={{
          background:"#081a0e", border:"1px solid #27ae60", borderRadius:10, padding:"14px 18px",
          marginBottom:24, fontSize:13, color:"#2ecc71",
        }}>
          ✓ Market created on-chain!
          <div style={{ fontSize:10, color:"#3a3a55", marginTop:4, fontFamily:"monospace" }}>TX: {done.slice(0,40)}…</div>
          <button onClick={() => setPage("markets")} style={{
            marginTop:10, background:"transparent", border:"1px solid #2ecc71",
            color:"#2ecc71", padding:"5px 14px", borderRadius:6, cursor:"pointer", fontSize:12,
          }}>View Markets →</button>
        </div>
      )}

      <div style={{ background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:28 }}>
        {/* Question */}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:10, color:"#4a4a65", display:"block", marginBottom:8, letterSpacing:1 }}>
            QUESTION *
          </label>
          <textarea value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Will BTC reach $150,000 before December 2025?"
            rows={3} style={{
              width:"100%", background:"#12121a", border:"1px solid #1e1e2a",
              color:"#e8e8f0", padding:"12px 14px", borderRadius:8, fontSize:14,
              outline:"none", resize:"none", boxSizing:"border-box",
            }}/>
          <div style={{ fontSize:10, color:"#3a3a45", marginTop:4 }}>Must be a clear YES/NO question</div>
        </div>

        {/* Category + Duration */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
          <div>
            <label style={{ fontSize:10, color:"#4a4a65", display:"block", marginBottom:8, letterSpacing:1 }}>CATEGORY</label>
            <select value={cat} onChange={e=>setCat(e.target.value)} style={{
              width:"100%", background:"#12121a", border:"1px solid #1e1e2a",
              color:"#e8e8f0", padding:"10px 12px", borderRadius:8, fontSize:13, outline:"none",
            }}>
              {Object.entries(CATEGORIES).map(([k,v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:"#4a4a65", display:"block", marginBottom:8, letterSpacing:1 }}>DURATION</label>
            <select value={dur} onChange={e=>setDur(e.target.value)} style={{
              width:"100%", background:"#12121a", border:"1px solid #1e1e2a",
              color:"#e8e8f0", padding:"10px 12px", borderRadius:8, fontSize:13, outline:"none",
            }}>
              {DURATION_OPTIONS.map(d => <option key={d.label}>{d.label}</option>)}
            </select>
          </div>
        </div>

        {/* Image URL */}
        <div style={{ marginBottom:26 }}>
          <label style={{ fontSize:10, color:"#4a4a65", display:"block", marginBottom:8, letterSpacing:1 }}>IMAGE URL (optional)</label>
          <input value={img} onChange={e=>setImg(e.target.value)}
            placeholder="https://example.com/image.jpg"
            style={{
              width:"100%", background:"#12121a", border:"1px solid #1e1e2a",
              color:"#e8e8f0", padding:"10px 12px", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box",
            }}/>
        </div>

        {/* Preview */}
        {q && (
          <div style={{ background:"#12121a", borderRadius:8, padding:"14px 16px", marginBottom:22 }}>
            <div style={{ fontSize:10, color:"#3a3a50", marginBottom:8, letterSpacing:1 }}>PREVIEW</div>
            <div style={{ fontSize:14, color:"#c8c8e0", lineHeight:1.4 }}>{q}</div>
            <div style={{ display:"flex", gap:10, marginTop:10 }}>
              <span style={{ fontSize:11, color: CATEGORIES[cat]?.color }}>
                {CATEGORIES[cat]?.icon} {CATEGORIES[cat]?.label}
              </span>
              <span style={{ fontSize:11, color:"#3a3a55" }}>· {dur}</span>
            </div>
          </div>
        )}

        {betActions.error && (
          <div style={{ background:"#1a0808", border:"1px solid #c0392b", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12, color:"#e74c3c" }}>
            {betActions.error}
          </div>
        )}

        <button onClick={submit} disabled={betActions.pending || !q.trim()} style={{
          width:"100%",
          background: betActions.pending || !q.trim()
            ? "#1a1a25"
            : "linear-gradient(135deg,#f7931a,#e67e22)",
          border:"none", color: betActions.pending||!q.trim() ? "#4a4a65" : "#fff",
          padding:"14px", borderRadius:8, cursor: betActions.pending||!q.trim() ? "not-allowed" : "pointer",
          fontSize:15, fontWeight:700,
        }}>
          {betActions.pending ? "Creating on-chain…" : "Create Market →"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MY BETS
// ─────────────────────────────────────────────
function MyBets() {
  const { wallet, userBets, betActions, refetchBets } = useCtx();

  if (!wallet.isConnected) return (
    <div style={{ textAlign:"center", padding:"80px 0" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
      <div style={{ color:"#3a3a55" }}>Connect wallet to view your bets</div>
    </div>
  );

  const claimable = (b) => {
    if (b.claimed) return false;
    if (b.cancelled) return true;
    if (!b.resolved) return false;
    return (b.outcome && parseFloat(b.yesAmount) > 0) ||
           (!b.outcome && parseFloat(b.noAmount)  > 0);
  };

  const doClaim = async (id) => {
    await betActions.claimReward(id);
    refetchBets();
  };

  return (
    <div style={{ animation:"fadeUp .3s ease" }}>
      <h1 style={{ fontSize:26, fontWeight:900, color:"#e8e8f0", marginBottom:6 }}>My Bets</h1>
      <p style={{ fontSize:13, color:"#3a3a55", marginBottom:24 }}>{userBets.length} positions</p>

      {userBets.length === 0 && (
        <div style={{ textAlign:"center", padding:60, color:"#3a3a55" }}>No bets yet. Go to Markets to place your first bet!</div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {userBets.map(b => {
          const myYes = parseFloat(b.yesAmount);
          const myNo  = parseFloat(b.noAmount);
          const won  = b.resolved && ((b.outcome && myYes>0) || (!b.outcome && myNo>0));
          const lost = b.resolved && !won;

          return (
            <div key={b.marketId} style={{
              background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:20,
              display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16,
            }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color: CATEGORIES[b.category]?.color || "#888", marginBottom:6, letterSpacing:1 }}>
                  {CATEGORIES[b.category]?.icon} {b.category?.toUpperCase()}
                </div>
                <div style={{ fontSize:14, color:"#c8c8e0", lineHeight:1.4, marginBottom:12 }}>{b.question}</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {myYes > 0 && (
                    <span style={{ background:"#2ecc7118", color:"#2ecc71", padding:"3px 10px", borderRadius:20, fontSize:11, fontFamily:"monospace" }}>
                      YES: {formatBTC(myYes)} BTC
                    </span>
                  )}
                  {myNo > 0 && (
                    <span style={{ background:"#e74c3c18", color:"#e74c3c", padding:"3px 10px", borderRadius:20, fontSize:11, fontFamily:"monospace" }}>
                      NO: {formatBTC(myNo)} BTC
                    </span>
                  )}
                  {!b.resolved && !b.cancelled && (
                    <span style={{ background:"#f7931a18", color:"#f7931a", padding:"3px 10px", borderRadius:20, fontSize:11 }}>
                      ⏱ {formatTimeRemaining(b.endTime)}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ textAlign:"right", minWidth:110 }}>
                <div style={{
                  fontSize:11, fontWeight:700, marginBottom:10,
                  color: won?"#2ecc71" : lost?"#e74c3c" : b.cancelled?"#9b59b6" : "#f7931a",
                }}>
                  {won?"🏆 Won" : lost?"✗ Lost" : b.cancelled?"Cancelled" : "⏳ Active"}
                </div>
                {claimable(b) && (
                  <button onClick={() => doClaim(b.marketId)} disabled={betActions.pending} style={{
                    background:"linear-gradient(135deg,#f7931a,#e67e22)", border:"none",
                    color:"#fff", padding:"8px 18px", borderRadius:6,
                    cursor:"pointer", fontSize:12, fontWeight:700,
                    opacity: betActions.pending ? .6 : 1,
                  }}>Claim →</button>
                )}
                {b.claimed && <div style={{ fontSize:11, color:"#2ecc71" }}>Claimed ✓</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────
function Analytics() {
  const { markets, totalVolume } = useCtx();

  const byCat = Object.keys(CATEGORIES).map(k => ({
    name  : CATEGORIES[k].label,
    color : CATEGORIES[k].color,
    vol   : markets.filter(m=>m.category===k).reduce((s,m)=>s+parseFloat(m.totalPool),0),
    count : markets.filter(m=>m.category===k).length,
  }));

  const sentiment = markets.filter(m=>m.isActive).slice(0,8).map(m => ({
    name: `#${m.id}`,
    YES : m.yesOdds,
    NO  : m.noOdds,
  }));

  return (
    <div style={{ animation:"fadeUp .3s ease" }}>
      <h1 style={{ fontSize:26, fontWeight:900, color:"#e8e8f0", marginBottom:6 }}>Analytics</h1>
      <p style={{ fontSize:13, color:"#3a3a55", marginBottom:28 }}>Platform statistics</p>

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
        {[
          { l:"Total Markets",  v:markets.length               },
          { l:"Active",         v:markets.filter(m=>m.isActive).length },
          { l:"Resolved",       v:markets.filter(m=>m.resolved).length },
          { l:"Total Volume",   v:`${formatBTC(totalVolume)} BTC`      },
        ].map(s=>(
          <div key={s.l} style={{ background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:"16px 20px" }}>
            <div style={{ fontSize:10, color:"#3a3a50", letterSpacing:1, marginBottom:6 }}>{s.l.toUpperCase()}</div>
            <div style={{ fontSize:20, fontWeight:800, color:"#f7931a", fontFamily:"monospace" }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        {/* Volume by category */}
        <div style={{ background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:"20px 22px" }}>
          <div style={{ fontSize:10, color:"#3a3a50", letterSpacing:1, marginBottom:16 }}>VOLUME BY CATEGORY (BTC)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCat}>
              <XAxis dataKey="name" stroke="#1a1a25" tick={{ fill:"#4a4a65", fontSize:10 }} />
              <YAxis stroke="#1a1a25" tick={{ fill:"#4a4a65", fontSize:10 }} />
              <Tooltip contentStyle={{ background:"#0d0d14", border:"1px solid #1e1e2a", borderRadius:8, fontSize:11 }} />
              <Bar dataKey="vol" radius={[4,4,0,0]}>
                {byCat.map(entry => <Cell key={entry.name} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* YES / NO sentiment */}
        <div style={{ background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:"20px 22px" }}>
          <div style={{ fontSize:10, color:"#3a3a50", letterSpacing:1, marginBottom:16 }}>MARKET SENTIMENT (%)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sentiment}>
              <XAxis dataKey="name" stroke="#1a1a25" tick={{ fill:"#4a4a65", fontSize:10 }} />
              <YAxis stroke="#1a1a25" tick={{ fill:"#4a4a65", fontSize:10 }} domain={[0,100]} />
              <Tooltip contentStyle={{ background:"#0d0d14", border:"1px solid #1e1e2a", borderRadius:8, fontSize:11 }} />
              <Bar dataKey="YES" fill="#2ecc71" radius={[4,4,0,0]} />
              <Bar dataKey="NO"  fill="#e74c3c" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category breakdown table */}
      <div style={{ background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:"20px 22px" }}>
        <div style={{ fontSize:10, color:"#3a3a50", letterSpacing:1, marginBottom:16 }}>BREAKDOWN BY CATEGORY</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
          <div style={{ fontSize:10, color:"#3a3a55", padding:"6px 10px", letterSpacing:1 }}>CATEGORY</div>
          <div style={{ fontSize:10, color:"#3a3a55", padding:"6px 10px", letterSpacing:1 }}>MARKETS</div>
          <div style={{ fontSize:10, color:"#3a3a55", padding:"6px 10px", letterSpacing:1 }}>VOLUME (BTC)</div>
          <div style={{ fontSize:10, color:"#3a3a55", padding:"6px 10px", letterSpacing:1 }}>AVG POOL</div>
          {byCat.map(c => (
            <>
              <div key={c.name+"n"} style={{ fontSize:13, color:c.color, padding:"8px 10px" }}>{c.name}</div>
              <div key={c.name+"c"} style={{ fontSize:13, color:"#8a8aaa", padding:"8px 10px", fontFamily:"monospace" }}>{c.count}</div>
              <div key={c.name+"v"} style={{ fontSize:13, color:"#8a8aaa", padding:"8px 10px", fontFamily:"monospace" }}>{formatBTC(c.vol)}</div>
              <div key={c.name+"a"} style={{ fontSize:13, color:"#8a8aaa", padding:"8px 10px", fontFamily:"monospace" }}>
                {c.count ? formatBTC(c.vol/c.count) : "0"}
              </div>
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────
function Admin() {
  const { wallet, markets, betActions, refetch } = useCtx();
  const [resolveId,  setResolveId]  = useState("");
  const [resolveOut, setResolveOut] = useState("true");
  const [cancelId,   setCancelId]   = useState("");
  const [newResolver, setNewResolver] = useState("");

  if (!wallet.isConnected) return (
    <div style={{ textAlign:"center", padding:80, color:"#3a3a55" }}>Connect wallet to access admin</div>
  );

  const doResolve = async () => {
    await betActions.resolveMarket(Number(resolveId), resolveOut === "true");
    refetch(); setResolveId("");
  };
  const doCancel = async () => {
    await betActions.cancelMarket(Number(cancelId));
    refetch(); setCancelId("");
  };
  const doAddResolver = async () => {
    if (!wallet.contract) return;
    try {
      const tx = await wallet.contract.addResolver(newResolver); // signer already attached
      await tx.wait();
      setNewResolver("");
    } catch (e) { console.error(e); }
  };

  const InputRow = ({label, val, setVal, placeholder, action, btn, color="#f7931a"}) => (
    <div style={{ marginBottom:20 }}>
      <label style={{ fontSize:10, color:"#4a4a65", display:"block", marginBottom:8, letterSpacing:1 }}>{label}</label>
      <div style={{ display:"flex", gap:10 }}>
        <input value={val} onChange={e=>setVal(e.target.value)} placeholder={placeholder} style={{
          flex:1, background:"#12121a", border:"1px solid #1e1e2a",
          color:"#e8e8f0", padding:"10px 12px", borderRadius:8, fontSize:13, outline:"none",
        }}/>
        <button onClick={action} disabled={betActions.pending||!val} style={{
          background:`linear-gradient(135deg,${color},${color}cc)`,
          border:"none", color:"#fff",
          padding:"10px 20px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:700,
          opacity: betActions.pending||!val ? .5 : 1,
        }}>{btn}</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:600, animation:"fadeUp .3s ease" }}>
      <h1 style={{ fontSize:26, fontWeight:900, color:"#e8e8f0", marginBottom:6 }}>Admin</h1>
      <p style={{ fontSize:13, color:"#3a3a55", marginBottom:28 }}>Contract owner / resolver tools</p>

      <div style={{ background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:28, marginBottom:20 }}>
        <div style={{ fontSize:12, color:"#3a3a50", letterSpacing:1, marginBottom:20 }}>RESOLVE MARKET</div>

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:10, color:"#4a4a65", display:"block", marginBottom:8, letterSpacing:1 }}>MARKET ID</label>
          <input value={resolveId} onChange={e=>setResolveId(e.target.value)} placeholder="1"
            style={{ width:"100%", background:"#12121a", border:"1px solid #1e1e2a", color:"#e8e8f0", padding:"10px 12px", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" }}/>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:10, color:"#4a4a65", display:"block", marginBottom:8, letterSpacing:1 }}>OUTCOME</label>
          <div style={{ display:"flex", gap:10 }}>
            {["true","false"].map(v => (
              <button key={v} onClick={()=>setResolveOut(v)} style={{
                flex:1, background: resolveOut===v ? (v==="true"?"#2ecc7120":"#e74c3c20") : "#12121a",
                border:`1px solid ${resolveOut===v?(v==="true"?"#2ecc71":"#e74c3c"):"#1e1e2a"}`,
                color: resolveOut===v ? (v==="true"?"#2ecc71":"#e74c3c") : "#5a5a75",
                padding:"10px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600,
              }}>{v==="true" ? "✓ YES Wins" : "✗ NO Wins"}</button>
            ))}
          </div>
        </div>

        <button onClick={doResolve} disabled={betActions.pending||!resolveId} style={{
          width:"100%", background:"linear-gradient(135deg,#3498db,#2980b9)",
          border:"none", color:"#fff", padding:"12px", borderRadius:8,
          cursor:"pointer", fontSize:14, fontWeight:700,
          opacity: betActions.pending||!resolveId ? .5 : 1,
        }}>Resolve Market</button>
      </div>

      <div style={{ background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:28, marginBottom:20 }}>
        <div style={{ fontSize:12, color:"#3a3a50", letterSpacing:1, marginBottom:20 }}>CANCEL MARKET</div>
        <InputRow label="MARKET ID" val={cancelId} setVal={setCancelId} placeholder="2" action={doCancel} btn="Cancel Market" color="#e74c3c"/>
      </div>

      <div style={{ background:"#0a0a10", border:"1px solid #141418", borderRadius:12, padding:28 }}>
        <div style={{ fontSize:12, color:"#3a3a50", letterSpacing:1, marginBottom:20 }}>ADD RESOLVER</div>
        <InputRow label="ADDRESS" val={newResolver} setVal={setNewResolver} placeholder="0x…" action={doAddResolver} btn="Add" color="#9b59b6"/>
      </div>

      {betActions.error && (
        <div style={{ background:"#1a0808", border:"1px solid #c0392b", borderRadius:8, padding:"10px 14px", marginTop:16, fontSize:12, color:"#e74c3c" }}>
          {betActions.error}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// LIVE TICKER
// ─────────────────────────────────────────────
function Ticker({ markets }) {
  const items = [
    "BitPredict — Bitcoin Prediction Markets on OP_NET",
    `${markets.filter(m=>m.isActive).length} Active Markets`,
    "Week 3 · OP_NET Vibecoding Challenge",
    "#opnetvibecode · @opnetbtc",
    "Smart contracts deployed on Bitcoin L1",
    "Connect OP Wallet to place bets",
  ];
  return (
    <div style={{
      position:"fixed", bottom:0, left:220, right:0, height:36,
      background:"#07070a", borderTop:"1px solid #141418",
      display:"flex", alignItems:"center", gap:0, overflow:"hidden", zIndex:100,
    }}>
      <div style={{ padding:"0 16px", fontSize:10, color:"#f7931a", fontWeight:700, borderRight:"1px solid #141418", height:"100%", display:"flex", alignItems:"center", whiteSpace:"nowrap" }}>
        ● LIVE
      </div>
      <div style={{ display:"flex", gap:40, padding:"0 24px", overflow:"hidden", alignItems:"center" }}>
        {items.map((t,i) => (
          <span key={i} style={{ fontSize:11, color:"#3a3a55", whiteSpace:"nowrap" }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
const PAGES = { dashboard:Dashboard, markets:Markets, create:CreateMarket, mybets:MyBets, analytics:Analytics, admin:Admin };

export default function App() {
  const wallet                  = useWallet();
  const { markets, loading, totalVolume, refetch } = useMarkets(wallet.contract);
  const [page, setPage]         = useState("dashboard");
  const [betModal, setBetModal] = useState(null);   // { market, side }
  const [toasts, setToasts]     = useState([]);

  const toast = useCallback((message, type="success", txHash=null) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type, txHash }]);
    setTimeout(() => setToasts(t => t.filter(x=>x.id!==id)), 6000);
  }, []);

  const betActions = useBetActions(wallet.contract, wallet.account, (action, hash) => {
    const msgs = {
      bet     : "Bet placed on-chain!",
      claim   : "Reward claimed!",
      create  : "Market created on-chain!",
      resolve : "Market resolved!",
      cancel  : "Market cancelled.",
    };
    toast(msgs[action] || "Transaction confirmed", "success", hash);
    refetch();
  });

  const { userBets, loading: ubLoading, refetch: refetchBets } = useUserBets(wallet.contract, wallet.account);

  const onBet = useCallback((market, side) => {
    if (!wallet.isConnected) { toast("Connect your wallet first", "error"); return; }
    betActions.clearError?.();
    setBetModal({ market, side });
  }, [wallet.isConnected, toast, betActions]);

  const PageComp = PAGES[page] || Dashboard;

  return (
    <Ctx.Provider value={{
      wallet, markets, totalVolume, loading, refetch,
      userBets, ubLoading, refetchBets,
      betActions, onBet, setPage,
    }}>
      <div style={{ minHeight:"100vh", background:"#050507" }}>

        <Sidebar page={page} setPage={setPage} />

        <div style={{ marginLeft:220, paddingBottom:52 }}>
          <TopBar />
          <main style={{ padding:"28px 32px" }}>
            {loading && markets.length===0 ? (
              <div style={{ textAlign:"center", padding:80 }}>
                <div style={{ fontSize:13, color:"#3a3a55", animation:"pulse 1.5s infinite" }}>
                  Loading markets from chain…
                </div>
              </div>
            ) : (
              <PageComp />
            )}
          </main>
        </div>

        <Ticker markets={markets} />

        {betModal && (
          <BetModal
            market={betModal.market}
            side={betModal.side}
            onClose={() => setBetModal(null)}
          />
        )}

        <Toasts list={toasts} />
      </div>
    </Ctx.Provider>
  );
}
