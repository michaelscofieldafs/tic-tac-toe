export interface GameTimerTextProps {
    minutes: number;
    seconds: number;
    expired: boolean;
}

export const GameTimerText = ({ minutes, seconds, expired }: GameTimerTextProps) => {
    return (
        <div className="text-sm text-white mb-4">
            {expired ? (
                <span className="text-red-400 font-semibold">
                    ⏳ The game can now be canceled! You can end the match.
                </span>
            ) : (
                <span>
                    ⏳ Time left until you can cancel: <strong>{minutes}m {seconds}s</strong>
                </span>
            )}
        </div>
    );
}