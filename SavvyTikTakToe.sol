// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SavvyGirlOnchainTicTacToe is ReentrancyGuard, Ownable {
    enum Cell {
        Empty,
        X,
        O
    }

    enum GameState {
        WaitingForPlayer,
        InProgress,
        Finished
    }

    address public feeReceiver;
    uint256 public feeBP = 300;
    uint256 public constant BP_DIVISOR = 10000;
    uint256 public maxResultsLimit = 10;

    struct Game {
        address host;
        address challenger;
        address token;
        uint256 stake;
        Cell[9] board;
        uint8 turn;
        GameState state;
        address winner;
        uint256 createdAt;
        uint256 lastMoveAt;
    }

    struct GameInfo {
        uint256 id;
        address host;
        address challenger;
        address token;
        uint256 stake;
        uint8 state;
    }

    Game[] public games;

    uint256 public constant MOVE_TIMEOUT = 5 minutes;

    mapping(address => uint256) public activeGameOfHost;

    event GameCreated(
        uint256 indexed gameId,
        address indexed host,
        address token,
        uint256 stake
    );
    event GameJoined(uint256 indexed gameId, address indexed challenger);
    event MoveMade(
        uint256 indexed gameId,
        address indexed player,
        uint8 index,
        uint8 mark
    );
    event GameEnded(
        uint256 indexed gameId,
        address indexed winner,
        string reason
    );

    constructor(address _feeReceiver) Ownable(msg.sender) {
        feeReceiver = _feeReceiver;
    }

    function setFeeReceiver(address _new) external onlyOwner {
        feeReceiver = _new;
    }

    function setFeeBP(uint256 _newBP) external onlyOwner {
        require(_newBP <= 2000, "max 20%");
        feeBP = _newBP;
    }

    function setMaxResultsLimit(uint256 newLimit) external onlyOwner {
        maxResultsLimit = newLimit;
    }

    // ==============================
    //   CREATE GAME (CORRIGIDO)
    // ==============================

    function createGame(
        address token,
        uint256 stake
    ) external payable nonReentrant returns (uint256) {
        require(stake > 0, "stake must be > 0");

        uint256 activeId = activeGameOfHost[msg.sender];

        // Se for a primeira vez, activeId será 0 → substitui pelo sentinel
        if (activeId == 0) {
            activeGameOfHost[msg.sender] = type(uint256).max;
            activeId = type(uint256).max;
        }

        // Checa se o host já tem jogo ativo (e não terminado)
        if (activeId != type(uint256).max) {
            require(
                activeId < games.length &&
                    games[activeId].state == GameState.Finished,
                "Host already has an active game"
            );
        }

        // Pagamento / depósito
        if (token == address(0)) {
            require(msg.value == stake, "Send correct native token amount");
        } else {
            IERC20(token).transferFrom(msg.sender, address(this), stake);
        }

        Game memory newGame;
        newGame.host = msg.sender;
        newGame.token = token;
        newGame.stake = stake;
        newGame.turn = _randomTurn();
        newGame.state = GameState.WaitingForPlayer;
        newGame.createdAt = block.timestamp;
        newGame.lastMoveAt = block.timestamp;

        games.push(newGame);
        uint256 newId = games.length - 1;

        activeGameOfHost[msg.sender] = newId;

        emit GameCreated(newId, msg.sender, token, stake);
        return newId;
    }

    // Join game
    function joinGame(uint256 gameId) external payable nonReentrant {
        require(gameId < games.length, "invalid gameId");
        Game storage g = games[gameId];

        require(g.state == GameState.WaitingForPlayer, "cannot join");
        require(g.host != msg.sender, "host cannot join own game");

        require(msg.value == g.stake, "incorrect stake amount");

        g.challenger = msg.sender;
        g.state = GameState.InProgress;
        g.lastMoveAt = block.timestamp;

        activeGameOfHost[g.host] = gameId;

        emit GameJoined(gameId, msg.sender);
    }

    // Make move
    function makeMove(uint256 gameId, uint8 index) external nonReentrant {
        require(gameId < games.length, "invalid gameId");
        require(index < 9, "index out of range");

        Game storage g = games[gameId];
        require(g.state == GameState.InProgress, "not in progress");

        require(
            g.host != address(0) && g.challenger != address(0),
            "players missing"
        );

        uint8 playerMark;
        if (msg.sender == g.host) playerMark = 1;
        else if (msg.sender == g.challenger) playerMark = 2;
        else revert("not a player");

        require(g.turn == playerMark, "not your turn");
        require(g.board[index] == Cell.Empty, "cell not empty");

        g.board[index] = playerMark == 1 ? Cell.X : Cell.O;
        g.lastMoveAt = block.timestamp;

        emit MoveMade(gameId, msg.sender, index, playerMark);

        uint8 winnerMark = _checkWinner(g.board);
        if (winnerMark != 0) {
            address winner = winnerMark == 1 ? g.host : g.challenger;
            g.winner = winner;
            g.state = GameState.Finished;

            uint256 total = g.stake * 2;
            uint256 fee = (total * feeBP) / 10000;
            uint256 payout = total - fee;

            if (g.token == address(0)) {
                if (fee > 0) {
                    (bool f, ) = feeReceiver.call{value: fee}("");
                    require(f, "fee payout failed");
                }
                (bool s, ) = winner.call{value: payout}("");
                require(s, "winner payout failed");
            } else {
                if (fee > 0) IERC20(g.token).transfer(feeReceiver, fee);
                IERC20(g.token).transfer(winner, payout);
            }

            activeGameOfHost[g.host] = type(uint256).max;

            emit GameEnded(gameId, winner, "win");
            return;
        }

        bool full = true;
        for (uint8 i = 0; i < 9; i++) {
            if (g.board[i] == Cell.Empty) {
                full = false;
                break;
            }
        }

        if (full) {
            g.state = GameState.Finished;

            if (g.token == address(0)) {
                (bool sh, ) = g.host.call{value: g.stake}("");
                require(sh, "refund host failed");
                (bool sc, ) = g.challenger.call{value: g.stake}("");
                require(sc, "refund challenger failed");
            } else {
                IERC20(g.token).transfer(g.host, g.stake);
                IERC20(g.token).transfer(g.challenger, g.stake);
            }

            activeGameOfHost[g.host] = type(uint256).max;

            emit GameEnded(gameId, address(0), "draw");
            return;
        }

        g.turn = g.turn == 1 ? 2 : 1;
    }

    function getBoard(
        uint256 gameId
    ) external view returns (uint8[9] memory out) {
        require(gameId < games.length, "invalid id");
        Game storage g = games[gameId];
        for (uint8 i = 0; i < 9; i++) out[i] = uint8(g.board[i]);
    }

    function getGame(
        uint256 gameId
    )
        external
        view
        returns (
            address host,
            address challenger,
            address token,
            uint256 stake,
            uint8 turn,
            uint8 state,
            address winner,
            uint256 createdAt,
            uint256 lastMoveAt
        )
    {
        require(gameId < games.length, "invalid id");
        Game storage g = games[gameId];
        host = g.host;
        challenger = g.challenger;
        token = g.token;
        stake = g.stake;
        turn = g.turn;
        state = uint8(g.state);
        winner = g.winner;
        createdAt = g.createdAt;
        lastMoveAt = g.lastMoveAt;
    }

    function listAvailableGames(
        address player,
        uint256 maxResults
    ) external view returns (GameInfo[] memory) {
        uint256 count = 0;
        uint256 totalResults = maxResults > maxResultsLimit
            ? maxResultsLimit
            : maxResults;

        for (uint256 i = games.length; i > 0 && count < totalResults; i--) {
            Game storage g = games[i - 1];
            bool isAvailable = g.challenger == address(0) &&
                g.state != GameState.Finished;
            if (player != address(0) && g.host == player) continue;
            if (isAvailable) count++;
        }

        GameInfo[] memory result = new GameInfo[](count);
        uint256 j = 0;

        for (uint256 i = games.length; i > 0 && j < count; i--) {
            Game storage g = games[i - 1];
            bool isAvailable = g.challenger == address(0) &&
                g.state != GameState.Finished;
            if (player != address(0) && g.host == player) continue;
            if (isAvailable) {
                result[j] = GameInfo(
                    i - 1,
                    g.host,
                    g.challenger,
                    g.token,
                    g.stake,
                    uint8(g.state)
                );
                j++;
            }
        }

        return result;
    }

    function totalGames() external view returns (uint256) {
        return games.length;
    }

    function getPendingGameByHost(
        address host
    ) external view returns (GameInfo memory) {
        for (uint256 i = 0; i < games.length; i++) {
            Game storage g = games[i];
            if (g.host == host && g.state == GameState.WaitingForPlayer) {
                return
                    GameInfo(
                        i,
                        g.host,
                        g.challenger,
                        g.token,
                        g.stake,
                        uint8(g.state)
                    );
            }
        }
        revert("No pending game found");
    }

    function forfeitGame(uint256 gameId) external nonReentrant {
        require(gameId < games.length, "invalid gameId");
        Game storage g = games[gameId];

        require(g.state == GameState.InProgress, "game not in progress");

        require(
            msg.sender == g.host || msg.sender == g.challenger,
            "not a player"
        );

        address winner = msg.sender == g.host ? g.challenger : g.host;

        g.winner = winner;
        g.state = GameState.Finished;

        uint256 totalPool = g.stake * 2;
        uint256 feeAmount = (totalPool * feeBP) / 10000;
        uint256 payout = totalPool - feeAmount;

        if (g.token == address(0)) {
            (bool s1, ) = feeReceiver.call{value: feeAmount}("");
            require(s1, "fee failed");
            (bool s2, ) = winner.call{value: payout}("");
            require(s2, "payout failed");
        } else {
            IERC20 token = IERC20(g.token);
            token.transfer(feeReceiver, feeAmount);
            token.transfer(winner, payout);
        }

        activeGameOfHost[g.host] = type(uint256).max;

        emit GameEnded(gameId, winner, "forfeit");
    }

    function claimTimeout(uint256 gameId) external nonReentrant {
        require(gameId < games.length, "invalid gameId");
        Game storage g = games[gameId];

        require(g.state == GameState.InProgress, "game not in progress");

        uint8 currentPlayer = g.turn;
        address activePlayer = currentPlayer == 1 ? g.challenger : g.host;

        require(msg.sender == activePlayer, "not active player");

        require(block.timestamp > g.lastMoveAt + MOVE_TIMEOUT, "not timed out");

        g.state = GameState.Finished;
        g.winner = msg.sender;

        if (g.token == address(0)) {
            (bool success, ) = msg.sender.call{value: g.stake * 2}("");
            require(success, "native payout failed");
        } else {
            IERC20(g.token).transfer(msg.sender, g.stake * 2);
        }

        activeGameOfHost[g.host] = type(uint256).max;

        emit GameEnded(gameId, msg.sender, "timeout");
    }

    function cancelGame(uint256 gameId) external nonReentrant {
        require(gameId < games.length, "invalid gameId");
        Game storage g = games[gameId];

        require(g.state == GameState.WaitingForPlayer, "cannot cancel");
        require(msg.sender == g.host, "not host");

        g.state = GameState.Finished;

        if (g.token == address(0)) {
            (bool success, ) = g.host.call{value: g.stake}("");
            require(success, "refund failed");
        } else {
            IERC20(g.token).transfer(g.host, g.stake);
        }

        activeGameOfHost[g.host] = type(uint256).max;

        emit GameEnded(gameId, g.host, "cancelled by host");
    }

    function getActiveGameInfo(
        address player
    ) external view returns (GameInfo memory) {
        for (uint256 i = 0; i < games.length; i++) {
            Game storage g = games[i];
            if (
                g.state == GameState.InProgress &&
                (g.host == player || g.challenger == player)
            ) {
                return
                    GameInfo(
                        i,
                        g.host,
                        g.challenger,
                        g.token,
                        g.stake,
                        uint8(g.state)
                    );
            }
        }
        revert("No active game found");
    }

    // RANDOM TURN
    function _randomTurn() internal view returns (uint8) {
        uint256 rand = uint256(
            keccak256(
                abi.encodePacked(block.prevrandao, block.timestamp, msg.sender)
            )
        );
        return uint8((rand % 2) + 1);
    }

    // CHECK WINNER
    function _checkWinner(Cell[9] memory b) internal pure returns (uint8) {
        uint8[3][8] memory lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];

        for (uint8 i = 0; i < 8; i++) {
            uint8 a = lines[i][0];
            uint8 b1 = lines[i][1];
            uint8 c = lines[i][2];
            if (b[a] != Cell.Empty && b[a] == b[b1] && b[b1] == b[c]) {
                return uint8(b[a]);
            }
        }

        return 0;
    }
}
