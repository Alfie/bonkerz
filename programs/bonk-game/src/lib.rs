use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken,token::{
    self, Token, TokenAccount, Burn, Mint, Transfer
}};

declare_id!("6meFHJwukF1ZEF8cPFzmjj3kAfuJ8ugEt8o7cEG2LoZ4");

#[program]
pub mod bonk_game {
    use anchor_spl::token::Approve;

    use super::*;

    //set up player account
    pub fn create_player(ctx: Context<CreatePlayer>, state_bump: u8, amount: u64) -> Result<()> {
        ctx.accounts.player_state.data = state_bump;
        
        let bump_vector = state_bump.to_le_bytes();
        let inner = vec![
            b"state".as_ref(),
            ctx.accounts.player_authority.key.as_ref(),
            bump_vector.as_ref(),
        ];
        let outer = vec![inner.as_slice()];

        //complete transfer for player creation
        let transfer_instruction = Transfer{
            from: ctx.accounts.wallet_to_withdraw_from.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.player_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
            outer.as_slice(),
        );

        anchor_spl::token::transfer(cpi_ctx, amount)?;
  
        //⛔️TODO: Mark playerstates for use by game loop functions, ARC be helpful
        //      use BTReeMAp for handling alliances, pssibly store data on shadow drive
        Ok(())
    }

    //create alliance account
    pub fn create_alliance_account(ctx: Context<CreateAllianceAccount>, state_bump: u8, _vault_bump: u8, _alliance_bump: u8, amount: u64) -> Result<()> {
        //TODO: ⛔️init state

        let bump_vector = state_bump.to_le_bytes();
        let inner = vec![
            b"state".as_ref(),
            ctx.accounts.player_authority.key.as_ref(),
            bump_vector.as_ref(),
        ];
        let outer = vec![inner.as_slice()];

        //make alliance account delegate for a certain number of tokens from player vault on addition
        let approve_instruction = Approve {
            to: ctx.accounts.player_vault.to_account_info(),
            delegate: ctx.accounts.alliance_vault.to_account_info(),
            authority: ctx.accounts.player_state.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            approve_instruction,
            outer.as_slice(),
        );

        anchor_spl::token::approve(cpi_ctx, amount)?;

        Ok(())
    }

    //⛔️ TODO: create steal function w/ alliance ac counts
    //❗️may need to be broken into several ixs and funcs
    //can be used to test game functions as they are being built tho.
    pub fn game_loop(ctx: Context<GameLoop>, state_bump: u8, _vault_bump: u8) -> Result<()> {

        //Force burn functionality
        //⭐️ How it works ⭐️
        //A player can burn tokens in another players vault, the amount that can be 
        //burned is 1/3 of the amount that the player initiating the burn holds.
        //❗️(more rules about this after implementing this)
        //✨ Here we go!

        //ARC may be helpful for managing state

        let bump_vector = state_bump.to_le_bytes();
        let bonkee_pk = ctx.accounts.bonkee.key().clone();
        let inner = vec![
            b"state".as_ref(),
            bonkee_pk.as_ref(),
            bump_vector.as_ref(),
        ];

        let outer = vec![inner.as_slice()];

        let burn_instruction = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.bonkee_vault.to_account_info(),
            authority: ctx.accounts.bonkee_player_state.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            burn_instruction,
            outer.as_slice(),
        );

        //TODO: ⛔️if statement to check some condition before burning
        token::burn(cpi_ctx, ctx.accounts.bonkee_vault.amount/2)?;

        Ok(())
    }
}

//TODO: ⛔️Implement a way to allow the user to withdraw at
//      anytime. (probably similar to cancel)
#[derive(Accounts)]
#[instruction(bump:u8)]
pub struct CreatePlayer<'info> {
    #[account(
        init,
        payer = player_authority,
        seeds = [b"vault".as_ref(), player_authority.key().as_ref()],
        bump,
        token::mint = mint_of_token_being_sent,
        token::authority = player_state, 
    )]
    vault: Account<'info, TokenAccount>,

    #[account(
        init,
        seeds = [b"state".as_ref(), player_authority.key().as_ref()],
        bump,
        payer = player_authority,
        space = PlayerState::space()
    )]
    player_state: Account<'info, PlayerState>,

    #[account(
        mut,
        constraint=wallet_to_withdraw_from.owner == player_authority.key(),
        constraint=wallet_to_withdraw_from.mint == mint_of_token_being_sent.key()
    )]
    wallet_to_withdraw_from: Account<'info, TokenAccount>,

    #[account(mut)]
    player_authority: Signer<'info>,
    mint_of_token_being_sent: Account<'info, Mint>,

    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    rent: Sysvar<'info, Rent>,
}

//TODO: ⛔️ create alliance account type, alliances can steal funds from other
//        alliances and players based on rules, program interactions should
//         essentially be a more complex version of player account
//          Stretch Goal: ❗️Gasless bonk tx from vault https://github.com/solana-labs/octane
#[derive(Accounts)]
#[instruction(state_bump:u8, vault_bump:u8, bump:u8)]
pub struct CreateAllianceAccount <'info>{
    #[account(
        init,
        payer = player_authority,
        space = AllianceState::space(),
        seeds = [b"alliance".as_ref(),],
        bump,
    )]
    alliance_state: Account<'info, AllianceState>,

    //TODO: ⛔️ authority may need to be changed to player state associated w/ wallet
    #[account(
        init,
        payer = player_authority,
        seeds = [b"avault".as_ref(),],
        bump,
        token::mint=mint,
        token::authority=player_authority
    )]
    alliance_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    player_authority: Signer<'info>,
    #[account(mut,
        seeds= [b"vault".as_ref(), player_authority.key().as_ref()],
        bump=vault_bump,
    )]
    player_vault: Account<'info, TokenAccount>,

    #[account(mut,
        seeds=[b"state".as_ref(), player_authority.key().as_ref()],
        bump=state_bump,
    )]
    player_state: Account<'info, PlayerState>,

    #[account(mut)]
    mint: Account<'info, Mint>,
    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    rent: Sysvar<'info, Rent>,
}

//TODO: ⛔️ complete this
#[derive(Accounts)]
pub struct RefillVault <'info>{

    wallet_to_withdraw_from: Account<'info, TokenAccount>,

}

//TODO: ⛔️ complete this
#[derive(Accounts)]
pub struct JoinAlliance  <'info> {
    joining_player: Account<'info, PlayerState>,
    alliance: Account<'info, AllianceState>,
}

//TODO: ⛔️ complete this
#[derive(Accounts)]
pub struct WithdrawFromVault<'info>{
    //probably just a transfer function
    placeholder: Signer<'info>,
}

//TODO: ⛔️ steal function using alliances
#[derive(Accounts)]
#[instruction(state_bump:u8, vault_bump:u8)]
pub struct GameLoop<'info> {
    #[account(mut)]
    /// CHECK: ⛔️ This is possibly unsafe
    pub bonkee: UncheckedAccount<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub bonker: Signer<'info>,
    #[account(mut)]
    pub bonker_player_state: Account<'info, PlayerState>,
    #[account(mut,
        seeds=[b"state".as_ref(), bonkee.key().as_ref()],
        bump=state_bump,
    )]
    pub bonkee_player_state: Account<'info, PlayerState>,
    /// CHECK:
    //pub bonkee_player_state: UncheckedAccount<'info>,
    #[account(mut,
        seeds= [b"vault".as_ref(), bonkee.key().as_ref()],
        bump=vault_bump,
    )]
    pub bonkee_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

//TODO: ⛔️ everything under here needs to be written properly
#[account]
pub struct PlayerState {
    pub data: u8,
    //pub vault: Pubkey
    //pub authority: Pubkey, ⛔️TODO: store creator pubkey in here and use it as constraint for modifying player state and vault
    //TODO: informations about connections to other players
    //      #of ties, which organizations player has ties to
}

#[account]
pub struct AllianceState {
    pub data: u8,
    //TODO: ⛔️create a rule which removes a player from the alliance when their delegate balance is too low
    //      store members possibly merkle tree method
}

impl PlayerState {
    pub fn space() -> usize {
        //TODO: ❗️calculate number of bytes based on accounts used by PlayerState
        9000
    }
}

impl AllianceState {
    pub fn space() -> usize {
        9000
    }
}