import os
import cv2
import numpy as np
import pytesseract
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import re
import logging

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg'}

# Crear directorio de uploads si no existe
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lista para almacenar todas las matrículas identificadas
detected_plates = []

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def preprocess_image(image_path):
    # Leer la imagen
    img = cv2.imread(image_path)
    
    # Convertir a escala de grises
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Aplicar filtro bilateral para reducir ruido mientras preserva los bordes
    gray = cv2.bilateralFilter(gray, 11, 17, 17)
    
    # Detectar bordes
    edged = cv2.Canny(gray, 30, 200)
    
    # Encontrar contornos
    cnts, _ = cv2.findContours(edged.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:10]
    
    # Variable para almacenar la región de la matrícula
    plate_img = None
    
    # Iterar sobre los contornos y buscar la matrícula
    for c in cnts:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        
        # Si el contorno tiene 4 puntos, podría ser la matrícula
        if len(approx) == 4:
            x, y, w, h = cv2.boundingRect(approx)
            # Verificar proporciones típicas de una matrícula
            aspect_ratio = w / float(h)
            if 2.0 < aspect_ratio < 6.0:
                plate_img = gray[y:y+h, x:x+w]
                break
    
    if plate_img is None:
        # Si no se encontró un contorno rectangular, usar toda la imagen
        plate_img = gray
    
    # Aplicar umbral para mejorar el contraste
    _, plate_img = cv2.threshold(plate_img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return plate_img

def recognize_plate(img):
    # Configurar Tesseract (ajustar según sea necesario)
    custom_config = r'--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    
    # Reconocer texto
    text = pytesseract.image_to_string(img, config=custom_config)
    
    # Limpiar el texto
    text = text.strip()
    
    # Filtrar solo caracteres alfanuméricos
    text = re.sub(r'[^A-Z0-9]', '', text)
    
    return text

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Preprocesar la imagen
            processed_img = preprocess_image(filepath)
            
            # Reconocer la matrícula
            plate_text = recognize_plate(processed_img)
            
            # Verificar si se encontró texto
            if not plate_text:
                return jsonify({'error': 'No se pudo identificar ninguna matrícula en la imagen'}), 404
            
            # Agregar a la lista de matrículas detectadas
            detected_plates.append(plate_text)
            logger.info(f"Matrícula detectada: {plate_text}")
            
            # Imprimir todas las matrículas detectadas hasta ahora
            print("Matrículas identificadas:")
            for idx, plate in enumerate(detected_plates, 1):
                print(f"{idx}. {plate}")
            
            return jsonify({'plate': plate_text})
            
        except Exception as e:
            logger.error(f"Error al procesar la imagen: {str(e)}")
            return jsonify({'error': f'Error al procesar la imagen: {str(e)}'}), 500
        finally:
            # Limpiar el archivo subido
            if os.path.exists(filepath):
                os.remove(filepath)
    
    return jsonify({'error': 'Formato de archivo no permitido'}), 400

if __name__ == '__main__':
    app.run(debug=True)