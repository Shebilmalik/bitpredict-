import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "../abi/index.js";

function getEthProvider() {
  if (typeof window !== "undefined") {
    if (window.opwallet) return window.opwallet;
    if (window.ethereum) return window.ethereum;
  }
  return null;
}

export function useWallet() {
  const [account,    setAccount]    = useState(null);
  const [provider,   setProvider]   = useState(null);
  const [signer,     setSigner]     = useState(null);
  const [contract,   setContract]   = useState(null);
  const [chainId,    setChainId]    = useState(null);
  const [balance,    setBalance]    = useState("0");
  const [connecting, setConnecting] = useState(false);
  const [error,      setError]      = useState(null);
  const lock = useRef(false);

  const _setup = useCallback(async (raw) => {
    const p = new ethers.BrowserProvider(raw);
    const s = await p.getSigner();
    const n = await p.getNetwork();
    const a = await s.getAddress();
    const b = await p.getBalance(a);
    let c = null;
    if (CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      c = new ethers.Contract(CONTRACT_ADDRESS, ABI, s);
    }
    setAccount(a); setProvider(p); setSigner(s); setContract(c);
    setChainId(Number(n.chainId)); setBalance(ethers.formatEther(b)); setError(null);
  }, []);

  const connect = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setConnecting(true); setError(null);
    try {
      const raw = getEthProvider();
      if (!raw) throw new Error("No wallet found. Install OP Wallet or MetaMask.");
      await raw.request({ method: "eth_requestAccounts" });
      await _setup(raw);
    } catch (e) { setError(e.message || "Connection failed"); }
    finally { setConnecting(false); lock.current = false; }
  }, [_setup]);

  const disconnect = useCallback(() => {
    setAccount(null); setProvider(null); setSigner(null);
    setContract(null); setChainId(null); setBalance("0");
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!provider || !account) return;
    try { const b = await provider.getBalance(account); setBalance(ethers.formatEther(b)); } catch {}
  }, [provider, account]);

  useEffect(() => {
    const raw = getEthProvider();
    if (!raw) return;
    raw.request({ method: "eth_accounts" }).then((a) => { if (a?.length) _setup(raw).catch(() => {}); }).catch(() => {});
  }, [_setup]);

  useEffect(() => {
    const raw = getEthProvider();
    if (!raw) return;
    const onAcc   = (a) => a.length ? _setup(raw).catch(() => {}) : disconnect();
    const onChain = () => window.location.reload();
    raw.on("accountsChanged", onAcc); raw.on("chainChanged", onChain);
    return () => { raw.removeListener("accountsChanged", onAcc); raw.removeListener("chainChanged", onChain); };
  }, [_setup, disconnect]);

  return {
    account, provider, signer, contract, chainId, balance,
    connecting, error, connect, disconnect, refreshBalance,
    isConnected: !!account,
    shortAddr: account ? `${account.slice(0,6)}…${account.slice(-4)}` : null,
  };
}
