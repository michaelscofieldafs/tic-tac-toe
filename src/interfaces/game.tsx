export interface Game {
    host: string;
    challenger: string;
    token: string;
    stake: bigint;
    turn: number;
    state: number;
    winner: string;
    createdAt: bigint;
    lastMoveAt: bigint;
}