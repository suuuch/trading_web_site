class ShortSellChart {
    constructor() {
        this.chart = echarts.init(document.getElementById('history-chart'));
        this.currentStockCode = null;
        this.pageSize = 10;
        this.currentPage = 1;
        this.allData = [];
        this.initTable();
    }

    async initTable() {
        try {
            const response = await fetch('/api/shortsell/latest');
            const result = await response.json();
            this.allData = result.data;
            
            // 更新日期显示
            if (result.latest_date) {
                document.getElementById('latest-date').textContent = result.latest_date;
            }
            
            this.updatePagination();
            this.renderTable();
            this.setupPaginationEvents();
        } catch (error) {
            console.error('Error loading shortsell data:', error);
        }
    }

    updatePagination() {
        const totalItems = this.allData.length;
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, totalItems);

        document.getElementById('page-start').textContent = start;
        document.getElementById('page-end').textContent = end;
        document.getElementById('total-items').textContent = totalItems;

        // 更新按钮状态
        document.getElementById('prev-page').disabled = this.currentPage === 1;
        document.getElementById('next-page').disabled = end >= totalItems;
        document.getElementById('prev-page-mobile').disabled = this.currentPage === 1;
        document.getElementById('next-page-mobile').disabled = end >= totalItems;
    }

    setupPaginationEvents() {
        document.getElementById('prev-page').addEventListener('click', () => this.changePage(-1));
        document.getElementById('next-page').addEventListener('click', () => this.changePage(1));
        document.getElementById('prev-page-mobile').addEventListener('click', () => this.changePage(-1));
        document.getElementById('next-page-mobile').addEventListener('click', () => this.changePage(1));
    }

    changePage(delta) {
        const newPage = this.currentPage + delta;
        const maxPage = Math.ceil(this.allData.length / this.pageSize);
        
        if (newPage >= 1 && newPage <= maxPage) {
            this.currentPage = newPage;
            this.updatePagination();
            this.renderTable();
        }
    }

    renderTable() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageData = this.allData.slice(start, end);
        
        const tbody = document.querySelector('#shortsell-table tbody');
        tbody.innerHTML = pageData.map(row => `
            <tr class="hover:bg-gray-100 cursor-pointer" data-stock-code="${row.股票代码}">
                <td class="px-6 py-4 whitespace-nowrap">${row.股票代码}</td>
                <td class="px-6 py-4 whitespace-nowrap">${row.股票名称}</td>
                <td class="px-6 py-4 whitespace-nowrap">${row.最新价}</td>
                <td class="px-6 py-4 whitespace-nowrap">${row.short_volume.toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap">${row.short_price.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${row.short_amount.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${row.total_amount.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${row.short_ratio.toFixed(2)}%</td>
            </tr>
        `).join('');

        // 添加表格行点击事件
        tbody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', () => {
                const stockCode = row.dataset.stockCode;
                this.loadHistoryData(stockCode);
                
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('bg-blue-50'));
                row.classList.add('bg-blue-50');
            });
        });
    }

    async loadHistoryData(stockCode) {
        try {
            const response = await fetch(`/api/shortsell/history/${stockCode}`);
            const data = await response.json();
            
            if (!data.length) return;

            // 确保日期数据正确处理
            const dates = data.map(item => {
                const date = new Date(item.trade_date);
                return date.toISOString().split('T')[0];
            });

            const shortPrice = data.map(item => item.short_price);
            const shortAmount = data.map(item => item.short_amount);
            const totalAmount = data.map(item => item.total_amount);

            const option = {
                title: {
                    text: `${data[0].股票代码} ${data[0].股票名称} - 沽空数据`,
                    left: 'center'
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross'
                    },
                    formatter: function(params) {
                        let result = `<div style="font-weight: bold">${params[0].axisValue}</div>`;
                        params.forEach(param => {
                            let value = param.seriesName.includes('价') ? 
                                param.value.toFixed(2) + ' HKD' : 
                                param.value.toFixed(2) + ' 万港元';
                            result += `<div style="color: ${param.color}">${param.seriesName}: ${value}</div>`;
                        });
                        return result;
                    }
                },
                legend: {
                    data: ['沽空平均价', '沽空金额', '总成交金额'],
                    bottom: 10
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '15%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: dates,
                    axisLabel: {
                        formatter: '{value}',
                        interval: 0,
                        rotate: 45
                    }
                },
                yAxis: [
                    {
                        type: 'value',
                        name: '金额',
                        position: 'left',
                        axisLabel: {
                            formatter: '{value} 万港元'
                        }
                    },
                    {
                        type: 'value',
                        name: '价格',
                        position: 'right',
                        axisLabel: {
                            formatter: '{value} HKD'
                        }
                    }
                ],
                series: [
                    {
                        name: '沽空平均价',
                        type: 'line',
                        data: shortPrice,
                        yAxisIndex: 1,
                        itemStyle: {
                            color: '#2563eb'  // 蓝色
                        }
                    },
                    {
                        name: '沽空金额',
                        type: 'bar',
                        data: shortAmount,
                        yAxisIndex: 0,
                        itemStyle: {
                            color: '#dc2626'  // 红色
                        }
                    },
                    {
                        name: '总成交金额',
                        type: 'bar',
                        data: totalAmount,
                        yAxisIndex: 0,
                        itemStyle: {
                            color: '#16a34a'  // 绿色
                        }
                    }
                ]
            };

            this.chart.setOption(option);
        } catch (error) {
            console.error('Error loading history data:', error);
        }
    }

    resize() {
        this.chart && this.chart.resize();
    }
}

// 初始化图表
document.addEventListener('DOMContentLoaded', () => {
    const shortSellChart = new ShortSellChart();
    window.addEventListener('resize', () => shortSellChart.resize());
}); 