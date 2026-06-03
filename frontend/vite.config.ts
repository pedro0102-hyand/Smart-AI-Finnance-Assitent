import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Variáveis que NUNCA devem aparecer no bundle do frontend.
// Se alguém adicioná-las ao .env com prefixo VITE_, o build falha imediatamente.
const FORBIDDEN_VITE_VARS = [
  'VITE_GOOGLE_API_KEY',
  'VITE_SECRET_KEY',
  'VITE_DATABASE_URL',
  'VITE_DB_PASSWORD',
]

export default defineConfig(({ mode }) => {
  // Carrega todas as variáveis de ambiente do diretório raiz do frontend
  const env = loadEnv(mode, process.cwd(), '')

  // Detecta se alguma variável proibida foi definida com prefixo VITE_
  const leaked = FORBIDDEN_VITE_VARS.filter((key) => env[key] !== undefined)

  if (leaked.length > 0) {
    // Falha o build com mensagem clara — não apenas um aviso ignorável
    throw new Error(
      `\n\n🚨  ERRO DE SEGURANÇA: as seguintes variáveis de ambiente NUNCA devem ` +
      `usar o prefixo VITE_ pois serão embutidas em texto puro no bundle JavaScript ` +
      `e ficarão visíveis publicamente:\n\n` +
      leaked.map((k) => `  ❌  ${k}`).join('\n') +
      `\n\nRemova o prefixo VITE_ dessas variáveis. Elas pertencem APENAS ao backend.\n`
    )
  }

  return {
    plugins: [react()],

    // Restringe explicitamente quais variáveis de ambiente são injetadas no bundle.
    // Apenas variáveis com prefixo VITE_ são expostas ao código cliente —
    // e nenhuma variável sensível deve ter esse prefixo (garantido acima).
    envPrefix: 'VITE_',
  }
})