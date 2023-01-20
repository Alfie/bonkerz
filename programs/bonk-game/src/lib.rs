use anchor_lang::prelude::*;

declare_id!("6meFHJwukF1ZEF8cPFzmjj3kAfuJ8ugEt8o7cEG2LoZ4");

#[program]
pub mod bonk_game {
    use super::*;

    //TODO: replace this with the game actions described in the document
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn game_loop(ctx: Context<GameLoop>) -> Result<()> {

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

//placeholder
#[derive(Accounts)]
pub struct GameLoop {}
