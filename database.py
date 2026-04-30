import sqlite3
import os

DB_NAME = 'astra.db'

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            icon TEXT DEFAULT 'fa-book',
            color TEXT DEFAULT '#4F46E5',
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY(subject_id) REFERENCES subjects(id)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER NOT NULL,
            topic_id INTEGER NOT NULL,
            type TEXT,
            text TEXT,
            desc TEXT,
            status TEXT DEFAULT 'new',
            FOREIGN KEY(subject_id) REFERENCES subjects(id),
            FOREIGN KEY(topic_id) REFERENCES topics(id)
        )
    ''')
    conn.commit()
    conn.close()

if not os.path.exists(DB_NAME):
    init_db()

def get_all_subjects(user_id):
    conn = get_db_connection()
    subjects = conn.execute('SELECT * FROM subjects WHERE user_id = ?', (user_id,)).fetchall()
    
    result = []
    for s in subjects:
        total = conn.execute('SELECT COUNT(*) FROM cards WHERE subject_id = ?', (s['id'],)).fetchone()[0]
        known = conn.execute('SELECT COUNT(*) FROM cards WHERE subject_id = ? AND status = ?', (s['id'], 'known')).fetchone()[0]
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
    topics = conn.execute('SELECT * FROM topics WHERE subject_id = ?', (subject_id,)).fetchall()
    result = []
    for t in topics:
        total = conn.execute('SELECT COUNT(*) FROM cards WHERE topic_id = ?', (t['id'],)).fetchone()[0]
        known = conn.execute('SELECT COUNT(*) FROM cards WHERE topic_id = ? AND status = ?', (t['id'], 'known')).fetchone()[0]
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
    cursor = conn.execute('INSERT INTO subjects (user_id, name, icon, color) VALUES (?, ?, ?, ?)', (user_id, name, icon, color))
    conn.commit()
    subject_id = cursor.lastrowid
    conn.close()
    return subject_id

def add_topic(subject_id, name):
    conn = get_db_connection()
    cursor = conn.execute('INSERT INTO topics (subject_id, name) VALUES (?, ?)', (subject_id, name))
    conn.commit()
    topic_id = cursor.lastrowid
    conn.close()
    return topic_id

def save_cards(subject_id, topic_id, cards_list):
    conn = get_db_connection()
    c = conn.cursor()
    for card in cards_list:
        c.execute('INSERT INTO cards (subject_id, topic_id, type, text, desc, status) VALUES (?, ?, ?, ?, ?, ?)',
                  (subject_id, topic_id, card.get('type', 'Concepto'), card.get('text', ''), card.get('desc', ''), 'new'))
    conn.commit()
    conn.close()

def get_cards_for_topic(topic_id, status_filter=None, limit=20):
    conn = get_db_connection()
    if status_filter:
        cards = conn.execute('SELECT id, type, text, desc, status FROM cards WHERE topic_id = ? AND status = ? ORDER BY RANDOM() LIMIT ?', (topic_id, status_filter, limit)).fetchall()
    else:
        cards = conn.execute('SELECT id, type, text, desc, status FROM cards WHERE topic_id = ? AND status != ? ORDER BY RANDOM() LIMIT ?', (topic_id, 'known', limit)).fetchall()
    conn.close()
    return [dict(c) for c in cards]

def get_cards_for_subject_test(subject_id, limit=20):
    conn = get_db_connection()
    cards = conn.execute('SELECT id, type, text, desc, status FROM cards WHERE subject_id = ? AND status = ? ORDER BY RANDOM() LIMIT ?', (subject_id, 'known', limit)).fetchall()
    conn.close()
    return [dict(c) for c in cards]

def update_card_status(card_id, new_status):
    conn = get_db_connection()
    conn.execute('UPDATE cards SET status = ? WHERE id = ?', (new_status, card_id))
    conn.commit()
    conn.close()

def delete_subject(subject_id):
    conn = get_db_connection()
    # Delete cards associated with topics of this subject
    conn.execute('DELETE FROM cards WHERE subject_id = ?', (subject_id,))
    # Delete topics of this subject
    conn.execute('DELETE FROM topics WHERE subject_id = ?', (subject_id,))
    # Delete subject
    conn.execute('DELETE FROM subjects WHERE id = ?', (subject_id,))
    conn.commit()
    conn.close()

def delete_topic(topic_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM cards WHERE topic_id = ?', (topic_id,))
    conn.execute('DELETE FROM topics WHERE id = ?', (topic_id,))
    conn.commit()
    conn.close()

def create_user(username, password_hash):
    conn = get_db_connection()
    try:
        cursor = conn.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', (username, password_hash))
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        conn.close()
        return None

def get_user_by_username(username):
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    return dict(user) if user else None
