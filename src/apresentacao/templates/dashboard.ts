export const TEMPLATE_DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - SPEDito</title>
    <script src="https://cdn.tailwindcss.com"></script>
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
        /* When sidebar has class 'collapsed', submenus behave differently */
        #sidebar.collapsed .menu-group:hover .submenu-flyout {
            display: block;
            animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-10px); }
            to { opacity: 1; transform: translateX(0); }
        }
    </style>
</head>
<body class="bg-gray-50 font-sans text-gray-900 overflow-x-hidden">

    <!-- Mobile Header -->
    <div class="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center fixed w-full z-20 top-0">
        <div class="flex items-center space-x-2">
            <div class="h-8 w-8 bg-brand-yellow rounded-full flex items-center justify-center">
                <i class="fas fa-bolt text-white text-sm"></i>
            </div>
            <span class="font-bold text-lg text-gray-900">SPEDito</span>
        </div>
        <button onclick="toggleSidebarMobile()" class="text-gray-600 hover:text-gray-900 focus:outline-none">
            <i class="fas fa-bars text-xl"></i>
        </button>
    </div>

    <!-- Sidebar -->
    <aside id="sidebar" class="fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-30 transition-all duration-300 ease-in-out w-72 flex flex-col transform -translate-x-full md:translate-x-0 pt-16 md:pt-0">
        
        <!-- Desktop Header (Logo) -->
        <div class="h-16 flex items-center px-6 border-b border-gray-100 hidden md:flex overflow-hidden whitespace-nowrap">
            <div class="h-10 w-10 min-w-[2.5rem] bg-brand-yellow rounded-full flex items-center justify-center shadow-sm z-10">
                <i class="fas fa-bolt text-white text-lg"></i>
            </div>
            <span id="logo-text" class="font-extrabold text-2xl text-gray-900 tracking-tight ml-3 transition-all duration-300 opacity-100">SPEDito</span>
        </div>

        <!-- Toggle Button (Desktop) -->
        <button onclick="toggleSidebarDesktop()" class="hidden md:flex absolute -right-3 top-20 bg-white border border-gray-200 rounded-full h-6 w-6 items-center justify-center text-gray-500 hover:text-brand-yellow hover:border-brand-yellow shadow-sm focus:outline-none z-50 transition-transform duration-300" id="sidebar-toggle-btn">
            <i class="fas fa-chevron-left text-xs transition-transform duration-300" id="sidebar-toggle-icon"></i>
        </button>

        <!-- Menu -->
        <nav class="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
            
            <!-- 1. Visão Geral (Link Direto) -->
            <a href="#" onclick="showSection('overview', this)" class="menu-item active flex items-center px-4 py-3 rounded-lg transition-all duration-200 group overflow-hidden whitespace-nowrap" title="Visão Geral">
                <i class="fas fa-chart-pie w-6 text-center min-w-[1.5rem] transition-all duration-300 group-hover:scale-110"></i>
                <span class="menu-text ml-3 transition-opacity duration-300 opacity-100 font-medium">Visão Geral</span>
            </a>

            <!-- 2. COLETA (Accordion/Flyout) -->
            <div class="menu-group relative">
                <!-- Parent Item -->
                <div onclick="toggleSubmenu('submenu-coleta')" class="menu-parent cursor-pointer flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-all duration-200 group overflow-hidden whitespace-nowrap justify-between" title="Coleta">
                    <div class="flex items-center">
                        <i class="fas fa-cloud-upload-alt w-6 text-center min-w-[1.5rem] transition-all duration-300 group-hover:scale-110"></i>
                        <span class="menu-text ml-3 transition-opacity duration-300 opacity-100 font-medium">Coleta</span>
                    </div>
                    <i class="fas fa-chevron-down text-xs text-gray-400 transition-transform duration-300 menu-arrow"></i>
                </div>
                
                <!-- Submenu (Accordion Mode) -->
                <div id="submenu-coleta" class="submenu bg-gray-50 rounded-lg mt-1 overflow-hidden">
                    <a href="#" onclick="showSection('xmls', this)" class="block px-4 py-2 pl-12 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Central de Arquivos</a>
                </div>

                <!-- Submenu (Flyout Mode - Hidden by default, shown via CSS on hover when collapsed) -->
                <div class="submenu-flyout hidden absolute left-16 top-0 w-56 bg-white shadow-xl rounded-r-lg border border-gray-100 z-50 py-2">
                    <div class="px-4 py-2 border-b border-gray-50 font-bold text-gray-900 bg-gray-50 rounded-tr-lg">Coleta</div>
                    <a href="#" onclick="showSection('xmls', this)" class="block px-4 py-2 text-sm text-gray-600 hover:text-brand-yellow hover:bg-gray-50">Central de Arquivos</a>
                </div>
            </div>

            <!-- 3. INTELIGÊNCIA (Accordion/Flyout) -->
            <div class="menu-group relative">
                <div onclick="toggleSubmenu('submenu-inteligencia')" class="menu-parent cursor-pointer flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-all duration-200 group overflow-hidden whitespace-nowrap justify-between" title="Inteligência">
                    <div class="flex items-center">
                        <i class="fas fa-brain w-6 text-center min-w-[1.5rem] transition-all duration-300 group-hover:scale-110"></i>
                        <span class="menu-text ml-3 transition-opacity duration-300 opacity-100 font-medium">Inteligência</span>
                    </div>
                    <i class="fas fa-chevron-down text-xs text-gray-400 transition-transform duration-300 menu-arrow"></i>
                </div>
                
                <div id="submenu-inteligencia" class="submenu bg-gray-50 rounded-lg mt-1 overflow-hidden">
                    <a href="#" onclick="showSection('correlation', this)" class="block px-4 py-2 pl-12 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Correlações</a>
                    <a href="#" onclick="showSection('tax-map', this)" class="block px-4 py-2 pl-12 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Mapa Tributário</a>
                </div>

                <div class="submenu-flyout hidden absolute left-16 top-0 w-56 bg-white shadow-xl rounded-r-lg border border-gray-100 z-50 py-2">
                    <div class="px-4 py-2 border-b border-gray-50 font-bold text-gray-900 bg-gray-50 rounded-tr-lg">Inteligência</div>
                    <a href="#" onclick="showSection('correlation', this)" class="block px-4 py-2 text-sm text-gray-600 hover:text-brand-yellow hover:bg-gray-50">Correlações</a>
                    <a href="#" onclick="showSection('tax-map', this)" class="block px-4 py-2 text-sm text-gray-600 hover:text-brand-yellow hover:bg-gray-50">Mapa Tributário</a>
                </div>
            </div>

            <!-- 4. AUDITORIA (Accordion/Flyout) -->
            <div class="menu-group relative">
                <div onclick="toggleSubmenu('submenu-auditoria')" class="menu-parent cursor-pointer flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-all duration-200 group overflow-hidden whitespace-nowrap justify-between" title="Auditoria">
                    <div class="flex items-center">
                        <i class="fas fa-clipboard-check w-6 text-center min-w-[1.5rem] transition-all duration-300 group-hover:scale-110"></i>
                        <span class="menu-text ml-3 transition-opacity duration-300 opacity-100 font-medium">Auditoria</span>
                    </div>
                    <i class="fas fa-chevron-down text-xs text-gray-400 transition-transform duration-300 menu-arrow"></i>
                </div>
                
                <div id="submenu-auditoria" class="submenu bg-gray-50 rounded-lg mt-1 overflow-hidden">
                    <a href="#" onclick="showSection('audit', this)" class="block px-4 py-2 pl-12 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Cruzamento XML/SPED</a>
                    <a href="#" onclick="showSection('stock', this)" class="block px-4 py-2 pl-12 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Auditoria de Estoque</a>
                </div>

                <div class="submenu-flyout hidden absolute left-16 top-0 w-56 bg-white shadow-xl rounded-r-lg border border-gray-100 z-50 py-2">
                    <div class="px-4 py-2 border-b border-gray-50 font-bold text-gray-900 bg-gray-50 rounded-tr-lg">Auditoria</div>
                    <a href="#" onclick="showSection('audit', this)" class="block px-4 py-2 text-sm text-gray-600 hover:text-brand-yellow hover:bg-gray-50">Cruzamento XML/SPED</a>
                    <a href="#" onclick="showSection('stock', this)" class="block px-4 py-2 text-sm text-gray-600 hover:text-brand-yellow hover:bg-gray-50">Auditoria de Estoque</a>
                </div>
            </div>

            <!-- 5. ESTRATÉGIA (Accordion/Flyout) -->
            <div class="menu-group relative">
                <div onclick="toggleSubmenu('submenu-estrategia')" class="menu-parent cursor-pointer flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-all duration-200 group overflow-hidden whitespace-nowrap justify-between" title="Estratégia">
                    <div class="flex items-center">
                        <i class="far fa-gem w-6 text-center min-w-[1.5rem] text-brand-yellow transition-all duration-300 group-hover:scale-110"></i>
                        <span class="menu-text ml-3 transition-opacity duration-300 opacity-100 font-medium">Estratégia</span>
                    </div>
                    <i class="fas fa-chevron-down text-xs text-gray-400 transition-transform duration-300 menu-arrow"></i>
                </div>
                
                <div id="submenu-estrategia" class="submenu bg-gray-50 rounded-lg mt-1 overflow-hidden">
                    <a href="#" onclick="showSection('strategy', this)" class="block px-4 py-2 pl-12 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Riscos & Oportunidades</a>
                </div>

                <div class="submenu-flyout hidden absolute left-16 top-0 w-56 bg-white shadow-xl rounded-r-lg border border-gray-100 z-50 py-2">
                    <div class="px-4 py-2 border-b border-gray-50 font-bold text-gray-900 bg-gray-50 rounded-tr-lg">Estratégia</div>
                    <a href="#" onclick="showSection('strategy', this)" class="block px-4 py-2 text-sm text-gray-600 hover:text-brand-yellow hover:bg-gray-50">Riscos & Oportunidades</a>
                </div>
            </div>

        </nav>

        <!-- User Profile -->
        <div class="p-4 border-t border-gray-100 bg-white">
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
                <button class="bg-brand-yellow hover:bg-yellow-300 text-gray-900 font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">
                    <i class="fas fa-plus mr-2"></i> Novo Projeto
                </button>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-gray-500 text-sm font-medium">Projetos Ativos</h3>
                        <span class="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">Atualizado</span>
                    </div>
                    <p class="text-3xl font-bold text-gray-900">12</p>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-gray-500 text-sm font-medium">Arquivos Processados</h3>
                        <i class="fas fa-file-alt text-gray-400"></i>
                    </div>
                    <p class="text-3xl font-bold text-gray-900">1,248</p>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-gray-500 text-sm font-medium">Economia Gerada</h3>
                        <i class="fas fa-chart-line text-green-500"></i>
                    </div>
                    <p class="text-3xl font-bold text-gray-900">R$ 45.2k</p>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">Atividade Recente</h3>
                <div class="space-y-4">
                    <div class="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div class="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-4">
                            <i class="fas fa-upload"></i>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-900">Upload de SPED Fiscal - Competência 10/2024</p>
                            <p class="text-xs text-gray-500">Há 2 horas</p>
                        </div>
                    </div>
                    <div class="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div class="h-10 w-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-4">
                            <i class="fas fa-check"></i>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-900">Correlação Automática Finalizada</p>
                            <p class="text-xs text-gray-500">Há 5 horas</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Section: Central de Arquivos -->
        <div id="section-xmls" class="content-section hidden space-y-6">
            <h1 class="text-2xl font-bold text-gray-900 mb-6">Central de Arquivos</h1>
            <div class="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center border-dashed border-2 border-gray-300">
                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-600">Arraste seus arquivos XML ou TXT aqui</p>
                <button class="mt-4 bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors">
                    Selecionar Arquivos
                </button>
            </div>
        </div>

        <!-- Section: Correlação -->
        <div id="section-correlation" class="content-section hidden space-y-6">
            <h1 class="text-2xl font-bold text-gray-900 mb-6">Correlações & Fatores</h1>
            <p class="text-gray-600">Módulo de correlação de itens e fatores de conversão.</p>
        </div>

        <!-- Section: Mapa Tributário -->
        <div id="section-tax-map" class="content-section hidden space-y-6">
            <h1 class="text-2xl font-bold text-gray-900 mb-6">Mapa Tributário</h1>
            <p class="text-gray-600">Configuração de regras tributárias e exceções.</p>
        </div>

        <!-- Section: Cruzamento XML x SPED -->
        <div id="section-audit" class="content-section hidden space-y-6">
            <h1 class="text-2xl font-bold text-gray-900 mb-6">Cruzamento XML x SPED</h1>
            <p class="text-gray-600">Auditoria de divergências entre notas fiscais e escrituração.</p>
        </div>

        <!-- Section: Auditoria de Estoque -->
        <div id="section-stock" class="content-section hidden space-y-6">
            <h1 class="text-2xl font-bold text-gray-900 mb-6">Auditoria de Estoque</h1>
            <p class="text-gray-600">Análise do Bloco K e Inventário.</p>
        </div>

        <!-- Section: Estratégia -->
        <div id="section-strategy" class="content-section hidden space-y-6">
            <h1 class="text-2xl font-bold text-gray-900 mb-6">Riscos & Oportunidades</h1>
            <p class="text-gray-600">Dashboard estratégico de compliance e recuperação de créditos.</p>
        </div>

        <!-- Section: Configurações -->
        <div id="section-settings" class="content-section hidden space-y-6">
            <h1 class="text-2xl font-bold text-gray-900 mb-6">Configurações</h1>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-2xl">
                <h3 class="text-lg font-medium text-gray-900 mb-4">Perfil</h3>
                <div class="grid grid-cols-1 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Nome</label>
                        <input type="text" value="{{NOME}}" disabled class="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 px-3 py-2">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" value="{{EMAIL}}" disabled class="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 px-3 py-2">
                    </div>
                </div>
            </div>
        </div>

    </main>

    <script>
        // State
        let isSidebarCollapsed = false;

        // Elements
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        const logoText = document.getElementById('logo-text');
        const menuTexts = document.querySelectorAll('.menu-text');
        const menuArrows = document.querySelectorAll('.menu-arrow');
        const userInfo = document.getElementById('user-info');
        const logoutText = document.getElementById('logout-text');
        const toggleIcon = document.getElementById('sidebar-toggle-icon');

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
                sidebar.classList.add('collapsed'); // Marker for CSS
                
                mainContent.classList.remove('md:ml-72');
                mainContent.classList.add('md:ml-20');

                // Hide Texts
                logoText.classList.add('opacity-0', 'w-0');
                logoText.classList.remove('ml-3');
                
                menuTexts.forEach(el => el.classList.add('opacity-0', 'w-0', 'hidden'));
                menuArrows.forEach(el => el.classList.add('hidden')); // Hide accordion arrows
                
                userInfo.classList.add('opacity-0', 'w-0', 'hidden');
                logoutText.classList.add('opacity-0', 'w-0', 'hidden');

                // Rotate Icon
                toggleIcon.classList.add('rotate-180');
                
                // Close all open submenus to prevent visual bugs
                closeAllSubmenus();

            } else {
                // Expand
                sidebar.classList.remove('w-20');
                sidebar.classList.add('w-72');
                sidebar.classList.remove('collapsed');
                
                mainContent.classList.remove('md:ml-20');
                mainContent.classList.add('md:ml-72');

                // Show Texts
                logoText.classList.remove('opacity-0', 'w-0');
                logoText.classList.add('ml-3');
                
                menuTexts.forEach(el => el.classList.remove('opacity-0', 'w-0', 'hidden'));
                menuArrows.forEach(el => el.classList.remove('hidden'));
                
                userInfo.classList.remove('opacity-0', 'w-0', 'hidden');
                logoutText.classList.remove('opacity-0', 'w-0', 'hidden');

                // Rotate Icon Back
                toggleIcon.classList.remove('rotate-180');
            }
        }

        function toggleSidebarDesktop() {
            setSidebarState(!isSidebarCollapsed);
        }

        function toggleSubmenu(submenuId) {
            // Only work if sidebar is expanded
            if (isSidebarCollapsed) return;

            const submenu = document.getElementById(submenuId);
            const parent = submenu.previousElementSibling;
            const arrow = parent.querySelector('.menu-arrow');

            if (submenu.classList.contains('open')) {
                submenu.classList.remove('open');
                arrow.classList.remove('rotate-180');
            } else {
                // Optional: Close other submenus (Accordion behavior)
                // closeAllSubmenus(); 
                
                submenu.classList.add('open');
                arrow.classList.add('rotate-180');
            }
        }

        function closeAllSubmenus() {
            document.querySelectorAll('.submenu').forEach(el => el.classList.remove('open'));
            document.querySelectorAll('.menu-arrow').forEach(el => el.classList.remove('rotate-180'));
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

        function showSection(sectionId, element) {
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));
            
            // Show selected section
            document.getElementById('section-' + sectionId).classList.remove('hidden');
            
            // Reset active states
            document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active', 'bg-brand-yellow', 'text-gray-900', 'font-bold'));
            document.querySelectorAll('.menu-item').forEach(el => el.classList.add('text-gray-600'));
            
            // Highlight current item (if it's a direct link)
            if (element.classList.contains('menu-item')) {
                element.classList.add('active');
                element.classList.remove('text-gray-600');
            }
            
            // Close sidebar on mobile after selection
            if (window.innerWidth < 768) {
                toggleSidebarMobile();
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

        // Initialize on load
        initSidebar();
    </script>
</body>
</html>
`;