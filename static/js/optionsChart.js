class OptionsChart {
    constructor() {
        this.shortTermChart = echarts.init(document.getElementById('short-term-chart'));
        this.nearTermChart = echarts.init(document.getElementById('near-term-chart'));
        this.farTermChart = echarts.init(document.getElementById('far-term-chart'));
        this.symbolSelect = document.getElementById('symbol-select');
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.symbolSelect.addEventListener('change', () => this.loadData());
        window.addEventListener('resize', () => this.resize());
    }

    async loadData() {
        const symbol = this.symbolSelect.value;
        if (!symbol) return;
        
        try {
            const response = await fetch(`/api/options/data/${symbol}`);
            const data = await response.json();
            
            if (data.error) {
                console.error(data.error);
                return;
            }
            
            // 更新日期显示
            if (data.latest_date) {
                document.getElementById('latest-date').textContent = data.latest_date;
            }
            
            // 更新图表
            this.updateChart(this.shortTermChart, data.short_term, '短期期权数据');
            this.updateChart(this.nearTermChart, data.near_term, '近期期权数据');
            this.updateChart(this.farTermChart, data.far_term, '远期期权数据');
        } catch (error) {
            console.error('Error loading options data:', error);
        }
    }

    updateChart(chart, data, title) {
        if (!data || !data.length) {
            chart.setOption({
                title: {
                    text: title + ' (无数据)',
                    left: 'center'
                }
            });
            return;
        }

        // 处理数据
        const strikes = Array.from(new Set(data.map(item => item.strike))).sort((a, b) => a - b);
        
        // 分离 call 和 put 数据
        const callData = data.filter(item => item.option_type === 'call');
        const putData = data.filter(item => item.option_type === 'put');

        // 准备数据系列
        const callVolume = strikes.map(strike => {
            const item = callData.find(d => d.strike === strike);
            return item ? item.total_volume : 0;
        });

        const putVolume = strikes.map(strike => {
            const item = putData.find(d => d.strike === strike);
            return item ? -item.total_volume : 0;
        });

        const callOpenInterest = strikes.map(strike => {
            const item = callData.find(d => d.strike === strike);
            return item ? item.total_open_interest : 0;
        });

        const putOpenInterest = strikes.map(strike => {
            const item = putData.find(d => d.strike === strike);
            return item ? -item.total_open_interest : 0;
        });

        const option = {
            title: {
                text: title,
                left: 'center'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    label: {
                        backgroundColor: '#6a7985'
                    }
                },
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderColor: '#ccc',
                borderWidth: 1,
                textStyle: {
                    color: '#333'
                },
                formatter: function(params) {
                    const strike = params[0].axisValue;
                    let html = `<div style="margin: 0 0 8px; font-weight: bold; font-size: 14px">行权价: ${strike}</div>`;
                    
                    // 分组数据
                    const volumeData = params.filter(p => p.seriesName.includes('成交量'));
                    const openInterestData = params.filter(p => p.seriesName.includes('持仓量'));
                    
                    // 添加成交量数据
                    html += `<div style="margin: 5px 0; font-weight: bold">成交量</div>`;
                    volumeData.forEach(param => {
                        const value = Math.abs(param.value);
                        const color = param.seriesName.includes('CALL') ? '#2563eb' : '#dc2626';
                        const type = param.seriesName.includes('CALL') ? 'CALL' : 'PUT';
                        html += `<div style="display: flex; justify-content: space-between; margin: 3px 0">
                            <span style="color: ${color}">● ${type}</span>
                            <span style="margin-left: 15px">${value.toLocaleString()}</span>
                        </div>`;
                    });
                    
                    // 添加持仓量数据
                    html += `<div style="margin: 5px 0; font-weight: bold">持仓量</div>`;
                    openInterestData.forEach(param => {
                        const value = Math.abs(param.value);
                        const color = param.seriesName.includes('CALL') ? '#16a34a' : '#ea580c';
                        const type = param.seriesName.includes('CALL') ? 'CALL' : 'PUT';
                        html += `<div style="display: flex; justify-content: space-between; margin: 3px 0">
                            <span style="color: ${color}">● ${type}</span>
                            <span style="margin-left: 15px">${value.toLocaleString()}</span>
                        </div>`;
                    });
                    
                    return html;
                }
            },
            legend: {
                data: ['CALL成交量', 'PUT成交量', 'CALL持仓量', 'PUT持仓量'],
                bottom: 10
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '60px',
                top: '60px',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: strikes,
                name: '行权价',
                nameLocation: 'middle',
                nameGap: 30,
                axisLabel: {
                    formatter: '{value}'
                }
            },
            yAxis: {
                type: 'value',
                name: '数量',
                axisLabel: {
                    formatter: function(value) {
                        return Math.abs(value).toLocaleString();
                    }
                }
            },
            series: [
                {
                    name: 'CALL成交量',
                    type: 'bar',
                    stack: 'volume',
                    data: callVolume,
                    itemStyle: {
                        color: '#2563eb'
                    }
                },
                {
                    name: 'PUT成交量',
                    type: 'bar',
                    stack: 'volume',
                    data: putVolume,
                    itemStyle: {
                        color: '#dc2626'
                    }
                },
                {
                    name: 'CALL持仓量',
                    type: 'bar',
                    stack: 'openInterest',
                    data: callOpenInterest,
                    itemStyle: {
                        color: '#16a34a'
                    }
                },
                {
                    name: 'PUT持仓量',
                    type: 'bar',
                    stack: 'openInterest',
                    data: putOpenInterest,
                    itemStyle: {
                        color: '#ea580c'
                    }
                }
            ]
        };

        chart.setOption(option);
    }

    resize() {
        this.shortTermChart && this.shortTermChart.resize();
        this.nearTermChart && this.nearTermChart.resize();
        this.farTermChart && this.farTermChart.resize();
    }
}

// 初始化图表
document.addEventListener('DOMContentLoaded', () => {
    new OptionsChart();
}); 