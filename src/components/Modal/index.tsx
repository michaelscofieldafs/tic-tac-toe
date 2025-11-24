import React from "react";

export interface ModalProps {
    title: string;
    description: string;
    open: boolean;
    handleOpen: () => void;
    callback?: () => void;
}

export default function Modal({ open, handleOpen, callback, title, description }: ModalProps) {
    return open ? (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-xl text-green-600 font-semibold mb-2 text-center">{title}</h2>
                <p className="text-slate-300 text-center mb-6">
                    {description}
                </p>

                <div className="flex gap-4 mt-4">
                    {callback ? <>
                        <button
                            onClick={() => handleOpen()}
                            className="w-full bg-slate-600 hover:bg-slate-500 transition px-4 py-2 rounded-xl"
                        >
                            Cancel
                        </button>

                        <button
                            onClick={() => {
                                handleOpen();
                                callback();
                            }}
                            className="w-full bg-green-600 hover:bg-green-500 transition px-4 py-2 rounded-xl"
                        >
                            Confirm
                        </button>
                    </> :
                        <button
                            onClick={() => {
                                handleOpen();
                            }}
                            className="w-full bg-green-600 hover:bg-green-500 transition px-4 py-2 rounded-xl"
                        >
                            OK
                        </button>}
                </div>
            </div>
        </div>
    )
        : null;
}
