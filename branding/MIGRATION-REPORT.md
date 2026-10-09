# Registro da migração visual

**Data:** 2026-10-09  
**Identidade:** Karaoke Party 2.0  
**Fonte de verdade:** `branding/README-branding.md`, `branding/idvisual.png` e `branding/logos/`

## Escopo aplicado

- Tokens oficiais e semânticos centralizados em `App/karaoke-theme.css`.
- Aliases legados preservados e redirecionados por função visual.
- Montserrat para títulos e Inter para elementos de interface.
- Logos oficiais em landing, autenticação, Cabine PC, seletor de modos, controle móvel, TV, pareamento, Área do Cantor e Administração.
- Símbolo oficial em favicon, PWA, Apple Touch Icon e notificações.
- Paleta oficial aplicada às folhas de estilo e aos componentes visuais gerados por JavaScript.
- Roxo para navegação e seleção, laranja para ações principais e pink para interações sociais.
- Estados funcionais mantidos separados da paleta decorativa.
- Estrutura, IDs, seletores e contratos JavaScript preservados.

## Interfaces cobertas

- `index.html`
- `App/cabine.html`
- `App/cabine-pc.html`
- `App/cabine-mobile.html`
- `App/cabine-tv.html`
- `App/tv-pair.html`
- `App/mobile.html`
- `App/audience.html`
- `App/admin.html`
- `App/index.html`

## Ativos públicos

Os arquivos em `Assets/brand/` são cópias públicas ou exportações redimensionadas dos originais. Os PNGs de logo não recebem filtros, distorções ou reconstrução em CSS.

## Proteções funcionais

- Nenhuma alteração em Firebase, autenticação, APIs, persistência ou pagamentos.
- Nenhuma alteração em reprodução, sincronização, fila, volume, tom ou atalhos.
- Nenhuma alteração estrutural no palco, na TV ou na segunda tela.
- Cores de sucesso, alerta, erro, gravação, avaliação e marcas de terceiros permanecem funcionais.

## Validação executada

- Integridade estrutural das folhas CSS.
- Resolução de referências locais em HTML.
- Validação JSON do manifesto.
- Dimensões e leitura dos PNGs públicos.
- Busca de referências aos ativos e à paleta antiga.
- Busca de IDs duplicados nas entradas HTML.
- Entrega HTTP local das rotas e ativos principais.
- Verificação de contraste dos pares semânticos principais.

## Limitações de validação

O ambiente não fornece navegador gráfico/headless, runtime Node, Firebase CLI nem suíte de regressão visual. Assim, não foi possível automatizar screenshots, executar JavaScript em navegador, validar fluxos autenticados com Firebase ou publicar diretamente por Firebase CLI. Essas limitações não equivalem a validação funcional dos fluxos em execução.
