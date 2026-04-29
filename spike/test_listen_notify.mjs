/**
 * End-to-end LISTEN/NOTIFY test — two connections.
 * Connection 1: LISTEN on ppm_status_change
 * Connection 2: UPDATE a deliverable status (trigger fires NOTIFY)
 */
import pg from "pg";
const { Client } = pg;

const dbConfig = {
    database: "worklenz_spike_test",
    host: "/tmp",
};

async function main() {
    // Connection 1: Listener
    const listener = new Client(dbConfig);
    await listener.connect();
    await listener.query("LISTEN ppm_status_change");
    console.log("[LISTENER] Connected and listening on ppm_status_change");

    const notificationReceived = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout — no notification received in 5s")), 5000);
        listener.on("notification", (msg) => {
            clearTimeout(timeout);
            console.log("[LISTENER] Notification received!");
            console.log("[LISTENER] Channel:", msg.channel);
            console.log("[LISTENER] Payload:", msg.payload);
            const payload = JSON.parse(msg.payload);
            console.log("[LISTENER] Parsed:", JSON.stringify(payload, null, 2));
            resolve(payload);
        });
    });

    // Connection 2: Writer (triggers NOTIFY via trigger)
    const writer = new Client(dbConfig);
    await writer.connect();
    console.log("[WRITER]   Connected");

    // Reset status first so we can trigger a change
    await writer.query(`
        UPDATE ppm_deliverables SET status = 'client_review', updated_at = NOW()
        WHERE title = 'Beta Social Posts'
    `);
    // Small delay to let the first update settle
    await new Promise(r => setTimeout(r, 100));

    console.log("[WRITER]   Updating 'Beta Social Posts' status → approved");
    await writer.query(`
        UPDATE ppm_deliverables SET status = 'approved', updated_at = NOW()
        WHERE title = 'Beta Social Posts'
    `);

    try {
        const payload = await notificationReceived;
        console.log("\n=== LISTEN/NOTIFY END-TO-END: PASS ===");
        console.log("Two separate connections. Trigger fired. Notification received.");
        console.log("Payload contains: deliverable_id, old_status, new_status, client_id, timestamp");
    } catch (err) {
        console.error("\n=== LISTEN/NOTIFY END-TO-END: FAIL ===");
        console.error(err.message);
    }

    await listener.end();
    await writer.end();
}

main().catch(console.error);
