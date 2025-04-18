import os
import sqlite3
from flask import Flask, render_template, send_from_directory, jsonify, request
from flask_socketio import SocketIO
from flask_cors import CORS
import psutil
import time
from threading import Thread, Event
from datetime import datetime
from collections import deque

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'secret!'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///process_monitor.db'
socketio = SocketIO(app)

# Initialize database
def init_db():
    conn = sqlite3.connect('process_monitor.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS alerts
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  message TEXT,
                  level TEXT,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS historical_data
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  cpu REAL,
                  memory REAL,
                  disk REAL,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

# Thread for monitoring
thread = None
thread_stop_event = Event()
historical_data = deque(maxlen=100)  # In-memory cache for quick access

def log_historical_data(stats):
    """Log data to database and memory cache"""
    conn = sqlite3.connect('process_monitor.db')
    c = conn.cursor()
    c.execute("INSERT INTO historical_data (cpu, memory, disk) VALUES (?, ?, ?)",
              (stats['cpu'], stats['memory'], stats['disk']))
    conn.commit()
    conn.close()
    
    historical_data.append({
        'time': stats['time'],
        'cpu': stats['cpu'],
        'memory': stats['memory'],
        'disk': stats['disk']
    })

def check_alerts(stats):
    """Check for threshold breaches"""
    alerts = []
    if stats['cpu'] > 90:
        alerts.append(('CPU usage high!', 'critical'))
    if stats['memory'] > 90:
        alerts.append(('Memory usage high!', 'warning'))
    if stats['disk'] > 90:
        alerts.append(('Disk usage high!', 'critical'))
    
    if alerts:
        conn = sqlite3.connect('process_monitor.db')
        c = conn.cursor()
        for message, level in alerts:
            c.execute("INSERT INTO alerts (message, level) VALUES (?, ?)",
                      (message, level))
        conn.commit()
        conn.close()
        return alerts
    return None

def get_system_stats():
    """Get current system statistics"""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('C:\\' if os.name == 'nt' else '/')
        net_io = psutil.net_io_counters()
        processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']):
            try:
                processes.append({
                    'pid': proc.info['pid'],
                    'name': proc.info['name'],
                    'cpu': proc.info['cpu_percent'],
                    'memory': proc.info['memory_percent'],
                    'status': proc.info['status']
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        # Sort by CPU usage
        processes = sorted(processes, key=lambda p: p['cpu'], reverse=True)[:10]
        
        stats = {
            'cpu': cpu_percent,
            'memory': memory.percent,
            'disk': disk.percent,
            'network': {
                'sent': net_io.bytes_sent,
                'recv': net_io.bytes_recv
            },
            'processes': processes,
            'time': datetime.now().strftime('%H:%M:%S'),
            'sensors': {
                'temperatures': get_temperatures(),
                'fans': get_fan_speeds()
            }
        }
        
        log_historical_data(stats)
        if alerts := check_alerts(stats):
            stats['alerts'] = alerts
        
        return stats
    except Exception as e:
        print(f"Error getting stats: {e}")
        return None

def get_temperatures():
    """Get system temperatures if available"""
    try:
        temps = psutil.sensors_temperatures()
        return {k: v[0].current for k, v in temps.items()} if temps else None
    except:
        return None

def get_fan_speeds():
    """Get fan speeds if available"""
    try:
        fans = psutil.sensors_fans()
        return {k: v[0].current for k, v in fans.items()} if fans else None
    except:
        return None

def background_monitor():
    """Background task that emits system stats"""
    while not thread_stop_event.is_set():
        stats = get_system_stats()
        if stats:
            socketio.emit('update', stats, namespace='/monitor')
        time.sleep(2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/system-info')
def system_info():
    try:
        battery = psutil.sensors_battery() if hasattr(psutil, 'sensors_battery') else None
        return jsonify({
            'cpu_cores': psutil.cpu_count(),
            'total_memory_gb': round(psutil.virtual_memory().total / (1024**3), 2),
            'total_disk_gb': round(psutil.disk_usage('C:\\' if os.name == 'nt' else '/').total / (1024**3), 2),
            'battery': {
                'percent': battery.percent if battery else None,
                'plugged': battery.power_plugged if battery else None
            } if battery else None
        })
    except Exception as e:
        print(f"Error in system-info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/kill-process', methods=['POST'])
def kill_process():
    try:
        pid = int(request.json.get('pid'))
        p = psutil.Process(pid)
        p.terminate()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/historical-data')
def get_historical_data():
    try:
        hours = int(request.args.get('hours', 1))
        conn = sqlite3.connect('process_monitor.db')
        c = conn.cursor()
        c.execute("""
            SELECT cpu, memory, disk, timestamp 
            FROM historical_data 
            WHERE timestamp >= datetime('now', ?)
            ORDER BY timestamp
        """, (f'-{hours} hours',))
        data = [{
            'cpu': row[0],
            'memory': row[1],
            'disk': row[2],
            'time': row[3][11:19]  # Extract time part
        } for row in c.fetchall()]
        conn.close()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/alerts')
def get_alerts():
    try:
        limit = int(request.args.get('limit', 10))
        conn = sqlite3.connect('process_monitor.db')
        c = conn.cursor()
        c.execute("SELECT message, level, timestamp FROM alerts ORDER BY timestamp DESC LIMIT ?", (limit,))
        alerts = [{
            'message': row[0],
            'level': row[1],
            'time': row[2][11:19]  # Extract time part
        } for row in c.fetchall()]
        conn.close()
        return jsonify(alerts)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(os.path.join(app.root_path, 'static'), filename)

@app.route('/favicon.ico')
def favicon():
    return '', 404

@socketio.on('connect', namespace='/monitor')
def monitor_connect():
    global thread
    print('Client connected')
    
    if thread is None:
        thread = Thread(target=background_monitor)
        thread.start()

@socketio.on('disconnect', namespace='/monitor')
def monitor_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)