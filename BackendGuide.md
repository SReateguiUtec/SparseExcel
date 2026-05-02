# Guía Técnica: Conectando C++ con el Mundo Real

Esta guía explica los componentes del backend que transforman una **Estructura de Datos** (Matriz Dispersa) en una **Aplicación Web**.

## 1. El Servidor Web (`cpp-httplib`)
En el curso aprendiste a usar `cout` y `cin` para interactuar con la terminal. En este proyecto, usamos `cpp-httplib`.
- **Qué hace:** Convierte tu programa de C++ en un **Servidor API**.
- **Cómo funciona:** En lugar de esperar un texto por teclado, el programa se queda "escuchando" en el Puerto 8080. Cuando React pide los datos, el servidor responde.

## 2. El Formato de Datos (`nlohmann/json`)
C++ guarda los datos en memoria física. React (JavaScript) no puede leer la memoria de C++. Necesitamos un lenguaje común: **JSON**.
- **Librería:** `nlohmann/json` (de Niels Lohmann).
- **Proceso (Serialización):** Tomamos los nodos de la matriz dispersa y los convertimos en un string:
  ```json
  { "r": 5, "c": 10, "val": 100, "addr": "0x7ffee1" }
  ```
- **Importancia:** Es el estándar de la industria. Sin esto, no habría forma de enviar los datos al navegador.
- **Formato Single-Header (`json.hpp`):** Usamos la versión de un solo archivo de cabecera. Esto significa que toda la librería vive en ese archivo `.hpp`, lo que facilita mucho la portabilidad del proyecto sin necesidad de instalaciones complejas.

## 3. Direccionamiento de Memoria (`std::hex` y `uintptr_t`)
Para demostrar que la matriz es real, mostramos las direcciones de memoria.
- **`uintptr_t`**: Toma un puntero y lo trata como un número entero puro.
- **`std::hex`**: Formatea ese número en Base 16 (Hexadecimal).
- **Por qué importa:** En una matriz dispersa real, los nodos están "esparcidos" por la memoria. Ver direcciones distintas demuestra que los nodos se crean dinámicamente con `new`.

## 4. Arquitectura Cliente-Servidor
- **Backend (C++):** Es el dueño de la verdad. Aquí vive la Matriz Dispersa. Es rápido y eficiente.
- **Frontend (React):** Es la cara bonita. Solo muestra lo que el backend le dice.
- **Conector (Axios):** Es el cartero. Lleva las peticiones (insertar, borrar, promediar) de la web al servidor C++.
- **Librerías de Cabecera (Header-only):** Tanto `json.hpp` como `httplib.h` son librerías que no necesitan ser "instaladas" en el sistema operativo. Basta con tener el archivo en la carpeta del proyecto e incluirlo con `#include`.

---
*Este documento describe la arquitectura técnica y las dependencias utilizadas en el desarrollo del backend de SparseExcel.*
