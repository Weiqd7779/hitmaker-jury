import solc from 'solc';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { keccak256 } from 'ethers';
import { fileURLToPath } from 'node:url';

export async function compileContracts() {
  const source = await readFile(new URL('../contracts/CareerJury.sol', import.meta.url), 'utf8');
  const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'CareerJury.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: 'cancun', metadata: { bytecodeHash: 'none' }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } } })));
  const failures = (output.errors || []).filter(error => error.severity === 'error');
  if (failures.length) throw new Error(failures.map(error => error.formattedMessage).join('\n'));
  const contracts = {};
  for (const name of ['CareerJury', 'CareerWorker']) {
    const artifact = output.contracts['CareerJury.sol'][name];
    const deployedBytecode = `0x${artifact.evm.deployedBytecode.object}`;
    contracts[name] = { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}`, deployedBytecode, runtimeHash: keccak256(deployedBytecode) };
  }
  return { compiler: solc.version(), evmVersion: 'cancun', chainId: 16602, identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e', reputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713', rewardPerAgentWei: '1000000000000000', ...contracts };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const artifacts = await compileContracts();
  await mkdir(new URL('../.career-local/', import.meta.url), { recursive: true });
  await writeFile(new URL('../.career-local/contracts.json', import.meta.url), JSON.stringify(artifacts));
  console.log(JSON.stringify({ compiler: artifacts.compiler, evmVersion: artifacts.evmVersion, initCodeBytes: (artifacts.CareerJury.bytecode.length - 2) / 2, runtimeHash: artifacts.CareerJury.runtimeHash }));
}
