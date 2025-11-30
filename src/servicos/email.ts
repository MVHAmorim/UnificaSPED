import { AwsClient } from "aws4fetch";

export interface ConfiguracaoEmail {
    regiao: string;
    idChaveAcesso: string;
    chaveAcessoSecreta: string;
    emailRemetente: string;
}

export interface ResultadoEnvioEmail {
    sucesso: boolean;
    erro?: string;
}

export async function enviarLinkMagico(paraEmail: string, linkMagico: string, config: ConfiguracaoEmail): Promise<ResultadoEnvioEmail> {
    const aws = new AwsClient({
        accessKeyId: config.idChaveAcesso,
        secretAccessKey: config.chaveAcessoSecreta,
        region: config.regiao,
        service: "ses",
    });

    const assunto = "Seu Link de Acesso - Spedito";
    const corpoHtml = `
        <html>
        <body style="font-family: sans-serif; color: #1F2937; background-color: #F3F4F6; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="display: inline-block; width: 50px; height: 50px; background-color: #FACC15; border-radius: 50%; line-height: 50px; font-size: 24px; color: white; font-weight: bold;">
                        SP
                    </div>
                    <h2 style="margin-top: 10px; color: #111827;">Bem-vindo ao Spedito</h2>
                </div>
                
                <p style="font-size: 16px; line-height: 1.5;">Olá,</p>
                <p style="font-size: 16px; line-height: 1.5;">Clique no botão abaixo para acessar sua conta de forma segura:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${linkMagico}" style="background-color: #FACC15; color: #1F2937; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                        Acessar Sistema
                    </a>
                </div>
                
                <p style="font-size: 14px; color: #6B7280; margin-top: 30px; text-align: center;">
                    Se você não solicitou este acesso, por favor ignore este e-mail.
                </p>
            </div>
        </body>
        </html>
    `;

    // SES V2 API - SendEmail
    const url = `https://email.${config.regiao}.amazonaws.com/v2/email/outbound-emails`;

    const payload = {
        FromEmailAddress: config.emailRemetente,
        Destination: {
            ToAddresses: [paraEmail]
        },
        Content: {
            Simple: {
                Subject: {
                    Data: assunto,
                    Charset: "UTF-8"
                },
                Body: {
                    Html: {
                        Data: corpoHtml,
                        Charset: "UTF-8"
                    }
                }
            }
        }
    };

    try {
        const resposta = await aws.fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!resposta.ok) {
            const textoErro = await resposta.text();
            console.error("Erro ao enviar email SES:", resposta.status, textoErro);
            return { sucesso: false, erro: `Erro AWS SES (${resposta.status}): ${textoErro}` };
        }

        const dados = await resposta.json() as { MessageId: string };
        console.log("Email enviado com sucesso. MessageId:", dados.MessageId);
        return { sucesso: true, erro: `Enviado! ID: ${dados.MessageId}` };
    } catch (erro) {
        console.error("Exceção ao enviar email:", erro);
        return { sucesso: false, erro: `Exceção: ${(erro as Error).message}` };
    }
}
