import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BonkGame } from "../../../../../../../target/types/bonk_game";
import * as idl_type from "../../../../../../../target/idl/bonk_game.json";
import {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
  } from "@solana/web3.js";
  import { NextApiRequest, NextApiResponse } from "next";
  import { NETWORK } from "@utils/endpoints";
  import {
    createAssociatedTokenAccountInstruction,
    createTransferCheckedInstruction,
    getAccount,
    getAssociatedTokenAddress,
    getMint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  } from "@solana/spl-token";
  import { DEFAULT_TOKEN, DEFAULT_WALLET } from "@utils/globals";
  import { getPdaParams } from "@utils/game-utils";
  import { TxCreateData } from "@pages/api/tx/create";
  import { useWallet, useAnchorWallet, AnchorWallet, } from "@solana/wallet-adapter-react";
  
  //TODO: use inputs from createPlayer in bonk-game ⛔️
  export type Input = {
    payerAddress: string;
    mintAddress?: string;
    stateBump: number;
    stateKey: string;
    vaultBump: number;
    vaultKey: string;
    amount?: number;
  };

  interface PDAParameters {
    stateKey: anchor.web3.PublicKey,
    stateBump: number,
    vaultKey: anchor.web3.PublicKey,
    vaultBump: number
  }
  
  export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TxCreateData>
  ) {

    const wallet: AnchorWallet | any  = useAnchorWallet;
    const connection = new Connection(NETWORK);
    const provider = new anchor.AnchorProvider(connection, wallet, {})
    let idl = idl_type as anchor.Idl;
    const program = new Program(idl,"6meFHJwukF1ZEF8cPFzmjj3kAfuJ8ugEt8o7cEG2LoZ4", provider) 

      const {
        payerAddress,
        mintAddress = DEFAULT_WALLET,
        stateBump,
        stateKey,
        vaultBump,
        vaultKey,
        amount = 1,
      } = req.body as Input;
  
      const payer = new PublicKey(payerAddress);
      const mint = new PublicKey(mintAddress);
      const statePDAKey = new PublicKey(stateKey);
      const vaultPDAKey = new PublicKey(vaultKey);
  
      let transaction = new anchor.web3.Transaction();
  
        let payerAta = await getAssociatedTokenAddress(
          mint, // token
          payer, // owner
          false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
        );

        const createPlayerTx = await program.methods.createPlayer(stateBump, new anchor.BN(amount))
            .accounts({
            playerAuthority: payer,
            walletToWithdrawFrom: payerAta,
            mintOfTokenBeingSent: mint,
            vault: vaultPDAKey, 
            playerState: statePDAKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            })
            .transaction();

        transaction.add(createPlayerTx);
  
      const blockHash = (await connection.getLatestBlockhash("finalized")).blockhash;
  
        transaction.feePayer = payer;
        transaction.recentBlockhash = blockHash;
  
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: true,
      });
      const transactionBase64 = serializedTransaction.toString("base64");
  
      res.status(200).json({ tx: transactionBase64 });

}