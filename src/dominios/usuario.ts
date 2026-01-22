export interface DadosUsuario {
    nome: string;
    vencimento: string; // YYYY-MM-DD
    features: string[];
    consumo?: Record<string, number>; // YYYY-MM -> qtde
}

export interface RespostaAutenticacao {
    sucesso: boolean;
    mensagem?: string;
    token?: string;
    linkMagico?: string; // Para debug/dev
    idMensagem?: string; // ID do SES
}
