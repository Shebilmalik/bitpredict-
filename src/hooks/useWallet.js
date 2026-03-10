import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "../abi/index.js";

function getOPWallet() {
  if (typeof window === "undefined") return null;
  if (window.opwallet) return window.opwallet;
  if (window.opnet) return window.opnet;
  if (window.bitcoin && window.bitcoin.opnet) return window.bitcoin.opnet;
  if (window.ethereum) return window.ethereum;
  return null;
}

function waitForOPWallet(ms) {
  var maxMs = ms || 3000;
  return new Promise(function(resolve) {
    var w = getOPWallet();
    if (w) { resolve(w); return; }
    var interval = setInterval(function() {
      var found = getOPWallet();
      if (found) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve(found);
      }
    }, 100);
    var timeout = setTimeout(function() {
      clearInterval(interval);
      resolve(null);
    }, maxMs);
  });
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
  const [walletName, setWalletName] = useState(null);
  const busy = useRef(false);

  const _setup = useCallback(async (raw) => {
    const p = new ethers.BrowserProvider(raw);
    const s = await p.getSigner();
    const n = await p.getNetwork();
    const a = await s.getAddress();
    const b = await p.getBalance(a);
    let c = null;
    if (CONTRACT_ADDRESS && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      c = new ethers.Contract(CONTRACT_ADDRESS, ABI, s);
    }
    const name = (raw === window.opwallet || raw === window.opnet) ? "OP Wallet" : "MetaMask";
    setAccount(a);
    setProvider(p);
    setSigner(s);
    setContract(c);
    setChainId(Number(n.chainId));
    setBalance(ethers.formatEther(b));
    setWalletName(name);
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setConnecting(true);
    setError(null);
    try {
      const raw = await waitForOPWallet(3000);
      if (!raw) {
        throw new Error("OP Wallet not found. Install the OP Wallet extension and refresh.");
      }
      const accounts = await raw.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please unlock your OP Wallet.");
      }
      await _setup(raw);
    } catch (err) {
      if (err.code === 4001) {
        setError("Rejected. Please approve in OP Wallet.");
      } else if (err.code === -32002) {
        setError("OP Wallet popup already open.");
      } else {
        setError(err.message || "Failed to connect OP Wallet.");
      }
    } finally {
      setConnecting(false);
      busy.current = false;
    }
  }, [_setup]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setContract(null);
    setChainId(null);
    setBalance("0");
    setWalletName(null);
    setError(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!provider || !account) return;
    try {
      const b = await provider.getBalance(account);
      setBalance(ethers.formatEther(b));
    } catch (e) {
      console.log("balance refresh failed", e);
    }
  }, [provider, account]);

  useEffect(() => {
    waitForOPWallet(3000).then(async (raw) => {
      if (!raw) return;
      try {
        const accs = await raw.request({ method: "eth_accounts" });
        if (accs && accs.length > 0) {
          await _setup(raw);
        }
      } catch (e) {
        console.log("auto-reconnect failed", e);
      }
    });
  }, [_setup]);

  useEffect(() => {
    let raw = null;
    let active = true;

    waitForOPWallet(3000).then((w) => {
      if (!w || !active) return;
      raw = w;
      const onAccounts = (accs) => {
        if (!accs || accs.length === 0) {
          disconnect();
        } else {
          _setup(raw).catch((e) => console.log(e));
        }
      };
      const onChain = () => window.location.reload();
      const onDisconnect = () => disconnect();
      raw.on("accountsChanged", onAccounts);
      raw.on("chainChanged", onChain);
      raw.on("disconnect", onDisconnect);
    });

    return () => {
      active = false;
    };
  }, [_setup, disconnect]);

  return {
    account,
    provider,
    signer,
    contract,
    chainId,
    balance,
    connecting,
    error,
    walletName,
    connect,
    disconnect,
    refreshBalance,
    isConnected: !!account,
    shortAddr: account ? account.slice(0, 6) + "..." + account.slice(-4) : null,
  };
}
