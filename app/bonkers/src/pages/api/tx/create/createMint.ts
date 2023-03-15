import * as anchor from "@project-serum/anchor";
import { NextApiRequest, NextApiResponse } from "next";
import { NETWORK } from "@utils/endpoints";
import * as spl from '@solana/spl-token';
import {Connection, PublicKey, Transaction, Signer} from "@solana/web3.js";
import { TxCreateData } from "@pages/api/tx/create";

export default async function handler(
req: NextApiRequest,
res: NextApiResponse<TxCreateData>
) {
    const { publicKeyStr } = req.body;
    const payer = new PublicKey(publicKeyStr);

    const connection = new Connection(NETWORK);

    const tokenMint = new anchor.web3.Keypair();
    const lamportsForMint = await connection.getMinimumBalanceForRentExemption(spl.MintLayout.span);
    let tx = new Transaction();

    // Allocate mint
    tx.add(
        anchor.web3.SystemProgram.createAccount({
            programId: spl.TOKEN_PROGRAM_ID,
            space: spl.MintLayout.span,
            fromPubkey: payer,
            newAccountPubkey: tokenMint.publicKey,
            lamports: lamportsForMint,
        })
    )
    // Allocate wallet account
    tx.add(
        spl.createInitializeMintInstruction(
            tokenMint.publicKey,
            6,
            payer,
            payer,
            spl.TOKEN_PROGRAM_ID,
        )
    );

    const blockHash = (await connection.getLatestBlockhash("finalized"))
        .blockhash;
  
      tx.feePayer = payer;
      tx.recentBlockhash = blockHash;

      tx.sign(tokenMint);

    const serializedTransaction = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: true,
      });

    const transactionBase64 = serializedTransaction.toString("base64");
    res.status(200).json({ tx: transactionBase64, });
}