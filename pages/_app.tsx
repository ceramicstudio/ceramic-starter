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
import * as ipfsHttpClient from "ipfs-http-client";
import * as uint8arrays from "uint8arrays";
import { base64url } from "multiformats/bases/base64"
import { CarReader, CarWriter } from "@ipld/car";
import { from } from "ix/asynciterable";

const INFURA_TOKEN = process.env.NEXT_PUBLIC_INFURA_TOKEN;

function asIso(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().replace(/\.\d+/, "");
}

async function collect(input: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  let acc = new Uint8Array([])
  for await (let elem of input) {
    acc = uint8arrays.concat([acc, elem])
  }
  return acc
}

function resourcesList(resources: string[]): string {
  const dashed = resources.map((r) => `- ${r}`);
  return dashed.join("\n");
}

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

  const chainId = await web3.eth.getChainId();
  const ipfsClient = ipfsHttpClient.create({ url: "http://localhost:5001" });

  const account = accounts[0];
  const cacao = {
    h: {
      t: "eip4361-eip191",
    },
    p: {
      aud: "http://localhost:3000",
      iss: `did:pkh:eth:${account}`,
      uri: "http://localhost:3000/login",
      version: 1,
      nonce: 328917,
      chainId: chainId,
      iat: Math.floor(new Date().valueOf() / 1000),
      nbf: Math.floor(new Date().valueOf() / 1000),
      exp: Math.floor(new Date().valueOf() / 1000) + 60 * 60, // 1 hour
      statement:
        "I accept the ServiceOrg Terms of Service: https://service.org/tos",
      requestId: "request-id-random",
      resources: [
        "ipfs://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq",
        "https://example.com/my-web2-claim.json",
      ],
    },
    s: [] as any[],
  };

  const ssiPayload =
    `${cacao.p.aud} wants you to sign in with your Ethereum account:\n` +
    account +
    "\n" +
    "\n" +
    `${cacao.p.statement}\n` +
    "\n" +
    `URI: ${cacao.p.uri}\n` +
    `Version: ${cacao.p.version}\n` +
    `Chain ID: ${cacao.p.chainId}\n` +
    `Nonce: ${cacao.p.nonce}\n` +
    `Issued At: ${asIso(cacao.p.iat)}\n` +
    `Expiration Time: ${asIso(cacao.p.exp)}\n` +
    `Not Before: ${asIso(cacao.p.nbf)}\n` +
    `Request ID: ${cacao.p.requestId}\n` +
    `Resources:\n ${resourcesList(cacao.p.resources)}`;

  // @ts-ignore
  const signature = await web3.eth.personal.sign(ssiPayload, accounts[0]);
  const signatureBytes = uint8arrays.fromString(
    signature.replace(/^0x/, ""),
    "base16"
  );
  console.log("signature", signature.replace(/^0x/, ""));
  cacao.s.push({
    s: signatureBytes,
  });
  console.log("cacao", cacao);
  const cid = await ipfsClient.dag.put(cacao);
  console.log("cid", cid.toString());
  const cacaoRestored = await ipfsClient.dag.get(cid);
  console.log("cacao-restored", JSON.stringify(cacaoRestored, null, 4));
  const block = await ipfsClient.block.get(cid);
  const { writer, out } = CarWriter.create([cid]);
  const outPromise = collect(out)
  await writer.put({
    cid: cid,
    bytes: block,
  });
  await writer.close();
  const outResult = await outPromise
  console.log('output-car-cacao', outResult)
  const base64urlEncoded = base64url.encode(outResult)
  console.log('base64url-car-cacao', base64urlEncoded)

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
