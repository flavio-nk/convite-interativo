# Convite Interativo — protótipo navegável

Versão independente do protótipo desenhado no canvas, para testar no navegador e no celular.

## Rodar localmente

```bash
npm install
npm run dev
```

## Publicar no Vercel

1. Em vercel.com, **Add New… → Project** e importe este repositório.
2. O Vercel detecta Vite sozinho (build `npm run build`, saída `dist`). Clique em **Deploy**.
3. Cada novo envio para a branch principal publica uma nova versão automaticamente.

## Como está organizado

- `src/screens/*.dc.html` — as telas exportadas do canvas, sem alterações.
- `src/runtime.js` — motor que interpreta as telas (modelos, `{{…}}`, repetições, condições, componentes importados e navegação entre telas) e as renderiza com Preact.
- `src/main.js` — rotas por `#/NomeDaTela`, moldura de celular para as telas do convidado e o menu **Telas** para pular entre telas durante os testes.

Cada visita a uma tela começa do zero, como num carregamento de página.

## Telas

| Rota | Tela |
| --- | --- |
| `#/Main` | Painel — Meus convites |
| `#/Temas` | Novo convite — escolher tema → editor |
| `#/CriarTema` | Criar tema |
| `#/Editor` | Editor do convite (blocos, tema, música) |
| `#/Respostas` | Confirmações de presença |
| `#/Abertura` | Convite fechado e animação de abertura |
| `#/ConviteCapa`, `#/ConviteDetalhes`, `#/ConviteGaleria`, `#/ConviteRSVP` | Páginas do convite |

Os dados são de exemplo e não ficam salvos: ao recarregar, tudo volta ao estado inicial.
