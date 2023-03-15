import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BonkGame } from "../target/types/bonk_game";
import * as spl from '@solana/spl-token';

interface PDAParameters {
  stateKey: anchor.web3.PublicKey,
  stateBump: number,
  vaultKey: anchor.web3.PublicKey,
  vaultBump: number
}

describe("bonk-game", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.BonkGame as Program<BonkGame>;

  let player1Pda: PDAParameters;
  let player2Pda: PDAParameters;
  let player1: anchor.web3.Keypair;
  let player1Funder: anchor.web3.PublicKey;
  let player2: anchor.web3.Keypair;
  let player2Funder: anchor.web3.PublicKey;
  let mintAddress: anchor.web3.PublicKey;

  const getPdaParams = async (connection: anchor.web3.Connection, player: anchor.web3.PublicKey): Promise<PDAParameters> => {

    let [statePubKey, stateBump] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("state"), player.toBuffer()], program.programId,
    );
    let [vaultPubKey, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), player.toBuffer()], program.programId,
    );
  return {
      stateBump,
      stateKey: statePubKey,
      vaultBump,
      vaultKey: vaultPubKey,
  }
}

const createMint = async (connection: anchor.web3.Connection): Promise<anchor.web3.PublicKey> => {
  const tokenMint = new anchor.web3.Keypair();
  const lamportsForMint = await provider.connection.getMinimumBalanceForRentExemption(spl.MintLayout.span);
  let tx = new anchor.web3.Transaction();

  // Allocate mint
  tx.add(
      anchor.web3.SystemProgram.createAccount({
          programId: spl.TOKEN_PROGRAM_ID,
          space: spl.MintLayout.span,
          fromPubkey: provider.wallet.publicKey,
          newAccountPubkey: tokenMint.publicKey,
          lamports: lamportsForMint,
      })
  )
  // Allocate wallet account
  tx.add(
      spl.createInitializeMintInstruction(
          tokenMint.publicKey,
          6,
          provider.wallet.publicKey,
          provider.wallet.publicKey,
          spl.TOKEN_PROGRAM_ID,
      )
  );
  const signature = await provider.sendAndConfirm(tx, [tokenMint]);

  console.log(`[${tokenMint.publicKey}] Created new mint account at ${signature}`);
  return tokenMint.publicKey;
}

const createUserAndAssociatedWallet = async (connection: anchor.web3.Connection, mint?: anchor.web3.PublicKey): Promise<[anchor.web3.Keypair, anchor.web3.PublicKey | undefined]> => {
  const user = new anchor.web3.Keypair();
  let userAssociatedTokenAccount: anchor.web3.PublicKey | undefined = undefined;

  // Fund user with some SOL
  let txFund = new anchor.web3.Transaction();
  txFund.add(anchor.web3.SystemProgram.transfer({
      fromPubkey: provider.wallet.publicKey,
      toPubkey: user.publicKey,
      lamports: .5 * anchor.web3.LAMPORTS_PER_SOL,
  })); 
  const sigTxFund = await provider.sendAndConfirm(txFund);
  console.log(`[${user.publicKey.toBase58()}] Funded new account with .5 SOL: ${sigTxFund}`);

  if (mint) {
      // Create a token account for the user and mint some tokens
      userAssociatedTokenAccount = await spl.getAssociatedTokenAddress(
          mint,
          user.publicKey,
          true,
          spl.TOKEN_PROGRAM_ID,
          spl.ASSOCIATED_TOKEN_PROGRAM_ID,
      )

      const txFundTokenAccount = new anchor.web3.Transaction();
      txFundTokenAccount.add(spl.createAssociatedTokenAccountInstruction(
        user.publicKey,
        userAssociatedTokenAccount,
        user.publicKey,
        mint,
        spl.TOKEN_PROGRAM_ID,
          spl.ASSOCIATED_TOKEN_PROGRAM_ID,
      ))
      txFundTokenAccount.add(spl.createMintToInstruction(
          mint,
          userAssociatedTokenAccount,
          provider.wallet.publicKey,
          1337000000,
          [],
          spl.TOKEN_PROGRAM_ID,
      ));
      const txFundTokenSig = await provider.sendAndConfirm(txFundTokenAccount, [user]);
      console.log(`[${userAssociatedTokenAccount.toBase58()}] New associated account for mint ${mint.toBase58()}: ${txFundTokenSig}`);
  }
  return [user, userAssociatedTokenAccount];
}

//Alliance variable initialization
let alliancePubkey;
let allianceBump: number;
let allianceVaultPubkey;
let allianceVaultBump: number;

beforeEach(async () => {
  mintAddress = await createMint(provider.connection);
  [player1, player1Funder] = await createUserAndAssociatedWallet(provider.connection, mintAddress);
  [player2, player2Funder] = await createUserAndAssociatedWallet(provider.connection, mintAddress);

  player1Pda = await getPdaParams(provider.connection, player1.publicKey);
  player2Pda = await getPdaParams(provider.connection, player2.publicKey);

  //TODO: ⛔️ add pubkey to seed array (either player_state pda or players wallet)
  [alliancePubkey, allianceBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("alliance")], program.programId,
  );

  [allianceVaultPubkey, allianceVaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("avault")], program.programId,
  );

  const amount = new anchor.BN(500000);

  //let tx1 = new Transaction();
  //NOTE: account is only initialized when using .rpc()
  const tx1 = await program.methods.createPlayer(player1Pda.stateBump, amount)
    .accounts({
      playerAuthority: player1.publicKey,
      walletToWithdrawFrom: player1Funder,
      mintOfTokenBeingSent: mintAddress,
      vault: player1Pda.vaultKey, 
      playerState: player1Pda.stateKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: spl.TOKEN_PROGRAM_ID,
    })
    .signers([player1])//.transaction();
    .rpc();

  //console.log("sim first player creation: ", await provider.connection.simulateTransaction(tx1,[player1]));
  //console.log("signature: ", await provider.connection.sendTransaction(tx1,[player1]));

  //console.log("****bonker info: ", await getAccountData(provider.connection, player1Pda.stateKey))
  const tx2 = await program.methods.createPlayer(player2Pda.stateBump, amount)
    .accounts({
      playerAuthority: player2.publicKey,
      walletToWithdrawFrom: player2Funder,
      mintOfTokenBeingSent: mintAddress,
      vault: player2Pda.vaultKey, 
      playerState: player2Pda.stateKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: spl.TOKEN_PROGRAM_ID,
    })
    .signers([player2])//.transaction();
    .rpc();
});

  it("burn another users tokens", async () => {

      console.log("***bonkee data: ", player2Pda.stateKey.toBase58());
      console.log("vault data: ", await spl.getAccount(provider.connection, player2Pda.vaultKey));
      console.log("player 1 pubkey: ", player2.publicKey.toBase58());
    //console.log("Simulate second player creation: ", await provider.connection.simulateTransaction(tx2,[player2]));
    //console.log("signature 2: ", await provider.connection.sendTransaction(tx2,[player2]));

    const tx = await program.methods.gameLoop(player2Pda.stateBump, player2Pda.vaultBump)
      .accounts({
        bonkee: player2.publicKey,
        mint: mintAddress,
        bonker: player1.publicKey,
        bonkeePlayerState: player2Pda.stateKey,
        bonkerPlayerState: player1Pda.stateKey,
        bonkeeVault: player2Pda.vaultKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
      })//.transaction();
      .signers([player1])
      .rpc();

      //console.log("game loop: ", await provider.connection.simulateTransaction(tx,[player1]));
      //console.log("signature: ", await provider.connection.sendTransaction(tx,[player1]));
      console.log("vault data: ", await spl.getAccount(provider.connection, player2Pda.vaultKey));
  });

  it("create an alliance", async () => {
    const amount = new anchor.BN(2000);

    const tx = await program.methods.createAllianceAccount(player1Pda.stateBump,player1Pda.vaultBump,allianceBump, amount)
      .accounts({
        allianceState: alliancePubkey,
        allianceVault: allianceVaultPubkey,
        playerAuthority: player1.publicKey,
        playerVault: player1Pda.vaultKey,
        playerState: player1Pda.stateKey,
        mint: mintAddress,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      })//.transaction();
      .signers([player1])
      .rpc();

      //console.log("create alliance: ", await provider.connection.simulateTransaction(tx,[player1]));
      console.log(tx);
      console.log("vault data: ", await spl.getAccount(provider.connection, player1Pda.vaultKey));
  });

});
