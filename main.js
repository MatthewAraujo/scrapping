// index.js
import fs from "fs";
import fetch from "node-fetch";

const API_BASE = "https://libraries.io/api";
const API_KEY = process.env.LIBRARIES_API_KEY; // configure seu API key do libraries.io
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // configure seu token do GitHub

const allProjects = [];

/**
 * Classe responsável por consultar informações do GitHub usando GraphQL
 */
class GitHubService {
  constructor(token) {
    this.token = token;
    this.baseUrl = "https://api.github.com/graphql";
  }

  async fetchRepositoryInfo(owner, name) {
    const query = `
      query($owner:String!, $name:String!) {
        repository(owner:$owner, name:$name) {
          nameWithOwner
          description
          stargazerCount
          forkCount
          url
          isArchived
          isFork
          createdAt
          updatedAt
        }
      }
    `;

    const response = await this.makeGraphQLRequest(query, { owner, name });

    if (response.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(response.errors, null, 2)}`);
    }

    return response.data.repository;
  }

  async makeGraphQLRequest(query, variables) {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} ${text}`);
    }

    return response.json();
  }
}

/**
 * Busca projetos do libraries.io
 */
async function fetchProjects(page = 1, perPage = 100, retries = 5) {
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("platforms", "npm");
  url.searchParams.set("sort", "rank");
  url.searchParams.set("order", "desc");
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  try {
    const resp = await fetch(url.toString(), { headers: { Accept: "application/json" } });

    if (resp.status === 429) {
      if (retries > 0) {
        console.warn(`⚠️ 429 Too Many Requests na página ${page}. Esperando 60s...`);
        await new Promise((resolve) => setTimeout(resolve, 60000));
        return fetchProjects(page, perPage, retries - 1);
      } else {
        throw new Error(`Múltiplos 429 na página ${page}, abortando`);
      }
    }

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Erro HTTP ${resp.status} → ${text}`);
    }

    return resp.json();
  } catch (err) {
    if (retries > 0) {
      console.warn(`⚠️ Erro na página ${page}: ${err.message}. Tentando novamente em 10s...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return fetchProjects(page, perPage, retries - 1);
    }
    throw err;
  }
}

(async () => {
  if (!API_KEY) {
    console.error("❌ Defina LIBRARIES_API_KEY no ambiente");
    process.exit(1);
  }
  if (!GITHUB_TOKEN) {
    console.error("❌ Defina GITHUB_TOKEN no ambiente");
    process.exit(1);
  }

  const github = new GitHubService(GITHUB_TOKEN);

  const totalPages = 2; // reduzi para testes. Pode aumentar (ex: 60)
  const perPage = 20;
  const concurrency = 2;
  let currentPage = 1;

  async function worker() {
    while (currentPage <= totalPages) {
      const pageToFetch = currentPage++;
      console.log(`📥 Buscando página ${pageToFetch}...`);
      try {
        const projects = await fetchProjects(pageToFetch, perPage);

        const simplified = await Promise.all(
          projects.map(async (p) => {
            let repoInfo = null;
            if (p.repository_url && p.repository_url.includes("github.com")) {
              try {
                const parts = p.repository_url.split("github.com/")[1].split("/");
                const owner = parts[0];
                const name = parts[1].replace(/\.git$/, "");
                repoInfo = await github.fetchRepositoryInfo(owner, name);
              } catch (err) {
                console.warn(`⚠️ Falha ao buscar GitHub info para ${p.repository_url}: ${err.message}`);
              }
            }
            return {
              name: p.name,
              repository_url: p.repository_url,
              deprecation_reason: p.deprecation_reason || null,
              github: repoInfo,
            };
          })
        );

        allProjects.push(...simplified);
        console.log(`✅ Página ${pageToFetch}: ${simplified.length} registros adicionados`);
      } catch (err) {
        console.error(`❌ Página ${pageToFetch} falhou: ${err.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  fs.writeFileSync("projects.json", JSON.stringify(allProjects, null, 2));
  console.log(`🎉 Finalizado! Dados salvos em projects.json`);

  // --- FILTRAR APENAS OS DEPRECADOS ---
  const rawData = fs.readFileSync("projects.json");
  const projects = JSON.parse(rawData);

  const deprecatedProjects = projects.filter((p) => p.deprecation_reason);

  fs.writeFileSync("projects.json", JSON.stringify(deprecatedProjects, null, 2));
  console.log(`🎯 Filtragem concluída! Apenas projetos deprecados foram salvos em projects.json`);
})();

