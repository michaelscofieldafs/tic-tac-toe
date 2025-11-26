import { useAppKitNetwork } from "@reown/appkit/react";
import { readContract } from '@wagmi/core';
import { useEffect, useRef, useState } from "react";
import { Address } from "viem";
import { wagmiAdapter } from "../components/Web3Provider";
import savvyTicTacToeABI from "../contracts/savvyTicTacToeABI.json";
import { PlayerGameStatus } from "../enums/playerGameStatus";
import { getContractAddressByChainId } from "../utils/providers/tokenAddressProvider";

export interface PlayerGameStatusProps {
    playerAddress: string;
}

export const usePlayerGameStatus = ({ playerAddress }: PlayerGameStatusProps) => {
    const [statusText, setStatusText] = useState<string>('Create or join a match');
    const [statusType, setStatusType] = useState<PlayerGameStatus>(PlayerGameStatus.None);
    const [currentGameId, setCurrentGameId] = useState<number | null>(null);

    const { chainId } = useAppKitNetwork();

    const currentChainRef = useRef(chainId);

    const fetchStatus = async (addr: string) => {
        try {
            const pendingGame: any = await readContract(wagmiAdapter.wagmiConfig, {
                abi: savvyTicTacToeABI,
                chainId: Number(currentChainRef.current),
                address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
                functionName: 'getPendingGameByHost',
                args: [addr],
            });


            if (pendingGame && pendingGame.id !== undefined) {
                setStatusText(`Game #${pendingGame.id} is waiting for an opponent. Share this link with a friend to join!`);
                setStatusType(PlayerGameStatus.WaitingForOpponent);
                setCurrentGameId(Number(pendingGame.id));
                return;
            }
        } catch (err) {
        }

        try {
            const activeGame: any = await readContract(wagmiAdapter.wagmiConfig, {
                abi: savvyTicTacToeABI,
                chainId: Number(currentChainRef.current),
                address: getContractAddressByChainId(Number(currentChainRef.current)) as Address,
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
        currentChainRef.current = chainId;
    }, [chainId])

    useEffect(() => {
        if (!playerAddress) return;

        fetchStatus(playerAddress);
    }, [playerAddress]);

    return { statusText, currentGameId, refetch: fetchStatus, statusType };
};
