# Anchor Escrow Program

A simple Solana smart contract built with Anchor. It implements a basic escrow for token swaps where:

- The maker initializes an escrow PDA, deposits Token A into a vault, and specifies the amount of Token B to receive.
- The taker can "take" the deal by depositing Token B to the maker and withdrawing Token A from the vault (closing the escrow and vault as well).
- The maker can refund if no taker accepts, withdrawing Token A back and closing the escrow and vault.

The escrow uses PDAs for security and supports SPL tokens.

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
This will execute the tests in `tests/anchor-escrow-q4-25.ts`, covering make/refund and make/take scenarios.

For standard local testing without Surfpool, just run `anchor test`.