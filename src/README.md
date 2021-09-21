# Setup
Make sure to use the following packages.
```
npm -i @openzeppelin/contracts@3.3.0
npm -i @chainlink/contracts --save
npm i abdk-libraries-solidity
```
Note that `pragma solidity ^0.6.0;` is required.

# Running Tests

To run the Truffle tests:
```
npx ganache-cli -f https://mainnet.infura.io/v3/7d0d81d0919f4f05b9ab6634be01ee73 -i 1 -d --unlock "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" --unlock "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
truffle test
```
Update the USDC and WETH unlock addresses to be used for testing

https://docs.openzeppelin.com/learn/writing-automated-tests
