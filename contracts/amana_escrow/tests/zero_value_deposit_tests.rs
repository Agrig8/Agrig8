/// Issue #52 — Explicitly reject deposits (create_trade) with zero or negative value.
///
/// The contract uses `assert!(amount > 0, "amount must be greater than zero")` in
/// `create_trade` and `deposit_with_path`.  This file documents the rejection
/// behaviour as executable tests so a refactor that removes or weakens the check
/// is caught immediately rather than at the protocol level.
///
/// Error code: the current guard panics with the string
///   "amount must be greater than zero"
/// A future migration to `panic_with_error!` should update these tests to
/// assert `Err(Ok(Error::InvalidAmount))` or similar.
extern crate std;

use amana_escrow::{EscrowContract, EscrowContractClient};
use soroban_sdk::{Address, Env, String as SStr, testutils::Address as _, token, vec};

fn setup() -> (Env, EscrowContractClient<'static>, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let usdc_id = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &usdc_id, &treasury, &100u32, &usdc_id);
    (env, client, usdc_id, admin, treasury, contract_id)
}

// ---------------------------------------------------------------------------
// create_trade zero / negative amounts
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "amount must be greater than zero")]
fn create_trade_rejects_zero_amount() {
    let (env, client, ..) = setup();
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    // Amount of zero — must be rejected before any on-chain state is written.
    client.create_trade(&buyer, &seller, &0, &5000, &5000, &None);
}

#[test]
#[should_panic(expected = "amount must be greater than zero")]
fn create_trade_rejects_negative_amount() {
    let (env, client, ..) = setup();
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    // i128 is signed; a negative escrow deposit must also be rejected.
    client.create_trade(&buyer, &seller, &-1, &5000, &5000, &None);
}

// ---------------------------------------------------------------------------
// deposit_with_path zero amounts
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "source_amount must be greater than zero")]
fn deposit_with_path_rejects_zero_source_amount() {
    let (env, client, usdc_id, ..) = setup();
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);

    // Create a valid trade first so the deposit call reaches the amount guard.
    token::StellarAssetClient::new(&env, &usdc_id).mint(&buyer, &1_000_000);
    let trade_id = client.create_trade(&buyer, &seller, &1_000_000, &5000, &5000, &None);

    // source_amount of zero — must be rejected.
    client.deposit_with_path(&trade_id, &buyer, &0, &1_000_000, &vec![&env]);
}

#[test]
#[should_panic(expected = "dest_min must be greater than zero")]
fn deposit_with_path_rejects_zero_dest_min() {
    let (env, client, usdc_id, ..) = setup();
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);

    token::StellarAssetClient::new(&env, &usdc_id).mint(&buyer, &1_000_000);
    let trade_id = client.create_trade(&buyer, &seller, &1_000_000, &5000, &5000, &None);

    // dest_min of zero — must be rejected.
    client.deposit_with_path(&trade_id, &buyer, &1_000_000, &0, &vec![&env]);
}

// ---------------------------------------------------------------------------
// Positive path — a minimum-value deposit of 1 stroop is accepted
// ---------------------------------------------------------------------------

#[test]
fn create_trade_accepts_minimum_nonzero_amount() {
    let (env, client, usdc_id, ..) = setup();
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);

    token::StellarAssetClient::new(&env, &usdc_id).mint(&buyer, &1);
    let trade_id = client.create_trade(&buyer, &seller, &1, &5000, &5000, &None);

    // The trade should now be in Created status (deposit not yet made).
    let trade = client.get_trade(&trade_id);
    assert_eq!(trade.amount, 1);
}
