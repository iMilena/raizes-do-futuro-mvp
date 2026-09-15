import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y';
import ts from 'typescript-eslint';

/* ---------------------------------------------------------------------------
   Regras de lint do projeto.

   O acervo aqui tem duas idades: o MVP, escrito antes de qualquer linter, e o
   material novo. Ligar tudo de uma vez encheria o terminal de avisos em código
   que ninguém vai tocar agora, e um relatório que ninguém lê não protege nada.
   Então o rigor é por camada: erro no que está sendo desenhado agora, aviso no
   resto.

   A parte de acessibilidade não é enfeite de configuração: ela é quem cobra, a
   cada `npm run lint`, o que o design system exige à mão — botão só de ícone
   com `aria-label`, ícone decorativo fora da árvore, rótulo amarrado ao campo.
--------------------------------------------------------------------------- */

const reacomoda = {
  settings: { react: { version: '18.3' } },
  languageOptions: {
    globals: { ...globals.browser, ...globals.es2023 },
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { react, 'react-hooks': hooks, 'jsx-a11y': a11y },
};

/** O que vale para todo JSX, novo ou antigo. */
const regrasReact = {
  ...react.configs.flat.recommended.rules,
  ...react.configs.flat['jsx-runtime'].rules,
  ...hooks.configs['recommended-latest'].rules,
  // O projeto não usa PropTypes, e exigi-los agora seria ruído em 6 mil linhas.
  'react/prop-types': 'off',
  /* A geração nova de regras de hooks (pureza, refs, componente estático,
     set-state em efeito) acusa padrões que funcionam mas poderiam ser melhores.
     Como aviso, elas guiam; como erro, travariam a entrega em código antigo que
     não está em revisão. Quem mexer no arquivo vê o aviso e decide. */
  'react-hooks/set-state-in-effect': 'warn',
  'react-hooks/purity': 'warn',
  'react-hooks/refs': 'warn',
  'react-hooks/static-components': 'warn',
  'react-hooks/immutability': 'warn',
  'react/no-unescaped-entities': 'warn',
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
};

export default [
  { ignores: ['dist/**', 'node_modules/**', 'modelo/**', 'public/**', 'coverage/**'] },

  js.configs.recommended,

  /* ---- JS e JSX ---- */
  {
    files: ['**/*.{js,jsx,mjs}'],
    ...reacomoda,
    rules: { ...regrasReact },
  },

  /* ---- TS e TSX (o módulo de Validação de Coleta) ---- */
  ...ts.configs.recommended.map(c => ({ ...c, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['**/*.{ts,tsx}'],
    ...reacomoda,
    rules: {
      ...regrasReact,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  /* ---- O painel: é o que está sendo desenhado, então aqui o a11y é erro ---- */
  {
    files: ['src/painel/**/*.{jsx,tsx}', 'src/views/**/*.jsx', 'src/validacao/**/*.tsx'],
    ...reacomoda,
    rules: {
      ...regrasReact,
      /* Acessibilidade é erro, e só aqui. São exatamente as exigências do
         design system: botão só de ícone precisa de nome, ícone decorativo sai
         da árvore, rótulo aponta para o campo. Deixar como aviso seria escrever
         a regra e não cobrá-la. */
      ...a11y.flatConfigs.recommended.rules,
      /* `depth: 3` porque o rótulo do app da família embrulha o texto em
         `<span><b>…</b><small>…</small></span>`: a frase existe, só está uma
         camada mais fundo do que o padrão da regra procura. */
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', depth: 3 }],
      /* Região que rola precisa chegar pelo teclado (WCAG 2.1.1): sem
         `tabIndex`, quem navega sem mouse não consegue rolar o termo de
         consentimento. `region` entra na lista de papéis que podem receber
         foco justamente para esse caso. */
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['region', 'tabpanel'] }],
    },
  },

  /* ---- Scripts e testes rodam em Node ---- */
  {
    files: [
      'scripts/**/*.mjs',
      'onchain/**/*.mjs',
      'testes/**/*.{mjs,js}',
      'eslint.config.js',
      'vite.config.js',
    ],
    languageOptions: { globals: { ...globals.node } },
  },

  /* ---- Service worker: escopo próprio, nem janela nem Node ---- */
  {
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
];
