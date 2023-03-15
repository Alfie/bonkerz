import * as anchor from "@project-serum/anchor";
import { NextApiRequest, NextApiResponse } from "next";
import { NETWORK } from "@utils/endpoints";
import {Connection, PublicKey, Transaction, Signer} from "@solana/web3.js";
import { TxCreateData } from "@pages/api/tx/create";
import * as spl from '@solana/spl-token';
import { DEFAULT_WALLET } from "@utils/globals";

export type Input = {
    payerAddress: string;
    mintAddress?: string;
    amount?: number;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TxCreateData>
) {
    let userAssociatedTokenAccount: anchor.web3.PublicKey | undefined = undefined;

    const {
        payerAddress,
        mintAddress  = DEFAULT_WALLET,
        amount = 1,
      } = req.body as Input;

    const payer = new PublicKey(payerAddress);
    const mint = new PublicKey(mintAddress);

    const connection = new Connection(NETWORK);

    // Create a token account for the user and mint some tokens
    userAssociatedTokenAccount = await spl.getAssociatedTokenAddress(
        mint,
        payer,
        true,
        spl.TOKEN_PROGRAM_ID,
        spl.ASSOCIATED_TOKEN_PROGRAM_ID,
    )

    const txFundTokenAccount = new anchor.web3.Transaction();
    txFundTokenAccount.add(spl.createAssociatedTokenAccountInstruction(
        payer,
        userAssociatedTokenAccount,
        payer,
        mint,
        spl.TOKEN_PROGRAM_ID,
        spl.ASSOCIATED_TOKEN_PROGRAM_ID,
    ))
    txFundTokenAccount.add(spl.createMintToInstruction(
        mint,
        userAssociatedTokenAccount,
        payer,
        1337000000,
        [],
        spl.TOKEN_PROGRAM_ID,
    ));
    
    const blockHash = (await connection.getLatestBlockhash("finalized"))
    .blockhash;

    txFundTokenAccount.feePayer = payer;
    txFundTokenAccount.recentBlockhash = blockHash;

    const serializedTransaction = txFundTokenAccount.serialize({
        requireAllSignatures: false,
        verifySignatures: true,
    });

    const transactionBase64 = serializedTransaction.toString("base64");
    res.status(200).json({ tx: transactionBase64, });
}