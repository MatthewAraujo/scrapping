const fs = require("fs");

const API_BASE = "https://libraries.io/api";
const API_KEY = "https://libraries.io/api";

const allProjects = [];

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
        console.warn(`⚠️ 429 Too Many Requests na página ${page}. Esperando 60s antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, 60000)); // espera 60 segundos
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
      await new Promise(resolve => setTimeout(resolve, 10000));
      return fetchProjects(page, perPage, retries - 1);
    }
    throw err;
  }
}

(async () => {
  const totalPages = 60;
  const perPage = 100;
  const concurrency = 3; // 3 workers para respeitar rate limit
  let currentPage = 1;

  async function worker() {
    while (currentPage <= totalPages) {
      const pageToFetch = currentPage++;
      console.log(`📥 Buscando página ${pageToFetch}...`);
      try {
        const projects = await fetchProjects(pageToFetch, perPage);

        const simplified = projects.map(p => ({
          name: p.name,
          repository_url: p.repository_url,
          deprecation_reason: p.deprecation_reason || null
        }));

        allProjects.push(...simplified);
        console.log(`✅ Página ${pageToFetch}: ${simplified.length} registros adicionados`);
      } catch (err) {
        console.error(`❌ Página ${pageToFetch} falhou: ${err.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  fs.writeFileSync("projects.json", JSON.stringify(allProjects, null, 2));
  console.log(`🎉 Finalizado! Todos os dados foram salvos em projects.json`);
  //
  // --- FILTRAR APENAS OS DEPRECADOS ---
  const rawData = fs.readFileSync("projects.json");
  const projects = JSON.parse(rawData);

  const deprecatedProjects = projects.filter(p => p.deprecation_reason);

  fs.writeFileSync("projects.json", JSON.stringify(deprecatedProjects, null, 2));
  console.log(`🎯 Filtragem concluída! Apenas projetos deprecados foram salvos em projects.json`);
})();
