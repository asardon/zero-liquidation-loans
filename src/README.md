# Setup
Make sure to use the following packages.
```
npm -i @openzeppelin/contracts@3.3.0
```
Note that `pragma solidity ^0.6.0;` is required.

## Setup HD Wallet
Use `npx mnemonics` to generate mnemonic. Then open `truffle console` and run
```
const HDWalletProvider = require('@truffle/hdwallet-provider');
const mnemonic = '...';
const wallet = new HDWalletProvider(mnemonic, "http://localhost:8545");
```
and retrieve private key to be imported to metamask via `wallet.wallets[...].privateKey.toString("hex")`.

## Running Tests

To run the Truffle tests:
```
npx ganache-cli -f https://mainnet.infura.io/v3/7d0d81d0919f4f05b9ab6634be01ee73 -i 1 --unlock "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503" --unlock "0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e"
truffle test
```
Make sure that the unlocked USDC and WETH addresses are up-to-date and match the constant addresses used in the tests.

https://docs.openzeppelin.com/learn/writing-automated-tests

## Deploy on Kovan
Run `truffle migrate --network kovan --reset`
NOTE: in case the webapp returns an error when trying to load smart contract
data, make sure to check the correct deployment config was used in `2_deploy_contracts`.

# Kovan Test Contracts

## USDC Contract
USDC deployed on Kovan: `0xFd048DFba225e1984ebAf30eBc41123D765A1236`
```
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {

    constructor () ERC20("USDC", "USDC") {
        _mint(msg.sender, 100000000 * (10 ** uint256(decimals())));
    }

    function decimals() public view override returns (uint8) {
        return 6;
    }
}
```

## WETH Contract
WETH deployed on Kovan: `0x74e9a84d8e9d037a14f5e9efdfe84cbe38af370e`
```
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {

    constructor () ERC20("WETH", "WETH") {
        _mint(msg.sender, 1000000 * (10 ** uint256(decimals())));
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }
}
```

## Faucet Contract
Myso faucet on Kovan: `0xc8758a4829C7070324c30180cb52B7E4e9B9fbF0`
Verify and publish code using remix using flattened file (active remix's flattener plugin).
```
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";

contract MysoFaucet {

    function topup() public {
        ERC20(0xFd048DFba225e1984ebAf30eBc41123D765A1236).transfer(msg.sender, 1000 * (10 ** 6));
        ERC20(0x74e9a84D8e9D037a14F5e9EFDFe84cBe38AF370E).transfer(msg.sender, 1000 * (10 ** 18));
    }
}
```
