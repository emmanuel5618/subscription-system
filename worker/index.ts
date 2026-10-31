import { runBilling } from "../src/domain/billing";

async function tick() {
  const now = new Date();

  try {
    const result = await runBilling(now, "worker");
    console.log("Billing run complete", result);
  } catch (error) {
    console.error("Billing run failed", error);
  }
}

console.log("Billing worker started");

tick();

setInterval(() => {
  tick();
}, 60_000);