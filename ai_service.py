import os
import json
import fitz  # PyMuPDF
import google.generativeai as genai

API_KEY = os.environ.get("GEMINI_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)

def extract_text_from_pdf(filepath):
    text = ""
    with fitz.open(filepath) as doc:
        for page in doc:
            text += page.get_text()
    return text

def process_pdf_and_generate_cards(filepath):
    if not API_KEY:
        raise ValueError("GEMINI_API_KEY no está configurada.")
        
    text = extract_text_from_pdf(filepath)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    Eres un tutor universitario experto. Convierte el siguiente texto en flashcards.
    Tu tarea es EXTRAER EL 100% de la información útil. NO RESUMAS. NO OMITAS NADA.
    
    REGLA ESTRICTA: Si el texto es largo (más de 3 páginas), DEBES generar un MÍNIMO de 40 a 60 flashcards.
    Debes desglosar cada párrafo, cada concepto, cada lista y cada detalle en su propia tarjeta separada.
    No agrupes conceptos. Si hay 5 características de algo, crea 5 tarjetas distintas.
    
    Devuelve EXCLUSIVAMENTE en formato JSON válido, una lista de objetos:
    [
        {{
            "type": "Definición",
            "text": "¿Qué es X?",
            "desc": "La explicación completa y detallada."
        }}
    ]
    
    Texto a analizar:
    {text}
    """
    
    response = model.generate_content(prompt)
    raw_response = response.text.strip()
    if raw_response.startswith('```json'): raw_response = raw_response[7:]
    if raw_response.startswith('```'): raw_response = raw_response[3:]
    if raw_response.endswith('```'): raw_response = raw_response[:-3]
        
    return json.loads(raw_response.strip())

def generate_test_from_cards(cards):
    if not API_KEY:
        raise ValueError("GEMINI_API_KEY no está configurada.")
        
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    cards_json = json.dumps(cards, ensure_ascii=False)
    
    prompt = f"""
    Eres un profesor universitario. Genera un examen de Multiple Choice basándote EXCLUSIVAMENTE en las siguientes tarjetas.
    Para CADA tarjeta proporcionada, crea exactamente UNA pregunta.
    
    Deben ser 4 opciones. Solo 1 es correcta.
    Debes proveer una 'justification' corta de por qué esa es la correcta y las demás no.
    
    Devuelve EXCLUSIVAMENTE en formato JSON válido, una lista de objetos:
    [
        {{
            "card_id": <id_de_la_tarjeta_int>,
            "question": "Pregunta...",
            "options": ["A", "B", "C", "D"],
            "correct_index": 0,
            "justification": "Explicación."
        }}
    ]
    
    Conceptos:
    {cards_json}
    """
    
    response = model.generate_content(prompt)
    raw_response = response.text.strip()
    if raw_response.startswith('```json'): raw_response = raw_response[7:]
    if raw_response.startswith('```'): raw_response = raw_response[3:]
    if raw_response.endswith('```'): raw_response = raw_response[:-3]
        
    return json.loads(raw_response.strip())
