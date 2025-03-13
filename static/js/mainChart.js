class MainChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = {top: 20, right: 20, bottom: 30, left: 50};
        this.width = document.getElementById(containerId).clientWidth - this.margin.left - this.margin.right;
        this.height = document.getElementById(containerId).clientHeight - this.margin.top - this.margin.bottom;
        
        this.svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
            
        // 初始化控件
        this.startDateInput = document.getElementById('start-date');
        
        // 设置默认日期
        this.startDateInput.value = '2025-01-01';

        // 存储选中的ETF（默认全部选中）
        this.selectedEtfs = new Set();
        
        // 添加事件监听
        this.startDateInput.addEventListener('change', () => this.handleDateChange());
        
        this.init();
        this.loadEtfList();
    }

    async loadEtfList() {
        try {
            const response = await fetch('/api/etf/list');
            const etfs = await response.json();
            
            // 生成颜色比例尺
            this.colors = d3.scaleOrdinal(d3.schemeCategory10);
            
            // 默认选中所有ETF
            etfs.forEach(etf => {
                this.selectedEtfs.add(etf);
            });

            // 初始加载数据
            this.loadData();
        } catch (error) {
            console.error('Error loading ETF list:', error);
        }
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
        this.svg.append('text')
            .attr('class', 'chart-title')
            .attr('x', this.width / 2)
            .attr('y', 0)
            .attr('text-anchor', 'middle')
            .text('ETF价格走势对比');
    }

    async loadData() {
        try {
            const startDate = this.startDateInput.value;
            const response = await fetch(`/api/etf/daily?start_date=${startDate}`);
            const data = await response.json();
            this.data = data;
            this.updateChart(data);
            
            // 更新holdings图表（显示第一个ETF的数据）
            if (data.length > 0) {
                const firstEtf = data[0].etf_symbol;
                holdingsChart.loadData(firstEtf, startDate);
                updateEtfInfo(firstEtf);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    updateChart(data) {
        if (!data) return;
        
        // 过滤掉无效数据
        data = data.filter(d => d.normalized_price != null);
        
        // 处理数据
        const parseDate = d3.timeParse('%Y-%m-%d');
        data.forEach(d => {
            d.trade_date = parseDate(d.trade_date);
            d.normalized_price = +d.normalized_price;
        });
        
        // 清除现有的线条
        this.svg.selectAll('.line').remove();
        
        // 更新比例尺域
        this.x.domain(d3.extent(data, d => d.trade_date));
        this.y.domain([0, d3.max(data, d => d.normalized_price)]);
        
        // 更新坐标轴
        this.xAxis.call(d3.axisBottom(this.x));
        this.yAxis.call(d3.axisLeft(this.y));
        
        // 创建线条生成器
        const line = d3.line()
            .x(d => this.x(d.trade_date))
            .y(d => this.y(d.normalized_price));
            
        // 按ETF分组
        const etfGroups = d3.group(data, d => d.etf_symbol);

        // 绘制线条
        etfGroups.forEach((values, key) => {
            this.svg.append('path')
                .datum(values)
                .attr('class', 'line')
                .attr('id', `line-${key}`)
                .attr('d', line)
                .style('stroke', this.colors(key))
                .style('cursor', 'pointer')
                .on('mouseover', (event, d) => this.handleMouseOver(key))
                .on('mouseout', this.handleMouseOut.bind(this))
                .on('click', (event, d) => this.handleClick(key));
        });
    }

    handleMouseOver(etfSymbol) {
        // 只改变线条颜色，不更新附图
        this.svg.selectAll('.line')
            .classed('inactive', d => d[0].etf_symbol !== etfSymbol);
    }

    handleMouseOut() {
        // 恢复所有线条颜色
        this.svg.selectAll('.line')
            .classed('inactive', false);
    }

    handleClick(etfSymbol) {
        // 点击时更新附图和ETF信息
        holdingsChart.loadData(etfSymbol, this.startDateInput.value);
        updateEtfInfo(etfSymbol);
    }

    handleDateChange() {
        this.loadData();
    }
}

// 等待DOM加载完成后再初始化图表
document.addEventListener('DOMContentLoaded', () => {
    const mainChart = new MainChart('main-chart');
}); 