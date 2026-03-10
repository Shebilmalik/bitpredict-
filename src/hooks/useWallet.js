import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "../abi/index.js";

// OP_WALLET injects as window.opnet ONLY
// We never touch window.ethereum — that opens Rabby/MetaMask
function getOPWallet() {
  if (typeof window === "undefined") return null;
  if (window.opnet) return window.opnet;
  if (window.opwallet) return window.opwallet;
  if (window.OPWallet) return window.OPWallet;
  return null; // DO NOT fallback to window.ethereum
}

function waitForOPWallet() {
  return new Promise(function(resolve) {
    var w = getOPWallet();
    if (w) { resolve(w); return; }
    var tries = 0;
    var interval = setInterval(function() {
      var found = getOPWallet();
      tries++;
      if (found) {
        clearInterval(interval);
        resolve(found);
      } else if (tries > 30) {
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
}

export function useWallet() {
  var [account,    setAccount]    = useState(null);
  var [provider,   setProvider]   = useState(null);
  var [signer,     setSigner]     = useState(null);
  var [contract,   setContract]   = useState(null);
  var [chainId,    setChainId]    = useState(null);
  var [balance,    setBalance]    = useState("0");
  var [connecting, setConnecting] = useState(false);
  var [error,      setError]      = useState(null);
  var [walletName, setWalletName] = useState(null);
  var busy = useRef(false);

  var _setup = useCallback(async function(raw) {
    var p = new ethers.BrowserProvider(raw);
    var s = await p.getSigner();
    var n = await p.getNetwork();
    var a = await s.getAddress();
    var b = await p.getBalance(a);
    var c = null;
    if (CONTRACT_ADDRESS && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      c = new ethers.Contract(CONTRACT_ADDRESS, ABI, s);
    }
    setAccount(a);
    setProvider(p);
    setSigner(s);
    setContract(c);
    setChainId(Number(n.chainId));
    setBalance(ethers.formatEther(b));
    setWalletName("OP Wallet");
    setError(null);
  }, []);

  var connect = useCallback(async function() {
    if (busy.current) return;
    busy.current = true;
    setConnecting(true);
    setError(null);
    try {
      var raw = await waitForOPWallet();
      if (!raw) {
        throw new Error("OP Wallet not detected. Please install OP_WALLET from opnet.org and refresh.");
      }
      var accounts = await raw.request({ method: "eth_requestAccounts" });
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

  var disconnect = useCallback(function() {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setContract(null);
    setChainId(null);
    setBalance("0");
    setWalletName(null);
    setError(null);
  }, []);

  var refreshBalance = useCallback(async function() {
    if (!provider || !account) return;
    try {
      var b = await provider.getBalance(account);
      setBalance(ethers.formatEther(b));
    } catch (e) {
      console.log("balance refresh error", e);
    }
  }, [provider, account]);

  useEffect(function() {
    waitForOPWallet().then(async function(raw) {
      if (!raw) return;
      try {
        var accs = await raw.request({ method: "eth_accounts" });
        if (accs && accs.length > 0) {
          await _setup(raw);
        }
      } catch (e) {
        console.log("auto-reconnect skipped", e);
      }
    });
  }, [_setup]);

  useEffect(function() {
    var active = true;
    var raw = null;
    waitForOPWallet().then(function(w) {
      if (!w || !active) return;
      raw = w;
      function onAccounts(accs) {
        if (!accs || accs.length === 0) {
          disconnect();
        } else {
          _setup(raw).catch(function(e) { console.log(e); });
        }
      }
      function onChain() { window.location.reload(); }
      function onDisconnect() { disconnect(); }
      raw.on("accountsChanged", onAccounts);
      raw.on("chainChanged", onChain);
      raw.on("disconnect", onDisconnect);
    });
    return function() { active = false; };
  }, [_setup, disconnect]);

  return {
    account: account,
    provider: provider,
    signer: signer,
    contract: contract,
    chainId: chainId,
    balance: balance,
    connecting: connecting,
    error: error,
    walletName: walletName,
    connect: connect,
    disconnect: disconnect,
    refreshBalance: refreshBalance,
    isConnected: !!account,
    shortAddr: account ? account.slice(0, 6) + "..." + account.slice(-4) : null,
  };
}
