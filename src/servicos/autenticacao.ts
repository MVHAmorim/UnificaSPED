import { enviarLinkMagico, ConfiguracaoEmail } from "./email";
import { DadosUsuario, RespostaAutenticacao } from "../dominios/usuario";

export async function realizarLogin(
    email: string,
    kvUsuarios: KVNamespace,
    kvSessoes: KVNamespace,
    origem: string,
    configEmail: ConfiguracaoEmail
): Promise<RespostaAutenticacao> {
    // 1. Buscar usuário no KV de Usuários
    const chaveUsuario = email;
    const dadosUsuarioStr = await kvUsuarios.get(chaveUsuario);

    if (!dadosUsuarioStr) {
        return {
            sucesso: false,
            mensagem: "Usuário não encontrado. Entre em contato com o suporte."
        };
    }

    let dadosUsuario: DadosUsuario;
    try {
        dadosUsuario = JSON.parse(dadosUsuarioStr);
    } catch (e) {
        return { sucesso: false, mensagem: "Erro nos dados do usuário. Contate o suporte." };
    }

    // 2. Validar Vencimento
    const hoje = new Date().toISOString().split('T')[0];
    if (dadosUsuario.vencimento < hoje) {
        return {
            sucesso: false,
            mensagem: `Seu acesso venceu em ${dadosUsuario.vencimento.split('-').reverse().join('/')}. Renove sua assinatura.`
        };
    }

    // 3. Gerar Token e Sessão
    const token = crypto.randomUUID();
    const chaveSessao = `SESSAO:${token}`;

    // --- SESSÃO ÚNICA: Derrubar sessão anterior ---
    const chaveSessaoAtiva = `SESSAO_ATIVA:${email}`;
    const tokenAntigo = await kvSessoes.get(chaveSessaoAtiva);
    if (tokenAntigo) {
        await kvSessoes.delete(`SESSAO:${tokenAntigo}`);
    }
    // ------------------------------------------------

    // Salvar sessão contendo o email no KV de Acessos
    await kvSessoes.put(chaveSessao, email, { expirationTtl: 28800 }); // 8 horas

    // Atualizar sessão ativa no KV de Acessos
    await kvSessoes.put(chaveSessaoAtiva, token, { expirationTtl: 28800 }); // 8 horas

    const urlLinkMagico = `${origem}/?token=${token}`;

    // Enviar e-mail via SES
    const resultadoEmail = await enviarLinkMagico(email, urlLinkMagico, configEmail);

    if (resultadoEmail.sucesso) {
        const idMsg = resultadoEmail.erro ? resultadoEmail.erro.replace("Enviado! ID: ", "") : undefined;

        return {
            sucesso: true,
            mensagem: "Link de acesso enviado para seu e-mail.",
            linkMagico: urlLinkMagico, // Mantendo para debug local
            idMensagem: idMsg
        };
    } else {
        return {
            sucesso: false,
            mensagem: resultadoEmail.erro || "Erro ao enviar e-mail.",
            linkMagico: urlLinkMagico // Fallback para dev
        };
    }
}

export async function verificarToken(token: string, kvUsuarios: KVNamespace, kvSessoes: KVNamespace): Promise<{ email: string, usuario: DadosUsuario } | null> {
    const chaveSessao = `SESSAO:${token}`;
    const email = await kvSessoes.get(chaveSessao);

    if (!email) return null;

    // Buscar dados atualizados do usuário no KV de Usuários
    const chaveUsuario = email;
    const dadosUsuarioStr = await kvUsuarios.get(chaveUsuario);

    if (!dadosUsuarioStr) return null;

    try {
        const usuario = JSON.parse(dadosUsuarioStr) as DadosUsuario;
        return { email, usuario };
    } catch (e) {
        return null;
    }
}
