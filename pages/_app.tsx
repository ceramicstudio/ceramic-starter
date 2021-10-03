import "../styles/globals.css";
import type { AppProps } from "next/app";
import { CeramicProvider, Networks } from "use-ceramic";
import {
  AuthProvider,
  EthereumAuthProvider,
} from "@ceramicnetwork/blockchain-utils-linking";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import Web3 from "web3";

const INFURA_TOKEN = process.env.NEXT_PUBLIC_INFURA_TOKEN;

async function connect(): Promise<AuthProvider> {
  const web3Modal = new Web3Modal({
    network: "rinkeby",
    cacheProvider: false,
    providerOptions: {
      injected: {
        package: null,
      },
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: INFURA_TOKEN,
        },
      },
    },
  });
  const provider = await web3Modal.connect();
  const web3 = new Web3(provider);
  const accounts = await web3.eth.getAccounts();
  return new EthereumAuthProvider(provider, accounts[0]);
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <CeramicProvider network={Networks.MAINNET} connect={connect}>
      <Component {...pageProps} />
    </CeramicProvider>
  );
}
export default MyApp;
