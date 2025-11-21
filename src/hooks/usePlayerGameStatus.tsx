import { useEffect, useState } from "react";
import { readContract } from '@wagmi/core';
import { PlayerGameStatus } from "../enums/playerGameStatus";
import { wagmiAdapter } from "../components/Web3Provider";
import savvyTicTacToeABI from "../contracts/savvyTicTacToeABI.json";
import { SAVVY_TICTACTOE_ADDRESS } from "../contracts/savvyticTacToeAddress";

export interface PlayerGameStatusProps {
    playerAddress: string;
}

export const usePlayerGameStatus = ({ playerAddress }: PlayerGameStatusProps) => {
    const [statusText, setStatusText] = useState<string>('Create or join a match');
    const [statusType, setStatusType] = useState<PlayerGameStatus>(PlayerGameStatus.None);
    const [currentGameId, setCurrentGameId] = useState<number | null>(null);

    const fetchStatus = async () => {
        try {
            const pendingGame: any = await readContract(wagmiAdapter.wagmiConfig, {
                abi: savvyTicTacToeABI,
                address: SAVVY_TICTACTOE_ADDRESS,
                functionName: 'getPendingGameByHost',
                args: [playerAddress],
            });


            if (pendingGame && pendingGame.id !== undefined) {
                setStatusText(`Game #${pendingGame.id} is waiting for an opponent… Share this ID with a friend to join!`);
                setStatusType(PlayerGameStatus.WaitingForOpponent);
                setCurrentGameId(Number(pendingGame.id));
                return;
            }
        } catch (err) {
        }

        try {
            const activeGame: any = await readContract(wagmiAdapter.wagmiConfig, {
                abi: savvyTicTacToeABI,
                address: SAVVY_TICTACTOE_ADDRESS,
                functionName: 'getActiveGameInfo',
                args: [playerAddress],
            });

            if (activeGame && activeGame.id !== undefined) {
                setStatusText('Match started!');
                setStatusType(PlayerGameStatus.InProgress);
                setCurrentGameId(Number(activeGame.id));
                return;
            }
        } catch (err) {
        }

        setStatusText('Create or join a match…');
        setStatusType(PlayerGameStatus.None);
        setCurrentGameId(null);
    };

    useEffect(() => {
        if (!playerAddress) return;

        fetchStatus();
    }, [playerAddress]);

    return { statusText, currentGameId, refetch: fetchStatus, statusType };
};
