export interface DadosUsuario {
    nome: string;
    vencimento: string; // YYYY-MM-DD
    features: string[];
}

export interface RespostaAutenticacao {
    sucesso: boolean;
    mensagem?: string;
    token?: string;
    linkMagico?: string; // Para debug/dev
    idMensagem?: string; // ID do SES
}
