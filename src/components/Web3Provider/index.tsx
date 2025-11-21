'use client'

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { bsc, bscTestnet, mainnet, sepolia, sonic, sonicBlazeTestnet, plasma, plasmaTestnet, base } from '@reown/appkit/networks'
import { createAppKit } from '@reown/appkit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'

const projectId = '289396e9ac5e2ccac060651fad3b0f90'

export function Web3Provider({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient()

    createAppKit({
        adapters: [wagmiAdapter],
        allowUnsupportedChain: false,
        defaultNetwork: sonic,
        themeVariables: {
            '--w3m-font-family': 'DM Sans, sans-serif',
            '--w3m-font-size-master': '13px',
            '--w3m-accent': '#99E39E',
            '--w3m-color-mix': '#99E39E',
            '--w3m-color-mix-strength': 1,
            '--w3m-border-radius-master': '4px',
            '--w3m-z-index': 1000,
            '--w3m-qr-color': '#99E39E',
        },
        enableReconnect: true,
        networks: [mainnet, bsc, sonic, base, sonicBlazeTestnet],
        chainImages: {
            146: 'https://resources.cryptocompare.com/asset-management/17157/1727687183179.png',
            57054: 'https://resources.cryptocompare.com/asset-management/17157/1727687183179.png',
            97: 'https://cdn-icons-png.flaticon.com/128/12114/12114208.png',
            9745: 'https://cdn-icons-png.flaticon.com/128/12114/12114208.png',
        },
        projectId,
        features: {
            email: false,
            socials: [],
        },
    })

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}

export const wagmiAdapter = new WagmiAdapter({
    networks: [mainnet, sepolia, bsc, bscTestnet, sonic, sonicBlazeTestnet, plasma, plasmaTestnet, base],
    projectId,
})