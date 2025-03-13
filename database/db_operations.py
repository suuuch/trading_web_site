import os
import pandas as pd
from sqlalchemy import create_engine,text
from dotenv import load_dotenv

load_dotenv()

class DatabaseOperations:
    def __init__(self):
        # 从环境变量获取数据库连接信息
        self.engine = create_engine(os.getenv('DATABASE_URL'),echo=True)

    def get_etf_daily_data(self, start_date='2025-01-01'):
        """获取所有ETF的日线数据"""
        query = text("""
        SELECT d.symbol as etf_symbol, "Date" as trade_date, "Close" as close 
        FROM t_etf_daily d join t_etf_holding h on d.symbol = h.symbol
        where "Date" >= :start_date and d.symbol not in ('UVIX')
        ORDER BY trade_date
        """)
        return pd.read_sql(query, self.engine, params={'start_date': start_date})

    def get_etf_holdings(self, etf_symbol, start_date='2025-01-01'):
        """获取特定ETF的持仓数据"""
        query = text("""
        SELECT s.symbol stock_symbol, s."Date" as trade_date, s."Close" as close
        FROM t_etf_holding h
        JOIN t_yf_stock_daily s ON h.asset = s.symbol
        WHERE h.symbol = :etf_symbol and "Date" >= :start_date
        ORDER BY s."Date"
        """)
        return pd.read_sql(query, self.engine, params={
            'etf_symbol': etf_symbol,
            'start_date': start_date
        })

    def get_etf_info(self, etf_symbol:str): 
        """获取ETF的详细信息"""
        print(etf_symbol)
        query = text(f"""
        SELECT DISTINCT h.symbol asetf_symbol, h.asset as stock_symbol, h."Holding Percent" * 100 as weight
        FROM t_etf_holding h
        WHERE h.symbol in ('{etf_symbol}')
        ORDER BY 3 DESC
        """)
        return pd.read_sql(query, self.engine) 

    def get_etf_list(self):
        """获取所有ETF的列表"""
        query = text("""
        SELECT DISTINCT symbol 
        FROM t_etf_daily 
        WHERE symbol NOT IN ('UVIX')
        ORDER BY symbol
        """)
        result = pd.read_sql(query, self.engine)
        return result['symbol'].tolist() 