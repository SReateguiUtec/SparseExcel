# <img src="content/logo.svg" height="40" />

Este proyecto es un visualizador de una Matriz Dispersa (Sparse Matrix) implementado mediante una **Lista Cruzada** (Cross-Linked List). Incluye un backend en C++ y un frontend moderno en React con visualización 3D y 2D (estilo Excel).

## 📺 Demo del Proyecto

<div align="center">
<h3>🎬 Demo del Funcionamiento</h3>
  <video src="https://github.com/user-attachments/assets/6f0a60a4-530f-4d0b-854f-13286eb92966" width="100%" controls>
    Tu navegador no soporta el elemento de video.
  </video>
</div>

*(Si el video no se reproduce, puedes abrirlo directamente en `SparseMatrixDemo.mp4`)*

<br>

## 📊 Análisis de Complejidad y Justificación

### Justificación de la Estructura
Se eligió una **Lista Enlazada Cruzada** (Sparse Matrix) debido a la naturaleza de una hoja de cálculo, donde la densidad de datos suele ser inferior al 5%. Esta estructura permite:
- **Ahorro de Memoria:** Solo se reserva espacio para celdas con datos. Una matriz densa de 10,000x10,000 ocuparía GBs de RAM; nuestra estructura solo ocupa bytes proporcionales a los datos reales.
- **Flexibilidad (Multi-tipo):** Mediante el uso de `std::variant<int, char, string>`, cada celda puede manejar dinámicamente diferentes tipos de datos sin perder la seguridad de tipos de C++.

### Complejidad Temporal
| Operación | Complejidad | Descripción |
| :--- | :--- | :--- |
| **Inserción / Modificación** | **O(k)** | $k$ es el número de elementos en la fila/columna. El uso de `std::variant` agiliza la actualización sin necesidad de polimorfismo costoso. |
| **Búsqueda / Consulta** | **O(k)** | Recorrido de la lista enlazada hasta encontrar la coordenada. |
| **Eliminación de Celda** | **O(k)** | Localización del nodo y reajuste de punteros de vecinos. |
| **Operaciones de Agregación** | **O(N)** | Donde $N$ es el total de nodos en el rango solicitado. El chequeo de tipo numérico es $O(1)$ por nodo gracias al discriminador del variant. |

### Complejidad Espacial
| Componente | Complejidad | Justificación |
| :--- | :--- | :--- |
| **Estructura Global** | **O(N)** | El espacio total crece linealmente con el número de celdas ocupadas ($N$), no con el tamaño de la cuadrícula. |
| **Nodo Individual** | **O(1)** | Cada nodo tiene un tamaño fijo predeterminado por el tipo más grande en el variant (en este caso, `std::string`). |

*Nota: Se realiza un trade-off consciente donde se incrementa ligeramente el tamaño de cada nodo a cambio de eliminar la complejidad de parseo manual y aumentar la seguridad del motor de cálculo.*

<br>

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

<br>

### ⚙️ Librerias utilizadas para el backend (ya estan instaladas en este proyecto)

```bash
# Servidor HTTP (cpp-httplib)
curl -L -o httplib.h https://raw.githubusercontent.com/yhirose/cpp-httplib/master/httplib.h

# Manejador JSON (nlohmann/json)
curl -L -o json.hpp https://raw.githubusercontent.com/nlohmann/json/master/single_include/nlohmann/json.hpp
```
<br>

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
