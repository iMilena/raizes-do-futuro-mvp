<#
  Roda a suite completa pedindo a senha na hora.

  POR QUE ISTO EXISTE
  As suites `nuvem`, `aparelhos` e a metade da operacao do `canal` precisam da
  senha de um usuario de operacao. Havia dois caminhos, e os dois falham na
  pratica:

    - escrever a senha no .env: da para esquecer de salvar, ou salvar no arquivo
      errado, e a senha fica gravada em disco;
    - $env:SUPABASE_TEST_SENHA = "..." no terminal: funciona, mas a senha vai
      para o historico do PowerShell (ConsoleHost_history.txt) e fica lah.

  Aqui a senha e digitada mascarada, vive so nesta execucao e nao e escrita em
  lugar nenhum. Nada a salvar, nada a lembrar de apagar.

  ARQUIVO EM ASCII DE PROPOSITO: o PowerShell 5.1 le .ps1 sem BOM como ANSI, e
  acento vira lixo no meio de string - o que ja quebrou a primeira versao deste
  script.

  COMO RODAR (a politica de execucao deste computador bloqueia .ps1 por padrao,
  por isso o -ExecutionPolicy Bypass):

      powershell -ExecutionPolicy Bypass -File testes\rodar-com-senha.ps1

  Para rodar so uma suite:

      powershell -ExecutionPolicy Bypass -File testes\rodar-com-senha.ps1 nuvem
#>

$suites = $args
$codigo = 1

# e-mail: vem do .env, que ja esta preenchido e nao tem segredo nenhum
$email = $null
if (Test-Path .env) {
  $linha = Get-Content .env | Where-Object { $_ -match '^\s*SUPABASE_TEST_EMAIL\s*=' } | Select-Object -First 1
  if ($linha) { $email = ($linha -split '=', 2)[1].Trim() }
}
if (-not $email) { $email = Read-Host 'E-mail do usuario de operacao' }
Write-Host "usuario: $email"

$segura = Read-Host "Senha de $email" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
try {
  $senha = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $env:SUPABASE_TEST_EMAIL = $email
  $env:SUPABASE_TEST_SENHA = $senha

  $n = $senha.Length
  if ($n -eq 0) {
    Write-Host ''
    Write-Host 'Senha vazia - as suites que precisam de sessao vao pular.' -ForegroundColor Yellow
  } else {
    Write-Host ("senha recebida (" + $n + " caracteres) - nao sera gravada em disco")
    Write-Host ''
  }

  # npm.cmd, nao npm: o wrapper npm.ps1 e bloqueado pela politica de execucao
  if ($suites.Count -gt 0) { & npm.cmd test -- @suites } else { & npm.cmd test }
  $codigo = $LASTEXITCODE
} finally {
  # limpa a senha da memoria do processo e da variavel de ambiente
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  $senha = $null
  Remove-Item Env:\SUPABASE_TEST_SENHA -ErrorAction SilentlyContinue
}

exit $codigo
