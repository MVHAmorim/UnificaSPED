import { DadosUsuario } from "../dominios/usuario";

export interface Ambiente {
    UsuariosSpedito: KVNamespace;
    SessoesSpedito: KVNamespace;
    ProjetosSpedito: KVNamespace;
    ARQUIVOS_USUARIOS: R2Bucket;
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    SES_FROM_EMAIL: string;
}

export interface Variaveis {
    usuario: DadosUsuario;
    email: string;
}
