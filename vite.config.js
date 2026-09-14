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
    /* O onnxruntime-web resolve o próprio .wasm relativo ao arquivo JS dele.
       Pré-empacotado, o JS vai parar em node_modules/.vite/deps/ e o .wasm não
       vai junto: o pedido cai no fallback de SPA do servidor, chega HTML onde
       deveria chegar binário, e o console diz "expected magic word 00 61 73 6d,
       found 3c 21 64 6f" (que é "<!do", o começo do index.html).

       As duas entradas são necessárias. O app importa o subcaminho
       `onnxruntime-web/wasm` (o pacote inteiro traz o backend WebGPU e um .wasm
       de 28 MB), e o Vite trata subcaminho como entrada própria de otimização:
       excluir só o nome do pacote não pega. Isso vale para desenvolvimento; no
       build o Rollup emite o .wasm como ativo e o caminho fecha sozinho. */
    exclude: ['onnxruntime-web', 'onnxruntime-web/wasm'],
  },
});
