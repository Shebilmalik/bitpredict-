import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WalletProvider } from "@btc-vision/walletconnect";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </StrictMode>
);
