// script.js
// ===========================================
// CONFIGURAÇÃO E INICIALIZAÇÃO
// ===========================================

class FinanceApp {
    constructor() {
        this.firebaseConfig = {
            apiKey: "AIzaSyAmA2N4mzTXHch7Jn9hRwYuPlggrRKuhsE",
            authDomain: "contas-a-pagar-sksb.firebaseapp.com",
            databaseURL: "https://contas-a-pagar-sksb-default-rtdb.firebaseio.com",
            projectId: "contas-a-pagar-sksb",
            storageBucket: "contas-a-pagar-sksb.firebasestorage.app",
            messagingSenderId: "973753818928",
            appId: "1:973753818928:web:23b36f5fe8aaa1a0fef2f5",
            measurementId: "G-3HEB0S3X12"
        };

        this.db = null;
        this.gastosCollection = null;
        this.saldosCollection = null;
        this.gastosUnsubscribe = null;
        this.saldosUnsubscribe = null;
        
        this.charts = {
            gastos: null,
            evolucaoSalario: null,
            categorias: null
        };

        this.data = {
            gastos: [],
            saldos: []
        };

        this.init();
    }

    init() {
        this.initializeFirebase();
        this.setupEventListeners();
        this.setupDefaultDates();
        this.setupTheme();
        this.populateYearFilters();
        feather.replace();
    }

    // ===========================================
    // FIREBASE
    // ===========================================

    initializeFirebase() {
        try {
            firebase.initializeApp(this.firebaseConfig);
            this.db = firebase.firestore();
            this.gastosCollection = this.db.collection('gastos');
            this.saldosCollection = this.db.collection('saldos');
            
            this.startListeners();
            this.updateFirebaseStatus(true);
            
            console.log('✅ Conectado ao Firebase com sucesso!');
        } catch (error) {
            console.error('Erro ao conectar ao Firebase:', error);
            this.updateFirebaseStatus(false);
        }
    }

    startListeners() {
        // Listener para gastos
        this.gastosUnsubscribe = this.gastosCollection
            .orderBy('data', 'desc')
            .onSnapshot((snapshot) => {
                this.data.gastos = [];
                snapshot.forEach(doc => {
                    this.data.gastos.push({ id: doc.id, ...doc.data() });
                });
                this.applyFilters();
                this.updateCharts();
                this.updateDashboard();
            }, (error) => {
                console.error('Erro ao carregar gastos:', error);
            });

        // Listener para saldos
        this.saldosUnsubscribe = this.saldosCollection
            .orderBy('data', 'desc')
            .onSnapshot((snapshot) => {
                this.data.saldos = [];
                snapshot.forEach(doc => {
                    this.data.saldos.push({ id: doc.id, ...doc.data() });
                });
                this.updateDashboard();
                this.updateHistory();
                this.updateCharts();
            }, (error) => {
                console.error('Erro ao carregar saldos:', error);
            });
    }

    updateFirebaseStatus(connected) {
        const statusElement = document.getElementById('firebaseStatus');
        if (connected) {
            statusElement.innerHTML = `
                <div class="status-indicator connected">
                    <span class="status-dot"></span>
                    Conectado
                </div>
                <button class="btn-secondary" id="testConnection">
                    <i data-feather="refresh-cw"></i>
                    Testar Conexão
                </button>
            `;
            document.getElementById('testConnection').addEventListener('click', () => this.testConnection());
        } else {
            statusElement.innerHTML = `
                <div class="status-indicator disconnected">
                    <span class="status-dot"></span>
                    Desconectado
                </div>
                <button class="btn-primary" id="connectFirebase">
                    <i data-feather="link"></i>
                    Conectar ao Firebase
                </button>
            `;
            document.getElementById('connectFirebase').addEventListener('click', () => this.initializeFirebase());
        }
        feather.replace();
    }

    async testConnection() {
        this.showLoading(true);
        try {
            await this.db.collection('test').doc('test').get();
            this.showNotification('✅ Conexão com Firebase está funcionando!', 'success');
        } catch (error) {
            this.showNotification('❌ Erro na conexão com Firebase', 'error');
        }
        this.showLoading(false);
    }

    // ===========================================
    // UI CONTROLS
    // ===========================================

    setupEventListeners() {
        // Forms
        document.getElementById('gastoForm').addEventListener('submit', (e) => this.saveGasto(e));
        document.getElementById('saldoForm').addEventListener('submit', (e) => this.saveSaldo(e));
        
        // Buttons
        document.getElementById('btnCancelar').addEventListener('click', () => this.clearGastoForm());
        document.getElementById('btnCancelarSaldo').addEventListener('click', () => this.clearSaldoForm());
        document.getElementById('btnCarregarSaldos').addEventListener('click', () => this.loadLastSaldo());
        document.getElementById('btnImportar').addEventListener('click', () => this.triggerImport());
        document.getElementById('btnExportar').addEventListener('click', () => this.exportData());
        document.getElementById('btnLimparFiltros').addEventListener('click', () => this.clearFilters());
        
        // Filters
        document.getElementById('filtroStatus').addEventListener('change', () => this.applyFilters());
        document.getElementById('filtroMes').addEventListener('change', () => this.applyFilters());
        document.getElementById('filtroAno').addEventListener('change', () => this.applyFilters());
        document.getElementById('filtroMesCategoria').addEventListener('change', () => this.updateCharts());
        document.getElementById('filtroAnoCategoria').addEventListener('change', () => this.updateCharts());
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // File input
        document.getElementById('fileInput').addEventListener('change', (e) => this.importData(e));
    }

    setupDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('data').value = today;
        document.getElementById('dataSaldo').value = today;
    }

    populateYearFilters() {
        const currentYear = new Date().getFullYear();
        const yearSelects = [
            document.getElementById('filtroAno'),
            document.getElementById('filtroAnoCategoria')
        ];

        yearSelects.forEach(select => {
            select.innerHTML = '<option value="">Todos os anos</option>';
            for (let year = currentYear; year >= currentYear - 5; year--) {
                const option = document.createElement('option');
                option.value = year.toString();
                option.textContent = year.toString();
                select.appendChild(option);
            }
        });
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = document.querySelector('#themeToggle i');
        icon.setAttribute('data-feather', theme === 'dark' ? 'sun' : 'moon');
        feather.replace();
    }

    // ===========================================
    // DASHBOARD E DADOS
    // ===========================================

    updateDashboard() {
        this.updateBalance();
        this.updateKPIs();
    }

    updateBalance() {
        // SOMA DE TODOS OS SALÁRIOS E RESERVA DO ÚLTIMO MÊS
        const saldoRecente = this.data.saldos[0];
        const gastosPagos = this.data.gastos
            .filter(gasto => gasto.status === 'Pago')
            .reduce((total, gasto) => total + gasto.valor, 0);

        // Calcular soma de todos os salários
        const totalSalariosSammia = this.data.saldos.reduce((total, saldo) => total + (saldo.salarioSammia || 0), 0);
        const totalSalariosSamuel = this.data.saldos.reduce((total, saldo) => total + (saldo.salarioSamuel || 0), 0);
        const reservaAtual = saldoRecente ? (saldoRecente.reserva || 0) : 0;

        // Atualizar valores individuais
        document.getElementById('salarioSammia').textContent = this.formatCurrency(totalSalariosSammia);
        document.getElementById('salarioSamuel').textContent = this.formatCurrency(totalSalariosSamuel);
        document.getElementById('reservaValor').textContent = this.formatCurrency(reservaAtual);
        document.getElementById('reservaDashboard').textContent = this.formatCurrency(reservaAtual);
        document.getElementById('gastosPagos').textContent = this.formatCurrency(gastosPagos);

        // Calcular saldo geral (soma de todos os salários + reserva atual - gastos pagos)
        const saldoGeral = (totalSalariosSammia + totalSalariosSamuel + reservaAtual) - gastosPagos;
        
        const saldoElement = document.getElementById('saldoGeral');
        const trendElement = document.getElementById('saldoTrend');
        
        saldoElement.querySelector('.amount').textContent = this.formatCurrency(saldoGeral);
        
        // Atualizar tendência
        if (saldoGeral >= 0) {
            saldoElement.classList.remove('negative');
            trendElement.className = 'trend positive';
            trendElement.innerHTML = '<i data-feather="trending-up"></i>';
        } else {
            saldoElement.classList.add('negative');
            trendElement.className = 'trend negative';
            trendElement.innerHTML = '<i data-feather="trending-down"></i>';
        }
        
        feather.replace();
    }

    updateKPIs() {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        const gastosMes = this.data.gastos.filter(gasto => {
            const dataGasto = new Date(gasto.data);
            return dataGasto.getMonth() + 1 === currentMonth && 
                   dataGasto.getFullYear() === currentYear;
        });

        // Soma dos salários do mês atual
        const saldosMes = this.data.saldos.filter(saldo => {
            const dataSaldo = new Date(saldo.data);
            return dataSaldo.getMonth() + 1 === currentMonth && 
                   dataSaldo.getFullYear() === currentYear;
        });

        const totalReceitas = saldosMes.reduce((total, saldo) => 
            total + (saldo.salarioSammia || 0) + (saldo.salarioSamuel || 0), 0);
        
        const totalDespesas = gastosMes
            .filter(gasto => gasto.status === 'Pago')
            .reduce((total, gasto) => total + gasto.valor, 0);
        
        const totalPendentes = gastosMes
            .filter(gasto => gasto.status === 'Pendente').length;

        document.getElementById('totalReceitas').textContent = this.formatCurrency(totalReceitas);
        document.getElementById('totalDespesas').textContent = this.formatCurrency(totalDespesas);
        document.getElementById('totalPendentes').textContent = totalPendentes.toString();
    }

    // ===========================================
    // GRÁFICOS
    // ===========================================

    updateCharts() {
        this.updateGastosChart();
        this.updateEvolucaoSalarioChart();
        this.updateCategoriasChart();
    }

    updateGastosChart() {
        const ctx = document.getElementById('graficoGastos').getContext('2d');
        
        // Obter todos os meses do ano atual em ordem
        const currentYear = new Date().getFullYear();
        const mesesOrdenados = [];
        
        for (let month = 0; month < 12; month++) {
            const chave = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
            mesesOrdenados.push(chave);
        }

        const gastosPorMes = {};
        
        // Inicializar todos os meses com zero
        mesesOrdenados.forEach(mes => {
            gastosPorMes[mes] = 0;
        });

        // Adicionar gastos existentes
        this.data.gastos.forEach(gasto => {
            if (gasto.status === 'Pago') {
                const data = new Date(gasto.data);
                const ano = data.getFullYear();
                const mes = String(data.getMonth() + 1).padStart(2, '0');
                const chave = `${ano}-${mes}`;
                
                if (gastosPorMes[chave] !== undefined) {
                    gastosPorMes[chave] += gasto.valor;
                }
            }
        });

        const labels = mesesOrdenados.map(mes => {
            const [ano, mesNum] = mes.split('-');
            const nomeMes = new Date(ano, parseInt(mesNum) - 1).toLocaleDateString('pt-BR', { 
                month: 'short',
                year: 'numeric'
            });
            return nomeMes;
        });

        const valores = mesesOrdenados.map(mes => gastosPorMes[mes]);

        if (this.charts.gastos) {
            this.charts.gastos.destroy();
        }

        this.charts.gastos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gastos por Mês (R$)',
                    data: valores,
                    backgroundColor: 'rgba(20, 184, 166, 0.7)',
                    borderColor: 'rgba(20, 184, 166, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: this.getChartOptions('Gastos Mensais')
        });
    }

    updateEvolucaoSalarioChart() {
        const ctx = document.getElementById('graficoEvolucaoSalario').getContext('2d');
        const saldosOrdenados = [...this.data.saldos].sort((a, b) => new Date(a.data) - new Date(b.data));
        
        const labels = saldosOrdenados.map(saldo => this.formatDate(saldo.data));
        const salarioSammia = saldosOrdenados.map(saldo => saldo.salarioSammia || 0);
        const salarioSamuel = saldosOrdenados.map(saldo => saldo.salarioSamuel || 0);
        const totalSalarios = saldosOrdenados.map(saldo => (saldo.salarioSammia || 0) + (saldo.salarioSamuel || 0));

        if (this.charts.evolucaoSalario) {
            this.charts.evolucaoSalario.destroy();
        }

        this.charts.evolucaoSalario = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Salário Sammia',
                        data: salarioSammia,
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.3,
                        fill: false
                    },
                    {
                        label: 'Salário Samuel',
                        data: salarioSamuel,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.3,
                        fill: false
                    },
                    {
                        label: 'Total Salários',
                        data: totalSalarios,
                        borderColor: 'rgb(20, 184, 166)',
                        backgroundColor: 'rgba(20, 184, 166, 0.1)',
                        tension: 0.3,
                        fill: false
                    }
                ]
            },
            options: this.getChartOptions('Evolução dos Salários')
        });
    }

    updateCategoriasChart() {
        const ctx = document.getElementById('graficoCategorias').getContext('2d');
        const mesFiltro = document.getElementById('filtroMesCategoria').value;
        const anoFiltro = document.getElementById('filtroAnoCategoria').value;

        const gastosFiltrados = this.data.gastos.filter(gasto => {
            if (gasto.status !== 'Pago') return false;
            
            const dataGasto = new Date(gasto.data);
            const gastoMes = (dataGasto.getMonth() + 1).toString();
            const gastoAno = dataGasto.getFullYear().toString();
            
            const mesMatch = !mesFiltro || gastoMes === mesFiltro;
            const anoMatch = !anoFiltro || gastoAno === anoFiltro;
            
            return mesMatch && anoMatch;
        });

        const gastosPorCategoria = {};
        gastosFiltrados.forEach(gasto => {
            if (!gastosPorCategoria[gasto.categoria]) {
                gastosPorCategoria[gasto.categoria] = 0;
            }
            gastosPorCategoria[gasto.categoria] += gasto.valor;
        });

        const labels = Object.keys(gastosPorCategoria);
        const valores = Object.values(gastosPorCategoria);

        // Cores para as categorias
        const backgroundColors = [
            'rgba(20, 184, 166, 0.7)',
            'rgba(59, 130, 246, 0.7)',
            'rgba(139, 92, 246, 0.7)',
            'rgba(236, 72, 153, 0.7)',
            'rgba(249, 115, 22, 0.7)',
            'rgba(234, 179, 8, 0.7)',
            'rgba(16, 185, 129, 0.7)',
            'rgba(6, 182, 212, 0.7)',
            'rgba(168, 85, 247, 0.7)',
            'rgba(240, 171, 252, 0.7)'
        ];

        if (this.charts.categorias) {
            this.charts.categorias.destroy();
        }

        this.charts.categorias = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: valores,
                    backgroundColor: backgroundColors,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 12
                            },
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'rgba(255, 255, 255, 0.9)',
                        bodyColor: 'rgba(255, 255, 255, 0.9)',
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                                return `${context.label}: ${this.formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    getChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                title: {
                    display: true,
                    text: title,
                    color: 'rgba(255, 255, 255, 0.9)',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'rgba(255, 255, 255, 0.9)',
                    bodyColor: 'rgba(255, 255, 255, 0.9)',
                    callbacks: {
                        label: (context) => {
                            return `${context.dataset.label}: ${this.formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: (value) => {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        };
    }

    // ===========================================
    // CRUD OPERATIONS
    // ===========================================

    async saveGasto(e) {
        e.preventDefault();
        
        if (!this.db) {
            this.showNotification('⚠️ Conecte-se ao Firebase primeiro!', 'warning');
            return;
        }

        const id = document.getElementById('gastoId').value;
        const titulo = document.getElementById('titulo').value;
        const valor = parseFloat(document.getElementById('valor').value);
        const data = document.getElementById('data').value;
        const categoria = document.getElementById('categoria').value;
        const status = document.getElementById('status').value;

        const gasto = {
            titulo,
            valor,
            data,
            categoria,
            status,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        this.showLoading(true);
        try {
            if (id) {
                await this.gastosCollection.doc(id).update(gasto);
                this.showNotification('✅ Gasto atualizado com sucesso!', 'success');
            } else {
                await this.gastosCollection.add(gasto);
                this.showNotification('✅ Gasto salvo com sucesso!', 'success');
            }
            
            this.clearGastoForm();
        } catch (error) {
            console.error('Erro ao salvar gasto:', error);
            this.showNotification('❌ Erro ao salvar gasto. Tente novamente.', 'error');
        }
        this.showLoading(false);
    }

    async saveSaldo(e) {
        e.preventDefault();
        
        if (!this.db) {
            this.showNotification('⚠️ Conecte-se ao Firebase primeiro!', 'warning');
            return;
        }

        const id = document.getElementById('saldoId').value;
        const dataSaldo = document.getElementById('dataSaldo').value;
        const salarioSammia = parseFloat(document.getElementById('salarioSammiaInput').value) || 0;
        const salarioSamuel = parseFloat(document.getElementById('salarioSamuelInput').value) || 0;
        const reserva = parseFloat(document.getElementById('reservaInput').value) || 0;

        const saldo = {
            data: dataSaldo,
            salarioSammia,
            salarioSamuel,
            reserva,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        this.showLoading(true);
        try {
            if (id) {
                await this.saldosCollection.doc(id).update(saldo);
                this.showNotification('✅ Saldo atualizado com sucesso!', 'success');
            } else {
                await this.saldosCollection.add(saldo);
                this.showNotification('✅ Saldos salvos com sucesso!', 'success');
            }
            
            this.clearSaldoForm();
        } catch (error) {
            console.error('Erro ao salvar saldos:', error);
            this.showNotification('❌ Erro ao salvar saldos. Tente novamente.', 'error');
        }
        this.showLoading(false);
    }

    clearGastoForm() {
        document.getElementById('gastoId').value = '';
        document.getElementById('gastoForm').reset();
        document.getElementById('data').valueAsDate = new Date();
    }

    clearSaldoForm() {
        document.getElementById('saldoId').value = '';
        document.getElementById('saldoForm').reset();
        document.getElementById('dataSaldo').valueAsDate = new Date();
        document.getElementById('btnCancelarSaldo').classList.add('hidden');
    }

    async loadLastSaldo() {
        if (!this.db) {
            this.showNotification('⚠️ Conecte-se ao Firebase primeiro!', 'warning');
            return;
        }

        this.showLoading(true);
        try {
            const snapshot = await this.saldosCollection
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const saldo = snapshot.docs[0].data();
                this.loadSaldoIntoForm(saldo);
                this.showNotification('✅ Último saldo carregado!', 'success');
            } else {
                this.showNotification('ℹ️ Nenhum saldo anterior encontrado.', 'info');
            }
        } catch (error) {
            console.error('Erro ao carregar saldos:', error);
            this.showNotification('❌ Erro ao carregar saldos. Tente novamente.', 'error');
        }
        this.showLoading(false);
    }

    loadSaldoIntoForm(saldo) {
        document.getElementById('dataSaldo').value = saldo.data;
        document.getElementById('salarioSammiaInput').value = saldo.salarioSammia || '';
        document.getElementById('salarioSamuelInput').value = saldo.salarioSamuel || '';
        document.getElementById('reservaInput').value = saldo.reserva || '';
    }

    // ===========================================
    // FILTROS E TABELA
    // ===========================================

    applyFilters() {
        const statusFiltro = document.getElementById('filtroStatus').value;
        const mesFiltro = document.getElementById('filtroMes').value;
        const anoFiltro = document.getElementById('filtroAno').value;

        const gastosFiltrados = this.data.gastos.filter(gasto => {
            const dataGasto = new Date(gasto.data);
            const gastoMes = (dataGasto.getMonth() + 1).toString();
            const gastoAno = dataGasto.getFullYear().toString();
            
            const statusMatch = !statusFiltro || gasto.status === statusFiltro;
            const mesMatch = !mesFiltro || gastoMes === mesFiltro;
            const anoMatch = !anoFiltro || gastoAno === anoFiltro;
            
            return statusMatch && mesMatch && anoMatch;
        });

        this.updateTable(gastosFiltrados);
    }

    updateTable(gastos) {
        const tbody = document.getElementById('tabelaGastosBody');
        tbody.innerHTML = '';

        if (gastos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i data-feather="search"></i>
                        <div>
                            <p>Nenhum gasto encontrado</p>
                            <small>Tente alterar os filtros ou adicionar novos gastos</small>
                        </div>
                    </td>
                </tr>
            `;
            feather.replace();
            return;
        }

        gastos.forEach(gasto => {
            const dataFormatada = this.formatDate(gasto.data);
            const valorFormatado = this.formatCurrency(gasto.valor);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataFormatada}</td>
                <td>${gasto.titulo}</td>
                <td>${gasto.categoria}</td>
                <td>${valorFormatado}</td>
                <td>
                    <span class="status-badge status-${gasto.status.toLowerCase()}">
                        ${gasto.status}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon btn-small" onclick="app.editGasto('${gasto.id}')" title="Editar">
                            <i data-feather="edit"></i>
                        </button>
                        <button class="btn-icon btn-small" onclick="app.deleteGasto('${gasto.id}')" title="Excluir">
                            <i data-feather="trash-2"></i>
                        </button>
                        <button class="btn-icon btn-small" onclick="app.toggleStatus('${gasto.id}', '${gasto.status}')" title="${gasto.status === 'Pago' ? 'Marcar como Pendente' : 'Marcar como Pago'}">
                            <i data-feather="${gasto.status === 'Pago' ? 'clock' : 'check'}"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        feather.replace();
    }

    clearFilters() {
        document.getElementById('filtroStatus').value = '';
        document.getElementById('filtroMes').value = '';
        document.getElementById('filtroAno').value = '';
        this.applyFilters();
    }

    // ===========================================
    // HISTÓRICO
    // ===========================================

    updateHistory() {
        const historyBody = document.getElementById('historicoSaldosBody');
        historyBody.innerHTML = '';

        if (this.data.saldos.length === 0) {
            historyBody.innerHTML = `
                <div class="empty-state">
                    <i data-feather="database"></i>
                    <p>Nenhum saldo registrado</p>
                </div>
            `;
            feather.replace();
            return;
        }

        const saldosRecentes = this.data.saldos.slice(0, 10);
        
        saldosRecentes.forEach(saldo => {
            const dataFormatada = this.formatDate(saldo.data);
            const total = (saldo.salarioSammia || 0) + (saldo.salarioSamuel || 0) + (saldo.reserva || 0);
            
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-item-content">
                    <span class="history-date">${dataFormatada}</span>
                    <span class="history-amount">${this.formatCurrency(total)}</span>
                </div>
                <div class="history-actions">
                    <button class="btn-icon btn-small" onclick="app.editSaldo('${saldo.id}')" title="Editar">
                        <i data-feather="edit"></i>
                    </button>
                    <button class="btn-icon btn-small" onclick="app.deleteSaldo('${saldo.id}')" title="Excluir">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            `;
            historyBody.appendChild(div);
        });
        feather.replace();
    }

    // ===========================================
    // IMPORT/EXPORT
    // ===========================================

    triggerImport() {
        document.getElementById('fileInput').click();
    }

    async importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!this.db) {
            this.showNotification('⚠️ Conecte-se ao Firebase primeiro!', 'warning');
            return;
        }

        if (!confirm('📥 Isso irá importar todos os dados do Excel para o Firebase. Continuar?')) {
            e.target.value = '';
            return;
        }

        this.showLoading(true);
        try {
            const data = await this.readExcelFile(file);
            const importados = await this.importToFirestore(data);
            this.showNotification(`✅ ${importados} dados importados com sucesso!`, 'success');
            e.target.value = '';
        } catch (error) {
            console.error('Erro ao importar dados:', error);
            this.showNotification('❌ Erro ao importar dados. Verifique o formato do arquivo.', 'error');
        }
        this.showLoading(false);
    }

    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = function(error) {
                reject(error);
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    async importToFirestore(data) {
        let importados = 0;
        
        for (const item of data) {
            const gasto = {
                titulo: item.Título || item.titulo || item['Descrição'] || 'Sem título',
                valor: parseFloat(item.Valor || item.valor || item.Custo || 0),
                data: item.Data || item.data || item.Vencimento || new Date().toISOString().split('T')[0],
                categoria: item.Categoria || item.categoria || 'Outros',
                status: item.Status || item.status || item.Pago || 'Pendente',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (gasto.titulo && !isNaN(gasto.valor) && gasto.valor > 0) {
                await this.gastosCollection.add(gasto);
                importados++;
            }
        }
        
        return importados;
    }

    async exportData() {
        if (!this.db) {
            this.showNotification('⚠️ Conecte-se ao Firebase primeiro!', 'warning');
            return;
        }

        this.showLoading(true);
        try {
            const snapshot = await this.gastosCollection.get();
            const gastos = [];
            
            snapshot.forEach(doc => {
                gastos.push({ id: doc.id, ...doc.data() });
            });
            
            this.exportToJSON(gastos);
            this.showNotification('✅ Dados exportados com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao exportar dados:', error);
            this.showNotification('❌ Erro ao exportar dados. Tente novamente.', 'error');
        }
        this.showLoading(false);
    }

    exportToJSON(data) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gastos-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // ===========================================
    // CRUD METHODS (para uso global)
    // ===========================================

    async editGasto(id) {
        this.showLoading(true);
        try {
            const doc = await this.gastosCollection.doc(id).get();
            if (doc.exists) {
                const gasto = doc.data();
                
                document.getElementById('gastoId').value = id;
                document.getElementById('titulo').value = gasto.titulo;
                document.getElementById('valor').value = gasto.valor;
                document.getElementById('data').value = gasto.data;
                document.getElementById('categoria').value = gasto.categoria;
                document.getElementById('status').value = gasto.status;
                
                // Scroll to form
                document.getElementById('gastoForm').scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        } catch (error) {
            console.error('Erro ao carregar gasto para edição:', error);
            this.showNotification('❌ Erro ao carregar gasto para edição.', 'error');
        }
        this.showLoading(false);
    }

    async editSaldo(id) {
        this.showLoading(true);
        try {
            const doc = await this.saldosCollection.doc(id).get();
            if (doc.exists) {
                const saldo = doc.data();
                
                document.getElementById('saldoId').value = id;
                document.getElementById('dataSaldo').value = saldo.data;
                document.getElementById('salarioSammiaInput').value = saldo.salarioSammia || '';
                document.getElementById('salarioSamuelInput').value = saldo.salarioSamuel || '';
                document.getElementById('reservaInput').value = saldo.reserva || '';
                
                document.getElementById('btnCancelarSaldo').classList.remove('hidden');
                
                // Scroll to form
                document.getElementById('saldoForm').scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        } catch (error) {
            console.error('Erro ao carregar saldo para edição:', error);
            this.showNotification('❌ Erro ao carregar saldo para edição.', 'error');
        }
        this.showLoading(false);
    }

    async deleteGasto(id) {
        if (confirm('⚠️ Tem certeza que deseja excluir este gasto?')) {
            this.showLoading(true);
            try {
                await this.gastosCollection.doc(id).delete();
                this.showNotification('✅ Gasto excluído com sucesso!', 'success');
            } catch (error) {
                console.error('Erro ao excluir gasto:', error);
                this.showNotification('❌ Erro ao excluir gasto. Tente novamente.', 'error');
            }
            this.showLoading(false);
        }
    }

    async deleteSaldo(id) {
        if (confirm('⚠️ Tem certeza que deseja excluir este saldo?')) {
            this.showLoading(true);
            try {
                await this.saldosCollection.doc(id).delete();
                this.showNotification('✅ Saldo excluído com sucesso!', 'success');
            } catch (error) {
                console.error('Erro ao excluir saldo:', error);
                this.showNotification('❌ Erro ao excluir saldo. Tente novamente.', 'error');
            }
            this.showLoading(false);
        }
    }

    async toggleStatus(id, statusAtual) {
        const novoStatus = statusAtual === 'Pago' ? 'Pendente' : 'Pago';
        
        this.showLoading(true);
        try {
            await this.gastosCollection.doc(id).update({ 
                status: novoStatus,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.showNotification(`✅ Status alterado para ${novoStatus}!`, 'success');
        } catch (error) {
            console.error('Erro ao alterar status do gasto:', error);
            this.showNotification('❌ Erro ao alterar status do gasto. Tente novamente.', 'error');
        }
        this.showLoading(false);
    }

    // ===========================================
    // UTILITÁRIOS
    // ===========================================

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.toggle('hidden', !show);
    }

    showNotification(message, type = 'info') {
        // Implementação básica de notificação
        alert(message);
    }
}

// Inicializar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FinanceApp();
});
