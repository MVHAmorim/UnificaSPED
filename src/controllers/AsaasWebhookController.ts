import { Context } from "hono";
import { Ambiente } from "../config/ambiente";
import { DadosUsuario } from "../dominios/usuario";

export class AsaasWebhookController {
    static async handleWebhook(c: Context<{ Bindings: Ambiente }>) {
        const token = c.req.header("asaas-access-token");
        if (token !== c.env.ASAAS_WEBHOOK_TOKEN) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        const body = await c.req.json();
        const event = body.event;
        const payment = body.payment;

        if (event === "PAYMENT_CONFIRMED") {
            let email = payment.email;

            // FALLBACK CRÍTICO: Se o email não vier no payload, buscar na API do Asaas
            if (!email && payment.customer) {
                try {
                    const response = await fetch(`${c.env.ASAAS_URL}/customers/${payment.customer}`, {
                        headers: {
                            "access_token": c.env.ASAAS_API_KEY
                        }
                    });

                    if (response.ok) {
                        const customerData = await response.json() as { email: string };
                        email = customerData.email;
                    } else {
                        console.error(`Falha ao buscar cliente Asaas ${payment.customer}: ${response.status}`);
                    }
                } catch (error) {
                    console.error("Erro ao conectar API Asaas:", error);
                }
            }

            if (email) {
                // Atualizar usuário no KV
                const dadosUsuarioStr = await c.env.UNIFICASPED_USUARIOS.get(email);
                if (dadosUsuarioStr) {
                    const usuario = JSON.parse(dadosUsuarioStr) as DadosUsuario;

                    // Lógica de Atualização do Plano PRO
                    usuario.plano = 'PRO';

                    // Adicionar 30 dias de validade
                    const hoje = new Date();
                    const novaValidade = new Date(hoje.setDate(hoje.getDate() + 30));
                    usuario.vencimento = novaValidade.toISOString().split('T')[0];

                    // Zerar cota
                    // usuario.cotaMensalUsada = 0; // Campo hipotetico se existir, ou resetar consumo
                    if (usuario.consumo) {
                        // Resetar consumo do mês atual? Ou apenas garantir flag PRO?
                        // O prompt diz "Zere a cota: cotaMensalUsada: 0". 
                        // Verificando interface DadosUsuario em UnificacaoController... 
                        // Parece que usa `consumo: { 'YYYY-MM': number }`.
                        // Vamos zerar o consumo do mês atual para garantir uso imediato em caso de upgrade
                        const mesAtual = new Date().toISOString().slice(0, 7);
                        usuario.consumo[mesAtual] = 0;
                    }

                    await c.env.UNIFICASPED_USUARIOS.put(email, JSON.stringify(usuario));
                    console.log(`Usuário ${email} atualizado para PRO até ${usuario.vencimento}`);
                } else {
                    console.warn(`Usuário ${email} não encontrado no sistema para upgrade.`);
                    // Opcional: Criar usuário se não existir? Melhor não, apenas logar.
                }
            } else {
                console.error("Email não encontrado para o pagamento confirmado.");
            }
        }

        return c.json({ received: true });
    }
}
