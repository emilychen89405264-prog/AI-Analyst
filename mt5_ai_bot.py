import MetaTrader5 as mt5
import pandas as pd
import json
import os
import sys
import time
import argparse
from datetime import datetime, timedelta

# --- 配置區 ---
MT5_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"
MT5_LOGIN = 5050034212
MT5_PASSWORD = "2k_qRyXq"
MT5_SERVER = "MetaQuotes-Demo"

def initialize_mt5():
    if not mt5.initialize():
        print("DEBUG: Active MT5 not found, trying explicit path...")
        if not mt5.initialize(path=MT5_PATH, login=MT5_LOGIN, password=MT5_PASSWORD, server=MT5_SERVER):
            print("MT5 initialize() failed, error code =", mt5.last_error())
            return False
    return True

def get_symbol_info(symbol):
    info = mt5.symbol_info(symbol)
    if info is None:
        clean_symbol = symbol.replace("/", "")
        info = mt5.symbol_info(clean_symbol)
        if info: return info, clean_symbol
        return None, symbol
    return info, symbol

def close_mt5_position(symbol_input):
    info, symbol_mt5 = get_symbol_info(symbol_input)
    if not info:
        print(f"[ERROR] [CLOSE] Symbol not found: {symbol_input}")
        return False

    positions = mt5.positions_get(symbol=symbol_mt5)
    if not positions:
        print(f"[WARN] [CLOSE] No active positions for {symbol_mt5}")
        return False

    success = True
    for pos in positions:
        tick = mt5.symbol_info_tick(symbol_mt5)
        type_close = mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
        price = tick.bid if pos.type == mt5.POSITION_TYPE_BUY else tick.ask

        filling_type = mt5.ORDER_FILLING_FOK
        if (info.filling_mode & 2): filling_type = mt5.ORDER_FILLING_IOC
        elif (info.filling_mode & 1): filling_type = mt5.ORDER_FILLING_FOK
        else: filling_type = mt5.ORDER_FILLING_RETURN

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "position": pos.ticket,
            "symbol": symbol_mt5,
            "volume": pos.volume,
            "type": type_close,
            "price": price,
            "deviation": 20,
            "magic": 20260503,
            "comment": "AI Manual Exit",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling_type,
        }
        
        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            print(f"[ERROR] [CLOSE] Ticket #{pos.ticket} failed: {result.retcode}")
            success = False
        else:
            print(f"[OK] [CLOSE] Ticket #{pos.ticket} closed successfully.")
    
    return success

def get_history_file_path():
    # 這裡改成相對於腳本路徑，更穩定
    base_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(base_dir, "public")
    os.makedirs(public_dir, exist_ok=True)
    return os.path.join(public_dir, "trade_history.json")

def save_trade_history(signal, order_ticket, execute_price, volume, sl, tp):
    history_file = get_history_file_path()
    history = []
    if os.path.exists(history_file):
        try:
            with open(history_file, "r", encoding="utf-8") as f:
                history = json.load(f)
        except: pass
    new_record = {
        "id": order_ticket,
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "symbol": signal.get("symbol_mt5", signal.get("symbol")),
        "action": signal["action"],
        "entry_price": execute_price,
        "volume": volume,
        "take_profit": tp,
        "stop_loss": sl,
        "reason": signal.get("reason"),
        "profit": None,
        "status": "OPEN"
    }
    history.append(new_record)
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=4, ensure_ascii=False)

def update_trade_profits():
    history_file = get_history_file_path()
    if not os.path.exists(history_file): return
    
    if not mt5.initialize(): return
    
    with open(history_file, "r", encoding="utf-8") as f:
        history = json.load(f)
    
    deals = mt5.history_deals_get(datetime.now() - timedelta(days=7), datetime.now() + timedelta(days=1))
    deals_dict = {d.position_id: d for d in deals if d.entry == mt5.DEAL_ENTRY_OUT} if deals else {}
    
    active_positions = mt5.positions_get()
    active_dict = {p.ticket: p for p in active_positions} if active_positions else {}

    updated = False
    for r in history:
        if r.get("status") == "OPEN":
            if r["id"] in deals_dict:
                r["profit"] = round(deals_dict[r["id"]].profit, 2)
                r["status"] = "CLOSED"
                updated = True
            elif r["id"] in active_dict:
                pos = active_dict[r["id"]]
                r["profit"] = round(pos.profit, 2)
                updated = True
                
                entry = r["entry_price"]
                tp = r["take_profit"]
                current_price = pos.price_current
                total_dist = abs(tp - entry)
                moved_dist = abs(current_price - entry)
                is_profit = (current_price > entry) if r["action"] == "BUY" else (current_price < entry)
                if is_profit and total_dist > 0 and (moved_dist >= (total_dist * 0.3)):
                    if r.get("be_active") != True:
                        new_sl = entry + (tp - entry) * 0.25
                        request = {
                            "action": mt5.TRADE_ACTION_SLTP,
                            "position": r["id"],
                            "symbol": r["symbol"],
                            "sl": new_sl,
                            "tp": tp
                        }
                        res = mt5.order_send(request)
                        if res.retcode == mt5.TRADE_RETCODE_DONE:
                            r["be_active"] = True
                            r["stop_loss"] = new_sl
                            print(f"[OK] [PROFIT LOCK] {r['symbol']} locked 25% profit.")

    if updated:
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=4, ensure_ascii=False)

def execute_mt5_trade(signal):
    symbol_input = signal.get("symbol_mt5", signal.get("symbol"))
    info, symbol_mt5 = get_symbol_info(symbol_input)
    if not info: return {"error": f"Symbol {symbol_input} not found"}

    lot = 0.01
    price = mt5.symbol_info_tick(symbol_mt5).ask if signal["action"] == "BUY" else mt5.symbol_info_tick(symbol_mt5).bid
    
    point = info.point
    
    # 計算基於百分比的價格距離
    sl_dist = price * (signal["sl_pct"] / 100.0)
    tp_dist = price * (signal["tp_pct"] / 100.0)
    
    sl = price - sl_dist if signal["action"] == "BUY" else price + sl_dist
    tp = price + tp_dist if signal["action"] == "BUY" else price - tp_dist

    filling_type = mt5.ORDER_FILLING_FOK
    if (info.filling_mode & 2): filling_type = mt5.ORDER_FILLING_IOC
    elif (info.filling_mode & 1): filling_type = mt5.ORDER_FILLING_FOK
    else: filling_type = mt5.ORDER_FILLING_RETURN

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol_mt5,
        "volume": lot,
        "type": mt5.ORDER_TYPE_BUY if signal["action"] == "BUY" else mt5.ORDER_TYPE_SELL,
        "price": price,
        "sl": sl,
        "tp": tp,
        "magic": 20260503,
        "comment": "GlobalInvest AI",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling_type,
    }
    
    result = mt5.order_send(request)
    if result.retcode == mt5.TRADE_RETCODE_DONE:
        save_trade_history(signal, result.order, price, lot, sl, tp)
        return {"success": True, "ticket": result.order}
    return {"error": f"Trade failed: {result.comment}", "retcode": result.retcode}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", type=str, required=True)
    parser.add_argument("--symbol", type=str)
    parser.add_argument("--mt5_symbol", type=str)
    parser.add_argument("--signal_json", type=str)
    args = parser.parse_args()

    if not initialize_mt5():
        sys.exit(1)

    if args.action == "TRADE":
        signal = json.loads(args.signal_json)
        print(json.dumps(execute_mt5_trade(signal)))
    elif args.action == "CLOSE":
        target = args.mt5_symbol or args.symbol
        close_mt5_position(target)
    elif args.action == "SYNC":
        update_trade_profits()
    
    mt5.shutdown()
