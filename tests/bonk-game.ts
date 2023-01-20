import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BonkGame } from "../target/types/bonk_game";

describe("bonk-game", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.BonkGame as Program<BonkGame>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
