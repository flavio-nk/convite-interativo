# Convite Interativo

Plataforma para criar, editar, publicar e excluir convites digitais interativos, com temas, abertura animada, música, mapa, contagem regressiva e confirmação de presença.

## Configuração no Vercel (uma vez)

O site precisa de três coisas no painel do Vercel. Sem elas, ele abre, mas mostra um aviso pedindo a configuração.

1. **Banco de dados** (guarda convites, temas e respostas)
   Projeto › **Storage** › **Create Database** › **Upstash › Redis** (plano gratuito) › conecte ao projeto `convite-interativo`.
   As variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` são criadas automaticamente.
2. **Armazenamento de arquivos** (fotos, vídeos e músicas enviados)
   Projeto › **Storage** › **Create** › **Blob** › conecte ao projeto.
   A variável `BLOB_READ_WRITE_TOKEN` é criada automaticamente.
3. **Senha do organizador**
   Projeto › **Settings** › **Environment Variables** › adicione `ADMIN_PASSWORD` com a senha que você quiser usar.

Depois, em **Deployments**, faça **Redeploy** do último deploy para as variáveis valerem.

## Como funciona

- **Organizador** (com senha): painel de convites, galeria de 27 temas e temas próprios, editor com salvamento automático, publicação e respostas.
- **Convidado** (sem senha): abre o link `…/#/c/<código>` de um convite **publicado**, vê a abertura animada, navega pelas páginas e confirma presença. Rascunhos não abrem para convidados.
- O convidado pode alterar a própria resposta no mesmo aparelho.

## Desenvolvimento local

```bash
npm install
npm run build
npm run serve        # http://localhost:3000 — senha local: convite
```

Sem as variáveis do Vercel, os dados ficam em `.data/` (arquivo local) e os arquivos enviados em `.data/uploads/`.

## Testes

```bash
npm run build && rm -rf .data && npm run serve   # em outro terminal
pip install playwright && python -m playwright install chromium
python tests/e2e.py
```

A bateria cobre o fluxo inteiro: login, criar convite a partir de um tema, editar e recarregar (dados salvos), enviar foto, publicar, convidado abrir e responder em outro aparelho, respostas no painel, exportar planilha, excluir/desfazer, trocar tema, temas próprios e layout no celular.

## Estrutura

- `api/` — funções do Vercel: `auth` (senha), `invites`, `rsvp`, `themes`, `upload`.
- `api/_lib/` — armazenamento (Redis ou arquivo local), autenticação e utilitários.
- `src/screens/*.dc.html` — telas (modelo + lógica). `Convite.dc.html` é o convite do convidado, montado a partir dos dados salvos.
- `src/runtime.js` — motor que renderiza as telas com Preact; `src/api.js` — acesso à API e utilitários de data e tema.
- `dev-server.js` — servidor local equivalente ao Vercel.
