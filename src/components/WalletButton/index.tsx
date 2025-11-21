import React, { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';

interface WalletButtonProps { }

const WalletButton: React.FC<WalletButtonProps> = () => {
    const { isConnected } = useAccount();
    const [isShowButton, setIsShowButton] = useState<boolean>(false);
    const wasConnected = useRef(isConnected);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsShowButton(true)
        }, 1000)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        if (wasConnected.current && !isConnected) {
            setTimeout(async () => {
                try {
                    localStorage.clear();
                    sessionStorage.clear();

                    if (window.indexedDB && window.indexedDB.databases) {
                        const databases = await window.indexedDB.databases();
                        for (const db of databases) {
                            if (db.name) {
                                const request = window.indexedDB.deleteDatabase(db.name);
                                request.onerror = () => console.log(`Failed to delete DB ${db.name}`);
                                request.onsuccess = () => console.log(`Deleted DB ${db.name}`);
                            }
                        }
                    }

                    if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        for (const name of cacheNames) {
                            await caches.delete(name);
                        }
                    }
                    localStorage.removeItem('WEB3_CONNECT_CACHED_PROVIDER');
                    window.location.reload();
                } catch (err) {
                    console.error('Error clearing cache', err);
                }
            }, 500);
        }

        wasConnected.current = isConnected;
    }, [isConnected]);

    return (
        <div
            key={isConnected ? 'connected' : 'disconnected'}
            className="flex flex-col items-center justify-center gap-3"
        >
            <div
                className={`transition-all duration-500 ease-out transform ${isShowButton ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
                    }`}
            >
                <appkit-button size="sm" label='' loadingLabel='' balance='hide'></appkit-button>
            </div>
        </div>
    );
};

export default WalletButton;
