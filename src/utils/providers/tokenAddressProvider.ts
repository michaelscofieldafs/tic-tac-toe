import {
    sonic,
    sonicBlazeTestnet
} from '@reown/appkit/networks';
import { SAVVY_TICTACTOE_BLAZE_ADDRESS, SAVVY_TICTACTOE_TESTNET_ADDRESS } from '../../contracts/savvyticTacToeAddress';

export const getContractAddressByChainId = (chainId?: number | string): string => {
    console.log(chainId);
    switch (chainId) {
        case sonic.id:
            return SAVVY_TICTACTOE_BLAZE_ADDRESS ?? '';
        case sonicBlazeTestnet.id:
            return SAVVY_TICTACTOE_BLAZE_ADDRESS ?? '';
        case 14601:
            return SAVVY_TICTACTOE_TESTNET_ADDRESS ?? '';
        default:
            // fallback: Sonic mainnet
            return SAVVY_TICTACTOE_TESTNET_ADDRESS;
    }
};