import fetch from "node-fetch";
import { ProxyAgent } from "proxy-agent";
import fs from "fs";
import { Proxy } from "./types";

const readFile = (path: string) => {
  return +fs.readFileSync(path, {
    encoding: "utf-8",
  });
};

let lastProxyIdx = readFile("src/proxy_idx.txt");
console.log(`Last proxy index: ${lastProxyIdx}`);

const writeFile = (idx: number, path: string) => {
  fs.writeFileSync(path, idx.toString());
};

const loadProxies = () => {
  return JSON.parse(
    fs.readFileSync("src/proxies.json", {
      encoding: "utf-8",
    })
  ) as Proxy[];
};

const requestToken = async (
  recipient: string,
  proxies: Proxy[],
  batchSize: number = 5
) => {
  const working: Proxy[] = [];
  while (lastProxyIdx < proxies.length) {
    const batch = proxies.slice(lastProxyIdx, lastProxyIdx + batchSize);
    const promises = batch
      .filter(({ protocol }) => protocol === "http" || protocol === "https")
      .map((_proxy) => {
        const { proxy, ip: host, port, protocol } = _proxy;
        const URL = "https://faucet.testnet.sui.io/v2/gas";
        const payload = {
          FixedAmountRequest: { recipient },
        };
        console.log(`Using ${proxy}...`);
        // console.log(`Using ${proxy}...`);

        return fetch(URL, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(4000),
          agent: new ProxyAgent({
            protocol,
            host,
            port,
          }),
        })
          .then((res) => {
            if (!res.ok) {
              if (res.status === 429) {
                working.push(_proxy);
              }
              console.error(
                `Failed to request token: ${res.status} ${res.statusText}`
              );
            } else {
              console.log(`Requesting SUI Token... Done ${proxy}`);
              working.push(_proxy);
              return res.json();
            }
          })
          .catch((e) => {
            console.error(
              `Failed to request token: ${e.status} ${e.statusText}`
            );
            return null;
          });
      });
    await Promise.all(promises);
    lastProxyIdx += batchSize;
  }

  if (working.length > 0) {
    fs.writeFileSync(
      "src/working_proxies.json",
      JSON.stringify(working, null, 2)
    );
    console.log(`Saved working proxies to src/working_proxies.json`);
  }
  throw new Error("All proxies failed to request token");
};

const main = async () => {
  const proxies = loadProxies();
  const limit = proxies.length;
  const sender =
    "0x61819c99588108d9f7710047e6ad8f2da598de8e98a26ea62bd7ad9847f5329c"; // adjust accordingly
  console.log(`Wallet Address: ${sender}`);

  try {
    while (true) {
      // Request token
      console.log(`Requesting SUI Token...`);
      await requestToken(sender, proxies);
      if (lastProxyIdx >= limit) {
        throw new Error("No more proxies to use");
      }
    }
  } catch (e: any) {
    console.log(`${sender}: ${e.message}`);
    console.error(e);
  } finally {
    process.exit(0);
  }
};

const handleExit = () => {
  console.log(`Saving last proxy index: ${lastProxyIdx}`);
  writeFile(lastProxyIdx, "src/proxy_idx.txt");
  console.log("Cleanup complete. Exiting...");
  process.exit(0);
};

process.on("SIGINT", handleExit); // Handle Ctrl+C
process.on("SIGTERM", handleExit); // Handle termination signal
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  handleExit();
});

main();
