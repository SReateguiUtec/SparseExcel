#include "httplib.h"
#include "json.hpp"
#include "sparse_matrix.h"
#include <iostream>
#include <variant>
#include <chrono>
#include <random>

using json = nlohmann::json;
using namespace httplib;

int main() {
  using CellValue = std::variant<int, double, char, std::string>;
  SparseMatrix<CellValue> matrix(1000, 1000); // Matriz más grande para la prueba
  Server svr;

  // ============================================================
  // BENCHMARK DE RENDIMIENTO
  // ============================================================
  std::cout << "--- INICIANDO PRUEBA DE RENDIMIENTO ---" << std::endl;
  
  auto start_ins = std::chrono::high_resolution_clock::now();
  
  // Insertar 100,000 nodos aleatorios
  int nodos_a_insertar = 100000;
  std::random_device rd;
  std::mt19937 gen(rd());
  std::uniform_int_distribution<> dis_val(1, 100);
  std::uniform_int_distribution<> dis_pos(0, 999);

  for (int i = 0; i < nodos_a_insertar; ++i) {
    matrix.insert(dis_pos(gen), dis_pos(gen), dis_val(gen));
  }

  auto end_ins = std::chrono::high_resolution_clock::now();
  std::chrono::duration<double> diff_ins = end_ins - start_ins;
  
  std::cout << ">> Insercion de " << nodos_a_insertar << " nodos: " << diff_ins.count() << " segundos." << std::endl;

  // Medir tiempo de SUMA TOTAL
  auto start_sum = std::chrono::high_resolution_clock::now();
  double resultado_suma = matrix.average(); // Usamos average que recorre toda la matriz
  auto end_sum = std::chrono::high_resolution_clock::now();
  
  std::chrono::duration<double> diff_sum = end_sum - start_sum;
  
  std::cout << ">> Recorrido y calculo sobre todos los nodos: " << diff_sum.count() << " segundos." << std::endl;
  std::cout << "--- PRUEBA FINALIZADA (LIMPIANDO...) ---" << std::endl;
  
  matrix.clear();
  std::cout << ">> Servidor listo." << std::endl << std::endl;  // ============================================================
  // CORS middleware
  svr.set_post_routing_handler([](const auto &req, auto &res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods",
                   "GET, POST, DELETE, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
  });

  svr.Options(R"(.*)",
              [](const Request & /*req*/, Response &res) { res.status = 200; });

  // Get all nodes
  svr.Get("/nodes", [&](const Request & /*req*/, Response &res) {
    res.set_content(matrix.get_all_nodes().dump(), "application/json");
  });

  // Insert node
  svr.Post("/insert", [&](const Request &req, Response &res) {
  try {
    auto body = json::parse(req.body);

    int r = body["r"].get<int>();
    int c = body["c"].get<int>();

    CellValue value;

    if (body["val"].is_number_integer()) {
      long long temp = body["val"].get<long long>();
      if (temp > 2147483647 || temp < -2147483648) {
        value = static_cast<double>(temp);
      } else {
        value = static_cast<int>(temp);
      }
    }
    else if (body["val"].is_number_float()) {
      value = body["val"].get<double>();
    }
    else if (body["val"].is_string()) {
      std::string s = body["val"].get<std::string>();

      if (s.empty()) {
        value = 0;
      }
      else {
        bool es_numero = true;
        bool tiene_punto = false;

        for (char ch : s) {
          if (!std::isdigit(ch) && ch != '-' && ch != '.') {
            es_numero = false;
            break;
          }
          if (ch == '.') {
            if (tiene_punto) es_numero = false;
            tiene_punto = true;
          }
        }

        if (es_numero) {
          try {
            if (tiene_punto) {
              value = std::stod(s);
            } else {
              // Si es un número entero, verificamos si cabe en un int de 32 bits
              long long temp = std::stoll(s);
              if (temp > 2147483647 || temp < -2147483648) {
                value = static_cast<double>(temp); // Si es muy grande, lo guardamos como double
              } else {
                value = static_cast<int>(temp); // Si cabe, lo guardamos como int
              }
            }
          } catch (...) {
            value = s; // Si falla la conversión (ej: número demasiado grande incluso para long long), como string
          }
        }
        else if (s.size() == 1) {
          value = s[0];   // char
        }
        else {
          value = s;      // string
        }
      }
    }
    else {
      res.status = 400;
      res.set_content(json({{"error", "Valor no valido"}}).dump(), "application/json");
      return;
    }

    matrix.insert(r, c, value);

    res.set_content(json({{"status", "ok"}}).dump(), "application/json");
  }
  catch (const std::exception &e) {
    res.status = 500;
    res.set_content(json({{"error", e.what()}}).dump(), "application/json");
  }
});

  // Modify node
  svr.Post("/modify", [&](const Request &req, Response &res) {
    try {
      auto body = json::parse(req.body);
      int r = body["r"].get<int>();
      int c = body["c"].get<int>();
      
      CellValue value;
      if (body["val"].is_number_integer()) value = body["val"].get<int>();
      else if (body["val"].is_number_float()) value = body["val"].get<double>();
      else value = body["val"].get<std::string>();

      matrix.modify(r, c, value);
      res.set_content(json({{"status", "ok", "method", "modify"}}).dump(), "application/json");
    } catch (const std::exception &e) {
      res.status = 500;
      res.set_content(json({{"error", e.what()}}).dump(), "application/json");
    }
  });

  // Evaluate formula in backend
  svr.Post("/evaluate", [&](const Request &req, Response &res) {
    try {
      auto body = json::parse(req.body);
      std::string formula = body["formula"];
      auto resultado = matrix.evaluate_formula(formula);
      res.set_content(json({{"result", resultado}}).dump(), "application/json");
    } catch (const std::exception &e) {
      res.status = 400;
      res.set_content(json({{"error", e.what()}}).dump(), "application/json");
    }
  });

  // Delete single node
  svr.Post("/delete", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    int r = body["r"];
    int c = body["c"];
    matrix.remove_range(r, c, r,
                        c); // Usamos tu funcion de rango para una sola celda
    res.set_content(json({"status", "ok"}).dump(), "application/json");
  });

  // Remove Row
  svr.Post("/remove_row", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    matrix.remove_row(body["r"]);
    res.set_content(json({"status", "ok"}).dump(), "application/json");
  });

  // Remove Column
  svr.Post("/remove_col", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    matrix.remove_col(body["c"]);
    res.set_content(json({"status", "ok"}).dump(), "application/json");
  });

  // Remove Range
  svr.Post("/remove_range", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    matrix.remove_range(body["r1"], body["c1"], body["r2"], body["c2"]);
    res.set_content(json({"status", "ok"}).dump(), "application/json");
  });

  // Sum Range
  svr.Post("/sum_range", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    auto resultado =
        matrix.sum_range(body["r1"], body["c1"], body["r2"], body["c2"]);
    res.set_content(json({{"result", resultado}}).dump(), "application/json");
  });

  // Average Range
  svr.Post("/avg_range", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    auto resultado =
        matrix.avg_range(body["r1"], body["c1"], body["r2"], body["c2"]);
    res.set_content(json({{"result", resultado}}).dump(), "application/json");
  });

  // Min Range
  svr.Post("/min_range", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    auto resultado =
        matrix.min_range(body["r1"], body["c1"], body["r2"], body["c2"]);
    res.set_content(json({{"result", resultado}}).dump(), "application/json");
  });

  // Max Range
  svr.Post("/max_range", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    auto resultado =
        matrix.max_range(body["r1"], body["c1"], body["r2"], body["c2"]);
    res.set_content(json({{"result", resultado}}).dump(), "application/json");
  });

  // Stats by Row/Col
  svr.Post("/sum_row", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    res.set_content(json({{"result", matrix.sum_row(body["r"])}}).dump(),
                    "application/json");
  });
  svr.Post("/sum_col", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    res.set_content(json({{"result", matrix.sum_col(body["c"])}}).dump(),
                    "application/json");
  });
  svr.Post("/avg_row", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    res.set_content(json({{"result", matrix.avg_row(body["r"])}}).dump(),
                    "application/json");
  });
  svr.Post("/avg_col", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    res.set_content(json({{"result", matrix.avg_col(body["c"])}}).dump(),
                    "application/json");
  });

  // Get stats
  svr.Get("/stats", [&](const Request & /*req*/, Response &res) {
    json j;
    j["count"] = matrix.count();
    res.set_content(j.dump(), "application/json");
  });

  std::cout << "Server started at http://localhost:8080" << std::endl;
  svr.listen("0.0.0.0", 8080);

  return 0;
}
