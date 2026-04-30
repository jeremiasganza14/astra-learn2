import os
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from ai_service import process_pdf_and_generate_cards, generate_test_from_cards
import database
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
from functools import wraps

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)
app.config['SECRET_KEY'] = 'astra_super_secret_key_2026'

database.init_db()

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            parts = request.headers['Authorization'].split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                token = parts[1]
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data['user_id']
        except:
            return jsonify({'error': 'Token is invalid'}), 401
            
        return f(current_user_id, *args, **kwargs)
    return decorated

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Faltan datos'}), 400
        
    hashed_password = generate_password_hash(password)
    user_id = database.create_user(username, hashed_password)
    
    if not user_id:
        return jsonify({'error': 'El usuario ya existe'}), 400
        
    return jsonify({'message': 'Usuario creado exitosamente'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = database.get_user_by_username(data.get('username'))
    
    if user and check_password_hash(user['password_hash'], data.get('password')):
        token = jwt.encode({'user_id': user['id'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30)}, app.config['SECRET_KEY'], algorithm="HS256")
        return jsonify({'token': token, 'username': user['username']})
        
    return jsonify({'error': 'Credenciales inválidas'}), 401

@app.route('/api/subjects', methods=['GET'])
@token_required
def get_subjects(current_user_id):
    subjects = database.get_all_subjects(current_user_id)
    return jsonify(subjects), 200

@app.route('/api/subjects', methods=['POST'])
@token_required
def create_subject(current_user_id):
    data = request.json
    subject_id = database.add_subject(current_user_id, data.get('name'), data.get('icon', 'fa-book'), data.get('color', '#4F46E5'))
    return jsonify({"id": subject_id, "name": data.get('name')}), 201

@app.route('/api/topics/<int:subject_id>', methods=['GET'])
@token_required
def get_topics(current_user_id, subject_id):
    topics = database.get_topics_for_subject(subject_id)
    return jsonify(topics), 200

@app.route('/api/extract/<int:subject_id>', methods=['POST'])
@token_required
def extract_cards(current_user_id, subject_id):
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if file and file.filename.endswith('.pdf'):
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)
        
        try:
            topic_name = file.filename.replace('.pdf', '')
            topic_id = database.add_topic(subject_id, topic_name)
            
            import threading
            def background_process():
                try:
                    cards = process_pdf_and_generate_cards(filepath)
                    database.save_cards(subject_id, topic_id, cards)
                except Exception as e:
                    print(f"Error in background process: {e}")
                    
            thread = threading.Thread(target=background_process)
            thread.start()
            
            return jsonify({"message": "Procesando en segundo plano", "count": "Pendiente", "topic_id": topic_id}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    return jsonify({"error": "Invalid file format"}), 400

@app.route('/api/cards/topic/<int:topic_id>', methods=['GET'])
@token_required
def get_topic_cards(current_user_id, topic_id):
    cards = database.get_cards_for_topic(topic_id)
    return jsonify({"cards": cards}), 200

@app.route('/api/cards/<int:card_id>/swipe', methods=['POST'])
@token_required
def swipe_card(current_user_id, card_id):
    data = request.json
    direction = data.get('direction')
    # Call database with direction to handle SM-2 Spaced Repetition logic
    database.update_card_status(card_id, None, direction=direction)
    return jsonify({"success": True}), 200

@app.route('/api/tests/generate', methods=['POST'])
@token_required
def generate_test(current_user_id):
    data = request.json
    topic_id = data.get('topic_id')
    subject_id = data.get('subject_id')
    limit = data.get('limit', 5)
    
    if topic_id:
        cards = database.get_cards_for_topic(topic_id, status_filter='known', limit=limit)
    elif subject_id:
        cards = database.get_cards_for_subject_test(subject_id, limit=limit)
    else:
        return jsonify({"error": "Missing parameters"}), 400
        
    if not cards:
        return jsonify({"error": "No tienes suficientes tarjetas 'Aprendidas' para generar un test de esto."}), 400
        
    try:
        test_questions = generate_test_from_cards(cards)
        return jsonify({"questions": test_questions}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/cards/<int:card_id>/fail', methods=['POST'])
@token_required
def fail_test_card(current_user_id, card_id):
    database.update_card_status(card_id, 'learning')
    return jsonify({"success": True}), 200

@app.route('/api/subjects/<int:subject_id>', methods=['DELETE'])
@token_required
def api_delete_subject(current_user_id, subject_id):
    try:
        database.delete_subject(subject_id)
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/topics/<int:topic_id>/audio', methods=['GET'])
@token_required
def get_topic_audio_script(current_user_id, topic_id):
    conn = database.get_db_connection()
    cards = database.execute_query(conn, 'SELECT text, "desc" FROM cards WHERE topic_id = ?', (topic_id,), fetchall=True)
    conn.close()
    
    if not cards:
        return jsonify({"script": "No hay contenido para leer. Sube un documento primero."}), 200
        
    script = "Modo podcast iniciado. "
    for i, c in enumerate(cards):
        script += f"Punto {i+1}. {c['text']}. Respuesta: {c['desc']} "
        
    return jsonify({"script": script}), 200
@app.route('/api/topics/<int:topic_id>', methods=['DELETE'])
@token_required
def api_delete_topic(current_user_id, topic_id):
    try:
        database.delete_topic(topic_id)
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Iniciando servidor Astra Backend en el puerto 5001...")
    app.run(host='0.0.0.0', debug=True, port=5001)
