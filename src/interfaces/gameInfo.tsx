export interface GameInfo {
    id: number;
    host: string;
    challenger: string;
    token: string;
    stake: bigint;
    state: number;
}
