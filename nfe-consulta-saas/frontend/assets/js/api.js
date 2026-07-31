/* ============================================================
   Camada de acesso a dados (Data Access Layer) do frontend.
   - Se window.NFE_CONFIG.apiBaseUrl estiver definido, consulta o backend real.
   - Caso contrário, usa os dados de demonstração (window.NFE_MOCK).
   O contrato de retorno é sempre o mesmo objeto "nota".
   ============================================================ */
window.NFE_CONFIG = window.NFE_CONFIG || {
  apiBaseUrl: "",                 // ex.: "https://api.suaempresa.com.br"  (vazio = modo demo)
  tokenStorageKey: "nfe_jwt"
};

const NfeApi = {
  /** Remove máscara e mantém só dígitos. */
  somenteDigitos(v) { return (v || "").replace(/\D/g, ""); },

  /** Valida a chave de acesso (44 dígitos numéricos). */
  validarChave(chave) {
    const d = this.somenteDigitos(chave);
    if (d.length === 0) return { ok: false, msg: "Informe a chave de acesso." };
    if (d.length !== 44) return { ok: false, msg: `A chave deve ter 44 dígitos (atual: ${d.length}).` };
    return { ok: true, chave: d };
  },

  /** Consulta a NF-e pela chave. Retorna a nota ou lança erro. */
  async consultar(chave) {
    const d = this.somenteDigitos(chave);

    // Modo demo (sem backend)
    if (!window.NFE_CONFIG.apiBaseUrl) {
      await new Promise(r => setTimeout(r, 600)); // simula latência
      if (d !== window.NFE_MOCK.chave) {
        const nota = structuredClone(window.NFE_MOCK);
        nota.chave = d; // ecoa a chave digitada para a demo
        return nota;
      }
      return structuredClone(window.NFE_MOCK);
    }

    // Modo real — chama o backend
    const token = localStorage.getItem(window.NFE_CONFIG.tokenStorageKey);
    const resp = await fetch(`${window.NFE_CONFIG.apiBaseUrl}/api/v1/nfe/${d}`, {
      headers: {
        "Accept": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      }
    });

    if (resp.status === 404) throw new Error("Nota fiscal não encontrada para a chave informada.");
    if (resp.status === 401) throw new Error("Sessão expirada. Faça login novamente.");
    if (!resp.ok) throw new Error(`Erro ao consultar a nota (HTTP ${resp.status}).`);
    return await resp.json();
  }
};

window.NfeApi = NfeApi;
