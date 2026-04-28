#include "httplib.h"
#include "json.hpp"
#include "sparse_matrix.h"
#include <iostream>

using json = nlohmann::json;
using namespace httplib;

int main() {
  SparseMatrix<int> matrix(100, 100);

  // Nodos de prueba
  matrix.insert(1, 1, 100);
  matrix.insert(1, 4, 150);
  matrix.insert(3, 2, 200);

  Server svr;

  // CORS middleware
  svr.set_post_routing_handler([](const auto &req, auto &res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
  });

  svr.Options(R"(.*)", [](const Request & /*req*/, Response &res) { res.status = 200; });

  // Get all nodes
  svr.Get("/nodes", [&](const Request & /*req*/, Response &res) {
    json j = json::array();
    auto nodes = matrix.get_all_nodes();
    for (const auto &n : nodes) {
      j.push_back({{"r", n.r}, {"c", n.c}, {"val", n.val}});
    }
    res.set_content(j.dump(), "application/json");
  });

  // Insert node
  svr.Post("/insert", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    matrix.insert(body["r"], body["c"], body["val"]);
    res.set_content(json({"status", "ok"}).dump(), "application/json");
  });

  // Delete single node
  svr.Post("/delete", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    int r = body["r"];
    int c = body["c"];
    matrix.remove_range(r, c, r, c); // Usamos tu funcion de rango para una sola celda
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

  // Stats by Row/Col
  svr.Post("/sum_row", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    res.set_content(json({{"result", matrix.sum_row(body["r"])}}).dump(), "application/json");
  });
  svr.Post("/sum_col", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    res.set_content(json({{"result", matrix.sum_col(body["c"])}}).dump(), "application/json");
  });
  svr.Post("/avg_row", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    res.set_content(json({{"result", matrix.avg_row(body["r"])}}).dump(), "application/json");
  });
  svr.Post("/avg_col", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    res.set_content(json({{"result", matrix.avg_col(body["c"])}}).dump(), "application/json");
  });

  // Get stats
  svr.Get("/stats", [&](const Request & /*req*/, Response &res) {
    json j;
    j["sum"] = matrix.sum();
    j["avg"] = matrix.average();
    j["max"] = matrix.max();
    j["min"] = matrix.min();
    j["count"] = matrix.count();
    res.set_content(j.dump(), "application/json");
  });

  std::cout << "Server started at http://localhost:8080" << std::endl;
  svr.listen("0.0.0.0", 8080);

  return 0;
}
