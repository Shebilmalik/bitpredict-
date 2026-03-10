// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PredictionMarket {

    struct Market {
        uint256 id;
        string  question;
        string  category;
        address creator;
        uint256 createdAt;
        uint256 endTime;
        uint256 yesPool;
        uint256 noPool;
        bool    resolved;
        bool    outcome;
        bool    cancelled;
        string  imageUrl;
    }

    struct Bet {
        uint256 yesAmount;
        uint256 noAmount;
        bool    claimed;
    }

    address public owner;
    uint256 public platformFeeBps = 200;
    uint256 public constant FEE_DENOM    = 10_000;
    uint256 public constant MIN_DURATION = 3_600;
    uint256 public constant MAX_DURATION = 30 days;

    uint256 public marketCount;
    uint256 public totalVolume;
    uint256 public accumulatedFees;

    mapping(uint256 => Market)                  public markets;
    mapping(uint256 => mapping(address => Bet)) public bets;
    mapping(address => uint256[])               public userCreated;
    mapping(address => uint256[])               public userBetIds;
    mapping(address => bool)                    public resolvers;

    event MarketCreated  (uint256 indexed id, address indexed creator, string question, uint256 endTime);
    event BetPlaced      (uint256 indexed marketId, address indexed user, bool side, uint256 amount);
    event MarketResolved (uint256 indexed marketId, bool outcome);
    event RewardClaimed  (uint256 indexed marketId, address indexed user, uint256 amount);
    event MarketCancelled(uint256 indexed marketId);
    event FeeWithdrawn   (address indexed to, uint256 amount);
    event ResolverUpdated(address indexed resolver, bool active);

    modifier onlyOwner()            { require(msg.sender == owner, "Not owner"); _; }
    modifier onlyResolver()         { require(resolvers[msg.sender] || msg.sender == owner, "Not resolver"); _; }
    modifier exists(uint256 id)     { require(id > 0 && id <= marketCount, "Market not found"); _; }
    modifier active(uint256 id)     {
        require(!markets[id].resolved,  "Already resolved");
        require(!markets[id].cancelled, "Market cancelled");
        require(block.timestamp < markets[id].endTime, "Market ended");
        _;
    }

    constructor() { owner = msg.sender; resolvers[msg.sender] = true; }

    function createMarket(string calldata _question, string calldata _category, uint256 _duration, string calldata _imageUrl) external returns (uint256 newId) {
        require(bytes(_question).length > 0, "Empty question");
        require(_duration >= MIN_DURATION,   "Min 1 hour");
        require(_duration <= MAX_DURATION,   "Max 30 days");
        unchecked { newId = ++marketCount; }
        markets[newId] = Market({ id: newId, question: _question, category: _category, creator: msg.sender, createdAt: block.timestamp, endTime: block.timestamp + _duration, yesPool: 0, noPool: 0, resolved: false, outcome: false, cancelled: false, imageUrl: _imageUrl });
        userCreated[msg.sender].push(newId);
        emit MarketCreated(newId, msg.sender, _question, block.timestamp + _duration);
    }

    function betYes(uint256 marketId) external payable exists(marketId) active(marketId) {
        require(msg.value > 0, "Zero value");
        bets[marketId][msg.sender].yesAmount += msg.value;
        markets[marketId].yesPool            += msg.value;
        totalVolume                          += msg.value;
        _trackBet(msg.sender, marketId);
        emit BetPlaced(marketId, msg.sender, true, msg.value);
    }

    function betNo(uint256 marketId) external payable exists(marketId) active(marketId) {
        require(msg.value > 0, "Zero value");
        bets[marketId][msg.sender].noAmount += msg.value;
        markets[marketId].noPool            += msg.value;
        totalVolume                         += msg.value;
        _trackBet(msg.sender, marketId);
        emit BetPlaced(marketId, msg.sender, false, msg.value);
    }

    function resolveMarket(uint256 marketId, bool _outcome) external onlyResolver exists(marketId) {
        Market storage m = markets[marketId];
        require(!m.resolved,  "Already resolved");
        require(!m.cancelled, "Cancelled");
        require(block.timestamp >= m.endTime, "Not ended yet");
        m.resolved = true; m.outcome = _outcome;
        emit MarketResolved(marketId, _outcome);
    }

    function cancelMarket(uint256 marketId) external exists(marketId) {
        Market storage m = markets[marketId];
        require(msg.sender == m.creator || msg.sender == owner, "Not authorized");
        require(!m.resolved,  "Already resolved");
        require(!m.cancelled, "Already cancelled");
        m.cancelled = true;
        emit MarketCancelled(marketId);
    }

    function claim(uint256 marketId) external exists(marketId) {
        Market storage m = markets[marketId];
        Bet    storage b = bets[marketId][msg.sender];
        require(!b.claimed, "Already claimed");
        b.claimed = true;
        uint256 reward;
        if (m.cancelled) {
            reward = b.yesAmount + b.noAmount;
            require(reward > 0, "Nothing to refund");
        } else {
            require(m.resolved, "Not resolved");
            uint256 totalPool = m.yesPool + m.noPool;
            uint256 fee       = (totalPool * platformFeeBps) / FEE_DENOM;
            uint256 payout    = totalPool - fee;
            accumulatedFees  += fee;
            if (m.outcome) { require(b.yesAmount > 0, "No YES bet"); reward = (b.yesAmount * payout) / m.yesPool; }
            else            { require(b.noAmount  > 0, "No NO bet");  reward = (b.noAmount  * payout) / m.noPool;  }
        }
        require(reward > 0, "Zero reward");
        payable(msg.sender).transfer(reward);
        emit RewardClaimed(marketId, msg.sender, reward);
    }

    function addResolver(address resolver) external onlyOwner { resolvers[resolver] = true;  emit ResolverUpdated(resolver, true);  }
    function removeResolver(address resolver) external onlyOwner { resolvers[resolver] = false; emit ResolverUpdated(resolver, false); }
    function setPlatformFee(uint256 bps) external onlyOwner { require(bps <= 1000, "Max 10 %"); platformFeeBps = bps; }
    function withdrawFees(address payable to) external onlyOwner { uint256 amount = accumulatedFees; accumulatedFees = 0; to.transfer(amount); emit FeeWithdrawn(to, amount); }
    function transferOwnership(address newOwner) external onlyOwner { require(newOwner != address(0), "Zero address"); owner = newOwner; }
    function getMarket(uint256 id) external view returns (Market memory) { return markets[id]; }
    function getUserBet(uint256 id, address user) external view returns (Bet memory) { return bets[id][user]; }
    function getOdds(uint256 id) external view returns (uint256 yesOdds, uint256 noOdds) {
        Market memory m = markets[id]; uint256 total = m.yesPool + m.noPool;
        if (total == 0) return (5000, 5000);
        yesOdds = (m.yesPool * 10_000) / total; noOdds = 10_000 - yesOdds;
    }
    function getPotentialPayout(uint256 id, bool side, uint256 amount) external view returns (uint256) {
        Market memory m = markets[id]; uint256 totalPool = m.yesPool + m.noPool + amount;
        uint256 fee =
