import http from "node:http";

const appUrl = process.env.PRODUCT_LOCAL_APP_URL || "http://127.0.0.1:5175/app/";

function checkApp(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode || 0));
    });

    request.setTimeout(2500, () => {
      request.destroy(new Error(`Timed out checking ${url}`));
    });

    request.on("error", reject);
  });
}

try {
  const statusCode = await checkApp(appUrl);
  if (statusCode >= 200 && statusCode < 400) {
    console.log(`product app ok: ${appUrl}`);
  } else {
    console.error(`product app check failed: ${appUrl} returned HTTP ${statusCode}`);
    console.error("Start it with: npm run app:local");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`product app is not reachable at ${appUrl}`);
  console.error("Start it with: npm run app:local");
  console.error(error?.message || error);
  process.exitCode = 1;
}
