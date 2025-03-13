async function updateEtfInfo(etfSymbol) {
    try {
        const response = await fetch(`/api/etf/info/${etfSymbol}`);
        const data = await response.json();
        
        const infoPanel = document.getElementById('etf-info');
        
        // 创建信息HTML
        const html = `
            <h4 class="text-sm font-semibold mb-2">${etfSymbol}</h4>
            <h5 class="text-xs text-gray-600 mb-1">持仓股票:</h5>
            <ul class="text-xs space-y-1">
                ${data.map(holding => `
                    <li class="flex justify-between">
                        <span class="text-gray-800">${holding.stock_symbol}</span>
                        <span class="text-gray-500">${(+holding.weight).toFixed(2)}%</span>
                    </li>
                `).join('')}
            </ul>
        `;
        
        infoPanel.innerHTML = html;
    } catch (error) {
        console.error('Error loading ETF info:', error);
    }
} 