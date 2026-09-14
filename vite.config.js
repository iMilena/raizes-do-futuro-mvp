import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/* Três entradas, três públicos:
     index.html   painel da operação e site institucional (o que já existia)
     campo.html   PWA do catador, do módulo de Validação de Coleta
     revisao.html painel de revisão da coordenação

   São apps separados de propósito. O catador instala só "Coleta" na tela
   inicial, e o bundle que ele baixa em 3G de ilha não carrega o painel, os
   gráficos, o cofre multisig e a tela de revisão junto. */
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        painel: resolve(process.cwd(), 'index.html'),
        campo: resolve(process.cwd(), 'campo.html'),
        revisao: resolve(process.cwd(), 'revisao.html'),
      },
    },
  },
  optimizeDeps: {
    // onnxruntime-web traz .wasm e usa Worker: deixar o Vite pré-empacotar a
    // biblioteca inteira quebra o carregamento dos artefatos em desenvolvimento.
    exclude: ['onnxruntime-web'],
  },
});
