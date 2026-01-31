# Anchor Vault Program

A simple Solana smart contract built with Anchor. It implements a basic vault where users can:

- Initialize a vault PDA (Program Derived Address) with a state account to store bumps.
- Deposit SOL into the vault.
- Withdraw SOL from the vault (signed by the PDA).
- Close the vault, transferring remaining SOL back to the user and closing the state account.

## Prerequisites
- Anchor CLI (version 0.32.1 or later) installed via AVM.
- Surfpool CLI installed (for enhanced local testing and runbooks: `brew install surfpool` on macOS, or from source [surfpool](https://surfpool.run/)).
- Solana CLI tools.
- Node.js/Yarn for tests.

## Running Tests
To run the integration tests against a Surfpool local validator:

1. In one terminal window, start Surfpool in your project directory:
`surfpool start`
This launches a local Surfnet validator and deploys your program.

2. In a new terminal window (in the same directory), run the Anchor tests against it:
`anchor test --skip-local-validator`
This will execute the tests in `tests/anchor-vault-q4-25.ts`, covering initialize, deposit, withdraw, and close scenarios.

For standard local testing without Surfpool, just run `anchor test`.