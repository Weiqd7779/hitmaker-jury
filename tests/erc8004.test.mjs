import test from 'node:test';
import assert from 'node:assert/strict';
import hre from 'hardhat';
import solc from 'solc';
import { BrowserProvider, Contract, ContractFactory, keccak256, toUtf8Bytes, parseEther, formatEther } from 'ethers';
import { compileContracts } from '../scripts/compile-contracts.mjs';

const IDENTITY = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
const REPUTATION = '0x8004B663056A597Dffe9eCcC1965A193B7388713';
const mocks = `pragma solidity 0.8.26;
contract IdentityMock {
 uint256 next; mapping(uint256=>address) public ownerOf; mapping(uint256=>string) public tokenURI;
 function register() external returns(uint256 id){id=next++;ownerOf[id]=msg.sender;}
 function setAgentURI(uint256 id,string calldata uri) external {require(ownerOf[id]==msg.sender);tokenURI[id]=uri;}
 function getAgentWallet(uint256 id) external view returns(address){return ownerOf[id];}
}
interface Id {function ownerOf(uint256) external view returns(address);}
contract ReputationMock {
 struct Feedback {int128 value; uint8 decimals; string tag1; string tag2; bool revoked;}
 mapping(uint256=>mapping(address=>Feedback[])) records;
 function giveFeedback(uint256 id,int128 value,uint8 decimals,string calldata tag1,string calldata tag2,string calldata,string calldata,bytes32) external {
 require(Id(${IDENTITY}).ownerOf(id)!=msg.sender);records[id][msg.sender].push(Feedback(value,decimals,tag1,tag2,false));}
 function getLastIndex(uint256 id,address client) external view returns(uint64){return uint64(records[id][client].length);}
 function readFeedback(uint256 id,address client,uint64 index) external view returns(int128,uint8,string memory,string memory,bool){Feedback storage f=records[id][client][index-1];return(f.value,f.decimals,f.tag1,f.tag2,f.revoked);}
}`;

test('ERC-8004 identity, canonical feedback and atomic native rewards', async t => {
  assert.match(await hre.network.provider.request({ method: 'web3_clientVersion' }), /Hardhat/i);
  const provider = new BrowserProvider(hre.network.provider, undefined, { cacheTimeout: -1 });
  if (process.env.GALILEO_FORK !== '1') {
    const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'Mocks.sol': { content: mocks } }, settings: { evmVersion: 'cancun', viaIR: true, optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['evm.deployedBytecode.object'] } } } })));
    assert.ok(output.contracts, JSON.stringify(output.errors));
    for (const [address, name] of [[IDENTITY, 'IdentityMock'], [REPUTATION, 'ReputationMock']]) await hre.network.provider.request({ method: 'hardhat_setCode', params: [address, `0x${output.contracts['Mocks.sol'][name].evm.deployedBytecode.object}`] });
  }
  const owner = await provider.getSigner(0), stranger = await provider.getSigner(1), artifacts = await compileContracts();
  const factory = new ContractFactory(artifacts.CareerJury.abi, artifacts.CareerJury.bytecode, owner);
  const records = ['mixmaster', 'melodyfox', 'hitradar'].map(name => `https://career.example/records/${name}.json`);
  const uris = records.map(uri => uri.replace('/records/', '/agents/'));
  const hashes = records.map(uri => keccak256(toUtf8Bytes(uri)));
  const job = keccak256(toUtf8Bytes('Music Jury #031 local test'));
  const jury = await factory.deploy(uris, records, hashes, job, 'qwen2.5-omni', { gasPrice: 2000000000n });
  const creation = await jury.deploymentTransaction().wait();
  const address = await jury.getAddress();
  const registry = new Contract(IDENTITY, ['function ownerOf(uint256) view returns(address)', 'function tokenURI(uint256) view returns(string)', 'function getAgentWallet(uint256) view returns(address)'], provider);
  const reputation = new Contract(REPUTATION, ['function readFeedback(uint256,address,uint64) view returns(int128,uint8,string,string,bool)', 'function getLastIndex(uint256,address) view returns(uint64)'], provider);
  const ids = [], wallets = [];
  await t.test('registers three distinct real registry tokens owned by agent wallets', async () => {
    assert.equal(keccak256(await provider.getCode(address)), artifacts.CareerJury.runtimeHash);
    for (let i = 0; i < 3; i++) {
      const id = await jury.agentIds(i), wallet = await jury.workers(i); ids.push(id); wallets.push(wallet);
      assert.equal(await registry.ownerOf(id), wallet); assert.equal(await registry.getAgentWallet(id), wallet); assert.equal(await registry.tokenURI(id), uris[i]);
    }
    assert.equal(new Set(ids.map(String)).size, 3);
  });
  await t.test('only the controller can settle, with exactly 0.003 OG', async () => {
    await assert.rejects(jury.connect(stranger).settle({ value: parseEther('0.003') }));
    await assert.rejects(jury.settle({ value: parseEther('0.004') }));
    assert.equal(await jury.settled(), false);
  });
  await t.test('rolls back all feedback and payments if a worker rejects payment', async () => {
    const code = await provider.getCode(wallets[1]);
    await hre.network.provider.request({ method: 'hardhat_setCode', params: [wallets[1], '0x60006000fd'] });
    await assert.rejects(jury.settle({ value: parseEther('0.003'), gasLimit: 2000000, gasPrice: 2000000000n }));
    assert.equal(await jury.settled(), false);
    for (const id of ids) assert.equal(await reputation.getLastIndex(id, address), 0n);
    for (const wallet of wallets) assert.equal(await provider.getBalance(wallet), 0n);
    await hre.network.provider.request({ method: 'hardhat_setCode', params: [wallets[1], code] });
  });
  await t.test('settles canonical feedback and three 0.001 OG rewards once', async () => {
    const receipt = await (await jury.settle({ value: parseEther('0.003'), gasPrice: 2000000000n })).wait();
    assert.equal(await jury.settled(), true);
    for (let i = 0; i < 3; i++) {
      const index = await jury.feedbackIndexes(i), feedback = await reputation.readFeedback(ids[i], address, index);
      assert.equal(feedback[0], 1n); assert.equal(feedback[2], 'accepted'); assert.equal(feedback[3], 'qwen2.5-omni');
      assert.equal(await provider.getBalance(wallets[i]), parseEther('0.001'));
    }
    await assert.rejects(jury.settle({ value: parseEther('0.003') }));
    console.log(JSON.stringify({ execution: process.env.GALILEO_FORK === '1' ? 'LOCAL fork of Galileo registry state; not a live transaction' : 'LOCAL EVM registry fixtures', deploymentGas: String(creation.gasUsed), settlementGas: String(receipt.gasUsed), totalAt2GweiIncludingRewards0G: formatEther((creation.gasUsed + receipt.gasUsed) * 2000000000n + parseEther('0.003')) }));
  });
  await t.test('agent reward remains recoverable by its controller', async () => {
    const worker = new Contract(wallets[0], artifacts.CareerWorker.abi, owner);
    await assert.rejects(worker.connect(stranger).withdraw(await stranger.getAddress(), 1n));
    await (await worker.withdraw(await owner.getAddress(), parseEther('0.001'))).wait();
    assert.equal(await provider.getBalance(wallets[0]), 0n);
  });
  provider.destroy();
});
