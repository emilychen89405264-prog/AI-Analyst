import MetaTrader5 as mt5
import json
import os
import sys

# MT5 全域登入設定
MT5_LOGIN = 5050034212
MT5_PASSWORD = "2k_qRyXq"
MT5_SERVER = "MetaQuotes-Demo"
MT5_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"

def get_all_active_prices():
    if not mt5.initialize(path=MT5_PATH, login=MT5_LOGIN, password=MT5_PASSWORD, server=MT5_SERVER):
        return {"error": "MT5 Initialize Failed"}

    core_symbols = ["XAUUSD", "GOLD", "EURUSD", "USDJPY", "GBPUSD", "US30", "NAS100"]
    for s in core_symbols:
        mt5.symbol_select(s, True)
        found = mt5.symbols_get(f"*{s}*")
        if found: mt5.symbol_select(found[0].name, True)

    symbols = mt5.symbols_get()
    results = {}
    
    for s in symbols:
        if s.select:
            tick = mt5.symbol_info_tick(s.name)
            if tick and tick.bid > 0:
                price = (tick.bid + tick.ask) / 2
                results[s.name.upper()] = {"last": price}
    
    mt5.shutdown()
    return results

if __name__ == "__main__":
    # 確保輸出只有 JSON，沒有任何文字干擾
    prices = get_all_active_prices()
    sys.stdout.write(json.dumps(prices))
    sys.stdout.flush()
