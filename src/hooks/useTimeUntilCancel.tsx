import { useEffect, useState } from "react";

export interface TimeUntilCancelProps {
    lastMoveAt?: bigint;
    timeoutSeconds: number;
}

export const useTimeUntilCancel = ({ lastMoveAt, timeoutSeconds = 3600 }: TimeUntilCancelProps) => {
    const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0, expired: false });

    useEffect(() => {
        if (!lastMoveAt) {
            setTimeLeft({ minutes: 0, seconds: 0, expired: false });
            return;
        }

        const interval = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const elapsed = now - Number(lastMoveAt);
            const remaining = timeoutSeconds - elapsed;

            if (remaining <= 0) {
                setTimeLeft({ minutes: 0, seconds: 0, expired: true });
            } else {
                setTimeLeft({ minutes: Math.floor(remaining / 60), seconds: remaining % 60, expired: false });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [lastMoveAt, timeoutSeconds]);

    return timeLeft;
}