class USBondsChart {
    constructor() {
        this.chart = echarts.init(document.getElementById('us-bonds-chart'));
        this.loadData();
    }

    async loadData() {
        try {
            const response = await fetch('/api/us_bonds');
            const data = await response.json();
            this.updateChart(data);
        } catch (error) {
            console.error('Error loading US bonds data:', error);
        }
    }

    updateChart(data) {
        if (!data.length) {
            console.error('No data available');
            return;
        }

        const dates = data.map(d => d.trade_date);
        const yield1y = data.map(d => d.yield_1y);
        const yield10y = data.map(d => d.yield_10y);
        const yield20y = data.map(d => d.yield_20y);

        const option = {
            title: {
                text: '美债收益率期限结构',
                left: 'center',
                top: 10
            },
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    const date = params[0].axisValue;
                    let html = `<div style="font-weight: bold">${date}</div>`;
                    params.forEach(param => {
                        html += `<div style="color: ${param.color}">${param.seriesName}: ${param.value.toFixed(2)}%</div>`;
                    });
                    return html;
                }
            },
            legend: {
                data: ['1年期', '10年期', '20年期'],
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
                boundaryGap: false,
                data: dates,
                axisLabel: {
                    formatter: '{value}'
                }
            },
            yAxis: {
                type: 'value',
                name: '收益率 (%)',
                nameLocation: 'middle',
                nameGap: 40,
                axisLabel: {
                    formatter: '{value}%'
                }
            },
            series: [
                {
                    name: '1年期',
                    type: 'line',
                    data: yield1y,
                    itemStyle: {
                        color: '#2563eb'  // 蓝色
                    },
                    emphasis: {
                        focus: 'series'
                    },
                    showSymbol: false,
                    smooth: true
                },
                {
                    name: '10年期',
                    type: 'line',
                    data: yield10y,
                    itemStyle: {
                        color: '#dc2626'  // 红色
                    },
                    emphasis: {
                        focus: 'series'
                    },
                    showSymbol: false,
                    smooth: true
                },
                {
                    name: '20年期',
                    type: 'line',
                    data: yield20y,
                    itemStyle: {
                        color: '#16a34a'  // 绿色
                    },
                    emphasis: {
                        focus: 'series'
                    },
                    showSymbol: false,
                    smooth: true
                }
            ],
            dataZoom: [
                {
                    type: 'inside',
                    start: 0,
                    end: 100
                },
                {
                    show: true,
                    type: 'slider',
                    bottom: 10,
                    start: 0,
                    end: 100
                }
            ]
        };

        this.chart.setOption(option);
    }

    resize() {
        this.chart && this.chart.resize();
    }
}

// 初始化图表
document.addEventListener('DOMContentLoaded', () => {
    const usBondsChart = new USBondsChart();
    window.addEventListener('resize', () => usBondsChart.resize());
}); 