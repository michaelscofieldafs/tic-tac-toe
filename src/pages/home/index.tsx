/* eslint-disable jsx-a11y/anchor-is-valid */
import { useEffect, useMemo, useRef, useState } from "react";
import {
    useAccount,
    useReadContract
} from "wagmi";

import { parseUnits } from "viem/utils";

import { useAppKitNetwork } from "@reown/appkit/react";
import { readContract, waitForTransactionReceipt, watchBlocks, writeContract } from '@wagmi/core';
import { motion } from 'framer-motion';
import { useSearchParams } from "react-router-dom";
import useSound from "use-sound";
import { Address } from "viem";
import DotGrid from "../../components/DotGrid";
import ElectricBorder from "../../components/ElectricBorder";
import Modal, { ModalProps } from "../../components/Modal";
import WalletButton from "../../components/WalletButton";
import { wagmiAdapter } from "../../components/Web3Provider";
import savvyTicTacToeABI from "../../contracts/savvyTicTacToeABI.json";
import { GameState } from "../../enums/gameState";
import { PlayerGameStatus } from "../../enums/playerGameStatus";
import { usePlayerGameStatus } from "../../hooks/usePlayerGameStatus";
import { useTimeUntilCancel } from "../../hooks/useTimeUntilCancel";
import { Game } from "../../interfaces/game";
import { GameInfo } from "../../interfaces/gameInfo";
import { DECIMALS, ZERO_ADDRESS } from "../../utils/constants";
import { shortenAddress, showToast, weiToEth } from "../../utils/helpers";
import { getContractAddressByChainId } from "../../utils/providers/tokenAddressProvider";
import { GameTimerText } from "./components/gameTimerText";
import { LINES } from "./consts/boardLines";

const timeoutSeconds = 300;

export default function TicTacToeOnChain() {
    // STATES
    const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
    const [stakeInput, setStakeInput] = useState("");
    const [currentGame, setCurrentGame] = useState<Game | null>(null);
    const [gameIdInput, setGameIdInput] = useState('');
    const [isLoadingMove, setIsLoadingMove] = useState(false);
    const [isLoadingCancelGame, setIsLoadingCancelGame] = useState(false);
    const [fee, setFee] = useState(0);

    // HOOKS
    const { address, isConnected } = useAccount();
    const { statusText, currentGameId, refetch, statusType } = usePlayerGameStatus({ playerAddress: address ?? '' });
    const { minutes, seconds, expired } = useTimeUntilCancel({ lastMoveAt: currentGame?.lastMoveAt, timeoutSeconds: timeoutSeconds });

    const currentGameIdRef = useRef(currentGameId);
    const currentAddressRef = useRef(address);

    const [searchParams] = useSearchParams();
    const urlGameId = searchParams.get("gameId");

    const [showModal, setShowModal] = useState<ModalProps | null>(null);

    const { chainId } = useAppKitNetwork();

    const currentChainRef = useRef(chainId);

    // GAME SOUNDS
    // start sound
    const [playMove] = useSound('/assets/sounds/game-move.mp3', { volume: 0.5 });
    // Win sound
    const [playWin] = useSound('/assets/sounds/game-winner.mp3', { volume: 0.5 });
    // Loss sound
    const [playLoss] = useSound('/assets/sounds/game-over.mp3', { volume: 0.5 });

    /* ----------------------------------------
     * READ CONTRACTS
     ---------------------------------------- */

    const {
        data: games,
        refetch: refetchGames,
    } = useReadContract({
        address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
        chainId: Number(currentChainRef.current),
        abi: savvyTicTacToeABI,
        functionName: "listAvailableGames",
        args: [currentAddressRef.current!, 10],
    }) as any;

    const {
        data: boardRaw,
        refetch: refetchBoard,
    } = useReadContract({
        address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
        chainId: Number(currentChainRef.current),
        abi: savvyTicTacToeABI,
        functionName: "getBoard",
        args: currentGameId !== null ? [currentGameId] : undefined,
        query: {
            enabled: currentGameId !== null,
            refetchInterval: 2000,
        },
    }) as any;

    /* ----------------------------------------
     * WINNER DETECTION (local)
     ---------------------------------------- */
    const winnerInfo = useMemo(() => {
        for (const line of LINES) {
            const [a, b, c] = line;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { winner: board[a], line };
            }
        }
        if (board.every((c) => c !== null)) return { winner: "draw", line: [] };
        return null;
    }, [board]);

    /* ----------------------------------------
     * WRITE CONTRACTS
     ---------------------------------------- */

    /** CREATE GAME **/
    const handleCreateGame = async (stakeHuman: string): Promise<void> => {
        if (!isConnected) return showToast("Connect wallet to create new game", "warning");
        if (!stakeHuman) return showToast("Enter a stake", "warning");

        const stake = parseUnits(stakeHuman, DECIMALS);

        const showModalInfo: ModalProps = {
            title: 'Create new game',
            description: `Do you want to create a new game with a stake of ${stakeHuman} Sonic`,
            handleOpen: () => {
                setShowModal(null);
            },
            open: true,
            callback: async () => {
                try {
                    let txHash = await writeContract(wagmiAdapter.wagmiConfig, {
                        abi: savvyTicTacToeABI,
                        address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                        functionName: "createGame",
                        args: [ZERO_ADDRESS, stake],
                        value: stake,
                    });

                    const receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash: txHash });
                    if (receipt.status === "success") {
                        showToast("Game created successfully!")
                        setStakeInput('');
                        refetch(address!);
                    }
                    else {
                        showToast("Error creating the game. Please try again!", "error")
                    }
                } catch (err: any) {
                    showToast("Error creating the game. Please try again!", "error")
                }
            }
        }

        setShowModal(showModalInfo);
    };

    const fetchGameById = async (gameId: number): Promise<bigint | undefined> => {
        try {
            const result: any = await readContract(wagmiAdapter.wagmiConfig, {
                abi: savvyTicTacToeABI,
                address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                functionName: "getGame",
                args: [gameId],
            });

            const mappedGame: Game = {
                host: result[0],
                challenger: result[1],
                token: result[2],
                stake: BigInt(result[3]),
                turn: Number(result[4]),
                state: Number(result[5]),
                winner: result[6],
                createdAt: BigInt(result[7]),
                lastMoveAt: BigInt(result[8]),
            };


            if (mappedGame.winner !== ZERO_ADDRESS) {
                var textShow = '';

                if (mappedGame.winner === currentAddressRef.current!) {
                    textShow = `You win!!! You receive ${weiToEth(mappedGame.stake * BigInt(2), "Sonic")} in your wallet!`
                    playWin();
                }
                else {
                    textShow = 'You loss!!!';
                    playLoss();
                }

                setCurrentGame(null);

                const showModalInfo: ModalProps = {
                    title: 'Game result',
                    description: textShow,
                    handleOpen: () => {
                        setShowModal(null);
                    },
                    open: true,
                };

                setShowModal(showModalInfo);
            }
            else if (mappedGame.state === 2) {
                playLoss();
                setCurrentGame(null);

                const showModalInfo: ModalProps = {
                    title: 'Game result',
                    description: 'Draw game!!!',
                    handleOpen: () => {
                        setShowModal(null);
                    },
                    open: true,
                };

                setShowModal(showModalInfo);
            }
            else {
                setCurrentGame(mappedGame);
            }

            return mappedGame?.stake;
        } catch (err: any) {
            console.error(err);
            setCurrentGame(null);
        } finally {
        }
    };

    const fetchStatusGameById = async (gameId: number): Promise<GameInfo | undefined> => {
        try {
            const result: any = await readContract(wagmiAdapter.wagmiConfig, {
                abi: savvyTicTacToeABI,
                address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                functionName: "getGame",
                args: [gameId],
            });

            const gameInfo: GameInfo = {
                id: gameId,
                host: result[0],
                challenger: result[1],
                token: result[2],
                stake: BigInt(result[3]),
                state: Number(result[5]),
            };


            if (gameInfo.state === GameState.WaitingForPlayer) {
                return gameInfo;
            }
        } catch (err: any) {
            console.error(err);
        } finally {
        }
    };

    /** ===============================================
 * Claim cancel pending game
 ================================================ */
    const forfeitGame = async (gameId: number): Promise<void> => {
        const showModalInfo: ModalProps = {
            title: 'Forfeit game',
            description: `Would you like to forfeit the match?`,
            handleOpen: () => {
                setShowModal(null);
            },
            open: true,
            callback: async () => {
                try {
                    setIsLoadingCancelGame(true);

                    const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                        abi: savvyTicTacToeABI,
                        address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                        functionName: "forfeitGame",
                        args: [gameId],
                    });

                    const receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
                    if (receipt.status === "success") {
                        showToast("Game canceled successfully!")
                        refetch(address!);
                    } else {
                        showToast("Error cancelling the game!", "error");
                    }
                } catch (err: any) {
                    showToast("Error cancelling the game!", "error");
                }
                finally {
                    setIsLoadingCancelGame(false);
                }
            }
        };

        setShowModal(showModalInfo);
    };


    /** ===============================================
     * Claim cancel pending game
     ================================================ */
    const cancelPendingGame = async (gameId: number): Promise<void> => {
        const showModalInfo: ModalProps = {
            title: 'Cancel pending game',
            description: `Do you want to cancel pendind game?`,
            handleOpen: () => {
                setShowModal(null);
            },
            open: true,
            callback: async () => {
                try {
                    setIsLoadingCancelGame(true);

                    const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                        abi: savvyTicTacToeABI,
                        address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                        functionName: "cancelGame",
                        args: [gameId],
                    });

                    const receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
                    if (receipt.status === "success") {
                        showToast("Game canceled successfully!")
                        refetch(address!);
                    } else {
                        showToast("Error cancelling the game!", "error");
                    }
                } catch (err: any) {
                    showToast("Error cancelling the game!", "error");
                }
                finally {
                    setIsLoadingCancelGame(false);
                }
            }
        };

        setShowModal(showModalInfo);
    };

    /** ===============================================
     * Claim timeout
     ================================================ */
    const claimTimeoutGame = async (gameId: number): Promise<void> => {
        const showModalInfo: ModalProps = {
            title: 'Cancel game by timeout',
            description: `Do you want cancel game by timeout?`,
            handleOpen: () => {
                setShowModal(null);
            },
            open: true,
            callback: async () => {
                try {
                    setIsLoadingCancelGame(true);

                    const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                        abi: savvyTicTacToeABI,
                        address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                        functionName: "claimTimeout",
                        args: [gameId],
                    });

                    const receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
                    if (receipt.status === "success") {
                        showToast("Game canceled successfully!")
                        refetch(address!);
                    } else {
                        showToast("Error cancelling the game!", "error");
                    }
                } catch (err: any) {
                    showToast("Error cancelling the game!", "error");
                }
                finally {
                    setIsLoadingCancelGame(false);
                }
            }
        };

        setShowModal(showModalInfo);
    };

    /** JOIN GAME BY ID UR **/
    const handleJoinGameUrlById = async (gameId: number): Promise<void> => {
        const gameInfo = await fetchStatusGameById(gameId);

        if (gameInfo) {
            if (gameInfo?.host === currentAddressRef.current) {
                showToast("You are the host of this game!", "warning");
                return;
            }

            const showModalInfo: ModalProps = {
                title: 'Join game',
                description: `Would you like to join the selected match with the stake of ${weiToEth(gameInfo.stake!.toString?.(), "Sonic")}?`,
                handleOpen: () => {
                    setShowModal(null);
                },
                open: true,
                callback: async () => {
                    const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                        abi: savvyTicTacToeABI,
                        address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                        functionName: 'joinGame',
                        args: [gameId],
                        value: gameInfo.stake,
                    });


                    const receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash })

                    if (receipt.status === 'success') {
                        setGameIdInput('');
                        refetchGames();
                        refetch(address!);
                        refetchBoard();
                    }
                    else {
                        showToast("Error joining the game", "error");
                    }
                }
            }

            setShowModal(showModalInfo);
        }
        else {
            showToast("Game not found", "error");
        }
    };

    /** JOIN GAME BY ID **/
    const handleJoinGameById = async (): Promise<void> => {
        if (!gameIdInput) {
            showToast("Enter the game ID to join the match", "warning");
            return;
        }

        const gameInfo = await fetchStatusGameById(Number(gameIdInput));

        if (gameInfo?.host === currentAddressRef.current) {
            showToast("You are the host of this game!", "warning");
            return;
        }

        if (gameInfo) {
            const showModalInfo: ModalProps = {
                title: 'Join game',
                description: `Would you like to join the selected match with the stake of ${weiToEth(gameInfo.stake!.toString?.(), "Sonic")}?`,
                handleOpen: () => {
                    setShowModal(null);
                },
                open: true,
                callback: async () => {
                    const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                        abi: savvyTicTacToeABI,
                        address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                        functionName: 'joinGame',
                        args: [gameIdInput],
                        value: gameInfo.stake,
                    });


                    const receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash })

                    if (receipt.status === 'success') {
                        setGameIdInput('');
                        refetchGames();
                        refetch(address!);
                        refetchBoard();
                    }
                    else {
                        showToast("Error joining the game", "error");
                    }
                }
            }

            setShowModal(showModalInfo);
        }
        else {
            showToast("Game not found", "error");
        }
    };

    /** JOIN GAME **/
    const handleJoinGame = async (gameId: number, stake: any): Promise<void> => {
        const showModalInfo: ModalProps = {
            title: 'Join game',
            description: `Would you like to join the selected match with the stake of ${weiToEth(stake.toString?.(), "Sonic")}?`,
            handleOpen: () => {
                setShowModal(null);
            },
            open: true,
            callback: async () => {
                const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                    abi: savvyTicTacToeABI,
                    address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                    functionName: 'joinGame',
                    args: [gameId],
                    value: stake.toString(),
                });


                const receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash })

                if (receipt.status === 'success') {
                    refetchGames();
                    refetch(address!);
                    refetchBoard();
                }
                else {
                    showToast("Error joining the game", "error");
                }
            }
        }

        setShowModal(showModalInfo);
    };

    /** MAKE MOVE **/
    const handleMakeMove = async (gameId: number, idx: number): Promise<void> => {
        if (winnerInfo?.winner) return;

        try {
            setIsLoadingMove(true);

            const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                abi: savvyTicTacToeABI,
                address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                functionName: 'makeMove',
                args: [gameId, idx],
            })

            const receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash })

            if (receipt.status === 'success') {
                playMove();
                refetchBoard();
                refetch(address!);
                fetchGameById(gameId);
            }
            else {
                showToast("Error making the move, please try again!", "error");
            }
        }
        catch (err) {
            showToast("Error making the move, please try again!", "error");
        }
        finally {
            setIsLoadingMove(false);
        }
    };

    const fetchFeeInfo = async (): Promise<{
        feeBP: number;
        feeReceiver: string;
    } | undefined> => {
        try {
            const result: any = await readContract(wagmiAdapter.wagmiConfig, {
                abi: savvyTicTacToeABI,
                address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                functionName: "feeBP",
                args: [],
            });

            const feeBP = Number(result);

            setFee(feeBP / 100)
        } catch (err: any) {
            console.error("Error fetching fee info:", err);
            return undefined;
        }
    };

    const handleContractLink = () => {
        const url = chainId === 57_054 ? `https://blaze.soniclabs.com/address/${getContractAddressByChainId(Number(currentChainRef.current))}` : `https://testnet.sonicscan.org/address/${getContractAddressByChainId(Number(currentChainRef.current))}`;

        window.open(url, '_blank');
    }

    const handleLink = () => {
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/?gameId=${currentGameId}`;

        navigator.clipboard.writeText(url);
        showToast('Copied game link');
    }

    const getMyPiece = (): string => {
        if (!currentGame) return "";


        if (currentGame.turn === 1) return "X";
        if (currentGame.turn === 2) return "O";

        return "";
    };


    const isMyTurn = (): boolean => {
        if (!currentGame) return false;

        const me = currentAddressRef.current!?.toLowerCase();
        const host = currentGame.host.toLowerCase();
        const challenger = currentGame.challenger?.toLowerCase();

        if (currentGame.turn === 1 && me === host) return true;
        if (currentGame.turn === 2 && me === challenger) return true;

        return false;
    };

    useEffect(() => {
        currentChainRef.current = chainId;
    }, [chainId])

    useEffect(() => {
        currentAddressRef.current = address;
    }, [address]);

    /* ----------------------------------------
     * WATCH BLOCKS → auto refresh
     ---------------------------------------- */
    useEffect(() => {
        refetchGames();
        refetch(currentAddressRef.current!);
        fetchFeeInfo();
        const unwatch = watchBlocks(wagmiAdapter.wagmiConfig, {
            blockTag: 'latest',
            chainId: Number(currentChainRef.current),
            pollingInterval: 2000,
            onBlock({ number }: any) {
                // Refresh available games list, the player's current status (host/challenger),
                // the active game if there's one running, and the game board state.
                refetchGames();
                refetch(currentAddressRef.current!);
                const id = currentGameIdRef.current;
                if (id !== null) fetchGameById(id);
            },
        });
        return () => unwatch();
    }, []);

    /* ----------------------------------------
     * PROCESS BOARD INTO UI FORMAT
     ---------------------------------------- */
    useEffect(() => {
        if (!boardRaw) {
            setBoard(Array(9).fill(null));

            return;
        }

        const parsed = boardRaw.map((v: any) =>
            Number(v) === 1 ? "X" : Number(v) === 2 ? "O" : null
        );

        setBoard(parsed);
    }, [boardRaw]);

    useEffect(() => {
        if (!urlGameId) return;

        const idNum = Number(urlGameId);
        if (!isNaN(idNum)) {
            handleJoinGameUrlById(idNum);
        }
    }, [urlGameId]);

    useEffect(() => {
        currentGameIdRef.current = currentGameId;
    }, [currentGameId]);

    /* ----------------------------------------
     * UI
     ---------------------------------------- */
    return (
        <div className="relative w-full min-h-screen">
            <DotGrid
                dotSize={10}
                gap={24}
                baseColor="#032324"
                activeColor="#032324"
                proximity={240}
                shockRadius={250}
                shockStrength={5}
                resistance={750}
                returnDuration={1.5}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 0,
                }}
            />
            {showModal && <Modal callback={showModal.callback} description={showModal.description} handleOpen={showModal.handleOpen} open={showModal.open}
                title={showModal.title} />}
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 via-[#041726] to-[#052b2b] p-6">
                <ElectricBorder speed={0.3} className={undefined} style={undefined}>
                    <div className="w-full max-w-4xl bg-[rgba(255,255,255,0.03)] border border-slate-700 rounded-3xl shadow-xl p-6 backdrop-blur-md">
                        <header className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <img
                                    src="/assets/images/logo-2.png"
                                    alt="Logo"
                                    className="w-24 object-contain"
                                />
                                <div>
                                    <h1 className="text-white text-xl font-semibold">SavvyGirl Tic‑Tac‑Toe</h1>
                                    <p className="text-slate-300 text-sm">Play and relax wity SavvyGirl ✨</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <WalletButton />
                            </div>
                        </header>

                        <main className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                            {/* Board */}
                            <section className="col-span-1 md:col-span-2">
                                <div className="mx-auto w-[min(420px,90vw)]">
                                    <div className="flex justify-center items-center h-full">
                                        <div className="mb-2 text-sm text-slate-300 font-semibold text-center">
                                            {statusType === PlayerGameStatus.WaitingForOpponent ? (
                                                <a
                                                    href="#"
                                                    className="underline text-blue-400 hover:text-blue-300 transition"
                                                    onClick={() => {
                                                        handleLink();
                                                    }}
                                                >
                                                    {statusText}
                                                </a>
                                            ) : (
                                                statusText
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 p-6 bg-gradient-to-b from-[rgba(255,255,255,0.02)] to-[rgba(255,255,255,0.01)] rounded-2xl border border-slate-700">
                                        {board.map((cell, i) => {
                                            const isWinning = winnerInfo && winnerInfo.line.includes(i);
                                            return (
                                                <motion.button
                                                    key={i}
                                                    onClick={() => handleMakeMove(currentGameId!, i)}
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    whileTap={{ scale: 0.96 }}
                                                    disabled={!isMyTurn() || isLoadingMove || currentGame?.state !== GameState.InProgress}
                                                    className={`
    aspect-square rounded-lg flex items-center justify-center text-4xl font-extrabold select-none transition-shadow
    ${isWinning
                                                            ? 'bg-gradient-to-br from-yellow-400 to-orange-400 text-slate-900 shadow-[0_10px_30px_rgba(255,165,0,0.12)]'
                                                            : `${!isMyTurn() || isLoadingMove || currentGame?.state !== GameState.InProgress
                                                                ? 'cursor-not-allowed hover:bg-red-500/10 hover:shadow-[0_0_15px_rgba(255,0,0,0.25)]'
                                                                : 'cursor-pointer hover:bg-white/5'
                                                            } bg-[rgba(255,255,255,0.01)] text-white`
                                                        }
`}
                                                >
                                                    <span className="pointer-events-none">
                                                        {cell === 'X' ? (
                                                            <svg viewBox="0 0 48 48" width="56" height="56" className="block">
                                                                <path d="M8 8L40 40M40 8L8 40" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        ) : cell === 'O' ? (
                                                            <svg viewBox="0 0 48 48" width="56" height="56" className="block">
                                                                <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="3.5" fill="none" />
                                                            </svg>
                                                        ) : (
                                                            <div className="text-slate-500 text-sm">&nbsp;</div>
                                                        )}
                                                    </span>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                    {currentGame?.state === GameState.InProgress &&
                                        <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
                                            <div>Turn: <span className="font-semibold text-white">
                                                {!isMyTurn()
                                                    ? `Opponent's turn - ${getMyPiece()}`
                                                    : `Your turn - ${getMyPiece()} `}
                                            </span></div>
                                            <div className="text-right">
                                                {winnerInfo ? (
                                                    winnerInfo.winner === 'draw' ? (
                                                        <span className="font-semibold">It's a draw</span>
                                                    ) : (
                                                        <span className="font-semibold">Winner: {winnerInfo.winner}</span>
                                                    )
                                                ) : (
                                                    <span>In play</span>
                                                )}
                                            </div>
                                        </div>
                                    }
                                    {/**
                                    <div className="mt-4 text-sm text-slate-300 font-semibold">
                                        Actions
                                    </div>
                                     */}
                                    {/* Create Game */}
                                    {statusType === PlayerGameStatus.None &&
                                        <div className="mt-2 p-4 rounded-2xl border border-slate-700 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
                                            <h3 className="text-white font-semibold mb-2">Create New Game</h3>
                                            <div className="flex flex-wrap gap-2">
                                                <input
                                                    className="text-black p-2 rounded flex-1 min-w-[80px]"
                                                    placeholder="Stake"
                                                    value={stakeInput}
                                                    onChange={(e) => setStakeInput(e.target.value)}
                                                />
                                                <button
                                                    className="px-4 py-2 bg-green-600 rounded text-white font-semibold"
                                                    onClick={() => handleCreateGame(stakeInput)}
                                                >
                                                    Create Now
                                                </button>
                                            </div>
                                        </div>
                                    }
                                    {statusType === PlayerGameStatus.WaitingForOpponent && (currentGame?.state === GameState.InProgress || currentGame?.state === GameState.WaitingForPlayer) &&
                                        <div className="mt-2 p-4 rounded-2xl border border-slate-700 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
                                            <div className="flex justify-center">
                                                <button
                                                    disabled={isLoadingCancelGame}
                                                    className={`px-4 py-2 rounded font-semibold transition-colors ${!isLoadingCancelGame
                                                        ? 'bg-yellow-600 text-white hover:bg-yellow-500 cursor-pointer'
                                                        : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                                        }`}
                                                    onClick={() => cancelPendingGame(currentGameId!)}
                                                >
                                                    CANCEL GAME
                                                </button>
                                            </div>
                                        </div>
                                    }

                                    {statusType === PlayerGameStatus.InProgress && (currentGame?.state === GameState.InProgress || currentGame?.state === GameState.WaitingForPlayer) &&
                                        <div className="mt-6 p-4 rounded-2xl border border-slate-700 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
                                            <GameTimerText expired={expired} minutes={minutes} seconds={seconds} />
                                            <div className="flex">
                                                <button
                                                    disabled={isLoadingCancelGame}
                                                    className={`px-4 py-2 mr-4 rounded font-semibold transition-colors ${!isLoadingCancelGame
                                                        ? 'bg-yellow-600 text-white hover:bg-yellow-500 cursor-pointer'
                                                        : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                                        }`}
                                                    onClick={() => forfeitGame(currentGameId!)}
                                                >
                                                    FORFEIT GAME
                                                </button>
                                                <div className="flex justify-center">
                                                    <button
                                                        className={`px-4 py-2 rounded font-semibold transition-colors ${expired
                                                            ? 'bg-yellow-600 text-white hover:bg-yellow-500 cursor-pointer'
                                                            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                                            }`}
                                                        onClick={() => expired && claimTimeoutGame(currentGameId!)}
                                                        disabled={!expired || isLoadingCancelGame}
                                                    >
                                                        CANCEL GAME BY TIMEOUT
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    }
                                </div>
                            </section>
                            {/* Right column: games list + tips */}
                            <aside className="space-y-4 w-full">
                                {statusType === PlayerGameStatus.None && <>
                                    <div className="p-4 rounded-2xl border border-slate-700 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
                                        <h3 className="text-sm text-slate-300">Games Available</h3>

                                        {games?.length ? (
                                            <div className="mt-3 max-h-[300px] overflow-y-auto pr-2">
                                                <ul className="text-sm text-white/90 leading-6 space-y-4">
                                                    {games.map((g: any, idx: number) => (
                                                        <li
                                                            key={idx}
                                                            className="border border-slate-300 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition cursor-pointer"
                                                        >
                                                            <div>
                                                                <p>Host: {shortenAddress(g.host)}</p>
                                                                <p>
                                                                    <span className="font-medium">Stake:</span>{" "}
                                                                    {weiToEth(g.stake?.toString?.(), "Sonic")}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleJoinGame(g.id, g.stake)}
                                                                className="w-full bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 transition mt-2"
                                                            >
                                                                Join
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <p className="text-slate-400 italic mt-3">No games available yet</p>
                                        )}
                                    </div>

                                    <div className="p-4 rounded-2xl border border-slate-700 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] flex flex-col">
                                        <h3 className="text-sm text-slate-300">Join Game</h3>

                                        <input
                                            type="number"
                                            placeholder="Enter Game ID"
                                            value={gameIdInput}
                                            onChange={(e) => setGameIdInput(e.target.value)}
                                            className="px-3 py-2 mt-4 rounded-md border border-slate-600 bg-slate-900 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                                        />

                                        <button
                                            disabled={!gameIdInput}
                                            onClick={handleJoinGameById}
                                            className="w-full bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 transition mt-4 disabled:opacity-50"
                                        >
                                            {isConnected ? 'Join' : 'Connect wallet to join'}
                                        </button>
                                    </div>
                                </>}
                                {fee > 0 &&
                                    <div className="p-4 rounded-2xl border border-slate-700 bg-gradient-to-br from-[#021e1f] to-[#062f30] shadow-inner">
                                        <h4 className="text-white font-semibold">Platform Fee</h4>
                                        <p className="mt-2 text-slate-300 text-sm">{`A fee of ${fee}% is applied only when a match concludes with a winner, and is then allocated to the platform.`}</p>
                                    </div>
                                }
                            </aside>
                        </main>

                        <footer className="mt-6 text-center text-xs text-slate-400">Developed with 💜 by SavvyGirl <br /> Tic-Tac-Toe is part of SavvyGirl products.</footer>
                    </div>
                </ElectricBorder>

                <p className="mt-7 text-slate-300 text-center bg-[rgba(255,255,255,0.03)] border border-slate-700 rounded-3xl shadow-xl p-6 backdrop-blur-md text-sm">Every action — creating a game, joining one, and making moves — is on-chain and requires <br /> a wallet-approved transaction. Play safely and transparently! <br />The contract is verified and you can access it at the address below: <br />
                    <a
                        href="#"
                        className="underline text-blue-400 hover:text-blue-300 transition"
                        onClick={() => {
                            handleContractLink();
                        }}
                    >
                        {getContractAddressByChainId(Number(currentChainRef.current))}
                    </a></p>
            </div>
        </div>
    );
}
