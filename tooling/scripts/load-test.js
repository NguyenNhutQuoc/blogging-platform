// k6 load test for the public read paths (the endpoints that take real traffic).
//
// Install k6 (https://k6.io/docs/get-started/installation/), then:
//   BASE_URL=https://api.example.com k6 run tooling/scripts/load-test.js
//
// Defaults to the local API. Override SLUG / SEARCH_TERM to match seeded data.
//
// Thresholds fail the run (non-zero exit) if latency or error rate regress —
// suitable for a CI performance gate.
import http from "k6/http";
import { check, sleep, group } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3003";
const SLUG = __ENV.SLUG || "welcome-to-the-blog";
const SEARCH_TERM = __ENV.SEARCH_TERM || "the";

export const options = {
  // Ramp 0→50 VUs, hold, ramp down — a modest sustained-load profile.
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% errors
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
  },
};

export default function () {
  group("health", () => {
    const res = http.get(`${BASE_URL}/api/v1/health`);
    check(res, { "health 200": (r) => r.status === 200 });
  });

  group("posts listing", () => {
    const res = http.get(`${BASE_URL}/api/v1/posts?page=1&pageSize=10&status=published`);
    check(res, {
      "list 200": (r) => r.status === 200,
      "list has data": (r) => Array.isArray(r.json("data")),
    });
  });

  group("post detail", () => {
    const res = http.get(`${BASE_URL}/api/v1/posts/${SLUG}`);
    check(res, { "detail 200 or 404": (r) => r.status === 200 || r.status === 404 });
  });

  group("search", () => {
    const res = http.get(`${BASE_URL}/api/v1/search?q=${encodeURIComponent(SEARCH_TERM)}`);
    check(res, { "search 200": (r) => r.status === 200 });
  });

  sleep(1);
}
