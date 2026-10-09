# Baseline pré-migração visual — Karaoke Party 2.0

**Data:** 2026-10-09  
**Etapa:** 0 — preparação e baseline  
**Escopo:** documentação e materiais de branding; nenhum arquivo funcional alterado.

## 1. Ponto de restauração

- Branch observada: `main`.
- Commit funcional de referência: `3934fdfbdaa94f6faa9613e4bd3172179abc9e35`.
- Mensagem do commit: `Remove cores legadas das interfaces de reprodução`.
- Tag local anotada: `branding-baseline-pre-migration-2026-10-09`.
- Para confirmar o destino do tag: `git rev-parse branding-baseline-pre-migration-2026-10-09^{commit}`.

O diretório `branding/` ainda não fazia parte do commit funcional de referência. Ele foi organizado e documentado nesta etapa para ser registrado separadamente, sem misturar alterações de interface.

## 2. Fontes oficiais de identidade

| Recurso | Dimensões | Formato/canais | SHA-256 |
| --- | ---: | --- | --- |
| `idvisual.png` | 1122 × 1402 | PNG RGB | `c37d693d6c4388c92adba2620c0ca7376286e7f2a65fa069fb1ed45a1a3630b4` |
| `logos/icone.png` | 1254 × 1254 | PNG RGBA | `4b68bd5f4ac2bb593f886764fa206dcb74ea50cb7c1c1d36ef0a6ddf09c3c1fd` |
| `logos/logo b.png` | 2172 × 724 | PNG RGBA | `d299555b398d2433d721f60a555ef94df5cf1672f91d67efeb2bfc16ee232a58` |
| `logos/logo horizontal.png` | 2172 × 724 | PNG RGBA | `26811eb53255ea8a877458c960b5de6e94c694cc73bf851e9d86d01b83a77a51` |
| `logos/logo vertical.png` | 1254 × 1254 | PNG RGBA | `03eebffd06d60b036b356a74d306353db24c03625d1c28fea88b5f08f039e17d` |
| `logos/logo w.png` | 2172 × 724 | PNG RGBA | `0acee24c06a1caece488f6404f489c856435ed607ecad3d3add64217edb1cab5` |

Os arquivos foram apenas movidos de `branding/logo/` para `branding/logos/`; seu conteúdo binário não foi transformado.

## 3. Entradas e interfaces funcionais congeladas

| Interface | Entrada | Camadas visuais principais |
| --- | --- | --- |
| Landing e planos | `index.html` | `site.css` |
| Seletor de modos | `App/cabine.html` | `cabine-entry.css`, `karaoke-theme.css`, `playback-theme.css` |
| Cabine do DJ desktop | `App/cabine-pc.html` | `cabine.css`, `engagement.css`, `party-features.css`, `party-social.css`, `cabin-layout.css`, `cabine-pc-v2.css`, `cabine-pc-overlays.css`, `show-style.css`, temas compartilhados |
| Controle do DJ no celular | `App/cabine-mobile.html` | `cabine-entry.css`, temas compartilhados |
| Cabine autônoma de TV/TV Box | `App/cabine-tv.html` | `cabine-tv-base.css`, `cabine-tv.css`, temas compartilhados |
| Pareamento da TV | `App/tv-pair.html` | `tv-pair.css`, temas compartilhados |
| Área do cantor/convidado | `App/mobile.html` | `mobile.css`, `challenges.css`, `party-social.css`, `mobile-overlays.css`, temas compartilhados |
| Segunda tela | `App/audience.html` | estilos da cabine, `audience.css`, `show-style.css`, temas compartilhados |
| Administração | `App/admin.html` | CSS embutido e `party-features.css` |
| Redirecionamento legado | `App/index.html` | estilos embutidos mínimos |

## 4. Contratos a preservar nas próximas etapas

- IDs, classes e seletores consumidos pelo JavaScript.
- Estrutura do palco e os nós clonados por `App/audience.js`.
- Reprodução, sincronização, tom, volume, play/pause e atalhos.
- Fila, ordenação, placar, ranking, desafios e interações sociais.
- Identificação de salas, usuários, festas e QR Codes.
- Firebase, autenticação, persistência, APIs e pagamentos.
- Manifesto PWA, service worker e notificações.
- Prioridade do vídeo e das letras em TV, fullscreen e segunda tela.

Não fazem parte da primeira fase visual: reorganização da fila da TV, remoção de informação redundante, mudança de layout do palco ou qualquer redesign estrutural.

## 5. Baseline visual e técnico

- Identidade pública anterior: `Assets/logo.png`, `Assets/icon.png`, `Assets/icon-192.png` e `Assets/icon-512.png`.
- Tema compartilhado anterior: azul `#5595f5`, lilás `#9370f5` e amarelo `#ffc83d` em `App/karaoke-theme.css`.
- A landing e o Admin mantêm paletas próprias; a área do cantor redefine tokens no fim de `mobile.css`.
- Montserrat e Poppins são as famílias predominantes; Inter ainda não foi integrada.
- A composição visual depende da ordem das folhas e contém estilos inline e regras `!important`.
- Não foi encontrada suíte de regressão visual nem navegador headless instalado no projeto. Portanto, não foram geradas capturas renderizadas nesta etapa.
- `branding/idvisual.png` permanece a referência visual oficial não renderizada.

## 6. Matriz de validação para os pilotos futuros

### Cabine do DJ

- Login, criação/retomada de sala e estados de assinatura/trial.
- Catálogo, busca, seleção, fila e estados vazios.
- Play, pause, próximo, volume, tom e atalhos.
- Player normal, fullscreen, QR, nota, suspense, ranking e tela de espera.
- Segunda tela, mantendo os seletores e a sincronização atuais.
- Resoluções mínimas: 1366 × 768, 1440 × 900 e 1920 × 1080.

### TV/TV Box

- Login manual e pareamento por QR Code.
- Criação e retomada de festa.
- Espera, reprodução, fila, próxima apresentação, nota e ranking.
- Toolbar, som, tela cheia, troca/encerramento de sala e controle remoto.
- Resoluções mínimas: 1280 × 720 e 1920 × 1080; conferir também viewport compacto previsto pelos media queries existentes.

### Critérios transversais

- Nenhuma mudança estrutural de tela.
- Nenhuma alteração de contrato JavaScript.
- Contraste, foco visível, áreas de toque e movimento reduzido.
- Sem corte, scroll horizontal ou sobreposição sobre letras/vídeo.
- Cores funcionais analisadas por contexto; nenhuma substituição baseada apenas no nome do token.

## 7. Checkpoint da Etapa 0

- [x] Materiais oficiais lidos e inspecionados.
- [x] Diretório de logos alinhado para `branding/logos/`.
- [x] Nomes reais das variações registrados no manual.
- [x] Integridade dos ativos registrada por dimensão e SHA-256.
- [x] Interfaces e camadas visuais inventariadas.
- [x] Escopo funcional e estrutural congelado.
- [x] Ponto de restauração local criado no Git.
- [ ] Capturas renderizadas: pendentes de navegador/headless runner em etapa autorizada.
- [ ] Migração visual: não iniciada.
