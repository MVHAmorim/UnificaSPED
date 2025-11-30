export const TEMPLATE_LOGIN_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - SPEDito</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: {
                            yellow: '#FACC15', // yellow-400
                            dark: '#1F2937', // gray-800
                        }
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-white h-screen flex items-center justify-center font-sans">

    <div id="app" class="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-2xl border border-gray-100">
        <!-- Carregamento Inicial -->
        <div id="carregamento-inicial" class="text-center">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-yellow mx-auto"></div>
        </div>

        <!-- Tela de Login -->
        <div id="tela-login" class="hidden">
            <div class="text-center">
                <div class="mx-auto h-16 w-16 bg-brand-yellow rounded-full flex items-center justify-center mb-4 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <h2 class="text-3xl font-extrabold text-gray-900 tracking-tight">
                    SPEDito
                </h2>
                <p class="mt-2 text-sm text-gray-500">
                    Acesse sua conta para continuar
                </p>
            </div>

            <form class="mt-8 space-y-6" id="formularioLogin" onsubmit="lidarLogin(event)">
                <div class="rounded-md shadow-sm -space-y-px">
                    <div>
                        <label for="endereco-email" class="sr-only">Endereço de E-mail</label>
                        <input id="endereco-email" name="email" type="email" autocomplete="email" required 
                            class="appearance-none rounded-lg relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-brand-yellow focus:border-brand-yellow focus:z-10 sm:text-sm transition duration-200" 
                            placeholder="seu.email@empresa.com">
                    </div>
                </div>

                <div>
                    <button type="submit" 
                        class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-gray-900 bg-brand-yellow hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-yellow transition duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                        <span class="absolute left-0 inset-y-0 flex items-center pl-3">
                            <svg class="h-5 w-5 text-yellow-700 group-hover:text-yellow-800" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                            </svg>
                        </span>
                        Enviar Link de Acesso
                    </button>
                </div>
            </form>

            <div id="carregando-login" class="hidden text-center">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-yellow mx-auto"></div>
                <p class="mt-4 text-sm text-gray-500">Enviando link mágico...</p>
            </div>

            <div id="mensagem-sucesso" class="hidden text-center bg-green-50 p-4 rounded-lg border border-green-200">
                <svg class="h-12 w-12 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 class="text-lg font-medium text-green-900">Link Enviado!</h3>
                <p class="mt-2 text-sm text-green-600">Verifique sua caixa de entrada e clique no link para acessar.</p>
            </div>
             <div id="mensagem-erro" class="hidden text-center bg-red-50 p-4 rounded-lg border border-red-200 mt-4">
                <p id="texto-erro" class="text-sm text-red-600"></p>
            </div>
        </div>

        <!-- Tela Dashboard (Logado) -->
        <div id="tela-dashboard" class="hidden text-center">
             <div class="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <h2 class="text-2xl font-bold text-gray-900">Bem-vindo!</h2>
            <p class="mt-2 text-gray-600" id="email-usuario"></p>
            <p class="mt-4 text-sm text-gray-500">Você está logado no SPEDito.</p>
            <button onclick="sair()" class="mt-8 text-sm text-red-600 hover:text-red-800 underline">Sair</button>
        </div>
    </div>

    <script>
        async function iniciar() {
            const paramsUrl = new URLSearchParams(window.location.search);
            const token = paramsUrl.get('token');

            if (token) {
                // Verificar token da URL
                await verificarToken(token);
            } else {
                // Tentar verificar sessão (Cookie)
                // Como não temos um endpoint /me ainda, vamos apenas mostrar o login
                // Em um app real, bateríamos em /api/app/me aqui
                mostrarLogin();
            }
        }

        async function verificarToken(token) {
            try {
                const resposta = await fetch(\`/api/autenticacao/verify?token=\${token}\`);
                const dados = await resposta.json();

                if (dados.valido) {
                    // Redireciona para o app real
                    window.location.href = "/app/dashboard"; 
                } else {
                    mostrarLogin();
                }
            } catch (e) {
                console.error(e);
                mostrarLogin();
            }
        }

        function mostrarLogin() {
            document.getElementById('carregamento-inicial').classList.add('hidden');
            document.getElementById('tela-dashboard').classList.add('hidden');
            document.getElementById('tela-login').classList.remove('hidden');
        }

        function mostrarDashboard(email) {
            document.getElementById('carregamento-inicial').classList.add('hidden');
            document.getElementById('tela-login').classList.add('hidden');
            document.getElementById('tela-dashboard').classList.remove('hidden');
            document.getElementById('email-usuario').textContent = email;
        }

        async function lidarLogin(e) {
            e.preventDefault();
            const email = document.getElementById('endereco-email').value;
            const formulario = document.getElementById('formularioLogin');
            const carregando = document.getElementById('carregando-login');
            const sucesso = document.getElementById('mensagem-sucesso');
            const divErro = document.getElementById('mensagem-erro');
            const textoErro = document.getElementById('texto-erro');

            formulario.classList.add('hidden');
            carregando.classList.remove('hidden');
            divErro.classList.add('hidden');

            try {
                const resposta = await fetch('/api/autenticacao/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                
                const dados = await resposta.json();

                if (dados.sucesso) {
                    carregando.classList.add('hidden');
                    sucesso.classList.remove('hidden');
                } else {
                    throw new Error(dados.mensagem || 'Erro ao enviar link');
                }
            } catch (erro) {
                console.error(erro);
                carregando.classList.add('hidden');
                formulario.classList.remove('hidden');
                textoErro.textContent = erro.message;
                divErro.classList.remove('hidden');
            }
        }

        async function sair() {
            await fetch('/api/autenticacao/logout', { method: 'POST' });
            location.reload();
        }

        iniciar();
    </script>
</body>
</html>
`;
