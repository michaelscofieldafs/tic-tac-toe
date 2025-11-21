import { toast, TypeOptions } from "react-toastify";
import { ZERO_ADDRESS } from "./constants";
import { ethers } from "ethers";

export const showToast = (message: string, type: TypeOptions = 'default'): void => {
    toast.dismiss();
    toast(message, {
        type: type,
        position: 'top-center',
        style: {
            fontSize: 16,
            fontFamily: 'Trebuchet MS, sans-serif',
        }
    });
}

export const shortenAddress = (address: string): string => {
    if (address === ZERO_ADDRESS) return 'Waiting player...';
    return `${address.slice(0, 15)}...`;
}

export const weiToEth = (wei: string | number | bigint, tokenName: string): string => {
    return `${ethers.utils.formatEther(wei)} ${tokenName}`;
}
