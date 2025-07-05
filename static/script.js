// Global variables
let cpuChart, memoryChart, diskChart, networkChart;
let networkBaseline = { sent: 0, recv: 0 };
let currentTheme = localStorage.getItem('theme') || 'light';
let socket;
let alertsCount = 0;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set theme
    setTheme(currentTheme);
    
    // Initialize charts
    initializeCharts();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load system info
    loadSystemInfo();
    
    // Connect to WebSocket
    connectWebSocket();
    
    // Load historical data
    loadHistoricalData(1);
    
    // Load alerts
    loadAlerts();
});

// Set theme
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeToggle = document.getElementById('themeToggle');
    
    if (theme === 'dark') {
        themeToggle.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-sun">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
        `;
    } else {
        themeToggle.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-moon">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
        `;
    }
    
    localStorage.setItem('theme', theme);
    currentTheme = theme;
    
    // Update chart themes
    updateChartsTheme();
}

// Toggle theme
function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Initialize charts
function initializeCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 1000,
            easing: 'easeOutQuart'
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: currentTheme === 'dark' ? '#374151' : 'rgba(255, 255, 255, 0.9)',
                titleColor: currentTheme === 'dark' ? '#f9fafb' : '#1f2937',
                bodyColor: currentTheme === 'dark' ? '#f9fafb' : '#1f2937',
                borderColor: currentTheme === 'dark' ? '#4b5563' : '#e5e7eb',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 4,
                displayColors: false
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                    color: currentTheme === 'dark' ? '#4b5563' : '#e5e7eb'
                },
                ticks: {
                    color: currentTheme === 'dark' ? '#9ca3af' : '#6b7280',
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                beginAtZero: true,
                max: 100,
                grid: {
                    color: currentTheme === 'dark' ? '#374151' : '#f3f4f6'
                },
                ticks: {
                    color: currentTheme === 'dark' ? '#9ca3af' : '#6b7280',
                    font: {
                        size: 10
                    }
                }
            }
        }
    };
    
    // CPU Chart
    cpuChart = new Chart(
        document.getElementById('cpuChart').getContext('2d'),
        {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Usage %',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: chartOptions
        }
    );
    
    // Memory Chart
    memoryChart = new Chart(
        document.getElementById('memoryChart').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Memory Usage %',
                    data: [],
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: chartOptions
        }
    );
    
    // Disk Chart
    diskChart = new Chart(
        document.getElementById('diskChart').getContext('2d'),
        {
            type: 'doughnut',
            data: {
                labels: ['Used', 'Free'],
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#ef4444', '#3b82f6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: currentTheme === 'dark' ? '#f9fafb' : '#1f2937',
                            padding: 10,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: currentTheme === 'dark' ? '#374151' : 'rgba(255, 255, 255, 0.9)',
                        titleColor: currentTheme === 'dark' ? '#f9fafb' : '#1f2937',
                        bodyColor: currentTheme === 'dark' ? '#f9fafb' : '#1f2937',
                        borderColor: currentTheme === 'dark' ? '#4b5563' : '#e5e7eb',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 4,
                        displayColors: false
                    }
                }
            }
        }
    );
    
    // Network Chart
    networkChart = new Chart(
        document.getElementById('networkChart').getContext('2d'),
        {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Upload (KB)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Download (KB)',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                ...chartOptions,
                plugins: {
                    ...chartOptions.plugins,
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: currentTheme === 'dark' ? '#f9fafb' : '#1f2937',
                            padding: 10,
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                scales: {
                    ...chartOptions.scales,
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: currentTheme === 'dark' ? '#374151' : '#f3f4f6'
                        },
                        ticks: {
                            color: currentTheme === 'dark' ? '#9ca3af' : '#6b7280',
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        }
    );
}

// Update charts theme
function updateChartsTheme() {
    const charts = [cpuChart, memoryChart, networkChart];
    const textColor = currentTheme === 'dark' ? '#f9fafb' : '#1f2937';
    const gridColor = currentTheme === 'dark' ? '#374151' : '#f3f4f6';
    const tickColor = currentTheme === 'dark' ? '#9ca3af' : '#6b7280';
    
    charts.forEach(chart => {
        if (!chart) return;
        
        // Update scales
        if (chart.options.scales) {
            Object.keys(chart.options.scales).forEach(scaleKey => {
                const scale = chart.options.scales[scaleKey];
                if (scale.grid) {
                    scale.grid.color = gridColor;
                }
                if (scale.ticks) {
                    scale.ticks.color = tickColor;
                }
            });
        }
        
        // Update tooltip
        if (chart.options.plugins && chart.options.plugins.tooltip) {
            chart.options.plugins.tooltip.backgroundColor = currentTheme === 'dark' ? '#374151' : 'rgba(255, 255, 255, 0.9)';
            chart.options.plugins.tooltip.titleColor = textColor;
            chart.options.plugins.tooltip.bodyColor = textColor;
            chart.options.plugins.tooltip.borderColor = currentTheme === 'dark' ? '#4b5563' : '#e5e7eb';
        }
        
        // Update legend
        if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
            chart.options.plugins.legend.labels.color = textColor;
        }
        
        chart.update();
    });
    
    // Update doughnut chart separately
    if (diskChart) {
        if (diskChart.options.plugins && diskChart.options.plugins.legend && diskChart.options.plugins.legend.labels) {
            diskChart.options.plugins.legend.labels.color = textColor;
        }
        
        if (diskChart.options.plugins && diskChart.options.plugins.tooltip) {
            diskChart.options.plugins.tooltip.backgroundColor = currentTheme === 'dark' ? '#374151' : 'rgba(255, 255, 255, 0.9)';
            diskChart.options.plugins.tooltip.titleColor = textColor;
            diskChart.options.plugins.tooltip.bodyColor = textColor;
            diskChart.options.plugins.tooltip.borderColor = currentTheme === 'dark' ? '#4b5563' : '#e5e7eb';
        }
        
        diskChart.update();
    }
}

// Set up event listeners
function setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', function() {
        loadSystemInfo();
        loadHistoricalData(getActiveTimeRange());
        loadAlerts();
        showToast('Refreshing data...', 'success');
    });
    
    // Time range buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            loadHistoricalData(parseInt(this.dataset.hours));
        });
    });
    
    // Memory timeline slider
    document.getElementById('memoryTimeline').addEventListener('input', function() {
        const value = parseInt(this.value);
        filterTimelineData(value);
    });
    
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update active tab pane
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            document.getElementById(tabId + 'Tab').classList.add('active');
        });
    });
    
    // Process search
    document.getElementById('processSearch').addEventListener('input', filterProcesses);
}

// Get active time range
function getActiveTimeRange() {
    const activeBtn = document.querySelector('.time-btn.active');
    return activeBtn ? parseInt(activeBtn.dataset.hours) : 1;
}

// Filter processes
function filterProcesses() {
    const searchTerm = document.getElementById('processSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#processList tr');
    
    rows.forEach(row => {
        const name = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        row.style.display = name.includes(searchTerm) ? '' : 'none';
    });
}

// Filter timeline data
function filterTimelineData(value) {
    if (!memoryChart || !memoryChart.data || !memoryChart.data.datasets) return;
    
    const dataset = memoryChart.data.datasets[0];
    const originalData = dataset._originalData || dataset.data;
    
    // Store original data if not already stored
    if (!dataset._originalData) {
        dataset._originalData = [...originalData];
    }
    
    // Calculate how many data points to show based on the slider value
    const dataLength = originalData.length;
    const pointsToShow = Math.max(1, Math.floor(dataLength * (value / 100)));
    
    // Update the chart with the filtered data
    dataset.data = originalData.slice(-pointsToShow);
    memoryChart.data.labels = memoryChart.data.labels.slice(-pointsToShow);
    memoryChart.update();
}

// Load system info
function loadSystemInfo() {
    fetch('/system-info')
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            document.getElementById('cpuCores').textContent = data.cpu_cores;
            document.getElementById('totalMemory').textContent = data.total_memory_gb;
            document.getElementById('totalDisk').textContent = data.total_disk_gb;
            
            if (data.battery) {
                const batteryCard = document.getElementById('batteryCard');
                batteryCard.style.display = 'flex';
                document.getElementById('batteryPercent').textContent = data.battery.percent;
                document.getElementById('batteryStatus').textContent = data.battery.plugged ? 'Charging' : 'Battery';
            }
        })
        .catch(error => {
            console.error('Error loading system info:', error);
            showToast('Failed to load system information', 'error');
        });
}

// Load historical data
function loadHistoricalData(hours) {
    fetch(`/historical-data?hours=${hours}`)
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            // Update CPU chart
            cpuChart.data.labels = data.map(item => item.time);
            cpuChart.data.datasets[0].data = data.map(item => item.cpu);
            cpuChart.update();
            
            // Update Memory chart
            memoryChart.data.labels = data.map(item => item.time);
            memoryChart.data.datasets[0].data = data.map(item => item.memory);
            memoryChart.update();
        })
        .catch(error => {
            console.error('Error loading historical data:', error);
            showToast('Failed to load historical data', 'error');
        });
}

// Load alerts
function loadAlerts() {
    fetch('/alerts?limit=5')
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            const container = document.getElementById('alertsContainer');
            
            if (data.length === 0) {
                container.innerHTML = '<div class="empty-state">No alerts to display</div>';
                return;
            }
            
            container.innerHTML = '';
            
            data.forEach(alert => {
                const alertDiv = document.createElement('div');
                alertDiv.className = `alert ${alert.level}`;
                alertDiv.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span>${alert.message}</span>
                        <span class="text-xs opacity-70">${alert.time}</span>
                    </div>
                `;
                container.appendChild(alertDiv);
            });
        })
        .catch(error => {
            console.error('Error loading alerts:', error);
            showToast('Failed to load alerts', 'error');
        });
}

// Connect to WebSocket
function connectWebSocket() {
    const socket = io(window.location.origin + '/monitor');

    
    socket.on('connect', () => {
        console.log('Connected to server');
        updateConnectionStatus(true);
        showToast('Connected to server', 'success');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus(false);
        showToast('Disconnected from server', 'error');
    });
    
    socket.on('update', data => {
        if (!data) return;
        
        // Update time
        document.getElementById('updateTime').textContent = data.time;
        
        // Update CPU usage
        updateUsageMetric('cpu', data.cpu);
        
        // Update Memory usage
        updateUsageMetric('memory', data.memory);
        
        // Update Disk usage
        updateUsageMetric('disk', data.disk);
        
        // Update Disk chart
        diskChart.data.datasets[0].data = [data.disk, 100 - data.disk];
        diskChart.update();
        
        // Update disk stats
        document.getElementById('diskUsedValue').textContent = `${data.disk.toFixed(1)}%`;
        document.getElementById('diskFreeValue').textContent = `${(100 - data.disk).toFixed(1)}%`;
        
        // Update Network
        updateNetworkStats(data.network);
        
        // Update Processes
        updateProcessTable(data.processes);
        
        // Update Alerts
        if (data.alerts) {
            data.alerts.forEach(alert => {
                showToast(alert[0], alert[1]);
            });
            loadAlerts();
        }
        
        // Update Temperatures
        if (data.sensors?.temperatures) {
            updateTemperatures(data.sensors.temperatures);
        }
        
        // Update Fans
        if (data.sensors?.fans) {
            updateFans(data.sensors.fans);
        }
        
        // Update charts with new data
        if (cpuChart) updateChart(cpuChart, data.cpu);
        if (memoryChart) updateChart(memoryChart, data.memory);
    });
    

// Update connection status
function updateConnectionStatus(connected) {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    
    if (connected) {
        statusIndicator.classList.remove('disconnected');
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
    }
}

// Update usage metric
function updateUsageMetric(type, value) {
    const valueElement = document.getElementById(`${type}Usage`);
    const barElement = document.getElementById(`${type}Bar`);
    
    valueElement.textContent = `${value.toFixed(1)}%`;
    barElement.style.width = `${value}%`;
    
    // Update class based on value
    barElement.classList.remove('critical', 'warning');
    valueElement.classList.remove('critical', 'warning');
    
    if (value > 90) {
        barElement.classList.add('critical');
        valueElement.classList.add('critical');
    } else if (value > 70) {
        barElement.classList.add('warning');
        valueElement.classList.add('warning');
    }
}

// Update chart with new data point
function updateChart(chart, newValue) {
    if (!chart || !chart.data || !chart.data.datasets) return;
    
    const dataset = chart.data.datasets[0];
    
    if (dataset.data.length > 20) {
        chart.data.labels.shift();
        dataset.data.shift();
    }
    
    chart.data.labels.push('');
    dataset.data.push(newValue);
    chart.update();
}

// Update network stats
function updateNetworkStats(network) {
    if (!networkBaseline.sent) {
        networkBaseline = { sent: network.sent, recv: network.recv };
        return;
    }
    
    const sentDiff = (network.sent - networkBaseline.sent) / 1024;
    const recvDiff = (network.recv - networkBaseline.recv) / 1024;
    networkBaseline = { sent: network.sent, recv: network.recv };
    
    // Update network chart
    if (networkChart.data.labels.length > 15) {
        networkChart.data.labels.shift();
        networkChart.data.datasets[0].data.shift();
        networkChart.data.datasets[1].data.shift();
    }
    
    networkChart.data.labels.push('');
    networkChart.data.datasets[0].data.push(sentDiff);
    networkChart.data.datasets[1].data.push(recvDiff);
    networkChart.update();
    
    // Update network stats display
    document.getElementById('networkSent').textContent = `${(network.sent / (1024 * 1024)).toFixed(2)} MB`;
    document.getElementById('networkRecv').textContent = `${(network.recv / (1024 * 1024)).toFixed(2)} MB`;
}

// Update process table
function updateProcessTable(processes) {
    const tbody = document.getElementById('processList');
    tbody.innerHTML = '';
    
    processes.forEach(proc => {
        const row = document.createElement('tr');
        
        const cpuClass = proc.cpu > 70 ? 'critical' : proc.cpu > 50 ? 'warning' : '';
        const memoryClass = proc.memory > 70 ? 'critical' : proc.memory > 50 ? 'warning' : '';
        
        row.innerHTML = `
            <td>${proc.pid}</td>
            <td>${proc.name}</td>
            <td class="${cpuClass}">${proc.cpu.toFixed(1)}</td>
            <td class="${memoryClass}">${proc.memory.toFixed(1)}</td>
            <td><span class="process-status ${proc.status}">${proc.status}</span></td>
            <td><button class="kill-btn" data-pid="${proc.pid}">Kill</button></td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Add event listeners to kill buttons
    document.querySelectorAll('.kill-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const pid = parseInt(this.dataset.pid);
            killProcess(pid);
        });
    });
}

// Kill process
function killProcess(pid) {
    if (!confirm(`Are you sure you want to kill process ${pid}?`)) return;
    
    fetch('/kill-process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pid: pid })
    })
    .then(response => {
        if (!response.ok) throw new Error('Network error');
        return response.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);
        showToast(`Process ${pid} killed successfully`, 'success');
        socket.emit('manual_refresh');
    })
    .catch(error => {
        showToast(`Failed to kill process: ${error.message}`, 'error');
    });
}

// Update temperatures
function updateTemperatures(temps) {
    const container = document.getElementById('temperaturesContainer');
    container.innerHTML = '';
    document.getElementById('temperaturesCard').style.display = 'block';
    
    for (const [name, temp] of Object.entries(temps)) {
        const tempDiv = document.createElement('div');
        tempDiv.className = 'sensor-item';
        
        const tempClass = temp > 80 ? 'critical' : temp > 70 ? 'warning' : '';
        
        tempDiv.innerHTML = `
            <div class="sensor-header">
                <span>${name}</span>
                <span class="sensor-value ${tempClass}">${temp.toFixed(1)}°C</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar ${tempClass}" style="width: ${(temp / 100) * 100}%"></div>
            </div>
        `;
        
        container.appendChild(tempDiv);
    }
}

// Update fans
function updateFans(fans) {
    const container = document.getElementById('fansContainer');
    container.innerHTML = '';
    document.getElementById('fansCard').style.display = 'block';
    
    for (const [name, speed] of Object.entries(fans)) {
        const fanDiv = document.createElement('div');
        fanDiv.className = 'sensor-item';
        
        fanDiv.innerHTML = `
            <div class="sensor-header">
                <span>${name}</span>
                <span class="sensor-value">${speed.toFixed(0)} RPM</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${(speed / 3000) * 100}%"></div>
            </div>
        `;
        
        container.appendChild(fanDiv);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const toastId = `toast-${Date.now()}`;
    
    toast.className = `toast ${type}`;
    toast.id = toastId;
    
    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
            <button class="toast-close" onclick="closeToast('${toastId}')">&times;</button>
        </div>
        <div class="toast-body">${message}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        closeToast(toastId);
    }, 5000);
}

// Close toast
function closeToast(id) {
    const toast = document.getElementById(id);
    if (toast) {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
}}