from flask import Flask, render_template, jsonify, request
from database.db_operations import DatabaseOperations
from utils.data_processor import DataProcessor
import pandas as pd
import numpy as np
import json
from datetime import datetime
from sqlalchemy import create_engine,text
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv()

app = Flask(__name__)
db = DatabaseOperations()
data_processor = DataProcessor()

# 从环境变量构建数据库连接字符串
DATABASE_URL = os.getenv('DATABASE_URL')


# 创建数据库引擎
engine = create_engine(DATABASE_URL,echo=True)

# 添加JSON编码器来处理NaN和日期
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, pd.Timestamp):
            return obj.strftime('%Y-%m-%d')
        if pd.isna(obj):
            return None
        if isinstance(obj, np.float64):
            return float(obj)
        return super().default(obj)

app.json_encoder = CustomJSONEncoder

@app.route('/')
def index():
    return render_template('index.html', active_page='home')

@app.route('/bonds')
def bonds():
    return render_template('bonds.html', active_page='bonds')

@app.route('/api/etf/daily')
def get_etf_daily():
    start_date = request.args.get('start_date', '2025-01-01')
    etf_data = db.get_etf_daily_data(start_date)
    normalized_data = data_processor.normalize_prices(etf_data)
    normalized_data = normalized_data.replace({np.nan: None})
    return jsonify(normalized_data.to_dict(orient='records'))

@app.route('/api/etf/holdings/<etf_symbol>')
def get_etf_holdings(etf_symbol):
    start_date = request.args.get('start_date', '2025-01-01')
    holdings_data = db.get_etf_holdings(etf_symbol, start_date)
    normalized_data = data_processor.process_holdings_data(holdings_data)
    normalized_data = normalized_data.replace({np.nan: None})
    return jsonify(normalized_data.to_dict(orient='records'))

@app.route('/api/etf/info/<etf_symbol>')
def get_etf_info(etf_symbol):
    etf_info = db.get_etf_info(etf_symbol)
    # 确保数据类型正确
    etf_info = etf_info.replace({np.nan: None})
    return jsonify(etf_info.to_dict(orient='records'))

@app.route('/api/etf/list')
def get_etf_list():
    etf_list = db.get_etf_list()
    return jsonify(etf_list)

@app.route('/api/bonds/<country>')
def get_bonds_data(country):
    query = text(f"""
        SELECT 
            cast("Date" as date) as trade_date, 
            cast("10 Yr" as float) as yield 
        FROM t_bonds_daily 
        WHERE country = '{country.upper()}' and "Date" >= '2025-01-01'
        ORDER BY 1 desc 
    """)
    
    try:
        df = pd.read_sql(query, engine)
        # 确保日期格式正确
        df['trade_date'] = pd.to_datetime(df['trade_date']).dt.strftime('%Y-%m-%d')
        # 确保收益率是数值类型
        df['yield'] = pd.to_numeric(df['yield'], errors='coerce')
        # 删除任何空值
        df = df.dropna()
        
        return jsonify(df.to_dict(orient='records'))
    except Exception as e:
        return jsonify([])

@app.route('/shortsell')
def shortsell():
    return render_template('shortsell.html', active_page='shortsell')

@app.route('/api/shortsell/latest')
def get_latest_shortsell():
    query = text("""
        WITH latest_date AS (
            SELECT MAX(日期) as max_date 
            FROM eastmoney_hkstock_shortsell
        )
        SELECT 
            股票代码,
            股票名称,
            最新价,
            "沽空数量(股)" as short_volume,
            沽空平均价 as short_price,
            "沽空金额(万港元)" as short_amount,
            "总成交金额(万港元)" as total_amount,
            "沽空占成交比例%" as short_ratio,
            日期 as trade_date
        FROM eastmoney_hkstock_shortsell, latest_date
        WHERE 日期 = latest_date.max_date
        ORDER BY "沽空占成交比例%" DESC
    """)
    
    df = pd.read_sql(query, engine)
    return jsonify(df.to_dict(orient='records'))

@app.route('/api/shortsell/history/<stock_code>')
def get_stock_shortsell_history(stock_code):
    query = text(f"""
        SELECT 
            股票代码,
            股票名称,
            "沽空数量(股)" as short_volume,
            沽空平均价 as short_price,
            "沽空金额(万港元)" as short_amount,
            "总成交金额(万港元)" as total_amount,
            "沽空占成交比例%" as short_ratio,
            日期 as trade_date
        FROM eastmoney_hkstock_shortsell
        WHERE 股票代码 = {stock_code}
        AND 日期 >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY 日期
    """)
    
    df = pd.read_sql(query, engine)
    return jsonify(df.to_dict(orient='records'))

if __name__ == '__main__':
    app.run(debug=True)
