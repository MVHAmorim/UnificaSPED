import { Context } from "hono";
import { UnificacaoService } from "../servicos/UnificacaoService";
import { Ambiente, Variaveis } from "../config/ambiente";

export class UnificacaoController {
    static async unificar(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>) {
        try {
            // 0. Autenticação e Cota
            const usuario = c.get('usuario');
            const email = c.get('email');

            if (!usuario) return c.json({ erro: 'Usuário não autenticado.' }, 401);

            const now = new Date();
            const mesAtual = now.toISOString().slice(0, 7); // YYYY-MM

            // Inicializar consumo se não existir
            if (!usuario.consumo) {
                usuario.consumo = {};
            }

            const consumoMes = usuario.consumo[mesAtual] || 0;

            if (consumoMes >= 10) {
                return c.json({
                    erro: 'Você atingiu o limite de 10 unificações mensais do plano Gratuito.' // Mensagem amigável
                }, 403);
            }

            // Upload
            const formData = await c.req.parseBody();
            const files = formData['files[]'];

            if (!files) {
                return c.json({ erro: 'Nenhum arquivo enviado.' }, 400);
            }

            const fileArray = Array.isArray(files) ? files : [files];
            const validFiles = fileArray.filter(f => f instanceof File) as File[];

            if (validFiles.length < 2) {
                return c.json({ erro: 'É necessário enviar ao menos 2 arquivos para unificação.' }, 400);
            }

            if (validFiles.length > 2) {
                return c.json({ erro: 'Seu plano permite unificar apenas Matriz + 1 Filial por vez. Faça o upgrade para processar múltiplas filiais.' }, 403);
            }

            // 1. Upload para R2 (Temp)
            const bucket = c.env.ARQUIVOS_USUARIOS;
            const sessionId = crypto.randomUUID();
            const storedKeys: string[] = [];

            for (const file of validFiles) {
                const key = `temp/${sessionId}/${file.name}`;
                await bucket.put(key, file.stream(), {
                    httpMetadata: { contentType: file.type }
                });
                storedKeys.push(key);
            }

            // 2. Incrementar Cota (Antes de executar, para evitar race de abuse - ou depois? O prompt diz "Se passar, increment... antes de iniciar o stream")
            usuario.consumo[mesAtual] = consumoMes + 1;
            await c.env.UsuariosSpedito.put(email, JSON.stringify(usuario));

            // 3. Executar Unificação
            // FASE 1: Análise de Cenário
            const mapContextos = await UnificacaoService.analisarCenario(bucket, storedKeys);

            if (mapContextos.size === 0) {
                return c.json({ erro: 'Não foi possível identificar arquivos SPED válidos (Header 0000 não encontrado).' }, 400);
            }

            if (mapContextos.size > 1) {
                // Montar mensagem detalhada
                let msg = 'Múltiplas competências ou empresas base detectadas: ';
                for (const ctx of mapContextos.values()) {
                    msg += `[${ctx.competencia} - ${ctx.cnpjBase}] `;
                }
                msg += '. O sistema atual suporta unificar apenas uma competência/empresa por vez.';
                return c.json({ erro: msg }, 400);
            }

            const contexto = mapContextos.values().next().value;
            if (!contexto) {
                return c.json({ erro: 'Erro interno ao processar contexto de unificação.' }, 500);
            }

            if (!contexto.matriz) {
                return c.json({ erro: `Matriz não identificada para a competência ${contexto.competencia}. Verifique se um dos arquivos possui final de CNPJ 0001.` }, 400);
            }

            // FASE 2: Execução
            const stream = await UnificacaoService.unificar(bucket, contexto);

            // 4. Retornar Stream
            return c.body(stream, 200, {
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="UnificaSPED_${sessionId}.txt"`
            });

        } catch (error: any) {
            console.error('Erro na unificação:', error);
            return c.json({ erro: error.message || 'Erro interno no servidor.' }, 500);
        }
    }
}
