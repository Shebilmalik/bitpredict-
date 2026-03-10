import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "../abi/index.js";

// OP_WALLET is forked from UniSat wallet
// It uses Bitcoin wallet API: window.opnet.requestAccounts()
// NOT EIP-1193 .request({ method: "eth_requestAccounts" })

function getOPWallet() {
  if (typeof window === "undefined") return null;
  if (window.opnet) return window.opnet;
  if (window.opwallet) return window.opwallet;
  if (window.OPWallet) return window.OPWallet;
  return null;
}

function waitForOPWallet() {
  return new Promise(function(resolve) {
    var w = getOPWallet();
    if (w) { resolve(w); return; }
    var tries = 0;
    var interval = setInterval(function() {
      tries++;
      var found = getOPWallet();
      if (found) { clearInterval(interval); resolve(found); }
      else if (tries > 30) { clearInterval(interval); resolve(null); }
    }, 100);
  });
}

export function useWallet() {
  var [account,    setAccount]    = useState(null);
  var [balance,    setBalance]    = useState("0");
  var [connecting, setConnecting] = useState(false);
  var [error,      setError]      = useState(null);
  var [chainId,    setChainId]    = useState(null);
  var [contract,   setContract]   = useState(null);
  var busy = useRef(false);

  var connect = useCallback(async function() {
    if (busy.current) return;
    busy.current = true;
    setConnecting(true);
    setError(null);

    try {
      var wallet = await waitForOPWallet();

      if (!wallet) {
        throw new Error("OP Wallet not found. Install OP_WALLET from opnet.org and refresh.");
      }

      // OP_WALLET (UniSat fork) uses .requestAccounts() directly
      var accounts = await wallet.requestAccounts();

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned. Please unlock OP Wallet.");
      }

      var addr = accounts[0];
      setAccount(addr);

      // Get balance
      try {
        var balData = await wallet.getBalance();
        if (balData && balData.confirmed !== undefined) {
          // Balance is in satoshis, convert to BTC
          setBalance((balData.confirmed / 100000000).toFixed(8));
        }
      } catch (e) {
        console.log("balance fetch failed", e);
      }

      // Get network
      try {
        var network = await wallet.getNetwork();
        setChainId(network);
      } catch (e) {
        console.log("network fetch failed", e);
      }

      setError(null);

    } catch (err) {
      if (err.code === 4001) {
        setError("Rejected. Please approve in OP Wallet.");
      } else {
        setError(err.message || "Failed to connect OP Wallet.");
      }
    } finally {
      setConnecting(false);
      busy.current = false;
    }
  }, []);

  var disconnect = useCallback(function() {
    setAccount(null);
    setBalance("0");
    setChainId(null);
    setContract(null);
    setError(null);
  }, []);

  var refreshBalance = useCallback(async function() {
    var wallet = getOPWallet();
    if (!wallet || !account) return;
    try {
      var balData = await wallet.getBalance();
      if (balData && balData.confirmed !== undefined) {
        setBalance((balData.confirmed / 100000000).toFixed(8));
      }
    } catch (e) {
      console.log("refreshBalance error", e);
    }
  }, [account]);

  // Auto-reconnect silently
  useEffect(function() {
    waitForOPWallet().then(async function(wallet) {
      if (!wallet) return;
      try {
        var accounts = await wallet.getAccounts();
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0]);
          try {
            var balData = await wallet.getBalance();
            if (balData && balData.confirmed !== undefined) {
              setBalance((balData.confirmed / 100000000).toFixed(8));
            }
          } catch (e) {
            console.log("auto balance error", e);
          }
        }
      } catch (e) {
        console.log("auto-reconnect skipped", e);
      }
    });
  }, []);

  // Listen for account/network changes
  useEffect(function() {
    var active = true;
    waitForOPWallet().then(function(wallet) {
      if (!wallet || !active) return;
      function onAccounts(accs) {
        if (!accs || accs.length === 0) disconnect();
        else setAccount(accs[0]);
      }
      function onNetwork() { window.location.reload(); }
      if (wallet.on) {
        wallet.on("accountsChanged", onAccounts);
        wallet.on("networkChanged", onNetwork);
      }
    });
    return function() { active = false; };
  }, [disconnect]);

  return {
    account: account,
    provider: null,
    signer: null,
    contract: contract,
    chainId: chainId,
    balance: balance,
    connecting: connecting,
    error: error,
    walletName: "OP Wallet",
    connect: connect,
    disconnect: disconnect,
    refreshBalance: refreshBalance,
    isConnected: !!account,
    shortAddr: account ? account.slice(0, 6) + "..." + account.slice(-4) : null,
  };
}
