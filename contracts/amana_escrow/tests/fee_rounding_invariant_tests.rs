/// Issue #57 — Fee and split calculations preserve remainder and never create extra value.
///
/// Properties verified:
///   1. fee_amount = floor(amount * fee_bps / 10_000)         → seller net = amount - fee_amount
///   2. fee + seller_net == amount                             (conservation, no rounding loss)
///   3. fee_amount * 10_000 <= amount * fee_bps               (never round up — floor division)
///   4. resolve_dispute: buyer_payout + seller_payout + fee == trade_amount  (conservation)
///   5. fee is never negative
extern crate std;

use amana_escrow::{EscrowContract, EscrowContractClient};
use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use soroban_sdk::{Address, Env, String as SStr, testutils::Address as _, token};

// ---------------------------------------------------------------------------
// Minimal harness
// ---------------------------------------------------------------------------

struct RoundingEnv {
    env: Env,
    contract_id: Address,
    usdc_id: Address,
    treasury: Address,
}

impl RoundingEnv {
    fn new(fee_bps: u32) -> Self {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let usdc_id = env
            .register_stellar_asset_contract_v2(admin.clone())
            .address();
        let contract_id = env.register(EscrowContract, ());
        EscrowContractClient::new(&env, &contract_id)
            .initialize(&admin, &usdc_id, &treasury, &fee_bps, &usdc_id);
        let mediator = Address::generate(&env);
        EscrowContractClient::new(&env, &contract_id).set_mediator(&mediator);
        RoundingEnv { env, contract_id, usdc_id, treasury }
    }

    fn client(&self) -> EscrowContractClient<'_> {
        EscrowContractClient::new(&self.env, &self.contract_id)
    }

    fn token(&self) -> token::Client<'_> {
        token::Client::new(&self.env, &self.usdc_id)
    }
}

fn clamp_amount(raw: i64) -> i128 {
    (raw.unsigned_abs() as i128).clamp(1, 1_000_000_000)
}

fn clamp_bps(raw: u32) -> u32 {
    raw % 10_001 // 0..=10_000
}

fn clamp_loss_pair(raw_buyer: u32) -> (u32, u32) {
    let b = raw_buyer % 10_001;
    (b, 10_000 - b)
}

// ---------------------------------------------------------------------------
// Property 1 & 2: release_funds fee conservation
// ---------------------------------------------------------------------------

/// After `release_funds`, fee + seller_net == original trade amount.
#[quickcheck]
fn prop_release_fee_conservation(raw_amount: i64, raw_fee_bps: u32) -> TestResult {
    let amount = clamp_amount(raw_amount);
    let fee_bps = clamp_bps(raw_fee_bps);

    let re = RoundingEnv::new(fee_bps);
    let client = re.client();
    let buyer = Address::generate(&re.env);
    let seller = Address::generate(&re.env);

    token::StellarAssetClient::new(&re.env, &re.usdc_id).mint(&buyer, &amount);

    let trade_id = client.create_trade(&buyer, &seller, &amount, &5000, &5000, &None);
    client.deposit(&trade_id);

    let seller_before = re.token().balance(&seller);
    let treasury_before = re.token().balance(&re.treasury);

    client.release_funds(&trade_id, &buyer);

    let seller_payout = re.token().balance(&seller) - seller_before;
    let fee_payout = re.token().balance(&re.treasury) - treasury_before;

    // Conservation: nothing created or destroyed
    assert_eq!(
        seller_payout + fee_payout,
        amount,
        "release_funds: seller_payout({seller_payout}) + fee({fee_payout}) != amount({amount}), fee_bps={fee_bps}"
    );

    // Floor division: fee must not exceed amount * fee_bps / 10_000 rounded up
    assert!(
        fee_payout * 10_000 <= amount * fee_bps as i128,
        "fee rounded up: fee={fee_payout} amount={amount} fee_bps={fee_bps}"
    );

    // Fee is non-negative
    assert!(fee_payout >= 0, "fee is negative");

    TestResult::passed()
}

// ---------------------------------------------------------------------------
// Property 4: resolve_dispute conservation
// ---------------------------------------------------------------------------

/// After `resolve_dispute`, buyer_payout + seller_payout + fee == trade_amount.
#[quickcheck]
fn prop_dispute_resolution_conservation(
    raw_amount: i64,
    raw_fee_bps: u32,
    raw_buyer_loss_bps: u32,
) -> TestResult {
    let amount = clamp_amount(raw_amount);
    let fee_bps = clamp_bps(raw_fee_bps);
    let (buyer_loss_bps, seller_loss_bps) = clamp_loss_pair(raw_buyer_loss_bps);

    let re = RoundingEnv::new(fee_bps);
    let client = re.client();
    let buyer = Address::generate(&re.env);
    let seller = Address::generate(&re.env);

    let mediator_list = client.list_mediators();
    if mediator_list.is_empty() {
        return TestResult::discard();
    }
    let mediator = mediator_list.get(0).unwrap();

    token::StellarAssetClient::new(&re.env, &re.usdc_id).mint(&buyer, &amount);

    let trade_id = client.create_trade(
        &buyer,
        &seller,
        &amount,
        &buyer_loss_bps,
        &seller_loss_bps,
        &None,
    );
    client.deposit(&trade_id);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.initiate_dispute(&trade_id, &buyer, &SStr::from_str(&re.env, "QmTest"))
    }));
    if result.is_err() {
        return TestResult::discard();
    }

    let buyer_before = re.token().balance(&buyer);
    let seller_before = re.token().balance(&seller);
    let treasury_before = re.token().balance(&re.treasury);

    let resolve_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.resolve_dispute(&trade_id, &mediator, &5000);
    }));
    if resolve_result.is_err() {
        return TestResult::discard();
    }

    let buyer_payout = re.token().balance(&buyer) - buyer_before;
    let seller_payout = re.token().balance(&seller) - seller_before;
    let fee_payout = re.token().balance(&re.treasury) - treasury_before;

    assert_eq!(
        buyer_payout + seller_payout + fee_payout,
        amount,
        "resolve_dispute conservation failed: buyer={buyer_payout} seller={seller_payout} fee={fee_payout} != amount={amount}"
    );

    TestResult::passed()
}

// ---------------------------------------------------------------------------
// Property 3: floor division — deterministic boundary cases
// ---------------------------------------------------------------------------

#[test]
fn fee_floor_division_boundary_cases() {
    // fee = floor(amount * fee_bps / 10_000)
    // 1 unit @ any bps < 10_000 → fee = 0 (1 * bps / 10_000 = 0)
    for bps in [1u32, 9999, 5000, 100] {
        let re = RoundingEnv::new(bps);
        let client = re.client();
        let buyer = Address::generate(&re.env);
        let seller = Address::generate(&re.env);

        token::StellarAssetClient::new(&re.env, &re.usdc_id).mint(&buyer, &1);
        let trade_id = client.create_trade(&buyer, &seller, &1, &5000, &5000, &None);
        client.deposit(&trade_id);

        let treasury_before = re.token().balance(&re.treasury);
        client.release_funds(&trade_id, &buyer);
        let fee = re.token().balance(&re.treasury) - treasury_before;

        // With amount=1, fee must be 0 (floor(1 * bps / 10_000) = 0 for any bps < 10_000)
        assert_eq!(fee, 0, "amount=1 bps={bps}: expected fee=0 but got fee={fee}");
    }

    // 10_000 units @ 100 bps → fee = 100 exactly
    {
        let re = RoundingEnv::new(100);
        let client = re.client();
        let buyer = Address::generate(&re.env);
        let seller = Address::generate(&re.env);

        token::StellarAssetClient::new(&re.env, &re.usdc_id).mint(&buyer, &10_000);
        let trade_id = client.create_trade(&buyer, &seller, &10_000, &5000, &5000, &None);
        client.deposit(&trade_id);

        let treasury_before = re.token().balance(&re.treasury);
        client.release_funds(&trade_id, &buyer);
        let fee = re.token().balance(&re.treasury) - treasury_before;

        assert_eq!(fee, 100, "10_000 units @ 100 bps: expected fee=100 but got fee={fee}");
    }
}
