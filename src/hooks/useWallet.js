// OP_NET official wallet connection using @btc-vision/walletconnect
// Docs: https://docs.opnet.org/developers/walletconnect/setup
import { useState, useCallback } from "react";
import { SupportedWallets, useWallet as useOPWallet } from "@btc-vision/walletconnect";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "../abi/index.js";

export function useWallet() {
  const {
    account,
    connect: opConnect,
    disconnect: opDisconnect,
    provider: opProvider,
  } = useOPWallet();

  const [contract,   setContract]   = useState(null);
  const [balance,    setBalance]    = useState("0");
  const [connecting, setConnecting] = useState(false);
  const [error,      setError]      = useState(null);

  const connect = useCallback(async function() {
    setConnecting(true);
    setError(null);
    try {
      await opConnect(SupportedWallets.OP_WALLET);

      // Build contract instance after connect
      if (opProvider && CONTRACT_ADDRESS && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        const ethersProvider = new ethers.BrowserProvider(opProvider);
        const signer = await ethersProvider.getSigner();
        const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        setContract(c);
        const b = await ethersProvider.getBalance(account?.addressTyped || "");
        setBalance(ethers.formatEther(b));
      }
    } catch (err) {
      setError(err.message || "Failed to connect OP Wallet.");
    } finally {
      setConnecting(false);
    }
  }, [opConnect, opProvider, account]);

  const disconnect = useCallback(function() {
    opDisconnect();
    setContract(null);
    setBalance("0");
    setError(null);
  }, [opDisconnect]);

  const addr = account ? account.addressTyped || account.p2tr || account.p2wpkh || "" : null;

  return {
    account: addr,
    provider: opProvider,
    signer: null,
    contract: contract,
    chainId: null,
    balance: balance,
    connecting: connecting,
    error: error,
    walletName: "OP Wallet",
    connect: connect,
    disconnect: disconnect,
    refreshBalance: async function() {},
    isConnected: !!account,
    shortAddr: addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : null,
  };
}
