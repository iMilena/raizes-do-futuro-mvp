/* ---------------------------------------------------------------------------
   Monta o .zip para a avaliação da camada de IA.

     npm run empacotar

   A lista de arquivos vem do git (versionados + novos que o .gitignore não
   barra), e não de "tudo que está na pasta". Compactar a pasta à mão levaria
   junto node_modules, dist, .git, o .env, o public/supabase.json e o
   SUBMISSAO.md, que tem dado pessoal. Por aqui, o que o .gitignore protege
   do repositório público fica de fora do .zip também.

   O .zip é gravado na pasta ACIMA do projeto: dentro dela, a segunda execução
   empacotaria o .zip da primeira.
--------------------------------------------------------------------------- */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(dirname(RAIZ), 'raizes-do-futuro-ia.zip');

/* Versionados, mas sem nada a ver com a IA. */
const DE_FORA = [
  'Raizes do Futuro - Apresentacao para a Banca (v3).pptx',
];

const OBRIGATORIOS = [
  'Readme.txt',
  'package.json',
  'package-lock.json',
  '.env.exemplo',
  'public/modelo/classificador.onnx',
  'public/modelo/classificador.json',
  'src/validacao/antifraude/deteccoes.ts',
  'exemplos/fotos/6-garrafa-pet-REPETIDA.jpg',
];

const saida = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: RAIZ });
const arquivos = saida.toString('utf8').split('\0')
  .filter(Boolean)
  .filter(f => existsSync(join(RAIZ, f)))   // apagado no disco, ainda no índice
  .filter(f => !DE_FORA.includes(f));

const faltando = OBRIGATORIOS.filter(f => !arquivos.includes(f));
if (faltando.length) {
  console.error('Faltam arquivos no pacote:\n  ' + faltando.join('\n  '));
  process.exit(1);
}

/* Rede de segurança: o .gitignore já barra isto, mas se alguém mexer nele
   o pacote não sai. */
const PROIBIDOS = [/^node_modules\//, /^dist\//, /^\.git\//, /(^|\/)\.env$/, /^\.env\.(?!exemplo$)/,
  /^public\/supabase\.json$/, /^SUBMISSAO\.md$/, /^onchain\/chaves\//];
const proibidos = arquivos.filter(f => PROIBIDOS.some(r => r.test(f)));
if (proibidos.length) {
  console.error('Arquivos que não podem ir para o pacote:\n  ' + proibidos.join('\n  '));
  process.exit(1);
}

const lista = join(tmpdir(), `empacotar-${process.pid}.txt`);
writeFileSync(lista, arquivos.join('\n') + '\n', 'utf8');
if (existsSync(DESTINO)) rmSync(DESTINO);

/* O tar do Windows (bsdtar, em System32) grava .zip com -a. O `tar` do Git
   Bash é o GNU, que não sabe fazer zip, por isso o caminho explícito. */
const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'bsdtar';
try {
  execFileSync(tar, ['-a', '-c', '-f', DESTINO, '-T', lista], { cwd: RAIZ, stdio: 'inherit' });
} finally {
  rmSync(lista, { force: true });
}

const mb = (statSync(DESTINO).size / 1024 / 1024).toFixed(1);
console.log(`${basename(DESTINO)}: ${arquivos.length} arquivos, ${mb} MB`);
console.log(DESTINO);
