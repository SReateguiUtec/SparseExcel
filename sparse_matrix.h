#ifndef SPARSE_MATRIX_H
#define SPARSE_MATRIX_H

#include "json.hpp"
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <variant>
#include <type_traits>
#include <stdexcept>
#include <cctype>

using json = nlohmann::json;
using CellValue = std::variant<int, double, char, std::string>;
template <typename T> struct Node {
  T value;
  int row, col;
  Node<T> *next_row; // Puntero al siguiente en la misma fila (derecha)
  Node<T> *next_col; // Puntero al siguiente en la misma columna (abajo)
  Node(int r, int c, T v)
      : row(r), col(c), value(v), next_row(nullptr), next_col(nullptr) {}
};

template <typename T> class SparseMatrix {
private:
  // Vectores de punteros que actúan como nodos de cabecera
  std::vector<Node<T> *> rows;
  std::vector<Node<T> *> cols;
  int n_rows, n_cols;

public:
  // Constructor: Inicializa los vectores con punteros nulos
  SparseMatrix(int r, int c) : n_rows(r), n_cols(c) {
    rows.resize(r, nullptr);
    cols.resize(c, nullptr);
  }
  // Destructor
  ~SparseMatrix();

  // Operaciones basicas
  void insert(int r, int c, T value);
  void modify(int r, int c, T new_value);
  T get_value(int r, int c) const;
  T operator()(int r, int c) const; // Sobrecarga

  // Operaciones sobre r y c
  void remove_row(int r);
  void remove_col(int c);
  void remove_range(int r1, int c1, int r2, int c2);

  // Operaciones de agregacion
  int count() const;
  int numeric_count() const;

  double sum_row(int r) const;
  double sum_col(int c) const;

  double avg_row(int r) const;
  double avg_col(int c) const;
  double average() const;
  double sum_range(int r1, int c1, int r2, int c2) const;
  double avg_range(int r1, int c1, int r2, int c2) const;
  double min_range(int r1, int c1, int r2, int c2) const;
  double max_range(int r1, int c1, int r2, int c2) const;

  // Formulas
  bool parse_cell_ref(std::string ref, int &r, int &c) const;
  double evaluate_formula(std::string formula) const;

  // Para visualizacion
  nlohmann::json get_all_nodes();

  // Limpiar toda la matriz
  void clear();
};

// ============================================================
// Operaciones Basicas
// ============================================================

// Función auxiliar para verificar si la celda esta en 0 teniendo en cuenta el CellValue
bool is_zero_value(const CellValue& value) {
  if (const int* p = std::get_if<int>(&value)) {
    return *p == 0;
  }
  if (const double* p = std::get_if<double>(&value)) {
    return *p == 0.0;
  }
  return false;
}

// Función auxiliar para verificar si el valor es entero
bool is_int_value(const CellValue& value) {
  return std::holds_alternative<int>(value);
}

// Función auxiliar para obtener el valor entero
int get_int_value(const CellValue& value) {
  if (const int* p = std::get_if<int>(&value)) {
    return *p;
  }
  throw std::runtime_error("La celda no contiene un valor numerico");
}

template <typename U>
bool is_zero_generic(const U& value) {
  if constexpr (std::is_same_v<U, CellValue>) {
    if (const int* p = std::get_if<int>(&value)) {
      return *p == 0;
    }
    if (const double* p = std::get_if<double>(&value)) {
      return *p == 0.0;
    }
    return false;
  } else {
    return value == 0;
  }
}

template <typename U>
bool is_numeric_generic(const U& value) {
  if constexpr (std::is_same_v<U, CellValue>) {
    return std::holds_alternative<int>(value) || std::holds_alternative<double>(value);
  } else {
    return true;
  }
}

template <typename U>
int to_int_generic(const U& value) {
  if constexpr (std::is_same_v<U, CellValue>) {
    if (const int* p = std::get_if<int>(&value)) {
      return *p;
    }
    throw std::runtime_error("La celda no contiene un valor numerico");
  } else {
    return static_cast<int>(value);
  }
}

template <typename U>
double to_double_generic(const U& value) {
  if constexpr (std::is_same_v<U, CellValue>) {
    if (const int* p = std::get_if<int>(&value)) {
      return static_cast<double>(*p);
    }
    if (const double* p = std::get_if<double>(&value)) {
      return *p;
    }
    throw std::runtime_error("La celda no contiene un valor numerico");
  } else {
    return static_cast<double>(value);
  }
}
// Solo cuenta celdas numericas
template <typename T>
int SparseMatrix<T>::numeric_count() const {
  int count = 0;

  for (int i = 0; i < n_rows; ++i) {
    Node<T> *curr = rows[i];

    while (curr != nullptr) {
      if (is_numeric_generic(curr->value)) {
        count++;
      }
      curr = curr->next_row;
    }
  }

  return count;
}


// Insertamos nodo en posicion (i, j)
template <typename T> void SparseMatrix<T>::insert(int r, int c, T value) {
  // Validacion de seguridad basica
  if (r < 0 || c < 0) {
    return;
  }

  // Si el valor es 0, no creamos nodo (o borramos si existía)
  if (is_zero_generic(value)) {
    this->remove_range(r, c, r, c);
    return;
  }

  // Si el indice r o c es mayor al tamaño actual, expandimos los vectores de
  // cabecera
  if (r >= n_rows) {
    rows.resize(r + 1, nullptr);
    n_rows = r + 1;
  }
  if (c >= n_cols) {
    cols.resize(c + 1, nullptr);
    n_cols = c + 1;
  }

  // Creamos el nodo a insertar
  Node<T> *nuevo = new Node<T>(r, c, value);
  // Filas

  // Si la celda ya existe, actualizamos el valor.
  // Esto previene nodos duplicados en la lista de columna
  if (rows[r] != nullptr) {
    Node<T> *check = rows[r];
    while (check != nullptr && check->col < c) {
      check = check->next_row;
    }
    if (check != nullptr && check->col == c) {
      check->value = value;
      delete nuevo;
      return;
    }
  }

  // Caso que la fila este vacia o el elemento a insertar vaya antes de la
  // cabecera
  if (rows[r] == nullptr || rows[r]->col > c) {
    nuevo->next_row = rows[r];
    rows[r] = nuevo;
  } else {
    // Buscamos la posicion correcta en la fila
    Node<T> *curr = rows[r];
    while (curr->next_row != nullptr && curr->next_row->col < c) {
      curr = curr->next_row;
    }
    // Si ya existe un nodo en la posicion entonces solo actualizamos su valor
    // Los punteros next_col ya están correctos porque el nodo ya estaba
    // enlazado
    if (curr->next_row != nullptr && curr->next_row->col == c) {
      curr->next_row->value = value;
      delete nuevo;
      return;
    }
    nuevo->next_row = curr->next_row;
    curr->next_row = nuevo;
  }

  // Columna

  // Caso base, que la columna este vacia o el nuevo nodo va antes de
  // la cabecera
  if (cols[c] == nullptr || cols[c]->row > r) {
    nuevo->next_col = cols[c];
    cols[c] = nuevo;
  } else {
    // Buscar la posicion correcta en la columna
    Node<T> *curr = cols[c];
    while (curr->next_col != nullptr && curr->next_col->row < r) {
      curr = curr->next_col;
    }
    nuevo->next_col = curr->next_col;
    curr->next_col = nuevo;
  }
}

// Modificar celda, sin crear un nuevo Nodo
template <typename T> void SparseMatrix<T>::modify(int r, int c, T new_value) {
  Node<T> *temp = rows[r];
  while (temp != nullptr && temp->col < c) {
    temp = temp->next_row;
  }
  // Si el nodo no es null y estamos en la columna correcta, actualizamos el
  // valor
  if (temp != nullptr && temp->col == c) {
    temp->value = new_value;
  } else {
    this->insert(r, c, new_value);
  } // Caso contrario insertamos el nuevo nodo con su valor en la posicion (i,j)
}

// Obtenemos el valor de la posicion (i, j)
template <typename T>
T SparseMatrix<T>::get_value(int r, int c) const {
  if (r < 0 || r >= n_rows || c < 0 || c >= n_cols) {
    return T{};
  }

  Node<T> *curr = rows[r];

  while (curr != nullptr && curr->col < c) {
    curr = curr->next_row;
  }

  if (curr != nullptr && curr->col == c) {
    return curr->value;
  }

  return T{};
}

// Sobrecargamos el () para obtener la funcion de get_value, es un wrapper de
// get_value ya que solo llama a la funcion
template <typename T> T SparseMatrix<T>::operator()(int r, int c) const {
  return get_value(r, c);
}

// Destructor
template <typename T> SparseMatrix<T>::~SparseMatrix() {
  for (int i = 0; i < n_rows; ++i) {
    Node<T> *curr = rows[i];
    while (curr != nullptr) {
      Node<T> *temp = curr;
      curr = curr->next_row;
      delete temp; // Borramos nodo por nodo recorriendo las filas
    }
  }
}

// ============================================================
// Operaciones sobre filas y columnas
// ============================================================

// Remover fila de la matriz
template <typename T> void SparseMatrix<T>::remove_row(int r) {
  // Caso base
  if (r < 0 || r >= n_rows) {
    return;
  }
  if (rows[r] == nullptr) {
    return;
  }
  Node<T> *curr = rows[r];
  // Borrar los nodos de la fila y conectar los nodos de las columnas
  while (curr != nullptr) {
    int c = curr->col; // Columna del nodo actual
    // Buscamos que nodo apunta al actual desde arriba en la columna c
    if (cols[c] == curr) {
      // El nodo a borrar es la cabecera de la columna
      cols[c] = curr->next_col;
    } else {
      // El nodo a borrar esta en medio o al final de la columna
      Node<T> *prev_v = cols[c];
      while (prev_v != nullptr && prev_v->next_col != curr) {
        prev_v = prev_v->next_col;
      }
      if (prev_v != nullptr) {
        prev_v->next_col = curr->next_col;
      }
    }
    Node<T> *to_delete = curr;
    curr = curr->next_row;
    delete to_delete;
  }
  // Finalmente, marcamos la fila como vacía
  rows[r] = nullptr;
}

// Remover columna de la matriz
template <typename T> void SparseMatrix<T>::remove_col(int c) {
  // Caso base
  if (c < 0 || c >= n_cols) {
    return;
  }
  if (cols[c] == nullptr) {
    return;
  }
  Node<T> *curr = cols[c];
  // Borrar los nodos de la columna y conectar los nodos de las filas
  while (curr != nullptr) {
    int r = curr->row;
    if (rows[r] == curr) {
      // El nodo a borrar es el primero de su fila
      rows[r] = curr->next_row;
    } else {
      // El nodo a borrar esta en medio o al final de la fila
      Node<T> *prev_h = rows[r];
      while (prev_h != nullptr && prev_h->next_row != curr) {
        prev_h = prev_h->next_row;
      }
      if (prev_h != nullptr) {
        prev_h->next_row = curr->next_row;
      }
    }
    // Borramos y avanzamos verticalmente
    Node<T> *to_delete = curr;
    curr = curr->next_col;
    delete to_delete;
  }
  // La cabecera de la columna queda vacia
  cols[c] = nullptr;
}

// Remover por rango de filas y columnas
template <typename T>
void SparseMatrix<T>::remove_range(int r1, int c1, int r2, int c2) {
  // Validación de límites del rango y de la matriz
  if (r1 < 0 || r2 >= n_rows || c1 < 0 || c2 >= n_cols || r1 > r2 || c1 > c2) {
    return;
  }

  for (int r = r1; r <= r2; ++r) {
    Node<T> *curr = rows[r];
    Node<T> *prev_h = nullptr;

    while (curr != nullptr) {
      if (curr->col > c2) {
        break;
      }
      if (curr->col >= c1 && curr->col <= c2) {
        int c = curr->col;
        Node<T> *to_delete = curr;

        // Reconexión horizontal (Fila)
        if (prev_h == nullptr) {
          rows[r] = curr->next_row;
        } else {
          prev_h->next_row = curr->next_row;
        }
        curr = curr->next_row;

        // Reconexion vertical
        if (cols[c] == to_delete) {
          cols[c] = to_delete->next_col;
        } else {
          // Busqueda del nodo superior para no romper la lista vertical
          Node<T> *prev_v = cols[c];
          while (prev_v != nullptr && prev_v->next_col != to_delete) {
            prev_v = prev_v->next_col;
          }
          if (prev_v != nullptr) {
            prev_v->next_col = to_delete->next_col;
          }
        }
        delete to_delete;
      } else {
        prev_h = curr;
        curr = curr->next_row;
      }
    }
  }
}

// ============================================================
// Operaciones de Agregacion
// ============================================================

// Suma de fila especifica
template <typename T>
double SparseMatrix<T>::sum_row(int r) const {
  if (r < 0 || r >= n_rows) {
    return 0;
  }

  double total = 0;
  Node<T> *curr = rows[r];

  while (curr != nullptr) {
    if (is_numeric_generic(curr->value)) {
      total += to_double_generic(curr->value);
    }
    curr = curr->next_row;
  }

  return total;
}

// Suma de columna especifica
template <typename T>
double SparseMatrix<T>::sum_col(int c) const {
  if (c < 0 || c >= n_cols) {
    return 0;
  }

  double total = 0;
  Node<T> *curr = cols[c];

  while (curr != nullptr) {
    if (is_numeric_generic(curr->value)) {
      total += to_double_generic(curr->value);
    }
    curr = curr->next_col;
  }

  return total;
}

// Promedio de fila
template <typename T>
double SparseMatrix<T>::avg_row(int r) const {
  if (r < 0 || r >= n_rows) {
    return 0;
  }

  double total = 0;
  int count = 0;
  Node<T> *curr = rows[r];

  while (curr != nullptr) {
    if (is_numeric_generic(curr->value)) {
      total += to_double_generic(curr->value);
      count++;
    }
    curr = curr->next_row;
  }

  return count > 0 ? total / count : 0;
}
// Promedio de columna
template <typename T>
double SparseMatrix<T>::avg_col(int c) const {
  if (c < 0 || c >= n_cols) {
    return 0;
  }

  double total = 0;
  int count = 0;
  Node<T> *curr = cols[c];

  while (curr != nullptr) {
    if (is_numeric_generic(curr->value)) {
      total += to_double_generic(curr->value);
      count++;
    }
    curr = curr->next_col;
  }

  return count > 0 ? total / count : 0;
}

// Cantidad de elementos no nulos
template <typename T> int SparseMatrix<T>::count() const {
  int count = 0;
  for (int i = 0; i < n_rows; ++i) {
    Node<T> *curr = rows[i];
    while (curr != nullptr) {
      count++;
      curr = curr->next_row;
    }
  }
  return count;
}

template <typename T>
double SparseMatrix<T>::sum_range(int r1, int c1, int r2, int c2) const {
  if (r1 < 0 || r2 >= n_rows || c1 < 0 || c2 >= n_cols || r1 > r2 || c1 > c2) {
    return 0;
  }

  double total = 0;

  for (int r = r1; r <= r2; ++r) {
    Node<T> *curr = rows[r];

    while (curr != nullptr && curr->col <= c2) {
      if (curr->col >= c1 && is_numeric_generic(curr->value)) {
        total += to_double_generic(curr->value);
      }

      curr = curr->next_row;
    }
  }

  return total;
}

// Promedio de rango
template <typename T>
double SparseMatrix<T>::avg_range(int r1, int c1, int r2, int c2) const {
  if (r1 < 0 || r2 >= n_rows || c1 < 0 || c2 >= n_cols || r1 > r2 || c1 > c2) {
    return 0;
  }

  double total = 0;
  int count = 0;

  for (int r = r1; r <= r2; ++r) {
    Node<T> *curr = rows[r];

    while (curr != nullptr && curr->col <= c2) {
      if (curr->col >= c1 && is_numeric_generic(curr->value)) {
        total += to_double_generic(curr->value);
        count++;
      }

      curr = curr->next_row;
    }
  }

  return count > 0 ? total / count : 0;
}
// Minimo de rango
template <typename T>
double SparseMatrix<T>::min_range(int r1, int c1, int r2, int c2) const {
  if (r1 < 0 || r2 >= n_rows || c1 < 0 || c2 >= n_cols || r1 > r2 || c1 > c2) {
    return 0;
  }

  double min_val = 0;
  bool first = true;

  for (int r = r1; r <= r2; ++r) {
    Node<T> *curr = rows[r];

    while (curr != nullptr && curr->col <= c2) {
      if (curr->col >= c1 && is_numeric_generic(curr->value)) {
        double value = to_double_generic(curr->value);

        if (first || value < min_val) {
          min_val = value;
          first = false;
        }
      }

      curr = curr->next_row;
    }
  }

  return first ? 0 : min_val;
}
// Maximo de rango
template <typename T>
double SparseMatrix<T>::max_range(int r1, int c1, int r2, int c2) const {
  if (r1 < 0 || r2 >= n_rows || c1 < 0 || c2 >= n_cols || r1 > r2 || c1 > c2) {
    return 0;
  }

  double max_val = 0;
  bool first = true;

  for (int r = r1; r <= r2; ++r) {
    Node<T> *curr = rows[r];

    while (curr != nullptr && curr->col <= c2) {
      if (curr->col >= c1 && is_numeric_generic(curr->value)) {
        double value = to_double_generic(curr->value);

        if (first || value > max_val) {
          max_val = value;
          first = false;
        }
      }

      curr = curr->next_row;
    }
  }

  return first ? 0 : max_val;
}

//Promedio
template <typename T>
double SparseMatrix<T>::average() const {
  double total = 0;
  int count = 0;

  for (int i = 0; i < n_rows; ++i) {
    Node<T> *curr = rows[i];

    while (curr != nullptr) {
      if (is_numeric_generic(curr->value)) {
        total += to_double_generic(curr->value);
        count++;
      }

      curr = curr->next_row;
    }
  }

  return count > 0 ? total / count : 0;
}
// ============================================================
// OBTENER TODOS LOS NODOS PARA VISUALIZACION
// ============================================================

//Funcion auxiliar
json cell_value_to_json(const CellValue& value) {
  if (std::holds_alternative<int>(value)) {
    return {
        {"type", "int"},
        {"val", std::get<int>(value)}
    };
  }

  if (std::holds_alternative<double>(value)) {
    return {
        {"type", "double"},
        {"val", std::get<double>(value)}
    };
  }

  if (std::holds_alternative<char>(value)) {
    return {
        {"type", "char"},
        {"val", std::string(1, std::get<char>(value))}
    };
  }

  return {
      {"type", "string"},
      {"val", std::get<std::string>(value)}
  };
}


template <typename T>
json SparseMatrix<T>::get_all_nodes() {
  json j = json::array();

  auto ptrToStr = [](void *p) -> std::string {
    if (p == nullptr) {
      return "NULL";
    }

    std::stringstream ss;
    ss << "0x" << std::hex << (uintptr_t)p;
    return ss.str();
  };

  for (int i = 0; i < n_rows; ++i) {
    Node<T> *curr = rows[i];

    while (curr != nullptr) {
      json value_json;

      if constexpr (std::is_same_v<T, CellValue>) {
        value_json = cell_value_to_json(curr->value);
      } else {
        value_json = {
          {"type", "int"},
          {"val", curr->value}
        };
      }

      j.push_back({
        {"r", curr->row},
        {"c", curr->col},
        {"type", value_json["type"]},
        {"val", value_json["val"]},
        {"addr", ptrToStr((void *)curr)},
        {"next_r", ptrToStr((void *)curr->next_row)},
        {"next_c", ptrToStr((void *)curr->next_col)}
      });

      curr = curr->next_row;
    }
  }

  return j;
}

// ============================================================
// MANEJO DE FORMULAS
// ============================================================

// Traduce "A1" a indices (0, 0)
template <typename T>
bool SparseMatrix<T>::parse_cell_ref(std::string ref, int &r, int &c) const {
  if (ref.empty())
    return false;
  
  std::string col_str = "";
  std::string row_str = "";
  bool reading_row = false;

  for (char ch : ref) {
    if (std::isalpha(ch)) {
      if (reading_row) return false; // Error: Letra después de número (ej: A1B)
      col_str += std::toupper(ch);
    }
    else if (std::isdigit(ch)) {
      reading_row = true;
      row_str += ch;
    }
    else {
      return false; // Carácter no permitido (ej: =, +, etc.)
    }
  }
  
  if (col_str.empty() || row_str.empty())
    return false;

  int col = 0;
  for (char ch : col_str) {
    col = col * 26 + (ch - 'A' + 1);
  }
  c = col - 1;
  r = std::stoi(row_str) - 1;
  return true;
}

// Evalua una formula simple como "A1+B1"
template <typename T>
double SparseMatrix<T>::evaluate_formula(std::string formula) const {
  if (formula.empty()) {
    return 0;
  }

  if (formula[0] == '=') {
    formula = formula.substr(1);
  }

  size_t op_pos = std::string::npos;
  char op = ' ';

  if ((op_pos = formula.find('+')) != std::string::npos) {
    op = '+';
  } else if ((op_pos = formula.find('-')) != std::string::npos) {
    op = '-';
  } else if ((op_pos = formula.find('*')) != std::string::npos) {
    op = '*';
  } else if ((op_pos = formula.find('/')) != std::string::npos) {
    op = '/';
  }

  auto get_numeric_val = [&](std::string s) -> double {
    int r, c;

    if (parse_cell_ref(s, r, c)) {
      T value = get_value(r, c);

      if (!is_numeric_generic(value)) {
        throw std::runtime_error("No se puede operar con texto o char");
      }

      return to_double_generic(value);
    }

    try {
      return std::stod(s);
    } catch (...) {
      throw std::runtime_error("Formula invalida");
    }
  };

  if (op_pos == std::string::npos) {
    return get_numeric_val(formula);
  }

  std::string left = formula.substr(0, op_pos);
  std::string right = formula.substr(op_pos + 1);

  double v1 = get_numeric_val(left);
  double v2 = get_numeric_val(right);

  if (op == '+') {
    return v1 + v2;
  }

  if (op == '-') {
    return v1 - v2;
  }

  if (op == '*') {
    return v1 * v2;
  }

  if (op == '/') {
    if (v2 == 0) {
      throw std::runtime_error("Division entre cero");
    }
    return v1 / v2;
  }

  return 0;
}

#endif // SPARSE_MATRIX_
template <typename T>
void SparseMatrix<T>::clear() {
  for (int i = 0; i < n_rows; ++i) {
    Node<T> *curr = rows[i];
    while (curr != nullptr) {
      Node<T> *temp = curr;
      curr = curr->next_row;
      delete temp;
    }
    rows[i] = nullptr;
  }
  for (int j = 0; j < n_cols; ++j) {
    cols[j] = nullptr;
  }
}
