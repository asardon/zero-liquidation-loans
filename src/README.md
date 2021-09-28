# Setup
Make sure to use the following packages.
```
npm -i @openzeppelin/contracts@3.3.0
```
Note that `pragma solidity ^0.6.0;` is required.

# Setup HD Wallet
Use `npx mnemonics` to generate mnemonic. Then open `truffle console` and run
```
const HDWalletProvider = require('@truffle/hdwallet-provider');
const mnemonic = '...';
const wallet = new HDWalletProvider(mnemonic, "http://localhost:8545");
```
and retrieve private key to be imported to metamask via `wallet.wallets[...].privateKey.toString("hex")`.

# Running Tests

To run the Truffle tests:
```
npx ganache-cli -f https://mainnet.infura.io/v3/7d0d81d0919f4f05b9ab6634be01ee73 -i 1 --unlock "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503" --unlock "0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e"
truffle test
```
Make sure that the unlocked USDC and WETH addresses are up-to-date and match the constant addresses used in the tests.

https://docs.openzeppelin.com/learn/writing-automated-tests
