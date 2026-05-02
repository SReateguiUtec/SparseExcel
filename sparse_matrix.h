#ifndef SPARSE_MATRIX_H
#define SPARSE_MATRIX_H
#include "json.hpp"
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using json = nlohmann::json;

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
  T average() const;
  T sum_row(int r) const;
  T sum_col(int c) const;
  double avg_row(int r) const;
  double avg_col(int c) const;
  T sum_range(int r1, int c1, int r2, int c2) const;
  T avg_range(int r1, int c1, int r2, int c2) const;
  T min_range(int r1, int c1, int r2, int c2) const;
  T max_range(int r1, int c1, int r2, int c2) const;

  // Formulas
  bool parse_cell_ref(std::string ref, int &r, int &c) const;
  T evaluate_formula(std::string formula) const;

  // Para visualizacion
  nlohmann::json get_all_nodes();
};

// ============================================================
// Operaciones Basicas
// ============================================================

// Insertamos nodo en posicion (i, j)
template <typename T> void SparseMatrix<T>::insert(int r, int c, T value) {
  // Validacion de seguridad estricta para evitar Segmentation Faults (caída del
  // servidor)
  if (r < 0 || c < 0 || c >= 26) {
    return;
  }

  // Si el valor es 0, no creamos nodo (o borramos si existía)
  if (value == 0) {
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
template <typename T> T SparseMatrix<T>::get_value(int r, int c) const {
  Node<T> *curr = rows[r];
  while (curr != nullptr && curr->col < c) {
    curr = curr->next_row;
  }
  if (curr != nullptr && curr->col == c) {
    return curr->value;
  }
  return 0;
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
template <typename T> T SparseMatrix<T>::sum_row(int r) const {
  if (r < 0 || r >= n_rows)
    return 0;
  T total = 0;
  Node<T> *curr = rows[r];
  while (curr != nullptr) {
    total += curr->value;
    curr = curr->next_row;
  }
  return total;
}

// Suma de columna especifica
template <typename T> T SparseMatrix<T>::sum_col(int c) const {
  if (c < 0 || c >= n_cols)
    return 0;
  T total = 0;
  Node<T> *curr = cols[c];
  while (curr != nullptr) {
    total += curr->value;
    curr = curr->next_col;
  }
  return total;
}

// Promedio de fila
template <typename T> double SparseMatrix<T>::avg_row(int r) const {
  if (r < 0 || r >= n_rows)
    return 0;
  double total = 0;
  int count = 0;
  Node<T> *curr = rows[r];
  while (curr != nullptr) {
    total += curr->value;
    count++;
    curr = curr->next_row;
  }
  return count > 0 ? total / count : 0;
}

// Promedio de columna
template <typename T> double SparseMatrix<T>::avg_col(int c) const {
  if (c < 0 || c >= n_cols) {
    return 0;
  }
  double total = 0;
  int count = 0;
  Node<T> *curr = cols[c];
  while (curr != nullptr) {
    total += curr->value;
    count++;
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
T SparseMatrix<T>::sum_range(int r1, int c1, int r2, int c2) const {
  // Validaciones basicas
  if (r1 < 0 || r2 >= n_rows || c1 < 0 || c2 >= n_cols) {
    return 0;
  }
  T total = 0;
  for (int r = r1; r <= r2; ++r) {
    Node<T> *curr = rows[r];
    while (curr != nullptr && curr->col <= c2) {
      // Solo sumamos si ya pasamos el límite izquierdo (c1)
      if (curr->col >= c1) {
        total += curr->value;
      }
      curr = curr->next_row;
    }
  }
  return total;
}

// Promedio de rango
template <typename T>
T SparseMatrix<T>::avg_range(int r1, int c1, int r2, int c2) const {
  if (r1 < 0 || r2 >= n_rows || c1 < 0 || c2 >= n_cols)
    return 0;
  T total = 0;
  int count = 0;
  for (int r = r1; r <= r2; ++r) {
    Node<T> *curr = rows[r];
    while (curr != nullptr && curr->col <= c2) {
      if (curr->col >= c1) {
        total += curr->value;
        count++;
      }
      curr = curr->next_row;
    }
  }
  return count > 0 ? total / count : 0;
}

// Minimo de rango
template <typename T>
T SparseMatrix<T>::min_range(int r1, int c1, int r2, int c2) const {
  if (r1 < 0 || r2 >= n_rows || c1 < 0 || c2 >= n_cols)
    return 0;
  T min_val = 0;
  bool first = true;
  for (int r = r1; r <= r2; ++r) {
    Node<T> *curr = rows[r];
    while (curr != nullptr && curr->col <= c2) {
      if (curr->col >= c1) {
        if (first || curr->value < min_val) {
          min_val = curr->value;
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
T SparseMatrix<T>::max_range(int r1, int c1, int r2, int c2) const {
  if (r1 < 0 || r2 >= n_rows || c1 < 0 || c2 >= n_cols)
    return 0;
  T max_val = 0;
  bool first = true;
  for (int r = r1; r <= r2; ++r) {
    Node<T> *curr = rows[r];
    while (curr != nullptr && curr->col <= c2) {
      if (curr->col >= c1) {
        if (first || curr->value > max_val) {
          max_val = curr->value;
          first = false;
        }
      }
      curr = curr->next_row;
    }
  }
  return first ? 0 : max_val;
}

// ============================================================
// OBTENER TODOS LOS NODOS PARA VISUALIZACION
// ============================================================
template <typename T> json SparseMatrix<T>::get_all_nodes() {
  json j = json::array();

  // Helper: convierte puntero a string hex, o "NULL"
  auto ptrToStr = [](void *p) -> std::string {
    if (p == nullptr)
      return "NULL";
    std::stringstream ss;
    ss << "0x" << std::hex << (uintptr_t)p;
    return ss.str();
  };

  for (int i = 0; i < n_rows; ++i) {
    Node<T> *curr = rows[i];
    while (curr != nullptr) {
      j.push_back({{"r", curr->row},
                   {"c", curr->col},
                   {"val", curr->value},
                   {"addr", ptrToStr((void *)curr)},
                   {"next_r", ptrToStr((void *)curr->next_row)},
                   {"next_c", ptrToStr((void *)curr->next_col)}});
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
  for (char ch : ref) {
    if (std::isalpha(ch))
      col_str += std::toupper(ch);
    else if (std::isdigit(ch))
      row_str += ch;
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
T SparseMatrix<T>::evaluate_formula(std::string formula) const {
  if (formula.empty())
    return 0;
  if (formula[0] == '=')
    formula = formula.substr(1);

  // Buscamos el operador
  size_t op_pos = std::string::npos;
  char op = ' ';
  if ((op_pos = formula.find('+')) != std::string::npos)
    op = '+';
  else if ((op_pos = formula.find('-')) != std::string::npos)
    op = '-';
  else if ((op_pos = formula.find('*')) != std::string::npos)
    op = '*';
  else if ((op_pos = formula.find('/')) != std::string::npos)
    op = '/';

  if (op_pos == std::string::npos) {
    // Es una sola referencia o un numero
    int r, c;
    if (parse_cell_ref(formula, r, c)) {
      return get_value(r, c);
    }
    try {
      return (T)std::stod(formula);
    } catch (...) {
      return 0;
    }
  }

  std::string left = formula.substr(0, op_pos);
  std::string right = formula.substr(op_pos + 1);

  auto get_val = [&](std::string s) -> T {
    int r, c;
    if (parse_cell_ref(s, r, c)) {
      return get_value(r, c);
    }
    try {
      return (T)std::stod(s);
    } catch (...) {
      return 0;
    }
  };

  T v1 = get_val(left);
  T v2 = get_val(right);

  if (op == '+')
    return v1 + v2;
  if (op == '-')
    return v1 - v2;
  if (op == '*')
    return v1 * v2;
  if (op == '/' && v2 != 0)
    return v1 / v2;

  return 0;
}

#endif // SPARSE_MATRIX_