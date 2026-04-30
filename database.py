import os

DB_URL = os.environ.get('DATABASE_URL')
IS_POSTGRES = DB_URL is not None

if IS_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor
else:
    import sqlite3
    DB_NAME = 'astra.db'

def get_db_connection():
    if IS_POSTGRES:
        conn = psycopg2.connect(DB_URL)
        return conn
    else:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        return conn

def execute_query(conn, query, params=(), fetchone=False, fetchall=False, commit=False, returning_id=False):
    if IS_POSTGRES:
        # Convert SQLite ? to Postgres %s
        query = query.replace('?', '%s')
        if returning_id and not query.strip().upper().endswith('RETURNING ID'):
            query += ' RETURNING id'
            
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute(query, params)
            if commit:
                conn.commit()
            
            result = None
            if returning_id:
                result = cursor.fetchone()['id']
            elif fetchone:
                row = cursor.fetchone()
                result = dict(row) if row else None
            elif fetchall:
                rows = cursor.fetchall()
                result = [dict(r) for r in rows]
            
            cursor.close()
            return result
        except Exception as e:
            conn.rollback()
            cursor.close()
            raise e
    else:
        cursor = conn.cursor()
        try:
            cursor.execute(query, params)
            if commit:
                conn.commit()
                
            result = None
            if returning_id:
                result = cursor.lastrowid
            elif fetchone:
                row = cursor.fetchone()
                result = dict(row) if row else None
            elif fetchall:
                rows = cursor.fetchall()
                result = [dict(r) for r in rows]
                
            cursor.close()
            return result
        except Exception as e:
            conn.rollback()
            cursor.close()
            raise e

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    serial_type = "SERIAL" if IS_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"
    pk_type = "INTEGER PRIMARY KEY" if IS_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"
    if IS_POSTGRES:
        serial_type = "SERIAL PRIMARY KEY"
    
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS users (
            id {serial_type},
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS subjects (
            id {serial_type},
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            icon TEXT DEFAULT 'fa-book',
            color TEXT DEFAULT '#4F46E5',
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS topics (
            id {serial_type},
            subject_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY(subject_id) REFERENCES subjects(id)
        )
    ''')
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS cards (
            id {serial_type},
            subject_id INTEGER NOT NULL,
            topic_id INTEGER NOT NULL,
            type TEXT,
            text TEXT,
            "desc" TEXT,
            status TEXT DEFAULT 'new',
            FOREIGN KEY(subject_id) REFERENCES subjects(id),
            FOREIGN KEY(topic_id) REFERENCES topics(id)
        )
    ''')
    conn.commit()
    c.close()
    conn.close()

if not IS_POSTGRES and not os.path.exists(DB_NAME):
    init_db()
elif IS_POSTGRES:
    # Always try to init tables in postgres in case they don't exist
    try:
        init_db()
    except Exception as e:
        print("DB Init Error (might already exist):", e)

def get_all_subjects(user_id):
    conn = get_db_connection()
    subjects = execute_query(conn, 'SELECT * FROM subjects WHERE user_id = ?', (user_id,), fetchall=True)
    
    result = []
    for s in subjects:
        total = execute_query(conn, 'SELECT COUNT(*) as c FROM cards WHERE subject_id = ?', (s['id'],), fetchone=True)['c']
        known = execute_query(conn, 'SELECT COUNT(*) as c FROM cards WHERE subject_id = ? AND status = ?', (s['id'], 'known'), fetchone=True)['c']
        progress = int((known / total * 100)) if total > 0 else 0
        
        result.append({
            'id': s['id'],
            'name': s['name'],
            'icon': s['icon'],
            'color': s['color'],
            'progress': progress,
            'total_cards': total
        })
    conn.close()
    return result

def get_topics_for_subject(subject_id):
    conn = get_db_connection()
    topics = execute_query(conn, 'SELECT * FROM topics WHERE subject_id = ?', (subject_id,), fetchall=True)
    result = []
    for t in topics:
        total = execute_query(conn, 'SELECT COUNT(*) as c FROM cards WHERE topic_id = ?', (t['id'],), fetchone=True)['c']
        known = execute_query(conn, 'SELECT COUNT(*) as c FROM cards WHERE topic_id = ? AND status = ?', (t['id'], 'known'), fetchone=True)['c']
        progress = int((known / total * 100)) if total > 0 else 0
        result.append({
            'id': t['id'],
            'name': t['name'],
            'progress': progress,
            'total_cards': total,
            'known_cards': known
        })
    conn.close()
    return result

def add_subject(user_id, name, icon='fa-book', color='#4F46E5'):
    conn = get_db_connection()
    subject_id = execute_query(conn, 'INSERT INTO subjects (user_id, name, icon, color) VALUES (?, ?, ?, ?)', (user_id, name, icon, color), commit=True, returning_id=True)
    conn.close()
    return subject_id

def add_topic(subject_id, name):
    conn = get_db_connection()
    topic_id = execute_query(conn, 'INSERT INTO topics (subject_id, name) VALUES (?, ?)', (subject_id, name), commit=True, returning_id=True)
    conn.close()
    return topic_id

def save_cards(subject_id, topic_id, cards_list):
    conn = get_db_connection()
    for card in cards_list:
        execute_query(conn, 'INSERT INTO cards (subject_id, topic_id, type, text, "desc", status) VALUES (?, ?, ?, ?, ?, ?)',
                  (subject_id, topic_id, card.get('type', 'Concepto'), card.get('text', ''), card.get('desc', ''), 'new'), commit=True)
    conn.close()

def get_cards_for_topic(topic_id, status_filter=None, limit=20):
    conn = get_db_connection()
    if status_filter:
        cards = execute_query(conn, 'SELECT id, type, text, "desc", status FROM cards WHERE topic_id = ? AND status = ? ORDER BY RANDOM() LIMIT ?', (topic_id, status_filter, limit), fetchall=True)
    else:
        cards = execute_query(conn, 'SELECT id, type, text, "desc", status FROM cards WHERE topic_id = ? AND status != ? ORDER BY RANDOM() LIMIT ?', (topic_id, 'known', limit), fetchall=True)
    conn.close()
    return cards

def get_cards_for_subject_test(subject_id, limit=20):
    conn = get_db_connection()
    cards = execute_query(conn, 'SELECT id, type, text, "desc", status FROM cards WHERE subject_id = ? AND status = ? ORDER BY RANDOM() LIMIT ?', (subject_id, 'known', limit), fetchall=True)
    conn.close()
    return cards

def update_card_status(card_id, new_status):
    conn = get_db_connection()
    execute_query(conn, 'UPDATE cards SET status = ? WHERE id = ?', (new_status, card_id), commit=True)
    conn.close()

def delete_subject(subject_id):
    conn = get_db_connection()
    execute_query(conn, 'DELETE FROM cards WHERE subject_id = ?', (subject_id,), commit=True)
    execute_query(conn, 'DELETE FROM topics WHERE subject_id = ?', (subject_id,), commit=True)
    execute_query(conn, 'DELETE FROM subjects WHERE id = ?', (subject_id,), commit=True)
    conn.close()

def delete_topic(topic_id):
    conn = get_db_connection()
    execute_query(conn, 'DELETE FROM cards WHERE topic_id = ?', (topic_id,), commit=True)
    execute_query(conn, 'DELETE FROM topics WHERE id = ?', (topic_id,), commit=True)
    conn.close()

def create_user(username, password_hash):
    conn = get_db_connection()
    try:
        user_id = execute_query(conn, 'INSERT INTO users (username, password_hash) VALUES (?, ?)', (username, password_hash), commit=True, returning_id=True)
        conn.close()
        return user_id
    except Exception:
        conn.close()
        return None

def get_user_by_username(username):
    conn = get_db_connection()
    user = execute_query(conn, 'SELECT * FROM users WHERE username = ?', (username,), fetchone=True)
    conn.close()
    return user
