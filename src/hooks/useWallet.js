import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "../abi/index.js";

function getOPWallet() {
  if (typeof window === "undefined") return null;
  if (window.opwallet)           return window.opwallet;
  if (window.opnet)              return window.opnet;
  if (window.bitcoin?.opnet)     return window.bitcoin.opnet;
  if (window.ethereum)           return window.ethereum;
  return null;
}

function waitForOPWallet(ms = 3000) {
  return new Promise((resolve) => {
    const w = getOPWallet();
    if (w) return resolve(w);
    const interval = setInterval(() => {
      const found = getOPWallet();
      if (found) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve(found);
      }
    }, 100);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, ms);
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
    const ethersProvider = new ethers.BrowserProvider(raw);
    const ethersSigner   = await ethersProvider.getSigner();
    const network        = await ethersProvider.getNetwork();
    const address        = await ethersSigner.getAddress();
    const bal            = await ethersProvider.getBalance(address);
    let c = null;
    if (CONTRACT_ADDRESS && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    }
    const name = (raw === window.opwallet || raw === window.opnet) ? "OP Wallet" : "MetaMask";
    setAccount(address);
    setProvider(ethersProvider);
    setSigner(ethersSigner);
    setContract(c);
    setChainId(Number(network.chainId));
    setBalance(ethers.formatEther(bal));
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
      if (err.code === 4001)    setError("Rejected. Please approve in OP Wallet.");
      else if (err.code === -32002) setError("OP Wallet popup already open.");
      else setError(err.message || "Failed to connect OP Wallet.");
    } finally {
      setConnecting(false);
      busy.current = false;
    }
  }, [_setup]);

  const disconnect = useCallback(() => {
    setAccount(null); setProvider(null); setSigner(null);
    setContract(null); setChainId(null); setBalance("0");
    setWalletName(null); setError(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!provider || !account) return;
    try {
      const b = await provider.getBalance(account);
      setBalance(ethers.formatEther(b));
    } catch {/* ignore */}
  }, [provider, account]);

  useEffect(() => {
    waitForOPWallet(3000).then(async (raw) => {
      if (!raw) return;
      try {
        const accs = await raw.request({ method: "eth_accounts" });
        if (accs?.length > 0) await _setup(raw);
      } catch {/* not connected yet */}
    });
  }, [_setup]);

  useEffect(() => {
    let raw = null;
    let active = true;
    waitForOPWallet(3000).then((w) => {
      if (!w || !active) return;
      raw = w;
      const onAccounts = (accs) => {
        if (!accs?.length) disconnect();
        else _setup(raw).catch(console.error);
      };
      const onChain = () => window.location.reload();
      c
