import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";

export function useMarkets(contract) {
  const [markets,     setMarkets]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [totalVolume, setTotalVolume] = useState("0");

  const fetchAll = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const count = Number(await contract.marketCount());
      const vol   = await contract.totalVolume();
      setTotalVolume(ethers.formatEther(vol));
      const list = [];
      for (let i = 1; i <= count; i++) {
        try {
          const m = await contract.getMarket(i);
          const [yBps, nBps] = await contract.getOdds(i);
          const yPool = ethers.formatEther(m.yesPool), nPool = ethers.formatEther(m.noPool);
          const total = (parseFloat(yPool) + parseFloat(nPool)).toFixed(8);
          const now   = Date.now() / 1000;
          list.push({ id: Number(m.id), question: m.question, category: m.category, creator: m.creator, createdAt: Number(m.createdAt), endTime: Number(m.endTime), yesPool: yPool, noPool: nPool, totalPool: total, resolved: m.resolved, outcome: m.outcome, cancelled: m.cancelled, imageUrl: m.imageUrl, yesOdds: Number(yBps) / 100, noOdds: Number(nBps) / 100, isActive: !m.resolved && !m.cancelled && Number(m.endTime) > now });
        } catch (e) { console.warn(`market ${i} fetch error:`, e.message); }
      }
      setMarkets(list);
    } catch (e) { console.error("fetchAll error:", e); }
    finally { setLoading(false); }
  }, [contract]);

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30_000); return () => clearInterval(id); }, [fetchAll]);
  return { markets, loading, totalVolume, refetch: fetchAll };
}

export function useBetActions(contract, account, onSuccess) {
  const [pending, setPending] = useState(false);
  const [txHash,  setTxHash]  = useState(null);
  const [error,   setError]   = useState(null);

  const _run = useCallback(async (fn) => {
    if (!contract || !account) { setError("Wallet not connected"); return; }
    setPending(true); setError(null); setTxHash(null);
    try {
      const tx = await fn(); setTxHash(tx.hash); await tx.wait(); return tx.hash;
    } catch (e) { setError(e?.reason || e?.shortMessage || e?.message || "Transaction failed"); return null; }
    finally { setPending(false); }
  }, [contract, account]);

  const placeBet      = useCallback(async (marketId, side, amountEth) => { const value = ethers.parseEther(String(amountEth)); const hash = await _run(() => side ? contract.betYes(marketId, { value }) : contract.betNo(marketId, { value })); if (hash) onSuccess?.("bet", hash); return hash; }, [_run, contract, onSuccess]);
  const claimReward   = useCallback(async (marketId) => { const hash = await _run(() => contract.claim(marketId)); if (hash) onSuccess?.("claim", hash); return hash; }, [_run, contract, onSuccess]);
  const createMarket  = useCallback(async (question, category, durationSecs, imageUrl = "") => { const hash = await _run(() => contract.createMarket(question, category, BigInt(durationSecs), imageUrl)); if (hash) onSuccess?.("create", hash); return hash; }, [_run, contract, onSuccess]);
  const resolveMarket = useCallback(async (marketId, outcome) => { const hash = await _run(() => contract.resolveMarket(marketId, outcome)); if (hash) onSuccess?.("resolve", hash); return hash; }, [_run, contract, onSuccess]);
  const cancelMarket  = useCallback(async (marketId) => { const hash = await _run(() => contract.cancelMarket(marketId)); if (hash) onSuccess?.("cancel", hash); return hash; }, [_run, contract, onSuccess]);

  return { placeBet, claimReward, createMarket, resolveMarket, cancelMarket, pending, txHash, error, clearError: () => setError(null) };
}

export function useUserBets(contract, account) {
  const [userBets, setUserBets] = useState([]);
  const [loading,  setLoading]  = useState(false);

  const fetch = useCallback(async () => {
    if (!contract || !account) { setUserBets([]); return; }
    setLoading(true);
    try {
      const ids = await contract.getUserBetIds(account);
      const list = [];
      for (const id of ids) {
        const m = await contract.getMarket(id);
        const b = await contract.getUserBet(id, account);
        list.push({ marketId: Number(id), question: m.question, category: m.category, endTime: Number(m.endTime), resolved: m.resolved, outcome: m.outcome, cancelled: m.cancelled, yesAmount: ethers.formatEther(b.yesAmount), noAmount: ethers.formatEther(b.noAmount), claimed: b.claimed, yesPool: ethers.formatEther(m.yesPool), noPool: ethers.formatEther(m.noPool) });
      }
      setUserBets(list);
    } catch (e) { console.error("useUserBets error:", e); }
    finally { setLoading(false); }
  }, [contract, account]);

  useEffect(() => { fetch(); }, [fetch]);
  return { userBets, loading, refetch: fetch };
}
