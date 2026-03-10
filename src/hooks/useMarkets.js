import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "../abi/index.js";

// ── useMarkets ────────────────────────────────────────────────────────────────
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
          const m            = await contract.getMarket(i);
          const [yBps, nBps] = await contract.getOdds(i);
          const yPool = ethers.formatEther(m.yesPool);
          const nPool = ethers.formatEther(m.noPool);
          const total = (parseFloat(yPool) + parseFloat(nPool)).toFixed(8);
          const now   = Date.now() / 1000;
          list.push({
            id        : Number(m.id),
            question  : m.question,
            category  : m.category,
            creator   : m.creator,
            createdAt : Number(m.createdAt),
            endTime   : Number(m.endTime),
            yesPool   : yPool,
            noPool    : nPool,
            totalPool : total,
            resolved  : m.resolved,
            outcome   : m.outcome,
            cancelled : m.cancelled,
            imageUrl  : m.imageUrl,
            yesOdds   : Number(yBps) / 100,
            noOdds    : Number(nBps) / 100,
            isActive  : !m.resolved && !m.cancelled && Number(m.endTime) > now,
          });
        } catch (e) {
          console.warn("market fetch error", i, e.message);
        }
      }
      setMarkets(list);
    } catch (e) {
      console.error("fetchAll error:", e);
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return { markets, loading, totalVolume, refetch: fetchAll };
}

// Get ethers contract — works whether wallet is EVM or OP_WALLET (Bitcoin)
async function getContract() {
  if (!window.ethereum) throw new Error("No EVM provider found");
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    throw new Error("Contract not deployed yet. Add VITE_CONTRACT_ADDRESS to .env");
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

// ── useBetActions ─────────────────────────────────────────────────────────────
export function useBetActions(contract, account, onSuccess) {
  const [pending, setPending] = useState(false);
  const [txHash,  setTxHash]  = useState(null);
  const [error,   setError]   = useState(null);

  const _run = useCallback(async (fn) => {
    if (!account) { setError("Wallet not connected"); return null; }
    setPending(true); setError(null); setTxHash(null);
    try {
      // Use passed contract or get fresh one from window.ethereum
      const c  = contract || await getContract();
      const tx = await fn(c);
      setTxHash(tx.hash);
      await tx.wait();
      return tx.hash;
    } catch (e) {
      const msg = e?.reason || e?.shortMessage || e?.message || "Transaction failed";
      setError(msg);
      return null;
    } finally {
      setPending(false);
    }
  }, [contract, account]);

  const placeBet = useCallback(async (marketId, side, amountEth) => {
    const value = ethers.parseEther(String(amountEth));
    const hash  = await _run((c) =>
      side ? c.betYes(marketId, { value }) : c.betNo(marketId, { value })
    );
    if (hash) onSuccess && onSuccess("bet", hash);
    return hash;
  }, [_run, onSuccess]);

  const claimReward = useCallback(async (marketId) => {
    const hash = await _run((c) => c.claim(marketId));
    if (hash) onSuccess && onSuccess("claim", hash);
    return hash;
  }, [_run, onSuccess]);

  const createMarket = useCallback(async (question, category, durationSecs, imageUrl) => {
    const hash = await _run((c) =>
      c.createMarket(question, category, BigInt(durationSecs), imageUrl || "")
    );
    if (hash) onSuccess && onSuccess("create", hash);
    return hash;
  }, [_run, onSuccess]);

  const resolveMarket = useCallback(async (marketId, outcome) => {
    const hash = await _run((c) => c.resolveMarket(marketId, outcome));
    if (hash) onSuccess && onSuccess("resolve", hash);
    return hash;
  }, [_run, onSuccess]);

  const cancelMarket = useCallback(async (marketId) => {
    const hash = await _run((c) => c.cancelMarket(marketId));
    if (hash) onSuccess && onSuccess("cancel", hash);
    return hash;
  }, [_run, onSuccess]);

  return {
    placeBet, claimReward, createMarket, resolveMarket, cancelMarket,
    pending, txHash, error, clearError: () => setError(null),
  };
}

// ── useUserBets ───────────────────────────────────────────────────────────────
export function useUserBets(contract, account) {
  const [userBets, setUserBets] = useState([]);
  const [loading,  setLoading]  = useState(false);

  const fetchBets = useCallback(async () => {
    if (!account) { setUserBets([]); return; }
    setLoading(true);
    try {
      const c = contract || await getContract().catch(() => null);
      if (!c) return;
      const ids  = await c.getUserBetIds(account);
      const list = [];
      for (const id of ids) {
        try {
          const m = await c.getMarket(id);
          const b = await c.getUserBet(id, account);
          list.push({
            marketId  : Number(id),
            question  : m.question,
            category  : m.category,
            endTime   : Number(m.endTime),
            resolved  : m.resolved,
            outcome   : m.outcome,
            cancelled : m.cancelled,
            yesAmount : ethers.formatEther(b.yesAmount),
            noAmount  : ethers.formatEther(b.noAmount),
            claimed   : b.claimed,
            yesPool   : ethers.formatEther(m.yesPool),
            noPool    : ethers.formatEther(m.noPool),
          });
        } catch (e) {
          console.warn("bet fetch error", id, e.message);
        }
      }
      setUserBets(list);
    } catch (e) {
      console.error("useUserBets error:", e);
    } finally {
      setLoading(false);
    }
  }, [contract, account]);

  useEffect(() => { fetchBets(); }, [fetchBets]);

  return { userBets, loading, refetch: fetchBets };
}
