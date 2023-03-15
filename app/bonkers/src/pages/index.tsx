import type { NextPage } from "next";
import Head from "next/head";
import React from "react";
import { Header } from "@components/layout/header";
import { PageContainer } from "@components/layout/page-container";
import { HomeContent } from "@components/home/home-content";
import { DrawerContainer } from "@components/layout/drawer-container";
import { ButtonState } from "@components/home/button";
import { Menu } from "@components/layout/menu";
import { TwitterResponse } from "@pages/api/twitter/[key]";
import { TxConfirmData } from "@pages/api/tx/confirm";
import { TxCreateData } from "@pages/api/tx/create";
import { TxSendData } from "@pages/api/tx/send";
import { useWallet, useAnchorWallet, AnchorWallet, } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import { fetcher, useDataFetch } from "@utils/use-data-fetch";
import { toast } from "react-hot-toast";
import { Modal, TestModal, GetTokensModal } from "@components/layout/modal";
import { Footer } from "@components/layout/footer";
import { Provider, Program, AnchorProvider, Idl } from '@project-serum/anchor'
import idl_type from "../../../../target/idl/bonk_game.json"
import { NETWORK } from "@utils/endpoints";
import { getPdaParams } from "@utils/game-utils";



const Home: NextPage = () => {
  const { publicKey, signTransaction, connected, wallet } = useWallet();

  const { data } = useDataFetch<TwitterResponse>(
    connected && publicKey ? `/api/twitter/${publicKey}` : null
  );

  const twitterHandle = data && data.handle;

  const [txState, setTxState] = React.useState<ButtonState>("initial");

  //⛔️TODO: add txType parameter identified by a number and this calls a different handlers based on the type of 
  //      tx determined by the button pressed. make diff pages based on create.ts for each type of tx
  const onTxClick =
    ({
      isToken = false,
      address,
      amount,
      txType,
    }: {
      isToken: boolean;
      address?: string;
      amount?: string;
      txType: number;
    }) =>
    async () => {
      if (connected && publicKey && signTransaction && txState !== "loading") {
        setTxState("loading");
        const buttonToastId = toast.loading("Creating transaction...", {
          id: `buttonToast${isToken ? "Token" : ""}`,
        });

        try {
          // Create transaction
          //TODO: if, case, or match statement block for tx types. ⛔️
          let apiRoute = "";
          let reqBody = "";

          if (txType == 1){
            apiRoute = "/api/tx/create";
            reqBody = JSON.stringify({
              payerAddress: publicKey.toBase58(),
              receiverAddress: address
                ? new PublicKey(address).toBase58()
                : undefined,
              amount: amount,
              type: isToken ? "token" : "sol",
            });
          }
          if (txType == 2){
            apiRoute = "/api/tx/create/test"
            const pdaParams = await getPdaParams(publicKey);
            reqBody = JSON.stringify({
              payerAddress: publicKey.toBase58(),
              stateBump: pdaParams.stateBump,
              stateKey: pdaParams. stateKey.toBase58(),
              vaultBump: pdaParams.vaultBump,
              vaultKey: pdaParams.vaultKey.toBase58(),
              mintAddress: address
                ? new PublicKey(address).toBase58()
                : undefined,
              amount: amount,
            });
          }
          if (txType == 3){
            apiRoute = "/api/tx/create/getTokens"
            reqBody = JSON.stringify({
              payerAddress: publicKey.toBase58(),
              mintAddress: address
                ? new PublicKey(address).toBase58()
                : undefined,
              amount: amount,
            });
          }
          let { tx: txCreateResponse } = await fetcher<TxCreateData>(
            apiRoute,
            {
              method: "POST",
              body: reqBody,
              headers: { "Content-type": "application/json; charset=UTF-8" },
            }
          );
          console.log("ahhh", txCreateResponse);

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

          setTxState("success");
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

          const confirmationToastId = toast.loading(
            "Confirming transaction..."
          );

          const confirmationResponse = await fetcher<TxConfirmData>(
            "/api/tx/confirm",
            {
              method: "POST",
              body: JSON.stringify({ txSignature }),
              headers: {
                "Content-type": "application/json; charset=UTF-8",
              },
            }
          );
          
          if (confirmationResponse.confirmed) {
            toast.success("Transaction confirmed", {
              id: confirmationToastId,
            });
          } else {
            toast.success("Error confirming transaction", {
              id: confirmationToastId,
            });
          }
        } catch (error: any) {
          setTxState("error");
          toast.error("Error creating transaction", { id: buttonToastId });
        }
      }
    };

  return (
    <>
      <Head>
        <title>NextJS Solana Starter Kit</title>
        <meta
          name="description"
          content="Everything you need to start your Solana dApp"
        />
      </Head>
      <DrawerContainer>
        <PageContainer>
          <Header twitterHandle={twitterHandle} />
          <HomeContent />
          <Footer />
        </PageContainer>
        <div className="drawer-side">
          <label htmlFor="my-drawer-3" className="drawer-overlay"></label>
          <Menu
            twitterHandle={twitterHandle}
            className="p-4 w-80 bg-base-100 text-base-content"
          />
        </div>
      </DrawerContainer>
      <Modal
        onClick={onTxClick}
        butttonState={txState}
        headerContent="Send some $BONK to someone you love"
        buttonContent="Send $BONK"
        isToken={true}
        id="bonk-modal"
        txType={1}
      />
      <Modal
        onClick={onTxClick}
        butttonState={txState}
        headerContent="Send some SOL to someone you love"
        buttonContent="Send SOL"
        id="sol-modal"
        txType={1}
      />
       <TestModal
        onClick={onTxClick}
        butttonState={txState}
        headerContent="test"
        buttonContent="bb"
        id="test-modal"
        txType={2}
      />
      <GetTokensModal
        onClick={onTxClick}
        butttonState={txState}
        headerContent="test token faucet"
        buttonContent="get tokens"
        id="get-tokens-modal"
        txType={3}
      />
    </>
  );
};

export default Home;
