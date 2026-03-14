from flask import Flask, render_template, request, jsonify, session
import sqlite3
import os

app = Flask(__name__)
app.secret_key = 'super_secret_funnylevels_key' # In production, use a secure random key
DATABASE = 'funnylevels.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS links (
                id TEXT PRIMARY KEY,
                level INTEGER NOT NULL,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                pts INTEGER NOT NULL
            )
        ''')
        db.commit()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state')
def get_state():
    db = get_db()
    links_rows = db.execute('SELECT * FROM links').fetchall()
    links = [dict(row) for row in links_rows]
    
    # Initialize user session if not exists
    if 'points' not in session:
        session['points'] = 0
    if 'visited_links' not in session:
        session['visited_links'] = []
        
    return jsonify({
        'points': session.get('points', 0),
        'visited_links': session.get('visited_links', []),
        'links': links
    })

@app.route('/api/award', methods=['POST'])
def award_points():
    data = request.json
    link_id = data.get('id')
    pts = data.get('pts')
    
    if link_id and pts is not None:
        visited = session.get('visited_links', [])
        if link_id not in visited:
            visited.append(link_id)
            session['visited_links'] = visited
            
            current_points = session.get('points', 0)
            session['points'] = current_points + int(pts)
            
            return jsonify({'success': True, 'points': session['points']})
    
    return jsonify({'success': False}), 400

@app.route('/api/admin/links', methods=['POST'])
def add_link():
    data = request.json
    password = data.get('password')
    
    if password != 'funny123':
        return jsonify({'error': 'Unauthorized'}), 401
        
    link_id = data.get('id')
    level = data.get('level')
    title = data.get('title')
    url = data.get('url')
    pts = data.get('pts')
    
    db = get_db()
    db.execute(
        'INSERT INTO links (id, level, title, url, pts) VALUES (?, ?, ?, ?, ?)',
        (link_id, level, title, url, pts)
    )
    db.commit()
    
    return jsonify({'success': True})

@app.route('/api/admin/links/<link_id>', methods=['DELETE'])
def delete_link(link_id):
    # For a real app, send password in headers or use a login session
    # For this simple port, we'll check body for DELETE if possible, or omit for now
    data = request.json or {}
    password = data.get('password')
    
    if password != 'funny123':
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = get_db()
    db.execute('DELETE FROM links WHERE id = ?', (link_id,))
    db.commit()
    return jsonify({'success': True})

@app.route('/api/reset', methods=['POST'])
def reset_data():
    session.pop('points', None)
    session.pop('visited_links', None)
    return jsonify({'success': True})

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
