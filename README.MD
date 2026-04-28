# SparseExcel 3D - Proyecto DSA

Este proyecto es un visualizador premium de Matriz Dispersa (Sparse Matrix) implementado mediante una **Lista Cruzada** (Cross-Linked List). Incluye un backend en C++ y un frontend moderno en React con visualización 3D y 2D (estilo Excel).

## 🚀 Cómo Correr el Proyecto

### 1. Iniciar el Backend (C++)
El servidor C++ gestiona la lógica de la matriz y expone una API REST en el puerto 8080.

```bash
# Compilar y ejecutar
g++ -std=c++17 server.cpp -o server -lpthread && ./server
```

### 2. Iniciar el Frontend (React)
El frontend proporciona la interfaz gráfica para interactuar con la matriz.

```bash
cd frontend
npm install   # Solo la primera vez
npm run dev
```
Luego abre: [http://localhost:5173](http://localhost:5173)


## 🎮 Controles del Visor 3D

- **Click Izquierdo + Drag**: Rotar y girar el tablero en 3D.
- **Click Derecho + Drag**: Desplazar (Pan) el tablero de lado a lado.
- **Scroll (Rueda)**: Zoom in / Zoom out.
- **Flechas del Teclado**: Moverse por el tablero en 2D (Arriba, Abajo, Izquierda, Derecha).
- **Botón RESET VIEW**: Centra la cámara y quita cualquier rotación para volver a la vista plana.


## 🛠 Estructura del Proyecto

- `sparse_matrix.h`: Contiene la estructura `Node` y la clase `SparseMatrix` con toda la lógica de la lista cruzada.
- `server.cpp`: Servidor HTTP en C++ que conecta tu lógica con la interfaz gráfica.
- `frontend/`: Aplicación React con Three.js para los gráficos premium.
    - `src/App.jsx`: Interfaz principal y modo Tabla 2D.
    - `src/Matrix3D.jsx`: Motor de visualización 3D y punteros.

