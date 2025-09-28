// index.js
import fetch from "node-fetch";
import * as dotenv from "dotenv";

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
        "User-Agent": "gh-repo-info-fetcher",
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

(async () => {
  dotenv.config();
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("❌ Defina a variável de ambiente GITHUB_TOKEN antes de rodar");
    process.exit(1);
  }

  // Lista fixa de repositórios (owner/name)
  const repos = [
    "voronianski/react-swipe",
    "slab/delta",
    "meteor/react-packages",
    "JorgenVatle/react-packages",
    "LeanKit-Labs/autohost",
    "backtrace-labs/backtrace-morgue",
    "Apollon77/meross-cloud",
    "Apollon77/smartmeter-obis",
    "vpulim/node-soap",
    "raineorshine/solidity-sha3",
    "stpatrik/Vue-NUXT-Apisful",
    "robinp7720/Oblecto",
    "cloudinary/cloudinary_npm",
  ];

  const service = new GitHubService(token);

  for (const repoPath of repos) {
    try {
      const [owner, name] = repoPath.replace(/\/$/, "").split("/");

      console.log(`\n📌 Buscando dados de: ${owner}/${name}`);

      const repo = await service.fetchRepositoryInfo(owner, name);

      console.log(`✅ Repositório: ${repo.nameWithOwner}`);
      console.log(`   🌟 Stars: ${repo.stargazerCount}`);
      console.log(`   🍴 Forks: ${repo.forkCount}`);
      console.log(`   🔗 URL: ${repo.url}`);
      console.log(`   📝 Descrição: ${repo.description || "Sem descrição"}`);
    } catch (err) {
      console.error(`❌ Erro ao buscar info de ${repoPath}: ${err.message}`);
    }
  }
})();

