const https = require("https");
const http = require("http");
const fs = require("fs");

const BASE_URL = process.env.KIBANA_URL || "http://localhost:5601";
const DASHBOARDS_API = "/api/dashboards/dashboard";

// Accept self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function get(url) {
  // Set your username and password here
  const username = process.env.KIBANA_USER || "elastic";
  const password = process.env.KIBANA_PASS || "changeme";
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const options = new URL(url);
  options.headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "x-elastic-internal-origin": "true",
    "elastic-api-version": "1",
  };

  const protocol = options.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    protocol
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, data });
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

async function main() {
  try {
    // Optional limit from command line: node dashboard_status.js 5
    const limit = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;
    const url = `${BASE_URL}${DASHBOARDS_API}?perPage=1000`;
    const { statusCode, data } = await get(url);
    if (statusCode !== 200) {
      console.error(`Failed to fetch dashboards: ${statusCode}`);
      return;
    }
    const json = JSON.parse(data);
    if (!Array.isArray(json.items)) {
      console.error("No items array in response");
      return;
    }
    const outputFile = "dashboard_status_results.csv";
    fs.writeFileSync(outputFile, "id,title,statusCode\n", "utf8"); // Write header
    let count = 0;
    for (const item of json.items) {
      if (limit !== undefined && count >= limit) break;
      const id = item.id;
      if (!id) continue;
      const dashboardUrl = `${BASE_URL}${DASHBOARDS_API}/${id}`;
      let status = "";
      let title = "";
      try {
        const resp = await get(dashboardUrl);
        status = resp.statusCode;
        const { item } = JSON.parse(resp.data);
        title = item.attributes.title ?? "";
      } catch (err) {
        status = "ERROR";
      }
      fs.appendFileSync(outputFile, `${id},${title},${status}\n`, "utf8");
      count++;
    }
    console.log("Results written to dashboard_status_results.csv");
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

main();
