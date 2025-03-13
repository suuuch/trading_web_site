import pandas as pd
import numpy as np

class DataProcessor:
    @staticmethod
    def normalize_prices(df):
        """将价格标准化为基于首日价格的指数"""
        symbols = df['etf_symbol'].unique()
        normalized_data = []
        
        for symbol in symbols:
            symbol_data = df[df['etf_symbol'] == symbol].copy()
            # 确保close列为数值类型
            symbol_data['close'] = pd.to_numeric(symbol_data['close'], errors='coerce')
            # 获取第一个非NaN的价格
            first_price = symbol_data['close'].dropna().iloc[0]
            if pd.notna(first_price) and first_price != 0:
                symbol_data['normalized_price'] = (symbol_data['close'] / first_price) * 100
            else:
                symbol_data['normalized_price'] = np.nan
            normalized_data.append(symbol_data)
        
        if len(normalized_data) > 0:
            result = pd.concat(normalized_data)
            # 确保日期格式正确
            result['trade_date'] = pd.to_datetime(result['trade_date']).dt.strftime('%Y-%m-%d')
            return result
        else:
            return pd.DataFrame()

    @staticmethod
    def process_holdings_data(df):
        """处理持仓数据，计算标准化价格"""
        symbols = df['stock_symbol'].unique()
        normalized_data = []
        
        for symbol in symbols:
            symbol_data = df[df['stock_symbol'] == symbol].copy()
            # 确保close列为数值类型
            symbol_data['close'] = pd.to_numeric(symbol_data['close'], errors='coerce')
            # 获取第一个非NaN的价格
            first_price = symbol_data['close'].dropna().iloc[0]
            if pd.notna(first_price) and first_price != 0:
                symbol_data['normalized_price'] = (symbol_data['close'] / first_price) * 100
            else:
                symbol_data['normalized_price'] = np.nan
            normalized_data.append(symbol_data)
            
        if len(normalized_data) > 0:
            result = pd.concat(normalized_data)
            # 确保日期格式正确
            result['trade_date'] = pd.to_datetime(result['trade_date']).dt.strftime('%Y-%m-%d')
            return result 
        else:
            return pd.DataFrame()