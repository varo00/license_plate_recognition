document.addEventListener('DOMContentLoaded', function() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const imagePreview = document.getElementById('imagePreview');
    const resultText = document.getElementById('resultText');
    const plateHistory = document.getElementById('plateHistory');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    // Historial de matrículas (almacenado en el cliente)
    let plateHistoryData = [];
    
    // Eventos para arrastrar y soltar
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    // Manejar el evento de soltar archivo
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            handleFiles(files);
        }
    }
    
    // Manejar selección de archivo mediante el botón
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            handleFiles(this.files);
        }
    });
    
    function handleFiles(files) {
        const file = files[0];
        
        // Verificar tipo de archivo
        if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
            fileInfo.textContent = 'Error: Por favor selecciona una imagen JPG o PNG.';
            fileInfo.style.color = '#e74c3c';
            return;
        }
        
        // Mostrar información del archivo
        fileInfo.textContent = `Archivo: ${file.name} (${formatFileSize(file.size)})`;
        fileInfo.style.color = '#2ecc71';
        
        // Mostrar vista previa de la imagen
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.innerHTML = `<img src="${e.target.result}" alt="Vista previa">`;
        };
        reader.readAsDataURL(file);
        
        // Enviar la imagen al servidor
        uploadImage(file);
    }
    
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }
    
    function uploadImage(file) {
        // Mostrar overlay de carga
        loadingOverlay.style.display = 'flex';
        
        const formData = new FormData();
        formData.append('file', file);
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Ocultar overlay de carga
            loadingOverlay.style.display = 'none';
            
            if (data.error) {
                // Mostrar mensaje de error
                resultText.innerHTML = `<div class="error-message">${data.error}</div>`;
            } else {
                // Mostrar matrícula detectada
                resultText.innerHTML = `<div class="plate-result">${data.plate}</div>`;
                
                // Agregar al historial
                addToHistory(data.plate);
            }
        })
        .catch(error => {
            // Ocultar overlay de carga
            loadingOverlay.style.display = 'none';
            
            // Mostrar mensaje de error
            resultText.innerHTML = `<div class="error-message">Error al procesar la imagen: ${error.message}</div>`;
            console.error('Error:', error);
        });
    }
    
    function addToHistory(plate) {
        // Obtener fecha y hora actual
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const dateString = now.toLocaleDateString();
        
        // Agregar al array de historial
        plateHistoryData.unshift({
            plate: plate,
            time: `${dateString} ${timeString}`
        });
        
        // Actualizar la visualización del historial
        updateHistoryDisplay();
    }
    
    function updateHistoryDisplay() {
        plateHistory.innerHTML = '';
        
        plateHistoryData.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="plate-item">${item.plate}</span>
                <span class="plate-time">${item.time}</span>
            `;
            plateHistory.appendChild(li);
        });
        
        // Si no hay elementos en el historial
        if (plateHistoryData.length === 0) {
            plateHistory.innerHTML = '<li>No hay matrículas en el historial</li>';
        }
    }
    
    // Inicializar la visualización del historial
    updateHistoryDisplay();
});
