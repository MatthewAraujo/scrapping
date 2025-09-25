````markdown
# Libraries.io NPM Deprecated Packages Scraper

Este projeto coleta pacotes NPM do [Libraries.io](https://libraries.io) e salva apenas os pacotes que possuem **deprecation_reason** em um arquivo `projects.json`.

---

## Pré-requisitos

- Node.js (versão 18 ou superior recomendada)
- pnpm

---

## Como usar

1. Clone este repositório ou baixe o código.

2. Instale as dependências:

```bash
pnpm install
````

3. No arquivo `main.js`, substitua a variável `API_KEY` pela sua **chave de API do Libraries.io**:

```js
const API_KEY = "SUA_CHAVE_AQUI";
```

4. Rode o script:

```bash
node main.js
```

5. Ao final, o arquivo `projects.json` conterá apenas os pacotes deprecados.

## Observações

* O script respeita o limite da API (60 requisições/minuto).
* Caso haja muitos pacotes, a execução pode levar alguns minutos.
* É possível ajustar o número de páginas e a concorrência alterando as variáveis `totalPages` e `concurrency` dentro do script.
