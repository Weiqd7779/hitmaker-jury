import { readFile } from 'node:fs/promises';
import solc from 'solc';
import { JsonRpcProvider, parseEther, toQuantity, formatEther } from 'ethers';

const source = await readFile(new URL('../contracts/CareerJury.sol', import.meta.url), 'utf8');
const harness = `pragma solidity 0.8.26; import "CareerJury.sol";
contract Probe {
 constructor() payable {
 string[3] memory agents=[string("https://career.example/agents/mixmaster.json"),"https://career.example/agents/melodyfox.json","https://career.example/agents/hitradar.json"];
 bytes32[3] memory hashes=[keccak256("mixing"),keccak256("composition"),keccak256("commercial")];
 CareerJury manager=new CareerJury(agents,agents,hashes,keccak256("readonly-probe"),"qwen2.5-omni");
 manager.settle{value:0.003 ether}();
 require(manager.settled());
 for(uint256 i;i<3;i++) {require(address(manager.workers(i)).balance==0.001 ether);require(manager.feedbackIndexes(i)>0);}
 }
}`;
const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'CareerJury.sol': { content: source }, 'Probe.sol': { content: harness } }, settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: 'cancun', outputSelection: { '*': { '*': ['evm.bytecode.object'] } } } })));
if (!output.contracts) throw new Error(JSON.stringify(output.errors));
const provider = new JsonRpcProvider('https://evmrpc-testnet.0g.ai');
try {
  const from = process.env.GALILEO_ESTIMATE_FROM || '0x1111111111111111111111111111111111111111';
  const transaction = { from, data: `0x${output.contracts['Probe.sol'].Probe.evm.bytecode.object}`, value: toQuantity(parseEther('0.003')), gasPrice: toQuantity(2000000000n) };
  const gas = await provider.send('eth_estimateGas', [transaction, 'latest', { [from]: { balance: toQuantity(parseEther('5')) } }]);
  console.log(JSON.stringify({ scope: 'eth_estimateGas only against Galileo canonical registries; balance override exists only inside this read-only simulation', success: true, gas: BigInt(gas).toString(), simulatedCostAt2Gwei0G: formatEther(BigInt(gas) * 2000000000n + parseEther('0.003')), signedTransactions: 0 }));
} finally { provider.destroy(); }
