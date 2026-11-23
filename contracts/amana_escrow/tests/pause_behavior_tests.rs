/// Issue #56 — Contract pause behavior tests.
///
/// Verifies that paused states block only the operations intended to stop
/// (state-changing trade operations) while leaving read-only queries and
/// guardian/admin controls unaffected. Also verifies that trade and asset
/// state is preserved across pause/unpause cycles so normal operation can
/// resume without data loss.
extern crate std;

use amana_escrow::{EscrowContract, EscrowContractClient};
use soroban_sdk::{
    Address, Env, String as SStr,
    testutils::{Address as _, Ledger},
    token,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup(env: &Env) -> (Address, Address, Address, Address, Address, Address) {
    let admin = Address::generate(env);
    let buyer = Address::generate(env);
    let seller = Address::generate(env);
    let guardian = Address::generate(env);
    let treasury = Address::generate(env);
    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    token::StellarAssetClient::new(env, &usdc).mint(&buyer, &1_000_000);
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(env, &contract_id);
    client.initialize(&admin, &usdc, &treasury, &100_u32, &usdc);
    client.add_guardian(&guardian);
    (contract_id, usdc, buyer, seller, guardian, admin)
}

fn funded_trade(
    client: &EscrowContractClient,
    env: &Env,
    usdc: &Address,
    buyer: &Address,
    seller: &Address,
) -> u64 {
    let trade_id = client.create_trade(buyer, seller, &1_000_i128);
    // deposit is called by the buyer
    token::Client::new(env, usdc);
    client.deposit(&trade_id);
    trade_id
}

// ---------------------------------------------------------------------------
// Global pause — blocked operations
// ---------------------------------------------------------------------------

#[test]
fn paused_contract_blocks_create_trade() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, _, buyer, seller, guardian, _) = setup(&env);
    let client = EscrowContractClient::new(&env, &env.register(EscrowContract, ()));

    // Need a fresh contract for this call; re-use the already-registered one.
    let (contract_id, usdc, buyer2, seller2, guardian2, admin2) = setup(&env);
    let c = EscrowContractClient::new(&env, &contract_id);
    c.pause(&guardian2);

    let res = c.try_create_trade(&buyer2, &seller2, &500_i128);
    assert!(res.is_err(), "create_trade must fail while paused");
    // Suppress unused warning
    let _ = (buyer, seller, guardian, client, usdc, admin2);
}

#[test]
fn paused_contract_blocks_deposit() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, usdc, buyer, seller, guardian, _admin) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);

    // Create the trade while unpaused, then pause before the deposit.
    let trade_id = client.create_trade(&buyer, &seller, &1_000_i128);
    client.pause(&guardian);

    let res = client.try_deposit(&trade_id);
    assert!(res.is_err(), "deposit must fail while paused");
    let _ = usdc;
}

#[test]
fn paused_contract_blocks_cancel_trade() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, usdc, buyer, seller, guardian, _admin) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);

    let trade_id = client.create_trade(&buyer, &seller, &1_000_i128);
    client.deposit(&trade_id);
    client.pause(&guardian);

    let res = client.try_cancel_trade(&trade_id, &buyer);
    assert!(res.is_err(), "cancel_trade must fail while paused");
    let _ = usdc;
}

#[test]
fn paused_contract_blocks_release_funds() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, usdc, buyer, seller, guardian, _admin) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);

    let trade_id = client.create_trade(&buyer, &seller, &1_000_i128);
    client.deposit(&trade_id);
    client.confirm_delivery(&trade_id);
    client.pause(&guardian);

    let res = client.try_release_funds(&trade_id, &seller);
    assert!(res.is_err(), "release_funds must fail while paused");
    let _ = usdc;
}

// ---------------------------------------------------------------------------
// Global pause — read-only operations remain accessible
// ---------------------------------------------------------------------------

#[test]
fn paused_contract_allows_is_paused_query() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, guardian, _) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);

    client.pause(&guardian);
    assert!(client.is_paused(), "is_paused must return true");
}

#[test]
fn paused_contract_allows_get_pause_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(999);
    let (contract_id, _, _, _, guardian, _) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);

    let reason = SStr::from_str(&env, "test pause");
    client.pause_with_reason(&guardian, &reason);
    let meta = client.get_pause_metadata().expect("metadata must be present");
    assert_eq!(meta.paused_at, 999);
    assert_eq!(meta.reason, reason);
}

#[test]
fn paused_contract_allows_admin_reads() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, guardian, _admin) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);

    client.pause(&guardian);
    // These read-only getters must succeed even while paused.
    let _ = client.get_admin();
    let _ = client.get_fee_bps();
    let _ = client.get_token_contract();
    let _ = client.get_treasury();
    let _ = client.get_schema_version();
}

// ---------------------------------------------------------------------------
// Unpause restores normal operation and preserves state
// ---------------------------------------------------------------------------

#[test]
fn unpause_restores_create_trade() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, buyer, seller, guardian, _) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);

    client.pause(&guardian);
    assert!(client.is_paused());

    client.unpause(&guardian);
    assert!(!client.is_paused());

    // Should succeed after unpause.
    let trade_id = client.create_trade(&buyer, &seller, &100_i128);
    assert!(trade_id > 0, "trade_id must be positive after unpause");
}

#[test]
fn trade_state_preserved_across_pause_unpause_cycle() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, buyer, seller, guardian, _) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);

    let trade_id = client.create_trade(&buyer, &seller, &1_000_i128);
    client.deposit(&trade_id);

    // Pause, verify blocked, unpause, verify op resumes.
    client.pause(&guardian);
    assert!(client.try_cancel_trade(&trade_id, &buyer).is_err());

    client.unpause(&guardian);
    // cancel_trade should succeed because the trade is still in Funded state.
    client.cancel_trade(&trade_id, &buyer);
}

// ---------------------------------------------------------------------------
// Per-asset pause — selective blocking
// ---------------------------------------------------------------------------

#[test]
fn asset_pause_blocks_new_trades_in_paused_asset_only() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let guardian = Address::generate(&env);
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let treasury = Address::generate(&env);

    // Set up two assets: primary (cngn) and secondary (usdc).
    let cngn = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    token::StellarAssetClient::new(&env, &cngn).mint(&buyer, &100_000);
    token::StellarAssetClient::new(&env, &usdc).mint(&buyer, &100_000);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &cngn, &treasury, &0_u32, &cngn);
    client.add_guardian(&guardian);
    client.allow_asset(&usdc, &6_u32);

    // Pause only the secondary asset (usdc).
    client.pause_asset(&guardian, &usdc);

    // Creating a trade in the paused asset must fail.
    let res = client.try_create_trade_with_asset(&buyer, &seller, &100_i128, &usdc);
    assert!(res.is_err(), "trade creation in paused asset must fail");

    // Creating a trade in the still-active primary asset must succeed.
    let trade_id = client.create_trade(&buyer, &seller, &100_i128);
    assert!(trade_id > 0, "trade in non-paused asset must succeed");
}

#[test]
fn asset_unpause_restores_trading_in_that_asset() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let guardian = Address::generate(&env);
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let treasury = Address::generate(&env);

    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    token::StellarAssetClient::new(&env, &usdc).mint(&buyer, &100_000);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &usdc, &treasury, &0_u32, &usdc);
    client.add_guardian(&guardian);

    client.pause_asset(&guardian, &usdc);
    assert!(client.is_asset_paused(&usdc));

    client.unpause_asset(&guardian, &usdc);
    assert!(!client.is_asset_paused(&usdc));

    // Trading should now be possible again.
    let trade_id = client.create_trade(&buyer, &seller, &100_i128);
    assert!(trade_id > 0);
}

#[test]
fn global_pause_takes_precedence_over_asset_active_state() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, buyer, seller, guardian, _) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);

    // Pause the whole contract (not just one asset).
    client.pause(&guardian);

    // Even the primary (non-paused) asset must be blocked.
    let res = client.try_create_trade(&buyer, &seller, &100_i128);
    assert!(res.is_err(), "global pause must block all assets");
}
