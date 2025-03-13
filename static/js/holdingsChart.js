class HoldingsChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = {top: 40, right: 150, bottom: 30, left: 50}; // 增加右边距来放置图例
        
        // 创建一个相对定位的容器来包含SVG和tooltip
        this.container = d3.select(`#${containerId}`)
            .style('position', 'relative'); // 添加相对定位
        
        this.width = document.getElementById(containerId).clientWidth - this.margin.left - this.margin.right;
        this.height = document.getElementById(containerId).clientHeight - this.margin.top - this.margin.bottom;
        
        // 将svg添加到容器中
        this.svg = this.container
            .append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
            
        // 创建tooltip div并添加到容器中
        this.tooltip = this.container
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('z-index', '1000');
            
        this.init();
    }

    init() {
        // 初始化坐标轴
        this.x = d3.scaleTime().range([0, this.width]);
        this.y = d3.scaleLinear().range([this.height, 0]);
        
        this.xAxis = this.svg.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${this.height})`);
            
        this.yAxis = this.svg.append('g')
            .attr('class', 'axis y-axis');
            
        // 添加标题
        this.title = this.svg.append('text')
            .attr('class', 'chart-title')
            .attr('x', this.width / 2)
            .attr('y', -20)
            .attr('text-anchor', 'middle');

        // 添加图例容器
        this.legend = this.svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${this.width + 20}, 0)`);
    }

    async loadData(etfSymbol, startDate) {
        try {
            const response = await fetch(`/api/etf/holdings/${etfSymbol}?start_date=${startDate}`);
            const data = await response.json();
            this.updateChart(data, etfSymbol);
        } catch (error) {
            console.error('Error loading holdings data:', error);
        }
    }

    updateChart(data, etfSymbol) {
        // 过滤掉无效数据
        data = data.filter(d => d.normalized_price != null);
        
        // 处理数据
        const parseDate = d3.timeParse('%Y-%m-%d');
        data.forEach(d => {
            d.trade_date = parseDate(d.trade_date);
            d.normalized_price = +d.normalized_price;
        });
        
        // 清除现有内容
        this.svg.selectAll('.line').remove();
        this.legend.selectAll('*').remove();
        
        // 更新标题
        this.title.text(`${etfSymbol}持仓股票价格走势`);
        
        // 更新比例尺域
        this.x.domain(d3.extent(data, d => d.trade_date));
        this.y.domain([0, d3.max(data, d => d.normalized_price)]);
        
        // 更新坐标轴
        this.xAxis.call(d3.axisBottom(this.x));
        this.yAxis.call(d3.axisLeft(this.y));
        
        // 创建线条生成器
        const line = d3.line()
            .x(d => this.x(d.trade_date))
            .y(d => this.y(d.normalized_price))
            .defined(d => !isNaN(d.normalized_price)); // 处理缺失值
            
        // 按股票分组
        const stockGroups = d3.group(data, d => d.stock_symbol);
        
        // 创建颜色比例尺
        const colors = d3.scaleOrdinal(d3.schemeCategory10);
        
        // 绘制线条和添加图例
        let legendY = 0;
        stockGroups.forEach((values, key) => {
            const color = colors(key);
            
            // 绘制线条
            this.svg.append('path')
                .datum(values)
                .attr('class', 'line')
                .attr('d', line)
                .style('stroke', color)
                .on('mouseover', (event, d) => {
                    this.handleMouseOver(key);
                    this.showTooltip(key, d, event);
                })
                .on('mousemove', (event, d) => {
                    this.updateTooltipPosition(event);
                })
                .on('mouseout', (event, d) => {
                    this.handleMouseOut();
                    this.hideTooltip();
                });

            // 添加图例项
            const legendItem = this.legend.append('g')
                .attr('transform', `translate(0, ${legendY})`);

            legendItem.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', 20)
                .attr('y2', 0)
                .style('stroke', color)
                .style('stroke-width', 2);

            legendItem.append('text')
                .attr('x', 25)
                .attr('y', 4)
                .text(key)
                .style('font-size', '12px');

            legendY += 20;
        });
    }

    showTooltip(stockSymbol, data, event) {
        const mouseDate = this.x.invert(d3.pointer(event)[0]);
        const bisect = d3.bisector(d => d.trade_date).left;
        const index = bisect(data, mouseDate);
        const currentData = data[index];

        if (currentData) {
            this.tooltip.html(`
                <div style="font-weight: bold; margin-bottom: 5px;">${stockSymbol}</div>
                <div>日期: ${d3.timeFormat('%Y-%m-%d')(currentData.trade_date)}</div>
                <div>价格指数: ${currentData.normalized_price.toFixed(2)}</div>
            `)
            .style('opacity', 1);
        }
        this.updateTooltipPosition(event);
    }

    updateTooltipPosition(event) {
        const tooltipWidth = this.tooltip.node().offsetWidth;
        const tooltipHeight = this.tooltip.node().offsetHeight;
        const containerRect = this.container.node().getBoundingClientRect();
        
        // 计算相对于容器的位置
        const relativeX = event.pageX - containerRect.left;
        const relativeY = event.pageY - containerRect.top;
        
        let left = relativeX + 10;
        let top = relativeY - tooltipHeight/2;

        // 确保提示框不会超出容器边界
        if (left + tooltipWidth > containerRect.width) {
            left = relativeX - tooltipWidth - 10;
        }
        if (top < 0) {
            top = 0;
        } else if (top + tooltipHeight > containerRect.height) {
            top = containerRect.height - tooltipHeight;
        }

        this.tooltip
            .style('left', `${left}px`)
            .style('top', `${top}px`);
    }

    hideTooltip() {
        this.tooltip.style('opacity', 0);
    }

    handleMouseOver(stockSymbol) {
        // 高亮显示选中的线条
        this.svg.selectAll('.line')
            .style('opacity', d => d[0].stock_symbol === stockSymbol ? 1 : 0.2);
            
        // 高亮显示对应的图例
        this.legend.selectAll('text')
            .style('font-weight', d => d === stockSymbol ? 'bold' : 'normal');
    }

    handleMouseOut() {
        // 恢复所有线条的显示
        this.svg.selectAll('.line')
            .style('opacity', 1);
            
        // 恢复图例样式
        this.legend.selectAll('text')
            .style('font-weight', 'normal');
    }

    clear() {
        // 清除图表内容
        this.svg.selectAll('.line').remove();
        this.legend.selectAll('*').remove();
        this.title.text('');
    }
}

// 等待DOM加载完成后再初始化图表
let holdingsChart;
document.addEventListener('DOMContentLoaded', () => {
    holdingsChart = new HoldingsChart('holdings-chart');
}); 