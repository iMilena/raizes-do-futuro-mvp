import { defineConfig } from 'vitest/config';

/* Testes do módulo de Validação de Coleta.
   Ficam separados do runner antigo (`npm test`, que empacota JSX com esbuild à
   mão): aquele roda o app no navegador, este roda lógica pura e IndexedDB em
   Node. Misturar os dois só faria um esconder a falha do outro. */
export default defineConfig({
  test: {
    include: ['testes/validacao/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['testes/validacao/preparo.ts'],
  },
});
