pragma solidity 0.8.26;

interface IIdentityRegistry {
    function register() external returns (uint256);
    function setAgentURI(uint256 agentId, string calldata uri) external;
    function ownerOf(uint256 agentId) external view returns (address);
    function getAgentWallet(uint256 agentId) external view returns (address);
}

interface IReputationRegistry {
    function giveFeedback(uint256 agentId, int128 value, uint8 decimals, string calldata tag1, string calldata tag2, string calldata endpoint, string calldata feedbackURI, bytes32 feedbackHash) external;
    function getLastIndex(uint256 agentId, address client) external view returns (uint64);
}

contract CareerWorker {
    address public controller;
    address public manager;
    uint256 public agentId;
    IIdentityRegistry public constant IDENTITY = IIdentityRegistry(0x8004A818BFB912233c491871b3d84c89A494BD9e);
    event RewardReceived(bytes32 indexed jobHash, uint256 indexed agentId, address indexed employer, uint256 amount);
    event Withdrawn(address indexed recipient, uint256 amount);

    constructor(address owner, string memory uri) {
        controller = owner;
        manager = msg.sender;
        agentId = IDENTITY.register();
        IDENTITY.setAgentURI(agentId, uri);
    }

    function receiveReward(bytes32 jobHash) external payable {
        require(msg.sender == manager, "Manager only");
        require(msg.value == 0.001 ether, "Exact reward required");
        emit RewardReceived(jobHash, agentId, msg.sender, msg.value);
    }

    function withdraw(address payable recipient, uint256 amount) external {
        require(msg.sender == controller, "Controller only");
        require(recipient != address(0) && amount <= address(this).balance, "Invalid withdrawal");
        (bool success,) = recipient.call{value: amount}("");
        require(success, "Withdrawal failed");
        emit Withdrawn(recipient, amount);
    }
}

contract CareerJury {
    address public owner;
    CareerWorker[3] public workers;
    uint256[3] public agentIds;
    bytes32[3] public artifactHashes;
    string[3] public artifactURIs;
    bytes32 public jobHash;
    string public model;
    bool public settled;
    uint64[3] public feedbackIndexes;
    IReputationRegistry public constant REPUTATION = IReputationRegistry(0x8004B663056A597Dffe9eCcC1965A193B7388713);
    uint256 public constant REWARD = 0.001 ether;
    event AgentRegistered(uint256 indexed role, uint256 indexed agentId, address indexed wallet, string uri);
    event WorkRecorded(bytes32 indexed jobHash, uint256 indexed agentId, bytes32 artifactHash, uint64 feedbackIndex, uint256 reward);
    event JobSettled(bytes32 indexed jobHash, address indexed payer, string model, uint256 totalReward);

    constructor(string[3] memory agentURIs, string[3] memory recordURIs, bytes32[3] memory hashes, bytes32 job, string memory workModel) {
        require(block.chainid == 16602, "Galileo only");
        require(job != bytes32(0) && bytes(workModel).length > 0 && bytes(workModel).length <= 128, "Invalid work");
        owner = msg.sender;
        jobHash = job;
        model = workModel;
        for (uint256 i; i < 3; ++i) {
            require(bytes(agentURIs[i]).length > 0 && bytes(agentURIs[i]).length <= 512, "Invalid agent URI");
            require(bytes(recordURIs[i]).length > 0 && bytes(recordURIs[i]).length <= 512 && hashes[i] != bytes32(0), "Invalid record");
            CareerWorker worker = new CareerWorker(msg.sender, agentURIs[i]);
            workers[i] = worker;
            agentIds[i] = worker.agentId();
            artifactHashes[i] = hashes[i];
            artifactURIs[i] = recordURIs[i];
            emit AgentRegistered(i, worker.agentId(), address(worker), agentURIs[i]);
        }
    }

    function settle() external payable {
        require(msg.sender == owner, "Owner only");
        require(!settled, "Already settled");
        require(msg.value == REWARD * 3, "Exact total required");
        settled = true;
        for (uint256 i; i < 3; ++i) {
            REPUTATION.giveFeedback(agentIds[i], 1, 0, "accepted", model, "music-review", artifactURIs[i], artifactHashes[i]);
            uint64 index = REPUTATION.getLastIndex(agentIds[i], address(this));
            feedbackIndexes[i] = index;
            workers[i].receiveReward{value: REWARD}(jobHash);
            emit WorkRecorded(jobHash, agentIds[i], artifactHashes[i], index, REWARD);
        }
        emit JobSettled(jobHash, msg.sender, model, msg.value);
    }
}
