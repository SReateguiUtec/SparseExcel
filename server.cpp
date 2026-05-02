#include "httplib.h"
#include "json.hpp"
#include "sparse_matrix.h"
#include <iostream>

using json = nlohmann::json;
using namespace httplib;

int main() {
  SparseMatrix<int> matrix(100, 100);
  Server svr;

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
    auto body = json::parse(req.body);
    matrix.insert(body["r"], body["c"], body["val"]);
    res.set_content(json({{"status", "ok"}}).dump(), "application/json");
  });

  // Evaluate formula in backend
  svr.Post("/evaluate", [&](const Request &req, Response &res) {
    auto body = json::parse(req.body);
    std::string formula = body["formula"];
    auto resultado = matrix.evaluate_formula(formula);
    res.set_content(json({{"result", resultado}}).dump(), "application/json");
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
