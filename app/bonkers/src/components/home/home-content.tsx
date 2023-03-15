import { useWallet } from "@solana/wallet-adapter-react";
import React, { useEffect, useState} from "react";
import { fetcher, useDataFetch } from "@utils/use-data-fetch";
import { ItemList } from "@components/home/item-list";
import { ItemData } from "@components/home/item";
import { Button, ButtonState } from "@components/home/button";
import { toast } from "react-hot-toast";
import { Transaction, TransactionResponse } from "@solana/web3.js";
import { SignCreateData } from "@pages/api/sign/create";
import { SignValidateData } from "@pages/api/sign/validate";
import { TxCreateData } from "@pages/api/tx/create";
import { TxSendData } from "@pages/api/tx/send";
import {ConfirmedSignatureInfo, Connection} from "@solana/web3.js";
import { NETWORK } from "@utils/endpoints";

export function HomeContent() {
  const { publicKey, signTransaction } = useWallet();
  const [signState, setSignState] = React.useState<ButtonState>("initial");
  const [mintState, setMintState] = React.useState<ButtonState>("initial");
  const { data, error } = useDataFetch<Array<ItemData>>(
    publicKey && signState === "success" ? `/api/items/${publicKey}` : null
  );
  const connection = new Connection(NETWORK);
  const prevPublickKey = React.useRef<string>(publicKey?.toBase58() || "");
  const [txSigState, setTxSigState] = useState("");

  const getSigs = async () =>  {
    const txns: any[] = [];
    if(publicKey){
      const txnSigs = await connection.getSignaturesForAddress(publicKey);
      txnSigs.forEach(({signature}) => txns.push(connection.getTransaction(signature)));
      const resolvedTxns = await Promise.all(txns)
      setTxSigState(JSON.stringify(resolvedTxns[0]));
    }
  }
  getSigs();

  // Reset the state if wallet changes or disconnects
  React.useEffect(() => {
    if (publicKey && publicKey.toBase58() !== prevPublickKey.current) {
      prevPublickKey.current === publicKey.toBase58();
      setSignState("initial");
    }
  }, [publicKey]);

  // This will request a signature automatically but you can have a separate button for that
  React.useEffect(() => {
    async function sign() {
      if (publicKey && signTransaction && signState === "initial") {
        setSignState("loading");
        const signToastId = toast.loading("Signing message...");

        try {
          // Request signature tx from server
          const { tx: createTx } = await fetcher<SignCreateData>(
            "/api/sign/create",
            {
              method: "POST",
              body: JSON.stringify({
                publicKeyStr: publicKey.toBase58(),
              }),
              headers: { "Content-type": "application/json; charset=UTF-8" },
            }
          );

          const tx = Transaction.from(Buffer.from(createTx, "base64"));

          // Request signature from wallet
          const signedTx = await signTransaction(tx);

          // Validate signed transaction
          await fetcher<SignValidateData>("/api/sign/validate", {
            method: "POST",
            body: JSON.stringify({
              signedTx: signedTx.serialize().toString("base64"),
            }),
            headers: { "Content-type": "application/json; charset=UTF-8" },
          });

          setSignState("success");
          toast.success("Message signed", { id: signToastId });
        } catch (error: any) {
          setSignState("error");
          toast.error("Error verifying wallet, please reconnect wallet", {
            id: signToastId,
          });
        }
      }
    }

    sign();
  }, [signState, signTransaction, publicKey]);

  const onSignClick = () => {
    setSignState("initial");
  };

  const onMintClick = async () => {
    if(publicKey && signTransaction && mintState == "initial"){
      setMintState("loading");
      const buttonToastId = toast.loading("Signing message...");
      let { tx: txCreateResponse, } = await fetcher<TxCreateData>(
        "/api/tx/create/createMint",
        {
          method: "POST",
          body: JSON.stringify({
            publicKeyStr: publicKey.toBase58(),
          }),
          headers: { "Content-type": "application/json; charset=UTF-8" },
        }
      );

      const tx = Transaction.from(Buffer.from(txCreateResponse, "base64"));

      // Request signature from wallet
      const signedTx = await signTransaction(tx);
      const signedTxBase64 = signedTx.serialize().toString("base64");

      // Send signed transaction
      let { txSignature } = await fetcher<TxSendData>("/api/tx/send", {
        method: "POST",
        body: JSON.stringify({ signedTx: signedTxBase64 }),
        headers: { "Content-type": "application/json; charset=UTF-8" },
      });

      console.log("sig: ", txSignature);

      setMintState("success");
      toast.success(
        (t) => (
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            rel="noreferrer"
          >
            Transaction created
          </a>
        ),
        { id: buttonToastId, duration: 10000 }
      );
    };
  }

  if (error) {
    return (
      <p className="text-center p-4">
        Failed to load items, please try connecting again
      </p>
    );
  }

  if (publicKey && signState === "success" && !data) {
    return <p className="text-center p-4">Loading wallet information...</p>;
  }

  const hasFetchedData = publicKey && signState === "success" && data;

  return (
    <div className="grid grid-cols-1">
      {hasFetchedData ? (
        <div>
          <label
              htmlFor="test-modal"
              className="btn-ghost lg:btn mb-1 lg:mr-1 lg:mb-0"
            >test button✨</label>
            <Button
              state={mintState}
              onClick={onMintClick}
              className="btn-ghost lg:btn mb-1 lg:mr-1 lg:mb-0"
            >create test token⚠️</Button>
            <label
              htmlFor="get-tokens-modal"
              className="btn-ghost lg:btn mb-1 lg:mr-1 lg:mb-0"
            >get test tokens⚠️</label>
          <label>{txSigState}</label>
        </div>
      ) : (
        <div className="text-center">
          {!publicKey && (
            <div className="card border-2 border-primary mb-5">
              <div className="card-body items-center">
                <h2 className="card-title text-center text-primary mb-2">
                  Please connect your wallet to get a list of your NFTs
                </h2>
              </div>
            </div>
          )}
          {publicKey && signState === "error" && (
            <div className="card border-2 border-primary mb-5">
              <div className="card-body items-center text-center">
                <h2 className="card-title text-center mb-2">
                  Please verify your wallet manually
                </h2>
                <Button
                  state={signState}
                  onClick={onSignClick}
                  className="btn-primary"
                >
                  Verify wallet
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
