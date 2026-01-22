export const TEMPLATE_DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - SPED Unifier</title>
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
        /* Hide scrollbar for clean look */
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
        
        /* Submenu Transitions */
        .submenu {
            transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
            max-height: 0;
            opacity: 0;
            overflow: hidden;
        }
        .submenu.open {
            max-height: 500px; /* Arbitrary large height */
            opacity: 1;
        }

        /* Sidebar Collapsed Hover Logic */
        /* CRITICAL: Force display block on hover only when sidebar has 'collapsed' class */
        #sidebar.collapsed .menu-group:hover .submenu-flyout {
            display: block !important;
            animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-10px); }
            to { opacity: 1; transform: translateX(0); }
        }

        @media print {
            #sidebar, header, #sidebar-toggle-btn, .no-print {
                display: none !important;
            }
            #main-content {
                margin-left: 0 !important;
                padding: 0 !important;
            }
            .content-section {
                display: block !important; /* Força exibir o relatório mesmo se escondido via JS */
            }
            body > :not(#main-content) {
                display: none;
            }
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
    </style>
</head>
<body class="bg-gray-50 font-sans text-gray-900 overflow-x-hidden">

    <!-- Mobile Header -->
    <div class="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center fixed w-full z-30 top-0">
        <div class="flex items-center space-x-2">
            <div class="h-8 w-8 bg-brand-yellow rounded-full flex items-center justify-center">
                <i class="fas fa-bolt text-white text-sm"></i>
            </div>
            <span class="font-bold text-lg text-gray-900">SPED Unifier</span>
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
                <i class="fas fa-bolt text-white text-lg"></i>
            </div>
            <span id="logo-text" class="font-extrabold text-2xl text-gray-900 tracking-tight ml-3 transition-all duration-300 opacity-100">SPED Unifier</span>
        </div>

        <!-- Toggle Button (Desktop) -->
        <button onclick="toggleSidebarDesktop()" class="hidden md:flex absolute -right-3 top-20 bg-white border border-gray-200 rounded-full h-6 w-6 items-center justify-center text-gray-500 hover:text-brand-yellow hover:border-brand-yellow shadow-sm focus:outline-none z-50 transition-transform duration-300" id="sidebar-toggle-btn">
            <i class="fas fa-chevron-left text-xs transition-transform duration-300" id="sidebar-toggle-icon"></i>
        </button>

        <!-- Menu -->
        <nav id="sidebar-nav" class="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
            
            <!-- 1. Visão Geral (Link Direto) -->
            <a href="#" onclick="showSection('overview', this); return false;" class="menu-item active flex items-center px-4 py-3 rounded-lg transition-all duration-200 group overflow-hidden whitespace-nowrap" title="Visão Geral">
                <i class="fas fa-chart-pie w-6 text-center min-w-[1.5rem] transition-all duration-300 group-hover:scale-110"></i>
                <span class="menu-text ml-3 transition-opacity duration-300 opacity-100 font-medium">Visão Geral</span>
            </a>

            <!-- 2. Unificação (Novo Item) -->
            <a href="#" onclick="showSection('unificacao', this); return false;" class="menu-item flex items-center px-4 py-3 rounded-lg transition-all duration-200 group overflow-hidden whitespace-nowrap" title="Unificação">
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
        
        <!-- Section: Visão Geral -->
        <div id="section-overview" class="content-section space-y-6">
            <header class="flex justify-between items-center mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900">Visão Geral</h1>
                    <p class="text-gray-500">Bem-vindo de volta, {{NOME}}.</p>
                </div>
                <button onclick="openProjectModal()" class="bg-brand-yellow hover:bg-yellow-300 text-gray-900 font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">
                    <i class="fas fa-plus mr-2"></i> Novo Projeto
                </button>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-gray-500 text-sm font-medium">Projetos Ativos</h3>
                        <span class="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">Atualizado</span>
                    </div>
                    <p class="text-3xl font-bold text-gray-900">0</p>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-gray-500 text-sm font-medium">Arquivos Unificados</h3>
                        <i class="fas fa-file-alt text-gray-400"></i>
                    </div>
                    <p class="text-3xl font-bold text-gray-900">0</p>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-gray-500 text-sm font-medium">Economia de Tempo</h3>
                        <i class="fas fa-chart-line text-green-500"></i>
                    </div>
                    <p class="text-3xl font-bold text-gray-900">0h</p>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">Atividade Recente</h3>
                <div class="space-y-4">
                   <p class="text-gray-500 text-sm">Nenhuma atividade recente encontrada.</p>
                </div>
            </div>
        </div>

        <!-- Section: Unificação (Novo) -->
        <div id="section-unificacao" class="content-section hidden space-y-6">
            <h1 class="text-2xl font-bold text-gray-900 mb-6">Unificação de Arquivos</h1>
            <p class="text-gray-600">Selecione os arquivos SPED para iniciar o processo de unificação.</p>
        </div>

    </main>

    <!-- Modal Novo Projeto -->
    <div id="modal-novo-projeto" class="fixed inset-0 z-50 hidden overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onclick="closeProjectModal()"></div>
            <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div class="sm:flex sm:items-start">
                        <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                            <i class="fas fa-folder-plus text-yellow-600"></i>
                        </div>
                        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">Novo Projeto</h3>
                            <div class="mt-2 space-y-4">
                                <div>
                                    <label for="projeto-nome" class="block text-sm font-medium text-gray-700">Nome do Cliente/Projeto</label>
                                    <input type="text" name="projeto-nome" id="projeto-nome" class="mt-1 focus:ring-brand-yellow focus:border-brand-yellow block w-full shadow-sm sm:text-sm border-gray-300 rounded-md border p-2" placeholder="Ex: Indústria ABC Ltda">
                                </div>
                                <div>
                                    <label for="projeto-cnpj" class="block text-sm font-medium text-gray-700">CNPJ</label>
                                    <input type="text" name="projeto-cnpj" id="projeto-cnpj" class="mt-1 focus:ring-brand-yellow focus:border-brand-yellow block w-full shadow-sm sm:text-sm border-gray-300 rounded-md border p-2" placeholder="00.000.000/0000-00">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button type="button" onclick="criarProjeto()" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-brand-yellow text-base font-medium text-gray-900 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-yellow sm:ml-3 sm:w-auto sm:text-sm">
                        Criar Projeto
                    </button>
                    <button type="button" onclick="closeProjectModal()" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // --- Utils ---
        const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

        // --- State ---
        let isSidebarCollapsed = false;

        // --- Elements ---
        const sidebar = document.getElementById('sidebar');
        const sidebarNav = document.getElementById('sidebar-nav');
        const mainContent = document.getElementById('main-content');
        const logoText = document.getElementById('logo-text');
        const menuTexts = document.querySelectorAll('.menu-text');
        const userInfo = document.getElementById('user-info');
        const logoutText = document.getElementById('logout-text');
        const toggleIcon = document.getElementById('sidebar-toggle-icon');

        // --- Sidebar Logic ---

        function initSidebar() {
            const savedState = localStorage.getItem('sidebarCollapsed');
            if (savedState === 'true') {
                setSidebarState(true);
            }
        }

        function setSidebarState(collapsed) {
            isSidebarCollapsed = collapsed;
            localStorage.setItem('sidebarCollapsed', collapsed);

            if (collapsed) {
                // Collapse
                sidebar.classList.remove('w-72');
                sidebar.classList.add('w-20');
                sidebar.classList.add('collapsed'); 
                sidebarNav.classList.remove('overflow-y-auto');
                sidebarNav.classList.add('overflow-visible');
                mainContent.classList.remove('md:ml-72');
                mainContent.classList.add('md:ml-20');
                logoText.classList.add('opacity-0', 'w-0');
                logoText.classList.remove('ml-3');
                menuTexts.forEach(el => el.classList.add('opacity-0', 'w-0', 'hidden'));
                userInfo.classList.add('opacity-0', 'w-0', 'hidden');
                logoutText.classList.add('opacity-0', 'w-0', 'hidden');
                toggleIcon.classList.add('rotate-180');
                closeAllSubmenus();
            } else {
                // Expand
                sidebar.classList.remove('w-20');
                sidebar.classList.add('w-72');
                sidebar.classList.remove('collapsed');
                sidebarNav.classList.add('overflow-y-auto');
                sidebarNav.classList.remove('overflow-visible');
                mainContent.classList.remove('md:ml-72');
                mainContent.classList.add('md:ml-72');
                logoText.classList.remove('opacity-0', 'w-0');
                logoText.classList.add('ml-3');
                menuTexts.forEach(el => el.classList.remove('opacity-0', 'w-0', 'hidden'));
                userInfo.classList.remove('opacity-0', 'w-0', 'hidden');
                logoutText.classList.remove('opacity-0', 'w-0', 'hidden');
                toggleIcon.classList.remove('rotate-180');
            }
        }

        function toggleSidebarDesktop() {
            setSidebarState(!isSidebarCollapsed);
        }

        function closeAllSubmenus() {
            document.querySelectorAll('.submenu').forEach(el => el.classList.remove('open'));
            // document.querySelectorAll('.menu-arrow').forEach(el => el.classList.remove('rotate-180'));
        }

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

        // --- Navigation Logic ---

        function showSection(sectionId, element) {
            document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));
            
            const target = document.getElementById('section-' + sectionId);
            if (target) {
                target.classList.remove('hidden');
            } else {
                console.error('Section not found:', sectionId);
            }
            
            document.querySelectorAll('.menu-item').forEach(el => {
                el.classList.remove('active', 'bg-brand-yellow', 'text-gray-900', 'font-bold');
            });
            
            if (element) {
                element.classList.add('active');
            }
            
            if (window.innerWidth < 768) {
                toggleSidebarMobile();
            }
        }

        // --- Project Management ---

        function openProjectModal() {
            document.getElementById('modal-novo-projeto').classList.remove('hidden');
            const input = document.getElementById('projeto-nome');
            if(input) input.focus();
        }

        function closeProjectModal() {
            document.getElementById('modal-novo-projeto').classList.add('hidden');
            document.getElementById('projeto-nome').value = '';
            document.getElementById('projeto-cnpj').value = '';
        }

        async function criarProjeto() {
            const nome = document.getElementById('projeto-nome').value;
            const cnpj = document.getElementById('projeto-cnpj').value;

            if (!nome || !cnpj) {
                alert('Por favor, preencha todos os campos.');
                return;
            }

            try {
                const response = await fetch('/api/app/projetos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, cnpj })
                });

                if (response.ok) {
                    const projeto = await response.json();
                    closeProjectModal();
                    await carregarProjetos();
                    alert('Projeto criado com sucesso!');
                } else {
                    const err = await response.json();
                    alert('Erro ao criar projeto: ' + (err.erro || 'Erro desconhecido'));
                }
            } catch (error) {
                console.error('Erro:', error);
                alert('Erro de conexão ao criar projeto.');
            }
        }

        async function carregarProjetos() {
            try {
                const response = await fetch('/api/app/projetos');
                if (response.ok) {
                    const projetos = await response.json();
                    // Just simple load for now, might be used in potential selects later
                    console.log('Projetos carregados:', projetos.length);
                }
            } catch (error) {
                console.error('Erro ao carregar projetos:', error);
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

        document.addEventListener('DOMContentLoaded', () => {
            initSidebar();
            carregarProjetos();
        });

    </script>
</body>
</html>
`;