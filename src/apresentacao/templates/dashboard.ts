export const TEMPLATE_DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - UnificaSPED</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
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
    <style>
        .menu-item.active {
            background-color: #FACC15;
            color: #111827;
            font-weight: 700;
        }
        .menu-item:not(.active):hover {
            background-color: #F9FAFB;
        }
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
    </style>
</head>
<body class="bg-gray-50 font-sans text-gray-900 overflow-x-hidden">

    <!-- Mobile Header -->
    <div class="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center fixed w-full z-30 top-0">
        <div class="flex items-center space-x-2">
            <div class="h-8 w-8 bg-brand-yellow rounded-full flex items-center justify-center">
                <i class="fas fa-layer-group text-white text-sm"></i>
            </div>
            <span class="font-bold text-lg text-gray-900">UnificaSPED</span>
        </div>
        <button onclick="toggleSidebarMobile()" class="text-gray-600 hover:text-gray-900 focus:outline-none">
            <i class="fas fa-bars text-xl"></i>
        </button>
    </div>

    <!-- Sidebar -->
    <aside id="sidebar" class="fixed left-0 top-0 h-full bg-white border-r border-gray-200 z-40 transition-all duration-300 ease-in-out w-72 flex flex-col transform -translate-x-full md:translate-x-0 pt-16 md:pt-0 shadow-lg">
        
        <!-- Desktop Header (Logo) -->
        <div class="h-16 flex items-center px-6 border-b border-gray-100 hidden md:flex overflow-hidden whitespace-nowrap shrink-0">
            <div class="h-10 w-10 min-w-[2.5rem] bg-brand-yellow rounded-full flex items-center justify-center shadow-sm z-10">
                <i class="fas fa-layer-group text-white text-lg"></i>
            </div>
            <span id="logo-text" class="font-extrabold text-2xl text-gray-900 tracking-tight ml-3 transition-all duration-300 opacity-100">UnificaSPED</span>
        </div>

        <!-- Menu -->
        <nav id="sidebar-nav" class="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
            
            <!-- Unificação (Item Único e Ativo) -->
            <a href="#" onclick="showSection('unificacao', this); return false;" class="menu-item active flex items-center px-4 py-3 rounded-lg transition-all duration-200 group overflow-hidden whitespace-nowrap" title="Unificação">
                <i class="fas fa-object-group w-6 text-center min-w-[1.5rem] transition-all duration-300 group-hover:scale-110"></i>
                <span class="menu-text ml-3 transition-opacity duration-300 opacity-100 font-medium">Unificação</span>
            </a>

        </nav>

        <!-- User Profile -->
        <div class="p-4 border-t border-gray-100 bg-white shrink-0">
            <div class="flex items-center mb-4 px-2 overflow-hidden whitespace-nowrap transition-all duration-300" id="user-profile-container">
                <div class="h-10 w-10 min-w-[2.5rem] rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">
                    {{INICIAIS}}
                </div>
                <div class="ml-3 overflow-hidden transition-opacity duration-300 opacity-100" id="user-info">
                    <p class="text-sm font-medium text-gray-900 truncate">{{NOME}}</p>
                    <p class="text-xs text-gray-500 truncate">{{EMAIL}}</p>
                </div>
            </div>
            <button onclick="logout()" class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 overflow-hidden whitespace-nowrap group" title="Sair">
                <i class="fas fa-sign-out-alt min-w-[1rem]"></i> 
                <span class="ml-2 transition-opacity duration-300 opacity-100" id="logout-text">Sair</span>
            </button>
        </div>
    </aside>

    <!-- Overlay for mobile -->
    <div id="sidebar-overlay" onclick="toggleSidebarMobile()" class="fixed inset-0 bg-black bg-opacity-50 z-20 hidden md:hidden"></div>

    <!-- Main Content -->
    <main id="main-content" class="flex-1 p-4 md:p-8 pt-20 md:pt-8 min-h-screen transition-all duration-300 ease-in-out md:ml-72">
        
        <!-- Section: Unificação (Default) -->
        <div id="section-unificacao" class="content-section space-y-6">
            <header class="mb-8">
                <h1 class="text-2xl font-bold text-gray-900">UnificaSPED - Central de Unificação Fiscal</h1>
                <p class="text-gray-500">Unifique arquivos da Matriz e Filiais em um único arquivo consolidado.</p>
            </header>

            <div id="drop-zone" class="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center border-dashed border-2 border-gray-300 transition-colors duration-200 cursor-pointer">
                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-600 font-medium">Arraste seus arquivos (Matriz + Filiais) aqui</p>
                <p class="text-xs text-gray-400 mt-2">Mínimo de 2 arquivos (.txt)</p>
                <button id="btn-select-files" class="mt-6 bg-brand-yellow hover:bg-yellow-400 text-gray-900 font-bold py-2 px-6 rounded-lg transition-colors shadow-sm">
                    Selecionar Arquivos
                </button>
                <input type="file" id="file-input" multiple class="hidden" accept=".txt">
            </div>

            <!-- Upload Feedback -->
            <div id="upload-feedback" class="hidden mt-6">
                 <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-center animate-pulse">
                    <i class="fas fa-spinner fa-spin text-blue-500 mr-3 text-xl"></i>
                    <span class="text-blue-700 font-medium">Unificando arquivos... Aguarde.</span>
                 </div>
            </div>

        </div>

    </main>

    <script>
        // --- State ---
        let isSidebarCollapsed = false;

        // --- Elements ---
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const btnSelectFiles = document.getElementById('btn-select-files');
        const uploadFeedback = document.getElementById('upload-feedback');

        // --- Sidebar Logic ---
        function toggleSidebarMobile() {
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar.classList.contains('-translate-x-full')) {
                sidebar.classList.remove('-translate-x-full');
                overlay.classList.remove('hidden');
            } else {
                sidebar.classList.add('-translate-x-full');
                overlay.classList.add('hidden');
            }
        }
        
        function showSection(sectionId, element) {
            // Apenas para manter a compatibilidade se voltarmos o menu
            // Hoje só existe unificacao
        }

        // --- Upload Logic ---

        if (btnSelectFiles && fileInput) {
            btnSelectFiles.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar double trigger se estiver dentro do dropzone
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFiles(e.target.files);
                }
            });
        }

        if (dropZone) {
            dropZone.addEventListener('click', () => fileInput.click()); // Clique no box abre select
            
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-brand-yellow', 'bg-yellow-50');
            });

            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-brand-yellow', 'bg-yellow-50');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-brand-yellow', 'bg-yellow-50');
                if (e.dataTransfer.files.length > 0) {
                    handleFiles(e.dataTransfer.files);
                }
            });
        }

        async function handleFiles(files) {
            if (files.length < 2) {
                alert('Selecione pelo menos 2 arquivos (Matriz e Filial).');
                return;
            }

            if (uploadFeedback) uploadFeedback.classList.remove('hidden');
            if (dropZone) dropZone.classList.add('opacity-50', 'pointer-events-none');

            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files[]', files[i]);
            }

            try {
                const response = await fetch('/app/unificacao', { // Rota do App ou API? app.ts define /unificacao POST?
                    // app.ts: app.post("/unificacao", ...) dentro do grupo /app?
                    // Se app.route("/app", appRoutes), entao POST /app/unificacao
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    // É um download de arquivo (stream)
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    // Tentar pegar nome do arquivo do header?
                    const disposition = response.headers.get('Content-Disposition');
                    let filename = 'Unificado.txt';
                    if (disposition && disposition.indexOf('filename=') !== -1) {
                        const match = disposition.match(/filename="?([^"]+)"?/);
                         if (match && match[1]) filename = match[1];
                    }
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                    
                    alert('Unificação concluída com sucesso!');
                    if(fileInput) fileInput.value = '';
                } else {
                    const result = await response.json().catch(() => ({ erro: 'Erro desconhecido' }));
                    alert('Erro: ' + (result.erro || response.statusText));
                }
            } catch (error) {
                console.error('Erro no upload:', error);
                alert('Erro de conexão ao enviar arquivos.');
            } finally {
                if (uploadFeedback) uploadFeedback.classList.add('hidden');
                if (dropZone) dropZone.classList.remove('opacity-50', 'pointer-events-none');
            }
        }

        async function logout() {
            try {
                await fetch('/api/autenticacao/logout', { method: 'POST' });
                window.location.href = '/';
            } catch (error) {
                console.error('Erro ao sair:', error);
                alert('Erro ao tentar sair. Tente novamente.');
            }
        }

    </script>
</body>
</html>
`;