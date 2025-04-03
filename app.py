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
    latest_date = df['trade_date'].iloc[0] if not df.empty else None
    
    return jsonify({
        'data': df.to_dict(orient='records'),
        'latest_date': latest_date.strftime('%Y-%m-%d') if latest_date else None
    })

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

@app.route('/api/us_bonds')
def get_us_bonds_data():
    query = text("""
        SELECT 
            cast("Date" as date) as trade_date,
            cast("1 Yr" as float) as yield_1y,
            cast("10 Yr" as float) as yield_10y,
            cast("20 Yr" as float) as yield_20y
        FROM t_bonds_daily 
        WHERE country = 'US' 
            and "Date" >= '2024-01-01'
        ORDER BY "Date" asc
    """)
    
    try:
        df = pd.read_sql(query, engine)
        
        if df.empty:
            print("No data found in database")
            return jsonify([])
            
        # 确保日期格式正确
        df['trade_date'] = pd.to_datetime(df['trade_date']).dt.strftime('%Y-%m-%d')
        
        # 分别处理数值列
        numeric_columns = ['yield_1y', 'yield_10y', 'yield_20y']
        for col in numeric_columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            
        # 删除任何空值
        df = df.dropna()
        
        print(f"After processing: {len(df)} rows of data")
        return jsonify(df.to_dict(orient='records'))
    except Exception as e:
        print(f"Error in get_us_bonds_data: {str(e)}")
        return jsonify([])

@app.route('/options')
def options():
    return render_template('options.html', active_page='options')

@app.route('/api/options/data/<symbol>')
def get_options_data(symbol):
    # 允许的symbol列表
    allowed_symbols = ['GLD', 'UVXY', 'SPY', 'QQQ', 'TLT', 'IWM', 'KRE', 'FXI', 'SQQQ', 'HYG', 'BITO', 'AMD', 'TSLA', 'IAU']
    
    if symbol not in allowed_symbols:
        return jsonify({'error': 'Invalid symbol'})
    
    query = text("""
        WITH latest_date AS (
            SELECT MAX(CAST(regular_market_datetime AS DATE)) as max_date
            FROM options_data
            WHERE symbol = :symbol
        ),
        summary AS (
            SELECT 
                cast(strike as float) as strike,
                option_type,
                expiration_date,
                COALESCE(SUM(cast(volume as bigint)), 0) as total_volume,
                COALESCE(SUM(cast(open_interest as bigint)), 0) as total_open_interest,
                CASE 
                    WHEN expiration_date <= CURRENT_DATE + INTERVAL '2 weeks' THEN 'short'
                    WHEN expiration_date <= CURRENT_DATE + INTERVAL '3 months' THEN 'near'
                    ELSE 'far'
                END as term
            FROM options_data, latest_date
            WHERE symbol = :symbol
            AND CAST(regular_market_datetime AS DATE) = latest_date.max_date
            GROUP BY strike, option_type, expiration_date
        )
        SELECT 
            strike,
            option_type,
            term,
            total_volume,
            total_open_interest
        FROM summary
        ORDER BY strike
    """)
    
    try:
        # 获取最新日期
        date_query = text("""
            SELECT MAX(CAST(regular_market_datetime AS DATE)) as latest_date
            FROM options_data
            WHERE symbol = :symbol
        """)
        latest_date = pd.read_sql(date_query, engine, params={'symbol': symbol}).iloc[0]['latest_date']
        
        df = pd.read_sql(query, engine, params={'symbol': symbol})
        
        # 确保数值类型正确
        df['strike'] = pd.to_numeric(df['strike'], errors='coerce')
        df['total_volume'] = pd.to_numeric(df['total_volume'], errors='coerce')
        df['total_open_interest'] = pd.to_numeric(df['total_open_interest'], errors='coerce')
        
        # 删除任何空值
        df = df.dropna()
        
        # 分离短期、近期和远期数据
        short_term = df[df['term'] == 'short'].to_dict(orient='records')
        near_term = df[df['term'] == 'near'].to_dict(orient='records')
        far_term = df[df['term'] == 'far'].to_dict(orient='records')
        
        return jsonify({
            'short_term': short_term,
            'near_term': near_term,
            'far_term': far_term,
            'latest_date': latest_date.strftime('%Y-%m-%d') if latest_date else None
        })
    except Exception as e:
        print(f"Error in get_options_data: {str(e)}")
        return jsonify({'error': str(e)})

@app.route('/api/options/position_value/<symbol>')
def get_options_position_value(symbol):
    # 允许的symbol列表
    allowed_symbols = ['GLD', 'UVXY', 'SPY', 'QQQ', 'TLT', 'IWM', 'KRE', 'FXI', 'SQQQ', 'HYG', 'BITO', 'AMD', 'TSLA', 'IAU']
    
    if symbol not in allowed_symbols:
        return jsonify({'error': 'Invalid symbol'})
    
    query = text("""
        WITH latest_date AS (
            SELECT MAX(CAST(regular_market_datetime AS DATE)) as max_date
            FROM options_data
            WHERE symbol = :symbol
        ),
        latest_price AS (
            SELECT "Close" as last_price
            FROM t_yf_stock_daily, latest_date
            WHERE symbol = :symbol
            AND cast("Date" as date) = latest_date.max_date
        ),
        summary AS (
            SELECT 
                option_type,
                CASE 
                    WHEN ABS(strike - latest_price.last_price) / latest_price.last_price <= 0.1 THEN 'main'  -- 10%以内为主战场
                    ELSE 'support'  -- 其他为后援部队
                END as position_type,
                SUM(open_interest * 100 * strike) as notional_value  -- 100是每张期权对应的股数
            FROM options_data, latest_date, latest_price
            WHERE symbol = :symbol
            AND CAST(regular_market_datetime AS DATE) = latest_date.max_date
            GROUP BY 
                option_type,
                CASE 
                    WHEN ABS(strike - latest_price.last_price) / latest_price.last_price <= 0.1 THEN 'main'
                    ELSE 'support'
                END
        )
        SELECT 
            option_type,
            position_type,
            notional_value / 100000000.0 as value_billions  -- 转换为亿美元
        FROM summary
    """)
    
    try:
        df = pd.read_sql(query, engine, params={'symbol': symbol})
        
        # 处理数据为所需格式
        result = {
            'main_battle': {
                'call': 0.0,
                'put': 0.0
            },
            'support': {
                'call': 0.0,
                'put': 0.0
            },
            'total': {
                'call': 0.0,
                'put': 0.0
            }
        }
        
        for _, row in df.iterrows():
            position_key = 'main_battle' if row['position_type'] == 'main' else 'support'
            option_type = row['option_type']
            value = float(row['value_billions'])
            
            result[position_key][option_type] = round(value, 2)
            result['total'][option_type] += value
        
        # 四舍五入总计
        result['total']['call'] = round(result['total']['call'], 2)
        result['total']['put'] = round(result['total']['put'], 2)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in get_options_position_value: {str(e)}")
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True)
