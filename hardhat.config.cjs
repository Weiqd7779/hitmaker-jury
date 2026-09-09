module.exports = {
  solidity: { version: '0.8.26', settings: { evmVersion: 'cancun', optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat: {
      chainId: 16602,
      hardfork: 'cancun',
      ...(process.env.GALILEO_FORK === '1' ? { forking: { url: 'https://evmrpc-testnet.0g.ai' } } : {}),
    },
  },
};
