import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { BonkGame } from "../../../../target/types/bonk_game";

const programPK = new PublicKey("6meFHJwukF1ZEF8cPFzmjj3kAfuJ8ugEt8o7cEG2LoZ4");

export interface PDAParameters {
    stateKey: anchor.web3.PublicKey,
    stateBump: number,
    vaultKey: anchor.web3.PublicKey,
    vaultBump: number
}

export const getPdaParams = async (player: anchor.web3.PublicKey): Promise<PDAParameters> => {

    let [statePubKey, stateBump] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("state"), player.toBuffer()], programPK,
    );
    let [vaultPubKey, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), player.toBuffer()], programPK,
    );
  return {
      stateBump,
      stateKey: statePubKey,
      vaultBump,
      vaultKey: vaultPubKey,
  }
}