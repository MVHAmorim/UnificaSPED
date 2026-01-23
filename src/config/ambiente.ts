import { DadosUsuario } from "../dominios/usuario";

export interface Ambiente {
    UNIFICASPED_USUARIOS: KVNamespace;
    UNIFICASPED_SESSOES: KVNamespace;
    ProjetosSpedito: KVNamespace;
    ARQUIVOS_USUARIOS: R2Bucket;
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    SES_FROM_EMAIL: string;
    ASAAS_API_KEY: string;
    ASAAS_WEBHOOK_TOKEN: string;
    ASAAS_URL: string;
}

export interface Variaveis {
    usuario: DadosUsuario;
    email: string;
}
