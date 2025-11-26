import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        host: true,          // permite acessar pela rede local
        port: 5173,          // opcional, pra fixar a porta
    },
});