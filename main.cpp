#include "sparse_matrix.h"
#include <iostream>
#include <iomanip>

using namespace std;

void test_aggregation_operations() {
  cout << "=== Prueba de Operaciones de Agregacion ===" << endl;
  cout << endl;

  // Crear una matriz de 5x5
  SparseMatrix<int> matrix(5, 5);
  cout << "Matriz creada de 5x5" << endl;
  cout << endl;

  // Insertar elementos
  cout << "Insertando elementos..." << endl;
  matrix.insert(0, 0, 5);
  matrix.insert(0, 2, 10);
  matrix.insert(1, 1, 3);
  matrix.insert(1, 3, 7);
  matrix.insert(2, 0, 2);
  matrix.insert(2, 4, 8);
  matrix.insert(3, 2, 4);
  matrix.insert(3, 3, 6);
  matrix.insert(4, 1, 1);
  matrix.insert(4, 4, 9);
  cout << "Elementos insertados: " << matrix.count() << endl;
  cout << endl;

  // Mostrar matriz completa
  cout << "Matriz completa:" << endl;
  for (int i = 0; i < 5; i++) {
    for (int j = 0; j < 5; j++) {
      cout << setw(3) << matrix(i, j) << " ";
    }
    cout << endl;
  }
  cout << endl;

  // Operaciones de agregacion
  cout << "=== Resultados de Agregacion ===" << endl;
  cout << "Suma total: " << matrix.sum() << endl;
  cout << "Producto total: " << matrix.product() << endl;
  cout << "Cantidad de elementos no nulos: " << matrix.count() << endl;
  cout << "Valor minimo: " << matrix.min() << endl;
  cout << "Valor maximo: " << matrix.max() << endl;
  cout << "Promedio: " << matrix.average() << endl;
  cout << endl;

  // Suma por filas
  cout << "=== Suma por Filas ===" << endl;
  for (int i = 0; i < 5; i++) {
    cout << "Fila " << i << ": " << matrix.row_sum(i) << endl;
  }
  cout << endl;

  // Suma por columnas
  cout << "=== Suma por Columnas ===" << endl;
  for (int i = 0; i < 5; i++) {
    cout << "Columna " << i << ": " << matrix.col_sum(i) << endl;
  }
  cout << endl;

  // Prueba con matriz de dobles
  cout << "=== Prueba con Matriz de Dobles ===" << endl;
  SparseMatrix<double> double_matrix(3, 3);
  double_matrix.insert(0, 0, 1.5);
  double_matrix.insert(0, 1, 2.5);
  double_matrix.insert(1, 0, 3.5);
  double_matrix.insert(1, 2, 4.0);
  double_matrix.insert(2, 1, 2.0);

  cout << "Suma: " << double_matrix.sum() << endl;
  cout << "Producto: " << double_matrix.product() << endl;
  cout << "Cantidad: " << double_matrix.count() << endl;
  cout << "Minimo: " << double_matrix.min() << endl;
  cout << "Maximo: " << double_matrix.max() << endl;
  cout << "Promedio: " << double_matrix.average() << endl;
}

int main() {
  test_aggregation_operations();
  return 0;
}
