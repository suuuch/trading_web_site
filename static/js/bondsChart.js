class BondsChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.chart = echarts.init(document.getElementById(containerId));
        this.loadData();
    }

    async loadData() {
        try {
            const [usResponse, jpResponse] = await Promise.all([
                fetch('/api/bonds/US'),
                fetch('/api/bonds/JP')
            ]);
            
            const usData = await usResponse.json();
            const jpData = await jpResponse.json();
            
            this.updateChart(usData, jpData);
        } catch (error) {
            console.error('Error loading bonds data:', error);
        }
    }

    updateChart(usData, jpData) {
        if (!usData.length || !jpData.length) {
            console.error('No data available');
            return;
        }

        // 处理数据
        const processData = data => {
            return data.map(d => [d.trade_date, parseFloat(d.yield)]);
        };

        const usYields = processData(usData);
        const jpYields = processData(jpData);

        // 计算差值
        const diffYields = usYields.map((usPoint, index) => {
            const jpPoint = jpYields.find(jp => jp[0] === usPoint[0]);
            if (jpPoint) {
                return [usPoint[0], +(usPoint[1] - jpPoint[1]).toFixed(2)];
            }
            return null;
        }).filter(point => point !== null);

        const option = {
            title: {
                text: '美日国债收益率对比',
                left: 'center',
                top: 10
            },
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    const date = new Date(params[0].axisValue);
                    const formattedDate = date.toISOString().split('T')[0];
                    
                    const uniqueParams = Array.from(new Set(params.map(param => param.seriesName)))
                        .map(name => params.find(param => param.seriesName === name));
                    
                    let html = `<div style="font-weight: bold">${formattedDate}</div>`;
                    uniqueParams.forEach(param => {
                        let color;
                        if (param.seriesName === '美国国债') color = '#2563eb';
                        else if (param.seriesName === '日本国债') color = '#dc2626';
                        else color = '#16a34a';  // 差值线的颜色
                        
                        html += `<div style="color: ${color}">${param.seriesName}: ${param.value[1].toFixed(2)}%</div>`;
                    });
                    
                    return html;
                }
            },
            legend: {
                data: ['美国国债', '日本国债', '收益率差值'],
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
                type: 'time',
                boundaryGap: false,
                axisLabel: {
                    formatter: '{yyyy}-{MM}-{dd}'
                }
            },
            yAxis: [
                {
                    type: 'value',
                    name: '收益率 (%)',
                    nameLocation: 'middle',
                    nameGap: 40,
                    axisLabel: {
                        formatter: '{value}%'
                    }
                },
                {
                    type: 'value',
                    name: '差值 (%)',
                    nameLocation: 'middle',
                    nameGap: 40,
                    axisLabel: {
                        formatter: '{value}%'
                    }
                }
            ],
            series: [
                {
                    name: '美国国债',
                    type: 'line',
                    data: usYields,
                    itemStyle: {
                        color: '#2563eb'
                    },
                    emphasis: {
                        focus: 'series'
                    },
                    showSymbol: false,
                    smooth: true
                },
                {
                    name: '日本国债',
                    type: 'line',
                    data: jpYields,
                    itemStyle: {
                        color: '#dc2626'
                    },
                    emphasis: {
                        focus: 'series'
                    },
                    showSymbol: false,
                    smooth: true
                },
                {
                    name: '收益率差值',
                    type: 'line',
                    data: diffYields,
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

    // 添加窗口大小改变时的自适应
    resize() {
        this.chart && this.chart.resize();
    }
}

// 初始化图表
document.addEventListener('DOMContentLoaded', () => {
    const bondsChart = new BondsChart('bonds-chart');
    
    // 添加窗口大小改变的监听
    window.addEventListener('resize', () => bondsChart.resize());
}); 